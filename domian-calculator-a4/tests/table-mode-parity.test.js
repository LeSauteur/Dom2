const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');

function loadTableMode() {
  const localStorageStore = {};
  const context = {
    window: {},
    console,
    document: {
      activeElement: null,
      addEventListener() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      }
    },
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

  [
    'assets/js/constants.js',
    'assets/js/calculations.js'
  ].forEach((fileName) => {
    const source = fs.readFileSync(path.join(rootDir, fileName), 'utf8');
    vm.runInContext(source, context, { filename: fileName });
    Object.assign(context, context.window);
  });

  const tableSource = fs.readFileSync(path.join(rootDir, 'assets/js/table-mode.js'), 'utf8')
    .replace(/\}\(\)\);\s*$/, [
      'window.__tableModeTest = {',
      '  toTableAgent: toTableAgent,',
      '  getCalculationAgent: getCalculationAgent,',
      '  calculateTableWithState: function (nextState) { state = nextState; return calculateTable(); },',
      '  setState: function (nextState) { state = nextState; },',
      '  getState: function () { return state; },',
      '  setElements: function (nextElements) { elements = nextElements; },',
      '  onInput: onInput,',
      '  inputNumber: inputNumber,',
      '  formatMoneyInputRaw: formatMoneyInputRaw,',
      '  loadSnapshotState: loadSnapshotState,',
      '  isActiveAgent: isActiveAgent,',
      '  createInitialState: createInitialState,',
      '  mapSnapshotExpenses: mapSnapshotExpenses,',
      '  mapSnapshotExpenseItems: mapSnapshotExpenseItems,',
      '  calculateExpenseCategories: calculateExpenseCategories',
      '};',
      '}());'
    ].join('\n'));

  vm.runInContext(tableSource, context, { filename: 'assets/js/table-mode.js' });
  Object.assign(context, context.window);
  context.window.__localStorageStore = localStorageStore;
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

function closeTo(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `Expected ${actual} to equal ${expected}`);
}

const tableWindow = loadTableMode();
const table = tableWindow.__tableModeTest;

function importedExactAgent(dealsInput) {
  return table.toTableAgent({
    id: 'exact-agent',
    name: 'Exact agent',
    commissionMode: 'exact',
    dealsInput,
    paymentType: 'standard',
    status: 'partner',
    fixedRate: 80,
    introduced: false
  });
}

function tableInput(target) {
  table.onInput({ target });
}

function createRenderElements() {
  return {
    snapshotNotice: { textContent: '' },
    officeExpensesTotal: { textContent: '' },
    officeExpensesList: { innerHTML: '' },
    ownerSalesInput: { value: '' },
    officeRoyalty: { textContent: '' },
    agentsTableBody: { innerHTML: '' },
    officeSummary: { innerHTML: '' },
    diagnosisBox: { className: '', innerHTML: '' }
  };
}

test('table money parser accepts spaces and preserves zero and blank input semantics', () => {
  [
    '1500000',
    '1 500 000',
    '1\u00a0500\u00a0000',
    '1\u202f500\u202f000',
    '1500 000'
  ].forEach((value) => {
    assert.equal(table.inputNumber(value), 1500000);
  });
  assert.equal(table.inputNumber('0'), 0);
  assert.equal(table.inputNumber(''), 0);
  assert.equal(table.formatMoneyInputRaw(''), '');
  assert.equal(table.formatMoneyInputRaw('0'), '0');
});

test('table input stores formatted money fields as normalized numbers', () => {
  const elements = createRenderElements();
  const state = table.createInitialState();
  const agent = state.agents[0];

  table.setElements(elements);
  table.setState(state);
  tableInput({
    value: '1 500 000',
    dataset: {
      agentId: agent.id,
      agentField: 'commission',
      moneyInput: 'true'
    },
    setSelectionRange() {},
    selectionStart: 9
  });

  assert.equal(table.getState().agents[0].commission, 1500000);
});

