'use strict';

function positiveNumber(value) {
  var number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return number;
}

function money(value) {
  var number = Number(value);
  if (!Number.isFinite(number)) {
    number = 0;
  }
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0
  }).format(Math.round(number)) + ' ₽';
}

function moneyPrecise(value) {
  var number = Number(value);
  if (!Number.isFinite(number)) {
    number = 0;
  }
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number) + ' ₽';
}

function percent(value) {
  return (Number(value) * 100).toLocaleString('ru-RU', {
    maximumFractionDigits: 2
  }) + '%';
}

function getRoyaltyRate(turnover) {
  var amount = positiveNumber(turnover);
  var rate = ROYALTY_RATES.find(function (item) {
    return amount >= item.min && amount < item.max;
  });
  return rate ? rate.rate : 0;
}

function calculateRoyalty(turnover) {
  return positiveNumber(turnover) * getRoyaltyRate(turnover);
}

function getDealRate(agent, dealIndex) {
  if (agent.paymentType === 'fixed') {
    return positiveNumber(agent.fixedRate) / 100;
  }

  if (agent.paymentType === 'boosted') {
    var boostedRates = Array.isArray(agent.boostedRates) && agent.boostedRates.length
      ? agent.boostedRates
      : PAY_SCALES.boostedDefault;
    var boostedIndex = Math.min(dealIndex, boostedRates.length - 1);
    return positiveNumber(boostedRates[boostedIndex]) / 100;
  }

  var scale = agent.status === 'trainee' ? PAY_SCALES.trainee : PAY_SCALES.partner;
  var scaleIndex = Math.min(dealIndex, scale.length - 1);
  return scale[scaleIndex];
}

function getAgentDeals(agent) {
  if (agent.commissionMode === 'exact') {
    var exactDeals = Array.isArray(agent.dealsInput) && agent.dealsInput.length
      ? agent.dealsInput.map(positiveNumber)
      : [0];
    return exactDeals;
  }

  var count = Math.max(1, Math.floor(positiveNumber(agent.dealCount) || 1));
  var amount = positiveNumber(agent.commission) / count;
  var deals = [];
  for (var i = 0; i < count; i += 1) {
    deals.push(amount);
  }
  return deals;
}

function getStipendByQuarter(quarterlyCommission) {
  var amount = positiveNumber(quarterlyCommission);
  var level = STIPEND_LEVELS.find(function (item) {
    return amount >= item.min;
  });
  return level || { min: 0, level: 0, monthly: 0 };
}

function isSpecialTermsAgent(agent) {
  return agent.paymentType === 'fixed' || agent.paymentType === 'boosted';
}

function canUsePartnerMotivations(agent) {
  if (isSpecialTermsAgent(agent) && !agent.specialTermsOverride && !agent.motivationOverride) {
    return false;
  }
  return positiveNumber(agent.quarterlyDeposits) >= PARTNERSHIP_DEPOSIT_MIN;
}

