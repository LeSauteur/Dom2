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
  window.PARTNERSHIP_DEPOSIT_THRESHOLD = 250000;
  window.STIPEND_MIN_LEVEL = 3;
  window.STIPEND_MIN_QUARTERLY_COMMISSION = 600000;
  window.TRAVEL_MIN_HALF_YEAR_COMMISSION = 1600000;

  window.PAY_SCALES = {
    standard: {
      trainee: [0.30, 0.35, 0.40],
      partner: [0.45, 0.50, 0.55, 0.60]
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
    { id: 'rent', name: 'Аренда', amount: 35000 },
    { id: 'utilities', name: 'Коммуналка', amount: 15000 },
    { id: 'internet', name: 'Интернет', amount: 2500 },
    { id: 'phone', name: 'Связь', amount: 5000 },
    { id: 'ads', name: 'Реклама', amount: 65000 },
    { id: 'admin', name: 'Администратор', amount: 55000 },
    { id: 'accounting', name: 'Бухгалтер', amount: 25000 },
    { id: 'other', name: 'Прочее (вода, канцелярка и тд)', amount: 15000 }
  ];

  window.DEFAULT_AGENTS = [
    {
      id: 'agent-1',
      name: 'Анна',
      commission: 0,
      dealCount: 1,
      commissionMode: 'exact',
      dealsInput: [''],
      paymentType: 'standard',
      status: 'partner',
      boostedRates: [55, 55, 55, 60],
      startingRate: 55,
      fixedRate: 80,
      introduced: false,
      partnerConfirmed: true,
      quarterlyCommission: 400000,
      quarterlyDeposits: 250000,
      halfYearCommission: 1600000,
      preTripQuarterDeposits: 250000,
      motivationOverride: false,
      stipendOverride: false,
      mountainSeaOverride: false,
      travelOverride: false,
      eventsOverride: false,
      specialTermsOverride: false,
      motivation: window.DEFAULT_MOTIVATION
    }
  ];
}());
