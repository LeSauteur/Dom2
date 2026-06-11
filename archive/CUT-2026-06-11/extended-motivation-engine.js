'use strict';

var periods = require('./extended-periods');
var motivationEvents = require('./extended-motivation-events');

var PARTNERSHIP_THRESHOLD = 250000;
var STIPEND_LEVELS = [
  { threshold: 250000, level: 1, monthly: 0 },
  { threshold: 400000, level: 2, monthly: 0 },
  { threshold: 600000, level: 3, monthly: 3000 },
  { threshold: 800000, level: 4, monthly: 4000 },
  { threshold: 1000000, level: 5, monthly: 5000 },
  { threshold: 1200000, level: 6, monthly: 6000 },
  { threshold: 1500000, level: 7, monthly: 7000 }
];

function toNumber(value) {
  var numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatInteger(value) {
  return String(Math.trunc(toNumber(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function getQuarterData(agent, quarter) {
  if (!agent || !agent.quarterlyData) {
    return null;
  }

  return agent.quarterlyData[quarter] || null;
}

function getStipendLevel(commission) {
  var amount = toNumber(commission);
  var matched = { threshold: 0, level: 0, monthly: 0 };
  var i;

  for (i = 0; i < STIPEND_LEVELS.length; i += 1) {
    if (amount >= STIPEND_LEVELS[i].threshold) {
      matched = STIPEND_LEVELS[i];
    }
  }

  return matched;
}

function calculatePartnership(agent, quarter) {
  var quarterData = getQuarterData(agent, quarter);
  var deposits = quarterData ? toNumber(quarterData.deposits) : 0;
  var override = quarterData ? quarterData.partnershipOverride : null;
  var result = {
    quarter: quarter,
    confirmed: false,
    source: quarterData ? 'auto' : 'missing',
    deposits: deposits,
    threshold: PARTNERSHIP_THRESHOLD,
    reason: 'Нет данных за квартал'
  };

  if (!quarterData) {
    return result;
  }

  if (override === 'confirmed') {
    result.confirmed = true;
    result.source = 'manual';
    result.reason = 'Подтверждено вручную';
    return result;
  }

  if (override === 'not_confirmed') {
    result.confirmed = false;
    result.source = 'manual';
    result.reason = 'Не подтверждено вручную';
    return result;
  }

  result.confirmed = deposits >= PARTNERSHIP_THRESHOLD;
  result.reason = result.confirmed
    ? ('Задатки ' + formatInteger(deposits) + ' >= ' + formatInteger(PARTNERSHIP_THRESHOLD))
    : ('Задатки ' + formatInteger(deposits) + ' < ' + formatInteger(PARTNERSHIP_THRESHOLD));
  return result;
}

function calculateStipend(agent, resultQuarter) {
  var quarterData = getQuarterData(agent, resultQuarter);
  var commission = quarterData ? toNumber(quarterData.commission) : 0;
  var level = getStipendLevel(commission);
  var paymentQuarter = periods.getNextQuarter(resultQuarter);
  var stipendMonthly = level.monthly;

  return {
    resultQuarter: resultQuarter,
    paymentQuarter: paymentQuarter,
    commission: commission,
    level: level.level,
    stipendMonthly: stipendMonthly,
    obligation: stipendMonthly * 3,
    expenseMonths: periods.getQuarterMonths(paymentQuarter)
  };
}

function calculatePersonalLevel(amount, periodType) {
  var factor = 1;
  var i;
  var thresholds = [
    250000,
    400000,
    600000,
    800000,
    1000000,
    1200000,
    1500000
  ];

  if (periodType === 'halfYear') {
    factor = 2;
  } else if (periodType === 'year') {
    factor = 4;
  }

  amount = toNumber(amount);
  for (i = thresholds.length - 1; i >= 0; i -= 1) {
    if (amount >= thresholds[i] * factor) {
      return i + 1;
    }
  }

  return 0;
}

function pushReason(target, message) {
  if (message) {
    target.push(message);
  }
}

function evaluateTripEvent(agent, event, context, result) {
  var officePlan;
  var requiredPlan;
  var participation;
  var partnership;
  var personalLevel;
  var amount;

  if (event.requiresPartnership) {
    partnership = calculatePartnership(agent, event.eligibilityQuarter);
    if (!partnership.confirmed) {
      result.disqualifiers.push('Партнёрство не подтверждено за ' + event.eligibilityQuarter);
    } else {
      result.reasons.push('Партнёрство подтверждено за ' + event.eligibilityQuarter);
    }
  }

  if (event.requiresPersonalLevel) {
    personalLevel = calculatePersonalLevel(
      event.resultPeriod && event.resultPeriod.type === 'halfYear'
        ? toNumber(agent && agent.halfYearCommission)
        : toNumber(agent && agent.quarterlyCommission),
      event.resultPeriod ? event.resultPeriod.type : 'quarter'
    );
    if (personalLevel < event.requiresPersonalLevel) {
      result.disqualifiers.push('Личный уровень ниже ' + event.requiresPersonalLevel);
    } else {
      result.reasons.push('Личный уровень ' + personalLevel + ' подходит для поездки');
    }
  }

  if (event.requiresOfficePlan) {
    officePlan = context && context.officePlans ? context.officePlans[event.id] : null;
    if (!officePlan) {
      result.disqualifiers.push('Нет данных по плану офиса');
    } else {
      requiredPlan = toNumber(officePlan.partnerCount) * toNumber(event.officePlanPerPartner);
      if (toNumber(officePlan.actualResult) >= requiredPlan) {
        result.reasons.push('План офиса выполнен');
      } else {
        result.disqualifiers.push('План офиса не выполнен');
      }
      participation = officePlan.agentParticipation && officePlan.agentParticipation[agent.id];
      if (participation) {
        result.reasons.push('Участие агента отмечено');
      } else {
        result.disqualifiers.push('Участие агента не отмечено');
      }
    }
  }

  if (event.requiresExpenseMonthInput && !event.expenseMonth) {
    result.warnings.push('Нужно указать месяц расходов');
    result.disqualifiers.push('Месяц расходов не задан');
  }

  if (event.costIsConfigurable) {
    amount = context && context.configurableCosts ? context.configurableCosts[event.id] : null;
    if (amount === null || amount === undefined || amount === '') {
      result.warnings.push('Не указана стоимость события');
      result.disqualifiers.push('Стоимость события не указана');
    } else {
      result.amount = toNumber(amount);
    }
  } else {
    result.amount = toNumber(event.costPerAgent);
  }
}

function evaluateCorporateEvent(agent, event, context, result) {
  var partnership;
  var amount;

  if (event.requiresPartnership) {
    partnership = calculatePartnership(agent, event.eligibilityQuarter);
    if (!partnership.confirmed) {
      result.disqualifiers.push('Партнёрство не подтверждено за ' + event.eligibilityQuarter);
    } else {
      result.reasons.push('Партнёрство подтверждено за ' + event.eligibilityQuarter);
    }
  }

  amount = context && context.configurableCosts ? context.configurableCosts[event.id] : null;
  if (amount === null || amount === undefined || amount === '') {
    result.warnings.push('Не указана стоимость события');
    result.disqualifiers.push('Стоимость события не указана');
  } else {
    result.amount = toNumber(amount);
  }
}

function evaluateMotivationEvent(agent, event, context) {
  var result = {
    agentId: agent && agent.id ? agent.id : '',
    eventId: event && event.id ? event.id : '',
    qualified: false,
    amount: 0,
    expenseMonth: event && event.expenseMonth ? event.expenseMonth : null,
    reasons: [],
    warnings: [],
    disqualifiers: []
  };

  if (!event) {
    result.warnings.push('Событие не задано');
    return result;
  }

  if (event.type === 'trip' || event.type === 'travel') {
    evaluateTripEvent(agent || {}, event, context || {}, result);
  } else if (event.type === 'corporate') {
    evaluateCorporateEvent(agent || {}, event, context || {}, result);
  } else {
    result.warnings.push('Неизвестный тип события');
  }

  if (result.disqualifiers.length === 0) {
    result.qualified = true;
  } else {
    result.amount = 0;
  }

  return result;
}

module.exports = {
  getQuarterData: getQuarterData,
  calculatePartnership: calculatePartnership,
  calculateStipend: calculateStipend,
  calculatePersonalLevel: calculatePersonalLevel,
  evaluateMotivationEvent: evaluateMotivationEvent,
  MOTIVATION_EVENTS_2026: motivationEvents.MOTIVATION_EVENTS_2026,
  STIPEND_LEVELS: STIPEND_LEVELS
};
