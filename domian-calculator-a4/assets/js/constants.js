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

  window.PAY_SCALES = {
    standard: {
      trainee: [0.30, 0.35, 0.40],
      partner: [0.45, 0.50, 0.55, 0.60]
    },
    boostedDefault: [55, 55, 55, 60],
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

  window.DEFAULT_EXPENSES = [
    { id: 'rent', name: 'Аренда', amount: 120000 },
    { id: 'utilities', name: 'Коммуналка', amount: 12000 },
    { id: 'internet', name: 'Интернет', amount: 2500 },
    { id: 'phone', name: 'Связь', amount: 5000 },
    { id: 'ads', name: 'Реклама', amount: 45000 },
    { id: 'admin', name: 'Администратор', amount: 55000 },
    { id: 'accounting', name: 'Бухгалтер', amount: 18000 },
    { id: 'other', name: 'Прочее', amount: 15000 }
  ];

  window.DEFAULT_AGENTS = [
    {
      id: 'agent-1',
      name: 'Анна',
      commission: 400000,
      dealCount: 4,
      paymentType: 'standard',
      status: 'partner',
      boostedRates: [55, 55, 55, 60],
      fixedRate: 80,
      introduced: false
    }
  ];
}());
