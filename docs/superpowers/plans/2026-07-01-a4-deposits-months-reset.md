# A4 Deposits, Monthly Drafts, and Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the normative deposit scale, per-row deposit order/newbuild rules, monthly data isolation, targeted hard reset, and live table-ledger compatibility.

**Architecture:** Keep `state` as the active month accepted by `calculateOffice(state)`. Store persistence in a V2 workspace container with `scratch` and `months`, while exact-deal metadata stays in backward-compatible parallel arrays. Pass only the active month to the table snapshot.

**Tech Stack:** Static HTML/CSS, browser JavaScript IIFEs, Node.js `vm` test harness, `localStorage`.

**Execution constraints:** No browser, internet, package installation, Git commands, or subagents. Every production change follows a failing local test.

---

### Task 1: Partner, trainee, qualification, and row metadata calculation

**Files:**
- Modify: `domian-calculator-a4/assets/js/constants.js`
- Modify: `domian-calculator-a4/assets/js/calculations.js`
- Test: `domian-calculator-a4/tests/a4-calculations.test.js`

- [ ] **Step 1: Add failing scale and user-example tests**

Add assertions that partner exact deals produce rates:

```js
[0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.80, 0.80]
```

and that `[88200, 111750, 125000, 210000, 255404]` produces fifth payout `166012.6`.

- [ ] **Step 2: Run the A4 test and verify RED**

Run:

```powershell
node domian-calculator-a4/tests/a4-calculations.test.js
```

Expected: failures showing the fifth/sixth/seventh rates remain 60%.

- [ ] **Step 3: Extend the constants**

Set:

```js
partner: [0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.80],
trainee: [0.30, 0.35, 0.40]
```

- [ ] **Step 4: Add failing qualification and override tests**

Test these exact agents:

```js
{
  commissionMode: 'exact',
  dealsInput: [49999, 100000],
  dealDepositOrders: ['', ''],
  dealNewbuildSoloFlags: [false, false],
  paymentType: 'standard',
  status: 'partner'
}
```

Expected rates `[0.45, 0.45]`, qualification `[false, true]`.

Test `[30000, 100000]` with flags `[true, false]`; expected rates `[0.45, 0.50]`.

Test deposit orders `[2, 7, 10]`; expected rates `[0.50, 0.80, 0.80]`.

Test `[200000, '', 100000]` with orders `[2, '', 7]`; assert `sourceIndex` remains `[0, 2]`.

- [ ] **Step 5: Run the A4 test and verify RED**

Expected: missing metadata fields and wrong override/newbuild rates.

- [ ] **Step 6: Implement linked source rows**

Inside `calculateAgent()` build:

```js
function positiveIntegerOrBlank(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  var numeric = Math.floor(positiveNumber(value));
  return numeric >= 1 ? numeric : null;
}

var sourceDealRows = (agent.dealsInput || []).map(function (amount, sourceIndex) {
  return {
    amount: positiveNumber(amount),
    sourceIndex: sourceIndex,
    depositOrderOverride: positiveIntegerOrBlank(agent.dealDepositOrders && agent.dealDepositOrders[sourceIndex]),
    isNewbuildSolo: Boolean(agent.dealNewbuildSoloFlags && agent.dealNewbuildSoloFlags[sourceIndex])
  };
}).filter(function (row) {
  return row.amount > 0;
});
```

Use qualification:

```js
var isQualifiedDeposit = row.amount >= QUALIFYING_DEAL_COMMISSION_THRESHOLD || row.isNewbuildSolo;
```

For a non-qualified ordinary partner deal, force 45% and do not increment the counter. For a qualified row, use manual order minus one or the automatic qualified count.

Return:

```js
{
  index,
  sourceIndex,
  commission,
  rate,
  payout,
  rateSource,
  depositOrderApplied,
  scaleTierApplied,
  isQualifiedDeposit
}
```

- [ ] **Step 7: Implement trainee overflow**

For standard trainees:

```js
if (qualifiedIndex < PAY_SCALES.standard.trainee.length) {
  return PAY_SCALES.standard.trainee[qualifiedIndex];
}
return PAY_SCALES.standard.partner[Math.min(qualifiedIndex, PAY_SCALES.standard.partner.length - 1)];
```

Set result fields:

```js
traineeScaleExceeded: qualifiedDealCount > 3,
traineeScaleWarning: qualifiedDealCount > 3
  ? 'У стажёра указано больше 3 задатков за месяц. По правилам стажёрская шкала заканчивается на 3-м задатке. Переведите агента в статус партнёра или проверьте условия вручную.'
  : ''
```

Manual deposit order uses the same trainee-to-partner tier mapping.

- [ ] **Step 8: Run the A4 suite and verify GREEN**

Expected: all scale, threshold, newbuild, override, and trainee tests pass.

---

### Task 2: Main A4 exact-deal UI and state synchronization

**Files:**
- Modify: `domian-calculator-a4/assets/js/app.js`
- Modify: `domian-calculator-a4/assets/css/a4-calculator.css`
- Test: `domian-calculator-a4/tests/a4-calculations.test.js`

- [ ] **Step 1: Add failing state/UI tests**

Assert new agents contain:

```js
dealDepositOrders: [''],
dealNewbuildSoloFlags: [false]
```

Assert rendered exact rows contain `data-deal-deposit-order`, `data-deal-newbuild-solo`, the required labels, and the small-deal/newbuild guidance.

Assert add/remove helpers keep all three arrays aligned.

- [ ] **Step 2: Run A4 tests and verify RED**

- [ ] **Step 3: Normalize per-row arrays**

Add:

```js
function normalizeDealRowMetadata(agent) {
  var deals = normalizeExactDealsInput(agent.dealsInput);
  agent.dealsInput = deals;
  agent.dealDepositOrders = deals.map(function (_, index) {
    var value = agent.dealDepositOrders && agent.dealDepositOrders[index];
    return value === '' || value === null || value === undefined ? '' : Math.max(1, Math.floor(inputNumber(value)));
  });
  agent.dealNewbuildSoloFlags = deals.map(function (_, index) {
    return Boolean(agent.dealNewbuildSoloFlags && agent.dealNewbuildSoloFlags[index]);
  });
  return agent;
}
```

Call it in agent creation, normalization, draft normalization, exact input, add, remove, and quick-to-exact conversion.

- [ ] **Step 4: Render row controls and warning**

Each exact row renders amount, deposit order, newbuild checkbox, rate source, applied tier, and payout. Render the trainee warning when `result.traineeScaleExceeded`.

- [ ] **Step 5: Handle row metadata input**

Use separate dataset branches:

```js
if (target.dataset.dealDepositOrder !== undefined) {
  var orderAgent = findAgent(target.dataset.agentId);
  var orderIndex = Number(target.dataset.dealDepositOrder);
  normalizeDealRowMetadata(orderAgent);
  orderAgent.dealDepositOrders[orderIndex] = target.value === ''
    ? ''
    : Math.max(1, Math.floor(inputNumber(target.value)));
  syncAgentTotalsFromDeals(orderAgent);
  updateTotalsOnly();
  return;
}
if (target.dataset.dealNewbuildSolo !== undefined) {
  var newbuildAgent = findAgent(target.dataset.agentId);
  var newbuildIndex = Number(target.dataset.dealNewbuildSolo);
  normalizeDealRowMetadata(newbuildAgent);
  newbuildAgent.dealNewbuildSoloFlags[newbuildIndex] = Boolean(target.checked);
  syncAgentTotalsFromDeals(newbuildAgent);
  updateTotalsOnly();
  return;
}
```

Update only the corresponding source index, then call `syncAgentTotalsFromDeals()` and `updateTotalsOnly()`.

- [ ] **Step 6: Run A4 tests and verify GREEN**

---

