(function () {
  'use strict';

  function toNumber(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function positiveNumber(value) {
    return Math.max(0, toNumber(value));
  }

  function positiveInteger(value, fallback) {
    var numeric = Math.floor(positiveNumber(value));
    return numeric > 0 ? numeric : fallback;
  }

  function readNumberOrFallback(agent, source, field, fallback) {
    var value = readAgentValue(agent, source, field, undefined);
    if (value === undefined || value === null || value === '') {
      return positiveNumber(fallback);
    }
    return positiveNumber(value);
  }

  function roundMoney(value) {
    return Math.round(toNumber(value) * 100) / 100;
  }

  function getRoyaltyRate(turnover) {
    var amount = positiveNumber(turnover);
    for (var i = 0; i < ROYALTY_RATES.length; i += 1) {
      if (amount < ROYALTY_RATES[i].limit) {
        return ROYALTY_RATES[i].rate;
      }
    }
    return 0;
  }

  function calculateRoyalty(turnover) {
    return roundMoney(positiveNumber(turnover) * getRoyaltyRate(turnover));
  }

  function getDealRate(agent, dealIndex) {
    if (agent.paymentType === 'fixed') {
      return positiveNumber(agent.fixedRate) / 100;
    }

    if (agent.paymentType === 'boosted') {
      var boostedRates = agent.boostedRates || PAY_SCALES.boostedDefault;
      var boostedIndex = Math.min(dealIndex, boostedRates.length - 1);
      return positiveNumber(boostedRates[boostedIndex]) / 100;
    }

    var status = agent.status === 'trainee' ? 'trainee' : 'partner';
    var standardRates = PAY_SCALES.standard[status];
    var standardIndex = Math.min(dealIndex, standardRates.length - 1);
    return standardRates[standardIndex];
  }

  function getStipendLevel(quarterlyResult) {
    var amount = positiveNumber(quarterlyResult);
    var matched = { threshold: 0, level: 0, monthly: 0 };

    for (var i = 0; i < STIPEND_LEVELS.length; i += 1) {
      if (amount >= STIPEND_LEVELS[i].threshold) {
        matched = STIPEND_LEVELS[i];
      }
    }

    return matched;
  }

  function getAgentLevelByQuarterlyCommission(quarterlyCommission) {
    return getStipendLevel(quarterlyCommission).level;
  }

  function getStipendByQuarterlyCommission(quarterlyCommission) {
    return getStipendLevel(quarterlyCommission).monthly;
  }

  function isPartnershipConfirmed(quarterlyDeposits) {
    return positiveNumber(quarterlyDeposits) >= PARTNERSHIP_DEPOSIT_THRESHOLD;
  }

  function readAgentValue(agent, source, field, fallback) {
    if (agent && agent[field] !== undefined) {
      return agent[field];
    }
    if (source && source[field] !== undefined) {
      return source[field];
    }
    return fallback;
  }

  function readAgentFlag(agent, source, field) {
    return Boolean(readAgentValue(agent, source, field, false));
  }

  function hasMeaningfulDealInput(agent) {
    return Array.isArray(agent && agent.dealsInput) && agent.dealsInput.some(function (deal) {
      return positiveNumber(deal) > 0;
    });
  }

  function isMeaningfulAgentSource(source, calculated) {
    var agent = source || calculated || {};
    var name = String(agent.name || '').trim();
    var fixedRate = agent.fixedRate;

    if (fixedRate === undefined || fixedRate === null || fixedRate === '') {
      fixedRate = calculated && calculated.fixedRate !== undefined ? calculated.fixedRate : PAY_SCALES.fixedDefault;
    }

    return (name && name !== 'Новый агент')
      || positiveNumber(agent.commission) > 0
      || positiveInteger(agent.dealCount, 1) > 1
      || hasMeaningfulDealInput(agent)
      || (agent.paymentType && agent.paymentType !== 'standard')
      || positiveNumber(fixedRate) !== PAY_SCALES.fixedDefault
      || Boolean(agent.introduced)
      || Boolean(agent.partnerConfirmed)
      || positiveNumber(agent.quarterlyCommission) > 0
      || positiveNumber(agent.quarterlyDeposits) > 0
      || positiveNumber(agent.halfYearCommission) > 0
      || positiveNumber(agent.preTripQuarterDeposits) > 0
      || Boolean(agent.motivationOverride)
      || Boolean(agent.stipendOverride)
      || Boolean(agent.mountainSeaOverride)
      || Boolean(agent.travelOverride)
      || Boolean(agent.eventsOverride)
      || Boolean(agent.specialTermsOverride)
      || positiveNumber(agent.motivationReserve) > 0
      || positiveNumber(agent.manualExpenseShare) > 0
      || positiveNumber(agent.payout) > 0
      || positiveNumber(agent.referral) > 0;
  }

  function getMotivationContext(agent) {
    var source = agent && agent.motivation ? agent.motivation : (agent || {});
    var commission = positiveNumber(agent && agent.commission);
    var quarterlyResultFallback = readAgentValue(agent, source, 'quarterlyResult', undefined);

    if (quarterlyResultFallback === undefined || quarterlyResultFallback === null || quarterlyResultFallback === '') {
      quarterlyResultFallback = commission * 3;
    }

    var quarterlyCommission = positiveNumber(
      readAgentValue(agent, source, 'quarterlyCommission', quarterlyResultFallback)
    );
    var quarterlyDeposits = positiveNumber(readAgentValue(agent, source, 'quarterlyDeposits', 0));
    var halfYearCommission = positiveNumber(readAgentValue(agent, source, 'halfYearCommission', 0));
    var preTripQuarterDeposits = positiveNumber(readAgentValue(agent, source, 'preTripQuarterDeposits', 0));
    var partnerConfirmed = readAgentValue(agent, source, 'partnerConfirmed', undefined);
    var mountainSeaOverride = readAgentValue(agent, source, 'mountainSeaOverride', undefined);

    if (mountainSeaOverride === undefined || mountainSeaOverride === null) {
      mountainSeaOverride = readAgentValue(agent, source, 'travelOverride', false);
    }

    return {
      source: source,
      commission: commission,
      quarterlyCommission: quarterlyCommission,
      quarterlyDeposits: quarterlyDeposits,
      partnerConfirmed: partnerConfirmed === undefined ? isPartnershipConfirmed(quarterlyDeposits) : Boolean(partnerConfirmed),
      partnerConfirmedAuto: isPartnershipConfirmed(quarterlyDeposits),
      halfYearCommission: halfYearCommission,
      preTripQuarterDeposits: preTripQuarterDeposits,
      paymentType: readAgentValue(agent, source, 'paymentType', 'standard'),
      motivationOverride: readAgentFlag(agent, source, 'motivationOverride'),
      stipendOverride: readAgentFlag(agent, source, 'stipendOverride'),
      mountainSeaOverride: Boolean(mountainSeaOverride),
      travelOverride: readAgentFlag(agent, source, 'travelOverride'),
      eventsOverride: readAgentFlag(agent, source, 'eventsOverride'),
      specialTermsOverride: readAgentFlag(agent, source, 'specialTermsOverride')
    };
  }

  function hasSpecialPaymentTerms(agent) {
    var paymentType = agent && agent.paymentType ? agent.paymentType : 'standard';
    return paymentType === 'fixed' || paymentType === 'boosted';
  }

  function getBlockedResult(reason) {
    return {
      available: false,
      reason: reason
    };
  }

  function getStipendEligibility(agent) {
    var context = getMotivationContext(agent || {});
    var level = getStipendLevel(context.quarterlyCommission);
    var result = {
      available: true,
      reason: 'available',
      level: level.level,
      stipendMonthly: level.monthly,
      partnershipConfirmed: context.partnerConfirmed
    };

    if (context.quarterlyCommission < STIPEND_MIN_QUARTERLY_COMMISSION || level.level < STIPEND_MIN_LEVEL) {
      return Object.assign(result, getBlockedResult('level'));
    }
    if (!result.partnershipConfirmed) {
      return Object.assign(result, getBlockedResult('partnership'));
    }
    if (hasSpecialPaymentTerms(context) && !context.specialTermsOverride) {
      return Object.assign(result, getBlockedResult('specialTerms'));
    }
    return result;
  }

  function getMotivationEligibility(agent) {
    var context = getMotivationContext(agent || {});
    var result = {
      available: true,
      reason: 'available',
      partnershipConfirmed: context.partnerConfirmed
    };

    if (!result.partnershipConfirmed) {
      return Object.assign(result, getBlockedResult('partnership'));
    }
    if (hasSpecialPaymentTerms(context) && !context.specialTermsOverride) {
      return Object.assign(result, getBlockedResult('specialTerms'));
    }
    return result;
  }

  function getTravelEligibility(agent) {
    var context = getMotivationContext(agent || {});
    var base = getMotivationEligibility(agent || {});
    if (!base.available) {
      return base;
    }
    if (context.halfYearCommission < TRAVEL_MIN_HALF_YEAR_COMMISSION) {
      return Object.assign(base, getBlockedResult('halfYearLevel'));
    }
    if (!isPartnershipConfirmed(context.preTripQuarterDeposits)) {
      return Object.assign(base, getBlockedResult('preTripDeposits'));
    }
    return base;
  }

  function canUseBlockedMotivation(context, overrideField) {
    return context.motivationOverride || Boolean(context[overrideField]);
  }

  function resolveStipendMode(source) {
    if (source && (source.stipendMode === 'manual' || source.stipendManualEnabled)) {
      return 'manual';
    }

    return 'auto';
  }

  function inferMotivationMode(agent, source, context) {
    if (source && source.mode) {
      return source.mode;
    }

    if (positiveNumber(source && source.manualReserveMonthly) > 0) {
      return 'manual';
    }

    if (context && hasSpecialPaymentTerms(context)) {
      return source && source.specialManualReserveEnabled ? 'manual' : 'off';
    }

    if (source && (
      source.stipendMode !== DEFAULT_MOTIVATION.stipendMode
      || positiveNumber(source.manualStipendMonthly) > 0
      || positiveNumber(source.quarterlyResult) > 0
      || positiveNumber(source.quarterlyDeposits) > 0
      || positiveNumber(source.halfYearCommission) > 0
      || positiveNumber(source.preTripQuarterDeposits) > 0
      || source.mountainSeaEnabled
      || source.travelEnabled
      || source.corporateEnabled
      || source.congressEnabled
      || source.starEnabled
      || positiveNumber(source.manualAnnualReserveMonthly) > 0
    )) {
      return 'rules';
    }

    if (agent && (
      positiveNumber(agent.quarterlyCommission) > 0
      || positiveNumber(agent.quarterlyDeposits) > 0
      || positiveNumber(agent.halfYearCommission) > 0
      || positiveNumber(agent.preTripQuarterDeposits) > 0
    )) {
      return 'rules';
    }

    return 'off';
  }

  function calculateMotivationReserve(agent) {
    var context = getMotivationContext(agent);
    var source = context.source;
    var motivationMode = inferMotivationMode(agent, source, context);
    var manualReserveMonthly = positiveNumber(source.manualReserveMonthly);
    var specialManualReserveEnabled = Boolean(source.specialManualReserveEnabled);

    if (agent && agent.status === 'trainee') {
      return {
        mode: motivationMode === 'manual' ? 'manual' : 'off',
        total: motivationMode === 'manual' ? manualReserveMonthly : 0,
        monthly: motivationMode === 'manual' ? manualReserveMonthly : 0,
        manualReserveMonthly: manualReserveMonthly,
        specialManualReserveEnabled: false
      };
    }

    if (motivationMode === 'off' && !hasSpecialPaymentTerms(context)) {
      return {
        mode: 'off',
        total: 0,
        monthly: 0,
        manualReserveMonthly: manualReserveMonthly,
        specialManualReserveEnabled: specialManualReserveEnabled
      };
    }

    if (motivationMode === 'manual' && !hasSpecialPaymentTerms(context)) {
      return {
        mode: 'manual',
        total: manualReserveMonthly,
        monthly: manualReserveMonthly,
        manualReserveMonthly: manualReserveMonthly,
        specialManualReserveEnabled: specialManualReserveEnabled
      };
    }

    var quarterlyResult = context.quarterlyCommission;
    var stipendMode = resolveStipendMode(source);
    var stipendLevel = getStipendLevel(quarterlyResult);
    var stipendEligibility = getStipendEligibility(Object.assign({}, agent || {}, source));
    var motivationEligibility = getMotivationEligibility(Object.assign({}, agent || {}, source));
    var travelEligibility = getTravelEligibility(Object.assign({}, agent || {}, source));
    var stipendManualEnabled = stipendMode === 'manual' || canUseBlockedMotivation(context, 'stipendOverride');
    var mountainSeaAllowed = motivationEligibility.available || canUseBlockedMotivation(context, 'mountainSeaOverride');
    var travelAllowed = travelEligibility.available || canUseBlockedMotivation(context, 'travelOverride');
    var corporateAllowed = motivationEligibility.available || canUseBlockedMotivation(context, 'eventsOverride');
    var stipendMonthly = 0;

    if (stipendManualEnabled) {
      stipendMonthly = positiveNumber(source.manualStipendMonthly);
    } else if (stipendEligibility.available) {
      stipendMonthly = stipendLevel.monthly;
    }

    var annualReserveMode = source.annualReserveMode || DEFAULT_MOTIVATION.annualReserveMode;
    var mountainSeaAnnual = source.mountainSeaEnabled && mountainSeaAllowed
      ? readNumberOrFallback(agent, source, 'mountainSeaPerTrip', DEFAULT_MOTIVATION.mountainSeaPerTrip) * readNumberOrFallback(agent, source, 'mountainSeaTripsPerYear', DEFAULT_MOTIVATION.mountainSeaTripsPerYear)
      : 0;
    var travelAnnual = source.travelEnabled && travelAllowed
      ? readNumberOrFallback(agent, source, 'travelPerTrip', DEFAULT_MOTIVATION.travelPerTrip) * readNumberOrFallback(agent, source, 'travelTripsPerYear', DEFAULT_MOTIVATION.travelTripsPerYear)
      : 0;
    var corporateAnnual = source.corporateEnabled && corporateAllowed ? readNumberOrFallback(agent, source, 'corporatePerYear', DEFAULT_MOTIVATION.corporatePerYear) : 0;
    var congressAnnual = source.congressEnabled ? readNumberOrFallback(agent, source, 'congressPerYear', DEFAULT_MOTIVATION.congressPerYear) : 0;
    var starAnnual = source.starEnabled ? readNumberOrFallback(agent, source, 'starPerYear', DEFAULT_MOTIVATION.starPerYear) : 0;
    var annualReserveTotal = mountainSeaAnnual + travelAnnual + corporateAnnual + congressAnnual + starAnnual;
    var annualReserveMonthly = annualReserveTotal / 12;

    if (annualReserveMode === 'full') {
      annualReserveMonthly = annualReserveTotal;
    } else if (annualReserveMode === 'manual') {
      annualReserveMonthly = positiveNumber(source.manualAnnualReserveMonthly);
    }

    var mountainSeaMonthly = annualReserveMode === 'full' ? mountainSeaAnnual : mountainSeaAnnual / 12;
    var travelMonthly = annualReserveMode === 'full' ? travelAnnual : travelAnnual / 12;
    var corporateMonthly = annualReserveMode === 'full' ? corporateAnnual : corporateAnnual / 12;
    var congressMonthly = annualReserveMode === 'full' ? congressAnnual : congressAnnual / 12;
    var starMonthly = annualReserveMode === 'full' ? starAnnual : starAnnual / 12;
    var total = stipendMonthly + annualReserveMonthly;
    var specialTermsOnlyManual = hasSpecialPaymentTerms(context);

    if (specialTermsOnlyManual) {
      total = motivationMode === 'manual' && specialManualReserveEnabled ? manualReserveMonthly : 0;
    }

    return {
      mode: 'rules',
      stipendMode: stipendMode,
      quarterlyResult: quarterlyResult,
      stipendLevel: stipendLevel.level,
      stipendAvailable: stipendEligibility.available,
      stipendReason: stipendEligibility.reason,
      stipendOverride: stipendManualEnabled,
      stipendMonthly: stipendMonthly,
      annualReserveMode: annualReserveMode,
      annualReserveTotal: annualReserveTotal,
      annualReserveMonthly: annualReserveMonthly,
      partnershipConfirmed: context.partnerConfirmed,
      partnershipConfirmedAuto: context.partnerConfirmedAuto,
      quarterlyDeposits: context.quarterlyDeposits,
      halfYearCommission: context.halfYearCommission,
      preTripQuarterDeposits: context.preTripQuarterDeposits,
      mountainSeaAvailable: motivationEligibility.available,
      mountainSeaReason: motivationEligibility.reason,
      mountainSeaAnnual: mountainSeaAnnual,
      mountainSeaMonthly: mountainSeaMonthly,
      travelAvailable: travelEligibility.available,
      travelReason: travelEligibility.reason,
      travelAnnual: travelAnnual,
      travelMonthly: travelMonthly,
      corporateAvailable: motivationEligibility.available,
      corporateReason: motivationEligibility.reason,
      corporateAnnual: corporateAnnual,
      corporateMonthly: corporateMonthly,
      congressAvailable: true,
      congressAnnual: congressAnnual,
      congressMonthly: congressMonthly,
      starAvailable: true,
      starAnnual: starAnnual,
      starMonthly: starMonthly,
      manualReserveMonthly: manualReserveMonthly,
      specialManualReserveEnabled: specialManualReserveEnabled,
      total: total,
      monthly: total
    };
  }

  function calculateAgent(agent) {
    var exactMode = agent.commissionMode === 'exact';
    var sourceDeals = exactMode && Array.isArray(agent.dealsInput)
      ? agent.dealsInput.map(positiveNumber).filter(function (amount) { return amount > 0; })
      : [];
    var commission = exactMode
      ? sourceDeals.reduce(function (sum, amount) { return sum + amount; }, 0)
      : positiveNumber(agent.commission);
    var dealCount = exactMode ? Math.max(1, sourceDeals.length) : positiveInteger(agent.dealCount, 1);
    var dealCommission = dealCount ? commission / dealCount : 0;
    var payout = 0;
    var deals = [];

    for (var i = 0; i < dealCount; i += 1) {
      var rate = getDealRate(agent, i);
      var currentDealCommission = exactMode ? positiveNumber(sourceDeals[i]) : dealCommission;
      var dealPayout = currentDealCommission * rate;
      payout += dealPayout;
      deals.push({
        index: i + 1,
        commission: currentDealCommission,
        rate: rate,
        payout: dealPayout
      });
    }

    var referral = agent.introduced ? commission * REFERRAL_RATE : 0;
    var motivation = calculateMotivationReserve(agent);
    var fixedRate = agent.fixedRate;

    if (fixedRate === undefined || fixedRate === null || fixedRate === '') {
      fixedRate = PAY_SCALES.fixedDefault;
    }

    return {
      id: agent.id,
      name: agent.name || 'Агент',
      commission: commission,
      dealCount: dealCount,
      commissionMode: exactMode ? 'exact' : 'quick',
      paymentType: agent.paymentType || 'standard',
      status: agent.status || 'partner',
      boostedRates: agent.boostedRates || PAY_SCALES.boostedDefault,
      fixedRate: positiveNumber(fixedRate),
      introduced: Boolean(agent.introduced),
      deals: deals,
      payout: payout,
      referral: referral,
      motivation: motivation,
      motivationReserve: motivation.total,
      officeBeforeRoyalty: commission - payout - referral,
      officeBeforeRoyaltyAndReserve: commission - payout - referral - motivation.total
    };
  }

  function calculateExpenses(expenses) {
    return (expenses || []).reduce(function (sum, expense) {
      return sum + positiveNumber(expense.amount);
    }, 0);
  }

  function getAgentStatus(contribution) {
    if (contribution < -5000) {
      return 'Не окупается';
    }
    if (contribution <= 5000) {
      return 'На грани';
    }
    return 'Окупается';
  }

  function calculateAgentEconomics(agents, expenses, sources) {
    var activeAgents = agents.filter(function (agent, index) {
      return isMeaningfulAgentSource(sources && sources[index], agent);
    });
    var expenseShare = activeAgents.length ? expenses / activeAgents.length : 0;

    return activeAgents.map(function (agent) {
      var royaltyShare = calculateRoyalty(agent.commission);
      var contribution = roundMoney(agent.commission
        - agent.payout
        - agent.referral
        - agent.motivationReserve
        - royaltyShare
        - expenseShare);

      return {
        id: agent.id,
        name: agent.name,
        commission: agent.commission,
        payout: agent.payout,
        referral: agent.referral,
        motivationReserve: agent.motivationReserve,
        royaltyShare: royaltyShare,
        expenseShare: expenseShare,
        beforeExpenses: roundMoney(agent.commission - agent.payout - agent.referral - agent.motivationReserve - royaltyShare),
        contribution: contribution,
        status: getAgentStatus(contribution)
      };
    });
  }

  function calculateOffice(state) {
    var sourceAgents = state.agents || [];
    var agents = sourceAgents.map(calculateAgent);
    var agentTurnover = agents.reduce(function (sum, agent) { return sum + agent.commission; }, 0);
    var ownerSales = positiveNumber(state.ownerSales);
    var totalTurnover = agentTurnover + ownerSales;
    var agentPayouts = agents.reduce(function (sum, agent) { return sum + agent.payout; }, 0);
    var referrals = agents.reduce(function (sum, agent) { return sum + agent.referral; }, 0);
    var motivationReserves = agents.reduce(function (sum, agent) { return sum + agent.motivationReserve; }, 0);
    var expenses = calculateExpenses(state.expenses || []);
    var royaltyWithoutOwner = calculateRoyalty(agentTurnover);
    var royaltyWithOwner = calculateRoyalty(totalTurnover);
    var resultWithoutOwnerBeforeReserves = agentTurnover - agentPayouts - referrals - royaltyWithoutOwner - expenses;
    var resultWithOwnerBeforeReserves = totalTurnover - agentPayouts - referrals - royaltyWithOwner - expenses;
    var resultWithoutOwner = resultWithoutOwnerBeforeReserves - motivationReserves;
    var resultWithOwner = resultWithOwnerBeforeReserves - motivationReserves;

    return {
      agents: agents,
      expenses: expenses,
      agentTurnover: agentTurnover,
      ownerSales: ownerSales,
      totalTurnover: totalTurnover,
      agentPayouts: agentPayouts,
      referrals: referrals,
      motivationReserves: motivationReserves,
      royaltyWithoutOwner: royaltyWithoutOwner,
      royaltyWithOwner: royaltyWithOwner,
      resultWithoutOwnerBeforeReserves: resultWithoutOwnerBeforeReserves,
      resultWithOwnerBeforeReserves: resultWithOwnerBeforeReserves,
      resultWithoutOwner: resultWithoutOwner,
      resultWithOwner: resultWithOwner,
      agentEconomics: calculateAgentEconomics(agents, expenses, sourceAgents),
      warningOwnerDependency: resultWithoutOwner < -0.5 && resultWithOwner > 0.5
    };
  }

  function calculateSchemeVariant(config, variant) {
    var agent = {
      id: variant.id,
      name: variant.label,
      commission: positiveNumber(config.commission),
      dealCount: positiveInteger(config.dealCount, 1),
      paymentType: variant.paymentType,
      status: variant.status || 'partner',
      boostedRates: variant.boostedRates,
      fixedRate: variant.fixedRate,
      introduced: Boolean(config.introduced),
      motivation: { stipendMode: 'manual', manualStipendMonthly: positiveNumber(config.motivationReserve) }
    };
    var calculated = calculateAgent(agent);
    var royalty = calculateRoyalty(calculated.commission);
    var expenseShare = positiveNumber(config.expenseShare);
    var contribution = roundMoney(calculated.commission
      - calculated.payout
      - calculated.referral
      - royalty
      - calculated.motivationReserve
      - expenseShare);

    return {
      id: variant.id,
      label: variant.label,
      paymentType: variant.paymentType,
      payout: calculated.payout,
      referral: calculated.referral,
      royalty: royalty,
      motivationReserve: calculated.motivationReserve,
      beforeExpenses: roundMoney(calculated.commission - calculated.payout - calculated.referral - royalty - calculated.motivationReserve),
      expenseShare: expenseShare,
      contribution: contribution,
      status: getAgentStatus(contribution),
      conclusion: contribution > 5000 ? 'можно рассматривать' : (contribution >= -5000 ? 'опасно' : 'убыточно при текущем обороте')
    };
  }

  function getRetentionScenarioVariants() {
    return [
      { id: 'boosted-55', label: 'Повышенная 55 / 55 / 55 / 60', paymentType: 'boosted', boostedRates: [55, 55, 55, 60] },
      { id: 'boosted-55-60-65', label: 'Повышенная 55 / 55 / 60 / 65', paymentType: 'boosted', boostedRates: [55, 55, 60, 65] },
      { id: 'fixed-70', label: 'Фикс 70%', paymentType: 'fixed', fixedRate: 70 },
      { id: 'fixed-80', label: 'Фикс 80%', paymentType: 'fixed', fixedRate: 80 },
      { id: 'fixed-90', label: 'Фикс 90%', paymentType: 'fixed', fixedRate: 90 }
    ];
  }

  function cloneAgentForScenario(agentSource) {
    var agent = Object.assign({}, agentSource || {});

    if (Array.isArray(agent.dealsInput)) {
      agent.dealsInput = agent.dealsInput.slice();
    }
    if (Array.isArray(agent.boostedRates)) {
      agent.boostedRates = agent.boostedRates.slice();
    }
    if (agent.motivation && typeof agent.motivation === 'object') {
      agent.motivation = Object.assign({}, agent.motivation);
    }

    return agent;
  }

  function getRetentionScenarioStatus(contribution, isBaseline) {
    if (isBaseline) {
      return 'база';
    }
    if (contribution < 0) {
      return 'убыточно';
    }
    if (contribution < 50000) {
      return 'риск';
    }
    if (contribution <= 100000) {
      return 'осторожно';
    }
    return 'можно';
  }

  function buildRetentionScenario(agentSource, baselineEconomics, variant) {
    var scenarioAgent = cloneAgentForScenario(agentSource);
    scenarioAgent.paymentType = variant.paymentType;

    if (variant.paymentType === 'boosted') {
      scenarioAgent.boostedRates = (variant.boostedRates || []).slice();
    }
    if (variant.paymentType === 'fixed') {
      scenarioAgent.fixedRate = positiveNumber(variant.fixedRate);
    }

    var calculated = calculateAgent(scenarioAgent);
    var contribution = roundMoney(baselineEconomics.commission
      - calculated.payout
      - baselineEconomics.referral
      - baselineEconomics.royaltyShare
      - baselineEconomics.motivationReserve
      - baselineEconomics.expenseShare);

    return {
      id: variant.id,
      label: variant.label,
      payout: calculated.payout,
      commission: baselineEconomics.commission,
      referral: baselineEconomics.referral,
      royaltyShare: baselineEconomics.royaltyShare,
      motivationReserve: baselineEconomics.motivationReserve,
      expenseShare: baselineEconomics.expenseShare,
      contribution: contribution,
      deltaFromCurrent: roundMoney(contribution - baselineEconomics.contribution),
      status: getRetentionScenarioStatus(contribution, false)
    };
  }

  function compareAgentRetentionScenarios(agentSource, agentEconomics) {
    var source = cloneAgentForScenario(agentSource);
    var baseline = {
      id: 'current',
      label: 'Текущие условия',
      payout: roundMoney(agentEconomics.payout),
      commission: roundMoney(agentEconomics.commission),
      referral: roundMoney(agentEconomics.referral),
      royaltyShare: roundMoney(agentEconomics.royaltyShare),
      motivationReserve: roundMoney(agentEconomics.motivationReserve),
      expenseShare: roundMoney(agentEconomics.expenseShare),
      contribution: roundMoney(agentEconomics.contribution),
      deltaFromCurrent: 0,
      status: getRetentionScenarioStatus(agentEconomics.contribution, true)
    };

    return {
      baseline: baseline,
      scenarios: [baseline].concat(getRetentionScenarioVariants().map(function (variant) {
        return buildRetentionScenario(source, baseline, variant);
      }))
    };
  }

  function findBreakEvenCommission(config, variant) {
    var step = 1000;
    var maximum = 10000000;
    var probe = 0;

    while (probe <= maximum) {
      var result = calculateSchemeVariant(Object.assign({}, config, { commission: probe }), variant);
      if (result.contribution >= 0) {
        return probe;
      }
      probe += step;
    }

    return null;
  }

  function comparePaymentSchemes(config) {
    var variants = [
      { id: 'standard-partner', label: 'Стандарт партнёр 45 / 50 / 55 / 60', paymentType: 'standard', status: 'partner' },
      { id: 'boosted-55', label: 'Повышенная 55 / 55 / 55 / 60', paymentType: 'boosted', boostedRates: [55, 55, 55, 60] },
      { id: 'boosted-55-60-65', label: 'Повышенная 55 / 55 / 60 / 65', paymentType: 'boosted', boostedRates: [55, 55, 60, 65] },
      { id: 'fixed-70', label: 'Фикс 70%', paymentType: 'fixed', fixedRate: 70 },
      { id: 'fixed-80', label: 'Фикс 80%', paymentType: 'fixed', fixedRate: 80 },
      { id: 'fixed-90', label: 'Фикс 90%', paymentType: 'fixed', fixedRate: 90 }
    ];

    if (positiveNumber(config.manualRate) > 0) {
      variants.push({
        id: 'manual-fixed',
        label: 'Ручной фикс ' + positiveNumber(config.manualRate) + '%',
        paymentType: 'fixed',
        fixedRate: positiveNumber(config.manualRate)
      });
    }

    return {
      variants: variants.map(function (variant) {
      var result = calculateSchemeVariant(config, variant);
      result.breakEvenCommission = findBreakEvenCommission(config, variant);
      return result;
      })
    };
  }

  function money(value) {
    return Math.round(toNumber(value)).toLocaleString('ru-RU') + ' ₽';
  }

  function moneyPrecise(value) {
    return toNumber(value).toLocaleString('ru-RU', {
      maximumFractionDigits: 2
    }) + ' ₽';
  }

  function percent(value) {
    return (toNumber(value) * 100).toLocaleString('ru-RU', {
      maximumFractionDigits: 2
    }) + '%';
  }

  window.toNumber = toNumber;
  window.positiveNumber = positiveNumber;
  window.positiveInteger = positiveInteger;
  window.roundMoney = roundMoney;
  window.getRoyaltyRate = getRoyaltyRate;
  window.calculateRoyalty = calculateRoyalty;
  window.getDealRate = getDealRate;
  window.getStipendLevel = getStipendLevel;
  window.getAgentLevelByQuarterlyCommission = getAgentLevelByQuarterlyCommission;
  window.getStipendByQuarterlyCommission = getStipendByQuarterlyCommission;
  window.isPartnershipConfirmed = isPartnershipConfirmed;
  window.hasSpecialPaymentTerms = hasSpecialPaymentTerms;
  window.getStipendEligibility = getStipendEligibility;
  window.getMotivationEligibility = getMotivationEligibility;
  window.getTravelEligibility = getTravelEligibility;
  window.calculateMotivationReserve = calculateMotivationReserve;
  window.calculateAgent = calculateAgent;
  window.calculateExpenses = calculateExpenses;
  window.calculateAgentEconomics = calculateAgentEconomics;
  window.calculateOffice = calculateOffice;
  window.calculateSchemeVariant = calculateSchemeVariant;
  window.comparePaymentSchemes = comparePaymentSchemes;
  window.compareAgentRetentionScenarios = compareAgentRetentionScenarios;
  window.money = money;
  window.moneyPrecise = moneyPrecise;
  window.percent = percent;
}());