test('table loadSnapshotState accepts current versioned A4 snapshot and rejects incompatible versions', () => {
  const currentSnapshot = {
    version: 3,
    state: makeA4State([
      {
        id: 'snapshot-agent',
        name: 'Snapshot agent',
        commissionMode: 'exact',
        dealsInput: [30000, 200000],
        dealManualRates: [50, ''],
        dealNewbuildSoloFlags: [true, false],
        paymentType: 'standard',
        motivation: Object.assign({}, tableWindow.DEFAULT_MOTIVATION, {
          mode: 'rules',
          congressEnabled: true,
          starEnabled: true
        })
      }
    ], { expenses: 123000, ownerSales: 456000, selectedMonth: '2026-07' })
  };

  tableWindow.__localStorageStore.domianA4TableSnapshot = JSON.stringify(currentSnapshot);
  const loaded = table.loadSnapshotState();

  assert.equal(loaded.ownerSales, 456000);
  assert.equal(loaded.selectedMonth, '2026-07');
  assert.equal(loaded.agents[0].commissionMode, 'exact');
  assert.deepEqual(Array.from(loaded.agents[0].dealsInput), [30000, 200000]);
  assert.deepEqual(Array.from(loaded.agents[0].dealManualRates), [50, '']);
  assert.deepEqual(Array.from(loaded.agents[0].dealNewbuildSoloFlags), [true, false]);
  assert.deepEqual(
    Array.from(tableWindow.calculateAgent(table.getCalculationAgent(loaded.agents[0])).deals.map((deal) => deal.rate)),
    [0.50, 0.50]
  );
  assert.equal(loaded.agents[0].motivation.congressEnabled, true);
  assert.equal(loaded.agents[0].motivation.starEnabled, true);

  tableWindow.__localStorageStore.domianA4TableSnapshot = JSON.stringify({ version: 999, state: currentSnapshot.state });
  assert.equal(table.loadSnapshotState(), null);
});

test('table loadSnapshotState keeps backward compatibility with v2 snapshots', () => {
  tableWindow.__localStorageStore.domianA4TableSnapshot = JSON.stringify({
    version: 2,
    state: makeA4State([{
      id: 'v2-agent',
      name: 'V2 agent',
      commissionMode: 'exact',
      dealsInput: [100000],
      paymentType: 'standard',
      status: 'partner'
    }])
  });

  const loaded = table.loadSnapshotState();
  assert.equal(loaded.agents[0].name, 'V2 agent');
  assert.deepEqual(Array.from(loaded.agents[0].dealManualRates), ['']);
  assert.deepEqual(Array.from(loaded.agents[0].dealNewbuildSoloFlags), [false]);
});

test('table loadSnapshotState migrates legacy deposit-order arrays to manual rates', () => {
  tableWindow.__localStorageStore.domianA4TableSnapshot = JSON.stringify({
    version: 3,
    state: makeA4State([{
      id: 'legacy-order-table-agent',
      name: 'Legacy order',
      commissionMode: 'exact',
      dealsInput: [100000, 100000],
      dealDepositOrders: [2, 7],
      paymentType: 'standard',
      status: 'partner'
    }])
  });

  const loaded = table.loadSnapshotState();
  assert.deepEqual(Array.from(loaded.agents[0].dealManualRates), [50, 80]);
  assert.equal(loaded.agents[0].dealDepositOrders, undefined);
  assert.deepEqual(
    Array.from(tableWindow.calculateAgent(table.getCalculationAgent(loaded.agents[0])).deals.map((deal) => deal.rate)),
    [0.50, 0.80]
  );
});

test('table loadSnapshotState keeps backward compatibility with v1 snapshots without selectedMonth', () => {
  const legacySnapshot = {
    version: 1,
    state: makeA4State([
      {
        id: 'legacy-snapshot-agent',
        name: 'Legacy snapshot agent',
        commissionMode: 'exact',
        dealsInput: [100000],
        paymentType: 'standard',
        status: 'partner'
      }
    ], { expenses: 10000, ownerSales: 20000 })
  };

  tableWindow.__localStorageStore.domianA4TableSnapshot = JSON.stringify(legacySnapshot);
  const loaded = table.loadSnapshotState();

  assert.equal(loaded.ownerSales, 20000);
  assert.equal(loaded.selectedMonth, '');
  assert.equal(loaded.agents[0].name, 'Legacy snapshot agent');
});