### Task 3: Draft V2 workspace and monthly switching

**Files:**
- Modify: `domian-calculator-a4/assets/js/app.js`
- Modify: `domian-calculator-a4/index.html`
- Test: `domian-calculator-a4/tests/a4-calculations.test.js`

- [ ] **Step 1: Extend the app test harness**

Expose workspace helpers and provide an in-memory `localStorage` implementation with `getItem`, `setItem`, `removeItem`, `key`, and `length`.

- [ ] **Step 2: Add failing V1 migration and month-isolation tests**

Test:

```js
var migrated = migrateDraftV1({
  selectedMonth: '2026-01',
  agents: legacyAgents,
  expenses: legacyExpenses,
  ownerSales: 100000,
  schemeCheck: legacyScheme
});
```

Expected: `migrated.months['2026-01']` contains all data and new row arrays.

Test January → February → January switching with different `ownerSales`, expenses, agents, and deals.

- [ ] **Step 3: Run A4 tests and verify RED**

- [ ] **Step 4: Implement the workspace**

Add:

```js
var A4_DRAFT_VERSION = 2;
var A4_DRAFT_KEY = 'domianA4DraftV2';
var LEGACY_A4_DRAFT_KEYS = ['domianA4DraftV1'];
var draftWorkspace = { version: 2, selectedMonth: '', scratch: null, months: {} };
```

Implement:

```js
createDraftWorkspace()
snapshotMonthState(currentState)
normalizeMonthState(source, selectedMonth)
normalizeDraftWorkspace(payload)
migrateLegacyDraft(payload)
storeActiveStateInWorkspace()
activateMonth(nextMonth)
```

`saveDraft()` writes the V2 workspace. `loadDraftState()` checks V2 first, then V1, returning the active month state or scratch.

- [ ] **Step 5: Wire selected-month switching**

Before changing `state.selectedMonth`, save the old active state into the workspace. Load or create the new month, preserve scratch on first selection, sync counters, render, and save.

- [ ] **Step 6: Update month copy**

State that every month is stored separately and totals are for the active month.

- [ ] **Step 7: Run A4 and calendar tests and verify GREEN**

---

### Task 4: Soft clear and targeted hard reset

**Files:**
- Modify: `domian-calculator-a4/index.html`
- Modify: `domian-calculator-a4/assets/js/app.js`
- Modify: `domian-calculator-a4/assets/css/a4-calculator.css`
- Test: `domian-calculator-a4/tests/a4-calculations.test.js`

- [ ] **Step 1: Add failing reset tests**

Seed V1, V2, table snapshot, and `domianA4MonthDraftV1:*`. Assert hard reset removes them, preserves unrelated keys, leaves blank in-memory state, and `loadDraftState()` returns null.

- [ ] **Step 2: Run A4 tests and verify RED**

- [ ] **Step 3: Implement reset helpers**

Implement:

```js
function getA4StorageKeys() {
  var keys = [];
  for (var index = 0; index < localStorage.length; index += 1) {
    keys.push(localStorage.key(index));
  }
  return keys.filter(function (key) {
    return key === 'domianA4DraftV1'
      || key === 'domianA4DraftV2'
      || key === TABLE_SNAPSHOT_KEY
      || key.indexOf('domianA4MonthDraftV1:') === 0
      || key === 'domianA4SelectedMonth';
  });
}

function removeAllA4Storage() {
  getA4StorageKeys().forEach(function (key) {
    localStorage.removeItem(key);
  });
}

function hardResetCalculator() {
  clearAutosaveTimer();
  removeAllA4Storage();
  draftWorkspace = createDraftWorkspace();
  state = createBlankState();
  uiState = createUiState();
  syncCountersFromState(state);
  hasUnsavedChanges = false;
  window.domianA4State = state;
  render();
  setDraftStatus('clean', 'Все сохранённые данные удалены. Можно обновить страницу и начать заново.');
}
```

