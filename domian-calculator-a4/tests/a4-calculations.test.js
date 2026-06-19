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
  const context = {
    window: {},
    console,
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
      setItem() {},
      removeItem() {}
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
      '  normalizeAgent: normalizeAgent,',
      '  renderExpenses: renderExpenses,',
      '  renderExactDeals: renderExactDeals,',
      '  renderMotivationControls: renderMotivationControls,',
      '  renderTravelMotivationCard: renderTravelMotivationCard,',
      '  updateTravelMotivationCard: updateTravelMotivationCard,',
      '  setState: function (nextState) { state = nextState; },',
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
});

test('A4 blank state starts empty while example state keeps demo data', () => {
  const blank = appHelpers.createState();
  const example = appHelpers.createExampleState();

  assert.equal(blank.ownerSales, 0);
  assert.equal(blank.expenses.length, 1);
  assert.equal(blank.expenses[0].amount, 0);
  assert.equal(blank.expenses[0].name, '');
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
  assert.deepEqual(Array.from(starting55WithLowDeal.deals.map((deal) => deal.rate)), [0.55, 0.55, 0.55, 0.55, 0.60]);
  closeTo(starting55WithLowDeal.payout, 244250);
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
  assert.deepEqual(Array.from(agent.deals.map((deal) => deal.rate)), [0.55, 0.55, 0.55, 0.55]);
  closeTo(agent.payout, 220000);
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
  assert.match(elements.expensesList.innerHTML, /placeholder="Введите сумму расхода"/);
  assert.equal(state.expenses[0].name, '');
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

test('standard trainee fourth exact deal gets 45 percent', () => {
  const trainee = calculator.calculateAgent({
    id: 'trainee-fourth',
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 100000],
    paymentType: 'standard',
    status: 'trainee',
    introduced: false
  });

  assert.deepEqual(Array.from(trainee.deals.map((deal) => deal.rate)), [0.30, 0.35, 0.40, 0.45]);
  closeTo(trainee.payout, 150000);
});

test('standard trainee fifth exact deal switches to partner scale', () => {
  const trainee = calculator.calculateAgent({
    id: 'trainee-fifth',
    commissionMode: 'exact',
    dealsInput: [50000, 50000, 50000, 50000, 50000],
    paymentType: 'standard',
    status: 'trainee',
    introduced: false
  });

  assert.deepEqual(Array.from(trainee.deals.map((deal) => deal.rate)), [0.30, 0.35, 0.40, 0.45, 0.50]);
  closeTo(trainee.payout, 100000);
});

test('standard trainee sixth exact deal reaches 55 percent', () => {
  const trainee = calculator.calculateAgent({
    id: 'trainee-sixth',
    commissionMode: 'exact',
    dealsInput: [50000, 50000, 50000, 50000, 50000, 50000],
    paymentType: 'standard',
    status: 'trainee',
    introduced: false
  });

  assert.deepEqual(Array.from(trainee.deals.map((deal) => deal.rate)), [0.30, 0.35, 0.40, 0.45, 0.50, 0.55]);
  closeTo(trainee.payout, 127500);
});

test('motivation block source uses concise urgent summaries', () => {
  assert.match(appSource, /Добавьте мотивации агенту!/);
  assert.match(appSource, /Мотивации не положены на особых условиях! Откройте, если всё равно хотите добавить\./);
  assert.doesNotMatch(appSource, /Без проверки мотиваций расчёт может быть неполным\./);
  assert.doesNotMatch(appSource, /Открыть и проверить мотивации/);
  assert.doesNotMatch(appSource, /Проверьте: конгресс, звезда, море\/горы, путешествие, стипендия\./);
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
  assert.match(appSource, /state = createState\(\);/);
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
  assert.match(indexSource, /paper-total[\s\S]*section-actions bottom-actions[\s\S]*data-action="add-expense"/);
});

test('collapsed motivation summary uses one urgent message per payment mode', () => {
  const standardHtml = appHelpers.renderMotivationControls({
    id: 'summary-standard',
    status: 'partner',
    paymentType: 'standard',
    motivation: { mode: 'rules' }
  });
  assert.match(standardHtml, /summary-closed">Добавьте мотивации агенту!</);
  assert.match(standardHtml, /summary-open">Скрыть мотивации</);
  assert.doesNotMatch(standardHtml, /Без проверки мотиваций расчёт может быть неполным/);
  assert.doesNotMatch(standardHtml, /Проверьте: конгресс/);
  assert.doesNotMatch(standardHtml, /Открыть и проверить мотивации/);
  assert.doesNotMatch(standardHtml, /data-agent-summary="motivationInline"/);

  const specialHtml = appHelpers.renderMotivationControls({
    id: 'summary-special',
    status: 'partner',
    paymentType: 'fixed',
    fixedRate: 80,
    motivation: { mode: 'off' }
  });
  assert.match(specialHtml, /summary-closed">Мотивации не положены на особых условиях! Откройте, если всё равно хотите добавить\./);
  assert.match(specialHtml, /summary-open">Скрыть мотивации</);
  assert.doesNotMatch(specialHtml, /data-agent-summary="motivationInline"/);
});

test('collapsed motivation alert is bright red with an exclamation marker', () => {
  assert.match(calculatorCssSource, /\.motivation-box:not\(\[open\]\) \.motivation-summary\s*\{[\s\S]*background:[^;]*#(?:c|d|e|f)[0-9a-f]{5}/i);
  assert.match(calculatorCssSource, /\.motivation-box:not\(\[open\]\) \.motivation-summary::before\s*\{[\s\S]*content:\s*"!"/);
  assert.match(calculatorCssSource, /\.motivation-box:not\(\[open\]\) \.motivation-summary[\s\S]*color:\s*#fff/);
});
