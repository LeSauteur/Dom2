const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', 'pub', 'domian-calculator-a4');
const context = { window: {}, console };
vm.createContext(context);
[
  'assets/js/constants.js',
  'assets/js/calculations.js',
  'assets/js/policies/motivation-policy-2026.js',
  'assets/js/domain/benefit-engine.js',
  'assets/js/domain/motivation-calculator-engine.js'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  Object.assign(context, context.window);
});

let failed = false;
function test(name, callback) {
  try {
    callback();
    console.log('PASS', name);
  } catch (error) {
    failed = true;
    console.error('FAIL', name);
    console.error(error.stack);
  }
}

function close(actual, expected, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function packagedAgent(id, packageId, deals, extra = {}) {
  return context.MotivationCalculator2026.applyPackage(Object.assign({
    id,
    name: id,
    commissionMode: 'exact',
    dealsInput: deals,
    dealManualRates: [],
    dealNewbuildSoloFlags: [],
    paymentType: 'standard',
    status: packageId === 'newcomer' ? 'trainee' : 'partner',
    quarterlyDeposits: 300000,
    quarterlyCommission: 600000,
    halfYearCommission: 1600000,
    careerPreviousMonthDeposits: 500000,
    careerOfficePlanCompleted: true,
    careerAgentParticipated: true,
    travelQuarterPartnershipConfirmed: true,
    careerMountainSeaCost: 12000,
    careerTravelCost: 20000,
    careerCorporateCost: 5000
  }, extra), packageId);
}

function calculateLedgerOffice(source) {
  return context.calculateOffice(Object.assign({}, source, {
    agentEconomicsAllocation: 'officeExact'
  }));
}

test('royalty scenarios distribute the exact office royalty', () => {
  [
    { amounts: [400000], office: 28000, shares: [28000] },
    { amounts: [300000, 300000], office: 39000, shares: [19500, 19500] },
    { amounts: [400000, 400000], office: 48000, shares: [24000, 24000] },
    { amounts: [600000, 600000], office: 66000, shares: [33000, 33000] },
    { amounts: [1300000, 1300000], office: 104000, shares: [52000, 52000] },
    { amounts: [300000, 800000, 1600000], office: 108000, shares: [12000, 32000, 64000] }
  ].forEach((scenario) => {
    const agents = scenario.amounts.map((amount, index) => packagedAgent(`r${index}`, 'standard', [amount], {
      quarterlyDeposits: 0,
      quarterlyCommission: 0,
      halfYearCommission: 0,
      careerOfficePlanCompleted: false,
      careerAgentParticipated: false,
      travelQuarterPartnershipConfirmed: false,
      careerMountainSeaCost: 0,
      careerTravelCost: 0,
      careerCorporateCost: 0
    }));
    const result = calculateLedgerOffice({ agents, expenses: [], ownerSales: 0 });
    assert.equal(result.royaltyWithoutOwner, scenario.office);
    assert.deepEqual(Array.from(result.agentEconomics, (item) => item.royaltyShare), scenario.shares);
    close(result.agentEconomics.reduce((sum, item) => sum + item.royaltyShare, 0), result.royaltyWithoutOwner);
    close(result.agentEconomics.reduce((sum, item) => sum + item.contribution, 0), result.resultWithoutOwner);
  });
});

test('all seven packages apply independent floors and 2026 benefit payers', () => {
  const expected = {
    newcomer: { rates: [30, 35, 40, 40, 40, 40], payout: 225000, office: 0, agent: 0 },
    standard: { rates: [45, 50, 55, 60, 65, 70], payout: 345000, office: 40000, agent: 0 },
    extended: { rates: [50, 50, 55, 60, 65, 70], payout: 350000, office: 40000, agent: 0 },
    advanced: { rates: [55, 55, 55, 60, 65, 70], payout: 360000, office: 37000, agent: 0 },
    premium: { rates: [60, 60, 60, 60, 65, 70], payout: 375000, office: 17000, agent: 20000 },
    premiumPlus: { rates: [65, 65, 65, 65, 65, 70], payout: 395000, office: 5000, agent: 32000 },
    individual: { rates: [70, 70, 70, 70, 70, 70], payout: 420000, office: 15000, agent: 37000 }
  };
  Object.entries(expected).forEach(([packageId, oracle]) => {
    const result = context.calculateAgent(packagedAgent(packageId, packageId, Array(6).fill(100000)));
    assert.deepEqual(Array.from(result.deals, (deal) => Math.round(deal.rate * 100)), oracle.rates);
    assert.equal(result.payout, oracle.payout);
    assert.equal(result.motivationReserve, oracle.office);
    assert.equal(result.motivationAgentCost, oracle.agent);
  });
});

test('small deals, newbuild qualification and package floor behave independently', () => {
  const a = context.calculateAgent(packagedAgent('a', 'standard', [30000, 100000, 100000]));
  const b = context.calculateAgent(packagedAgent('b', 'standard', [100000, 30000, 100000]));
  const c = context.calculateAgent(packagedAgent('c', 'standard', [30000, 100000], {
    dealNewbuildSoloFlags: [true, false]
  }));
  assert.deepEqual(Array.from(a.deals, (deal) => deal.rate), [0.45, 0.45, 0.50]);
  assert.deepEqual(Array.from(b.deals, (deal) => deal.rate), [0.45, 0.45, 0.50]);
  assert.deepEqual(Array.from(c.deals, (deal) => deal.rate), [0.45, 0.50]);

  const above = context.calculateAgent(packagedAgent('d', 'premium', [100000], {
    dealManualRates: [75]
  }));
  const below = context.calculateAgent(packagedAgent('e', 'premium', [100000], {
    dealManualRates: [50]
  }));
  assert.equal(above.deals[0].rate, 0.75);
  assert.equal(below.deals[0].rate, 0.60);
});

test('referral is charged once and agent-paid benefits never reduce office result', () => {
  const agent = packagedAgent('referral', 'premiumPlus', [200000, 200000], { introduced: true });
  const result = calculateLedgerOffice({ agents: [agent], expenses: [], ownerSales: 0 });
  assert.equal(result.referrals, 10000);
  assert.equal(result.agents[0].motivationAgentCost, 32000);
  close(result.resultWithoutOwner, 400000 - result.agentPayouts - 10000 - result.motivationReserves - result.royaltyWithoutOwner);
  close(result.agentEconomics[0].contribution, result.resultWithoutOwner);
});

test('partnership threshold controls benefits but never cancels package floor', () => {
  [249999, 250000, 250001].forEach((deposits) => {
    const result = context.calculateAgent(packagedAgent(`threshold-${deposits}`, 'premium', [100000], {
      quarterlyDeposits: deposits
    }));
    assert.equal(result.deals[0].rate, 0.60);
    assert.equal(result.careerIntegration.benefits.partnershipConfirmed, deposits >= 250000);
  });
});

test('individual advertising is 3 percent with a 15000 cap', () => {
  const expected = [0, 3000, 9000, 15000, 15000];
  [0, 100000, 300000, 500000, 800000].forEach((deposits, index) => {
    const integration = context.MotivationCalculator2026.buildIntegration({
      careerPackageId: 'individual',
      quarterlyDeposits: 300000,
      careerPreviousMonthDeposits: deposits
    }, 'individual');
    const advertising = integration.benefits.items.find((item) => item.id === 'leadGeneration');
    assert.equal(advertising.officeCost, expected[index]);
  });
});

process.exitCode = failed ? 1 : 0;
