'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const PROJECT = path.resolve(__dirname, '../../../pub/domian-calculator-a4');

/*
 * Независимый oracle.
 *
 * Он не импортирует и не вызывает production-функции для получения ожидаемых
 * значений. Константы ниже перенесены из нормативного DOCX и утверждённой
 * старой логики A4. Production загружается отдельно только для сравнения
 * фактического результата с oracle.
 */
const ORACLE = Object.freeze({
  qualifyingThreshold: 50_000,
  referralRate: 0.025,
  partnerScale: [45, 50, 55, 60, 65, 70, 80],
  traineeScale: [30, 35, 40],
  packages: {
    newcomer: { label: 'Новичок', status: 'trainee', floor: 30, max: 40 },
    standard: { label: 'Стандарт', status: 'partner', floor: 45, max: 80 },
    extended: { label: 'Расширенный', status: 'partner', floor: 50, max: 80 },
    advanced: { label: 'Продвинутый', status: 'partner', floor: 55, max: 80 },
    premium: { label: 'Премиум', status: 'partner', floor: 60, max: 80 },
    premiumPlus: { label: 'Премиум +', status: 'partner', floor: 65, max: 80 },
    individual: { label: 'Индивидуальный', status: 'partner', floor: 70, max: 80 }
  },
  royaltyBands: [
    { limit: 500_000, rate: 0.07 },
    { limit: 750_000, rate: 0.065 },
    { limit: 1_000_000, rate: 0.06 },
    { limit: 1_500_000, rate: 0.055 },
    { limit: 2_000_000, rate: 0.05 },
    { limit: 2_500_000, rate: 0.045 },
    { limit: 3_000_000, rate: 0.04 },
    { limit: 4_000_000, rate: 0.035 },
    { limit: Infinity, rate: 0.03 }
  ],
  stipendBands: [
    { threshold: 250_000, stipend: 0 },
    { threshold: 400_000, stipend: 0 },
    { threshold: 600_000, stipend: 3_000 },
    { threshold: 800_000, stipend: 4_000 },
    { threshold: 1_000_000, stipend: 5_000 },
    { threshold: 1_200_000, stipend: 6_000 },
    { threshold: 1_500_000, stipend: 7_000 }
  ],
  halfYearBands: [
    { threshold: 500_000, level: 1 },
    { threshold: 800_000, level: 2 },
    { threshold: 1_200_000, level: 3 },
    { threshold: 1_600_000, level: 4 },
    { threshold: 2_000_000, level: 5 },
    { threshold: 2_400_000, level: 6 },
    { threshold: 3_000_000, level: 7 }
  ]
});

function oracleRoyalty(turnover) {
  const amount = Math.max(0, Number(turnover) || 0);
  const band = ORACLE.royaltyBands.find((candidate) => amount < candidate.limit);
  return Math.round(amount * band.rate * 100) / 100;
}

function oracleStipend(quarterlyCommission) {
  const amount = Math.max(0, Number(quarterlyCommission) || 0);
  let stipend = 0;
  for (const band of ORACLE.stipendBands) {
    if (amount >= band.threshold) stipend = band.stipend;
  }
  return stipend;
}

function oracleHalfYearLevel(halfYearCommission) {
  const amount = Math.max(0, Number(halfYearCommission) || 0);
  let level = 0;
  for (const band of ORACLE.halfYearBands) {
    if (amount >= band.threshold) level = band.level;
  }
  return level;
}

