const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');

function loadCalculator() {
  const context = { window: {}, console };
  vm.createContext(context);

  [
    'assets/js/constants.js',
    'assets/js/calculations.js'
  ].forEach((fileName) => {
    const source = fs.readFileSync(path.join(rootDir, fileName), 'utf8');
    vm.runInContext(source, context, { filename: fileName });
    Object.assign(context, context.window);
  });

  return context.window;
}

function loadAppHelpers() {
  const localStorageStore = {};
  const context = {
    window: {},
    console,
    localStorageStore,
    document: {
      addEventListener() {},
      body: {
        addEventListener() {}
      },
      getElementById() {
        return null;
      },
      querySelector() {
        return null;
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
      },
      key(index) {
        return Object.keys(localStorageStore)[index] || null;
      },
      get length() {
        return Object.keys(localStorageStore).length;
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

  const source = fs.readFileSync(path.join(rootDir, 'assets/js/app.js'), 'utf8')
    .replace(/\}\(\)\);\s*$/, [
      'window.__appTest = {',
      '  normalizeInputNumber: normalizeInputNumber,',
      '  inputNumber: inputNumber,',
      '  formatMoneyInputRaw: formatMoneyInputRaw,',
      '  createState: createState,',
      '  createExampleState: createExampleState,',
      '  createBlankState: createBlankState,',
      '  createAgent: createAgent,',
      '  createBlankExpense: createBlankExpense,',
      '  normalizeAgent: normalizeAgent,',
      '  depositOrderToManualRate: typeof depositOrderToManualRate === "function" ? depositOrderToManualRate : undefined,',
      '  normalizeDealRowMetadata: typeof normalizeDealRowMetadata === "function" ? normalizeDealRowMetadata : undefined,',
      '  addExactDealRow: typeof addExactDealRow === "function" ? addExactDealRow : undefined,',
      '  removeExactDealRow: typeof removeExactDealRow === "function" ? removeExactDealRow : undefined,',
      '  serializeDraftState: typeof serializeDraftState === "function" ? serializeDraftState : undefined,',
      '  normalizeDraftState: typeof normalizeDraftState === "function" ? normalizeDraftState : undefined,',
      '  syncCountersFromState: typeof syncCountersFromState === "function" ? syncCountersFromState : undefined,',
      '  createDraftWorkspace: typeof createDraftWorkspace === "function" ? createDraftWorkspace : undefined,',
      '  normalizeDraftWorkspace: typeof normalizeDraftWorkspace === "function" ? normalizeDraftWorkspace : undefined,',
      '  migrateLegacyDraft: typeof migrateLegacyDraft === "function" ? migrateLegacyDraft : undefined,',
      '  storeActiveStateInWorkspace: typeof storeActiveStateInWorkspace === "function" ? storeActiveStateInWorkspace : undefined,',
      '  activateMonth: typeof activateMonth === "function" ? activateMonth : undefined,',
      '  loadDraftState: typeof loadDraftState === "function" ? loadDraftState : undefined,',
      '  saveDraft: typeof saveDraft === "function" ? saveDraft : undefined,',
      '  clearCurrentForm: typeof clearCurrentForm === "function" ? clearCurrentForm : undefined,',
      '  removeAllA4Storage: typeof removeAllA4Storage === "function" ? removeAllA4Storage : undefined,',
      '  hardResetCalculator: typeof hardResetCalculator === "function" ? hardResetCalculator : undefined,',
      '  setDraftWorkspace: function (nextWorkspace) { draftWorkspace = nextWorkspace; },',
      '  getDraftWorkspace: function () { return draftWorkspace; },',
      '  localStorageStore: localStorageStore,',
      '  renderExpenses: renderExpenses,',
      '  renderExactDeals: renderExactDeals,',
      '  renderMotivationControls: renderMotivationControls,',
      '  renderTravelMotivationCard: renderTravelMotivationCard,',
      '  updateTravelMotivationCard: updateTravelMotivationCard,',
      '  collapsePreviousAgentIfReady: collapsePreviousAgentIfReady,',
      '  setState: function (nextState) { state = nextState; },',
      '  getState: function () { return state; },',
      '  setUiState: function (nextUiState) { uiState = nextUiState; },',
      '  getUiState: function () { return uiState; },',
      '  setElements: function (nextElements) { elements = nextElements; },',
      '  setDocumentQuerySelector: function (querySelector) { document.querySelector = querySelector; }',
      '};',
      '}());'
    ].join('\n'));

  vm.runInContext(source, context, { filename: 'assets/js/app.js' });
  Object.assign(context, context.window);
  return context.window.__appTest;
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

const calculator = loadCalculator();
const appHelpers = loadAppHelpers();
const appSource = fs.readFileSync(path.join(rootDir, 'assets/js/app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const calculatorCssSource = fs.readFileSync(path.join(rootDir, 'assets/css/a4-calculator.css'), 'utf8');

test('A4 money parser accepts regular, non-breaking and narrow non-breaking spaces', () => {
  [
    '1500000',
    '1600000',
    '1 500 000',
    '1 600 000',
    '1\u00a0500\u00a0000',
    '1\u00a0600\u00a0000',
    '1\u202f500\u202f000',
    '1\u202f600\u202f000',
    '1500 000',
    '1,500,000',
    '1,600,000',
    '1.500.000',
    '1.600.000'
  ].forEach((value) => {
    assert.equal(appHelpers.inputNumber(value), value.indexOf('6') !== -1 ? 1600000 : 1500000);
  });
  assert.equal(appHelpers.inputNumber('1,300,000'), 1300000);
  assert.equal(appHelpers.inputNumber('1.300.000'), 1300000);
  assert.equal(appHelpers.inputNumber('0'), 0);
  assert.equal(appHelpers.inputNumber(''), 0);
  assert.equal(appHelpers.formatMoneyInputRaw(''), '');
  assert.equal(appHelpers.formatMoneyInputRaw('0'), '0');
  assert.equal(appHelpers.formatMoneyInputRaw('1300000'), '1 300 000');
  assert.equal(appHelpers.formatMoneyInputRaw('1,300,000'), '1 300 000');
  assert.equal(appHelpers.formatMoneyInputRaw('1.300.000'), '1 300 000');
});

test('A4 state factories create current versioned state', () => {
  assert.equal(appHelpers.createState().version, 1);
  assert.equal(appHelpers.createExampleState().version, 1);
  assert.equal(appHelpers.createBlankState().version, 1);
  assert.equal(appHelpers.createState().selectedMonth, '');
  assert.equal(appHelpers.createExampleState().selectedMonth, '');
  assert.equal(appHelpers.createBlankState().selectedMonth, '');
});

test('A4 blank state starts empty while example state keeps demo data', () => {
  const blank = appHelpers.createState();
  const example = appHelpers.createExampleState();

  assert.equal(blank.ownerSales, 0);
  assert.equal(blank.expenses.length, 3);
  assert.equal(blank.expenses[0].amount, 0);
  assert.equal(blank.expenses[0].name, '');
  assert.equal(blank.expenses[1].amount, 0);
  assert.equal(blank.expenses[1].name, '');
  assert.equal(blank.expenses[2].amount, 0);
  assert.equal(blank.expenses[2].name, '');
  assert.equal(blank.agents.length, 1);
  assert.equal(blank.agents[0].commission, 0);
  assert.equal(blank.schemeCheck.commission, 0);
  assert.equal(blank.schemeCheck.manualRate, 80);

  assert.equal(example.ownerSales, 150000);
  assert.ok(example.expenses.some((item) => item.amount > 0));
  assert.equal(example.agents[0].name, 'Анна');
  assert.equal(example.agents[0].commission, 0);
  assert.equal(example.schemeCheck.commission, 400000);
  assert.equal(example.schemeCheck.manualRate, 75);
});

test('A4 draft serialization stores only restorable calculator state', () => {
  assert.equal(typeof appHelpers.serializeDraftState, 'function');

  const state = appHelpers.createState();
  state.selectedMonth = '2026-06';
  state.ownerSales = 250000;
  state.expenses = [
    { id: 'expense-101', name: 'Аренда', amount: 35000 },
    { id: 'expense-102', name: 'CRM', amount: 12000 }
  ];
  state.agents = [
    appHelpers.normalizeAgent({
      id: 'agent-30',
      name: 'Иван',
      commissionMode: 'exact',
      dealsInput: [100000, '', 250000],
      paymentType: 'boosted',
      startingRate: 70,
      fixedRate: 80,
      status: 'partner',
      introduced: true,
      motivation: {
        mode: 'manual',
        manualReserveMonthly: 15000,
        travelPerTrip: 120000
      }
    })
  ];
  state.schemeCheck = {
    commission: 400000,
    dealCount: 4,
    introduced: true,
    expenseShareMode: 'manual',
    manualExpenseShare: 21000,
    motivationReserve: 5000,
    manualRate: 75
  };

  appHelpers.setState(state);
  const draft = appHelpers.serializeDraftState();

  assert.deepEqual(Object.keys(draft).sort(), ['agents', 'expenses', 'ownerSales', 'schemeCheck', 'selectedMonth', 'version'].sort());
  assert.equal(draft.version, 1);
  assert.equal(draft.selectedMonth, '2026-06');
  assert.equal(draft.ownerSales, 250000);
  assert.equal(JSON.stringify(draft.expenses), JSON.stringify(state.expenses));
  assert.equal(draft.agents[0].name, 'Иван');
  assert.equal(JSON.stringify(draft.agents[0].dealsInput), JSON.stringify([100000, '', 250000]));
  assert.equal(draft.agents[0].startingRate, 70);
  assert.equal(draft.agents[0].motivation.manualReserveMonthly, 15000);
  assert.equal(draft.schemeCheck.manualExpenseShare, 21000);
});

test('A4 draft normalization restores partial state without changing calculation rules', () => {
  assert.equal(typeof appHelpers.normalizeDraftState, 'function');

  const restored = appHelpers.normalizeDraftState({
    selectedMonth: '2026-06',
    ownerSales: '300000',
    expenses: [
      { id: 'expense-120', name: 'Реклама', amount: '45000' },
      { name: 'Связь', amount: '7000' }
    ],
    agents: [
      {
        id: 'agent-30',
        name: 'Мария',
        commissionMode: 'exact',
        dealsInput: [120000, '', 90000],
        paymentType: 'boosted',
        startingRate: 70,
        status: 'partner',
        motivation: {
          mode: 'manual',
          manualReserveMonthly: 9000
        }
      }
    ],
    schemeCheck: {
      commission: '400000',
      expenseShareMode: 'auto'
    }
  });

  assert.equal(restored.version, 1);
  assert.equal(restored.selectedMonth, '2026-06');
  assert.equal(restored.ownerSales, 300000);
  assert.equal(restored.expenses.length, 2);
  assert.equal(restored.expenses[0].amount, 45000);
  assert.match(restored.expenses[1].id, /^expense-/);
  assert.equal(restored.agents.length, 1);
  assert.equal(restored.agents[0].id, 'agent-30');
  assert.equal(restored.agents[0].name, 'Мария');
  assert.deepEqual(restored.agents[0].dealsInput, [120000, '', 90000]);
  assert.equal(restored.agents[0].startingRate, 70);
  assert.equal(restored.agents[0].motivation.manualReserveMonthly, 9000);
  assert.equal(restored.schemeCheck.commission, 400000);
  assert.equal(restored.schemeCheck.dealCount, 1);
  assert.equal(restored.schemeCheck.expenseShareMode, 'auto');
  assert.equal(restored.schemeCheck.manualRate, 80);
});

test('A4 draft normalization falls back safely for broken draft shapes', () => {
  assert.equal(typeof appHelpers.normalizeDraftState, 'function');

  assert.equal(appHelpers.normalizeDraftState(null), null);
  assert.equal(appHelpers.normalizeDraftState('broken'), null);

  const restored = appHelpers.normalizeDraftState({
    expenses: 'broken',
    agents: 'broken',
    ownerSales: -100
  });

  assert.equal(restored.expenses.length, 3);
  assert.equal(restored.agents.length, 1);
  assert.equal(restored.ownerSales, 0);
  assert.equal(calculator.calculateOffice(restored).agentTurnover, 0);
});

test('A4 draft counter sync keeps new ids unique after restoring a large draft', () => {
  assert.equal(typeof appHelpers.syncCountersFromState, 'function');

  const restored = {
    agents: Array.from({ length: 30 }, (_, index) => ({ id: `agent-${index + 1}` })),
    expenses: Array.from({ length: 30 }, (_, index) => ({ id: `expense-${index + 101}` }))
  };

  appHelpers.syncCountersFromState(restored);

  assert.equal(appHelpers.createAgent().id, 'agent-31');
  assert.equal(appHelpers.createBlankExpense().id, 'expense-131');
});

test('A4 draft V1 migrates into the selected month with exact-deal metadata defaults', () => {
  assert.equal(typeof appHelpers.migrateLegacyDraft, 'function');

  const workspace = appHelpers.migrateLegacyDraft({
    version: 1,
    savedAt: '2026-06-25T00:00:00.000Z',
    state: {
      selectedMonth: '2026-01',
      ownerSales: 250000,
      expenses: [{ id: 'expense-101', name: 'Аренда', amount: 35000 }],
      agents: [{
        id: 'agent-1',
        name: 'Анна',
        commissionMode: 'exact',
        dealsInput: [100000, '', 200000],
        dealDepositOrders: [2, '', 7],
        paymentType: 'standard',
        status: 'partner',
        motivation: { mode: 'off' }
      }],
      schemeCheck: { commission: 300000, dealCount: 3, manualRate: 80 }
    }
  });

  assert.equal(workspace.version, 2);
  assert.equal(workspace.selectedMonth, '2026-01');
  assert.equal(workspace.scratch, null);
  assert.equal(workspace.months['2026-01'].ownerSales, 250000);
  assert.deepEqual(Array.from(workspace.months['2026-01'].agents[0].dealsInput), [100000, '', 200000]);
  assert.deepEqual(Array.from(workspace.months['2026-01'].agents[0].dealManualRates), [50, '', 80]);
  assert.deepEqual(Array.from(workspace.months['2026-01'].agents[0].dealNewbuildSoloFlags), [false, false, false]);
});

test('A4 draft V1 without selected month migrates into scratch', () => {
  const workspace = appHelpers.migrateLegacyDraft({
    version: 1,
    state: {
      selectedMonth: '',
      ownerSales: 123000,
      expenses: [],
      agents: [],
      schemeCheck: {}
    }
  });

  assert.equal(workspace.selectedMonth, '');
  assert.equal(workspace.scratch.ownerSales, 123000);
  assert.deepEqual(Object.keys(workspace.months), []);
});

test('A4 month activation isolates January and February and restores prior values', () => {
  assert.equal(typeof appHelpers.createDraftWorkspace, 'function');
  assert.equal(typeof appHelpers.activateMonth, 'function');

  const scratch = appHelpers.createBlankState();
  scratch.ownerSales = 111000;
  scratch.agents[0].dealsInput = [100000];
  appHelpers.setState(scratch);
  appHelpers.setDraftWorkspace(appHelpers.createDraftWorkspace());

  let january = appHelpers.activateMonth('2026-01');
  assert.equal(january.selectedMonth, '2026-01');
  assert.equal(january.ownerSales, 111000);
  january.ownerSales = 222000;
  january.agents[0].dealsInput = [200000];

  let february = appHelpers.activateMonth('2026-02');
  assert.equal(february.selectedMonth, '2026-02');
  assert.equal(february.ownerSales, 0);
  february.ownerSales = 333000;
  february.agents[0].dealsInput = [300000];

  january = appHelpers.activateMonth('2026-01');
  assert.equal(january.ownerSales, 222000);
  assert.deepEqual(Array.from(january.agents[0].dealsInput), [200000]);

  february = appHelpers.activateMonth('2026-02');
  assert.equal(february.ownerSales, 333000);
  assert.deepEqual(Array.from(february.agents[0].dealsInput), [300000]);
});

test('A4 V2 save and load restore the last selected month', () => {
  assert.equal(typeof appHelpers.saveDraft, 'function');
  assert.equal(typeof appHelpers.loadDraftState, 'function');

  const january = appHelpers.createBlankState();
  january.selectedMonth = '2026-01';
  january.ownerSales = 777000;
  appHelpers.setState(january);
  appHelpers.setDraftWorkspace(appHelpers.createDraftWorkspace());

  assert.equal(appHelpers.saveDraft('manual'), true);
  assert.ok(appHelpers.localStorageStore.domianA4DraftV2);

  appHelpers.setState(null);
  appHelpers.setDraftWorkspace(null);
  const restored = appHelpers.loadDraftState();

  assert.equal(restored.selectedMonth, '2026-01');
  assert.equal(restored.ownerSales, 777000);
});

test('soft clear resets only the active month and keeps other saved months', () => {
  assert.equal(typeof appHelpers.clearCurrentForm, 'function');

  const workspace = appHelpers.createDraftWorkspace();
  const january = appHelpers.createBlankState();
  const february = appHelpers.createBlankState();
  january.selectedMonth = '2026-01';
  january.ownerSales = 111000;
  february.selectedMonth = '2026-02';
  february.ownerSales = 222000;
  workspace.selectedMonth = '2026-01';
  workspace.months['2026-01'] = january;
  workspace.months['2026-02'] = february;
  appHelpers.setDraftWorkspace(workspace);
  appHelpers.setState(january);

  const cleared = appHelpers.clearCurrentForm();

  assert.equal(cleared.selectedMonth, '2026-01');
  assert.equal(cleared.ownerSales, 0);
  assert.equal(appHelpers.getDraftWorkspace().months['2026-02'].ownerSales, 222000);
});

test('hard reset removes only A4 storage and prevents draft restoration', () => {
  assert.equal(typeof appHelpers.hardResetCalculator, 'function');

  Object.assign(appHelpers.localStorageStore, {
    domianA4DraftV1: '{"version":1}',
    domianA4DraftV2: '{"version":2}',
    domianA4TableSnapshot: '{"version":3}',
    'domianA4MonthDraftV1:2026-01': '{"ownerSales":1}',
    domianA4SelectedMonth: '2026-01',
    unrelatedKey: 'keep-me'
  });

  const dirty = appHelpers.createBlankState();
  dirty.selectedMonth = '2026-01';
  dirty.ownerSales = 999000;
  appHelpers.setState(dirty);
  appHelpers.setDraftWorkspace(appHelpers.createDraftWorkspace());

  assert.equal(appHelpers.hardResetCalculator(), true);
  assert.equal(appHelpers.localStorageStore.domianA4DraftV1, undefined);
  assert.equal(appHelpers.localStorageStore.domianA4DraftV2, undefined);
  assert.equal(appHelpers.localStorageStore.domianA4TableSnapshot, undefined);
  assert.equal(appHelpers.localStorageStore['domianA4MonthDraftV1:2026-01'], undefined);
  assert.equal(appHelpers.localStorageStore.domianA4SelectedMonth, undefined);
  assert.equal(appHelpers.localStorageStore.unrelatedKey, 'keep-me');
  assert.equal(appHelpers.getState().selectedMonth, '');
  assert.equal(appHelpers.getState().ownerSales, 0);
  assert.equal(appHelpers.loadDraftState(), null);
});

test('adding a new agent always collapses the previous card even if it is blank', () => {
  const state = appHelpers.createBlankState();

  appHelpers.setState(state);
  appHelpers.setUiState({ collapsedAgents: {} });
  appHelpers.collapsePreviousAgentIfReady();

  assert.equal(appHelpers.getUiState().collapsedAgents[state.agents[0].id], true);
});

test('stipend recalculates when quarterly commission changes from 650000 to 1500000', () => {
  const baseAgent = {
    id: 'stipend-agent',
    name: 'Stipend agent',
    commission: 0,
    dealCount: 1,
    paymentType: 'standard',
    status: 'partner',
    partnerConfirmed: true,
    quarterlyDeposits: 0,
    motivation: Object.assign({}, calculator.DEFAULT_MOTIVATION, {
      mode: 'rules',
      stipendMode: 'auto',
      congressEnabled: false,
      starEnabled: false
    })
  };

  const low = calculator.calculateAgent(Object.assign({}, baseAgent, { quarterlyCommission: 650000 }));
  const high = calculator.calculateAgent(Object.assign({}, baseAgent, { quarterlyCommission: 1500000 }));

  assert.equal(low.motivation.stipendMonthly, 3000);
  assert.equal(high.motivation.stipendMonthly, 7000);
});

test('stipend uses the current scale for quarterly commission 1300000', () => {
  const agent = calculator.calculateAgent({
    id: 'stipend-1300',
    name: 'Stipend 1300',
    commission: 180000,
    dealCount: 1,
    paymentType: 'standard',
    status: 'partner',
    partnerConfirmed: true,
    quarterlyCommission: 1300000,
    motivation: Object.assign({}, calculator.DEFAULT_MOTIVATION, {
      mode: 'rules',
      stipendMode: 'auto',
      congressEnabled: false,
      starEnabled: false
    })
  });

  assert.equal(agent.motivation.stipendLevel, 6);
  assert.equal(agent.motivation.stipendAvailable, true);
  assert.equal(agent.motivation.stipendMonthly, 6000);
});

test('royalty boundaries use strict less-than limits', () => {
  [
    [499999, 0.07],
    [500000, 0.065],
    [749999, 0.065],
    [750000, 0.06],
    [1000000, 0.055],
    [1500000, 0.05],
    [2000000, 0.045],
    [2500000, 0.04],
    [2509000, 0.04],
    [3000000, 0.035],
    [4000000, 0.03]
  ].forEach(([turnover, rate]) => {
    closeTo(calculator.getRoyaltyRate(turnover), rate);
  });
});

test('agent payout supports standard, boosted and fixed schemes', () => {
  const standardPartner = calculator.calculateAgent({
    id: 'standard',
    name: 'Партнёр',
    commission: 400000,
    dealCount: 4,
    paymentType: 'standard',
    status: 'partner',
    boostedRates: [55, 55, 55, 60],
    fixedRate: 80,
    introduced: false
  });

  const boosted = calculator.calculateAgent({
    id: 'boosted',
    name: 'Повышенная',
    commission: 400000,
    dealCount: 4,
    paymentType: 'boosted',
    status: 'partner',
    boostedRates: [55, 55, 55, 60],
    fixedRate: 80,
    introduced: false
  });

  const boostedSecond = calculator.calculateAgent({
    id: 'boosted-second',
    name: 'Повышенная 2',
    commission: 400000,
    dealCount: 4,
    paymentType: 'boosted',
    status: 'partner',
    boostedRates: [55, 55, 60, 65],
    fixedRate: 80,
    introduced: false
  });

  const fixed = calculator.calculateAgent({
    id: 'fixed',
    name: 'Фикс',
    commission: 400000,
    dealCount: 4,
    paymentType: 'fixed',
    status: 'partner',
    boostedRates: [55, 55, 55, 60],
    fixedRate: 80,
    introduced: false
  });

  closeTo(standardPartner.payout, 210000);
  closeTo(boosted.payout, 225000);
  closeTo(boostedSecond.payout, 225000);
  closeTo(fixed.payout, 320000);
});

test('boosted starting rate is a floor over the standard partner scale', () => {
  const starting55 = calculator.calculateAgent({
    id: 'boosted-55',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 100000],
    paymentType: 'boosted',
    status: 'partner',
    startingRate: 55
  });
  assert.deepEqual(Array.from(starting55.deals.map((deal) => deal.rate)), [0.55, 0.55, 0.55, 0.60]);
  closeTo(starting55.payout, 225000);

  const starting70 = calculator.calculateAgent({
    id: 'boosted-70',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 100000],
    paymentType: 'boosted',
    status: 'partner',
    startingRate: 70
  });
  assert.deepEqual(Array.from(starting70.deals.map((deal) => deal.rate)), [0.70, 0.70, 0.70, 0.70]);
  closeTo(starting70.payout, 280000);

  const starting50 = calculator.calculateAgent({
    id: 'boosted-50',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 100000],
    paymentType: 'boosted',
    status: 'partner',
    startingRate: 50
  });
  assert.deepEqual(Array.from(starting50.deals.map((deal) => deal.rate)), [0.50, 0.50, 0.55, 0.60]);
  closeTo(starting50.payout, 215000);

  const starting55WithLowDeal = calculator.calculateAgent({
    id: 'boosted-55-low-deal',
    commissionMode: 'exact',
    dealsInput: [35000, 100000, 100000, 100000, 100000],
    paymentType: 'boosted',
    status: 'partner',
    startingRate: 55
  });
  assert.deepEqual(Array.from(starting55WithLowDeal.deals.map((deal) => deal.rate)), [0.45, 0.55, 0.55, 0.55, 0.60]);
  closeTo(starting55WithLowDeal.payout, 240750);
});

test('legacy boostedRates migrates to startingRate from the first value', () => {
  const legacy = calculator.calculateAgent({
    id: 'legacy-boosted',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 100000],
    paymentType: 'boosted',
    status: 'partner',
    boostedRates: [70, 55, 55, 60]
  });

  assert.equal(legacy.startingRate, 70);
  assert.deepEqual(Array.from(legacy.deals.map((deal) => deal.rate)), [0.70, 0.70, 0.70, 0.70]);
  closeTo(legacy.payout, 280000);
});

