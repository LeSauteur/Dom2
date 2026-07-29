(function (root) {
  'use strict';

  function requirePolicy() {
    if (!root.MOTIVATION_POLICY_2026) {
      throw new Error('MotivationCalculator2026 requires MOTIVATION_POLICY_2026.');
    }
    return root.MOTIVATION_POLICY_2026;
  }

  function requireBenefitEngine() {
    if (!root.BenefitEngine) {
      throw new Error('MotivationCalculator2026 requires BenefitEngine.');
    }
    return root.BenefitEngine;
  }

  function positiveNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  function cloneAgent(agent) {
    var copy = Object.assign({}, agent || {});
    ['dealsInput', 'dealManualRates', 'dealNewbuildSoloFlags', 'dealDepositOrders', 'boostedRates'].forEach(function (key) {
      if (Array.isArray(copy[key])) {
        copy[key] = copy[key].slice();
      }
    });
    if (copy.motivation && typeof copy.motivation === 'object') {
      copy.motivation = Object.assign({}, copy.motivation);
    }
    return copy;
  }

  function getHalfYearLevel(commission) {
    var policy = requirePolicy();
    var amount = positiveNumber(commission);
    var level = 0;

    policy.halfYearLevels.forEach(function (item) {
      if (amount >= item.threshold) {
        level = item.level;
      }
    });
    return level;
  }

  function getPackage(packageId, status) {
    var policy = requirePolicy();
    var packageItem = policy.getPackage(packageId);
    if (packageItem) {
      return packageItem;
    }
    return policy.getPackage(status === 'trainee' ? 'newcomer' : 'standard');
  }

  function buildBenefitInput(agent, packageItem) {
    var source = agent || {};
    return {
      decision: {
        effectivePackage: packageItem.id
      },
      quarterDeposits: positiveNumber(source.quarterlyDeposits),
      quarterlyCommission: positiveNumber(source.quarterlyCommission),
      previousMonthDeposits: positiveNumber(source.careerPreviousMonthDeposits),
      halfYearLevel: getHalfYearLevel(source.halfYearCommission),
      officePlanCompleted: source.careerOfficePlanCompleted === true,
      agentParticipated: source.careerAgentParticipated === true,
      travelQuarterPartnershipConfirmed: source.travelQuarterPartnershipConfirmed === true,
      mountainSeaCost: positiveNumber(source.careerMountainSeaCost),
      travelCost: positiveNumber(source.careerTravelCost),
      corporateCost: positiveNumber(source.careerCorporateCost),
      selectedPeriod: String(source.selectedPeriod || '')
    };
  }

  function buildIntegration(agent, packageId) {
    var policy = requirePolicy();
    var packageItem = getPackage(packageId || agent.careerPackageId, agent.status);
    var benefits = requireBenefitEngine().calculateBenefits(buildBenefitInput(agent, packageItem));
    var officeItems = benefits.items.filter(function (item) {
      return item.payer === 'office' && positiveNumber(item.officeCost) > 0;
    });
    var agentItems = benefits.items.filter(function (item) {
      return item.payer === 'agent' && positiveNumber(item.agentCost) > 0;
    });
    var contractualFloorRate = Math.min(100, positiveNumber(agent.contractualFloorRate));

    return {
      source: 'manual-package',
      effectivePackage: packageItem.id,
      effectivePackageLabel: packageItem.label,
      packageFloorRate: packageItem.floorRate,
      contractualFloorRate: contractualFloorRate,
      effectiveFloorRate: Math.max(packageItem.floorRate, contractualFloorRate),
      motivationReserveMonthly: benefits.officeCostTotal,
      motivationAgentCost: benefits.agentCostTotal,
      motivationCosts: officeItems,
      agentMotivationCosts: agentItems,
      benefits: benefits,
      policyVersion: policy.id,
      effectivePeriod: String(agent.selectedPeriod || '')
    };
  }

  function applyPackage(agent, packageId) {
    var packageItem = getPackage(packageId, agent && agent.status);
    var source = cloneAgent(agent);
    var integration = buildIntegration(source, packageItem.id);

    source.status = packageItem.status;
    source.careerPackageId = packageItem.id;
    source.packageFloorRate = integration.packageFloorRate;
    source.contractualFloorRate = integration.contractualFloorRate;
    source.careerIntegration = integration;
    return source;
  }

  function getStatus(contribution) {
    if (contribution < -5000) {
      return 'Не окупается';
    }
    if (contribution <= 5000) {
      return 'На грани';
    }
    return 'Окупается';
  }

  function calculateVariant(agent, packageId, expenseShare) {
    if (typeof root.calculateAgent !== 'function' || typeof root.calculateRoyalty !== 'function') {
      throw new Error('MotivationCalculator2026 requires A4 calculations.');
    }

    var source = applyPackage(agent, packageId);
    var integration = source.careerIntegration;
    var calculated = root.calculateAgent(source);
    var royalty = root.calculateRoyalty(calculated.commission);
    var normalizedExpenseShare = positiveNumber(expenseShare);
    var contribution = Math.round(
      calculated.commission
      - calculated.payout
      - calculated.referral
      - integration.motivationReserveMonthly
      - royalty
      - normalizedExpenseShare
    );

    return {
      packageId: integration.effectivePackage,
      packageLabel: integration.effectivePackageLabel,
      packageFloorRate: integration.packageFloorRate,
      effectiveFloorRate: integration.effectiveFloorRate,
      commission: calculated.commission,
      appliedRates: calculated.deals.map(function (deal) { return deal.rate; }),
      payout: calculated.payout,
      referral: calculated.referral,
      officeMotivationCost: integration.motivationReserveMonthly,
      agentMotivationCost: integration.motivationAgentCost,
      royalty: royalty,
      expenseShare: normalizedExpenseShare,
      contribution: contribution,
      status: getStatus(contribution),
      benefits: integration.benefits
    };
  }

  function scaleAgentCommission(agent, commission) {
    var source = cloneAgent(agent);
    var targetCommission = positiveNumber(commission);
    var sourceDeals;
    var sourceTotal;
    var rowCount;

    if (source.commissionMode !== 'exact') {
      source.commission = targetCommission;
      return source;
    }

    sourceDeals = Array.isArray(source.dealsInput) ? source.dealsInput.map(positiveNumber) : [];
    sourceTotal = sourceDeals.reduce(function (sum, amount) { return sum + amount; }, 0);
    rowCount = Math.max(1, sourceDeals.filter(function (amount) { return amount > 0; }).length || sourceDeals.length);

    if (sourceTotal > 0) {
      source.dealsInput = sourceDeals.map(function (amount) {
        return amount > 0 ? targetCommission * amount / sourceTotal : 0;
      });
    } else {
      source.dealsInput = Array.from({ length: rowCount }, function () {
        return targetCommission / rowCount;
      });
    }
    source.commission = targetCommission;
    source.dealCount = rowCount;
    return source;
  }

  function findBreakEvenCommission(agent, packageId, expenseShare) {
    var coarseStep = 10000;
    var preciseStep = 1000;
    var maximum = 10000000;
    var probe = 0;
    var lowerBound;

    while (probe <= maximum) {
      if (calculateVariant(scaleAgentCommission(agent, probe), packageId, expenseShare).contribution >= 0) {
        lowerBound = Math.max(0, probe - coarseStep);
        while (lowerBound <= probe) {
          if (calculateVariant(scaleAgentCommission(agent, lowerBound), packageId, expenseShare).contribution >= 0) {
            return lowerBound;
          }
          lowerBound += preciseStep;
        }
        return probe;
      }
      probe += coarseStep;
    }
    return null;
  }

  function comparePackages(agent, expenseShare) {
    return requirePolicy().packages.map(function (packageItem) {
      var variant = calculateVariant(agent, packageItem.id, expenseShare);
      variant.breakEvenCommission = findBreakEvenCommission(agent, packageItem.id, expenseShare);
      return variant;
    });
  }

  root.MotivationCalculator2026 = {
    getHalfYearLevel: getHalfYearLevel,
    buildBenefitInput: buildBenefitInput,
    buildIntegration: buildIntegration,
    applyPackage: applyPackage,
    calculateVariant: calculateVariant,
    scaleAgentCommission: scaleAgentCommission,
    findBreakEvenCommission: findBreakEvenCommission,
    comparePackages: comparePackages
  };
}(typeof window !== 'undefined' ? window : globalThis));
