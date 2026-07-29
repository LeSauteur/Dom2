const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..', 'pub', 'domian-calculator-a4');
const ledgerCss = fs.readFileSync(path.join(rootDir, 'assets/css/table-ledger.css'), 'utf8');

test('active ledger uses full desktop width and page-level vertical scrolling', () => {
  const pageRule = ledgerCss.match(/\.ledger-page\s*\{[^}]*\}/)[0];
  const scrollRule = ledgerCss.match(/\.table-scroll\s*\{[^}]*\}/)[0];

  assert.match(pageRule, /width:\s*calc\(100%\s*-\s*28px\)/);
  assert.doesNotMatch(pageRule, /min\(1260px/);
  assert.match(scrollRule, /overflow-x:\s*auto/);
  assert.match(scrollRule, /max-height:\s*none/);
  assert.doesNotMatch(scrollRule, /overflow:\s*auto/);
});

function loadLedger(initialStorage = {}) {
  const localStorageStore = Object.assign({}, initialStorage);
  const nodes = Object.create(null);
  const listeners = Object.create(null);
  const confirmMessages = [];
  let confirmResult = true;
  const document = {
    activeElement: null,
    addEventListener(type, handler) {
      if (!listeners[type]) {
        listeners[type] = [];
      }
      listeners[type].push(handler);
    },
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
    window: {
      confirm(message) {
        confirmMessages.push(message);
        return confirmResult;
      }
    },
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
      '  createAgent: createAgent,',
      '  createState: createState,',
      '  buildCalculationAgent: buildCalculationAgent,',
      '  loadA4Snapshot: loadA4Snapshot,',
      '  renderExactDealRow: renderExactDealRow,',
      '  renderAgentSetupRow: renderAgentSetupRow,',
      '  saveLedgerDraft: function () { return typeof saveLedgerDraft === "function" ? saveLedgerDraft() : undefined; },',
      '  loadLedgerDraft: function () { return typeof loadLedgerDraft === "function" ? loadLedgerDraft() : undefined; },',
      '  getState: function () { return state; },',
      '  setState: function (nextState) { state = nextState; },',
      '  localStorageStore: localStorageStore,',
      '  getNode: function (id) { return document.getElementById(id); }',
      '};',
      '}());'
    ].join('\n'));
  vm.runInContext(source, context, { filename: 'assets/js/table-ledger.js' });
  Object.assign(context, context.window);
  context.window.__ledgerTest.dispatch = function dispatch(type, target) {
    (listeners[type] || []).forEach((handler) => handler({ target }));
  };
  context.window.__ledgerTest.setConfirmResult = function setConfirmResult(value) {
    confirmResult = value;
  };
  context.window.__ledgerTest.getConfirmMessages = function getConfirmMessages() {
    return confirmMessages.slice();
  };
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

test('active ledger cache-busts the caret-stable input handler', () => {
  assert.match(ledgerHtml, /table-ledger\.js\?v=a4-ledger-caret-20260706/);
});

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
        dealManualRates: [50, ''],
        dealDepositOrders: [7, 7],
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
  assert.equal(agent.deals[0].manualRate, 50);
  assert.equal(agent.deals[0].isNewbuildSolo, true);
  assert.equal(agent.deals[1].manualRate, '');
  assert.equal(agent.deals[1].isNewbuildSolo, false);
  assert.deepEqual(Array.from(calculated.deals.map((deal) => deal.rate)), [0.50, 0.50]);
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
  assert.equal(deal.manualRate, '');
  assert.equal(deal.isNewbuildSolo, false);
});

