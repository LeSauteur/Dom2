'use strict';

var ROYALTY_RATES = [
  { min: 0, max: 500000, rate: 0.07 },
  { min: 500000, max: 750000, rate: 0.065 },
  { min: 750000, max: 1000000, rate: 0.06 },
  { min: 1000000, max: 1500000, rate: 0.055 },
  { min: 1500000, max: 2000000, rate: 0.05 },
  { min: 2000000, max: 2500000, rate: 0.045 },
  { min: 2500000, max: 3000000, rate: 0.04 },
  { min: 3000000, max: 4000000, rate: 0.035 },
  { min: 4000000, max: Infinity, rate: 0.03 }
];

var PAY_SCALES = {
  trainee: [0.30, 0.35, 0.40],
  partner: [0.45, 0.50, 0.55, 0.60],
  boostedDefault: [55, 55, 55, 60],
  fixedDefault: 80
};

var REFERRAL_RATE = 0.025;
var PARTNERSHIP_DEPOSIT_MIN = 250000;
var TRAVEL_HALF_YEAR_MIN = 1600000;
var CONTRIBUTION_EDGE = 10000;

var DEFAULT_EXPENSES = [
  { id: 'expense-1', name: 'Аренда', amount: 35000 },
  { id: 'expense-2', name: 'Коммуналка', amount: 15000 },
  { id: 'expense-3', name: 'Интернет', amount: 2500 },
  { id: 'expense-4', name: 'Связь', amount: 5000 },
  { id: 'expense-5', name: 'Реклама', amount: 65000 },
  { id: 'expense-6', name: 'Администратор', amount: 55000 },
  { id: 'expense-7', name: 'Бухгалтер', amount: 25000 },
  { id: 'expense-8', name: 'Прочее', amount: 15000 }
];

var DEFAULT_MOTIVATION = {
  stipendMode: 'off',
  manualStipendMonthly: 0,
  annualReserveMode: 'monthly',
  manualAnnualReserveMonthly: 0,
  mountainSeaEnabled: false,
  mountainSeaPerTrip: 15000,
  mountainSeaTripsPerYear: 2,
  travelEnabled: false,
  travelPerTrip: 120000,
  travelTripsPerYear: 2,
  corporateEnabled: false,
  corporatePerYear: 20000,
  congressEnabled: true,
  congressPerYear: 3500,
  starEnabled: true,
  starPerYear: 5000
};

var DEFAULT_AGENTS = [
  {
    id: 'agent-1',
    name: 'Анна',
    commission: 400000,
    dealCount: 4,
    commissionMode: 'exact',
    dealsInput: [100000, 100000, 100000, 100000],
    paymentType: 'standard',
    status: 'partner',
    boostedRates: [55, 55, 55, 60],
    fixedRate: 80,
    introduced: false,
    quarterlyCommission: 0,
    quarterlyDeposits: 0,
    halfYearCommission: 0,
    preTripQuarterDeposits: 0,
    motivationOverride: false,
    stipendOverride: false,
    travelOverride: false,
    eventsOverride: false,
    specialTermsOverride: false,
    motivation: DEFAULT_MOTIVATION
  }
];

var SCHEME_VARIANTS = [
  { id: 'partner', label: 'Стандарт партнёр', type: 'standard', status: 'partner' },
  { id: 'boosted-555560', label: 'Повышенная 55/55/55/60', type: 'boosted', rates: [55, 55, 55, 60] },
  { id: 'boosted-55556065', label: 'Повышенная 55/55/60/65', type: 'boosted', rates: [55, 55, 60, 65] },
  { id: 'fixed-70', label: 'Фикс 70%', type: 'fixed', fixedRate: 70 },
  { id: 'fixed-80', label: 'Фикс 80%', type: 'fixed', fixedRate: 80 },
  { id: 'fixed-90', label: 'Фикс 90%', type: 'fixed', fixedRate: 90 },
  { id: 'fixed-manual', label: 'Ручной фикс', type: 'manualFixed' }
];

var STIPEND_LEVELS = [
  { min: 1500000, level: 7, monthly: 7000 },
  { min: 1200000, level: 6, monthly: 6000 },
  { min: 1000000, level: 5, monthly: 5000 },
  { min: 800000, level: 4, monthly: 4000 },
  { min: 600000, level: 3, monthly: 3000 },
  { min: 400000, level: 2, monthly: 0 },
  { min: 250000, level: 1, monthly: 0 }
];