function oracleDeals(config) {
  const packageRule = ORACLE.packages[config.packageId];
  const deals = config.deals.map((amount, index) => ({
    amount: Math.max(0, Number(amount) || 0),
    manualRate: config.manualRates && config.manualRates[index] !== ''
      && config.manualRates[index] !== null
      && config.manualRates[index] !== undefined
      ? Math.min(100, Math.max(0, Number(config.manualRates[index]) || 0))
      : null,
    newbuildSolo: Boolean(config.newbuildSolo && config.newbuildSolo[index])
  }));
  let qualifiedCount = 0;

  return deals.map((deal) => {
    const qualifies = deal.amount >= ORACLE.qualifyingThreshold || deal.newbuildSolo;
    let baseRate;
    let rate;

    if (config.fixedRate !== null && config.fixedRate !== undefined) {
      rate = Math.min(100, Math.max(0, Number(config.fixedRate) || 0));
    } else {
      if (!qualifies) {
        baseRate = packageRule.status === 'trainee'
          ? ORACLE.traineeScale[0]
          : ORACLE.partnerScale[0];
      } else if (packageRule.status === 'trainee') {
        baseRate = ORACLE.traineeScale[Math.min(qualifiedCount, ORACLE.traineeScale.length - 1)];
      } else {
        baseRate = ORACLE.partnerScale[Math.min(qualifiedCount, ORACLE.partnerScale.length - 1)];
      }

      /*
       * DOCX задаёт для Новичка диапазон 30–40%, поэтому oracle не позволяет
       * автоматической шкале выйти выше package max.
       */
      baseRate = Math.min(baseRate, packageRule.max);
      rate = deal.manualRate === null ? baseRate : deal.manualRate;
      rate = Math.max(rate, packageRule.floor, Number(config.contractualFloor) || 0);
      rate = Math.min(rate, packageRule.max);
    }

    if (qualifies) qualifiedCount += 1;
    return {
      amount: deal.amount,
      qualifies,
      rate,
      payout: deal.amount * rate / 100
    };
  });
}

function oracleBenefits(config) {
  const packageId = config.packageId;
  const partnerConfirmed = packageId !== 'newcomer' && config.quarterDeposits >= 250_000;
  const halfYearLevel = oracleHalfYearLevel(config.halfYearCommission);
  const stipendPayer = ['standard', 'extended'].includes(packageId) ? 'office' : 'none';
  const mountainPayer = ['standard', 'extended', 'advanced', 'premium'].includes(packageId)
    ? 'office'
    : (['premiumPlus', 'individual'].includes(packageId) ? 'agent' : 'none');
  const travelPayer = ['standard', 'extended', 'advanced'].includes(packageId)
    ? 'office'
    : (['premium', 'premiumPlus', 'individual'].includes(packageId) ? 'agent' : 'none');
  const corporatePayer = ['standard', 'extended', 'advanced', 'premium', 'premiumPlus'].includes(packageId)
    ? 'office'
    : (packageId === 'individual' ? 'agent' : 'none');
  const stipendAvailable = partnerConfirmed
    && stipendPayer !== 'none'
    && oracleStipend(config.quarterlyCommission) > 0;
  const mountainAvailable = partnerConfirmed
    && mountainPayer !== 'none'
    && config.officePlanCompleted
    && config.agentParticipated;
  const travelAvailable = partnerConfirmed
    && travelPayer !== 'none'
    && halfYearLevel >= 4
    && config.travelQuarterPartnershipConfirmed;
  const corporateAvailable = partnerConfirmed && corporatePayer !== 'none';
  const advertising = packageId === 'individual' && partnerConfirmed
    ? Math.min(Math.max(0, config.previousMonthDeposits) * 0.03, 15_000)
    : 0;

  const items = {
    leadGeneration: {
      available: packageId === 'newcomer' || partnerConfirmed,
      payer: packageId === 'newcomer' || partnerConfirmed ? 'office' : 'none',
      officeCost: advertising,
      agentCost: 0
    },
    stipend: {
      available: stipendAvailable,
      payer: stipendAvailable ? stipendPayer : 'none',
      officeCost: stipendAvailable ? oracleStipend(config.quarterlyCommission) : 0,
      agentCost: 0
    },
    mountainSea: {
      available: mountainAvailable,
      payer: mountainAvailable ? mountainPayer : 'none',
      officeCost: mountainAvailable && mountainPayer === 'office' ? config.mountainSeaCost : 0,
      agentCost: mountainAvailable && mountainPayer === 'agent' ? config.mountainSeaCost : 0
    },
    travel: {
      available: travelAvailable,
      payer: travelAvailable ? travelPayer : 'none',
      officeCost: travelAvailable && travelPayer === 'office' ? config.travelCost : 0,
      agentCost: travelAvailable && travelPayer === 'agent' ? config.travelCost : 0
    },
    corporate: {
      available: corporateAvailable,
      payer: corporateAvailable ? corporatePayer : 'none',
      officeCost: corporateAvailable && corporatePayer === 'office' ? config.corporateCost : 0,
      agentCost: corporateAvailable && corporatePayer === 'agent' ? config.corporateCost : 0
    }
  };

  return {
    items,
    officeCostTotal: Object.values(items).reduce((sum, item) => sum + item.officeCost, 0),
    agentCostTotal: Object.values(items).reduce((sum, item) => sum + item.agentCost, 0)
  };
}

