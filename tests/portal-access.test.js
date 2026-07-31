'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.resolve(__dirname, '..', 'pub', 'domian-calculator-a4');
const config = require(path.join(appRoot, 'assets/js/site-config.js'));
const gate = require(path.join(appRoot, 'assets/js/access-gate.js'));

function read(fileName) {
  return fs.readFileSync(path.join(appRoot, fileName), 'utf8');
}

function createStorage(initialValues) {
  const values = Object.assign({}, initialValues);
  return {
    values,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setItem(key, value) {
      values[key] = String(value);
    },
    removeItem(key) {
      delete values[key];
    }
  };
}

function createProtectedDocument() {
  const classes = new Set(['access-pending']);
  return {
    documentElement: {
      dataset: { accessPage: 'protected' },
      classList: {
        add(value) {
          classes.add(value);
        },
        remove(value) {
          classes.delete(value);
        }
      }
    },
    readyState: 'complete',
    querySelectorAll() {
      return [];
    },
    classes
  };
}

test('portal start page repeats the four working cards above and below the calendar', () => {
  const html = read('index.html');
  const cards = Array.from(html.matchAll(/<a class="tool-card" href="([^"]+)">/g), (match) => match[1]);
  const targets = [
    'calculator.html',
    'motivation-calculator.html',
    'table.html',
    'career.html'
  ];

  assert.deepEqual(cards, [
    ...targets,
    ...targets
  ]);
  targets.forEach((target) => {
    assert.equal(fs.existsSync(path.join(appRoot, target)), true, target);
  });
  assert.ok(html.indexOf('id="primaryToolsTitle"') < html.indexOf('id="calendarTitle"'));
  assert.ok(html.indexOf('id="calendarTitle"') < html.indexOf('id="toolsTitle"'));
});

test('working page navigation exposes only the portal sections and logout', () => {
  ['calculator.html', 'table-ledger.html', 'career.html'].forEach((fileName) => {
    const html = read(fileName);
    const navigation = Array.from(
      html.matchAll(/<nav\b[\s\S]*?<\/nav>/g),
      (match) => match[0]
    ).join('\n');

    assert.doesNotMatch(navigation, /simple\.html|extended\.html|На старт/);
    assert.doesNotMatch(html, /href="(?:start|simple|extended)\.html"/);
    assert.match(navigation, /href="index\.html"[^>]*>Главная</);
    assert.match(navigation, /href="calculator\.html"[^>]*>Калькулятор</);
    assert.match(navigation, /href="motivation-calculator\.html"[^>]*>Мотивация 2026</);
    assert.match(navigation, /href="table\.html"[^>]*>Табличный</);
    assert.match(navigation, /href="career\.html"[^>]*>Карьера</);
    assert.match(navigation, /data-access-logout>Выйти</);
  });
});

test('compatibility routes point to the new stable targets', () => {
  assert.match(read('motivation-calculator.html'), /calculator\.html\?mode=motivation2026/);
  assert.match(read('table.html'), /table-ledger\.html/);
  assert.match(read('table.html'), /location\.replace\('table-ledger\.html'\)/);
  ['start.html', 'simple.html', 'extended.html'].forEach((fileName) => {
    assert.match(read(fileName), /url=index\.html/);
    assert.match(read(fileName), /location\.replace\('index\.html'\)/);
  });
});

test('legacy index motivation query is recognized and targets the calculator route', () => {
  assert.equal(gate.isLegacyMotivationRoute({
    pathname: '/Dom2/index.html',
    search: '?mode=motivation2026'
  }), true);
  assert.match(read('assets/js/access-gate.js'), /replace\('calculator\.html\?mode=motivation2026'\)/);
});

