# Isolated Travel Motivation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate A4 travel eligibility, owner decisions, reserve calculation, persistence migration, and live UI from all unrelated agent and motivation state.

**Architecture:** Add one pure `calculateTravelMotivation(agent)` state machine in the shared A4 calculation engine. Normalize legacy state into one `travelDecision`, feed only the state-machine result into the reserve, and render/update a dedicated travel card without replacing the active agent DOM.

**Tech Stack:** Browser JavaScript (ES5-compatible style), Node `assert` regression tests, static HTML/CSS already present in A4.

---

### Task 1: Pure travel state machine

**Files:**
- Modify: `domian-calculator-a4/assets/js/calculations.js`
- Test: `domian-calculator-a4/tests/a4-calculations.test.js`

- [ ] **Step 1: Write failing model tests**

Add explicit tests calling `calculator.calculateTravelMotivation()` for all four `auto` combinations, the `1_599_999`/`1_600_000` boundary, `forceInclude`, `forceExclude`, independence from `name`, `dealsInput`, `status`, `partnerConfirmed`, and unknown-decision fallback.

```js
const earned = calculator.calculateTravelMotivation({
  halfYearCommission: 1600000,
  travelQuarterPartnershipConfirmed: true,
  travelDecision: 'auto'
});
assert.equal(earned.earned, true);
assert.equal(earned.counted, true);
assert.equal(earned.annualAmount, 200000);
assert.equal(earned.monthlyAmount, 200000 / 12);
```

- [ ] **Step 2: Verify RED**

Run: `node domian-calculator-a4\tests\a4-calculations.test.js`

Expected: FAIL because `calculateTravelMotivation` is not exported.

- [ ] **Step 3: Implement the minimal pure function**

Normalize the decision to `auto`, `forceInclude`, or `forceExclude`; read only the five travel inputs; compute `earned`, `counted`, amounts, status, and exact Russian message; export it on `window`.

```js
function normalizeTravelDecision(value) {
  return value === 'forceInclude' || value === 'forceExclude' ? value : 'auto';
}
```

- [ ] **Step 4: Verify GREEN**

Run the A4 test file and expect all tests to pass.

### Task 2: State defaults and legacy migration

**Files:**
- Modify: `domian-calculator-a4/assets/js/constants.js`
- Modify: `domian-calculator-a4/assets/js/app.js`
- Test: `domian-calculator-a4/tests/a4-calculations.test.js`

- [ ] **Step 1: Write failing migration tests**

Test new-agent defaults, valid `travelDecision` precedence over legacy flags, `travelOverride: true` migration only when the decision is absent, `travelEnabled` not causing manual inclusion, and unknown values becoming `auto`.

```js
assert.equal(appHelpers.normalizeAgent({ travelDecision: 'forceExclude', travelOverride: true }).travelDecision, 'forceExclude');
assert.equal(appHelpers.normalizeAgent({ travelOverride: true }).travelDecision, 'forceInclude');
assert.equal(appHelpers.normalizeAgent({ motivation: { travelEnabled: true } }).travelDecision, 'auto');
```

- [ ] **Step 2: Verify RED**

Run the A4 tests; expect missing/default decision assertions to fail.

- [ ] **Step 3: Implement defaults and normalization**

Add `travelQuarterPartnershipConfirmed: false` and `travelDecision: 'auto'` to agent factories/default example data. In `normalizeAgent`, preserve a valid decision, otherwise migrate `travelOverride === true`, otherwise use `auto`; never derive it from `travelEnabled`.

- [ ] **Step 4: Verify GREEN**

Run the A4 test file and expect all tests to pass.

### Task 3: Reserve integration without collateral changes

**Files:**
- Modify: `domian-calculator-a4/assets/js/calculations.js`
- Test: `domian-calculator-a4/tests/a4-calculations.test.js`
- Test: `domian-calculator-a4/tests/table-mode-parity.test.js`

- [ ] **Step 1: Write failing reserve tests**

Assert that earned/forced travel contributes 200,000 annually and 200,000/12 monthly in rules mode, excluded/blocked travel contributes zero, ordinary `partnerConfirmed` and `travelEnabled` do not control it, and manual general reserve remains manual while travel details remain available.

- [ ] **Step 2: Verify RED**

Run A4 tests; expect old `travelEnabled && travelAllowed` behavior to fail the new assertions.

- [ ] **Step 3: Integrate state-machine output**

Call `calculateTravelMotivation(agent)` once in `calculateMotivationReserve()`, use its `annualAmount` for travel, and expose its fields on the reserve result without changing stipend, mountain/sea, corporate, congress, star, deals, payouts, referrals, or royalties.

- [ ] **Step 4: Verify GREEN and parity**

Run both Node test files and expect all tests to pass.

### Task 4: Autonomous UI and focused live update

**Files:**
- Modify: `domian-calculator-a4/assets/js/app.js`
- Test: `domian-calculator-a4/tests/a4-calculations.test.js`

- [ ] **Step 1: Write failing HTML and update tests**

Assert the half-year section always contains the independent confirmation control, contextual `forceInclude`/`forceExclude` action, return-to-`auto` action, correct status text/classes, and calculated 200,000 amount even in manual reserve mode. Assert input handling updates the travel card without `renderPreservingUiState()`.

- [ ] **Step 2: Verify RED**

Run A4 tests; expect missing `travelDecision` controls and old card HTML assertions to fail.

- [ ] **Step 3: Implement dedicated renderer and handlers**

Replace the generic travel trip card with `renderTravelMotivationCard(agent)` driven only by `calculateTravelMotivation()`. Handle `travelQuarterPartnershipConfirmed` and `travelDecision` as structural travel-only fields, update totals, and replace only the card HTML.

- [ ] **Step 4: Verify GREEN**

Run A4 tests and expect all tests to pass.

### Task 5: Final regression and browser verification

**Files:**
- Verify: `domian-calculator-a4/assets/js/app.js`
- Verify: `domian-calculator-a4/assets/js/calculations.js`
- Verify: `domian-calculator-a4/assets/js/constants.js`
- Verify: `domian-calculator-a4/tests/a4-calculations.test.js`
- Verify: `domian-calculator-a4/tests/table-mode-parity.test.js`

- [ ] **Step 1: Run syntax, unit, parity, and encoding checks**

Run every `node --check`, both Node suites, `git diff --check`, and the agreed mojibake `rg` scan. Expect exit code 0 and no new encoding hits.

- [ ] **Step 2: Run browser smoke test**

Serve the static repo over `127.0.0.1`, verify the auto-earned, forced-include, forced-exclude, and return-to-auto flows in the available Chromium browser, and check the console for errors.

- [ ] **Step 3: Produce manual cross-browser checklist**

List identical steps for Safari/macOS, Safari/iOS, and Chrome/Android, explicitly separating automated evidence from unverified device coverage.