test('fixed scheme keeps explicit zero rate', () => {
  const fixedZero = calculator.calculateAgent({
    id: 'fixed-zero',
    name: 'Фикс 0',
    commission: 400000,
    dealCount: 4,
    paymentType: 'fixed',
    status: 'partner',
    fixedRate: 0,
    introduced: false
  });

  assert.equal(fixedZero.fixedRate, 0);
  closeTo(fixedZero.payout, 0);
});

test('exact deals mode pays standard partner by real deal amounts', () => {
  const agent = calculator.calculateAgent({
    id: 'exact-standard',
    commissionMode: 'exact',
    dealsInput: [10000, 10000, 10000, 370000],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });

  assert.equal(agent.commission, 400000);
  assert.equal(agent.dealCount, 4);
  assert.deepEqual(Array.from(agent.deals.map((deal) => deal.rate)), [0.45, 0.45, 0.45, 0.45]);
  closeTo(agent.payout, 180000);
});

test('exact deals mode pays boosted scale by real deal amounts', () => {
  const agent = calculator.calculateAgent({
    id: 'exact-boosted',
    commissionMode: 'exact',
    dealsInput: [10000, 10000, 10000, 370000],
    paymentType: 'boosted',
    boostedRates: [55, 55, 55, 60],
    introduced: false
  });

  assert.equal(agent.commission, 400000);
  assert.equal(agent.dealCount, 4);
  assert.deepEqual(Array.from(agent.deals.map((deal) => deal.rate)), [0.45, 0.45, 0.45, 0.55]);
  closeTo(agent.payout, 217000);
});

