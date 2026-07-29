const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..', '..');
const appRoot = path.join(root, 'pub', 'domian-calculator-a4');

function loadCore() {
  const context = {
    window: {},
    console,
    Number,
    Math,
    Date,
    JSON,
    Object,
    Array,
    String,
    Boolean,
    RegExp,
    Infinity,
    setTimeout,
    clearTimeout
  };
  context.window.window = context.window;
  vm.createContext(context.window);
  vm.runInContext(fs.readFileSync(path.join(appRoot, 'assets/js/constants.js'), 'utf8'), context.window, { filename: 'constants.js' });
  vm.runInContext(fs.readFileSync(path.join(appRoot, 'assets/js/calculations.js'), 'utf8'), context.window, { filename: 'calculations.js' });
  return context.window;
}

function closeTo(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to equal ${expected}`);
}

function plain(values) {
  return Array.prototype.slice.call(values);
}

function makeAgent(overrides) {
  return Object.assign({
    id: 'audit-agent',
    name: 'Audit agent',
    status: 'partner',
    paymentType: 'standard',
    commissionMode: 'exact',
    dealsInput: [],
    dealManualRates: [],
    dealNewbuildSoloFlags: [],
    fixedRate: 80,
    startingRate: 55,
    introduced: false,
    partnerConfirmed: true,
    motivation: {
      mode: 'off',
      stipendMode: 'off',
      congressEnabled: false,
      starEnabled: false
    }
  }, overrides || {});
}

const w = loadCore();
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('ordinary deal threshold is strict at 50000 and small deals do not move the scale', () => {
  const agent = makeAgent({
    dealsInput: [40000, 100000, 49999.99, 100000, 50000],
    dealManualRates: [80, '', 70, '', '']
  });
  const result = w.calculateAgent(agent);
  assert.deepStrictEqual(plain(result.deals.map((deal) => deal.rate)), [0.45, 0.45, 0.45, 0.50, 0.55]);
  assert.deepStrictEqual(plain(result.deals.map((deal) => deal.isQualifiedDeposit)), [false, true, false, true, true]);
  closeTo(result.payout, 18000 + 45000 + 22499.9955 + 50000 + 27500);
});

test('manual rate changes only one qualified row and does not move the next automatic tier', () => {
  const result = w.calculateAgent(makeAgent({
    dealsInput: [100000, 100000, 100000],
    dealManualRates: ['', 65, '']
  }));
  assert.deepStrictEqual(plain(result.deals.map((deal) => deal.rate)), [0.45, 0.65, 0.55]);
  closeTo(result.payout, 165000);
});

test('fixed explicit zero remains zero and does not fall back to fixed default', () => {
  const result = w.calculateAgent(makeAgent({
    paymentType: 'fixed',
    fixedRate: 0,
    dealsInput: [100000, 100000]
  }));
  assert.strictEqual(result.fixedRate, 0);
  assert.deepStrictEqual(plain(result.deals.map((deal) => deal.rate)), [0, 0]);
  closeTo(result.payout, 0);
});

test('solo newbuild first row qualifies below 50000 and accepts manual rate', () => {
  const result = w.calculateAgent(makeAgent({
    dealsInput: [1],
    dealManualRates: [62],
    dealNewbuildSoloFlags: [true]
  }));
  assert.deepStrictEqual(plain(result.deals.map((deal) => deal.isQualifiedDeposit)), [true]);
  assert.deepStrictEqual(plain(result.deals.map((deal) => deal.rate)), [0.62]);
  closeTo(result.payout, 0.62);
});

test('solo newbuild after a prior qualifying deal should use the next automatic tier', () => {
  const result = w.calculateAgent(makeAgent({
    dealsInput: [100000, 1, 100000],
    dealManualRates: ['', '', ''],
    dealNewbuildSoloFlags: [false, true, false]
  }));
  assert.deepStrictEqual(plain(result.deals.map((deal) => deal.isQualifiedDeposit)), [true, true, true]);
  assert.deepStrictEqual(plain(result.deals.map((deal) => deal.rate)), [0.45, 0.50, 0.55]);
});

test('trainee fourth qualifying deal switches to partner fourth tier', () => {
  const result = w.calculateAgent(makeAgent({
    status: 'trainee',
    dealsInput: [100000, 100000, 100000, 100000]
  }));
  assert.deepStrictEqual(plain(result.deals.map((deal) => deal.rate)), [0.30, 0.35, 0.40, 0.60]);
  assert.strictEqual(result.traineeScaleExceeded, true);
});

test('boosted starting rate is a floor over the standard scale', () => {
  const result = w.calculateAgent(makeAgent({
    paymentType: 'boosted',
    startingRate: 70,
    dealsInput: [100000, 100000, 100000, 100000, 100000]
  }));
  assert.deepStrictEqual(plain(result.deals.map((deal) => deal.rate)), [0.70, 0.70, 0.70, 0.70, 0.70]);
});

test('royalty boundaries use strict less-than tiers', () => {
  closeTo(w.calculateRoyalty(499999.99), 35000);
  closeTo(w.calculateRoyalty(500000), 32500);
  closeTo(w.calculateRoyalty(750000), 45000);
  closeTo(w.calculateRoyalty(3000000), 105000);
});

test('travel can be forcibly included and explicit zero travel amount is preserved', () => {
  const reserve = w.calculateMotivationReserve(makeAgent({
    halfYearCommission: 0,
    travelQuarterPartnershipConfirmed: false,
    travelDecision: 'forceInclude',
    motivation: {
      mode: 'rules',
      stipendMode: 'off',
      partnerConfirmed: true,
      travelEnabled: true,
      travelPerTrip: 0,
      travelTripsPerYear: 0,
      congressEnabled: false,
      starEnabled: false
    }
  }));
  assert.strictEqual(reserve.travelCounted, true);
  assert.strictEqual(reserve.travelAnnual, 0);
});

test('A4 and shared office core agree for two-agent mixed scenario', () => {
  const office = w.calculateOffice({
    ownerSales: 150000,
    expenses: [{ id: 'rent', name: 'Rent', amount: 100000 }],
    agents: [
      makeAgent({ id: 'a', dealsInput: [100000, 100000, 100000], introduced: true }),
      makeAgent({ id: 'b', paymentType: 'fixed', fixedRate: 70, dealsInput: [200000] })
    ]
  });
  closeTo(office.agentTurnover, 500000);
  closeTo(office.agentPayouts, 150000 + 140000);
  closeTo(office.referrals, 7500);
  closeTo(office.royaltyWithoutOwner, 32500);
});

let failures = 0;
const results = [];

for (const entry of tests) {
  try {
    entry.fn();
    results.push({ status: 'PASS', name: entry.name });
  } catch (error) {
    failures += 1;
    results.push({ status: 'FAIL', name: entry.name, message: error.message });
  }
}

for (const result of results) {
  console.log(`${result.status} ${result.name}${result.message ? ` :: ${result.message}` : ''}`);
}

console.log(JSON.stringify({
  file: path.relative(root, __filename),
  total: results.length,
  pass: results.length - failures,
  fail: failures
}, null, 2));

process.exitCode = failures ? 1 : 0;
