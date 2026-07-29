(function (root) {
  'use strict';

  var packages = [
    {
      id: 'newcomer',
      rank: 0,
      label: 'Новичок',
      status: 'trainee',
      floorRate: 30,
      maxRate: 40,
      tenureMonths: 0,
      performanceLevel: null
    },
    {
      id: 'standard',
      rank: 1,
      label: 'Стандарт',
      status: 'partner',
      floorRate: 45,
      maxRate: 80,
      tenureMonths: 0,
      performanceLevel: 1
    },
    {
      id: 'extended',
      rank: 2,
      label: 'Расширенный',
      status: 'partner',
      floorRate: 50,
      maxRate: 80,
      tenureMonths: 12,
      performanceLevel: 3
    },
    {
      id: 'advanced',
      rank: 3,
      label: 'Продвинутый',
      status: 'partner',
      floorRate: 55,
      maxRate: 80,
      tenureMonths: 24,
      performanceLevel: 4
    },
    {
      id: 'premium',
      rank: 4,
      label: 'Премиум',
      status: 'partner',
      floorRate: 60,
      maxRate: 80,
      tenureMonths: 36,
      performanceLevel: 5
    },
    {
      id: 'premiumPlus',
      rank: 5,
      label: 'Премиум +',
      status: 'partner',
      floorRate: 65,
      maxRate: 80,
      tenureMonths: 48,
      performanceLevel: 6
    },
    {
      id: 'individual',
      rank: 6,
      label: 'Индивидуальный',
      status: 'partner',
      floorRate: 70,
      maxRate: 80,
      tenureMonths: 60,
      performanceLevel: 7
    }
  ];

  function byId(id) {
    return packages.find(function (item) {
      return item.id === id;
    }) || null;
  }

  function byRank(rank) {
    var normalizedRank = Math.max(0, Math.min(packages.length - 1, Number(rank) || 0));
    return packages[normalizedRank];
  }

  function byPerformanceLevel(level) {
    var normalizedLevel = Math.max(1, Math.min(7, Math.floor(Number(level) || 1)));
    var matched = byId('standard');

    packages.forEach(function (item) {
      if (item.performanceLevel !== null && normalizedLevel >= item.performanceLevel) {
        matched = item;
      }
    });

    return matched;
  }

  function byTenureMonths(months, status) {
    if (status === 'trainee') {
      return byId('newcomer');
    }

    var normalizedMonths = Math.max(0, Math.floor(Number(months) || 0));
    var matched = byId('standard');

    packages.forEach(function (item) {
      if (item.status === 'partner' && normalizedMonths >= item.tenureMonths) {
        matched = item;
      }
    });

    return matched;
  }

  root.MOTIVATION_POLICY_2026 = {
    id: 'motivation-2026.1',
    storageVersion: 1,
    partnershipQuarterDeposits: 250000,
    travelMinimumHalfYearLevel: 4,
    individualAdvertisingRate: 0.03,
    individualAdvertisingLimit: 15000,
    packages: packages,
    quarterLevels: [
      { level: 1, threshold: 250000, stipendMonthly: 0 },
      { level: 2, threshold: 400000, stipendMonthly: 0 },
      { level: 3, threshold: 600000, stipendMonthly: 3000 },
      { level: 4, threshold: 800000, stipendMonthly: 4000 },
      { level: 5, threshold: 1000000, stipendMonthly: 5000 },
      { level: 6, threshold: 1200000, stipendMonthly: 6000 },
      { level: 7, threshold: 1500000, stipendMonthly: 7000 }
    ],
    halfYearLevels: [
      { level: 1, threshold: 500000 },
      { level: 2, threshold: 800000 },
      { level: 3, threshold: 1200000 },
      { level: 4, threshold: 1600000 },
      { level: 5, threshold: 2000000 },
      { level: 6, threshold: 2400000 },
      { level: 7, threshold: 3000000 }
    ],
    packageIds: packages.map(function (item) { return item.id; }),
    getPackage: byId,
    getPackageByRank: byRank,
    getPackageByPerformanceLevel: byPerformanceLevel,
    getPackageByTenureMonths: byTenureMonths
  };
}(typeof window !== 'undefined' ? window : globalThis));