test('exact deals mode pays fixed percent and referral from total commission', () => {
  const agent = calculator.calculateAgent({
    id: 'exact-fixed',
    commissionMode: 'exact',
    dealsInput: [10000, 10000, 10000, 370000],
    paymentType: 'fixed',
    fixedRate: 80,
    introduced: true
  });

  assert.equal(agent.commission, 400000);
  assert.equal(agent.dealCount, 4);
  closeTo(agent.payout, 320000);
  assert.equal(agent.referral, 10000);
});

test('referral is 2.5 percent only for introduced agents', () => {
  const introduced = calculator.calculateAgent({
    id: 'introduced',
    commission: 300000,
    dealCount: 3,
    paymentType: 'fixed',
    fixedRate: 80,
    introduced: true
  });

  const regular = calculator.calculateAgent({
    id: 'regular',
    commission: 300000,
    dealCount: 3,
    paymentType: 'fixed',
    fixedRate: 80,
    introduced: false
  });

  assert.equal(introduced.referral, 7500);
  assert.equal(regular.referral, 0);
});

test('office totals separate owner sales and show owner dependency warning', () => {
  const totals = calculator.calculateOffice({
    expenses: [
      { id: 'rent', amount: 100000 }
    ],
    agents: [],
    ownerSales: 150000
  });

  assert.equal(totals.resultWithoutOwner, -100000);
  assert.equal(totals.agentPayouts, 0);
  assert.equal(totals.ownerSales, 150000);
  closeTo(totals.royaltyWithOwner, 10500);
  closeTo(totals.resultWithOwner, 39500);
  assert.equal(totals.warningOwnerDependency, true);
});

test('motivation reserve supports stipend and annual trip reserves', () => {
  const noReserve = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    mode: 'off',
    quarterlyResult: 1500000,
    quarterlyDeposits: 250000,
    mountainSeaEnabled: false,
    travelEnabled: false,
    corporateEnabled: false,
    congressEnabled: false
  });

  const reserve = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    quarterlyResult: 1500000,
    quarterlyDeposits: 250000,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 250000,
    travelQuarterPartnershipConfirmed: true,
    annualReserveMode: 'monthly',
    mountainSeaEnabled: true,
    mountainSeaPerTrip: 15000,
    mountainSeaTripsPerYear: 2,
    travelEnabled: true,
    travelPerTrip: 100000,
    travelTripsPerYear: 2,
    corporateEnabled: true,
    corporatePerYear: 20000,
    congressEnabled: true,
    congressPerYear: 3500,
    starEnabled: true,
    starPerYear: 5000
  });

  assert.equal(noReserve.monthly, 0);
  assert.equal(reserve.stipendMonthly, 7000);
  closeTo(reserve.mountainSeaMonthly, 2500);
  closeTo(reserve.travelMonthly, 16666.666666666668);
  closeTo(reserve.corporateMonthly, 1666.6666666666667);
  closeTo(reserve.congressMonthly, 291.6666666666667);
  closeTo(reserve.starMonthly, 416.6666666666667);
  closeTo(reserve.annualReserveMonthly, 21541.666666666668);
  closeTo(reserve.monthly, 28541.666666666668);
});

test('rules mode applies stipend automatically and manual override replaces it', () => {
  const automatic = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    quarterlyCommission: 1000000,
    quarterlyDeposits: 250000
  });

  const overridden = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    quarterlyCommission: 1000000,
    quarterlyDeposits: 250000,
    motivation: {
      stipendManualEnabled: true,
      manualStipendMonthly: 3500
    }
  });

  assert.equal(automatic.stipendAvailable, true);
  assert.equal(automatic.stipendMode, 'auto');
  assert.equal(automatic.stipendMonthly, 5000);
  assert.equal(overridden.stipendMode, 'manual');
  assert.equal(overridden.stipendMonthly, 3500);
});

test('motivation reserve preserves explicit zero values', () => {
  const reserve = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    quarterlyResult: 1000000,
    quarterlyDeposits: 250000,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 250000,
    travelQuarterPartnershipConfirmed: true,
    annualReserveMode: 'monthly',
    mountainSeaEnabled: true,
    mountainSeaPerTrip: 0,
    mountainSeaTripsPerYear: 0,
    travelEnabled: true,
    travelPerTrip: 0,
    travelTripsPerYear: 0,
    corporateEnabled: true,
    corporatePerYear: 0,
    congressEnabled: true,
    congressPerYear: 0,
    starEnabled: true,
    starPerYear: 0
  });

  assert.equal(reserve.mountainSeaAnnual, 0);
  assert.equal(reserve.mountainSeaMonthly, 0);
  assert.equal(reserve.travelAnnual, 0);
  assert.equal(reserve.travelMonthly, 0);
  assert.equal(reserve.corporateAnnual, 0);
  assert.equal(reserve.corporateMonthly, 0);
  assert.equal(reserve.congressAnnual, 0);
  assert.equal(reserve.congressMonthly, 0);
  assert.equal(reserve.starAnnual, 0);
  assert.equal(reserve.starMonthly, 0);
});

test('mountain sea override is independent and legacy travel flags do not control isolated travel', () => {
  const separated = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    quarterlyDeposits: 0,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 250000,
    travelQuarterPartnershipConfirmed: false,
    mountainSeaOverride: true,
    travelOverride: false,
    motivation: {
      annualReserveMode: 'monthly',
      mountainSeaEnabled: true,
      mountainSeaPerTrip: 15000,
      mountainSeaTripsPerYear: 2,
      travelEnabled: true,
      travelPerTrip: 100000,
      travelTripsPerYear: 2
    }
  });

  const legacy = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    quarterlyDeposits: 0,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 250000,
    travelQuarterPartnershipConfirmed: false,
    travelOverride: true,
    motivation: {
      annualReserveMode: 'monthly',
      mountainSeaEnabled: true,
      mountainSeaPerTrip: 15000,
      mountainSeaTripsPerYear: 2
    }
  });

  closeTo(separated.mountainSeaAnnual, 30000);
  assert.equal(separated.travelAnnual, 0);
  closeTo(legacy.mountainSeaAnnual, 30000);
  assert.equal(legacy.travelAnnual, 0);
});

test('special payment terms keep congress and star as separate annual expenses', () => {
  const reserve = calculator.calculateMotivationReserve({
    paymentType: 'fixed',
    motivation: {
      annualReserveMode: 'monthly',
      congressEnabled: true,
      congressPerYear: 3500,
      starEnabled: true,
      starPerYear: 5000
    }
  });

  closeTo(reserve.congressAnnual, 3500);
  closeTo(reserve.starAnnual, 5000);
  closeTo(reserve.annualReserveMonthly, (3500 + 5000) / 12);
  closeTo(reserve.monthly, (3500 + 5000) / 12);
});

test('travel reserve defaults to two international trips per year', () => {
  assert.equal(calculator.DEFAULT_MOTIVATION.travelPerTrip, 100000);
  assert.equal(calculator.DEFAULT_MOTIVATION.travelTripsPerYear, 2);

  const reserve = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    stipendMode: 'off',
    quarterlyDeposits: 250000,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 250000,
    travelQuarterPartnershipConfirmed: true,
    annualReserveMode: 'monthly',
    travelEnabled: true
  });

  closeTo(reserve.travelAnnual, 200000);
  closeTo(reserve.travelMonthly, 16666.666666666668);
  closeTo(reserve.monthly, 16666.666666666668);
});

test('annual reserves can be recognized immediately or manually', () => {
  const full = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    stipendMode: 'off',
    quarterlyDeposits: 250000,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 250000,
    travelQuarterPartnershipConfirmed: true,
    annualReserveMode: 'full',
    travelEnabled: true,
    travelPerTrip: 100000,
    travelTripsPerYear: 2,
    congressEnabled: true,
    congressPerYear: 3500,
    starEnabled: true,
    starPerYear: 5000
  });

  const manual = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    stipendMode: 'off',
    quarterlyDeposits: 250000,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 250000,
    travelQuarterPartnershipConfirmed: true,
    annualReserveMode: 'manual',
    manualAnnualReserveMonthly: 25000,
    travelEnabled: true,
    travelPerTrip: 100000,
    travelTripsPerYear: 2,
    congressEnabled: true,
    congressPerYear: 3500,
    starEnabled: true,
    starPerYear: 5000
  });

  assert.equal(full.annualReserveTotal, 208500);
  assert.equal(full.annualReserveMonthly, 208500);
  assert.equal(full.monthly, 208500);
  assert.equal(manual.travelAnnual, 200000);
  assert.equal(manual.annualReserveTotal, 8500);
  closeTo(manual.annualReserveMonthly, 25000 + 8500 / 12);
  closeTo(manual.monthly, 25000 + 8500 / 12);
});

test('office totals distinguish profit before and after reserves', () => {
  const totals = calculator.calculateOffice({
    expenses: [
      { id: 'rent', amount: 100000 }
    ],
    ownerSales: 0,
    agents: [
      {
        id: 'agent',
        commission: 400000,
        dealCount: 4,
        paymentType: 'standard',
        status: 'partner',
        quarterlyCommission: 1500000,
        quarterlyDeposits: 250000,
        introduced: false,
        travelOverride: true,
        motivation: {
          stipendMode: 'manual',
          manualStipendMonthly: 3000,
          mountainSeaEnabled: true,
          mountainSeaPerTrip: 15000,
          mountainSeaTripsPerYear: 2
        }
      }
    ]
  });

  assert.equal(totals.agentPayouts, 210000);
  closeTo(totals.motivationReserves, 5500 + 3500 / 12);
  assert.equal(totals.resultWithoutOwnerBeforeReserves, 62000);
  closeTo(totals.resultWithoutOwner, 62000 - (5500 + 3500 / 12));
});

