(function (root) {
  'use strict';

  function requireDependency(name) {
    if (!root[name]) {
      throw new Error('CareerReportEngine requires ' + name + '.');
    }
    return root[name];
  }

  function positiveNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  function halfYearLevel(commission) {
    var policy = requireDependency('MOTIVATION_POLICY_2026');
    var amount = positiveNumber(commission);
    var level = 0;
    policy.halfYearLevels.forEach(function (item) {
      if (amount >= item.threshold) {
        level = item.level;
      }
    });
    return level;
  }

  function hasOwn(source, key) {
    return Boolean(source && Object.prototype.hasOwnProperty.call(source, key));
  }

  function normalizedLevel(value) {
    var level = Math.floor(Number(value) || 0);
    return level >= 1 && level <= 7 ? level : 0;
  }

  function savedHalfYearLevel(input) {
    var source = input && typeof input === 'object' ? input : {};
    var savedResult = source.halfYearResult && typeof source.halfYearResult === 'object'
      ? source.halfYearResult
      : {};

    if (source.halfYearCommissionAvailable !== false && hasOwn(source, 'halfYearCommission')) {
      return halfYearLevel(source.halfYearCommission);
    }
    return normalizedLevel(savedResult.level || source.halfYearLevel);
  }

  function levelFromValues(values) {
    var source = values && typeof values === 'object' ? values : {};
    return source.halfYearCommissionAvailable === false
      ? normalizedLevel(source.legacyHalfYearLevel)
      : halfYearLevel(source.halfYearCommission);
  }

  function valuesForPeriod(exactDecision, previousDecision, fallbackDate) {
    var exact = exactDecision && typeof exactDecision === 'object' ? exactDecision : null;
    var exactInput = exact && exact.input && typeof exact.input === 'object' ? exact.input : {};
    var exactResult = exact && exact.result && typeof exact.result === 'object' ? exact.result : {};
    var previousResult = previousDecision && previousDecision.result && typeof previousDecision.result === 'object'
      ? previousDecision.result
      : {};
    var commissionAvailable = !exact
      || (exactInput.halfYearCommissionAvailable !== false && hasOwn(exactInput, 'halfYearCommission'));

    return {
      asOfDate: exactInput.asOfDate || fallbackDate || '',
      halfYearCommission: exact ? positiveNumber(exactInput.halfYearCommission) : 0,
      halfYearCommissionAvailable: commissionAvailable,
      legacyHalfYearLevel: exact && !commissionAvailable ? savedHalfYearLevel(exactInput) : 0,
      halfYearResultConfirmed: exact
        ? Boolean(exactInput.halfYearResult && exactInput.halfYearResult.confirmed === true)
        : true,
      previousPerformancePackage: exact
        ? (exactInput.previousPerformancePackage || exactResult.performancePackage || previousResult.performancePackage || 'standard')
        : (previousResult.performancePackage || 'standard'),
      quarterDeposits: exact ? positiveNumber(exactInput.quarterDeposits) : 0,
      quarterlyCommission: exact ? positiveNumber(exactInput.quarterlyCommission) : 0,
      previousMonthDeposits: exact ? positiveNumber(exactInput.previousMonthDeposits) : 0,
      officePlanCompleted: exact ? exactInput.officePlanCompleted === true : false,
      agentParticipated: exact ? exactInput.agentParticipated === true : false,
      travelQuarterPartnershipConfirmed: exact
        ? exactInput.travelQuarterPartnershipConfirmed === true
        : false,
      mountainSeaCost: exact && exactInput.mountainSeaCost !== undefined
        ? positiveNumber(exactInput.mountainSeaCost)
        : 15000,
      travelCost: exact && exactInput.travelCost !== undefined
        ? positiveNumber(exactInput.travelCost)
        : 100000,
      corporateCost: exact && exactInput.corporateCost !== undefined
        ? positiveNumber(exactInput.corporateCost)
        : 20000
    };
  }

  function periodFromSelection(year, half) {
    var normalizedYear = Math.max(2000, Math.min(2100, Math.floor(Number(year) || new Date().getFullYear())));
    return normalizedYear + (String(half) === '2' ? '-07' : '-01');
  }

  function reportTitle(year, half) {
    return 'НА ' + (String(half) === '2' ? '2' : '1') + ' ПОЛУГОДИЕ ' + year + ' ГОДА';
  }

  function fullYearsMonths(months, hasDate) {
    var count = Math.max(0, Math.floor(Number(months) || 0));
    var years = Math.floor(count / 12);
    var rest = count % 12;
    var parts = [];

    function word(number, one, few, many) {
      var mod100 = number % 100;
      var mod10 = number % 10;
      if (mod100 >= 11 && mod100 <= 14) {
        return many;
      }
      if (mod10 === 1) {
        return one;
      }
      return mod10 >= 2 && mod10 <= 4 ? few : many;
    }

    if (!hasDate) {
      return 'Дата не указана';
    }
    if (years) {
      parts.push(years + ' ' + word(years, 'год', 'года', 'лет'));
    }
    if (rest) {
      parts.push(rest + ' ' + word(rest, 'месяц', 'месяца', 'месяцев'));
    }
    return parts.length ? parts.join(' ') : '0 месяцев';
  }

  function findBenefit(benefits, id) {
    return benefits && Array.isArray(benefits.items)
      ? benefits.items.find(function (item) { return item.id === id; }) || null
      : null;
  }

  function benefitLabel(item, includeAmount) {
    var amount;
    if (!item || !item.available) {
      return '—';
    }
    if (item.payer === 'office') {
      if (includeAmount && item.amountStatus !== 'external-schedule') {
        amount = positiveNumber(item.officeCost);
        return 'Офис' + (amount ? ' · ' + Math.round(amount).toLocaleString('ru-RU') + ' ₽' : '');
      }
      return 'Офис';
    }
    return item.payer === 'agent' ? 'Агент' : '—';
  }

  function buildInput(profile, values, period, previousDecision) {
    var level = levelFromValues(values);
    var confirmed = values.halfYearResultConfirmed === true;
    var previousPackage = values.previousPerformancePackage
      || (previousDecision && previousDecision.result && previousDecision.result.performancePackage)
      || 'standard';
    return {
      status: profile.status === 'trainee' ? 'trainee' : 'partner',
      employmentStartDate: profile.employmentStartDate || '',
      partnerStartDate: profile.partnerStartDate || '',
      contractualFloorRate: positiveNumber(profile.contractualFloorRate),
      asOfDate: values.asOfDate || '',
      effectivePeriod: period,
      previousPerformancePackage: previousPackage,
      halfYearCommission: positiveNumber(values.halfYearCommission),
      halfYearCommissionAvailable: values.halfYearCommissionAvailable !== false,
      halfYearResult: { confirmed: confirmed, level: confirmed ? level : null },
      halfYearLevel: confirmed ? level : 0,
      quarterDeposits: positiveNumber(values.quarterDeposits),
      quarterlyCommission: positiveNumber(values.quarterlyCommission),
      previousMonthDeposits: positiveNumber(values.previousMonthDeposits),
      officePlanCompleted: values.officePlanCompleted === true,
      agentParticipated: values.agentParticipated === true,
      travelQuarterPartnershipConfirmed: values.travelQuarterPartnershipConfirmed === true,
      mountainSeaCost: positiveNumber(values.mountainSeaCost),
      travelCost: positiveNumber(values.travelCost),
      corporateCost: positiveNumber(values.corporateCost),
      selectedPeriod: period
    };
  }

  function calculateRow(profile, values, period, previousDecision) {
    var careerEngine = requireDependency('CareerEngine');
    var benefitEngine = requireDependency('BenefitEngine');
    var input = buildInput(profile, values || {}, period, previousDecision);
    var decision = careerEngine.calculateDecision(input);
    var benefits = benefitEngine.calculateBenefits(Object.assign({}, input, { decision: decision }));
    var stipend = findBenefit(benefits, 'stipend');
    return {
      profile: profile,
      input: input,
      result: decision,
      benefits: benefits,
      level: savedHalfYearLevel(input),
      tenureLabel: fullYearsMonths(decision.tenureMonths, Boolean(profile.employmentStartDate)),
      motivation: {
        mountainSea: benefitLabel(findBenefit(benefits, 'mountainSea')),
        travel: benefitLabel(findBenefit(benefits, 'travel')),
        advertising: benefitLabel(findBenefit(benefits, 'leadGeneration'), true),
        corporate: benefitLabel(findBenefit(benefits, 'corporate')),
        stipend: stipend && stipend.available
          ? Math.round(positiveNumber(stipend.officeCost)).toLocaleString('ru-RU') + ' ₽/мес.'
          : '—'
      }
    };
  }

  root.CareerReportEngine = {
    positiveNumber: positiveNumber,
    halfYearLevel: halfYearLevel,
    savedHalfYearLevel: savedHalfYearLevel,
    levelFromValues: levelFromValues,
    valuesForPeriod: valuesForPeriod,
    periodFromSelection: periodFromSelection,
    reportTitle: reportTitle,
    fullYearsMonths: fullYearsMonths,
    benefitLabel: benefitLabel,
    buildInput: buildInput,
    calculateRow: calculateRow
  };
}(typeof window !== 'undefined' ? window : globalThis));
