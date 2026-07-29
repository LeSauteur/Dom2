'use strict';

var MOTIVATION_EVENTS_2026 = [
  {
    id: 'mountains_2026',
    type: 'trip',
    name: 'Горы 2026',
    campaignStart: '2026-01-01',
    campaignEnd: '2026-02-28',
    resultPeriod: { type: 'range', from: '2026-01', to: '2026-02' },
    eligibilityQuarter: '2026-Q1',
    expenseMonth: '2026-04',
    requiresPartnership: true,
    requiresOfficePlan: true,
    officePlanPerPartner: 350000,
    costPerAgent: 15000,
    costIsConfigurable: false,
    manualFlags: {
      requiresAgentParticipation: true,
      requiresOfficeActualResult: true,
      thermometerOptional: true
    }
  },
  {
    id: 'sea_2026',
    type: 'trip',
    name: 'Море 2026',
    campaignStart: '2026-05-01',
    campaignEnd: '2026-06-30',
    resultPeriod: { type: 'range', from: '2026-05', to: '2026-06' },
    eligibilityQuarter: '2026-Q2',
    expenseMonth: '2026-09',
    requiresPartnership: true,
    requiresOfficePlan: true,
    officePlanPerPartner: 350000,
    costPerAgent: 15000,
    costIsConfigurable: false,
    manualFlags: {
      requiresAgentParticipation: true,
      requiresOfficeActualResult: true,
      thermometerOptional: true
    }
  },
  {
    id: 'summer_corporate_2026',
    type: 'corporate',
    name: 'Летний корпоратив 2026',
    expenseMonth: '2026-07',
    eligibilityQuarter: '2026-Q2',
    requiresPartnership: true,
    costPerAgent: null,
    costIsConfigurable: true,
    requiresCostInput: true
  },
  {
    id: 'winter_corporate_2026',
    type: 'corporate',
    name: 'Зимний корпоратив 2026',
    expenseMonth: '2026-12',
    eligibilityQuarter: '2026-Q3',
    requiresPartnership: true,
    costPerAgent: null,
    costIsConfigurable: true,
    requiresCostInput: true
  },
  {
    id: 'foreign_trip_november_2026',
    type: 'travel',
    name: 'Заграница — ноябрь 2026',
    resultPeriod: { type: 'halfYear', value: '2026-H1' },
    expenseMonth: '2026-11',
    eligibilityQuarter: '2026-Q3',
    requiresPartnership: true,
    requiresPersonalLevel: 4,
    costPerAgent: null,
    costIsConfigurable: true,
    requiresCostInput: true
  },
  {
    id: 'foreign_trip_first_2026',
    type: 'travel',
    name: 'Заграница — первая поездка 2026',
    resultPeriod: { type: 'halfYear', value: '2025-H2' },
    expenseMonth: null,
    eligibilityQuarter: '2026-Q1',
    requiresPartnership: true,
    requiresPersonalLevel: 4,
    costPerAgent: null,
    costIsConfigurable: true,
    requiresCostInput: true,
    requiresExpenseMonthInput: true
  }
];

module.exports = {
  MOTIVATION_EVENTS_2026: MOTIVATION_EVENTS_2026
};