test('live table-ledger migrates legacy deposit order to manual percent', () => {
  ledger.localStorageStore.domianA4TableSnapshot = JSON.stringify({
    version: 3,
    state: {
      selectedMonth: '2026-03',
      expenses: [],
      ownerSales: 0,
      agents: [{
        id: 'legacy-order-agent',
        name: 'Legacy order',
        commissionMode: 'exact',
        dealsInput: [100000],
        dealDepositOrders: [5],
        dealNewbuildSoloFlags: [false],
        paymentType: 'standard',
        status: 'partner'
      }]
    }
  });

  ledger.loadA4Snapshot();
  const agent = ledger.getState().agents[0];
  const calculated = ledgerWindow.calculateAgent(ledger.buildCalculationAgent(agent));

  assert.equal(agent.deals[0].manualRate, 65);
  assert.equal(calculated.deals[0].rate, 0.65);
  assert.match(ledgerSource, /Legacy snapshot migration only/);
});

test('live table-ledger renders manual percent and newbuild controls', () => {
  assert.match(ledgerSource, /data-deal-field="manualRate"/);
  assert.match(ledgerSource, /data-deal-field="isNewbuildSolo"/);
  assert.match(ledgerSource, /Процент для этой сделки, %/);
  assert.match(ledgerSource, /Новостройка, один агент/);
  assert.doesNotMatch(ledgerSource, /data-deal-field="depositOrder"/);
  assert.doesNotMatch(ledgerSource, /Расчётный задаток/);
  assert.match(ledgerHtml, /активного месяца/i);
  assert.match(ledgerHtml, /table-ledger\.css\?v=a4-ledger-draft-20260706/);
  assert.match(ledgerHtml, /constants\.js\?v=a4-ledger-draft-20260706/);
  assert.match(ledgerHtml, /calculations\.js\?v=a4-ledger-draft-20260706/);
  assert.match(ledgerHtml, /table-ledger\.js\?v=a4-ledger-caret-20260706/);
});

test('active ledger deal rows use calculateAgent results instead of local payout and referral formulas', () => {
  assert.doesNotMatch(ledgerSource, /\b(?:amount|split)\s*\*\s*rate\b/);
  assert.doesNotMatch(ledgerSource, /\b(?:amount|split)\s*\*\s*REFERRAL_RATE\b/);
  assert.doesNotMatch(ledgerSource, /function getDealPayout\(/);

  const agent = ledger.createAgent('Display parity');
  agent.introduced = true;
  agent.deals = [
    ledger.createDeal(100000, 57, false),
    ledger.createDeal(200000, '', false)
  ];
  const calculated = ledgerWindow.calculateAgent(ledger.buildCalculationAgent(agent));
  const office = ledgerWindow.calculateOffice({
    expenses: [],
    ownerSales: 0,
    agents: [ledger.buildCalculationAgent(agent)]
  });
  const firstMetric = calculated.deals[0];
  const expectedReferral = calculated.referral * firstMetric.commission / calculated.commission;
  const rowHtml = ledger.renderExactDealRow(agent, agent.deals[0], 0, office);

  assert.match(rowHtml, new RegExp(Math.round(firstMetric.payout).toLocaleString('ru-RU')));
  assert.match(rowHtml, new RegExp(Math.round(expectedReferral).toLocaleString('ru-RU')));
});

test('active ledger snapshot preserves explicit top-level partnerConfirmed false', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  currentLedger.localStorageStore.domianA4TableSnapshot = JSON.stringify({
    version: 3,
    state: {
      expenses: [],
      ownerSales: 0,
      agents: [{
        name: 'Explicit false',
        commissionMode: 'exact',
        dealsInput: [100000],
        paymentType: 'standard',
        status: 'partner',
        partnerConfirmed: false,
        motivation: {
          mode: 'rules',
          partnerConfirmed: true,
          congressEnabled: false
        }
      }]
    }
  });

  currentLedger.loadA4Snapshot();
  const agent = currentLedger.getState().agents[0];
  assert.equal(agent.partnerConfirmed, false);
  assert.equal(currentLedger.buildCalculationAgent(agent).partnerConfirmed, false);
});