function oracleOffice(config) {
  const agentTurnover = config.agents.reduce((sum, agent) => sum + agent.commission, 0);
  const payouts = config.agents.reduce((sum, agent) => sum + agent.payout, 0);
  const referrals = config.agents.reduce((sum, agent) => sum + agent.referral, 0);
  const motivation = config.agents.reduce((sum, agent) => sum + agent.officeMotivation, 0);
  const totalTurnover = agentTurnover + config.ownerSales;
  return {
    agentTurnover,
    totalTurnover,
    payouts,
    referrals,
    motivation,
    royaltyWithoutOwner: oracleRoyalty(agentTurnover),
    royaltyWithOwner: oracleRoyalty(totalTurnover),
    resultWithoutOwner: agentTurnover
      - payouts
      - referrals
      - motivation
      - oracleRoyalty(agentTurnover)
      - config.officeExpenses,
    resultWithOwner: totalTurnover
      - payouts
      - referrals
      - motivation
      - oracleRoyalty(totalTurnover)
      - config.officeExpenses
  };
}

function loadProduction() {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    window: null
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  [
    'assets/js/constants.js',
    'assets/js/calculations.js',
    'assets/js/policies/motivation-policy-2026.js',
    'assets/js/domain/benefit-engine.js',
    'assets/js/domain/motivation-calculator-engine.js'
  ].forEach((relativePath) => {
    vm.runInContext(
      fs.readFileSync(path.join(PROJECT, relativePath), 'utf8'),
      context,
      { filename: relativePath }
    );
  });
  return context;
}

const production = loadProduction();

function productionAgent(config) {
  const packageRule = ORACLE.packages[config.packageId];
  const agent = {
    id: 'oracle-agent',
    name: 'Oracle',
    status: packageRule.status,
    paymentType: config.fixedRate === null || config.fixedRate === undefined ? 'standard' : 'fixed',
    fixedRate: config.fixedRate,
    commissionMode: 'exact',
    dealsInput: config.deals,
    dealManualRates: config.manualRates || config.deals.map(() => ''),
    dealNewbuildSoloFlags: config.newbuildSolo || config.deals.map(() => false),
    dealDepositOrders: config.deals.map(() => ''),
    packageFloorRate: packageRule.floor,
    contractualFloorRate: config.contractualFloor || 0,
    introduced: Boolean(config.introduced),
    motivation: { stipendMode: 'off' }
  };
  return production.calculateAgent(agent);
}

test('матрица A: семь сделок по 100 000 ₽ — ставка каждой строки по всем пакетам', () => {
  for (const packageId of Object.keys(ORACLE.packages)) {
    const config = {
      packageId,
      deals: Array(7).fill(100_000),
      fixedRate: null
    };
    const expected = oracleDeals(config).map((deal) => deal.rate);
    const actual = Array.from(
      productionAgent(config).deals,
      (deal) => Math.round(deal.rate * 100_000_000) / 1_000_000
    );
    assert.deepEqual(actual, expected, packageId);
  }
});

test('матрица B: маленькая сделка не двигает шкалу; следующая получает первый слот', () => {
  for (const packageId of Object.keys(ORACLE.packages)) {
    const config = {
      packageId,
      deals: [30_000, 100_000, 100_000],
      fixedRate: null
    };
    const expected = oracleDeals(config).map((deal) => deal.rate);
    const actual = Array.from(
      productionAgent(config).deals,
      (deal) => Math.round(deal.rate * 100_000_000) / 1_000_000
    );
    assert.deepEqual(actual, expected, packageId);
  }
});