const parityFields = [
  'agentTurnover',
  'ownerSales',
  'totalTurnover',
  'agentPayouts',
  'referrals',
  'motivationReserves',
  'royaltyWithoutOwner',
  'royaltyWithOwner',
  'expenses',
  'resultWithoutOwner',
  'resultWithOwner'
];

function makeExpenseCategories(amount) {
  return [
    { id: 'rent', amount }
  ];
}

function makeA4State(agents, options = {}) {
  const expenses = options.expenses || 0;
  return {
    selectedMonth: options.selectedMonth || '',
    ownerSales: options.ownerSales || 0,
    expenses: [
      { id: 'test-expenses', name: 'Test expenses', amount: expenses }
    ],
    agents
  };
}

function makeTableState(agents, options = {}) {
  const expenses = options.expenses || 0;
  return {
    selectedMonth: options.selectedMonth || '',
    ownerSales: options.ownerSales || 0,
    expenses,
    expenseCategories: makeExpenseCategories(expenses),
    agents: agents.map((agent) => table.toTableAgent(agent))
  };
}

function assertOfficeParity(name, agents, options = {}) {
  const a4Totals = tableWindow.calculateOffice(makeA4State(agents, options));
  const tableTotals = table.calculateTableWithState(makeTableState(agents, options));

  parityFields.forEach((field) => {
    closeTo(tableTotals[field], a4Totals[field]);
  });

  return { name, a4Totals, tableTotals };
}

test('table-mode preserves imported exact deals and pays by real deal amounts', () => {
  const agent = importedExactAgent([100000, 100000, 100000, 100000, 500000]);
  const calculated = tableWindow.calculateAgent(table.getCalculationAgent(agent));

  assert.equal(agent.commissionMode, 'exact');
  assert.deepEqual(agent.dealsInput, [100000, 100000, 100000, 100000, 500000]);
  assert.equal(agent.commission, 900000);
  assert.equal(agent.dealCount, 5);
  assert.equal(calculated.commission, 900000);
  assert.equal(calculated.dealCount, 5);
  closeTo(calculated.payout, 535000);
});

test('table-mode preserves uneven exact deals instead of recalculating as quick mode', () => {
  const agent = importedExactAgent([10000, 10000, 10000, 370000]);
  const totals = table.calculateTableWithState({
    expenses: 0,
    ownerSales: 0,
    agents: [agent]
  });
  const row = totals.rows[0];

  assert.equal(row.calculated.commission, 400000);
  assert.equal(row.calculated.dealCount, 4);
  closeTo(row.calculated.payout, 180000);
});

test('table-mode switches manual quick rows to exact mode without runtime errors', () => {
  const agent = table.toTableAgent({
    id: 'switch-agent',
    name: 'Switch agent',
    commissionMode: 'quick',
    commission: 400000,
    dealCount: 4,
    paymentType: 'standard',
    status: 'partner',
    fixedRate: 80,
    introduced: false
  });

  table.setState({
    expenses: 0,
    ownerSales: 0,
    agents: [agent]
  });
  table.setElements(createRenderElements());
  tableInput({
    dataset: {
      agentField: 'commissionMode',
      agentId: 'switch-agent'
    },
    value: 'exact'
  });

  const switched = table.getState().agents[0];
  const calculated = tableWindow.calculateAgent(table.getCalculationAgent(switched));

  assert.equal(switched.commissionMode, 'exact');
  assert.deepEqual(Array.from(switched.dealsInput), [100000, 100000, 100000, 100000]);
  assert.equal(switched.commission, 400000);
  closeTo(calculated.payout, 210000);
});

test('table-mode treats legacy custom boosted rates as a starting-rate source', () => {
  const agent = table.toTableAgent({
    id: 'boosted-agent',
    name: 'Boosted agent',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 100000],
    paymentType: 'boosted',
    status: 'partner',
    boostedRates: [55, 55, 60, 65],
    fixedRate: 80,
    introduced: false
  });
  const calculated = tableWindow.calculateAgent(table.getCalculationAgent(agent));

  assert.deepEqual(Array.from(agent.boostedRates), [55, 55, 60, 65]);
  assert.equal(calculated.startingRate, 55);
  closeTo(calculated.payout, 225000);
});