test('active ledger saves a versioned draft and restores it on reload', () => {
  const firstWindow = loadLedger();
  const firstLedger = firstWindow.__ledgerTest;
  const state = firstLedger.createState();
  state.selectedMonth = '2026-07';
  state.ownerSales = 123000;
  state.agents[0].name = 'Черновик';
  state.agents[0].deals = [
    firstLedger.createDeal(100000, 57, true)
  ];
  firstLedger.setState(state);

  firstLedger.saveLedgerDraft();

  const raw = firstLedger.localStorageStore.domianA4LedgerDraftV1;
  assert.ok(raw, 'ledger draft must be written to localStorage');
  const payload = JSON.parse(raw);
  assert.equal(payload.version, 1);
  assert.equal(payload.state.selectedMonth, '2026-07');
  assert.equal(payload.state.agents[0].deals[0].manualRate, 57);
  assert.equal(payload.state.agents[0].deals[0].isNewbuildSolo, true);

  const reloadedWindow = loadLedger(firstLedger.localStorageStore);
  const restored = reloadedWindow.__ledgerTest.getState();
  assert.equal(restored.ownerSales, 123000);
  assert.equal(restored.agents[0].name, 'Черновик');
  assert.equal(restored.agents[0].deals[0].manualRate, 57);
  assert.equal(restored.agents[0].deals[0].isNewbuildSolo, true);
});

test('active ledger draft preserves travel decisions and an empty expense list', () => {
  const firstWindow = loadLedger();
  const firstLedger = firstWindow.__ledgerTest;
  const state = firstLedger.createState();
  state.expenses = [];
  state.agents[0].travelQuarterPartnershipConfirmed = true;
  state.agents[0].travelDecision = 'forceExclude';
  firstLedger.setState(state);
  firstLedger.saveLedgerDraft();

  const restored = loadLedger(firstLedger.localStorageStore).__ledgerTest.getState();
  assert.equal(restored.expenses.length, 0);
  assert.equal(restored.agents[0].travelQuarterPartnershipConfirmed, true);
  assert.equal(restored.agents[0].travelDecision, 'forceExclude');
});

test('active ledger autosaves ordinary input changes', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  const agent = currentLedger.getState().agents[0];

  currentLedger.dispatch('input', {
    value: 'Автосохранение',
    dataset: {
      agentField: 'name',
      agentId: agent.id
    }
  });

  const payload = JSON.parse(currentLedger.localStorageStore.domianA4LedgerDraftV1);
  assert.equal(payload.state.agents[0].name, 'Автосохранение');
});

test('typing in every ledger input category keeps the editor DOM intact', () => {
  const cases = [
    {
      name: 'agent text',
      target(state) {
        return {
          value: 'Петров',
          dataset: { agentField: 'name', agentId: state.agents[0].id }
        };
      }
    },
    {
      name: 'agent number',
      target(state) {
        return {
          value: '65',
          dataset: { agentField: 'startingRate', agentId: state.agents[0].id }
        };
      }
    },
    {
      name: 'deal amount',
      target(state) {
        return {
          value: '100 000',
          dataset: {
            dealField: 'amount',
            agentId: state.agents[0].id,
            dealId: state.agents[0].deals[0].id
          }
        };
      }
    },
    {
      name: 'deal manual rate',
      target(state) {
        return {
          value: '45',
          dataset: {
            dealField: 'manualRate',
            agentId: state.agents[0].id,
            dealId: state.agents[0].deals[0].id
          }
        };
      }
    },
    {
      name: 'deal comment',
      target(state) {
        return {
          value: 'Комментарий',
          dataset: {
            dealField: 'comment',
            agentId: state.agents[0].id,
            dealId: state.agents[0].deals[0].id
          }
        };
      }
    },
    {
      name: 'expense text',
      target(state) {
        return {
          value: 'Новый расход',
          dataset: { expenseField: 'name', expenseId: state.expenses[0].id }
        };
      }
    },
    {
      name: 'expense amount',
      target(state) {
        return {
          value: '25 000',
          dataset: { expenseField: 'amount', expenseId: state.expenses[0].id }
        };
      }
    },
    {
      name: 'owner sales',
      target() {
        return {
          value: '300 000',
          dataset: { officeField: 'ownerSales' }
        };
      }
    }
  ];

  cases.forEach((inputCase) => {
    const currentWindow = loadLedger();
    const currentLedger = currentWindow.__ledgerTest;
    const body = currentLedger.getNode('ledgerBody');
    const expenses = currentLedger.getNode('expensesList');
    body.innerHTML = 'ledger-editor-sentinel';
    expenses.innerHTML = 'expense-editor-sentinel';

    currentLedger.dispatch('input', inputCase.target(currentLedger.getState()));

    assert.equal(body.innerHTML, 'ledger-editor-sentinel', inputCase.name);
    assert.equal(expenses.innerHTML, 'expense-editor-sentinel', inputCase.name);
  });
});

