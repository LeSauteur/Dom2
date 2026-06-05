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
const appSource = fs.readFileSync(path.join(rootDir, 'assets/js/app.js'), 'utf8');

test('royalty boundaries use strict less-than limits', () => {
  [
    [499999, 0.07],
    [500000, 0.065],
    [750000, 0.06],
    [1000000, 0.055],
    [1500000, 0.05],
    [2000000, 0.045],
    [2500000, 0.04],
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
  closeTo(boostedSecond.payout, 235000);
  closeTo(fixed.payout, 320000);
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
  closeTo(agent.payout, 237000);
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
  closeTo(agent.payout, 238500);
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
    stipendMode: 'off',
    quarterlyResult: 1500000,
    quarterlyDeposits: 250000,
    mountainSeaEnabled: false,
    travelEnabled: false,
    corporateEnabled: false,
    congressEnabled: false
  });

  const reserve = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    stipendMode: 'auto',
    quarterlyResult: 1500000,
    quarterlyDeposits: 250000,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 250000,
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

test('travel reserve defaults to two international trips per year', () => {
  assert.equal(calculator.DEFAULT_MOTIVATION.travelPerTrip, 100000);
  assert.equal(calculator.DEFAULT_MOTIVATION.travelTripsPerYear, 2);

  const reserve = calculator.calculateMotivationReserve({
    paymentType: 'standard',
    stipendMode: 'off',
    quarterlyDeposits: 250000,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 250000,
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
  assert.equal(manual.annualReserveTotal, 208500);
  assert.equal(manual.annualReserveMonthly, 25000);
  assert.equal(manual.monthly, 25000);
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
  assert.equal(totals.motivationReserves, 5500);
  assert.equal(totals.resultWithoutOwnerBeforeReserves, 62000);
  assert.equal(totals.resultWithoutOwner, 56500);
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

  const first = totals.agentEconomics[0];
  assert.equal(first.expenseShare, 20000);
  assert.equal(first.royaltyShare, 7000);
  assert.equal(first.contribution, -7000);
  assert.equal(first.status, 'Не окупается');
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

test('travel and corporate reserves are blocked by eligibility unless overridden', () => {
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
    travelOverride: true,
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

test('domian travel requires half-year result and pre-trip deposits', () => {
  assert.equal(calculator.getTravelEligibility({
    paymentType: 'standard',
    quarterlyDeposits: 250000,
    halfYearCommission: 1599999,
    preTripQuarterDeposits: 250000
  }).available, false);

  assert.equal(calculator.getTravelEligibility({
    paymentType: 'standard',
    quarterlyDeposits: 250000,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 0
  }).available, false);

  assert.equal(calculator.getTravelEligibility({
    paymentType: 'standard',
    quarterlyDeposits: 250000,
    halfYearCommission: 1600000,
    preTripQuarterDeposits: 250000
  }).available, true);
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

test('example agent anna defaults to exact deals mode with preserved deal list', () => {
  const anna = calculator.DEFAULT_AGENTS[0];

  assert.equal(anna.commissionMode, 'exact');
  assert.deepEqual(Array.from(anna.dealsInput), [100000, 100000, 100000, 100000]);
  assert.equal(anna.commission, 400000);
  assert.equal(anna.dealCount, 4);
});
