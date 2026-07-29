const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');

function loadCalendarPolicy() {
  const context = { window: {}, console };
  vm.createContext(context);

  const source = fs.readFileSync(path.join(rootDir, 'assets/js/calendar-policy.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'assets/js/calendar-policy.js' });
  Object.assign(context, context.window);

  return context.window;
}

function test(name, fn) {
  try {
    fn();
    console.log('PASS', name);
  } catch (error) {
    console.error('FAIL', name);
    console.error(error.stack);
    process.exitCode = 1;
  }
}

const policy = loadCalendarPolicy();

test('parseSelectedMonth accepts only YYYY-MM calendar months', () => {
  const parsed = policy.parseSelectedMonth('2026-07');
  assert.equal(parsed.value, '2026-07');
  assert.equal(parsed.year, 2026);
  assert.equal(parsed.month, 7);
  assert.equal(parsed.monthIndex, 6);
  assert.equal(policy.parseSelectedMonth(''), null);
  assert.equal(policy.parseSelectedMonth('2026-00'), null);
  assert.equal(policy.parseSelectedMonth('2026-13'), null);
  assert.equal(policy.parseSelectedMonth('07-2026'), null);
});

test('congress is a January financial obligation and February event only', () => {
  const january = policy.buildCalendarContext('2026-01');
  const february = policy.buildCalendarContext('2026-02');

  assert.equal(january.events.congress.countsInSelectedMonth, true);
  assert.equal(january.events.congress.uiStatus, 'active');
  assert.equal(february.events.congress.countsInSelectedMonth, false);
  assert.equal(february.events.congress.uiStatus, 'infoOnly');
  assert.match(february.events.congress.eventLabel, /февраль 2026/i);
});

test('mountains count in March and become event-only in April', () => {
  const march = policy.buildCalendarContext('2026-03');
  const april = policy.buildCalendarContext('2026-04');
  const july = policy.buildCalendarContext('2026-07');

  assert.equal(march.events.mountains.countsInSelectedMonth, true);
  assert.equal(march.events.mountains.uiStatus, 'active');
  assert.equal(april.events.mountains.countsInSelectedMonth, false);
  assert.equal(april.events.mountains.uiStatus, 'infoOnly');
  assert.equal(july.events.mountains.countsInSelectedMonth, false);
  assert.equal(july.events.mountains.uiStatus, 'past');
});

test('sea is future information in July, counted in August and event-only in September', () => {
  const july = policy.buildCalendarContext('2026-07');
  const august = policy.buildCalendarContext('2026-08');
  const september = policy.buildCalendarContext('2026-09');

  assert.equal(july.events.sea.countsInSelectedMonth, false);
  assert.equal(july.events.sea.uiStatus, 'future');
  assert.equal(august.events.sea.countsInSelectedMonth, true);
  assert.equal(august.events.sea.uiStatus, 'active');
  assert.equal(september.events.sea.countsInSelectedMonth, false);
  assert.equal(september.events.sea.uiStatus, 'infoOnly');
});

test('star is collected in December for the next February congress', () => {
  const december = policy.buildCalendarContext('2026-12');

  assert.equal(december.events.star.countsInSelectedMonth, true);
  assert.equal(december.events.star.uiStatus, 'active');
  assert.match(december.events.star.eventLabel, /февраль 2027/i);
});

test('star is not a January financial obligation after December collection', () => {
  const january = policy.buildCalendarContext('2026-01');

  assert.equal(january.events.star.countsInSelectedMonth, false);
  assert.equal(january.events.star.uiStatus, 'infoOnly');
  assert.match(january.events.star.collectionLabel, /декабрь 2025/i);
  assert.match(january.events.star.eventLabel, /февраль 2026/i);
});

test('stipend payment context maps selected month to the earning quarter', () => {
  const january = policy.getStipendPaymentContext('2026-01');
  const july = policy.getStipendPaymentContext('2026-07');

  assert.equal(january.resultPeriod, '2025-Q4');
  assert.equal(january.paymentQuarter, '2026-Q1');
  assert.equal(january.paymentMonthIndex, 1);
  assert.equal(january.countsInSelectedMonth, true);
  assert.equal(july.resultPeriod, '2026-Q2');
  assert.equal(july.paymentQuarter, '2026-Q3');
  assert.equal(july.paymentMonthIndex, 1);
});

test('autumn travel collection follows configured event month', () => {
  const octoberTrip = policy.buildCalendarContext('2026-09', {
    autumnTravelEventMonth: '2026-10'
  });
  const novemberTrip = policy.buildCalendarContext('2026-10', {
    autumnTravelEventMonth: '2026-11'
  });

  assert.equal(octoberTrip.events.autumnTravel.countsInSelectedMonth, true);
  assert.match(octoberTrip.events.autumnTravel.eventLabel, /октябрь 2026/i);
  assert.equal(novemberTrip.events.autumnTravel.countsInSelectedMonth, true);
  assert.match(novemberTrip.events.autumnTravel.eventLabel, /ноябрь 2026/i);
});

test('summer corporate is organizational in June and financial in July', () => {
  const june = policy.buildCalendarContext('2026-06');
  const july = policy.buildCalendarContext('2026-07');

  assert.equal(june.events.summerCorporate.countsInSelectedMonth, false);
  assert.equal(june.events.summerCorporate.uiStatus, 'warning');
  assert.equal(july.events.summerCorporate.countsInSelectedMonth, true);
  assert.equal(july.events.summerCorporate.uiStatus, 'active');
});
