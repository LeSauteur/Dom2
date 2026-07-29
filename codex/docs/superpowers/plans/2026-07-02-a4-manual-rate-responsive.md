# A4 Manual Rate and Responsive Deal Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy deposit-order override with a direct per-deal percentage and make deal/agent fields align and shrink correctly on desktop and mobile.

**Architecture:** Keep `dealsInput` plus parallel metadata arrays. Add canonical `dealManualRates`; normalize legacy `dealDepositOrders` into percentages at every state/snapshot boundary. `calculateAgent()` remains the single money engine and applies the manual rate only after qualification and payment-type guards.

**Tech Stack:** Static HTML/CSS, browser JavaScript, Node `assert`/`vm` tests.

---

### Task 1: Calculation contract and legacy conversion

**Files:**
- Modify: `domian-calculator-a4/assets/js/calculations.js`
- Test: `domian-calculator-a4/tests/a4-calculations.test.js`

- [ ] Add failing tests proving `dealManualRates: [50]` yields `0.50`, affects only that row, does not advance the next automatic tier, is ignored for ordinary deals below `50_000`, applies to low-value solo newbuilds, and is ignored by fixed payment.
- [ ] Run `node domian-calculator-a4/tests/a4-calculations.test.js`; expect failures because `dealManualRates` is not consumed.
- [ ] Build each source row with:

```js
manualRateOverride: percentageOrNull(agent.dealManualRates && agent.dealManualRates[sourceIndex])
```

- [ ] Apply the override only when `isQualifiedDeposit && agent.paymentType !== 'fixed'`; return `rateSource: 'manualRate'`.
- [ ] Re-run the test file and require all assertions to pass.

### Task 2: A4 state, migration and row alignment

**Files:**
- Modify: `domian-calculator-a4/assets/js/constants.js`
- Modify: `domian-calculator-a4/assets/js/app.js`
- Test: `domian-calculator-a4/tests/a4-calculations.test.js`

- [ ] Add failing tests for new-agent defaults, add/remove alignment, V1/V2 normalization and migration:

```js
assert.deepEqual(agent.dealManualRates, ['']);
assert.deepEqual(migrate([1, 2, 7, 20]), [45, 50, 80, 80]);
```

- [ ] Run the A4 test and confirm failures reference missing `dealManualRates`.
- [ ] Add `dealManualRates: ['']` to default/example agents.
- [ ] Implement `depositOrderToManualRate(order)` with `45/50/55/60/65/70/80`.
- [ ] Make `normalizeDealRowMetadata()` prefer an explicit new value and otherwise migrate the legacy row; keep `dealsInput`, `dealManualRates`, and `dealNewbuildSoloFlags` aligned.
- [ ] Update add/remove and quick/exact transitions to maintain the new arrays.
- [ ] Re-run the A4 tests to GREEN.

### Task 3: A4 exact-deal UI

**Files:**
- Modify: `domian-calculator-a4/assets/js/app.js`
- Test: `domian-calculator-a4/tests/a4-calculations.test.js`

- [ ] Add failing source/render tests for `data-deal-manual-rate`, «Процент для этой сделки, %», «Ручной процент», disabled low ordinary deal, and no field for fixed mode.
- [ ] Run the A4 test and confirm the old `data-deal-deposit-order` output fails the contract.
- [ ] Replace the control with:

```html
<input type="number" min="0" max="100" step="1" data-deal-manual-rate="INDEX">
```

- [ ] Handle the input as blank or a clamped `0–100` number, recalculate only through the existing totals path, and display the updated source label.
- [ ] Render amount/manual-rate/newbuild controls with the same heading-control-helper structure.
- [ ] Re-run the A4 tests to GREEN.

### Task 4: Desktop/mobile CSS repair

**Files:**
- Modify: `domian-calculator-a4/assets/css/a4-calculator.css`
- Test: `domian-calculator-a4/tests/a4-calculations.test.js`

- [ ] Add failing CSS assertions for `min-width: 0`, `max-width: 100%`, top-aligned exact rows, and mobile `minmax(0, 1fr)`.
- [ ] Run the A4 test and confirm the responsive assertions fail.
- [ ] Use a three-column desktop grid whose children share the same vertical structure; remove checkbox stretching and bottom alignment.
- [ ] Add shrink constraints to `.field`, `.check-field`, `.exact-deals-panel`, inputs and selects.
- [ ] Make mobile form/exact grids one `minmax(0, 1fr)` column and keep every control within the card.
- [ ] Re-run the A4 tests to GREEN.

### Task 5: Snapshot and both table consumers

**Files:**
- Modify: `domian-calculator-a4/assets/js/table-ledger.js`
- Modify: `domian-calculator-a4/assets/js/table-mode.js`
- Modify: `domian-calculator-a4/table-ledger.html`
- Modify: `domian-calculator-a4/assets/css/table-ledger.css`
- Test: `domian-calculator-a4/tests/table-ledger.test.js`
- Test: `domian-calculator-a4/tests/table-mode-parity.test.js`

- [ ] Add failing tests loading `dealManualRates: [50]`, asserting calculated `0.50`, legacy order conversion, live-ledger input text, and V1/V2/V3 compatibility.
- [ ] Run both table tests and confirm RED.
- [ ] Replace ledger deal `depositOrder` with canonical `manualRate`, migrate legacy snapshot arrays, and pass `dealManualRates` to `calculateAgent`.
- [ ] Replace table-ledger control/copy with the direct percentage and disable/hide it using the same guards as A4.
- [ ] Normalize and preserve `dealManualRates` in legacy `table-mode.js`.
- [ ] Re-run both table tests to GREEN.

### Task 6: Cache bust and complete verification

**Files:**
- Modify: `domian-calculator-a4/index.html`
- Modify: `domian-calculator-a4/table-ledger.html`
- Modify: `domian-calculator-a4/extended.html`

- [ ] Update the A4 asset token from `a4-deposits-20260701` to `a4-manual-rate-20260702`.
- [ ] Run all four test files.
- [ ] Run `node --check` for every JS file under `domian-calculator-a4/assets/js` and `domian-calculator-a4/tests`.
- [ ] Confirm no browser, internet, dependency installation or Git command was used.

