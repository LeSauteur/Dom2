(function (root) {
  'use strict';

  function requirePolicy() {
    if (!root.MOTIVATION_POLICY_2026) {
      throw new Error('BenefitEngine requires MOTIVATION_POLICY_2026.');
    }
    return root.MOTIVATION_POLICY_2026;
  }

  function positiveNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  function getQuarterLevel(commission) {
    var policy = requirePolicy();
    var amount = positiveNumber(commission);
    var matched = { level: 0, threshold: 0, stipendMonthly: 0 };

    policy.quarterLevels.forEach(function (item) {
      if (amount >= item.threshold) {
        matched = item;
      }
    });

    return matched;
  }

  function benefit(config) {
    var available = Boolean(config.available);
    var payer = available ? config.payer : 'none';
    var amount = available ? positiveNumber(config.amount) : 0;

    return {
      id: config.id,
      label: config.label,
      available: available,
      reason: config.reason,
      payer: payer,
      officeCost: payer === 'office' ? amount : 0,
      agentCost: payer === 'agent' ? amount : 0,
      resultPeriod: config.resultPeriod || '',
      accrualPeriod: config.accrualPeriod || '',
      paymentPeriod: config.paymentPeriod || '',
      reserve: payer === 'office' ? amount : 0,
      amountStatus: config.amountStatus || 'entered'
    };
  }

  function calculateBenefits(input) {
    var policy = requirePolicy();
    var source = input || {};
    var decision = source.decision || {};
    var packageItem = policy.getPackage(decision.effectivePackage || 'standard')
      || policy.getPackage('standard');
    var isTrainee = packageItem.status === 'trainee';
    var partnershipConfirmed = !isTrainee
      && positiveNumber(source.quarterDeposits) >= policy.partnershipQuarterDeposits;
    var packageId = packageItem.id;
    var quarterLevel = getQuarterLevel(source.quarterlyCommission);
    var stipendPackage = packageId === 'standard' || packageId === 'extended';
    var officeMountainSea = ['standard', 'extended', 'advanced', 'premium'].indexOf(packageId) >= 0;
    var agentMountainSea = packageId === 'premiumPlus' || packageId === 'individual';
    var officeTravel = ['standard', 'extended', 'advanced'].indexOf(packageId) >= 0;
    var agentTravel = ['premium', 'premiumPlus', 'individual'].indexOf(packageId) >= 0;
    var officeCorporate = ['standard', 'extended', 'advanced', 'premium', 'premiumPlus'].indexOf(packageId) >= 0;
    var agentCorporate = packageId === 'individual';
    var planCompleted = source.officePlanCompleted === true;
    var agentParticipated = source.agentParticipated === true;
    var travelLevelReached = Number(source.halfYearLevel) >= policy.travelMinimumHalfYearLevel;
    var travelPartnershipConfirmed = source.travelQuarterPartnershipConfirmed === true;
    var items = [];
    var advertisingAmount = packageId === 'individual'
      ? Math.min(
        positiveNumber(source.previousMonthDeposits) * policy.individualAdvertisingRate,
        policy.individualAdvertisingLimit
      )
      : 0;
    var officeCostTotal;
    var agentCostTotal;

    items.push(benefit({
      id: 'leadGeneration',
      label: packageId === 'individual' ? 'Индивидуальная реклама' : 'Лидогенерация',
      available: isTrainee || partnershipConfirmed,
      reason: isTrainee
        ? 'Офис размещает рекламу объектов стажёра.'
        : (partnershipConfirmed
          ? (packageId === 'individual'
            ? '3% от оборота по задаткам предыдущего месяца, максимум 15 000 ₽.'
            : 'Мотивация доступна. Её сумма определяется отдельно и в этом калькуляторе не рассчитывается.')
          : 'За квартал меньше 250 000 ₽ задатков. Поэтому мотивация недоступна.'),
      payer: 'office',
      amount: advertisingAmount,
      amountStatus: packageId === 'individual' ? 'calculated' : 'external-schedule',
      resultPeriod: source.previousMonthPeriod,
      accrualPeriod: source.selectedPeriod,
      paymentPeriod: source.selectedPeriod
    }));

    items.push(benefit({
      id: 'stipend',
      label: 'Стипендия',
      available: partnershipConfirmed && stipendPackage && quarterLevel.level >= 3,
      reason: !partnershipConfirmed
        ? 'За квартал меньше 250 000 ₽ задатков. Поэтому стипендия недоступна.'
        : (!stipendPackage
          ? 'Стипендия предусмотрена только для пакетов «Стандарт» и «Расширенный».'
          : (quarterLevel.level >= 3
            ? 'Ежемесячная выплата в следующем квартале по подтверждённому уровню.'
            : 'Результат за квартал ниже уровня, с которого выплачивается стипендия.')),
      payer: 'office',
      amount: quarterLevel.stipendMonthly,
      amountStatus: 'calculated',
      resultPeriod: source.quarterResultPeriod,
      accrualPeriod: source.selectedPeriod,
      paymentPeriod: source.stipendPaymentPeriod
    }));

    items.push(benefit({
      id: 'mountainSea',
      label: 'Горы / Море',
      available: partnershipConfirmed
        && (officeMountainSea || agentMountainSea)
        && planCompleted
        && agentParticipated,
      reason: !partnershipConfirmed
        ? 'За квартал меньше 250 000 ₽ задатков. Поэтому поездка недоступна.'
        : (!planCompleted
          ? 'Не подтверждено выполнение плана офиса в акционный период.'
          : (!agentParticipated
            ? 'Не подтверждено участие агента в выполнении плана.'
            : (agentMountainSea ? 'Право есть, поездку оплачивает агент.' : 'Право есть, поездку оплачивает офис.'))),
      payer: agentMountainSea ? 'agent' : 'office',
      amount: source.mountainSeaCost,
      resultPeriod: source.promotionPeriod,
      accrualPeriod: source.selectedPeriod,
      paymentPeriod: source.selectedPeriod
    }));

    items.push(benefit({
      id: 'travel',
      label: 'Путешествуй с Домиан',
      available: partnershipConfirmed
        && (officeTravel || agentTravel)
        && travelLevelReached
        && travelPartnershipConfirmed,
      reason: !partnershipConfirmed
        ? 'За квартал меньше 250 000 ₽ задатков. Поэтому программа недоступна.'
        : (!travelLevelReached
          ? 'Не достигнут 4-й уровень за полугодие.'
          : (!travelPartnershipConfirmed
            ? 'Не подтверждено партнёрство в квартале перед поездкой.'
            : (agentTravel ? 'Право есть, поездку оплачивает агент.' : 'Право есть, поездку оплачивает офис.'))),
      payer: agentTravel ? 'agent' : 'office',
      amount: source.travelCost,
      resultPeriod: source.halfYearResultPeriod,
      accrualPeriod: source.selectedPeriod,
      paymentPeriod: source.travelPaymentPeriod
    }));

    items.push(benefit({
      id: 'corporate',
      label: 'Корпоративы',
      available: partnershipConfirmed && (officeCorporate || agentCorporate),
      reason: !partnershipConfirmed
        ? 'За квартал меньше 250 000 ₽ задатков. Поэтому корпоратив недоступен.'
        : (agentCorporate ? 'Право есть, участие оплачивает агент.' : 'Право есть, участие оплачивает офис.'),
      payer: agentCorporate ? 'agent' : 'office',
      amount: source.corporateCost,
      resultPeriod: source.quarterResultPeriod,
      accrualPeriod: source.selectedPeriod,
      paymentPeriod: source.selectedPeriod
    }));

    officeCostTotal = items.reduce(function (sum, item) {
      return sum + item.officeCost;
    }, 0);
    agentCostTotal = items.reduce(function (sum, item) {
      return sum + item.agentCost;
    }, 0);

    return {
      policyVersion: policy.id,
      packageId: packageId,
      partnershipConfirmed: partnershipConfirmed,
      quarterLevel: quarterLevel.level,
      items: items,
      officeCostTotal: officeCostTotal,
      agentCostTotal: agentCostTotal,
      officeReserveTotal: items.reduce(function (sum, item) {
        return sum + item.reserve;
      }, 0)
    };
  }

  root.BenefitEngine = {
    getQuarterLevel: getQuarterLevel,
    calculateBenefits: calculateBenefits
  };
}(typeof window !== 'undefined' ? window : globalThis));