test('legacy table-mode does not infer isolated travel from travelEnabled', () => {
  const agent = table.toTableAgent({
    id: 'motivation-agent',
    name: 'Motivation agent',
    commissionMode: 'quick',
    commission: 900000,
    dealCount: 4,
    paymentType: 'standard',
    status: 'partner',
    fixedRate: 80,
    introduced: false,
    partnerConfirmed: true,
    quarterlyCommission: 900000,
    quarterlyDeposits: 250000,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 250000,
    motivation: {
      mode: 'rules',
      stipendMode: 'auto',
      quarterlyCommission: 900000,
      quarterlyDeposits: 250000,
      halfYearCommission: 1600000,
      preTripQuarterDeposits: 250000,
      annualReserveMode: 'monthly',
      travelEnabled: true,
      congressEnabled: true
    }
  });
  const calculated = tableWindow.calculateAgent(table.getCalculationAgent(agent));

  assert.equal(agent.motivation.travelEnabled, true);
  assert.equal(calculated.motivation.travelAnnual, 0);
  assert.equal(calculated.motivation.congressAnnual, 3500);
  closeTo(calculated.motivationReserve, 4291.666666666667);
});

test('table-mode quick, fixed, referral and royalty controls still match shared calculations', () => {
  const quick = table.toTableAgent({
    id: 'quick-agent',
    name: 'Quick agent',
    commissionMode: 'quick',
    commission: 400000,
    dealCount: 4,
    paymentType: 'standard',
    status: 'partner',
    fixedRate: 80,
    introduced: false
  });
  const fixed = table.toTableAgent({
    id: 'fixed-agent',
    name: 'Fixed agent',
    commissionMode: 'quick',
    commission: 400000,
    dealCount: 4,
    paymentType: 'fixed',
    fixedRate: 80,
    introduced: false
  });
  const referral = table.toTableAgent({
    id: 'referral-agent',
    name: 'Referral agent',
    commissionMode: 'quick',
    commission: 400000,
    dealCount: 4,
    paymentType: 'standard',
    status: 'partner',
    fixedRate: 80,
    introduced: true
  });

  closeTo(tableWindow.calculateAgent(table.getCalculationAgent(quick)).payout, 210000);
  closeTo(tableWindow.calculateAgent(table.getCalculationAgent(fixed)).payout, 320000);
  closeTo(tableWindow.calculateAgent(table.getCalculationAgent(referral)).referral, 10000);
  closeTo(tableWindow.calculateRoyalty(550000), 35750);
  closeTo(tableWindow.calculateRoyalty(2509000), 100360);
});