test('calendar configuration uses the requested public calendar and Moscow timezone', () => {
  const html = read('index.html');
  const iframeTag = html.match(/<iframe[\s\S]*?<\/iframe>/)[0];

  assert.equal(
    config.CALENDAR_ID,
    '5b4b93c7f9aa9b97340a1b7858163771ac5e518814556cf6e1b4d8c2bfb155f7@group.calendar.google.com'
  );
  assert.match(config.CALENDAR_EMBED_URL, /ctz=Europe%2FMoscow/);
  assert.match(html, /ctz=Europe%2FMoscow/);
  assert.match(html, /public\/basic\.ics/);
  assert.match(iframeTag, /data-src="https:\/\/calendar\.google\.com\/calendar\/embed/);
  assert.doesNotMatch(iframeTag, /\ssrc=/);
  assert.match(iframeTag, /title="Календарь важных событий франшизы Домиан"/);
  assert.match(iframeTag, /loading="lazy"/);
  assert.match(iframeTag, /frameborder="0"/);
  assert.match(iframeTag, /scrolling="no"/);
});

test('guard is connected to every protected working page', () => {
  ['calculator.html', 'table-ledger.html', 'career.html'].forEach((fileName) => {
    const html = read(fileName);
    assert.match(html, /class="access-pending" data-access-page="protected"/);
    assert.match(html, /assets\/js\/site-config\.js/);
    assert.match(html, /assets\/js\/access-gate\.js/);
    assert.match(html, /Для работы портала необходимо включить JavaScript/);
  });
});

test('monthly token is calculated in Europe Moscow and expires in a new month', () => {
  const storage = createStorage({
    [config.STORAGE_KEY]: '2026-01'
  });
  const moscowFebruary = new Date('2026-01-31T21:30:00.000Z');

  assert.equal(gate.getMoscowMonth(moscowFebruary), '2026-02');
  assert.equal(gate.hasCurrentAccess(storage, config, moscowFebruary), false);

  gate.storeCurrentAccess(storage, config, moscowFebruary);
  assert.equal(storage.values[config.STORAGE_KEY], '2026-02');
  assert.notEqual(storage.values[config.STORAGE_KEY], config.ACCESS_CODE);
  assert.equal(gate.hasCurrentAccess(storage, config, moscowFebruary), true);
});

test('wrong password never grants access', () => {
  assert.equal(gate.isCorrectCode('wrong-password', config), false);
  assert.equal(gate.isCorrectCode(config.ACCESS_CODE, config), true);
});

test('logout removes only the portal access key', () => {
  const storage = createStorage({
    [config.STORAGE_KEY]: '2026-07',
    domianA4DraftV2: '{"version":2}',
    domianA4LedgerDraftV1: '{"version":1}',
    domianCareerDraftV1: '{"version":1}'
  });

  gate.clearAccess(storage, config);

  assert.equal(storage.values[config.STORAGE_KEY], undefined);
  assert.equal(storage.values.domianA4DraftV2, '{"version":2}');
  assert.equal(storage.values.domianA4LedgerDraftV1, '{"version":1}');
  assert.equal(storage.values.domianCareerDraftV1, '{"version":1}');
  assert.doesNotMatch(read('assets/js/access-gate.js'), /localStorage\.clear\(/);
});

test('next accepts only exact local allowlisted routes', () => {
  [
    'calculator.html',
    'calculator.html?mode=motivation2026',
    'table.html',
    'table-ledger.html',
    'career.html'
  ].forEach((route) => {
    assert.equal(gate.sanitizeNext(route), route);
  });

  [
    'https://example.com/',
    '//example.com/',
    '/calculator.html',
    '../calculator.html',
    'calculator.html?mode=other',
    'javascript:alert(1)'
  ].forEach((route) => {
    assert.equal(gate.sanitizeNext(route), '');
  });
});

test('calculator and motivation navigation states are distinct', () => {
  assert.equal(gate.getActiveRoute({
    pathname: '/Dom2/calculator.html',
    search: ''
  }), 'calculator');
  assert.equal(gate.getActiveRoute({
    pathname: '/Dom2/calculator.html',
    search: '?mode=motivation2026'
  }), 'motivation');
});

test('authorized table guard preserves and exposes an existing ledger draft', () => {
  const now = new Date('2026-07-31T08:00:00.000Z');
  const storage = createStorage({
    [config.STORAGE_KEY]: gate.getMoscowMonth(now),
    domianA4LedgerDraftV1: '{"version":1,"ownerSales":100000}'
  });
  const documentObject = createProtectedDocument();
  const locationObject = {
    pathname: '/Dom2/table-ledger.html',
    search: '',
    href: '',
    replace(value) {
      this.replaced = value;
    }
  };

  gate.bootstrap({
    document: documentObject,
    location: locationObject,
    localStorage: storage,
    DOMIAN_SITE_CONFIG: config
  });

  assert.equal(locationObject.replaced, undefined);
  assert.equal(storage.values.domianA4LedgerDraftV1, '{"version":1,"ownerSales":100000}');
  assert.equal(documentObject.classes.has('access-pending'), false);
  assert.equal(documentObject.classes.has('access-ready'), true);
});

test('table office inputs stack without page overflow on mobile', () => {
  const css = read('assets/css/table-ledger.css');

  assert.match(css, /\.top-grid > \* \{\s*min-width: 0;/);
  assert.match(
    css,
    /@media \(max-width: 720px\) \{[\s\S]*?\.expense-row \{\s*grid-template-columns: minmax\(0, 1fr\);/
  );
});