test('agent profitability distributes office expenses across active agents', () => {
  const totals = calculator.calculateOffice({
    expenses: [
      { id: 'office', amount: 100000 }
    ],
    ownerSales: 0,
    agents: [
      {
        id: 'a1',
        commission: 100000,
        dealCount: 1,
        paymentType: 'fixed',
        fixedRate: 80,
        introduced: false
      },
      { id: 'a2', commission: 0, dealCount: 1, paymentType: 'standard' },
      { id: 'a3', commission: 0, dealCount: 1, paymentType: 'standard' },
      { id: 'a4', commission: 0, dealCount: 1, paymentType: 'standard' },
      { id: 'a5', commission: 0, dealCount: 1, paymentType: 'standard' }
    ]
  });

  assert.equal(totals.agentEconomics.length, 1);
  const first = totals.agentEconomics[0];
  assert.equal(first.expenseShare, 100000);
  assert.equal(first.royaltyShare, 7000);
  assert.equal(first.contribution, -87000);
  assert.equal(first.status, 'Не окупается');
});

test('office calculations keep star assigned to a single agent', () => {
  const totals = calculator.calculateOffice({
    expenses: [],
    ownerSales: 0,
    agents: [
      {
        id: 'star-a',
        name: 'Star A',
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
      },
      {
        id: 'star-b',
        name: 'Star B',
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
      }
    ]
  });

  closeTo(totals.motivationReserves, 5000 / 12);
});

test('scheme checker compares variants and finds break-even commission', () => {
  const result = calculator.comparePaymentSchemes({
    commission: 400000,
    dealCount: 4,
    introduced: false,
    expenseShare: 20000,
    motivationReserve: 0
  });

  const standard = result.variants.find((item) => item.id === 'standard-partner');
  const boosted = result.variants.find((item) => item.id === 'boosted-55');
  const fixed80 = result.variants.find((item) => item.id === 'fixed-80');
  const fixed90 = result.variants.find((item) => item.id === 'fixed-90');

  assert.equal(standard.payout, 210000);
  closeTo(boosted.payout, 225000);
  assert.equal(fixed80.payout, 320000);
  assert.ok(fixed90.breakEvenCommission > fixed80.breakEvenCommission);
  assert.ok(fixed80.contribution > calculator.comparePaymentSchemes({
    commission: 100000,
    dealCount: 1,
    introduced: false,
    expenseShare: 20000,
    motivationReserve: 0
  }).variants.find((item) => item.id === 'fixed-80').contribution);
});

test('agent retention scenarios baseline matches step 5 contribution', () => {
  const source = {
    id: 'baseline-agent',
    name: 'База',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 100000],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  };
  const calculated = calculator.calculateAgent(source);
  const economics = calculator.calculateAgentEconomics([calculated], 20000, [source])[0];
  const result = calculator.compareAgentRetentionScenarios(source, economics);
  const baseline = result.scenarios.find((item) => item.id === 'current');

  assert.equal(baseline.payout, 210000);
  assert.equal(baseline.contribution, economics.contribution);
  assert.equal(baseline.status, 'база');
});

test('agent retention scenarios preserve exact deals and fixed 80 payout', () => {
  const source = {
    id: 'exact-agent',
    name: 'Точный',
    commissionMode: 'exact',
    dealsInput: [10000, 10000, 10000, 370000],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  };
  const calculated = calculator.calculateAgent(source);
  const economics = calculator.calculateAgentEconomics([calculated], 20000, [source])[0];
  const result = calculator.compareAgentRetentionScenarios(source, economics);
  const baseline = result.scenarios.find((item) => item.id === 'current');
  const fixed80 = result.scenarios.find((item) => item.id === 'fixed-80');

  assert.equal(baseline.payout, 180000);
  assert.equal(fixed80.payout, 320000);
});

test('agent retention scenarios preserve quick mode logic', () => {
  const source = {
    id: 'quick-agent',
    name: 'Быстрый',
    commissionMode: 'quick',
    commission: 400000,
    dealCount: 4,
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  };
  const calculated = calculator.calculateAgent(source);
  const economics = calculator.calculateAgentEconomics([calculated], 20000, [source])[0];
  const result = calculator.compareAgentRetentionScenarios(source, economics);
  const baseline = result.scenarios.find((item) => item.id === 'current');

  assert.equal(baseline.payout, 210000);
  assert.equal(baseline.contribution, economics.contribution);
});

test('agent retention scenarios do not duplicate baseline loads', () => {
  const source = {
    id: 'load-agent',
    name: 'Нагрузка',
    commissionMode: 'quick',
    commission: 400000,
    dealCount: 4,
    paymentType: 'standard',
    status: 'partner',
    introduced: true,
    motivation: {
      mode: 'manual',
      manualReserveMonthly: 5000
    }
  };
  const calculated = calculator.calculateAgent(source);
  const economics = calculator.calculateAgentEconomics([calculated], 20000, [source])[0];
  const result = calculator.compareAgentRetentionScenarios(source, economics);
  const fixed80 = result.scenarios.find((item) => item.id === 'fixed-80');

  assert.equal(fixed80.referral, economics.referral);
  assert.equal(fixed80.motivationReserve, Math.round(economics.motivationReserve * 100) / 100);
  assert.equal(fixed80.royaltyShare, economics.royaltyShare);
  assert.equal(fixed80.expenseShare, economics.expenseShare);
  assert.equal(
    fixed80.contribution,
    fixed80.commission - fixed80.payout - fixed80.referral - fixed80.royaltyShare - fixed80.motivationReserve - fixed80.expenseShare
  );
});

test('agent retention scenarios mark negative contribution as unprofitable', () => {
  const source = {
    id: 'negative-agent',
    name: 'Минус',
    commissionMode: 'quick',
    commission: 100000,
    dealCount: 1,
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  };
  const calculated = calculator.calculateAgent(source);
  const economics = calculator.calculateAgentEconomics([calculated], 20000, [source])[0];
  const result = calculator.compareAgentRetentionScenarios(source, economics);
  const fixed90 = result.scenarios.find((item) => item.id === 'fixed-90');

  assert.equal(fixed90.status, 'убыточно');
  assert.ok(fixed90.contribution < 0);
});

test('partnership is confirmed by quarterly deposits threshold', () => {
  assert.equal(calculator.PARTNERSHIP_DEPOSIT_THRESHOLD, 250000);
  assert.equal(calculator.isPartnershipConfirmed(249999), false);
  assert.equal(calculator.isPartnershipConfirmed(250000), true);
  assert.equal(calculator.isPartnershipConfirmed(300000), true);
});

test('stipend eligibility requires level, partnership and no special terms unless overridden', () => {
  const lowLevel = calculator.getStipendEligibility({
    paymentType: 'standard',
    quarterlyCommission: 400000,
    quarterlyDeposits: 250000
  });
  assert.equal(lowLevel.available, false);
  assert.equal(lowLevel.reason, 'level');

  const noPartnership = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    quarterlyCommission: 1000000,
    quarterlyDeposits: 0,
    motivation: {
      stipendMode: 'auto'
    }
  });
  assert.equal(noPartnership.stipendLevel, 5);
  assert.equal(noPartnership.stipendAvailable, false);
  assert.equal(noPartnership.stipendMonthly, 0);

  const confirmed = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    quarterlyCommission: 1000000,
    quarterlyDeposits: 250000,
    motivation: {
      stipendMode: 'auto'
    }
  });
  assert.equal(confirmed.stipendAvailable, true);
  assert.equal(confirmed.stipendMonthly, 5000);

  const specialTerms = calculator.calculateMotivationReserve({
    paymentType: 'fixed',
    quarterlyCommission: 1000000,
    quarterlyDeposits: 250000,
    motivation: {
      stipendMode: 'auto'
    }
  });
  assert.equal(specialTerms.stipendAvailable, false);
  assert.equal(specialTerms.stipendMonthly, 0);

  const overridden = calculator.calculateMotivationReserve({
    paymentType: 'fixed',
    quarterlyCommission: 400000,
    quarterlyDeposits: 0,
    stipendOverride: true,
    motivation: {
      stipendMode: 'manual',
      manualStipendMonthly: 3000
    }
  });
  assert.equal(overridden.stipendAvailable, false);
  assert.equal(overridden.stipendOverride, true);
  assert.equal(overridden.stipendMonthly, 3000);
});

test('isolated travel and corporate reserves use their own override rules', () => {
  const blocked = calculator.calculateMotivationReserve({
    paymentType: 'boosted',
    quarterlyCommission: 400000,
    quarterlyDeposits: 0,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 0,
    motivation: {
      annualReserveMode: 'monthly',
      mountainSeaEnabled: true,
      travelEnabled: true,
      corporateEnabled: true
    }
  });

  assert.equal(blocked.mountainSeaAvailable, false);
  assert.equal(blocked.travelAvailable, false);
  assert.equal(blocked.corporateAvailable, false);
  assert.equal(blocked.mountainSeaAnnual, 0);
  assert.equal(blocked.travelAnnual, 0);
  assert.equal(blocked.corporateAnnual, 0);

  const overridden = calculator.calculateMotivationReserve({
    paymentType: 'fixed',
    quarterlyCommission: 0,
    quarterlyDeposits: 0,
    motivationOverride: true,
    travelDecision: 'forceInclude',
    eventsOverride: true,
    motivation: {
      annualReserveMode: 'monthly',
      mountainSeaEnabled: true,
      mountainSeaPerTrip: 15000,
      mountainSeaTripsPerYear: 2,
      travelEnabled: true,
      travelPerTrip: 100000,
      travelTripsPerYear: 2,
      corporateEnabled: true,
      corporatePerYear: 20000
    }
  });

  closeTo(overridden.mountainSeaAnnual, 30000);
  closeTo(overridden.travelAnnual, 200000);
  closeTo(overridden.corporateAnnual, 20000);
});