Enumerate storage keys before deleting prefixes. Never call `localStorage.clear()`. Cancel autosave and never call `saveDraft()` from hard reset.

- [ ] **Step 4: Update UI**

Rename the top action to «Очистить текущую форму». Add the bottom danger block with detailed copy and `data-action="hard-reset"`. Require confirm plus prompt value `УДАЛИТЬ`.

- [ ] **Step 5: Run A4 tests and verify GREEN**

---

### Task 5: Active-month snapshot and live table-ledger compatibility

**Files:**
- Modify: `domian-calculator-a4/assets/js/app.js`
- Modify: `domian-calculator-a4/assets/js/table-ledger.js`
- Modify: `domian-calculator-a4/table-ledger.html`
- Modify: `domian-calculator-a4/assets/css/table-ledger.css`
- Create: `domian-calculator-a4/tests/table-ledger.test.js`
- Test: `domian-calculator-a4/tests/table-mode-parity.test.js`

- [ ] **Step 1: Create a failing live-ledger test harness**

Load `constants.js`, `calculations.js`, and `table-ledger.js` in a VM. Expose:

```js
createDeal,
buildCalculationAgent,
loadA4Snapshot,
getState,
setState
```

Seed a versioned active-month snapshot containing exact deals and metadata. Assert ledger state preserves month, order, flag, and calculated rates.

- [ ] **Step 2: Run the live-ledger test and verify RED**

- [ ] **Step 3: Bump and preserve snapshot**

`openTableModePage()` stores only `snapshotMonthState(state)`. Accept snapshot versions 1, 2, and the new version in both table adapters.

- [ ] **Step 4: Extend ledger deal objects**

Use:

```js
{
  id,
  amount,
  depositOrder: '',
  isNewbuildSolo: false,
  comment: ''
}
```

Map `dealsInput`, `dealDepositOrders`, and `dealNewbuildSoloFlags` by source index during import. `buildCalculationAgent()` emits the parallel arrays.

- [ ] **Step 5: Render and update ledger controls**

Add columns/inputs for calculated deposit order and newbuild-one-agent. For displayed rate/payout, calculate once:

```js
var calculatedDeals = calculateAgent(buildCalculationAgent(agent)).deals;
var metric = calculatedDeals.find(function (item) {
  return item.sourceIndex === index;
});
var rate = metric ? metric.rate : 0;
var payout = metric ? metric.payout : 0;
```

- [ ] **Step 6: Run live-ledger and legacy parity tests and verify GREEN**

---

### Task 6: Copy audit and final verification

**Files:**
- Modify: `domian-calculator-a4/index.html`
- Modify: `domian-calculator-a4/assets/js/app.js`
- Modify: `domian-calculator-a4/assets/js/calculations.js`
- Modify: `domian-calculator-a4/assets/js/constants.js`
- Modify: `domian-calculator-a4/assets/js/table-ledger.js`
- Modify: `domian-calculator-a4/assets/css/a4-calculator.css`
- Modify: `domian-calculator-a4/assets/css/table-ledger.css`
- Modify: tests listed above

- [ ] **Step 1: Run syntax checks**

```powershell
$files = rg --files domian-calculator-a4 | Where-Object { $_ -match '\.js$' }
foreach ($file in $files) { node --check $file }
```

Expected: zero failures.

- [ ] **Step 2: Run all local suites**

```powershell
node domian-calculator-a4/tests/a4-calculations.test.js
node domian-calculator-a4/tests/calendar-policy.test.js
node domian-calculator-a4/tests/table-mode-parity.test.js
node domian-calculator-a4/tests/table-ledger.test.js
```

Expected: every command exits `0`, no `FAIL` lines.

- [ ] **Step 3: Run static requirement scans**

Confirm no `localStorage.clear`, no stale partner-scale copy, the required trainee warning exists, and both draft keys appear in reset/migration code.

- [ ] **Step 4: Report verification limits**

State explicitly that browser/manual UI verification was not performed because the task forbids it.