function calculateMotivationReserve(agent) {
  var motivation = Object.assign({}, DEFAULT_MOTIVATION, agent.motivation || {});
  var specialBlocked = isSpecialTermsAgent(agent) && !agent.specialTermsOverride && !agent.motivationOverride;
  var partnershipConfirmed = positiveNumber(agent.quarterlyDeposits) >= PARTNERSHIP_DEPOSIT_MIN;
  var stipendInfo = getStipendByQuarter(agent.quarterlyCommission);
  var stipendAvailable = !specialBlocked && partnershipConfirmed && stipendInfo.monthly > 0;
  var stipendOverride = Boolean(agent.stipendOverride || agent.motivationOverride);
  var stipendMonthly = 0;

  if (motivation.stipendMode === 'manual') {
    stipendMonthly = (stipendAvailable || stipendOverride) ? positiveNumber(motivation.manualStipendMonthly) : 0;
  } else if (motivation.stipendMode === 'auto') {
    stipendMonthly = (stipendAvailable || stipendOverride) ? stipendInfo.monthly : 0;
  }

  var domesticAvailable = !specialBlocked && partnershipConfirmed;
  var domesticOverride = Boolean(agent.travelOverride || agent.motivationOverride);
  var travelAvailable = domesticAvailable
    && positiveNumber(agent.halfYearCommission) >= TRAVEL_HALF_YEAR_MIN
    && positiveNumber(agent.preTripQuarterDeposits) >= PARTNERSHIP_DEPOSIT_MIN;
  var travelOverride = Boolean(agent.travelOverride || agent.motivationOverride);
  var corporateAvailable = !specialBlocked && partnershipConfirmed;
  var corporateOverride = Boolean(agent.eventsOverride || agent.motivationOverride);

  var mountainSeaAnnual = motivation.mountainSeaEnabled && (domesticAvailable || domesticOverride)
    ? positiveNumber(motivation.mountainSeaPerTrip) * positiveNumber(motivation.mountainSeaTripsPerYear)
    : 0;
  var travelAnnual = motivation.travelEnabled && (travelAvailable || travelOverride)
    ? positiveNumber(motivation.travelPerTrip) * positiveNumber(motivation.travelTripsPerYear)
    : 0;
  var corporateAnnual = motivation.corporateEnabled && (corporateAvailable || corporateOverride)
    ? positiveNumber(motivation.corporatePerYear)
    : 0;

  var congressAnnual = motivation.congressEnabled ? positiveNumber(motivation.congressPerYear) : 0;
  var starAnnual = motivation.starEnabled ? positiveNumber(motivation.starPerYear) : 0;
  var totalAnnual = mountainSeaAnnual + travelAnnual + corporateAnnual + congressAnnual + starAnnual;
  var annualReserveMonthly = 0;

  if (motivation.annualReserveMode === 'full') {
    annualReserveMonthly = totalAnnual;
  } else if (motivation.annualReserveMode === 'manual') {
    annualReserveMonthly = positiveNumber(motivation.manualAnnualReserveMonthly);
  } else {
    annualReserveMonthly = totalAnnual / 12;
  }

  return {
    partnershipConfirmed: partnershipConfirmed,
    specialBlocked: specialBlocked,
    stipendLevel: stipendInfo.level,
    stipendAvailable: stipendAvailable,
    stipendReason: specialBlocked ? 'specialTerms' : (partnershipConfirmed ? 'level' : 'partnership'),
    stipendOverride: stipendOverride,
    stipendMonthly: stipendMonthly,
    mountainSeaAvailable: domesticAvailable,
    mountainSeaReason: specialBlocked ? 'specialTerms' : 'partnership',
    mountainSeaAnnual: mountainSeaAnnual,
    mountainSeaMonthly: motivation.annualReserveMode === 'full' ? mountainSeaAnnual : mountainSeaAnnual / 12,
    travelAvailable: travelAvailable,
    travelReason: specialBlocked ? 'specialTerms' : (positiveNumber(agent.halfYearCommission) < TRAVEL_HALF_YEAR_MIN ? 'halfYearLevel' : 'preTripDeposits'),
    travelAnnual: travelAnnual,
    travelMonthly: motivation.annualReserveMode === 'full' ? travelAnnual : travelAnnual / 12,
    corporateAvailable: corporateAvailable,
    corporateReason: specialBlocked ? 'specialTerms' : 'partnership',
    corporateAnnual: corporateAnnual,
    corporateMonthly: motivation.annualReserveMode === 'full' ? corporateAnnual : corporateAnnual / 12,
    congressAnnual: congressAnnual,
    congressMonthly: motivation.annualReserveMode === 'full' ? congressAnnual : congressAnnual / 12,
    starAnnual: starAnnual,
    starMonthly: motivation.annualReserveMode === 'full' ? starAnnual : starAnnual / 12,
    annualTotal: totalAnnual,
    annualReserveMonthly: annualReserveMonthly,
    totalMonthly: stipendMonthly + annualReserveMonthly
  };
}

