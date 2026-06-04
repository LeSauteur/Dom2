(function () {
  'use strict';

  function toNumber(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function getRoyaltyRate(turnover) {
    var amount = Math.max(0, toNumber(turnover));
    for (var i = 0; i < ROYALTY_RATES.length; i += 1) {
      if (amount < ROYALTY_RATES[i].limit) {
        return ROYALTY_RATES[i].rate;
      }
    }
    return 0;
  }

  function calculateRoyalty(turnover) {
    var rate = getRoyaltyRate(turnover);
    return Math.max(0, toNumber(turnover)) * rate;
  }

  function getDealRate(agent, dealIndex) {
    if (agent.terms === 'fixed') {
      return Math.max(0, toNumber(agent.fixedRate)) / 100;
    }

    if (agent.terms === 'boosted') {
      var boostedRates = agent.boostedRates || PAY_SCALES.boostedDefault;
      var boostedIndex = Math.min(dealIndex, boostedRates.length - 1);
      return Math.max(0, toNumber(boostedRates[boostedIndex])) / 100;
    }

    var status = agent.status === 'partner' ? 'partner' : 'trainee';
    var standardRates = PAY_SCALES.standard[status];
    var standardIndex = Math.min(dealIndex, standardRates.length - 1);
    return standardRates[standardIndex];
  }

  function calculateReferral(agent) {
    var gross = (agent.deals || []).reduce(function (sum, deal) {
      return sum + Math.max(0, toNumber(deal.commission));
    }, 0);
    return agent.introduced ? gross * REFERRAL_RATE : 0;
  }

  function calculateStipend(agent) {
    if (agent.terms !== 'standard') {
      return {
        enabled: false,
        reason: 'Мотивация отключена: агент на спецусловиях.',
        quarterResult: 0,
        level: 0,
        monthly: 0,
        quarter: 0
      };
    }

    var gross = (agent.deals || []).reduce(function (sum, deal) {
      return sum + Math.max(0, toNumber(deal.commission));
    }, 0);
    var quarterResult = agent.stipendMode === 'manual'
      ? Math.max(0, toNumber(agent.quarterManual))
      : gross * 3;
    var matched = null;

    for (var i = 0; i < STIPEND_LEVELS.length; i += 1) {
      if (quarterResult >= STIPEND_LEVELS[i].threshold) {
        matched = STIPEND_LEVELS[i];
      }
    }

    return {
      enabled: true,
      reason: '',
      quarterResult: quarterResult,
      level: matched ? matched.level : 0,
      monthly: matched ? matched.monthly : 0,
      quarter: matched ? matched.monthly * 3 : 0
    };
  }

  function calculateAgent(agent) {
    var gross = 0;
    var payout = 0;
    var deals = (agent.deals || []).map(function (deal, index) {
      var commission = Math.max(0, toNumber(deal.commission));
      var rate = getDealRate(agent, index);
      var dealPayout = commission * rate;
      gross += commission;
      payout += dealPayout;
      return {
        id: deal.id,
        commission: commission,
        rate: rate,
        payout: dealPayout
      };
    });
    var referral = agent.introduced ? gross * REFERRAL_RATE : 0;
    var stipend = calculateStipend(agent);
    var officeBeforeRoyalty = gross - payout - referral;

    return {
      id: agent.id,
      gross: gross,
      payout: payout,
      referral: referral,
      officeBeforeRoyalty: officeBeforeRoyalty,
      deals: deals,
      dealCount: deals.length,
      stipend: stipend,
      depositBonusAvailable: Math.max(0, toNumber(agent.quarterDeposits)) >= DEPOSIT_BONUS_THRESHOLD
    };
  }

  function normalizeExpenseToMonth(expense) {
    var amount = Math.max(0, toNumber(expense.amount));
    if (expense.period === 'quarter') {
      return amount / 3;
    }
    if (expense.period === 'year') {
      return amount / 12;
    }
    return amount;
  }

  function calculateOfficeTotals(state) {
    var agentResults = (state.agents || []).map(calculateAgent);
    var grossCommission = agentResults.reduce(function (sum, agent) { return sum + agent.gross; }, 0);
    var agentPayouts = agentResults.reduce(function (sum, agent) { return sum + agent.payout; }, 0);
    var referralPayouts = agentResults.reduce(function (sum, agent) { return sum + agent.referral; }, 0);
    var royaltyRate = getRoyaltyRate(grossCommission);
    var royaltyAmount = calculateRoyalty(grossCommission);
    var fixedExpenses = (state.expenses || []).reduce(function (sum, expense) {
      return sum + normalizeExpenseToMonth(expense);
    }, 0);
    var currentMotivation = Math.max(0, toNumber(state.currentMotivation));
    var manualReserve = Math.max(0, toNumber(state.manualReserve));
    var futureStipendsMonth = agentResults.reduce(function (sum, agent) { return sum + agent.stipend.monthly; }, 0);
    var futureStipendsQuarter = agentResults.reduce(function (sum, agent) { return sum + agent.stipend.quarter; }, 0);
    var selectedFutureStipendReserve = 0;

    if (state.stipendReserveMode === 'quarter') {
      selectedFutureStipendReserve = futureStipendsQuarter;
    } else if (state.stipendReserveMode === 'month') {
      selectedFutureStipendReserve = futureStipendsMonth;
    }

    var netProfit = grossCommission
      - agentPayouts
      - referralPayouts
      - royaltyAmount
      - fixedExpenses
      - currentMotivation;
    var safeProfit = netProfit - selectedFutureStipendReserve - manualReserve;

    return {
      agentResults: agentResults,
      grossCommission: grossCommission,
      agentPayouts: agentPayouts,
      referralPayouts: referralPayouts,
      royaltyRate: royaltyRate,
      royaltyAmount: royaltyAmount,
      autoExpenses: referralPayouts + royaltyAmount,
      fixedExpenses: fixedExpenses,
      currentMotivation: currentMotivation,
      manualReserve: manualReserve,
      futureStipendsMonth: futureStipendsMonth,
      futureStipendsQuarter: futureStipendsQuarter,
      selectedFutureStipendReserve: selectedFutureStipendReserve,
      netProfit: netProfit,
      safeProfit: safeProfit
    };
  }

  function getPeriodMonths(period) {
    if (period === 'quarter') {
      return 3;
    }
    if (period === 'halfyear') {
      return 6;
    }
    if (period === 'year') {
      return 12;
    }
    return 1;
  }

  function calculateQuickRoyalty(quickCheck) {
    var months = getPeriodMonths(quickCheck.period);
    var monthTurnovers = quickCheck.monthTurnovers || [];

    if (months === 1) {
      var monthGross = Math.max(0, toNumber(quickCheck.monthGross));
      return {
        gross: monthGross,
        rate: getRoyaltyRate(monthGross),
        amount: calculateRoyalty(monthGross),
        mode: 'month',
        monthDetails: [
          { index: 0, gross: monthGross, rate: getRoyaltyRate(monthGross), amount: calculateRoyalty(monthGross) }
        ],
        averageMonthlyGross: monthGross
      };
    }

    if (quickCheck.royaltyMode === 'monthly') {
      var details = [];
      var periodGross = 0;
      var royaltyAmount = 0;

      for (var i = 0; i < months; i += 1) {
        var gross = Math.max(0, toNumber(monthTurnovers[i]));
        var rate = getRoyaltyRate(gross);
        var amount = gross * rate;
        periodGross += gross;
        royaltyAmount += amount;
        details.push({ index: i, gross: gross, rate: rate, amount: amount });
      }

      return {
        gross: periodGross,
        rate: periodGross ? royaltyAmount / periodGross : 0,
        amount: royaltyAmount,
        mode: 'monthly',
        monthDetails: details,
        averageMonthlyGross: months ? periodGross / months : 0
      };
    }

    var totalGross = Math.max(0, toNumber(quickCheck.periodGross));
    var averageMonthlyGross = months ? totalGross / months : 0;
    var averageRate = getRoyaltyRate(averageMonthlyGross);

    return {
      gross: totalGross,
      rate: averageRate,
      amount: totalGross * averageRate,
      mode: 'average',
      monthDetails: [],
      averageMonthlyGross: averageMonthlyGross
    };
  }

  function normalizeQuickAgent(agent) {
    var terms = 'standard';
    if (agent.terms === 'special') {
      terms = agent.specialType === 'boosted' ? 'boosted' : 'fixed';
    }

    return {
      id: agent.id,
      name: agent.name,
      terms: terms,
      status: agent.status,
      introduced: false,
      fixedRate: agent.fixedRate,
      boostedRates: agent.boostedRates,
      quarterDeposits: 0,
      stipendMode: 'forecast',
      quarterManual: 0,
      deals: agent.deals || []
    };
  }

  function calculateQuickCheck(quickCheck) {
    var royalty = calculateQuickRoyalty(quickCheck);
    var agentResults = (quickCheck.agents || []).map(function (agent) {
      return calculateAgent(normalizeQuickAgent(agent));
    });
    var agentPayouts = agentResults.reduce(function (sum, agent) {
      return sum + agent.payout;
    }, 0);
    var periodExpenses = Math.max(0, toNumber(quickCheck.periodExpenses));
    var result = royalty.gross - agentPayouts - royalty.amount - periodExpenses;
    var profitability = royalty.gross ? result / royalty.gross : 0;

    return {
      periodGross: royalty.gross,
      royalty: royalty,
      agentResults: agentResults,
      agentPayouts: agentPayouts,
      periodExpenses: periodExpenses,
      result: result,
      profitability: profitability
    };
  }

  function scaleAgents(agents, coefficient) {
    var factor = Math.max(0, toNumber(coefficient));
    return (agents || []).map(function (agent) {
      var copy = JSON.parse(JSON.stringify(agent));
      copy.deals = (copy.deals || []).map(function (deal) {
        deal.commission = Math.max(0, toNumber(deal.commission)) * factor;
        return deal;
      });
      if (copy.stipendMode !== 'manual') {
        copy.quarterManual = 0;
      }
      return copy;
    });
  }

  function createScenarioState(state, coefficient) {
    var copy = JSON.parse(JSON.stringify(state));
    copy.agents = scaleAgents(state.agents, coefficient);
    return copy;
  }

  function calculateScenario(state, scenario) {
    var coefficient = Math.max(0, toNumber(scenario.coefficient));
    var scenarioState = createScenarioState(state, coefficient);
    var totals = calculateOfficeTotals(scenarioState);
    var currentGross = calculateOfficeTotals(state).grossCommission;
    var shortageToBreakEven = Math.max(0, -totals.netProfit);
    var reserveAboveBreakEven = Math.max(0, totals.netProfit);

    return {
      id: scenario.id,
      name: scenario.name,
      coefficient: coefficient,
      grossCommission: totals.grossCommission,
      agentPayouts: totals.agentPayouts,
      referralPayouts: totals.referralPayouts,
      royaltyAmount: totals.royaltyAmount,
      fixedExpenses: totals.fixedExpenses,
      currentMotivation: totals.currentMotivation,
      netProfit: totals.netProfit,
      safeProfit: totals.safeProfit,
      profitability: totals.grossCommission ? totals.netProfit / totals.grossCommission : 0,
      currentGross: currentGross,
      shortageToBreakEven: shortageToBreakEven,
      reserveAboveBreakEven: reserveAboveBreakEven
    };
  }

  function calculateScenarios(state) {
    return (state.scenarios || []).map(function (scenario) {
      return calculateScenario(state, scenario);
    });
  }

  function calculateBreakEven(state, step, maxTurnover) {
    var baseTotals = calculateOfficeTotals(state);
    var baseGross = baseTotals.grossCommission;
    var searchStep = Math.max(1, toNumber(step) || 1000);
    var searchMax = Math.max(searchStep, toNumber(maxTurnover) || 100000000);

    if (baseTotals.netProfit >= 0) {
      return {
        found: true,
        turnover: baseGross,
        currentGross: baseGross,
        shortage: 0,
        reserve: 0,
        netProfitAtBreakEven: baseTotals.netProfit
      };
    }

    if (baseGross <= 0) {
      return {
        found: false,
        turnover: 0,
        currentGross: 0,
        shortage: 0,
        reserve: 0,
        netProfitAtBreakEven: 0
      };
    }

    for (var turnover = 0; turnover <= searchMax; turnover += searchStep) {
      var coefficient = turnover / baseGross;
      var totals = calculateOfficeTotals(createScenarioState(state, coefficient));
      if (totals.netProfit >= 0) {
        return {
          found: true,
          turnover: turnover,
          currentGross: baseGross,
          shortage: Math.max(0, turnover - baseGross),
          reserve: Math.max(0, baseGross - turnover),
          netProfitAtBreakEven: totals.netProfit
        };
      }
    }

    return {
      found: false,
      turnover: searchMax,
      currentGross: baseGross,
      shortage: Math.max(0, searchMax - baseGross),
      reserve: 0,
      netProfitAtBreakEven: 0
    };
  }

  function money(value) {
    return Math.round(toNumber(value)).toLocaleString('ru-RU') + ' ₽';
  }

  function percent(value) {
    return (toNumber(value) * 100).toLocaleString('ru-RU', {
      maximumFractionDigits: 2
    }) + '%';
  }

  window.getRoyaltyRate = getRoyaltyRate;
  window.calculateRoyalty = calculateRoyalty;
  window.getDealRate = getDealRate;
  window.calculateAgent = calculateAgent;
  window.calculateReferral = calculateReferral;
  window.calculateStipend = calculateStipend;
  window.calculateOfficeTotals = calculateOfficeTotals;
  window.getPeriodMonths = getPeriodMonths;
  window.calculateQuickRoyalty = calculateQuickRoyalty;
  window.calculateQuickCheck = calculateQuickCheck;
  window.scaleAgents = scaleAgents;
  window.createScenarioState = createScenarioState;
  window.calculateScenario = calculateScenario;
  window.calculateScenarios = calculateScenarios;
  window.calculateBreakEven = calculateBreakEven;
  window.normalizeExpenseToMonth = normalizeExpenseToMonth;
  window.money = money;
  window.percent = percent;
}());
