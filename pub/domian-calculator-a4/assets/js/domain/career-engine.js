(function (root) {
  'use strict';

  function requirePolicy() {
    if (!root.MOTIVATION_POLICY_2026) {
      throw new Error('CareerEngine requires MOTIVATION_POLICY_2026.');
    }
    return root.MOTIVATION_POLICY_2026;
  }

  function dateOnly(value) {
    if (!value) {
      return null;
    }
    var match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return null;
    }
    var date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function fullMonthsBetween(startValue, endValue) {
    var start = dateOnly(startValue);
    var end = dateOnly(endValue);
    var months;

    if (!start || !end || end < start) {
      return 0;
    }

    months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12
      + end.getUTCMonth() - start.getUTCMonth();
    if (end.getUTCDate() < start.getUTCDate()) {
      months -= 1;
    }
    return Math.max(0, months);
  }

  function normalizePartnerPackage(packageId) {
    var policy = requirePolicy();
    var matched = policy.getPackage(packageId);
    return matched && matched.status === 'partner' ? matched : policy.getPackage('standard');
  }

  function getTenurePackage(input) {
    var policy = requirePolicy();
    var source = input || {};
    var status = source.status === 'trainee' ? 'trainee' : 'partner';
    var months = fullMonthsBetween(source.employmentStartDate, source.asOfDate);
    var packageItem = policy.getPackageByTenureMonths(months, status);

    return {
      packageId: packageItem.id,
      months: months,
      years: Math.floor(months / 12),
      hasStartDate: Boolean(dateOnly(source.employmentStartDate))
    };
  }

  function getPerformanceDecision(input) {
    var policy = requirePolicy();
    var source = input || {};
    var previous = normalizePartnerPackage(source.previousPerformancePackage);
    var result = source.halfYearResult || {};
    var confirmed = result.confirmed === true;
    var level = Math.floor(Number(result.level) || 0);
    var target;
    var next;
    var action;

    if (!confirmed || level < 1 || level > 7) {
      return {
        previousPackage: previous.id,
        targetPackage: null,
        performancePackage: previous.id,
        action: 'hold',
        status: 'unconfirmed',
        reason: 'Результат полугодия не подтверждён, поэтому пакет по результатам не изменился. Пакет по стажу рассчитан отдельно.'
      };
    }

    target = policy.getPackageByPerformanceLevel(level);
    if (target.rank > previous.rank) {
      next = target;
      action = 'promote';
    } else if (target.rank < previous.rank) {
      next = policy.getPackageByRank(Math.max(1, previous.rank - 1));
      action = 'demote-one-step';
    } else {
      next = previous;
      action = 'hold';
    }

    return {
      previousPackage: previous.id,
      targetPackage: target.id,
      performancePackage: next.id,
      action: action,
      status: 'confirmed',
      reason: action === 'demote-one-step'
        ? 'Результат ниже требований текущего пакета, поэтому пакет по результатам снижен на одну ступень.'
        : (action === 'promote'
          ? 'Подтверждённый уровень повышает пакет по результатам.'
          : 'Подтверждённый уровень соответствует текущему пакету по результатам.')
    };
  }

  function calculateDecision(input) {
    var policy = requirePolicy();
    var source = input || {};
    var tenure = getTenurePackage(source);
    var performance;
    var tenurePackage;
    var performancePackage;
    var effectivePackage;
    var contractualFloorRate = Math.max(0, Math.min(100, Number(source.contractualFloorRate) || 0));

    if (source.status === 'trainee') {
      performance = {
        previousPackage: null,
        targetPackage: null,
        performancePackage: 'newcomer',
        action: 'not-applicable',
        status: 'trainee',
        reason: 'Для стажёра пакет по результатам ещё не применяется.'
      };
    } else {
      performance = getPerformanceDecision(source);
    }

    tenurePackage = policy.getPackage(tenure.packageId);
    performancePackage = policy.getPackage(performance.performancePackage);
    effectivePackage = tenurePackage.rank >= performancePackage.rank
      ? tenurePackage
      : performancePackage;

    return {
      policyVersion: policy.id,
      asOfDate: source.asOfDate || '',
      effectivePeriod: source.effectivePeriod || '',
      tenureMonths: tenure.months,
      tenurePackage: tenurePackage.id,
      performancePackage: performancePackage.id,
      previousPerformancePackage: performance.previousPackage,
      performanceTargetPackage: performance.targetPackage,
      performanceAction: performance.action,
      performanceStatus: performance.status,
      performanceReason: performance.reason,
      effectivePackage: effectivePackage.id,
      effectivePackageLabel: effectivePackage.label,
      packageFloorRate: effectivePackage.floorRate,
      contractualFloorRate: contractualFloorRate,
      effectiveFloorRate: Math.max(effectivePackage.floorRate, contractualFloorRate),
      source: tenurePackage.rank > performancePackage.rank
        ? 'tenure'
        : (performancePackage.rank > tenurePackage.rank ? 'performance' : 'both'),
      warnings: tenure.hasStartDate
        ? []
        : ['Дата начала работы не указана. Поэтому по стажу выбран начальный пакет для текущего статуса.']
    };
  }

  root.CareerEngine = {
    fullMonthsBetween: fullMonthsBetween,
    getTenurePackage: getTenurePackage,
    getPerformanceDecision: getPerformanceDecision,
    calculateDecision: calculateDecision
  };
}(typeof window !== 'undefined' ? window : globalThis));