test('матрица C: новостройка 1 ₽ квалифицируется и двигает следующую сделку', () => {
  for (const packageId of Object.keys(ORACLE.packages)) {
    const config = {
      packageId,
      deals: [100_000, 1, 100_000],
      newbuildSolo: [false, true, false],
      fixedRate: null
    };
    const expected = oracleDeals(config).map((deal) => deal.rate);
    const actualAgent = productionAgent(config);
    assert.deepEqual(
      Array.from(
        actualAgent.deals,
        (deal) => Math.round(deal.rate * 100_000_000) / 1_000_000
      ),
      expected,
      packageId
    );
    assert.equal(actualAgent.deals[1].isQualifiedDeposit, true, packageId);
    assert.equal(actualAgent.deals[1].depositOrderApplied, 2, packageId);
  }
});

test('матрица D (утверждённая часть): ручной процент выше и равный floor сохраняется', () => {
  for (const packageId of Object.keys(ORACLE.packages).filter((id) => id !== 'individual')) {
    const floor = ORACLE.packages[packageId].floor;
    for (const manualRate of [floor, Math.min(ORACLE.packages[packageId].max, floor + 5)]) {
      const config = {
        packageId,
        deals: [100_000],
        manualRates: [manualRate],
        fixedRate: null
      };
      const expected = oracleDeals(config)[0].rate;
      const actual = Math.round(productionAgent(config).deals[0].rate * 100_000_000) / 1_000_000;
      assert.equal(actual, expected, `${packageId} / ${manualRate}%`);
    }
  }
});

test('матрица E: фикс 70/80/90 имеет приоритет над package floor и ручным процентом', () => {
  for (const packageId of Object.keys(ORACLE.packages)) {
    for (const fixedRate of [70, 80, 90]) {
      const config = {
        packageId,
        deals: [100_000],
        manualRates: [12],
        fixedRate
      };
      const expected = oracleDeals(config)[0].rate;
      const actual = productionAgent(config).deals[0].rate * 100;
      assert.equal(actual, expected, `${packageId} / ${fixedRate}%`);
    }
  }
});

test('реферал 2,5% считается отдельно и не входит в выплату агенту', () => {
  const config = {
    packageId: 'standard',
    deals: [400_000],
    fixedRate: null,
    introduced: true
  };
  const actual = productionAgent(config);
  assert.equal(actual.referral, 10_000);
  assert.equal(actual.payout, oracleDeals(config)[0].payout);
});

test('границы роялти совпадают с независимой тарифной сеткой', () => {
  const boundaries = [
    0, 499_999.99, 500_000, 749_999.99, 750_000, 999_999.99,
    1_000_000, 1_499_999.99, 1_500_000, 1_999_999.99, 2_000_000,
    2_499_999.99, 2_500_000, 2_999_999.99, 3_000_000,
    3_999_999.99, 4_000_000
  ];
  for (const turnover of boundaries) {
    assert.equal(production.calculateRoyalty(turnover), oracleRoyalty(turnover), String(turnover));
  }
});

test('стипендия: все обязательные границы и отсутствие начиная с Продвинутого', () => {
  const boundaries = [
    249_999, 250_000, 399_999, 400_000, 599_999, 600_000, 799_999,
    800_000, 999_999, 1_000_000, 1_199_999, 1_200_000, 1_499_999, 1_500_000
  ];
  for (const packageId of Object.keys(ORACLE.packages)) {
    for (const quarterlyCommission of boundaries) {
      const input = {
        decision: { effectivePackage: packageId },
        quarterDeposits: 250_000,
        quarterlyCommission,
        previousMonthDeposits: 0,
        halfYearLevel: 4,
        officePlanCompleted: true,
        agentParticipated: true,
        travelQuarterPartnershipConfirmed: true,
        mountainSeaCost: 15_000,
        travelCost: 100_000,
        corporateCost: 20_000
      };
      const actual = production.BenefitEngine.calculateBenefits(input);
      const stipend = actual.items.find((item) => item.id === 'stipend');
      const expectedAvailable = ['standard', 'extended'].includes(packageId)
        && oracleStipend(quarterlyCommission) > 0;
      assert.equal(stipend.available, expectedAvailable, `${packageId}/${quarterlyCommission}`);
      assert.equal(
        stipend.officeCost,
        expectedAvailable ? oracleStipend(quarterlyCommission) : 0,
        `${packageId}/${quarterlyCommission}`
      );
    }
  }
});