test('domian travel uses inclusive half-year threshold and syncs render text', () => {
  const blocked = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    partnerConfirmed: true,
    quarterlyDeposits: 250000,
    halfYearCommission: 1599999,
    preTripQuarterDeposits: 0,
    travelQuarterPartnershipConfirmed: true,
    travelDecision: 'auto',
    travelQuarterPartnershipConfirmed: true,
    motivation: {
      mode: 'rules',
      annualReserveMode: 'monthly',
      travelEnabled: true,
      travelPerTrip: 100000,
      travelTripsPerYear: 2,
      congressEnabled: false,
      starEnabled: false
    }
  });
  assert.equal(blocked.travelAvailable, false);
  assert.equal(blocked.travelReason, 'blocked');
  assert.equal(blocked.travelAnnual, 0);

  const earnedAtThreshold = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    partnerConfirmed: true,
    quarterlyDeposits: 250000,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 0,
    travelQuarterPartnershipConfirmed: true,
    motivation: {
      mode: 'rules',
      annualReserveMode: 'monthly',
      travelEnabled: true,
      travelPerTrip: 100000,
      travelTripsPerYear: 2,
      congressEnabled: false,
      starEnabled: false
    }
  });
  assert.equal(earnedAtThreshold.travelAvailable, true);
  assert.equal(earnedAtThreshold.travelReason, 'earned');
  closeTo(earnedAtThreshold.travelAnnual, 200000);

  const earnedAboveThreshold = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    partnerConfirmed: true,
    quarterlyDeposits: 250000,
    halfYearCommission: 1600001,
    preTripQuarterDeposits: 0,
    travelQuarterPartnershipConfirmed: true,
    motivation: {
      mode: 'rules',
      annualReserveMode: 'monthly',
      travelEnabled: true,
      travelPerTrip: 100000,
      travelTripsPerYear: 2,
      congressEnabled: false,
      starEnabled: false
    }
  });
  assert.equal(earnedAboveThreshold.travelAvailable, true);
  closeTo(earnedAboveThreshold.travelAnnual, 200000);

  const blockedHtml = appHelpers.renderMotivationControls({
    id: 'travel-blocked',
    name: 'Travel blocked',
    commission: 0,
    dealCount: 1,
    commissionMode: 'exact',
    dealsInput: [''],
    paymentType: 'standard',
    status: 'partner',
    partnerConfirmed: true,
    quarterlyCommission: 0,
    quarterlyDeposits: 250000,
    halfYearCommission: 1599999,
    preTripQuarterDeposits: 0,
    motivation: {
      mode: 'rules',
      annualReserveMode: 'monthly',
      travelEnabled: true,
      travelPerTrip: 100000,
      travelTripsPerYear: 2,
      congressEnabled: false,
      starEnabled: false
    }
  });
  assert.match(blockedHtml, /Поездка не заработана: результат за полугодие меньше 1 600 000 ₽\./);
  assert.match(blockedHtml, /value="forceInclude">Всё равно отправить/);

  const earnedHtml = appHelpers.renderMotivationControls({
    id: 'travel-earned',
    name: 'Travel earned',
    commission: 0,
    dealCount: 1,
    commissionMode: 'exact',
    dealsInput: [''],
    paymentType: 'standard',
    status: 'partner',
    partnerConfirmed: true,
    quarterlyCommission: 0,
    quarterlyDeposits: 250000,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 0,
    travelQuarterPartnershipConfirmed: true,
    travelDecision: 'auto',
    motivation: {
      mode: 'rules',
      annualReserveMode: 'monthly',
      travelEnabled: true,
      travelPerTrip: 100000,
      travelTripsPerYear: 2,
      congressEnabled: false,
      starEnabled: false
    }
  });
  assert.match(earnedHtml, /Агент заработал поездку\./);
  assert.match(earnedHtml, /data-agent-field="halfYearCommission"[^>]*value="1 600 000"/);

  const liveAgent = {
    id: 'travel-live',
    name: 'Travel live',
    commission: 0,
    dealCount: 1,
    commissionMode: 'exact',
    dealsInput: [''],
    paymentType: 'standard',
    status: 'partner',
    partnerConfirmed: true,
    quarterlyCommission: 0,
    quarterlyDeposits: 250000,
    halfYearCommission: 1599999,
    preTripQuarterDeposits: 0,
    travelQuarterPartnershipConfirmed: true,
    travelDecision: 'auto',
    motivation: {
      mode: 'rules',
      annualReserveMode: 'monthly',
      travelEnabled: true,
      travelPerTrip: 100000,
      travelTripsPerYear: 2,
      congressEnabled: false,
      starEnabled: false
    }
  };
  const travelCard = {
    outerHTML: appHelpers.renderTravelMotivationCard(liveAgent)
  };
  assert.match(travelCard.outerHTML, /data-motivation-card="travel"/);
  assert.match(travelCard.outerHTML, /Поездка не заработана/);

  liveAgent.halfYearCommission = 1600000;
  appHelpers.setDocumentQuerySelector((selector) => (
    selector === '[data-motivation-card="travel"][data-agent-id="travel-live"]' ? travelCard : null
  ));
  appHelpers.updateTravelMotivationCard(liveAgent);
  assert.match(travelCard.outerHTML, /Агент заработал поездку\./);
  assert.doesNotMatch(travelCard.outerHTML, /Поездка не заработана/);
});

test('congress and star are always available without override', () => {
  const fixed = calculator.calculateMotivationReserve({
    paymentType: 'fixed',
    quarterlyCommission: 0,
    quarterlyDeposits: 0,
    motivation: {
      stipendMode: 'auto',
      annualReserveMode: 'monthly',
      mountainSeaEnabled: true,
      travelEnabled: true,
      corporateEnabled: true,
      congressEnabled: true,
      starEnabled: true
    }
  });

  assert.equal(fixed.stipendAvailable, false);
  assert.equal(fixed.mountainSeaAvailable, false);
  assert.equal(fixed.travelAvailable, false);
  assert.equal(fixed.corporateAvailable, false);
  assert.equal(fixed.congressAvailable, true);
  assert.equal(fixed.starAvailable, true);
  assert.equal(fixed.congressAnnual, 3500);
  assert.equal(fixed.starAnnual, 5000);

  const boosted = calculator.calculateMotivationReserve({
    paymentType: 'boosted',
    quarterlyCommission: 400000,
    quarterlyDeposits: 0,
    motivation: {
      annualReserveMode: 'monthly',
      congressEnabled: true,
      starEnabled: true
    }
  });

  assert.equal(boosted.congressAvailable, true);
  assert.equal(boosted.starAvailable, true);
  assert.equal(boosted.congressAnnual, 3500);
  assert.equal(boosted.starAnnual, 5000);
});

test('new agents default to exact deals mode in app state', () => {
  assert.match(appSource, /commissionMode:\s*'exact'/);
});

test('new agents initialize linked exact-deal metadata arrays', () => {
  const agent = appHelpers.createAgent();

  assert.deepEqual(Array.from(agent.dealsInput), ['']);
  assert.deepEqual(Array.from(agent.dealManualRates), ['']);
  assert.deepEqual(Array.from(agent.dealNewbuildSoloFlags), [false]);
});

test('legacy deposit orders migrate to direct manual percentages', () => {
  assert.equal(typeof appHelpers.depositOrderToManualRate, 'function');
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 20].map(appHelpers.depositOrderToManualRate),
    [45, 50, 55, 60, 65, 70, 80, 80]
  );

  const agent = {
    dealsInput: [100000, 100000, 100000, 100000],
    dealDepositOrders: [1, 2, 7, 20],
    dealNewbuildSoloFlags: [false, false, false, false]
  };
  appHelpers.normalizeDealRowMetadata(agent);

  assert.deepEqual(Array.from(agent.dealManualRates), [45, 50, 80, 80]);
  assert.equal(agent.dealDepositOrders, undefined);
});

test('exact-deal row helpers keep amounts, manual rates and newbuild flags aligned', () => {
  assert.equal(typeof appHelpers.normalizeDealRowMetadata, 'function');
  assert.equal(typeof appHelpers.addExactDealRow, 'function');
  assert.equal(typeof appHelpers.removeExactDealRow, 'function');

  const agent = {
    dealsInput: [100000, '', 200000],
    dealManualRates: [50, '', 80],
    dealNewbuildSoloFlags: [false, false, true]
  };

  appHelpers.normalizeDealRowMetadata(agent);
  appHelpers.addExactDealRow(agent);
  assert.deepEqual(agent.dealsInput, [100000, '', 200000, '']);
  assert.deepEqual(agent.dealManualRates, [50, '', 80, '']);
  assert.deepEqual(agent.dealNewbuildSoloFlags, [false, false, true, false]);

  appHelpers.removeExactDealRow(agent, 1);
  assert.deepEqual(agent.dealsInput, [100000, 200000, '']);
  assert.deepEqual(agent.dealManualRates, [50, 80, '']);
  assert.deepEqual(agent.dealNewbuildSoloFlags, [false, true, false]);
});

test('exact-deal UI renders direct manual percent, newbuild rule and transparent rate source', () => {
  const agent = {
    id: 'exact-row-ui',
    commissionMode: 'exact',
    dealsInput: [30000, 100000],
    dealManualRates: ['', 50],
    dealNewbuildSoloFlags: [true, false],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  };
  const html = appHelpers.renderExactDeals(agent, calculator.calculateAgent(agent));

  assert.match(html, /Процент для этой сделки, %/);
  assert.match(html, /placeholder="авто"/);
  assert.match(html, /data-deal-manual-rate="0"/);
  assert.match(html, /Пусто — автоматическая шкала\. Меняет только эту сделку\./);
  assert.match(html, /Ручной процент/);
  assert.match(html, /Новостройка, один агент/);
  assert.match(html, /data-deal-newbuild-solo="0"/);
  assert.match(html, /Введите комиссию, которая приходится именно на этого агента/);
  assert.doesNotMatch(html, /Расчётный задаток/);
  assert.doesNotMatch(html, /data-deal-deposit-order/);
});

test('small ordinary exact deal disables manual percent with a 45 percent explanation', () => {
  const agent = {
    id: 'small-rate-ui',
    commissionMode: 'exact',
    dealsInput: [30000],
    dealManualRates: [80],
    dealNewbuildSoloFlags: [false],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  };
  const html = appHelpers.renderExactDeals(agent, calculator.calculateAgent(agent));

  assert.match(html, /data-deal-manual-rate="0"[^>]*disabled/);
  assert.match(html, /Для обычной сделки меньше 50 000 ₽ применяется 45%/);
});

test('fixed exact-deal UI hides per-deal manual percent', () => {
  const agent = {
    id: 'fixed-rate-ui',
    commissionMode: 'exact',
    dealsInput: [100000],
    dealManualRates: [50],
    dealNewbuildSoloFlags: [false],
    paymentType: 'fixed',
    fixedRate: 80,
    status: 'partner',
    introduced: false
  };
  const html = appHelpers.renderExactDeals(agent, calculator.calculateAgent(agent));

  assert.doesNotMatch(html, /data-deal-manual-rate/);
  assert.doesNotMatch(html, /Процент для этой сделки, %/);
});

test('exact-deal UI warns when trainee exceeds three deposits', () => {
  const agent = {
    id: 'trainee-warning-ui',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 100000],
    paymentType: 'standard',
    status: 'trainee',
    introduced: false
  };
  const html = appHelpers.renderExactDeals(agent, calculator.calculateAgent(agent));

  assert.match(html, /У стажёра указано больше 3 задатков за месяц/);
  assert.match(html, /Расчёт применён как для агента, фактически перешедшего на партнёрскую шкалу после 3-го задатка/);
});

test('trainee warning node exists before the fourth deposit and updates without a full rerender', () => {
  const agent = {
    id: 'trainee-warning-live',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, ''],
    paymentType: 'standard',
    status: 'trainee',
    introduced: false
  };
  const html = appHelpers.renderExactDeals(agent, calculator.calculateAgent(agent));

  assert.match(html, /data-trainee-scale-warning/);
  assert.match(html, /data-trainee-scale-warning[^>]*hidden/);
  assert.match(appSource, /warningNode\.hidden\s*=\s*!agent\.traineeScaleExceeded/);
});

test('expense placeholders stay visual only and never seed state', () => {
  const state = appHelpers.createState();
  const elements = {
    expensesList: { innerHTML: '' }
  };

  appHelpers.setState(state);
  appHelpers.setElements(elements);
  appHelpers.renderExpenses();

  assert.match(elements.expensesList.innerHTML, /Что можно добавить/);
  assert.match(elements.expensesList.innerHTML, /Не добавляйте сюда роялти/);
  assert.match(elements.expensesList.innerHTML, /placeholder="Например: аренда офиса"/);
  assert.match(elements.expensesList.innerHTML, /placeholder="Например: связь"/);
  assert.match(elements.expensesList.innerHTML, /placeholder="Например: интернет"/);
  assert.match(elements.expensesList.innerHTML, /placeholder="Введите сумму расхода"/);
  assert.equal(state.expenses.length, 3);
  assert.equal(state.expenses[0].name, '');
  assert.equal(state.expenses[1].name, '');
  assert.equal(state.expenses[2].name, '');
  assert.equal(appSource.includes('Новый расход'), false);
});

