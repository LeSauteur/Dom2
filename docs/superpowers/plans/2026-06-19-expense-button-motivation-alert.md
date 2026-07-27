# Expense Button and Motivation Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the A4 expense-add action to the bottom and replace verbose collapsed motivation summaries with an unmistakable red call to action.

**Architecture:** Keep the existing actions and `<details>` behavior. Change only static placement, summary rendering, and collapsed-state CSS; verify the generated markup and stylesheet contracts in the existing Node suite.

**Tech Stack:** Static HTML, browser JavaScript, CSS, Node assertions.

---

### Task 1: Lock the required markup and styling with failing tests

**Files:**
- Test: `domian-calculator-a4/tests/a4-calculations.test.js`

- [ ] Add assertions that `data-action="add-expense"` occurs once and after `expensesInlineTotal`.
- [ ] Add generated-HTML assertions for standard and special motivation messages and absence of legacy summary copy.
- [ ] Add stylesheet assertions for red collapsed background/border and `content: "!"`.
- [ ] Run `node domian-calculator-a4\tests\a4-calculations.test.js`; expect failures against current markup/CSS.

### Task 2: Implement the minimal UI changes

**Files:**
- Modify: `domian-calculator-a4/index.html`
- Modify: `domian-calculator-a4/assets/js/app.js`
- Modify: `domian-calculator-a4/assets/css/a4-calculator.css`

- [ ] Move the existing expense button after `.paper-total` inside `.section-actions.bottom-actions`.
- [ ] Add one `renderMotivationSummary(agent)` helper returning only closed/open titles.
- [ ] Replace all three duplicated motivation summaries with that helper.
- [ ] Style only `.motivation-box:not([open])` as the red alert with `!`; preserve ordinary open-state content.
- [ ] Run the A4 tests and expect all assertions to pass.

### Task 3: Regression verification

**Files:**
- Verify: `domian-calculator-a4/index.html`
- Verify: `domian-calculator-a4/assets/js/app.js`
- Verify: `domian-calculator-a4/assets/css/a4-calculator.css`
- Verify: `domian-calculator-a4/tests/a4-calculations.test.js`
- Verify: `domian-calculator-a4/tests/table-mode-parity.test.js`

- [ ] Run `node --check` for changed JavaScript and both test files.
- [ ] Run both Node suites, `git diff --check`, and the encoding scan.
- [ ] Report source/test evidence only; do not run a browser.