test('A4 and table-mode office totals match across required parity scenarios', () => {
  const base = {
    id: 'agent',
    name: 'Agent',
    commissionMode: 'quick',
    paymentType: 'standard',
    status: 'partner',
    fixedRate: 80,
    introduced: false,
    boostedRates: [55, 55, 55, 60]
  };

  assertOfficeParity('quick standard partner', [
    Object.assign({}, base, { commission: 400000, dealCount: 4 })
  ], { expenses: 100000, ownerSales: 150000 });

  assertOfficeParity('exact uneven deals', [
    Object.assign({}, base, {
      commissionMode: 'exact',
      dealsInput: [10000, 10000, 10000, 370000]
    })
  ], { expenses: 100000, ownerSales: 150000 });

  assertOfficeParity('exact Anna 5 deals', [
    Object.assign({}, base, {
      commissionMode: 'exact',
      dealsInput: [100000, 100000, 100000, 100000, 500000]
    })
  ], { expenses: 100000, ownerSales: 150000 });

  assertOfficeParity('fixed 80 percent', [
    Object.assign({}, base, {
      commission: 400000,
      dealCount: 4,
      paymentType: 'fixed',
      fixedRate: 80
    })
  ], { expenses: 100000, ownerSales: 150000 });

  assertOfficeParity('referral', [
    Object.assign({}, base, {
      commission: 400000,
      dealCount: 4,
      introduced: true
    })
  ], { expenses: 100000, ownerSales: 150000 });

  assertOfficeParity('custom boosted rates', [
    Object.assign({}, base, {
      commissionMode: 'exact',
      dealsInput: [100000, 100000, 100000, 100000],
      paymentType: 'boosted',
      boostedRates: [55, 55, 60, 65]
    })
  ], { expenses: 100000, ownerSales: 150000 });

  assertOfficeParity('manual motivation reserve', [
    Object.assign({}, base, {
      commission: 400000,
      dealCount: 4,
      motivation: {
        mode: 'manual',
        manualReserveMonthly: 12345
      }
    })
  ], { expenses: 100000, ownerSales: 150000 });

  assertOfficeParity('rules motivation imported from A4', [
    Object.assign({}, base, {
      commission: 900000,
      dealCount: 4,
      partnerConfirmed: true,
      quarterlyCommission: 900000,
      quarterlyDeposits: 250000,
      halfYearCommission: 1600000,
      preTripQuarterDeposits: 250000,
      motivation: {
        mode: 'rules',
        stipendMode: 'auto',
        quarterlyCommission: 900000,
        quarterlyDeposits: 250000,
        halfYearCommission: 1600000,
        preTripQuarterDeposits: 250000,
        annualReserveMode: 'monthly',
        travelEnabled: true,
        congressEnabled: true
      }
    })
  ], { expenses: 100000, ownerSales: 150000 });

  assertOfficeParity('mixed two-agent office', [
    Object.assign({}, base, {
      id: 'mixed-1',
      name: 'Mixed 1',
      commissionMode: 'exact',
      dealsInput: [10000, 10000, 10000, 370000],
      introduced: true
    }),
    Object.assign({}, base, {
      id: 'mixed-2',
      name: 'Mixed 2',
      commission: 500000,
      dealCount: 3,
      paymentType: 'fixed',
      fixedRate: 70
    })
  ], { expenses: 200000, ownerSales: 500000 });
});

test('table-mode keeps only one star assignment across active rows', () => {
  const totals = table.calculateTableWithState({
    expenses: 0,
    ownerSales: 0,
    agents: [
      table.toTableAgent({
        id: 'table-star-a',
        name: 'Table Star A',
        commissionMode: 'quick',
        commission: 0,
        dealCount: 1,
        paymentType: 'standard',
        status: 'partner',
        introduced: false,
        motivation: {
          congressEnabled: false,
          starEnabled: true,
          annualReserveMode: 'monthly'
        }
      }),
      table.toTableAgent({
        id: 'table-star-b',
        name: 'Table Star B',
        commissionMode: 'quick',
        commission: 0,
        dealCount: 1,
        paymentType: 'standard',
        status: 'partner',
        introduced: false,
        motivation: {
          congressEnabled: false,
          starEnabled: true,
          annualReserveMode: 'monthly'
        }
      })
    ]
  });

  closeTo(totals.motivationReserves, 5000 / 12);
});

test('table-mode empty row is not active only because dealCount is greater than one', () => {
  assert.equal(table.isActiveAgent({
    name: '',
    commission: 0,
    dealCount: 2,
    commissionMode: 'quick',
    paymentType: 'standard',
    fixedRate: tableWindow.PAY_SCALES.fixedDefault,
    introduced: false,
    motivationReserve: 0,
    manualExpenseShare: 0
  }), false);
});

test('table-mode starts blank instead of autoloading an A4 snapshot', () => {
  const initialState = table.createInitialState();

  assert.equal(initialState.expenses, 0);
  assert.equal(initialState.ownerSales, 0);
  assert.equal(initialState.agents.length, 10);
  assert.equal(initialState.agents.some((agent) => agent.commission > 0), false);
});

test('table-mode sums office expense categories into office totals and row shares', () => {
  const first = table.toTableAgent({
    id: 'category-expense-agent-1',
    name: 'Category expense agent 1',
    commissionMode: 'quick',
    commission: 400000,
    dealCount: 4,
    paymentType: 'standard',
    status: 'partner',
    fixedRate: 80
  });
  const second = table.toTableAgent({
    id: 'category-expense-agent-2',
    name: 'Category expense agent 2',
    commissionMode: 'quick',
    commission: 400000,
    dealCount: 4,
    paymentType: 'standard',
    status: 'partner',
    fixedRate: 80
  });
  const totals = table.calculateTableWithState({
    expenses: 999999,
    expenseCategories: [
      { id: 'rent', amount: 35000 },
      { id: 'salary', amount: 25000 },
      { id: 'ads', amount: 20000 },
      { id: 'communications', amount: 10000 },
      { id: 'household', amount: 5000 },
      { id: 'other', amount: 5000 }
    ],
    ownerSales: 0,
    agents: [first, second]
  });

  assert.equal(totals.expenses, 100000);
  assert.equal(totals.rows[0].expenseShare, 50000);
  assert.equal(totals.rows[1].expenseShare, 50000);
  assert.equal(totals.resultWithoutOwner, 232000);
});