test('standard partner exact deals use qualifying deal count for the rate scale', () => {
  const allQualified = calculator.calculateAgent({
    id: 'qualified-standard',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 100000],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });
  assert.deepEqual(Array.from(allQualified.deals.map((deal) => deal.rate)), [0.45, 0.50, 0.55, 0.60]);
  closeTo(allQualified.payout, 210000);

  const firstLow = calculator.calculateAgent({
    id: 'first-low',
    commissionMode: 'exact',
    dealsInput: [35000, 100000],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });
  assert.deepEqual(Array.from(firstLow.deals.map((deal) => deal.rate)), [0.45, 0.45]);
  closeTo(firstLow.payout, 60750);

  const threeLowThenQualified = calculator.calculateAgent({
    id: 'three-low-then-qualified',
    commissionMode: 'exact',
    dealsInput: [35000, 20000, 40000, 100000],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });
  assert.deepEqual(Array.from(threeLowThenQualified.deals.map((deal) => deal.rate)), [0.45, 0.45, 0.45, 0.45]);
  closeTo(threeLowThenQualified.payout, 87750);

  const fourthLow = calculator.calculateAgent({
    id: 'fourth-low',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 35000],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });
  assert.deepEqual(Array.from(fourthLow.deals.map((deal) => deal.rate)), [0.45, 0.50, 0.55, 0.45]);
  closeTo(fourthLow.payout, 165750);

  const lowThenQualified = calculator.calculateAgent({
    id: 'low-then-qualified',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 35000, 100000],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });
  assert.deepEqual(Array.from(lowThenQualified.deals.map((deal) => deal.rate)), [0.45, 0.50, 0.55, 0.45, 0.60]);
  closeTo(lowThenQualified.payout, 225750);
});

test('standard partner scale reaches 65, 70 and 80 percent and caps at 80', () => {
  const partner = calculator.calculateAgent({
    id: 'partner-full-scale',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });

  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rate)), [0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.80, 0.80]);
  closeTo(partner.payout, 505000);
});

test('standard partner user example applies 65 percent to the fifth deposit', () => {
  const partner = calculator.calculateAgent({
    id: 'partner-user-example',
    commissionMode: 'exact',
    dealsInput: [88200, 111750, 125000, 210000, 255404],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });

  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rate)), [0.45, 0.50, 0.55, 0.60, 0.65]);
  closeTo(partner.deals[4].payout, 166012.6);
  closeTo(partner.payout, 456327.6);
});

test('small ordinary deals stay at 45 percent and do not advance the deposit scale', () => {
  const partner = calculator.calculateAgent({
    id: 'partner-small-deal',
    commissionMode: 'exact',
    dealsInput: [49999, 100000],
    dealDepositOrders: ['', ''],
    dealNewbuildSoloFlags: [false, false],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });

  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rate)), [0.45, 0.45]);
  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.isQualifiedDeposit)), [false, true]);
  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rateSource)), ['baseSmallDeal', 'auto']);
  assert.equal(partner.deals[1].depositOrderApplied, 1);
});

test('small ordinary trainee deal stays at 45 percent and does not consume the first trainee tier', () => {
  const trainee = calculator.calculateAgent({
    id: 'trainee-small-deal',
    commissionMode: 'exact',
    dealsInput: [30000, 100000],
    dealDepositOrders: ['', ''],
    dealNewbuildSoloFlags: [false, false],
    paymentType: 'standard',
    status: 'trainee',
    introduced: false
  });

  assert.deepEqual(Array.from(trainee.deals.map((deal) => deal.rate)), [0.45, 0.30]);
  assert.deepEqual(Array.from(trainee.deals.map((deal) => deal.isQualifiedDeposit)), [false, true]);
  assert.equal(trainee.deals[1].depositOrderApplied, 1);
});

test('newbuild with one agent qualifies below 50000 and advances the deposit scale', () => {
  const partner = calculator.calculateAgent({
    id: 'partner-newbuild',
    commissionMode: 'exact',
    dealsInput: [30000, 100000],
    dealDepositOrders: ['', ''],
    dealNewbuildSoloFlags: [true, false],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });

  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rate)), [0.45, 0.50]);
  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.isQualifiedDeposit)), [true, true]);
  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.depositOrderApplied)), [1, 2]);
});

test('manual deposit order applies to its source row without blank-row index drift', () => {
  const partner = calculator.calculateAgent({
    id: 'partner-manual-order',
    commissionMode: 'exact',
    dealsInput: [200000, '', 100000],
    dealDepositOrders: [2, '', 7],
    dealNewbuildSoloFlags: [false, false, false],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });
  const capped = calculator.calculateAgent({
    id: 'partner-manual-order-cap',
    commissionMode: 'exact',
    dealsInput: [100000],
    dealDepositOrders: [10],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });

  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.sourceIndex)), [0, 2]);
  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rate)), [0.50, 0.80]);
  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rateSource)), ['manualDepositOrder', 'manualDepositOrder']);
  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.depositOrderApplied)), [2, 7]);
  assert.equal(capped.deals[0].rate, 0.80);
  assert.equal(capped.deals[0].depositOrderApplied, 10);
});

test('manualRate 50 means exactly 50 percent instead of the fiftieth deposit tier', () => {
  const partner = calculator.calculateAgent({
    id: 'partner-manual-rate-50',
    commissionMode: 'exact',
    dealsInput: [100000],
    dealManualRates: [50],
    dealNewbuildSoloFlags: [false],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });

  assert.equal(partner.deals[0].rate, 0.50);
  assert.equal(partner.deals[0].payout, 50000);
  assert.equal(partner.deals[0].rateSource, 'manualRate');
});

test('manual rate changes only its row and leaves the next automatic tier unchanged', () => {
  const partner = calculator.calculateAgent({
    id: 'partner-manual-rate-one-row',
    commissionMode: 'exact',
    dealsInput: [100000, 100000],
    dealManualRates: [80, ''],
    dealNewbuildSoloFlags: [false, false],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });

  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rate)), [0.80, 0.50]);
  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rateSource)), ['manualRate', 'auto']);
  assert.equal(partner.deals[1].depositOrderApplied, 2);
});

test('small ordinary deal ignores manual rate and does not advance the scale', () => {
  const partner = calculator.calculateAgent({
    id: 'partner-small-manual-rate',
    commissionMode: 'exact',
    dealsInput: [30000, 100000],
    dealManualRates: [80, ''],
    dealNewbuildSoloFlags: [false, false],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });

  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rate)), [0.45, 0.45]);
  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rateSource)), ['baseSmallDeal', 'auto']);
  assert.equal(partner.deals[1].depositOrderApplied, 1);
});

test('solo newbuild below threshold accepts a manual rate', () => {
  const partner = calculator.calculateAgent({
    id: 'partner-newbuild-manual-rate',
    commissionMode: 'exact',
    dealsInput: [30000, 100000],
    dealManualRates: [50, ''],
    dealNewbuildSoloFlags: [true, false],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });

  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rate)), [0.50, 0.50]);
  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rateSource)), ['manualRate', 'auto']);
});

test('boosted scheme accepts a direct manual rate below its automatic floor', () => {
  const partner = calculator.calculateAgent({
    id: 'partner-boosted-manual-rate',
    commissionMode: 'exact',
    dealsInput: [100000],
    dealManualRates: [50],
    dealNewbuildSoloFlags: [false],
    paymentType: 'boosted',
    startingRate: 70,
    status: 'partner',
    introduced: false
  });

  assert.equal(partner.deals[0].rate, 0.50);
  assert.equal(partner.deals[0].rateSource, 'manualRate');
});

test('fixed scheme ignores per-deal manual rate', () => {
  const partner = calculator.calculateAgent({
    id: 'partner-fixed-manual-rate',
    commissionMode: 'exact',
    dealsInput: [100000],
    dealManualRates: [50],
    dealNewbuildSoloFlags: [false],
    paymentType: 'fixed',
    fixedRate: 80,
    status: 'partner',
    introduced: false
  });

  assert.equal(partner.deals[0].rate, 0.80);
  assert.equal(partner.deals[0].rateSource, 'auto');
});

test('small ordinary deal ignores manual deposit order', () => {
  const partner = calculator.calculateAgent({
    id: 'partner-small-manual-order',
    commissionMode: 'exact',
    dealsInput: [30000, 100000],
    dealDepositOrders: [7, ''],
    dealNewbuildSoloFlags: [false, false],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  });

  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rate)), [0.45, 0.45]);
  assert.deepEqual(Array.from(partner.deals.map((deal) => deal.rateSource)), ['baseSmallDeal', 'auto']);
  assert.equal(partner.deals[0].depositOrderApplied, null);
  assert.equal(partner.deals[1].depositOrderApplied, 1);
});

test('standard trainee fourth exact deal switches to partner fourth tier with warning', () => {
  const trainee = calculator.calculateAgent({
    id: 'trainee-fourth',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 100000],
    paymentType: 'standard',
    status: 'trainee',
    introduced: false
  });

  assert.deepEqual(Array.from(trainee.deals.map((deal) => deal.rate)), [0.30, 0.35, 0.40, 0.60]);
  assert.equal(trainee.traineeScaleExceeded, true);
  assert.match(trainee.traineeScaleWarning, /стажёрская шкала заканчивается на 3-м задатке/i);
  closeTo(trainee.payout, 165000);
});

test('standard trainee fifth exact deal uses partner fifth tier', () => {
  const trainee = calculator.calculateAgent({
    id: 'trainee-fifth',
    commissionMode: 'exact',
    dealsInput: [50000, 50000, 50000, 50000, 50000],
    paymentType: 'standard',
    status: 'trainee',
    introduced: false
  });

  assert.deepEqual(Array.from(trainee.deals.map((deal) => deal.rate)), [0.30, 0.35, 0.40, 0.60, 0.65]);
  closeTo(trainee.payout, 115000);
});

test('standard trainee sixth exact deal uses partner sixth tier', () => {
  const trainee = calculator.calculateAgent({
    id: 'trainee-sixth',
    commissionMode: 'exact',
    dealsInput: [50000, 50000, 50000, 50000, 50000, 50000],
    paymentType: 'standard',
    status: 'trainee',
    introduced: false
  });

  assert.deepEqual(Array.from(trainee.deals.map((deal) => deal.rate)), [0.30, 0.35, 0.40, 0.60, 0.65, 0.70]);
  closeTo(trainee.payout, 150000);
});

test('motivation block source uses status-card entry copy', () => {
  assert.match(appSource, /Мотивации агента/);
  assert.match(appSource, /Не настроены/);
  assert.match(appSource, /Указаны вручную/);
  assert.match(appSource, /Рассчитываются по правилам/);
  assert.match(appSource, /Настроить мотивации/);
  assert.match(appSource, /Изменить мотивации/);
  assert.doesNotMatch(appSource, /Добавьте мотивации агенту!/);
  assert.doesNotMatch(appSource, /Мотивации не положены на особых условиях! Откройте, если всё равно хотите добавить\./);
});

test('exact deals summary repeats agent payout with the same amount', () => {
  const agent = {
    id: 'exact-summary',
    commissionMode: 'exact',
    dealsInput: [500000, 480000],
    paymentType: 'standard',
    status: 'partner',
    introduced: false
  };
  const result = calculator.calculateAgent(agent);
  const html = appHelpers.renderExactDeals(agent, result);

  assert.match(html, /Итого зарплата агенту/);
  assert.match(html, /465\s?000/);
  assert.match(html, /data-agent-summary="payout"/);
  assert.match(html, /class="button add-action-button"[^>]*data-action="add-deal"/);
});

test('quarterly result field is disabled until partnership is confirmed and stays effective in rules mode', () => {
  const agent = {
    id: 'quarter-agent',
    name: 'Quarter agent',
    commission: 0,
    dealCount: 1,
    commissionMode: 'exact',
    dealsInput: [''],
    paymentType: 'standard',
    status: 'partner',
    partnerConfirmed: false,
    quarterlyCommission: 1000000,
    quarterlyDeposits: 0,
    halfYearCommission: 0,
    preTripQuarterDeposits: 0,
    motivation: Object.assign({}, calculator.DEFAULT_MOTIVATION, {
      mode: 'rules',
      quarterlyCommission: 1000000,
      congressEnabled: false,
      starEnabled: false
    })
  };

  appHelpers.setState({ agents: [agent] });
  appHelpers.setElements({});

  const lockedHtml = appHelpers.renderMotivationControls(agent);
  assert.match(lockedHtml, /data-agent-field="quarterlyCommission"[^>]*disabled/);
  assert.match(lockedHtml, /Сначала подтвердите партнёрство/);

  const unlockedAgent = Object.assign({}, agent, { partnerConfirmed: true });
  const unlockedHtml = appHelpers.renderMotivationControls(unlockedAgent);
  assert.doesNotMatch(unlockedHtml, /data-agent-field="quarterlyCommission"[^>]*disabled/);
  assert.match(unlockedHtml, /Результат используется для уровня и стипендии/);

  const blocked = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    partnerConfirmed: false,
    quarterlyCommission: 1500000,
    quarterlyDeposits: 0,
    motivation: {
      mode: 'rules',
      quarterlyCommission: 1500000,
      stipendMode: 'auto'
    }
  });

  assert.equal(blocked.stipendAvailable, false);
  assert.equal(blocked.stipendMonthly, 0);
});

