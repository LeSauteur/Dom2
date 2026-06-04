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
    return positiveNumber(turnover) * getRoyaltyRate(turnover);
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
      officeBeforeRoyalty: commission - payout - referral
    };
  }

  function calculateExpenses(expenses) {
    return (expenses || []).reduce(function (sum, expense) {
      return sum + positiveNumber(expense.amount);
    }, 0);
  }

  function calculateOffice(state) {
    var agents = (state.agents || []).map(calculateAgent);
    var agentTurnover = agents.reduce(function (sum, agent) { return sum + agent.commission; }, 0);
    var ownerSales = positiveNumber(state.ownerSales);
    var totalTurnover = agentTurnover + ownerSales;
    var agentPayouts = agents.reduce(function (sum, agent) { return sum + agent.payout; }, 0);
    var referrals = agents.reduce(function (sum, agent) { return sum + agent.referral; }, 0);
    var expenses = calculateExpenses(state.expenses || []);
    var royaltyWithoutOwner = calculateRoyalty(agentTurnover);
    var royaltyWithOwner = calculateRoyalty(totalTurnover);
    var resultWithoutOwner = agentTurnover - agentPayouts - referrals - royaltyWithoutOwner - expenses;
    var resultWithOwner = totalTurnover - agentPayouts - referrals - royaltyWithOwner - expenses;

    return {
      agents: agents,
      expenses: expenses,
      agentTurnover: agentTurnover,
      ownerSales: ownerSales,
      totalTurnover: totalTurnover,
      agentPayouts: agentPayouts,
      referrals: referrals,
      royaltyWithoutOwner: royaltyWithoutOwner,
      royaltyWithOwner: royaltyWithOwner,
      resultWithoutOwner: resultWithoutOwner,
      resultWithOwner: resultWithOwner,
      warningOwnerDependency: resultWithoutOwner < -0.5 && resultWithOwner > 0.5
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

  window.toNumber = toNumber;
  window.positiveNumber = positiveNumber;
  window.getRoyaltyRate = getRoyaltyRate;
  window.calculateRoyalty = calculateRoyalty;
  window.getDealRate = getDealRate;
  window.calculateAgent = calculateAgent;
  window.calculateExpenses = calculateExpenses;
  window.calculateOffice = calculateOffice;
  window.money = money;
  window.percent = percent;
}());
