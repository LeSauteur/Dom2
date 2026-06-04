const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCalculator() {
  const rootDir = path.resolve(__dirname, '..');
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
    stipendMode: 'off',
    quarterlyResult: 1500000,
    mountainSeaEnabled: false,
    travelEnabled: false,
    corporateEnabled: false,
    congressEnabled: false
  });

  const reserve = calculator.calculateMotivationReserve({
    stipendMode: 'auto',
    quarterlyResult: 1500000,
    mountainSeaEnabled: true,
    mountainSeaPerTrip: 15000,
    mountainSeaTripsPerYear: 2,
    travelEnabled: true,
    travelPerYear: 120000,
    corporateEnabled: true,
    corporatePerYear: 20000,
    congressEnabled: true,
    congressPerYear: 5000
  });

  assert.equal(noReserve.monthly, 0);
  assert.equal(reserve.stipendMonthly, 7000);
  closeTo(reserve.mountainSeaMonthly, 2500);
  closeTo(reserve.travelMonthly, 10000);
  closeTo(reserve.corporateMonthly, 1666.6666666666667);
  closeTo(reserve.congressMonthly, 416.6666666666667);
  closeTo(reserve.monthly, 21583.333333333332);
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
        introduced: false,
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
