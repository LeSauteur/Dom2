const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', 'pub', 'domian-calculator-a4');

function createContext(options = {}) {
  const values = new Map();
  const context = {
    console,
    setTimeout,
    clearTimeout,
    localStorage: options.localStorage || {
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        values.set(key, String(value));
      },
      removeItem(key) {
        values.delete(key);
      }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  return context;
}

function load(context, relativePath) {
  const filename = path.join(projectRoot, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
}

function loadCareerContext() {
  const context = createContext();
  load(context, 'assets/js/policies/motivation-policy-2026.js');
  load(context, 'assets/js/domain/career-engine.js');
  load(context, 'assets/js/domain/benefit-engine.js');
  return context;
}

function loadA4Context() {
  const context = createContext();
  load(context, 'assets/js/constants.js');
  load(context, 'assets/js/calculations.js');
  return context;
}

function baseAgent(overrides = {}) {
  return {
    id: 'agent-1',
    name: 'Агент',
    commissionMode: 'exact',
    dealsInput: [100000],
    dealManualRates: [''],
    dealNewbuildSoloFlags: [false],
    paymentType: 'standard',
    status: 'partner',
    introduced: false,
    motivation: { mode: 'off', congressEnabled: false, starEnabled: false },
    ...overrides
  };
}

test('неподтверждённое полугодие не блокирует повышение по стажу', () => {
  const context = loadCareerContext();
  const decision = context.CareerEngine.calculateDecision({
    status: 'partner',
    employmentStartDate: '2024-07-01',
    asOfDate: '2026-07-01',
    previousPerformancePackage: 'standard',
    halfYearResult: { confirmed: false, level: null }
  });

  assert.equal(decision.tenurePackage, 'advanced');
  assert.equal(decision.performancePackage, 'standard');
  assert.equal(decision.effectivePackage, 'advanced');
  assert.equal(decision.effectiveFloorRate, 55);
  assert.equal(decision.performanceStatus, 'unconfirmed');
});

test('подтверждённый высокий уровень повышает результативный пакет напрямую', () => {
  const context = loadCareerContext();
  const decision = context.CareerEngine.calculateDecision({
    status: 'partner',
    employmentStartDate: '2026-01-01',
    asOfDate: '2026-07-01',
    previousPerformancePackage: 'standard',
    halfYearResult: { confirmed: true, level: 6 }
  });

  assert.equal(decision.performancePackage, 'premiumPlus');
  assert.equal(decision.performanceAction, 'promote');
  assert.equal(decision.effectivePackage, 'premiumPlus');
});

test('низкий результат понижает performancePackage максимум на один пакет', () => {
  const context = loadCareerContext();
  const decision = context.CareerEngine.calculateDecision({
    status: 'partner',
    employmentStartDate: '2026-01-01',
    asOfDate: '2026-07-01',
    previousPerformancePackage: 'individual',
    halfYearResult: { confirmed: true, level: 2 }
  });

  assert.equal(decision.performancePackage, 'premiumPlus');
  assert.equal(decision.performanceAction, 'demote-one-step');
});

test('стажевой пакет остаётся неснижаемым при слабом результате', () => {
  const context = loadCareerContext();
  const decision = context.CareerEngine.calculateDecision({
    status: 'partner',
    employmentStartDate: '2021-01-01',
    asOfDate: '2026-07-01',
    previousPerformancePackage: 'individual',
    halfYearResult: { confirmed: true, level: 1 }
  });

  assert.equal(decision.tenurePackage, 'individual');
  assert.equal(decision.performancePackage, 'premiumPlus');
  assert.equal(decision.effectivePackage, 'individual');
  assert.equal(decision.source, 'tenure');
});

test('плательщик поездок и корпоративов зависит от пакета', () => {
  const context = loadCareerContext();
  const premiumDecision = context.CareerEngine.calculateDecision({
    status: 'partner',
    employmentStartDate: '2023-01-01',
    asOfDate: '2026-07-01',
    previousPerformancePackage: 'premium',
    halfYearResult: { confirmed: true, level: 5 }
  });
  const benefits = context.BenefitEngine.calculateBenefits({
    decision: premiumDecision,
    quarterDeposits: 250000,
    quarterlyCommission: 1000000,
    halfYearLevel: 5,
    officePlanCompleted: true,
    agentParticipated: true,
    travelQuarterPartnershipConfirmed: true,
    mountainSeaCost: 15000,
    travelCost: 100000,
    corporateCost: 20000
  });
  const byId = Object.fromEntries(benefits.items.map((item) => [item.id, item]));

  assert.equal(byId.stipend.available, false);
  assert.equal(byId.mountainSea.payer, 'office');
  assert.equal(byId.travel.payer, 'agent');
  assert.equal(byId.corporate.payer, 'office');
  assert.equal(benefits.officeCostTotal, 35000);
  assert.equal(benefits.agentCostTotal, 100000);
});

test('индивидуальная реклама ограничена 15 000 ₽', () => {
  const context = loadCareerContext();
  const benefits = context.BenefitEngine.calculateBenefits({
    decision: {
      effectivePackage: 'individual'
    },
    quarterDeposits: 250000,
    previousMonthDeposits: 600000,
    halfYearLevel: 7,
    officePlanCompleted: true,
    agentParticipated: true,
    travelQuarterPartnershipConfirmed: true,
    mountainSeaCost: 15000,
    travelCost: 100000,
    corporateCost: 20000
  });
  const byId = Object.fromEntries(benefits.items.map((item) => [item.id, item]));

  assert.equal(byId.leadGeneration.officeCost, 15000);
  assert.equal(byId.mountainSea.payer, 'agent');
  assert.equal(byId.travel.payer, 'agent');
  assert.equal(byId.corporate.payer, 'agent');
  assert.equal(benefits.officeCostTotal, 15000);
  assert.equal(benefits.agentCostTotal, 135000);
});

test('стипендия доступна стандарту с 3-го квартального уровня', () => {
  const context = loadCareerContext();
  const benefits = context.BenefitEngine.calculateBenefits({
    decision: { effectivePackage: 'standard' },
    quarterDeposits: 250000,
    quarterlyCommission: 600000,
    halfYearLevel: 3,
    officePlanCompleted: false,
    agentParticipated: false,
    travelQuarterPartnershipConfirmed: false
  });
  const stipend = benefits.items.find((item) => item.id === 'stipend');

  assert.equal(stipend.available, true);
  assert.equal(stipend.payer, 'office');
  assert.equal(stipend.officeCost, 3000);
});

test('career storage хранит стабильный профиль, решение и явное сопоставление A4', () => {
  const context = loadCareerContext();
  load(context, 'assets/js/career-storage.js');

  const profile = context.CareerStorage.saveProfile({
    id: 'career-agent-17',
    name: 'Анна',
    status: 'partner',
    employmentStartDate: '2023-01-01'
  });
  context.CareerStorage.saveDecision({
    profileId: profile.id,
    effectivePeriod: '2026-07',
    policyVersion: 'motivation-2026.1',
    result: {
      effectivePackage: 'premium',
      effectivePackageLabel: 'Премиум',
      tenurePackage: 'premium',
      performancePackage: 'advanced',
      packageFloorRate: 60,
      contractualFloorRate: 0,
      effectiveFloorRate: 60
    },
    benefits: {
      items: [{ id: 'corporate', label: 'Корпоративы', payer: 'office', officeCost: 20000 }],
      officeCostTotal: 20000,
      agentCostTotal: 0,
      officeReserveTotal: 20000
    }
  });
  context.CareerStorage.linkProfileToA4('agent-3', profile.id);

  const integration = context.CareerStorage.getA4Integration('agent-3', '', '2026-07');
  assert.equal(integration.careerProfileId, 'career-agent-17');
  assert.equal(integration.packageFloorRate, 60);
  assert.equal(integration.motivationReserveMonthly, 20000);
});

test('старый ручной процент сделки не меняется без карьерного floor', () => {
  const context = loadA4Context();
  const result = context.calculateAgent(baseAgent({
    dealManualRates: [40]
  }));

  assert.equal(result.deals[0].rate, 0.4);
});

test('карьерный floor действует на обычную, маленькую и ручную ставку', () => {
  const context = loadA4Context();
  const regular = context.calculateAgent(baseAgent({
    packageFloorRate: 60
  }));
  const small = context.calculateAgent(baseAgent({
    dealsInput: [40000],
    packageFloorRate: 60
  }));
  const manual = context.calculateAgent(baseAgent({
    packageFloorRate: 60,
    dealManualRates: [40]
  }));

  assert.equal(regular.deals[0].rate, 0.6);
  assert.equal(small.deals[0].rate, 0.6);
  assert.equal(manual.deals[0].rate, 0.6);
  assert.equal(manual.deals[0].rateSource, 'manualRateWithFloor');
});

test('фиксированный процент имеет приоритет над карьерным floor', () => {
  const context = loadA4Context();
  const result = context.calculateAgent(baseAgent({
    paymentType: 'fixed',
    fixedRate: 55,
    packageFloorRate: 70
  }));

  assert.equal(result.deals[0].rate, 0.55);
});

test('новостройка с одним агентом двигает квалифицирующую шкалу', () => {
  const context = loadA4Context();
  const result = context.calculateAgent(baseAgent({
    dealsInput: [100000, 1, 50000],
    dealManualRates: ['', '', ''],
    dealNewbuildSoloFlags: [false, true, false]
  }));

  assert.deepEqual(
    Array.from(result.deals, (deal) => deal.rate),
    [0.45, 0.5, 0.55]
  );
});

test('карьерный расход мотивации заменяет старый резерв и не задваивается', () => {
  const context = loadA4Context();
  const result = context.calculateAgent(baseAgent({
    careerIntegration: {
      effectivePackage: 'premium',
      motivationReserveMonthly: 12000,
      motivationCosts: []
    },
    motivation: {
      mode: 'manual',
      manualReserveMonthly: 50000,
      congressEnabled: false,
      starEnabled: false
    }
  }));

  assert.equal(result.motivation.source, 'career');
  assert.equal(result.motivationReserve, 12000);
});

test('career floor applies to a small deal on the boosted scale', () => {
  const context = loadA4Context();
  const result = context.calculateAgent(baseAgent({
    paymentType: 'boosted',
    dealsInput: [35000, 100000],
    dealManualRates: ['', ''],
    dealNewbuildSoloFlags: [false, false],
    packageFloorRate: 55
  }));

  assert.deepEqual(
    Array.from(result.deals, (deal) => deal.rate),
    [0.55, 0.55]
  );
});

test('trainee continues on the corresponding partner scale slot after the first three deals', () => {
  const context = loadA4Context();
  const result = context.calculateAgent(baseAgent({
    status: 'trainee',
    dealsInput: [50000, 50000, 50000, 50000, 50000, 50000],
    dealManualRates: ['', '', '', '', '', ''],
    dealNewbuildSoloFlags: [false, false, false, false, false, false]
  }));

  assert.deepEqual(
    Array.from(result.deals, (deal) => deal.rate),
    [0.3, 0.35, 0.4, 0.6, 0.65, 0.7]
  );
});