function calculateAgent(agent) {
  var deals = getAgentDeals(agent);
  var commission = deals.reduce(function (sum, deal) {
    return sum + positiveNumber(deal);
  }, 0);
  var payout = deals.reduce(function (sum, deal, index) {
    return sum + positiveNumber(deal) * getDealRate(agent, index);
  }, 0);
  var referral = agent.introduced ? commission * REFERRAL_RATE : 0;
  var motivationReserve = calculateMotivationReserve(agent).totalMonthly;

  return {
    id: agent.id,
    name: agent.name,
    commission: commission,
    dealCount: deals.length,
    payout: payout,
    referral: referral,
    motivationReserve: motivationReserve,
    officeBeforeRoyaltyAndReserve: commission - payout - referral - motivationReserve
  };
}

function calculateAgentEconomics(state, totalsBase) {
  var agents = totalsBase.agents;
  var ordinaryAgents = agents.length;
  var expenseShare = ordinaryAgents ? totalsBase.expenses / ordinaryAgents : 0;
  var royaltyWithoutOwner = totalsBase.royaltyWithoutOwner;
  var agentTurnover = totalsBase.agentTurnover;

  return agents.map(function (agent) {
    var royaltyShare = agentTurnover > 0 ? royaltyWithoutOwner * (agent.commission / agentTurnover) : 0;
    var contribution = agent.commission
      - agent.payout
      - agent.referral
      - agent.motivationReserve
      - royaltyShare
      - expenseShare;
    var status = 'Окупается';
    if (contribution < -CONTRIBUTION_EDGE) {
      status = 'Не окупается';
    } else if (contribution <= CONTRIBUTION_EDGE) {
      status = 'На грани';
    }
    return Object.assign({}, agent, {
      royaltyShare: royaltyShare,
      expenseShare: expenseShare,
      contribution: contribution,
      status: status
    });
  });
}

function calculateOffice(state) {
  var expenses = (state.expenses || []).reduce(function (sum, expense) {
    return sum + positiveNumber(expense.amount);
  }, 0);
  var agents = (state.agents || []).map(calculateAgent);
  var agentTurnover = agents.reduce(function (sum, agent) {
    return sum + agent.commission;
  }, 0);
  var ownerSales = positiveNumber(state.ownerSales);
  var totalTurnover = agentTurnover + ownerSales;
  var agentPayouts = agents.reduce(function (sum, agent) {
    return sum + agent.payout;
  }, 0);
  var referrals = agents.reduce(function (sum, agent) {
    return sum + agent.referral;
  }, 0);
  var motivationReserves = agents.reduce(function (sum, agent) {
    return sum + agent.motivationReserve;
  }, 0);
  var royaltyWithoutOwner = calculateRoyalty(agentTurnover);
  var royaltyWithOwner = calculateRoyalty(totalTurnover);

  var resultWithoutOwnerBeforeReserves = agentTurnover - agentPayouts - referrals - royaltyWithoutOwner - expenses;
  var resultWithoutOwner = resultWithoutOwnerBeforeReserves - motivationReserves;
  var resultWithOwnerBeforeReserves = totalTurnover - agentPayouts - referrals - royaltyWithOwner - expenses;
  var resultWithOwner = resultWithOwnerBeforeReserves - motivationReserves;

  var totalsBase = {
    expenses: expenses,
    agents: agents,
    agentTurnover: agentTurnover,
    ownerSales: ownerSales,
    totalTurnover: totalTurnover,
    agentPayouts: agentPayouts,
    referrals: referrals,
    motivationReserves: motivationReserves,
    royaltyWithoutOwner: royaltyWithoutOwner,
    royaltyWithOwner: royaltyWithOwner,
    resultWithoutOwnerBeforeReserves: resultWithoutOwnerBeforeReserves,
    resultWithoutOwner: resultWithoutOwner,
    resultWithOwnerBeforeReserves: resultWithOwnerBeforeReserves,
    resultWithOwner: resultWithOwner
  };

  var agentEconomics = calculateAgentEconomics(state, totalsBase);

  return Object.assign({}, totalsBase, {
    agentEconomics: agentEconomics,
    warningOwnerDependency: resultWithoutOwner < -0.5 && resultWithOwner > 0.5
  });
}