test('finishing a ledger input change rerenders calculated values', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  const state = currentLedger.getState();
  const body = currentLedger.getNode('ledgerBody');
  const target = {
    value: '45',
    dataset: {
      dealField: 'manualRate',
      agentId: state.agents[0].id,
      dealId: state.agents[0].deals[0].id
    }
  };
  body.innerHTML = 'ledger-editor-sentinel';

  currentLedger.dispatch('input', target);
  assert.equal(body.innerHTML, 'ledger-editor-sentinel');

  currentLedger.dispatch('change', target);
  assert.notEqual(body.innerHTML, 'ledger-editor-sentinel');
  assert.equal(currentLedger.getState().agents[0].deals[0].manualRate, 45);
});

test('clear ledger confirms and removes the saved draft', () => {
  const currentWindow = loadLedger({
    domianA4LedgerDraftV1: JSON.stringify({
      version: 1,
      state: {
        selectedMonth: '',
        ownerSales: 100000,
        expenses: [],
        agents: []
      }
    })
  });
  const currentLedger = currentWindow.__ledgerTest;
  currentLedger.dispatch('click', {
    dataset: { action: 'clear-ledger' },
    closest() { return this; }
  });

  assert.equal(currentLedger.localStorageStore.domianA4LedgerDraftV1, undefined);
  assert.equal(currentLedger.getState().ownerSales, 0);
  assert.match(currentLedger.getConfirmMessages()[0], /очистить/i);
});

test('loading A4 does not overwrite meaningful ledger data when confirmation is declined', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  const manualState = currentLedger.createState();
  manualState.agents[0].name = 'Ручная ведомость';
  manualState.agents[0].deals = [currentLedger.createDeal(200000)];
  currentLedger.setState(manualState);
  currentLedger.localStorageStore.domianA4TableSnapshot = JSON.stringify({
    version: 3,
    state: {
      expenses: [],
      ownerSales: 0,
      agents: [{
        name: 'Из A4',
        commissionMode: 'exact',
        dealsInput: [100000],
        status: 'partner',
        paymentType: 'standard'
      }]
    }
  });
  currentLedger.setConfirmResult(false);

  currentLedger.dispatch('click', {
    dataset: { action: 'load-a4' },
    closest() { return this; }
  });

  assert.equal(currentLedger.getState().agents[0].name, 'Ручная ведомость');
  assert.match(currentLedger.getConfirmMessages()[0], /загрузить.*A4/i);
});

test('active ledger shows selected month, A4 source time and draft save status', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  currentLedger.localStorageStore.domianA4TableSnapshot = JSON.stringify({
    version: 3,
    savedAt: '2026-07-06T10:00:00.000Z',
    state: {
      selectedMonth: '2026-07',
      expenses: [],
      ownerSales: 0,
      agents: [{
        name: 'Источник',
        commissionMode: 'exact',
        dealsInput: [100000],
        status: 'partner',
        paymentType: 'standard'
      }]
    }
  });

  currentLedger.loadA4Snapshot();

  assert.match(currentLedger.getNode('ledgerSelectedMonth').textContent, /2026-07/);
  assert.match(currentLedger.getNode('ledgerDataSource').textContent, /A4/);
  assert.match(currentLedger.getNode('ledgerDataSource').textContent, /загружено/i);
  assert.match(currentLedger.getNode('ledgerSaveStatus').textContent, /сохран/i);
  assert.match(ledgerHtml, /id="ledgerSelectedMonth"/);
  assert.match(ledgerHtml, /id="ledgerDataSource"/);
  assert.match(ledgerHtml, /id="ledgerSaveStatus"/);
});

