const assert = require('node:assert/strict');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const periods = require(path.join(rootDir, 'assets/js/extended-periods'));
const engine = require(path.join(rootDir, 'assets/js/extended-motivation-engine'));
const events = require(path.join(rootDir, 'assets/js/extended-motivation-events'));

function test(name, fn) {
  try {
    fn();
    console.log('PASS', name);
  } catch (error) {
    console.error('FAIL', name);
    console.error(error.stack);
    process.exitCode = 1;
  }
}

function closeTo(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `Expected ${actual} to equal ${expected}`);
}

test('period helpers translate quarters, halves and months correctly', () => {
  assert.deepEqual(periods.parseQuarter('2026-Q1'), { year: 2026, quarter: 1, key: '2026-Q1' });
  assert.deepEqual(periods.getQuarterMonths('2026-Q3'), ['2026-07', '2026-08', '2026-09']);
  assert.equal(periods.getNextQuarter('2026-Q4'), '2027-Q1');
  assert.deepEqual(periods.getHalfYearMonths('2026-H1'), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  assert.deepEqual(periods.getHalfYearMonths('2026-H2'), ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
  assert.equal(periods.getMonthQuarter('2026-11'), '2026-Q4');
});

test('calculatePartnership uses deposits and manual overrides only', () => {
  const baseAgent = {
    id: 'agent-1',
    quarterlyData: {
      '2026-Q1': { deposits: 320000 }
    }
  };

  const confirmed = engine.calculatePartnership(baseAgent, '2026-Q1');
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.source, 'auto');
  assert.equal(confirmed.deposits, 320000);
  assert.equal(confirmed.threshold, 250000);
  assert.match(confirmed.reason, /320 000/);

  const notConfirmed = engine.calculatePartnership({
    id: 'agent-2',
    quarterlyData: {
      '2026-Q1': { deposits: 320000, partnershipOverride: 'not_confirmed' }
    }
  }, '2026-Q1');
  assert.equal(notConfirmed.confirmed, false);
  assert.equal(notConfirmed.source, 'manual');
  assert.equal(notConfirmed.reason, 'Не подтверждено вручную');

  const missing = engine.calculatePartnership({ id: 'agent-3' }, '2026-Q1');
  assert.equal(missing.confirmed, false);
  assert.equal(missing.source, 'missing');
  assert.equal(missing.reason, 'Нет данных за квартал');
});

test('calculateStipend returns monthly stipend and quarterly obligation', () => {
  const agent = {
    id: 'agent-stipend',
    quarterlyData: {
      '2026-Q2': { commission: 820000 },
      '2026-Q3': { commission: 500000 }
    }
  };

  const rewarded = engine.calculateStipend(agent, '2026-Q2');
  assert.equal(rewarded.resultQuarter, '2026-Q2');
  assert.equal(rewarded.paymentQuarter, '2026-Q3');
  assert.equal(rewarded.commission, 820000);
  assert.equal(rewarded.level, 4);
  assert.equal(rewarded.stipendMonthly, 4000);
  assert.equal(rewarded.obligation, 12000);
  assert.deepEqual(rewarded.expenseMonths, ['2026-07', '2026-08', '2026-09']);

  const noPayout = engine.calculateStipend(agent, '2026-Q3');
  assert.equal(noPayout.level, 2);
  assert.equal(noPayout.stipendMonthly, 0);
  assert.equal(noPayout.obligation, 0);
});

test('calculatePersonalLevel scales thresholds for quarter, half-year and year', () => {
  assert.equal(engine.calculatePersonalLevel(249999, 'quarter'), 0);
  assert.equal(engine.calculatePersonalLevel(250000, 'quarter'), 1);
  assert.equal(engine.calculatePersonalLevel(399999, 'quarter'), 1);
  assert.equal(engine.calculatePersonalLevel(400000, 'quarter'), 2);
  assert.equal(engine.calculatePersonalLevel(800000, 'halfYear'), 2);
  assert.equal(engine.calculatePersonalLevel(1600000, 'halfYear'), 4);
  assert.equal(engine.calculatePersonalLevel(3000000, 'year'), 3);
  assert.equal(engine.calculatePersonalLevel(6000000, 'year'), 7);
});

test('event catalog contains the documented 2026 motivation events', () => {
  const ids = events.MOTIVATION_EVENTS_2026.map((event) => event.id);

  assert.deepEqual(ids, [
    'mountains_2026',
    'sea_2026',
    'summer_corporate_2026',
    'winter_corporate_2026',
    'foreign_trip_november_2026',
    'foreign_trip_first_2026'
  ]);

  const firstTrip = events.MOTIVATION_EVENTS_2026.find((event) => event.id === 'foreign_trip_first_2026');
  assert.equal(firstTrip.resultPeriod.type, 'halfYear');
  assert.equal(firstTrip.resultPeriod.value, '2025-H2');
  assert.equal(firstTrip.expenseMonth, null);
  assert.equal(firstTrip.requiresExpenseMonthInput, true);
});

test('evaluateMotivationEvent qualifies mountains when partnership, plan and participation are present', () => {
  const agent = {
    id: 'agent-1',
    quarterlyData: {
      '2026-Q1': { deposits: 320000 }
    }
  };

  const result = engine.evaluateMotivationEvent(agent, events.MOTIVATION_EVENTS_2026[0], {
    officePlans: {
      mountains_2026: {
        partnerCount: 7,
        actualResult: 2800000,
        agentParticipation: {
          'agent-1': true
        }
      }
    }
  });

  assert.equal(result.qualified, true);
  assert.equal(result.amount, 15000);
  assert.equal(result.expenseMonth, '2026-04');
  assert.deepEqual(result.disqualifiers, []);
  assert.match(result.reasons.join(' | '), /Партнёрство подтверждено/);
  assert.match(result.reasons.join(' | '), /План офиса выполнен/);
  assert.match(result.reasons.join(' | '), /Участие агента отмечено/);
});

test('evaluateMotivationEvent rejects corporate events without configured cost', () => {
  const agent = {
    id: 'agent-1',
    quarterlyData: {
      '2026-Q2': { deposits: 300000 }
    }
  };

  const result = engine.evaluateMotivationEvent(agent, events.MOTIVATION_EVENTS_2026[2], {
    configurableCosts: {}
  });

  assert.equal(result.qualified, false);
  assert.equal(result.amount, 0);
  assert.deepEqual(result.warnings, ['Не указана стоимость события']);
  assert.deepEqual(result.disqualifiers, ['Стоимость события не указана']);
});

test('evaluateMotivationEvent qualifies the November foreign trip using H1 result and Q3 partnership', () => {
  const agent = {
    id: 'agent-1',
    halfYearCommission: 1800000,
    quarterlyData: {
      '2026-Q3': { deposits: 260000 }
    }
  };

  const result = engine.evaluateMotivationEvent(agent, events.MOTIVATION_EVENTS_2026[4], {
    configurableCosts: {
      foreign_trip_november_2026: 120000
    }
  });

  assert.equal(result.qualified, true);
  assert.equal(result.amount, 120000);
  assert.equal(result.expenseMonth, '2026-11');
  assert.equal(engine.calculatePersonalLevel(agent.halfYearCommission, 'halfYear'), 4);
  assert.deepEqual(result.disqualifiers, []);
});

test('the first foreign trip template reports missing expense month instead of inventing one', () => {
  const agent = {
    id: 'agent-1',
    halfYearCommission: 1600000,
    quarterlyData: {
      '2026-Q1': { deposits: 300000 }
    }
  };

  const result = engine.evaluateMotivationEvent(agent, events.MOTIVATION_EVENTS_2026[5], {
    configurableCosts: {}
  });

  assert.equal(result.qualified, false);
  assert.equal(result.amount, 0);
  assert.equal(result.expenseMonth, null);
  assert.deepEqual(result.warnings, ['Нужно указать месяц расходов', 'Не указана стоимость события']);
  assert.deepEqual(result.disqualifiers, ['Месяц расходов не задан', 'Стоимость события не указана']);
});