function buildSchemeAgent(config) {
  var dealCount = Math.max(1, Math.floor(positiveNumber(config.dealCount) || 1));
  var commission = positiveNumber(config.commission);
  var agent = {
    id: 'scheme-agent',
    name: 'Проверка схемы',
    commission: commission,
    dealCount: dealCount,
    commissionMode: 'quick',
    dealsInput: [],
    paymentType: 'standard',
    status: 'partner',
    boostedRates: PAY_SCALES.boostedDefault.slice(),
    fixedRate: PAY_SCALES.fixedDefault,
    introduced: Boolean(config.introduced),
    motivation: Object.assign({}, DEFAULT_MOTIVATION, { congressEnabled: false, starEnabled: false })
  };

  if (config.type === 'boosted') {
    agent.paymentType = 'boosted';
    agent.boostedRates = config.rates.slice();
  } else if (config.type === 'fixed' || config.type === 'manualFixed') {
    agent.paymentType = 'fixed';
    agent.fixedRate = config.type === 'manualFixed' ? positiveNumber(config.manualRate) : positiveNumber(config.fixedRate);
  }
  return agent;
}

function findBreakEvenCommission(baseConfig, variant) {
  var low = 0;
  var high = 10000000;
  var best = null;

  for (var i = 0; i < 36; i += 1) {
    var mid = (low + high) / 2;
    var result = calculateSchemeVariant(Object.assign({}, baseConfig, { commission: mid }), variant);
    if (result.contribution >= 0) {
      best = mid;
      high = mid;
    } else {
      low = mid;
    }
  }

  if (best === null || best >= 9999999) {
    return null;
  }
  return Math.ceil(best / 1000) * 1000;
}

function calculateSchemeVariant(baseConfig, variant) {
  var agent = buildSchemeAgent(Object.assign({}, baseConfig, variant));
  var calculated = calculateAgent(agent);
  var royalty = calculateRoyalty(calculated.commission);
  var expenseShare = positiveNumber(baseConfig.expenseShare);
  var motivationReserve = positiveNumber(baseConfig.motivationReserve);
  var beforeExpenses = calculated.commission - calculated.payout - calculated.referral - royalty - motivationReserve;
  var contribution = beforeExpenses - expenseShare;

  return {
    label: variant.type === 'manualFixed' ? 'Ручной фикс ' + positiveNumber(baseConfig.manualRate) + '%' : variant.label,
    payout: calculated.payout,
    referral: calculated.referral,
    royalty: royalty,
    beforeExpenses: beforeExpenses,
    contribution: contribution,
    breakEvenCommission: null,
    conclusion: contribution > 5000 ? 'Выдерживает' : (contribution >= -5000 ? 'На грани' : 'Убыточно')
  };
}

function comparePaymentSchemes(config) {
  var variants = SCHEME_VARIANTS.map(function (variant) {
    var result = calculateSchemeVariant(config, variant);
    result.breakEvenCommission = findBreakEvenCommission(config, variant);
    return result;
  });
  return { variants: variants };
}

if (typeof module !== 'undefined') {
  module.exports = {
    positiveNumber: positiveNumber,
    money: money,
    moneyPrecise: moneyPrecise,
    percent: percent,
    getRoyaltyRate: getRoyaltyRate,
    calculateRoyalty: calculateRoyalty,
    calculateAgent: calculateAgent,
    calculateMotivationReserve: calculateMotivationReserve,
    calculateOffice: calculateOffice,
    comparePaymentSchemes: comparePaymentSchemes
  };
}