test('active ledger preserves all isolated travel decisions from A4 snapshot', () => {
  [
    { label: 'auto earned', confirmed: true, decision: 'auto', expected: true },
    { label: 'auto blocked', confirmed: false, decision: 'auto', expected: false },
    { label: 'force include', confirmed: false, decision: 'forceInclude', expected: true },
    { label: 'force exclude', confirmed: true, decision: 'forceExclude', expected: false }
  ].forEach((scenario) => {
    const currentWindow = loadLedger();
    const currentLedger = currentWindow.__ledgerTest;
    currentLedger.localStorageStore.domianA4TableSnapshot = JSON.stringify({
      version: 3,
      savedAt: '2026-07-06T10:00:00.000Z',
      state: {
        selectedMonth: '2026-07',
        expenses: [],
        ownerSales: 0,
        agents: [{
          name: scenario.label,
          commissionMode: 'exact',
          dealsInput: [100000],
          paymentType: 'standard',
          status: 'partner',
          halfYearCommission: 1600000,
          preTripQuarterDeposits: 250000,
          travelQuarterPartnershipConfirmed: scenario.confirmed,
          travelDecision: scenario.decision,
          motivation: {
            mode: 'rules',
            travelPerTrip: 100000,
            travelTripsPerYear: 2,
            congressEnabled: false
          }
        }]
      }
    });

    currentLedger.loadA4Snapshot();
    const agent = currentLedger.getState().agents[0];
    const calculated = currentWindow.calculateAgent(currentLedger.buildCalculationAgent(agent));
    assert.equal(agent.travelQuarterPartnershipConfirmed, scenario.confirmed, scenario.label);
    assert.equal(agent.travelDecision, scenario.decision, scenario.label);
    assert.equal(calculated.motivation.travelCounted, scenario.expected, scenario.label);
    assert.equal(calculated.motivation.travelAnnual, scenario.expected ? 200000 : 0, scenario.label);
  });
});

test('active ledger travel UI uses the isolated confirmation and decision fields', () => {
  const agent = ledger.createAgent('Поездка');
  const html = ledger.renderAgentSetupRow(agent, ledgerWindow.calculateOffice({
    expenses: [],
    ownerSales: 0,
    agents: [ledger.buildCalculationAgent(agent)]
  }));

  assert.match(html, /data-agent-field="travelQuarterPartnershipConfirmed"/);
  assert.match(html, /data-agent-field="travelDecision"/);
  assert.doesNotMatch(html, /data-agent-field="travelEnabled"/);
});

test('active ledger preserves explicit zero and custom mandatory motivation amounts', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  currentLedger.localStorageStore.domianA4TableSnapshot = JSON.stringify({
    version: 3,
    state: {
      expenses: [],
      ownerSales: 0,
      agents: [{
        name: 'Нули',
        commissionMode: 'exact',
        dealsInput: [100000],
        paymentType: 'standard',
        status: 'partner',
        partnerConfirmed: true,
        travelQuarterPartnershipConfirmed: true,
        travelDecision: 'forceInclude',
        motivation: {
          mode: 'rules',
          mountainSeaEnabled: true,
          mountainSeaPerTrip: 0,
          mountainSeaTripsPerYear: 0,
          travelPerTrip: 0,
          travelTripsPerYear: 0,
          corporateEnabled: true,
          corporatePerYear: 0,
          congressEnabled: true,
          congressPerYear: 4321,
          starEnabled: true,
          starPerYear: 8765
        }
      }]
    }
  });

  currentLedger.loadA4Snapshot();
  const agent = currentLedger.getState().agents[0];
  const calculated = currentWindow.calculateAgent(currentLedger.buildCalculationAgent(agent));

  assert.equal(agent.congressPerYear, 4321);
  assert.equal(agent.starPerYear, 8765);
  assert.equal(calculated.motivation.mountainSeaAnnual, 0);
  assert.equal(calculated.motivation.travelAnnual, 0);
  assert.equal(calculated.motivation.corporateAnnual, 0);
  assert.equal(calculated.motivation.congressAnnual, 4321);
  assert.equal(calculated.motivation.starAnnual, 8765);
});

