const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');

function loadLedger() {
  const localStorageStore = {};
  const nodes = Object.create(null);
  const document = {
    activeElement: null,
    addEventListener() {},
    getElementById(id) {
      if (!nodes[id]) {
        nodes[id] = { innerHTML: '', textContent: '', value: '', className: '' };
      }
      return nodes[id];
    },
    querySelector() {
      return { innerHTML: '', textContent: '', value: '', focus() {} };
    }
  };
  const context = {
    window: {},
    console,
    document,
    localStorageStore,
    localStorage: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(localStorageStore, key) ? localStorageStore[key] : null;
      },
      setItem(key, value) {
        localStorageStore[key] = String(value);
      },
      removeItem(key) {
        delete localStorageStore[key];
      }
    }
  };
  vm.createContext(context);

  ['assets/js/constants.js', 'assets/js/calculations.js'].forEach((fileName) => {
    vm.runInContext(fs.readFileSync(path.join(rootDir, fileName), 'utf8'), context, { filename: fileName });
    Object.assign(context, context.window);
  });

  const source = fs.readFileSync(path.join(rootDir, 'assets/js/table-ledger.js'), 'utf8')
    .replace(/\}\(\)\);\s*$/, [
      'window.__ledgerTest = {',
      '  createDeal: createDeal,',
      '  buildCalculationAgent: buildCalculationAgent,',
      '  loadA4Snapshot: loadA4Snapshot,',
      '  renderExactDealRow: renderExactDealRow,',
      '  getState: function () { return state; },',
      '  setState: function (nextState) { state = nextState; },',
      '  localStorageStore: localStorageStore',
      '};',
      '}());'
    ].join('\n'));
  vm.runInContext(source, context, { filename: 'assets/js/table-ledger.js' });
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

const ledgerWindow = loadLedger();
const ledger = ledgerWindow.__ledgerTest;
const ledgerSource = fs.readFileSync(path.join(rootDir, 'assets/js/table-ledger.js'), 'utf8');
const ledgerHtml = fs.readFileSync(path.join(rootDir, 'table-ledger.html'), 'utf8');

test('live table-ledger loads active month and exact-deal metadata from snapshot v3', () => {
  ledger.localStorageStore.domianA4TableSnapshot = JSON.stringify({
    version: 3,
    state: {
      selectedMonth: '2026-02',
      expenses: [],
      ownerSales: 150000,
      agents: [{
        id: 'agent-1',
        name: 'Анна',
        commissionMode: 'exact',
        dealsInput: [30000, 100000],
        dealDepositOrders: [7, ''],
        dealNewbuildSoloFlags: [true, false],
        paymentType: 'standard',
        status: 'partner',
        introduced: false,
        motivation: { mode: 'off', congressEnabled: false }
      }]
    }
  });

  ledger.loadA4Snapshot();
  const state = ledger.getState();
  const agent = state.agents[0];
  const calculated = ledgerWindow.calculateAgent(ledger.buildCalculationAgent(agent));

  assert.equal(state.selectedMonth, '2026-02');
  assert.equal(agent.deals[0].depositOrder, 7);
  assert.equal(agent.deals[0].isNewbuildSolo, true);
  assert.equal(agent.deals[1].depositOrder, '');
  assert.equal(agent.deals[1].isNewbuildSolo, false);
  assert.deepEqual(Array.from(calculated.deals.map((deal) => deal.rate)), [0.80, 0.50]);
  assert.deepEqual(Array.from(calculated.deals.map((deal) => deal.sourceIndex)), [0, 1]);
});

test('live table-ledger accepts legacy snapshot without exact-deal metadata', () => {
  ledger.localStorageStore.domianA4TableSnapshot = JSON.stringify({
    version: 1,
    state: {
      selectedMonth: '',
      expenses: [],
      ownerSales: 0,
      agents: [{
        id: 'legacy-agent',
        name: 'Legacy',
        commissionMode: 'exact',
        dealsInput: [100000],
        paymentType: 'standard',
        status: 'partner'
      }]
    }
  });

  ledger.loadA4Snapshot();
  const deal = ledger.getState().agents[0].deals[0];

  assert.equal(deal.amount, 100000);
  assert.equal(deal.depositOrder, '');
  assert.equal(deal.isNewbuildSolo, false);
});

test('live table-ledger renders deposit order and newbuild controls', () => {
  assert.match(ledgerSource, /data-deal-field="depositOrder"/);
  assert.match(ledgerSource, /data-deal-field="isNewbuildSolo"/);
  assert.match(ledgerSource, /Расчётный задаток/);
  assert.match(ledgerSource, /Новостройка, один агент/);
  assert.match(ledgerHtml, /активного месяца/i);
  assert.match(ledgerHtml, /table-ledger\.css\?v=a4-deposits-20260701/);
  assert.match(ledgerHtml, /constants\.js\?v=a4-deposits-20260701/);
  assert.match(ledgerHtml, /calculations\.js\?v=a4-deposits-20260701/);
  assert.match(ledgerHtml, /table-ledger\.js\?v=a4-deposits-20260701/);
});