test('quarterly result input renders from agent state after money input updates it', () => {
  const agent = {
    id: 'quarter-render-agent',
    name: 'Quarter render agent',
    commission: 180000,
    dealCount: 1,
    commissionMode: 'exact',
    dealsInput: [180000],
    paymentType: 'standard',
    status: 'partner',
    partnerConfirmed: true,
    quarterlyCommission: 1300000,
    quarterlyDeposits: 250000,
    halfYearCommission: 0,
    preTripQuarterDeposits: 0,
    motivation: Object.assign({}, calculator.DEFAULT_MOTIVATION, {
      mode: 'rules',
      quarterlyCommission: 0,
      stipendMode: 'auto',
      congressEnabled: false,
      starEnabled: false
    })
  };

  const html = appHelpers.renderMotivationControls(agent);

  assert.match(html, /data-agent-field="quarterlyCommission"[^>]*value="1 300 000"/);
  assert.doesNotMatch(html, /data-agent-field="quarterlyCommission"[^>]*value=""/);
});

test('A4 motivation UI keeps stipend rules and uses isolated travel confirmation', () => {
  assert.match(appSource, /Партнёрство подтверждено\?/);
  assert.match(appSource, /Сначала подтвердите партнёрство\. Без подтверждения квартальный результат не учитывается для мотиваций\./);
  assert.match(appSource, /Результат используется для уровня и стипендии по текущей логике\./);
  assert.match(appSource, /data-agent-field=\\?"travelQuarterPartnershipConfirmed/);
  assert.match(appSource, /Отдельное условие поездки; не связано с обычным квартальным партнёрством/);
  assert.doesNotMatch(appSource, /Задатки в квартале перед поездкой, ₽/);
});

test('future mode entry pages exist as static scaffolds', () => {
  [
    'start.html',
    'simple.html',
    'extended.html',
    'assets/css/modes.css'
  ].forEach((fileName) => {
    assert.equal(fs.existsSync(path.join(rootDir, fileName)), true, fileName);
  });
});

test('example agent anna starts with placeholder deal only and no turnover', () => {
  const anna = calculator.DEFAULT_AGENTS[0];

  assert.equal(anna.commissionMode, 'exact');
  assert.deepEqual(Array.from(anna.dealsInput), ['']);
  assert.equal(anna.commission, 0);
  assert.equal(anna.dealCount, 1);
  assert.equal(calculator.calculateAgent(anna).commission, 0);
});

test('new A4 agent keeps congress ready by default but does not charge blank drafts', () => {
  const blankState = appHelpers.createState();
  const agent = blankState.agents[0];
  const blank = calculator.calculateAgent(agent);

  assert.equal(agent.motivation.congressEnabled, true);
  assert.equal(blank.motivation.congressAnnual, 0);
  assert.equal(blank.motivationReserve, 0);

  agent.name = 'Партнёр';
  agent.commission = 100000;
  agent.dealsInput = [100000];
  const active = calculator.calculateAgent(agent);

  assert.equal(active.motivation.congressAnnual, calculator.DEFAULT_MOTIVATION.congressPerYear);
  closeTo(active.motivationReserve, calculator.DEFAULT_MOTIVATION.congressPerYear / 12);
});

test('restore-example path keeps the demo state separate from the blank starter', () => {
  assert.match(appSource, /state = createExampleState\(\);/);
  assert.match(appSource, /restoredState = loadDraftState\(\);/);
  assert.match(appSource, /state = restoredState \|\| createState\(\);/);
  assert.match(appSource, /saveDraft\('restore-example'\)/);
});

test('mandatory congress and star survive off, manual and special payment modes', () => {
  const off = calculator.calculateMotivationReserve({
    name: 'Партнёр',
    commission: 100000,
    paymentType: 'standard',
    motivation: {
      mode: 'off',
      congressEnabled: true,
      congressPerYear: 3500,
      starEnabled: true,
      starPerYear: 5000
    }
  });
  closeTo(off.monthly, (3500 + 5000) / 12);

  const manual = calculator.calculateMotivationReserve({
    name: 'Партнёр',
    commission: 100000,
    paymentType: 'standard',
    motivation: {
      mode: 'manual',
      manualReserveMonthly: 1000,
      congressEnabled: true,
      congressPerYear: 3500,
      starEnabled: true,
      starPerYear: 5000
    }
  });
  closeTo(manual.monthly, 1000 + (3500 + 5000) / 12);

  const fixed = calculator.calculateMotivationReserve({
    name: 'Партнёр',
    commission: 100000,
    paymentType: 'fixed',
    motivation: {
      mode: 'off',
      congressEnabled: true,
      congressPerYear: 3500,
      starEnabled: true,
      starPerYear: 5000
    }
  });
  closeTo(fixed.monthly, (3500 + 5000) / 12);
});

test('isolated travel state machine covers automatic rule and owner decisions', () => {
  const cases = [
    { halfYearCommission: 1599999, confirmed: true, earned: false, counted: false },
    { halfYearCommission: 1600000, confirmed: false, earned: false, counted: false },
    { halfYearCommission: 1600000, confirmed: true, earned: true, counted: true },
    { halfYearCommission: 2000000, confirmed: true, earned: true, counted: true }
  ];

  cases.forEach((item) => {
    const result = calculator.calculateTravelMotivation({
      halfYearCommission: item.halfYearCommission,
      travelQuarterPartnershipConfirmed: item.confirmed,
      travelDecision: 'auto'
    });
    assert.equal(result.earned, item.earned);
    assert.equal(result.counted, item.counted);
    assert.equal(result.annualAmount, item.counted ? 200000 : 0);
  });

  const forced = calculator.calculateTravelMotivation({
    halfYearCommission: 1000000,
    travelQuarterPartnershipConfirmed: false,
    travelDecision: 'forceInclude'
  });
  assert.equal(forced.earned, false);
  assert.equal(forced.counted, true);
  assert.equal(forced.annualAmount, 200000);
  assert.equal(forced.monthlyAmount, 200000 / 12);
  assert.equal(forced.status, 'forced');

  const excluded = calculator.calculateTravelMotivation({
    halfYearCommission: 2000000,
    travelQuarterPartnershipConfirmed: true,
    travelDecision: 'forceExclude'
  });
  assert.equal(excluded.earned, true);
  assert.equal(excluded.counted, false);
  assert.equal(excluded.annualAmount, 0);
  assert.equal(excluded.status, 'warning');
});

test('isolated travel ignores unrelated agent data and normalizes unknown decision', () => {
  const result = calculator.calculateTravelMotivation({
    name: '',
    dealsInput: [],
    status: 'trainee',
    partnerConfirmed: false,
    paymentType: 'fixed',
    halfYearCommission: 2000000,
    travelQuarterPartnershipConfirmed: true,
    travelDecision: 'legacy-value',
    motivation: {
      travelEnabled: false,
      travelPerTrip: 100000,
      travelTripsPerYear: 2
    }
  });

  assert.equal(result.decision, 'auto');
  assert.equal(result.earned, true);
  assert.equal(result.counted, true);
  assert.equal(result.annualAmount, 200000);
});

test('legacy travel eligibility API delegates to the isolated rule', () => {
  const eligibility = calculator.getTravelEligibility({
    status: 'trainee',
    partnerConfirmed: false,
    paymentType: 'fixed',
    halfYearCommission: 2000000,
    travelQuarterPartnershipConfirmed: true
  });

  assert.equal(eligibility.available, true);
  assert.equal(eligibility.reason, 'available');
});

test('travel state defaults and legacy migration use one decision source', () => {
  const blankAgent = appHelpers.createBlankState().agents[0];
  assert.equal(blankAgent.travelQuarterPartnershipConfirmed, false);
  assert.equal(blankAgent.travelDecision, 'auto');

  assert.equal(appHelpers.normalizeAgent({
    travelDecision: 'forceExclude',
    travelOverride: true,
    motivation: { travelEnabled: true }
  }).travelDecision, 'forceExclude');
  assert.equal(appHelpers.normalizeAgent({ travelOverride: true }).travelDecision, 'forceInclude');
  assert.equal(appHelpers.normalizeAgent({ motivation: { travelEnabled: true } }).travelDecision, 'auto');
  assert.equal(appHelpers.normalizeAgent({ travelDecision: 'broken' }).travelDecision, 'auto');
});

test('motivation reserve consumes only the isolated travel result', () => {
  const automatic = calculator.calculateMotivationReserve({
    status: 'trainee',
    partnerConfirmed: false,
    halfYearCommission: 2000000,
    travelQuarterPartnershipConfirmed: true,
    travelDecision: 'auto',
    motivation: {
      mode: 'rules',
      travelEnabled: false,
      travelPerTrip: 100000,
      travelTripsPerYear: 2,
      congressEnabled: false
    }
  });
  assert.equal(automatic.travelEarned, true);
  assert.equal(automatic.travelCounted, true);
  assert.equal(automatic.travelAnnual, 200000);
  closeTo(automatic.monthly, 200000 / 12);

  const forced = calculator.calculateMotivationReserve({
    halfYearCommission: 1000000,
    travelQuarterPartnershipConfirmed: false,
    travelDecision: 'forceInclude',
    motivation: { mode: 'rules', congressEnabled: false }
  });
  assert.equal(forced.travelAnnual, 200000);

  const excluded = calculator.calculateMotivationReserve({
    halfYearCommission: 2000000,
    travelQuarterPartnershipConfirmed: true,
    travelDecision: 'forceExclude',
    motivation: { mode: 'rules', congressEnabled: false }
  });
  assert.equal(excluded.travelAnnual, 0);
  assert.equal(excluded.monthly, 0);
});

test('manual general reserve keeps its total while exposing travel obligation', () => {
  const reserve = calculator.calculateMotivationReserve({
    halfYearCommission: 2000000,
    travelQuarterPartnershipConfirmed: true,
    travelDecision: 'auto',
    motivation: {
      mode: 'manual',
      manualReserveMonthly: 12345,
      congressEnabled: false
    }
  });

  assert.equal(reserve.travelEarned, true);
  assert.equal(reserve.travelCounted, true);
  assert.equal(reserve.travelAnnual, 200000);
  assert.equal(reserve.monthly, 12345);
});

test('travel UI exposes one contextual decision and always offers return to auto', () => {
  const blocked = appHelpers.renderTravelMotivationCard({
    id: 'blocked-ui',
    halfYearCommission: 1000000,
    travelQuarterPartnershipConfirmed: false,
    travelDecision: 'auto',
    motivation: { travelPerTrip: 100000, travelTripsPerYear: 2 }
  });
  assert.match(blocked, /data-agent-field="travelDecision"[^>]*value="forceInclude"/);
  assert.doesNotMatch(blocked, /value="forceExclude"/);
  assert.match(blocked, /Расчётная сумма поездки/);
  assert.match(blocked, /200(?: |\u00a0)000/);

  const earned = appHelpers.renderTravelMotivationCard({
    id: 'earned-ui',
    halfYearCommission: 2000000,
    travelQuarterPartnershipConfirmed: true,
    travelDecision: 'auto'
  });
  assert.match(earned, /data-agent-field="travelDecision"[^>]*value="forceExclude"/);
  assert.doesNotMatch(earned, /value="forceInclude"/);

  const forced = appHelpers.renderTravelMotivationCard({
    id: 'forced-ui',
    halfYearCommission: 1000000,
    travelQuarterPartnershipConfirmed: false,
    travelDecision: 'forceInclude'
  });
  assert.match(forced, /data-agent-field="travelDecision"[^>]*value="auto"/);
  assert.match(forced, /Вернуть расчёт по правилу/);

  const manualHtml = appHelpers.renderMotivationControls({
    id: 'manual-ui',
    status: 'partner',
    paymentType: 'standard',
    halfYearCommission: 2000000,
    travelQuarterPartnershipConfirmed: true,
    travelDecision: 'auto',
    motivation: { mode: 'manual', manualReserveMonthly: 1000 }
  });
  assert.match(manualHtml, /data-agent-field="travelQuarterPartnershipConfirmed"/);
  assert.match(manualHtml, /data-motivation-card="travel"/);
});

test('expense add action appears once below the inline total', () => {
  const action = 'data-action="add-expense"';
  assert.equal(indexSource.split(action).length - 1, 1);
  assert.ok(indexSource.indexOf(action) > indexSource.indexOf('id="expensesInlineTotal"'));
  assert.match(indexSource, /paper-total[\s\S]*section-actions bottom-actions[\s\S]*class="button add-action-button"[\s\S]*data-action="add-expense"/);
  assert.match(indexSource, /class="button add-action-button" id="addAgentBtn"/);
  assert.match(indexSource, /class="button add-action-button" id="addAgentBottomBtn"/);
});

test('A4 draft save controls are visible in toolbar and fixed panel', () => {
  assert.match(indexSource, /data-action="save-draft"/);
  assert.match(indexSource, /id="draftSaveStatus"/);
  assert.match(indexSource, /class="draft-save-panel"/);
  assert.match(indexSource, /data-draft-save-status/);
  assert.match(calculatorCssSource, /\.draft-save-panel\s*\{/);
  assert.match(calculatorCssSource, /\.draft-save-panel\s*\{[\s\S]*position:\s*fixed/);
  assert.match(calculatorCssSource, /\.draft-save-status--dirty/);
  assert.match(calculatorCssSource, /\.draft-save-status--error/);
});

test('A4 draft save handlers cover shortcut, unload, clear, restore and destructive confirms', () => {
  assert.match(appSource, /A4_DRAFT_KEY = 'domianA4DraftV2'/);
  assert.match(appSource, /LEGACY_A4_DRAFT_KEYS = \['domianA4DraftV1'\]/);
  assert.match(appSource, /TABLE_SNAPSHOT_KEY = 'domianA4TableSnapshot'/);
  assert.match(appSource, /localStorage\.setItem\(A4_DRAFT_KEY/);
  assert.match(appSource, /function openTableModePage\(\)[\s\S]*localStorage\.setItem\(TABLE_SNAPSHOT_KEY/);
  assert.match(appSource, /target\.dataset\.action === 'save-draft'[\s\S]*saveDraft\('manual'\)/);
  assert.match(appSource, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(appSource, /saveDraft\('shortcut'\)/);
  assert.match(appSource, /window\.addEventListener\('pagehide'/);
  assert.match(appSource, /saveDraft\('pagehide'\)/);
  assert.match(appSource, /document\.addEventListener\('visibilitychange'/);
  assert.match(appSource, /saveDraft\('hidden'\)/);
  assert.match(appSource, /window\.addEventListener\('beforeunload'[\s\S]*saveDraft\('beforeunload'\)/);
  assert.match(appSource, /saveDraft\('clear'\)/);
  assert.match(appSource, /saveDraft\('restore-example'\)/);
  assert.match(appSource, /Удалить агента и все его сделки/);
  assert.match(appSource, /Удалить расход\?/);
  assert.match(appSource, /Удалить сделку\?/);
  assert.match(indexSource, /data-action="hard-reset"/);
  assert.match(indexSource, /Удалить все сохранённые данные/);
  assert.match(appSource, /function removeAllA4Storage/);
  assert.doesNotMatch(appSource, /localStorage\.clear\(/);
});

test('A4 entry page cache-busts the current calculator assets', () => {
  assert.match(indexSource, /a4-calculator\.css\?v=a4-manual-rate-20260702/);
  assert.match(indexSource, /constants\.js\?v=a4-manual-rate-20260702/);
  assert.match(indexSource, /calculations\.js\?v=a4-manual-rate-20260702/);
  assert.match(indexSource, /calendar-policy\.js\?v=a4-manual-rate-20260702/);
  assert.match(indexSource, /app\.js\?v=a4-manual-rate-20260702/);
});

test('exact-deal layout keeps controls aligned and shrinkable on desktop and mobile', () => {
  assert.match(calculatorCssSource, /\.exact-deal-row\s*\{[\s\S]*align-items:\s*start/);
  assert.match(calculatorCssSource, /\.field,[\s\S]*\.check-field,[\s\S]*\.exact-deals-panel[\s\S]*min-width:\s*0/);
  assert.match(calculatorCssSource, /input,[\s\S]*select\s*\{[\s\S]*max-width:\s*100%/);
  assert.match(calculatorCssSource, /\.exact-deal-row > \.field\s*\{[\s\S]*grid-template-rows:\s*minmax\(38px,\s*auto\)\s+46px\s+minmax\(0,\s*1fr\)/);
  assert.match(calculatorCssSource, /\.exact-deal-row--fixed\s*\{[\s\S]*grid-template-columns:/);
  assert.match(calculatorCssSource, /@media \(max-width:\s*680px\)[\s\S]*\.exact-deal-row[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(calculatorCssSource, /@media \(max-width:\s*680px\)[\s\S]*\.draft-save-panel \.draft-save-status\s*\{[\s\S]*display:\s*none/);
});

test('collapsed motivation summary shows status, reserve and explicit CTA', () => {
  const offHtml = appHelpers.renderMotivationControls({
    id: 'summary-standard',
    status: 'partner',
    paymentType: 'standard',
    motivation: { mode: 'off' }
  });
  assert.match(offHtml, /motivation-summary motivation-summary--off/);
  assert.match(offHtml, /motivation-summary-heading">Мотивации агента</);
  assert.match(offHtml, /motivation-summary-status">Не настроены</);
  assert.match(offHtml, /Без настройки стипендии, поездки и дополнительные резервы не попадут в расчёт агента\./);
  assert.match(offHtml, /summary-closed">Настроить мотивации</);
  assert.match(offHtml, /motivation-summary-icon/);
  assert.match(offHtml, /motivation-summary-cta/);
  assert.match(offHtml, /РАССЧИТАТЬ МОТИВАЦИИ АГЕНТА/);
  assert.doesNotMatch(offHtml, /motivation-summary-pointer/);
  assert.doesNotMatch(offHtml, /↓/);
  assert.doesNotMatch(offHtml, /ЖМИТЕ СЮДА/);

  const manualHtml = appHelpers.renderMotivationControls({
    id: 'summary-manual',
    status: 'partner',
    paymentType: 'standard',
    motivation: { mode: 'manual', manualReserveMonthly: 1500 }
  });
  assert.match(manualHtml, /motivation-summary motivation-summary--manual/);
  assert.match(manualHtml, /motivation-summary-status">Указаны вручную</);
  assert.match(manualHtml, /motivation-summary-amount">В резерве сейчас: [^<]*₽<\/span>/);
  assert.match(manualHtml, /summary-closed">Изменить мотивации</);
  assert.match(manualHtml, /РАССЧИТАТЬ МОТИВАЦИИ АГЕНТА/);

  const rulesHtml = appHelpers.renderMotivationControls({
    id: 'summary-rules',
    status: 'partner',
    paymentType: 'standard',
    partnerConfirmed: true,
    quarterlyCommission: 400000,
    halfYearCommission: 2000000,
    travelQuarterPartnershipConfirmed: true,
    motivation: {
      mode: 'rules',
      travelEnabled: true
    }
  });
  assert.match(rulesHtml, /motivation-summary motivation-summary--rules/);
  assert.match(rulesHtml, /motivation-summary-status">Рассчитываются по правилам</);
  assert.match(rulesHtml, /Стипендия, поездки и годовые резервы учитываются по выбранным условиям\./);
  assert.match(rulesHtml, /motivation-summary-amount">В резерве сейчас: [^<]*₽<\/span>/);
  assert.match(rulesHtml, /summary-closed">Изменить мотивации</);
  assert.match(rulesHtml, /РАССЧИТАТЬ МОТИВАЦИИ АГЕНТА/);
});

test('add actions use soft blue workflow styling', () => {
  assert.match(calculatorCssSource, /\.add-action-button\s*\{/);
  assert.match(calculatorCssSource, /\.add-action-button\s*\{[\s\S]*width:\s*100%/);
  assert.match(calculatorCssSource, /\.add-action-button\s*\{[\s\S]*border:\s*1px solid rgba\(36, 92, 153, \.24\)/);
  assert.match(calculatorCssSource, /\.add-action-button\s*\{[\s\S]*color:\s*var\(--blue-dark\)/);
  assert.match(calculatorCssSource, /\.section-head\.split \.add-action-button\s*\{[\s\S]*min-width:\s*210px/);
});

test('collapsed motivation summary uses warm variant 3 styling', () => {
  assert.doesNotMatch(calculatorCssSource, /\.motivation-summary-pointer\s*\{/);
  assert.doesNotMatch(calculatorCssSource, /\.motivation-summary-arrows\s*\{/);
  assert.match(calculatorCssSource, /\.motivation-summary-icon\s*\{/);
  assert.match(calculatorCssSource, /\.motivation-summary-cta\s*\{/);
  assert.match(calculatorCssSource, /\.motivation-summary-cta\s*\{[\s\S]*linear-gradient\(180deg,\s*#f59e0b,\s*#dc5b1f\)/);
  assert.match(calculatorCssSource, /\.motivation-summary-action\s*\{/);
  assert.match(calculatorCssSource, /\.motivation-summary--off\s*\{[\s\S]*border-left-color:\s*#f59e0b/i);
  assert.match(calculatorCssSource, /\.motivation-summary--manual\s*\{[\s\S]*border-left-color:\s*#f59e0b/i);
  assert.match(calculatorCssSource, /\.motivation-summary--rules\s*\{[\s\S]*border-left-color:\s*#f59e0b/i);
  assert.doesNotMatch(calculatorCssSource, /\.motivation-box:not\(\[open\]\) \.motivation-summary::before\s*\{[\s\S]*content:\s*"!"/);
  assert.doesNotMatch(calculatorCssSource, /\.motivation-box:not\(\[open\]\) \.motivation-summary\s*\{[\s\S]*background:[^;]*#(?:c|d|e|f)[0-9a-f]{5}/i);
});

test('A4 workflow sections use external collapsedSections UI layer', () => {
  assert.match(appSource, /collapsedSections:\s*\{/);
  assert.match(appSource, /function setSectionCollapsed/);
  assert.match(appSource, /function renderWorkflowSections/);
  assert.match(appSource, /function scrollToNextWorkflowSection/);
  assert.match(appSource, /ownerDeals:\s*'\[aria-labelledby="resultTitle"\]'/);
  assert.match(appSource, /scrollIntoView/);
  assert.match(appSource, /data-action="expand-section"/);
  assert.doesNotMatch(appSource, /state\.collapsedSections/);
  assert.match(indexSource, /data-action="collapse-section"/);
  assert.match(indexSource, /data-workflow-section="expenses"/);
  assert.match(indexSource, /data-workflow-section="agents"/);
  assert.match(indexSource, /data-workflow-section="ownerDeals"/);
  assert.match(indexSource, /workflow-next-action[\s\S]*data-section-key="expenses"[\s\S]*Перейти к агентам →/);
  assert.match(indexSource, /workflow-next-action[\s\S]*data-section-key="agents"[\s\S]*Перейти к личным сделкам →/);
  assert.match(indexSource, /workflow-next-action[\s\S]*data-section-key="ownerDeals"[\s\S]*Перейти к итогам →/);
  assert.match(calculatorCssSource, /\.workflow-next-button\s*\{[\s\S]*width:\s*min\(100%, 420px\)/);
  assert.match(calculatorCssSource, /\.workflow-next-action\s*\{[\s\S]*border-top:/);
  assert.match(calculatorCssSource, /\.workflow-section\.is-collapsed\s+\.workflow-summary/);
});