test('active ledger preserves special manual reserve from A4 snapshot', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  currentLedger.localStorageStore.domianA4TableSnapshot = JSON.stringify({
    version: 3,
    state: {
      expenses: [],
      ownerSales: 0,
      agents: [{
        name: 'Особые условия',
        commissionMode: 'exact',
        dealsInput: [100000],
        paymentType: 'fixed',
        fixedRate: 80,
        status: 'partner',
        motivation: {
          mode: 'manual',
          manualReserveMonthly: 12345,
          specialManualReserveEnabled: true,
          congressEnabled: false
        }
      }]
    }
  });

  currentLedger.loadA4Snapshot();
  const agent = currentLedger.getState().agents[0];
  const calculated = currentWindow.calculateAgent(currentLedger.buildCalculationAgent(agent));
  assert.equal(agent.specialManualReserveEnabled, true);
  assert.equal(calculated.motivationReserve, 12345);
});

test('active ledger normalizes trainee special payment terms to standard', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  currentLedger.localStorageStore.domianA4TableSnapshot = JSON.stringify({
    version: 3,
    state: {
      expenses: [],
      ownerSales: 0,
      agents: [{
        name: 'Стажёр',
        commissionMode: 'exact',
        dealsInput: [100000],
        paymentType: 'fixed',
        fixedRate: 80,
        status: 'trainee'
      }]
    }
  });

  currentLedger.loadA4Snapshot();
  assert.equal(currentLedger.getState().agents[0].paymentType, 'standard');
});

test('selecting trainee in the active ledger forces the standard scheme', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  const agent = currentLedger.getState().agents[0];
  agent.paymentType = 'boosted';

  currentLedger.dispatch('input', {
    value: 'trainee',
    dataset: {
      agentField: 'status',
      agentId: agent.id
    }
  });

  assert.equal(currentLedger.getState().agents[0].status, 'trainee');
  assert.equal(currentLedger.getState().agents[0].paymentType, 'standard');
});

test('active ledger renders trainee warning after fourth qualifying deal', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  const state = currentLedger.createState();
  const agent = state.agents[0];
  agent.name = 'Стажёр';
  agent.status = 'trainee';
  agent.paymentType = 'standard';
  agent.deals = [100000, 100000, 100000, 100000].map((amount) => currentLedger.createDeal(amount));
  currentLedger.setState(state);

  const html = currentLedger.renderAgentSetupRow(agent, currentWindow.calculateOffice({
    expenses: [],
    ownerSales: 0,
    agents: [currentLedger.buildCalculationAgent(agent)]
  }));

  assert.match(html, /стажёрская шкала заканчивается на 3-м задатке/i);
});

test('active ledger applies manual rate, ignores it for small ordinary deal and qualifies solo newbuild', () => {
  const agent = ledger.createAgent('Партнёр');
  agent.deals = [
    ledger.createDeal(100000, 57, false),
    ledger.createDeal(30000, 99, false),
    ledger.createDeal(30000, 62, true)
  ];

  const calculated = ledgerWindow.calculateAgent(ledger.buildCalculationAgent(agent));
  assert.deepEqual(Array.from(calculated.deals.map((deal) => deal.rate)), [0.57, 0.45, 0.62]);
  assert.deepEqual(Array.from(calculated.deals.map((deal) => deal.isQualifiedDeposit)), [true, false, true]);
});

