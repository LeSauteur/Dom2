const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', 'pub', 'domian-calculator-a4');

function load(context, relativePath) {
  const filename = path.join(projectRoot, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
}

function createContext() {
  const context = { console };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  [
    'assets/js/constants.js',
    'assets/js/policies/motivation-policy-2026.js',
    'assets/js/domain/benefit-engine.js',
    'assets/js/calculations.js',
    'assets/js/domain/motivation-calculator-engine.js'
  ].forEach((file) => load(context, file));
  return context;
}

function baseAgent(overrides = {}) {
  return {
    id: 'agent-1',
    name: 'Анна',
    commissionMode: 'exact',
    commission: 100000,
    dealCount: 1,
    dealsInput: [100000],
    dealManualRates: [''],
    dealNewbuildSoloFlags: [false],
    paymentType: 'standard',
    status: 'partner',
    introduced: false,
    careerPackageId: 'standard',
    contractualFloorRate: 0,
    quarterlyDeposits: 0,
    quarterlyCommission: 0,
    halfYearCommission: 0,
    careerPreviousMonthDeposits: 0,
    careerOfficePlanCompleted: false,
    careerAgentParticipated: false,
    travelQuarterPartnershipConfirmed: false,
    careerMountainSeaCost: 15000,
    careerTravelCost: 100000,
    careerCorporateCost: 20000,
    motivation: { mode: 'off', congressEnabled: false, starEnabled: false },
    ...overrides
  };
}

function fullyEligibleAgent(overrides = {}) {
  return baseAgent({
    quarterlyDeposits: 250000,
    quarterlyCommission: 1000000,
    halfYearCommission: 2000000,
    careerPreviousMonthDeposits: 600000,
    careerOfficePlanCompleted: true,
    careerAgentParticipated: true,
    travelQuarterPartnershipConfirmed: true,
    ...overrides
  });
}

test('каждый пакет меняет гарантированный floor', () => {
  const context = createContext();
  const expected = {
    newcomer: 30,
    standard: 45,
    extended: 50,
    advanced: 55,
    premium: 60,
    premiumPlus: 65,
    individual: 70
  };

  Object.entries(expected).forEach(([packageId, floor]) => {
    const integration = context.MotivationCalculator2026.buildIntegration(baseAgent(), packageId);
    const variant = context.MotivationCalculator2026.calculateVariant(baseAgent(), packageId, 0);
    assert.equal(integration.packageFloorRate, floor);
    assert.equal(variant.appliedRates[0], floor / 100);
  });
});

test('недоступные мотивации не попадают в расходы', () => {
  const context = createContext();
  const integration = context.MotivationCalculator2026.buildIntegration(baseAgent(), 'standard');

  assert.equal(integration.motivationReserveMonthly, 0);
  assert.equal(integration.motivationAgentCost, 0);
  assert.equal(integration.benefits.items.every((item) => item.available === false), true);
});

test('мотивации за счёт агента не уменьшают прибыль офиса', () => {
  const context = createContext();
  const agent = fullyEligibleAgent();
  const variant = context.MotivationCalculator2026.calculateVariant(agent, 'premium', 10000);
  const expectedContribution = Math.round(
    variant.commission
    - variant.payout
    - variant.referral
    - variant.officeMotivationCost
    - variant.royalty
    - variant.expenseShare
  );

  assert.equal(variant.agentMotivationCost, 100000);
  assert.equal(variant.contribution, expectedContribution);
});

test('стипендия отсутствует начиная с Продвинутого пакета', () => {
  const context = createContext();
  const integration = context.MotivationCalculator2026.buildIntegration(fullyEligibleAgent(), 'advanced');
  const stipend = integration.benefits.items.find((item) => item.id === 'stipend');

  assert.equal(stipend.available, false);
  assert.equal(stipend.officeCost, 0);
});

test('Путешествуй с Премиума оплачивает агент', () => {
  const context = createContext();
  const integration = context.MotivationCalculator2026.buildIntegration(fullyEligibleAgent(), 'premium');
  const travel = integration.benefits.items.find((item) => item.id === 'travel');

  assert.equal(travel.payer, 'agent');
  assert.equal(travel.officeCost, 0);
  assert.equal(travel.agentCost, 100000);
});

test('Горы и Море с Премиум+ оплачивает агент', () => {
  const context = createContext();
  const integration = context.MotivationCalculator2026.buildIntegration(fullyEligibleAgent(), 'premiumPlus');
  const trip = integration.benefits.items.find((item) => item.id === 'mountainSea');

  assert.equal(trip.payer, 'agent');
  assert.equal(trip.officeCost, 0);
  assert.equal(trip.agentCost, 15000);
});

test('корпоратив Индивидуального пакета оплачивает агент', () => {
  const context = createContext();
  const integration = context.MotivationCalculator2026.buildIntegration(fullyEligibleAgent(), 'individual');
  const corporate = integration.benefits.items.find((item) => item.id === 'corporate');

  assert.equal(corporate.payer, 'agent');
  assert.equal(corporate.officeCost, 0);
  assert.equal(corporate.agentCost, 20000);
});

test('реклама Индивидуального пакета равна 3% и ограничена 15 000 ₽', () => {
  const context = createContext();
  const belowCap = context.MotivationCalculator2026.buildIntegration(
    fullyEligibleAgent({ careerPreviousMonthDeposits: 300000 }),
    'individual'
  );
  const capped = context.MotivationCalculator2026.buildIntegration(
    fullyEligibleAgent({ careerPreviousMonthDeposits: 600000 }),
    'individual'
  );

  assert.equal(belowCap.benefits.items.find((item) => item.id === 'leadGeneration').officeCost, 9000);
  assert.equal(capped.benefits.items.find((item) => item.id === 'leadGeneration').officeCost, 15000);
});

test('точка окупаемости зависит от выбранного пакета', () => {
  const context = createContext();
  const agent = baseAgent();
  const standard = context.MotivationCalculator2026.findBreakEvenCommission(agent, 'standard', 50000);
  const individual = context.MotivationCalculator2026.findBreakEvenCommission(agent, 'individual', 50000);

  assert.notEqual(standard, individual);
  assert.ok(individual > standard);
});

test('сравнение пакетов сохраняет одинаковые сделки и расходы', () => {
  const context = createContext();
  const agent = fullyEligibleAgent({
    dealsInput: [60000, 140000],
    dealManualRates: ['', ''],
    dealNewbuildSoloFlags: [false, false],
    commission: 200000,
    dealCount: 2
  });
  const variants = context.MotivationCalculator2026.comparePackages(agent, 42000);

  assert.equal(variants.length, 7);
  assert.equal(new Set(variants.map((variant) => variant.commission)).size, 1);
  assert.equal(new Set(variants.map((variant) => variant.expenseShare)).size, 1);
  assert.equal(variants.every((variant) => variant.appliedRates.length === 2), true);
});
