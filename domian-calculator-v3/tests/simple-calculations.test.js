const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCalculator() {
  const rootDir = path.resolve(__dirname, '..');
  const context = {
    window: {},
    console
  };

  vm.createContext(context);

  [
    path.join(rootDir, 'assets/js/constants.js'),
    path.join(rootDir, 'assets/js/calculations.js')
  ].forEach((filePath) => {
    const source = fs.readFileSync(filePath, 'utf8');
    vm.runInContext(source, context, { filename: filePath });
    Object.assign(context, context.window);
  });

  return context.window;
}

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

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `Expected ${actual} to be close to ${expected}`);
}

const calculator = loadCalculator();

test('calculateSimpleTotals separates owner sales from agent payouts and reuses monthly expenses', () => {
  const state = {
    agents: [
      {
        id: 'agent-1',
        name: 'Анна',
        terms: 'standard',
        status: 'partner',
        introduced: true,
        fixedRate: 70,
        boostedRates: [55, 55, 55, 60],
        quarterDeposits: 0,
        stipendMode: 'forecast',
        quarterManual: 0,
        deals: [
          { id: 'deal-1', commission: 100000 }
        ]
      }
    ],
    expenses: [
      { id: 'rent', name: 'Аренда', amount: 120000, period: 'month' },
      { id: 'site', name: 'Сайт', amount: 36000, period: 'year' }
    ],
    ownerSales: 200000
  };

  const totals = calculator.calculateSimpleTotals(state);

  assert.equal(totals.agentSales, 100000);
  assert.equal(totals.ownerSales, 200000);
  assert.equal(totals.totalSales, 300000);
  assert.equal(totals.agentPayouts, 45000);
  assert.equal(totals.referralPayouts, 2500);
  assertClose(totals.royaltyAmount, 21000);
  assert.equal(totals.officeExpenses, 123000);
  assert.equal(totals.resultWithoutOwnerSales, -77500);
  assert.equal(totals.resultWithOwnerSales, 108500);
  assertClose(totals.royaltyAmountWithoutOwnerSales, 7000);
  assertClose(totals.ownerRoyaltyAmount, 14000);
  assertClose(totals.ownerNetAfterRoyalty, 186000);
});

test('calculateSimpleOutcomeMessage warns when only owner sales pull office into profit', () => {
  const totals = calculator.calculateSimpleTotals({
    agents: [
      {
        id: 'agent-1',
        name: 'Игорь',
        terms: 'fixed',
        status: 'partner',
        introduced: false,
        fixedRate: 80,
        boostedRates: [55, 55, 55, 60],
        quarterDeposits: 0,
        stipendMode: 'forecast',
        quarterManual: 0,
        deals: [
          { id: 'deal-1', commission: 100000 }
        ]
      }
    ],
    expenses: [
      { id: 'rent', name: 'Аренда', amount: 50000, period: 'month' }
    ],
    ownerSales: 100000
  });

  const outcome = calculator.calculateSimpleOutcomeMessage(totals);

  assert.equal(outcome.summaryType, 'positive');
  assert.match(outcome.summaryText, /Офис в плюсе/);
  assert.equal(outcome.showOwnerWarning, true);
  assert.match(outcome.ownerWarningText, /только за счёт личных продаж собственника/);
});