test('матрица мотиваций: право, плательщик и расходы офиса/агента по 7 пакетам', () => {
  for (const packageId of Object.keys(ORACLE.packages)) {
    const config = {
      packageId,
      quarterDeposits: packageId === 'newcomer' ? 0 : 250_000,
      quarterlyCommission: 1_500_000,
      previousMonthDeposits: 500_000,
      halfYearCommission: 1_600_000,
      officePlanCompleted: true,
      agentParticipated: true,
      travelQuarterPartnershipConfirmed: true,
      mountainSeaCost: 15_000,
      travelCost: 100_000,
      corporateCost: 20_000
    };
    const expected = oracleBenefits(config);
    const actual = production.BenefitEngine.calculateBenefits({
      decision: { effectivePackage: packageId },
      quarterDeposits: config.quarterDeposits,
      quarterlyCommission: config.quarterlyCommission,
      previousMonthDeposits: config.previousMonthDeposits,
      halfYearLevel: oracleHalfYearLevel(config.halfYearCommission),
      officePlanCompleted: config.officePlanCompleted,
      agentParticipated: config.agentParticipated,
      travelQuarterPartnershipConfirmed: config.travelQuarterPartnershipConfirmed,
      mountainSeaCost: config.mountainSeaCost,
      travelCost: config.travelCost,
      corporateCost: config.corporateCost
    });
    for (const item of actual.items) {
      const expectedItem = expected.items[item.id];
      assert.equal(item.available, expectedItem.available, `${packageId}/${item.id}/available`);
      assert.equal(item.payer, expectedItem.payer, `${packageId}/${item.id}/payer`);
      assert.equal(item.officeCost, expectedItem.officeCost, `${packageId}/${item.id}/office`);
      assert.equal(item.agentCost, expectedItem.agentCost, `${packageId}/${item.id}/agent`);
    }
    assert.equal(actual.officeCostTotal, expected.officeCostTotal, `${packageId}/officeTotal`);
    assert.equal(actual.agentCostTotal, expected.agentCostTotal, `${packageId}/agentTotal`);
  }
});

test('условия мотиваций проверяют все границы партнёрства и все булевы флаги', () => {
  for (const quarterDeposits of [249_999, 250_000, 250_001]) {
    for (const officePlanCompleted of [false, true]) {
      for (const agentParticipated of [false, true]) {
        for (const travelQuarterPartnershipConfirmed of [false, true]) {
          for (const halfYearCommission of [1_599_999, 1_600_000, 1_600_001]) {
            const config = {
              packageId: 'standard',
              quarterDeposits,
              quarterlyCommission: 1_500_000,
              previousMonthDeposits: 0,
              halfYearCommission,
              officePlanCompleted,
              agentParticipated,
              travelQuarterPartnershipConfirmed,
              mountainSeaCost: 15_000,
              travelCost: 100_000,
              corporateCost: 20_000
            };
            const expected = oracleBenefits(config);
            const actual = production.BenefitEngine.calculateBenefits({
              decision: { effectivePackage: 'standard' },
              quarterDeposits,
              quarterlyCommission: config.quarterlyCommission,
              previousMonthDeposits: 0,
              halfYearLevel: oracleHalfYearLevel(halfYearCommission),
              officePlanCompleted,
              agentParticipated,
              travelQuarterPartnershipConfirmed,
              mountainSeaCost: config.mountainSeaCost,
              travelCost: config.travelCost,
              corporateCost: config.corporateCost
            });
            for (const item of actual.items) {
              assert.deepEqual(
                {
                  available: item.available,
                  payer: item.payer,
                  officeCost: item.officeCost,
                  agentCost: item.agentCost
                },
                expected.items[item.id],
                JSON.stringify({
                  quarterDeposits,
                  officePlanCompleted,
                  agentParticipated,
                  travelQuarterPartnershipConfirmed,
                  halfYearCommission,
                  item: item.id
                })
              );
            }
          }
        }
      }
    }
  }
});

