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

  function calculateMotivationReserve(agent) {
    var source = agent && agent.motivation ? agent.motivation : (agent || {});
    var commission = positiveNumber(agent && agent.commission);
    var quarterlyResult = positiveNumber(source.quarterlyResult || commission * 3);
    var stipendMode = source.stipendMode || 'off';
    var stipendLevel = getStipendLevel(quarterlyResult);
    var stipendMonthly = 0;

    if (stipendMode === 'auto') {
      stipendMonthly = stipendLevel.monthly;
    } else if (stipendMode === 'manual') {
      stipendMonthly = positiveNumber(source.manualStipendMonthly);
    }

    var mountainSeaMonthly = source.mountainSeaEnabled
      ? positiveNumber(source.mountainSeaPerTrip || 15000) * positiveNumber(source.mountainSeaTripsPerYear || 2) / 12
      : 0;
    var travelMonthly = source.travelEnabled ? positiveNumber(source.travelPerYear || DEFAULT_MOTIVATION.travelPerYear) / 12 : 0;
    var corporateMonthly = source.corporateEnabled ? positiveNumber(source.corporatePerYear || 20000) / 12 : 0;
    var congressMonthly = source.congressEnabled ? positiveNumber(source.congressPerYear || 5000) / 12 : 0;
    var total = stipendMonthly + mountainSeaMonthly + travelMonthly + corporateMonthly + congressMonthly;

    return {
      stipendMode: stipendMode,
      quarterlyResult: quarterlyResult,
      stipendLevel: stipendLevel.level,
      stipendMonthly: stipendMonthly,
      mountainSeaMonthly: mountainSeaMonthly,
      travelMonthly: travelMonthly,
      corporateMonthly: corporateMonthly,
      congressMonthly: congressMonthly,
      total: total,
      monthly: total
    };
  }

  function calculateAgent(agent) {
    var commission = positiveNumber(agent.commission);
    var dealCount = positiveInteger(agent.dealCount, 1);
    var dealCommission = dealCount ? commission / dealCount : 0;
    var payout = 0;
    var deals = [];

    for (var i = 0; i < dealCount; i += 1) {
      var rate = getDealRate(agent, i);
      var dealPayout = dealCommission * rate;
      payout += dealPayout;
      deals.push({
        index: i + 1,
        commission: dealCommission,
        rate: rate,
        payout: dealPayout
      });
    }

    var referral = agent.introduced ? commission * REFERRAL_RATE : 0;
    var motivation = calculateMotivationReserve(agent);

    return {
      id: agent.id,
      name: agent.name || 'Агент',
      commission: commission,
      dealCount: dealCount,
      paymentType: agent.paymentType || 'standard',
      status: agent.status || 'partner',
      boostedRates: agent.boostedRates || PAY_SCALES.boostedDefault,
      fixedRate: positiveNumber(agent.fixedRate || PAY_SCALES.fixedDefault),
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

  function calculateAgentEconomics(agents, expenses) {
    var activeAgents = Math.max(1, agents.length);
    var expenseShare = expenses / activeAgents;

    return agents.map(function (agent) {
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
    var agents = (state.agents || []).map(calculateAgent);
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
      agentEconomics: calculateAgentEconomics(agents, expenses),
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
  window.calculateMotivationReserve = calculateMotivationReserve;
  window.calculateAgent = calculateAgent;
  window.calculateExpenses = calculateExpenses;
  window.calculateAgentEconomics = calculateAgentEconomics;
  window.calculateOffice = calculateOffice;
  window.calculateSchemeVariant = calculateSchemeVariant;
  window.comparePaymentSchemes = comparePaymentSchemes;
  window.money = money;
  window.moneyPrecise = moneyPrecise;
  window.percent = percent;
}());
