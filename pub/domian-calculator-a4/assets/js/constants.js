(function () {
  'use strict';

  window.ROYALTY_RATES = [
    { limit: 500000, rate: 0.07 },
    { limit: 750000, rate: 0.065 },
    { limit: 1000000, rate: 0.06 },
    { limit: 1500000, rate: 0.055 },
    { limit: 2000000, rate: 0.05 },
    { limit: 2500000, rate: 0.045 },
    { limit: 3000000, rate: 0.04 },
    { limit: 4000000, rate: 0.035 },
    { limit: Infinity, rate: 0.03 }
  ];

  window.REFERRAL_RATE = 0.025;
  window.QUALIFYING_DEAL_COMMISSION_THRESHOLD = 50000;
  window.PARTNERSHIP_DEPOSIT_THRESHOLD = 250000;
  window.STIPEND_MIN_LEVEL = 3;
  window.STIPEND_MIN_QUARTERLY_COMMISSION = 600000;
  window.TRAVEL_MIN_HALF_YEAR_COMMISSION = 1600000;

  window.PAY_SCALES = {
    standard: {
      trainee: [0.30, 0.35, 0.40],
      partner: [0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.80]
    },
    boostedDefault: [55, 55, 55, 60],
    boostedStartingDefault: 55,
    fixedDefault: 80
  };

  window.STIPEND_LEVELS = [
    { threshold: 250000, level: 1, monthly: 0 },
    { threshold: 400000, level: 2, monthly: 0 },
    { threshold: 600000, level: 3, monthly: 3000 },
    { threshold: 800000, level: 4, monthly: 4000 },
    { threshold: 1000000, level: 5, monthly: 5000 },
    { threshold: 1200000, level: 6, monthly: 6000 },
    { threshold: 1500000, level: 7, monthly: 7000 }
  ];

  window.DEFAULT_MOTIVATION = {
    mode: 'rules',
    stipendMode: 'off',
    quarterlyResult: 0,
    manualStipendMonthly: 0,
    manualReserveMonthly: 0,
    quarterlyDeposits: 0,
    halfYearCommission: 0,
    preTripQuarterDeposits: 0,
    annualReserveMode: 'monthly',
    manualAnnualReserveMonthly: 0,
    specialManualReserveEnabled: false,
    mountainSeaEnabled: false,
    mountainSeaPerTrip: 15000,
    mountainSeaTripsPerYear: 2,
    travelEnabled: false,
    travelPerTrip: 100000,
    travelTripsPerYear: 2,
    corporateEnabled: false,
    corporatePerYear: 20000,
    congressEnabled: true,
    congressPerYear: 3500,
    starEnabled: false,
    starPerYear: 5000
  };

  window.DEFAULT_EXPENSES = [
    { id: 'rent', name: 'Аренда', amount: 90000 },
    { id: 'utilities', name: 'Коммунальные платежи', amount: 18000 },
    { id: 'internet', name: 'Интернет', amount: 4500 },
    { id: 'phone', name: 'Связь', amount: 8500 },
    { id: 'ads', name: 'Реклама', amount: 95000 },
    { id: 'admin', name: 'Администратор', amount: 65000 },
    { id: 'accounting', name: 'Бухгалтерия', amount: 30000 },
    { id: 'crm', name: 'CRM', amount: 21000 },
    { id: 'other', name: 'Прочие расходы', amount: 18000 }
  ];

  function demoMotivation(overrides) {
    return Object.assign({}, window.DEFAULT_MOTIVATION, {
      mode: 'off',
      congressEnabled: false,
      starEnabled: false
    }, overrides || {});
  }

  function demoAgent(config) {
    var deals = config.deals.slice();
    var commission = deals.reduce(function (sum, amount) {
      return sum + amount;
    }, 0);

    return {
      id: config.id,
      name: config.name,
      commission: commission,
      dealCount: deals.length,
      commissionMode: config.commissionMode,
      dealsInput: deals,
      dealManualRates: deals.map(function () { return ''; }),
      dealNewbuildSoloFlags: config.dealNewbuildSoloFlags || deals.map(function () { return false; }),
      careerProfileId: '',
      careerPackageId: config.careerPackageId,
      contractualFloorRate: 0,
      careerPreviousMonthDeposits: config.careerPreviousMonthDeposits || 0,
      careerOfficePlanCompleted: config.careerOfficePlanCompleted === true,
      careerAgentParticipated: config.careerAgentParticipated === true,
      careerMountainSeaCost: 15000,
      careerTravelCost: 100000,
      careerCorporateCost: 20000,
      paymentType: config.paymentType || 'standard',
      status: config.status,
      boostedRates: [55, 55, 55, 60],
      startingRate: config.startingRate || 55,
      fixedRate: config.fixedRate || 80,
      introduced: config.introduced === true,
      partnerConfirmed: config.partnerConfirmed === true,
      quarterlyCommission: config.quarterlyCommission || 0,
      quarterlyDeposits: config.quarterlyDeposits || 0,
      halfYearCommission: config.halfYearCommission || 0,
      preTripQuarterDeposits: config.preTripQuarterDeposits || 0,
      travelQuarterPartnershipConfirmed: config.travelQuarterPartnershipConfirmed === true,
      travelDecision: config.travelDecision || 'auto',
      motivationOverride: false,
      stipendOverride: false,
      mountainSeaOverride: false,
      travelOverride: false,
      eventsOverride: false,
      specialTermsOverride: false,
      motivation: demoMotivation(config.motivation)
    };
  }

  window.DEFAULT_AGENTS = [
    demoAgent({
      id: 'demo-agent-elena',
      name: 'Елена Миронова',
      status: 'trainee',
      careerPackageId: 'newcomer',
      commissionMode: 'exact',
      deals: [100000, 80000, 60000]
    }),
    demoAgent({
      id: 'demo-agent-anna',
      name: 'Анна Соколова',
      status: 'partner',
      careerPackageId: 'standard',
      commissionMode: 'exact',
      deals: [180000, 140000, 110000, 80000],
      dealNewbuildSoloFlags: [false, false, false, true],
      partnerConfirmed: true,
      quarterlyCommission: 1000000,
      quarterlyDeposits: 400000,
      halfYearCommission: 2000000,
      preTripQuarterDeposits: 350000,
      travelQuarterPartnershipConfirmed: true,
      careerPreviousMonthDeposits: 420000,
      careerOfficePlanCompleted: true,
      careerAgentParticipated: true,
      motivation: {
        mode: 'rules',
        stipendMode: 'auto',
        mountainSeaEnabled: true,
        travelEnabled: true,
        corporateEnabled: true
      }
    }),
    demoAgent({
      id: 'demo-agent-boris',
      name: 'Борис Волков',
      status: 'partner',
      careerPackageId: 'extended',
      commissionMode: 'quick',
      deals: [150000, 150000, 150000, 150000],
      introduced: true,
      partnerConfirmed: true,
      quarterlyCommission: 800000,
      quarterlyDeposits: 320000,
      halfYearCommission: 1800000,
      preTripQuarterDeposits: 300000,
      travelQuarterPartnershipConfirmed: true,
      careerPreviousMonthDeposits: 360000,
      careerOfficePlanCompleted: true,
      careerAgentParticipated: true,
      motivation: {
        mode: 'rules',
        stipendMode: 'auto',
        mountainSeaEnabled: true,
        travelEnabled: true,
        corporateEnabled: true
      }
    }),
    demoAgent({
      id: 'demo-agent-viktor',
      name: 'Виктор Крылов',
      status: 'partner',
      careerPackageId: 'advanced',
      commissionMode: 'quick',
      deals: [180000, 170000, 170000],
      paymentType: 'boosted',
      startingRate: 55,
      partnerConfirmed: true,
      quarterlyCommission: 900000,
      quarterlyDeposits: 330000,
      halfYearCommission: 1900000,
      preTripQuarterDeposits: 300000,
      travelQuarterPartnershipConfirmed: true,
      travelDecision: 'forceExclude',
      careerPreviousMonthDeposits: 410000,
      careerOfficePlanCompleted: true,
      careerAgentParticipated: true,
      motivation: {
        mode: 'manual',
        manualReserveMonthly: 135000,
        specialManualReserveEnabled: true
      }
    }),
    demoAgent({
      id: 'demo-agent-irina',
      name: 'Ирина Лебедева',
      status: 'partner',
      careerPackageId: 'premium',
      commissionMode: 'exact',
      deals: [250000, 200000, 150000],
      partnerConfirmed: true,
      quarterlyCommission: 1100000,
      quarterlyDeposits: 450000,
      halfYearCommission: 2200000,
      preTripQuarterDeposits: 400000,
      travelQuarterPartnershipConfirmed: true,
      careerPreviousMonthDeposits: 500000,
      careerOfficePlanCompleted: true,
      careerAgentParticipated: true,
      motivation: {
        mode: 'manual',
        manualReserveMonthly: 35000
      }
    }),
    demoAgent({
      id: 'demo-agent-pavel',
      name: 'Павел Орлов',
      status: 'partner',
      careerPackageId: 'premiumPlus',
      commissionMode: 'exact',
      deals: [130000, 120000],
      paymentType: 'fixed',
      fixedRate: 65,
      partnerConfirmed: true,
      quarterlyCommission: 1200000,
      quarterlyDeposits: 500000,
      halfYearCommission: 2500000,
      preTripQuarterDeposits: 450000,
      travelQuarterPartnershipConfirmed: true,
      travelDecision: 'forceExclude',
      careerPreviousMonthDeposits: 550000,
      careerOfficePlanCompleted: true,
      careerAgentParticipated: true,
      motivation: {
        mode: 'manual',
        manualReserveMonthly: 20000,
        specialManualReserveEnabled: true
      }
    }),
    demoAgent({
      id: 'demo-agent-olga',
      name: 'Ольга Романова',
      status: 'partner',
      careerPackageId: 'individual',
      commissionMode: 'quick',
      deals: [100000, 100000],
      paymentType: 'fixed',
      fixedRate: 70,
      partnerConfirmed: true,
      quarterlyCommission: 1500000,
      quarterlyDeposits: 600000,
      halfYearCommission: 3200000,
      preTripQuarterDeposits: 550000,
      travelQuarterPartnershipConfirmed: true,
      travelDecision: 'forceExclude',
      careerPreviousMonthDeposits: 600000,
      careerOfficePlanCompleted: true,
      careerAgentParticipated: true,
      motivation: {
        mode: 'manual',
        manualReserveMonthly: 15000,
        specialManualReserveEnabled: true
      }
    })
  ];
}());