test('active ledger keeps only one star and preserves mandatory flags for meaningful zero-turnover agents', () => {
  const state = ledger.createState();
  const first = state.agents[0];
  first.name = 'Первый';
  first.congressEnabled = true;
  first.starEnabled = true;
  first.deals = [ledger.createDeal(0)];
  const second = ledger.createAgent('Второй');
  second.congressEnabled = true;
  second.starEnabled = true;
  second.deals = [ledger.createDeal(0)];
  state.agents = [first, second];
  ledger.setState(state);

  const totals = ledgerWindow.calculateOffice({
    expenses: [],
    ownerSales: 0,
    agents: state.agents.map(ledger.buildCalculationAgent)
  });

  assert.equal(totals.agents[0].motivation.congressAnnual, 3500);
  assert.equal(totals.agents[1].motivation.congressAnnual, 3500);
  assert.equal(totals.agents[0].motivation.starAnnual, 5000);
  assert.equal(totals.agents[1].motivation.starAnnual, 0);
});

test('adding a deal safely converts manual quick totals into exact rows', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  const state = currentLedger.createState();
  const agent = state.agents[0];
  agent.commissionMode = 'quick';
  agent.quickCommission = 400000;
  agent.quickDealCount = 4;
  currentLedger.setState(state);

  currentLedger.dispatch('click', {
    dataset: { action: 'add-deal-to-agent', agentId: agent.id },
    closest() { return this; }
  });

  const converted = currentLedger.getState().agents[0];
  assert.equal(converted.commissionMode, 'exact');
  assert.deepEqual(Array.from(converted.deals.map((deal) => deal.amount)), [100000, 100000, 100000, 100000, 0]);
  assert.equal(currentWindow.calculateAgent(currentLedger.buildCalculationAgent(converted)).commission, 400000);
});

test('removing a filled deal requires confirmation', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  const state = currentLedger.createState();
  const agent = state.agents[0];
  agent.deals = [currentLedger.createDeal(100000), currentLedger.createDeal(200000)];
  currentLedger.setState(state);
  currentLedger.setConfirmResult(false);

  currentLedger.dispatch('click', {
    dataset: {
      action: 'remove-deal',
      agentId: agent.id,
      dealId: agent.deals[0].id
    },
    closest() { return this; }
  });

  assert.equal(currentLedger.getState().agents[0].deals.length, 2);
  assert.match(currentLedger.getConfirmMessages()[0], /удалить сделку/i);
});

test('removing a meaningful agent requires confirmation', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  const state = currentLedger.createState();
  state.agents[0].name = 'Заполненный агент';
  state.agents.push(currentLedger.createAgent('Второй'));
  currentLedger.setState(state);
  currentLedger.setConfirmResult(false);

  currentLedger.dispatch('click', {
    dataset: {
      action: 'remove-agent',
      agentId: state.agents[0].id
    },
    closest() { return this; }
  });

  assert.equal(currentLedger.getState().agents.length, 2);
  assert.match(currentLedger.getConfirmMessages()[0], /удалить агента/i);
});

test('removing even a blank agent requires confirmation', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  const state = currentLedger.createState();
  state.agents.push(currentLedger.createAgent(''));
  currentLedger.setState(state);
  currentLedger.setConfirmResult(false);

  currentLedger.dispatch('click', {
    dataset: {
      action: 'remove-agent',
      agentId: state.agents[1].id
    },
    closest() { return this; }
  });

  assert.equal(currentLedger.getState().agents.length, 2);
  assert.match(currentLedger.getConfirmMessages()[0], /удалить агента/i);
});

test('removing an expense requires confirmation', () => {
  const currentWindow = loadLedger();
  const currentLedger = currentWindow.__ledgerTest;
  const expense = currentLedger.getState().expenses[0];
  currentLedger.setConfirmResult(false);

  currentLedger.dispatch('click', {
    dataset: {
      action: 'remove-expense',
      expenseId: expense.id
    },
    closest() { return this; }
  });

  assert.equal(currentLedger.getState().expenses.length, 6);
  assert.match(currentLedger.getConfirmMessages()[0], /удалить расход/i);
});
