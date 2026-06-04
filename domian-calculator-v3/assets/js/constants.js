(function () {
  'use strict';

  window.MONTHS = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь'
  ];

  window.PAY_SCALES = {
    standard: {
      trainee: [0.30, 0.35, 0.40],
      partner: [0.45, 0.50, 0.55, 0.60]
    },
    boostedDefault: [0.55, 0.55, 0.55, 0.60],
    fixedDefault: 0.70
  };

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

  window.STIPEND_LEVELS = [
    { threshold: 250000, level: 1, monthly: 0 },
    { threshold: 400000, level: 2, monthly: 0 },
    { threshold: 600000, level: 3, monthly: 3000 },
    { threshold: 800000, level: 4, monthly: 4000 },
    { threshold: 1000000, level: 5, monthly: 5000 },
    { threshold: 1200000, level: 6, monthly: 6000 },
    { threshold: 1500000, level: 7, monthly: 7000 }
  ];

  window.REFERRAL_RATE = 0.025;
  window.DEPOSIT_BONUS_THRESHOLD = 250000;

  window.DEFAULT_EXPENSES = [
    { id: 'rent', name: 'Аренда', amount: 120000, period: 'month' },
    { id: 'internet', name: 'Интернет', amount: 2500, period: 'month' },
    { id: 'phone', name: 'Связь', amount: 5000, period: 'month' },
    { id: 'ads', name: 'Реклама', amount: 45000, period: 'month' },
    { id: 'admin', name: 'Администратор', amount: 55000, period: 'month' },
    { id: 'adaptologist', name: 'Адаптолог', amount: 35000, period: 'month' },
    { id: 'site', name: 'Сайт', amount: 30000, period: 'quarter' },
    { id: 'accounting', name: 'Бухгалтер', amount: 18000, period: 'month' },
    { id: 'other', name: 'Прочие', amount: 15000, period: 'month' }
  ];

  window.DEMO_AGENTS = [
    {
      id: 'a1',
      name: 'Анна Петрова',
      terms: 'standard',
      status: 'partner',
      introduced: true,
      boostedRates: [55, 55, 55, 60],
      fixedRate: 70,
      quarterDeposits: 320000,
      stipendMode: 'forecast',
      quarterManual: 0,
      expanded: false,
      deals: [
        { id: 'd1', commission: 100000 },
        { id: 'd2', commission: 200000 }
      ]
    },
    {
      id: 'a2',
      name: 'Игорь Смирнов',
      terms: 'standard',
      status: 'trainee',
      introduced: false,
      boostedRates: [55, 55, 55, 60],
      fixedRate: 70,
      quarterDeposits: 180000,
      stipendMode: 'forecast',
      quarterManual: 0,
      expanded: false,
      deals: [
        { id: 'd3', commission: 100000 }
      ]
    },
    {
      id: 'a3',
      name: 'Мария Волкова',
      terms: 'fixed',
      status: 'partner',
      introduced: false,
      boostedRates: [55, 55, 55, 60],
      fixedRate: 80,
      quarterDeposits: 500000,
      stipendMode: 'forecast',
      quarterManual: 0,
      expanded: false,
      deals: [
        { id: 'd4', commission: 100000 }
      ]
    }
  ];
}());