test('table-mode sums flexible office expense items into office totals and row shares', () => {
  const first = table.toTableAgent({
    id: 'item-expense-agent-1',
    name: 'Item expense agent 1',
    commissionMode: 'quick',
    commission: 400000,
    dealCount: 4,
    paymentType: 'standard',
    status: 'partner',
    fixedRate: 80
  });
  const second = table.toTableAgent({
    id: 'item-expense-agent-2',
    name: 'Item expense agent 2',
    commissionMode: 'quick',
    commission: 400000,
    dealCount: 4,
    paymentType: 'standard',
    status: 'partner',
    fixedRate: 80
  });
  const totals = table.calculateTableWithState({
    expenses: 999999,
    expenseItems: [
      { id: 'rent', name: 'Аренда', amount: 35000 },
      { id: 'lawyer', name: 'Юрист', amount: 15000 },
      { id: 'crm', name: 'CRM', amount: 50000 }
    ],
    ownerSales: 0,
    agents: [first, second]
  });

  assert.equal(totals.expenses, 100000);
  assert.equal(totals.rows[0].expenseShare, 50000);
  assert.equal(totals.rows[1].expenseShare, 50000);
  assert.equal(totals.resultWithoutOwner, 232000);
});

test('table-mode maps imported A4 expenses into table expense categories', () => {
  const categories = table.mapSnapshotExpenses([
    { id: 'rent', amount: 35000 },
    { id: 'admin', amount: 55000 },
    { id: 'accounting', amount: 25000 },
    { id: 'ads', amount: 65000 },
    { id: 'internet', amount: 2500 },
    { id: 'phone', amount: 5000 },
    { id: 'utilities', amount: 15000 },
    { id: 'other', amount: 15000 }
  ]);
  const byId = Object.fromEntries(Array.from(categories).map((category) => [category.id, category.amount]));

  assert.equal(byId.rent, 35000);
  assert.equal(byId.salary, 80000);
  assert.equal(byId.ads, 65000);
  assert.equal(byId.communications, 7500);
  assert.equal(byId.household, 15000);
  assert.equal(byId.other, 15000);
  assert.equal(table.calculateExpenseCategories(categories), 217500);
});

test('table-mode preserves imported A4 expenses as flexible expense items', () => {
  const items = table.mapSnapshotExpenseItems([
    { id: 'lawyer', name: 'Юрист', amount: 20000 },
    { id: 'crm', name: 'CRM', amount: 7000 }
  ]);

  assert.deepEqual(Array.from(items).map((item) => item.name), ['Юрист', 'CRM']);
  assert.deepEqual(Array.from(items).map((item) => item.amount), [20000, 7000]);
});

test('table-mode distributes remaining office expenses after manual row shares', () => {
  const manual = table.toTableAgent({
    id: 'manual-expense-agent',
    name: 'Manual expense agent',
    commissionMode: 'quick',
    commission: 400000,
    dealCount: 4,
    paymentType: 'standard',
    status: 'partner',
    fixedRate: 80
  });
  const auto = table.toTableAgent({
    id: 'auto-expense-agent',
    name: 'Auto expense agent',
    commissionMode: 'quick',
    commission: 400000,
    dealCount: 4,
    paymentType: 'standard',
    status: 'partner',
    fixedRate: 80
  });
  manual.manualExpenseShare = 20000;

  const totals = table.calculateTableWithState({
    expenses: 100000,
    ownerSales: 0,
    agents: [manual, auto]
  });

  assert.equal(totals.rows[0].expenseShare, 20000);
  assert.equal(totals.rows[1].expenseShare, 80000);
  assert.equal(totals.resultWithoutOwner, 232000);
});