test('индивидуальная реклама: 3% предыдущего месяца и cap 15 000 ₽', () => {
  for (const previousMonthDeposits of [0, 100_000, 300_000, 499_999, 500_000, 800_000]) {
    const actual = production.BenefitEngine.calculateBenefits({
      decision: { effectivePackage: 'individual' },
      quarterDeposits: 250_000,
      previousMonthDeposits,
      quarterlyCommission: 0,
      halfYearLevel: 0
    });
    const advertising = actual.items.find((item) => item.id === 'leadGeneration');
    assert.equal(
      advertising.officeCost,
      Math.min(previousMonthDeposits * 0.03, 15_000),
      String(previousMonthDeposits)
    );
  }
});

test('итог офиса независимо совпадает для трёх агентов и собственника', () => {
  const agentsInput = [
    { id: 'a', packageId: 'standard', deals: [100_000], introduced: false },
    { id: 'b', packageId: 'premium', deals: [200_000], introduced: true },
    { id: 'c', packageId: 'individual', deals: [300_000], introduced: false }
  ];
  const productionAgents = agentsInput.map((input) => productionAgent({
    ...input,
    fixedRate: null
  }));
  const expectedAgents = agentsInput.map((input) => {
    const deals = oracleDeals({ ...input, fixedRate: null });
    const commission = input.deals.reduce((sum, amount) => sum + amount, 0);
    return {
      commission,
      payout: deals.reduce((sum, deal) => sum + deal.payout, 0),
      referral: input.introduced ? commission * ORACLE.referralRate : 0,
      officeMotivation: 0
    };
  });
  const expected = oracleOffice({
    agents: expectedAgents,
    ownerSales: 500_000,
    officeExpenses: 50_000
  });
  const actual = production.calculateOffice({
    agents: productionAgents.map((agent, index) => ({
      ...agentsInput[index],
      id: agentsInput[index].id,
      name: agentsInput[index].id,
      status: ORACLE.packages[agentsInput[index].packageId].status,
      paymentType: 'standard',
      commissionMode: 'exact',
      dealsInput: agentsInput[index].deals,
      dealManualRates: [''],
      dealNewbuildSoloFlags: [false],
      packageFloorRate: ORACLE.packages[agentsInput[index].packageId].floor,
      introduced: agentsInput[index].introduced,
      careerIntegration: {
        effectivePackage: agentsInput[index].packageId,
        motivationReserveMonthly: 0,
        motivationCosts: []
      },
      motivation: { stipendMode: 'off' }
    })),
    ownerSales: 500_000,
    expenses: [{ id: 'rent', name: 'Аренда', amount: 50_000 }]
  });

  assert.equal(actual.agentTurnover, expected.agentTurnover);
  assert.equal(actual.totalTurnover, expected.totalTurnover);
  assert.equal(actual.agentPayouts, expected.payouts);
  assert.equal(actual.referrals, expected.referrals);
  assert.equal(actual.royaltyWithoutOwner, expected.royaltyWithoutOwner);
  assert.equal(actual.royaltyWithOwner, expected.royaltyWithOwner);
  assert.equal(actual.resultWithoutOwner, expected.resultWithoutOwner);
  assert.equal(actual.resultWithOwner, expected.resultWithOwner);
});

test('таблица сравнения обязана сохранять исходный статус агента во всех 7 строках', () => {
  const source = {
    id: 'same-status-agent',
    status: 'partner',
    paymentType: 'standard',
    commissionMode: 'exact',
    dealsInput: [100_000],
    dealManualRates: [''],
    dealNewbuildSoloFlags: [false],
    motivation: { stipendMode: 'off' }
  };
  for (const packageId of Object.keys(ORACLE.packages)) {
    const applied = production.MotivationCalculator2026.applyPackage(source, packageId);
    assert.equal(applied.status, source.status, packageId);
  }
});
