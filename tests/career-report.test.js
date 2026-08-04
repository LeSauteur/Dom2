const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', 'pub', 'domian-calculator-a4');

function load(context, relativePath) {
  const filename = path.join(projectRoot, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
}

function createStorage(initial) {
  const values = initial ? { domianCareerDraftV1: JSON.stringify(initial) } : {};
  return {
    values,
    getItem(key) { return Object.hasOwn(values, key) ? values[key] : null; },
    setItem(key, value) { values[key] = String(value); },
    removeItem(key) { delete values[key]; }
  };
}

function createContext(storage = createStorage()) {
  const context = { console, localStorage: storage };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  [
    'assets/js/policies/motivation-policy-2026.js',
    'assets/js/domain/career-engine.js',
    'assets/js/domain/benefit-engine.js',
    'assets/js/domain/career-report-engine.js',
    'assets/js/career-storage.js'
  ].forEach((file) => load(context, file));
  return context;
}

function profile(overrides = {}) {
  return {
    id: 'career-agent-1',
    name: 'Анна Иванова',
    status: 'partner',
    employmentStartDate: '2025-01-15',
    partnerStartDate: '',
    contractualFloorRate: 0,
    notes: '',
    ...overrides
  };
}

function values(overrides = {}) {
  return {
    asOfDate: '2026-07-15',
    halfYearCommission: 500000,
    halfYearResultConfirmed: true,
    previousPerformancePackage: 'standard',
    quarterDeposits: 250000,
    quarterlyCommission: 600000,
    previousMonthDeposits: 300000,
    officePlanCompleted: true,
    agentParticipated: true,
    travelQuarterPartnershipConfirmed: true,
    mountainSeaCost: 15000,
    travelCost: 100000,
    corporateCost: 20000,
    ...overrides
  };
}

test('уровень полугодия соблюдает все точные границы политики', () => {
  const { CareerReportEngine } = createContext();
  const cases = [
    [499999, 0], [500000, 1], [799999, 1], [800000, 2],
    [1200000, 3], [1600000, 4], [2000000, 5], [2400000, 6], [3000000, 7]
  ];
  cases.forEach(([amount, level]) => assert.equal(CareerReportEngine.halfYearLevel(amount), level));
});

test('стаж считается в полных месяцах на границе месяца и года', () => {
  const { CareerEngine, CareerReportEngine } = createContext();
  assert.equal(CareerEngine.fullMonthsBetween('2025-01-31', '2026-01-30'), 11);
  assert.equal(CareerEngine.fullMonthsBetween('2025-01-31', '2026-01-31'), 12);
  assert.equal(CareerReportEngine.fullYearsMonths(15, true), '1 год 3 месяца');
  assert.equal(CareerReportEngine.fullYearsMonths(0, false), 'Дата не указана');
});

test('доход ниже первого уровня не повышает пакет автоматически', () => {
  const { CareerReportEngine } = createContext();
  const row = CareerReportEngine.calculateRow(profile(), values({ halfYearCommission: 499999 }), '2026-07', null);
  assert.equal(row.level, 0);
  assert.equal(row.result.performanceStatus, 'unconfirmed');
  assert.equal(row.result.performancePackage, 'standard');
});

test('неподтверждённый результат показывает уровень, но сохраняет предыдущий результативный пакет', () => {
  const { CareerReportEngine } = createContext();
  const row = CareerReportEngine.calculateRow(profile(), values({
    halfYearCommission: 3000000,
    halfYearResultConfirmed: false,
    previousPerformancePackage: 'premium'
  }), '2026-07', null);
  assert.equal(row.level, 7);
  assert.equal(row.result.performanceStatus, 'unconfirmed');
  assert.equal(row.result.performancePackage, 'premium');
  assert.equal(row.benefits.items.find((item) => item.id === 'travel').available, false);
});

test('ведомость из 32 сотрудников рассчитывается без потери строк', () => {
  const { CareerReportEngine } = createContext();
  const rows = Array.from({ length: 32 }, (_, index) => CareerReportEngine.calculateRow(
    profile({ id: `career-agent-${index + 1}`, name: `Сотрудник ${index + 1}` }),
    values({ halfYearCommission: 500000 + index * 100000 }),
    '2026-07',
    null
  ));
  assert.equal(rows.length, 32);
  assert.equal(rows.every((row) => row.result.effectivePackage && row.benefits.items.length === 5), true);
});

test('массовая строка использует CareerEngine и BenefitEngine без упрощённой формулы', () => {
  const { CareerReportEngine } = createContext();
  const row = CareerReportEngine.calculateRow(profile({ contractualFloorRate: 62 }), values({
    halfYearCommission: 2000000
  }), '2026-07', null);
  assert.equal(row.result.effectiveFloorRate, 62);
  assert.equal(row.result.performancePackage, 'premium');
  assert.equal(row.motivation.stipend, '—');
  assert.equal(row.motivation.mountainSea, 'Офис');
  assert.equal(row.motivation.travel, 'Агент');
});

test('решения разных полугодий сохраняются отдельно и старое хранилище читается', () => {
  const context = createContext();
  const savedProfile = context.CareerStorage.saveProfile(profile());
  context.CareerStorage.saveDecision({ profileId: savedProfile.id, effectivePeriod: '2026-01', result: { effectivePackage: 'standard' } });
  context.CareerStorage.saveDecision({ profileId: savedProfile.id, effectivePeriod: '2026-07', result: { effectivePackage: 'premium' } });
  assert.equal(context.CareerStorage.getDecision(savedProfile.id, '2026-01').result.effectivePackage, 'standard');
  assert.equal(context.CareerStorage.getDecision(savedProfile.id, '2026-07').result.effectivePackage, 'premium');
  assert.equal(context.CareerStorage.getPreviousDecision(savedProfile.id, '2026-07').effectivePeriod, '2026-01');
  assert.equal(context.CareerStorage.key, 'domianCareerDraftV1');
});

test('печатное представление отделено от управляющих элементов', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'career.html'), 'utf8');
  const css = fs.readFileSync(path.join(projectRoot, 'assets/css/career-mode.css'), 'utf8');
  const script = fs.readFileSync(path.join(projectRoot, 'assets/js/career-report.js'), 'utf8');
  assert.match(html, /class="career-print-report"/);
  assert.match(css, /@media print/);
  assert.match(css, /size:\s*A4 landscape/);
  assert.match(css, /display:\s*table-header-group/);
  assert.match(css, /break-inside:\s*avoid/);
  assert.match(css, /\.career-report\s*>\s*\*\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /\.career-report\s*>\s*\.career-print-report\s*\{\s*display:\s*block\s*!important/);
  assert.match(script, /window\.print\(\)/);
  assert.match(script, /escapeHtml\(row\.profile\.name/);
  assert.match(script, /escapeHtml\(row\.profile\.notes/);
});
