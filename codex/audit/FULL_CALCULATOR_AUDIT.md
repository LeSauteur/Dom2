# Полный аудит калькулятора Domian A4 и активной ведомости

Дата аудита: 2026-07-13  
Режим: read-only для production-кода. Новые артефакты созданы только в `_audit/`. Интернет, `git status`, коммиты, пуши, деплой и исправления production-файлов не выполнялись.

## 1. Короткий вердикт

Калькулятор A4 и активная ведомость в целом держатся на одном общем расчетном ядре (`assets/js/calculations.js`), поэтому между A4 и `table-ledger.html` не найдено отдельного расхождения по основным итогам: ведомость импортирует snapshot A4 и считает через тот же core.

Но найден один высокий расчетный дефект в общем core: сделка "новостройка, один агент" меньше 50 000 после предыдущей квалифицированной сделки квалифицируется и двигает шкалу, но для самой этой строки получает не следующий процент шкалы, а базовые 45%. Это влияет и на A4, и на активную ведомость.

Итоговая готовность: не считать калькулятор готовым для финального финансового применения или демонстрации без оговорок, пока не исправлен `CALC-001` и не добавлена регрессия на этот сценарий.

Сводка находок:

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 4 |

## 2. Что проверялось

В scope включены:

- Главный A4: `domian-calculator-a4/index.html`, `assets/js/app.js`, `assets/js/calculations.js`, `assets/js/constants.js`, `assets/js/calendar-policy.js`.
- Активная ведомость: `domian-calculator-a4/table-ledger.html`, `assets/js/table-ledger.js`, общий core.
- Алиас табличного режима: `domian-calculator-a4/table.html`.
- Дополнительные активные маршруты: `simple.html`, `extended.html`.
- Legacy/архивные риски внутри активного каталога: `assets/js/table-mode.js`, `assets/css/table-mode.css`, `a4-premium-demo.html`.
- Draft/snapshot/localStorage потоки A4 и ведомости.
- Существующие Node-тесты и независимые audit-тесты.
- Реальный браузерный smoke через локальный static server и headless Chrome/CDP.

Вне scope:

- Публичный сайт/GitHub Pages.
- Сетевые проверки.
- Safari/WebKit и мобильная визуальная матрица.
- Исправления найденных дефектов.

## 3. Команды и доказательства

Синтаксис production JS:

```powershell
node --check domian-calculator-a4/assets/js/constants.js
node --check domian-calculator-a4/assets/js/calculations.js
node --check domian-calculator-a4/assets/js/calendar-policy.js
node --check domian-calculator-a4/assets/js/app.js
node --check domian-calculator-a4/assets/js/table-ledger.js
node --check domian-calculator-a4/assets/js/table-mode.js
node --check domian-calculator-a4/assets/js/extended-mode.js
node --check domian-calculator-a4/tests/a4-calculations.test.js
node --check domian-calculator-a4/tests/calendar-policy.test.js
node --check domian-calculator-a4/tests/table-ledger.test.js
node --check domian-calculator-a4/tests/table-mode-parity.test.js
```

Существующие тесты:

```powershell
node domian-calculator-a4/tests/a4-calculations.test.js
node domian-calculator-a4/tests/calendar-policy.test.js
node domian-calculator-a4/tests/table-ledger.test.js
node domian-calculator-a4/tests/table-mode-parity.test.js
```

Независимые audit-тесты:

```powershell
node _audit/tests/audit-static-inventory.js
node _audit/tests/audit-calculation-matrix.js
```

Браузерный audit:

```powershell
node _audit/tests/static-server.js
node _audit/tests/browser-cdp-audit.js
```

Логи:

- `_audit/logs/existing-tests-summary.tsv`
- `_audit/logs/existing-tests.log`
- `_audit/logs/audit-tests-summary.tsv`
- `_audit/logs/audit-tests.log`
- `_audit/logs/browser-cdp-audit.log`
- `_audit/browser/browser-cdp-audit-results.json`

Скриншоты браузерного smoke:

- `_audit/browser/a4-after-input-save.png`
- `_audit/browser/ledger-after-load-a4.png`
- `_audit/browser/extended-quick-save.png`

## 4. Карта активной архитектуры

| Route/file | Статус | Runtime JS | Runtime CSS | Назначение |
| --- | --- | --- | --- | --- |
| `domian-calculator-a4/index.html` | Active A4 | `constants.js`, `calculations.js`, `calendar-policy.js`, `app.js` | `a4-calculator.css`, `navigation.css` | Основной калькулятор A4 |
| `domian-calculator-a4/table.html` | Active alias | none | inline/basic | Redirect/canonical на `table-ledger.html` |
| `domian-calculator-a4/table-ledger.html` | Active ledger | `constants.js`, `calculations.js`, `table-ledger.js` | `table-ledger.css`, `navigation.css` | Активная ведомость сделок |
| `domian-calculator-a4/simple.html` | Active linked scaffold | none | `modes.css`, `navigation.css` | Видимый простой режим, но без расчета |
| `domian-calculator-a4/extended.html` | Active MVP | `constants.js`, `calculations.js`, `extended-mode.js` | `extended-mode.css`, `modes.css`, `navigation.css` | Расширенный режим |
| `assets/js/table-mode.js` | Legacy/non-runtime | не загружается активными HTML | `table-mode.css` не загружается активной ведомостью | Старый табличный режим, покрыт legacy-тестом |
| `a4-premium-demo.html` | Standalone prototype | inline script | inline style | Не активный runtime, но содержит дубли расчетов |

Подтверждение активного ledger: `table-ledger.html` грузит `constants.js`, `calculations.js`, `table-ledger.js`, но не грузит `table-mode.js`. `table.html` делает redirect на `table-ledger.html`.

## 5. Главный A4: входы, состояния, кнопки

Основные верхнеуровневые элементы:

| Area | Inputs/selects/checkboxes/buttons | State/storage impact | Audit result |
| --- | --- | --- | --- |
| Навигация | ссылки Start, A4, простой, расширенный, табличный | route only | A4/ledger активны, simple ведет на scaffold |
| Панель периода | `selectedMonth`, кнопка предыдущего месяца | `state.selectedMonth`, workspace by month | browser smoke сохранил `2026-07` |
| Draft actions | сохранить, открыть табличный режим, сброс/очистка | `domianA4DraftV2`, `domianA4TableSnapshot`, `domianA4LedgerDraftV1` | сохранение и reload подтверждены |
| Расходы офиса | name, amount, add/remove | `state.expenses[]` | existing tests покрывают удаление/суммы, independent matrix покрывает расходы в офисном итоге |
| Собственные продажи | owner sales input | `state.ownerSales` | included in office result path |
| Agents | name, status, payment type, fixed/start rates, exact/quick commission | `state.agents[]` | shared core verified; one high bug in exact deal scale |
| Exact deals | amount, manual rate, newbuild solo checkbox, comment, add/remove | `agent.deals[]` | manual/newbuild fields preserved in browser and snapshot |
| Motivation/reserves | congress, star, stipend, travel, overrides, quarter fields | motivation part of agent state | existing tests cover travel explicit zero and forced include |
| Result panels | office result, owner result, warnings, profitability | computed via core | no separate A4 vs ledger divergence found |

Important state behavior:

- A4 starts from blank state, not demo-filled state.
- Empty and zero are distinct in several places; fixed explicit zero and travel explicit zero are preserved by existing and audit tests.
- Trainee status forces standard scheme and special warnings.
- `open-table-mode` writes snapshot v3 to `domianA4TableSnapshot`, then opens `table.html`, which redirects to `table-ledger.html`.

## 6. Активная ведомость: входы, состояния, кнопки

| Area | Inputs/selects/checkboxes/buttons | State/storage impact | Audit result |
| --- | --- | --- | --- |
| Load/clear | load A4, clear ledger | reads `domianA4TableSnapshot`, writes/removes `domianA4LedgerDraftV1` | browser confirmed A4 load and ledger draft write |
| Period/source | selected month display, source display | `ledgerState.selectedMonth`, `ledgerMeta` | browser confirmed month/source after import |
| Expenses | rows with name/amount, add/remove | `ledgerState.expenses[]` | existing tests cover clear/remove confirms |
| Owner sales | owner sales input | `ledgerState.ownerSales` | shared office result path |
| Agent setup | name/status/payment type/fixed/boosted/quick/exact | `ledgerState.agents[]` | VM tests cover status normalization and exact mode conversion |
| Deal rows | amount, manual rate, newbuild solo, comment, remove | `agent.deals[]` | browser confirmed imported manual rate and newbuild flag |
| Motivation rows | congress/star/travel/stipend/reserves | agent motivation state | existing tests cover isolated travel decisions and special reserve |
| Table output | payout, referral, royalty, motivation, result | computed core plus display adapters | totals use core; row-level royalty/referral are local allocations |

Active ledger is mostly an adapter around the shared core. It builds calculation agents and office state, then calls `calculateAgent()` and `calculateOffice()`. This is good for parity, but it also means shared core bugs appear identically in A4 and ledger.

## 7. Business rules matrix

| Rule | Source | Expected/observed |
| --- | --- | --- |
| Ordinary deal threshold | `QUALIFYING_DEAL_COMMISSION_THRESHOLD = 50000` | Strict threshold: ordinary deal below 50 000 does not advance scale |
| Solo newbuild | `isNewbuildSolo` in exact row | Qualifies even below 50 000 |
| Partner standard scale | `STANDARD_RATE_SCALES.partner` | 45, 50, 55, 60, 65, 70, 80 |
| Trainee standard scale | `STANDARD_RATE_SCALES.trainee` plus fallback | First three qualifying deals 30/35/40, fourth uses partner fourth tier 60 |
| Boosted scheme | `getBoostedStartingRate()` and `getDealRate()` | Starting rate is a floor over standard scale |
| Fixed scheme | `paymentType = fixed` | Uses fixed rate for all positive exact deals; explicit zero remains zero |
| Manual rate | exact deal `manualRate` | Applies only to qualified non-fixed rows; small ordinary rows ignore it |
| Referral | `introduced` | 2.5% referral reserve when introduced |
| Royalty | `ROYALTY_TIERS` | Strict less-than tiers; boundary 500 000 moves to 6.5% |
| Travel | travel decision/fields | Force include and explicit zero amount preserved |
| A4 to ledger | snapshot v3 | Imported selected month, deals, manual rates and newbuild flags preserved |

## 8. Independent calculation matrix

Final corrected independent matrix result: 9 pass, 1 fail.

| Scenario | Result | Notes |
| --- | --- | --- |
| Ordinary small deals below 50 000 do not move scale | PASS | Confirms strict threshold |
| Manual rate changes only one qualified row | PASS | Next automatic tier unaffected by manual percent value |
| Fixed explicit zero remains zero | PASS | No fallback to fixed default |
| Solo newbuild first row qualifies below 50 000 and accepts manual rate | PASS | First-row behavior OK |
| Solo newbuild after prior qualified deal uses next automatic tier | FAIL | `CALC-001` |
| Trainee fourth qualifying deal switches to partner fourth tier | PASS | 60% confirmed |
| Boosted starting rate is floor over standard scale | PASS | Floor behavior confirmed |
| Royalty strict boundaries | PASS | Boundary logic confirmed |
| Travel force include and explicit zero | PASS | Travel path OK |
| A4/shared office core agree in mixed two-agent scenario | PASS | No core/office divergence |

Failing evidence from `_audit/tests/audit-calculation-matrix.js`:

```text
solo newbuild after a prior qualifying deal should use the next automatic tier
actual:   [0.45, 0.45, 0.55]
expected: [0.45, 0.50, 0.55]
```

## 9. Browser audit

Real browser audit: yes, via headless Chrome/CDP against `http://127.0.0.1:8765`. The in-app browser webview was not available in this session, so the successful browser proof used local Chrome directly.

Browser scenario:

1. Opened A4 `index.html`.
2. Set month `2026-07`.
3. Filled exact deals: `100000` with manual rate `65`, then `1` with `newbuild solo`.
4. Saved draft, reloaded page, confirmed draft restored.
5. Opened table mode through `table.html` redirect to `table-ledger.html`.
6. Loaded A4 snapshot into ledger.
7. Confirmed snapshot v3, month, manual rate and newbuild flag in localStorage and UI.
8. Opened `simple.html` and confirmed scaffold/no script.
9. Opened `extended.html`, performed quick save smoke.

Browser-confirmed A4 values:

| Field | Value |
| --- | --- |
| selectedMonth | `2026-07` |
| dealsInput | `[100000, 1]` |
| dealManualRates | `[65, ""]` |
| dealNewbuildSoloFlags | `[false, true]` |
| appliedRates | `["65%", "45%"]` |
| snapshotVersion | `3` |

The `45%` on the second row is the browser-visible face of `CALC-001`: with a previous qualifying deal, a qualifying solo-newbuild row should be on the next automatic tier, not base 45%.

Browser console:

- Two `favicon.ico` 404 errors.
- No captured runtime crash for A4, ledger import, simple route or extended quick save.

## 10. A4 to ledger parity

No independent A4-vs-ledger formula divergence was found for active A4 and active ledger totals. Both use shared `calculateAgent()` and `calculateOffice()`.

Confirmed parity strengths:

- `table.html` routes to active `table-ledger.html`.
- Ledger imports A4 snapshot v3.
- Manual rates and newbuild flags survive A4 draft, reload, snapshot and ledger load.
- Existing active ledger tests cover preservation of travel decisions, special reserves, explicit zero values, trainee normalization, remove confirmations and snapshot import.

Important nuance: `table-mode-parity.test.js` is legacy coverage for `table-mode.js`, not proof that active `table-ledger.html` is correct. Active ledger has its own `table-ledger.test.js`.

## 11. localStorage and migration map

| Key | Owner | Purpose | Audit result |
| --- | --- | --- | --- |
| `domianA4DraftV2` | A4 | Current A4 draft | browser save/reload confirmed |
| `domianA4DraftV1` | A4 legacy | Legacy draft migration | code path present |
| `domianA4TableSnapshot` | A4 -> ledger | Table snapshot v3 | browser snapshot/import confirmed |
| `domianA4LedgerDraftV1` | Ledger | Active ledger draft | browser ledger save confirmed |
| `domianA4SelectedMonth` | A4 legacy | Legacy month key | hard reset removes it |
| `domianA4MonthDraftV1:*` | A4 legacy | Old month drafts | hard reset removes them |
| `domianExtendedDraft` | Extended | Extended mode draft | browser quick save confirmed |

State handling positives:

- A4 hard reset targets current and legacy A4 keys, ledger draft and table snapshot.
- Snapshot versioning is explicit.
- Active ledger accepts snapshot versions 1, 2 and 3 through migration/normalization paths.

State handling risk:

- Corrupt or incompatible active ledger draft is swallowed silently and user sees a blank/manual ledger without a visible warning. See `STATE-001`.

## 12. Existing tests verdict

All existing checks run in this audit passed:

| Command group | Result |
| --- | --- |
| `node --check` on production JS and tests | PASS |
| `a4-calculations.test.js` | PASS |
| `calendar-policy.test.js` | PASS |
| `table-ledger.test.js` | PASS |
| `table-mode-parity.test.js` | PASS |

The existing suite is useful and not superficial, especially around:

- Explicit zero vs blank semantics.
- A4 draft/snapshot state.
- Active ledger snapshot import.
- Travel decisions.
- Manual rate preservation.
- Trainee normalization and warnings.
- Legacy snapshot migrations.

But it misses the exact newbuild tier scenario in `CALC-001`.

## 13. Confirmed findings

### CALC-001: Solo-newbuild row qualifies but uses wrong automatic tier

Severity: HIGH  
Category: calculation error  
Affected components: A4, active ledger, shared core  
Files: `domian-calculator-a4/assets/js/calculations.js:697-704`, browser UI via `index.html` and `table-ledger.html`

Repro:

1. Agent partner, standard scheme, exact deals.
2. Deal 1: `100000`, ordinary.
3. Deal 2: `1`, `newbuild solo = true`, no manual rate.
4. Deal 3: `50000`, ordinary.

Expected rates:

```text
[45%, 50%, 55%]
```

Actual rates:

```text
[45%, 45%, 55%]
```

Root cause:

`calculateAgent()` correctly sets:

```js
isQualifiedDeposit = currentDealCommission >= qualifyingThreshold || row.isNewbuildSolo;
```

But the automatic tier index is calculated from commission only:

```js
automaticScaleIndex = getRateScaleIndexForDeal(currentDealCommission, qualifiedDealCount);
```

That helper returns base index `0` for amounts below 50 000, even when the row is a qualifying solo-newbuild row. Later the row increments `qualifiedDealCount`, so the following row sees the advanced scale. The broken row itself does not.

Impact:

- Underpays an automatic solo-newbuild row after prior qualified deals.
- Affects A4 display and active ledger display/totals equally.
- Existing tests pass despite this because current newbuild tests cover first-row or manual-rate cases, not "automatic newbuild after previous qualified row".

Recommended fix direction:

- In `calculateAgent()`, derive the automatic scale index from qualification status, not amount-only threshold.
- Add core test for `[100000, newbuild 1, 50000]`.
- Add A4/ledger regression where imported ledger shows the same corrected rates.

### ROUTE-001: Active "simple" route is a visible non-calculating scaffold

Severity: MEDIUM  
Category: UI/UX functional risk  
Affected component: `domian-calculator-a4/simple.html`

Evidence:

- Active nav links in A4 and ledger point to `simple.html`.
- Browser audit confirmed `hasScript: false`.
- Page contains about 10 visible inputs/selects.
- Page text says the fields do not perform calculation.

Impact:

- It is honest inside the page, but users can reach it from active navigation and may treat it as a working mode.
- This can look like broken input behavior rather than a deliberately postponed mode.

Recommended fix direction:

- Either remove/de-emphasize active navigation to simple mode until it calculates, or turn the scaffold into a read-only placeholder with no form-like controls.

### STATE-001: Corrupt active ledger draft falls back silently

Severity: MEDIUM  
Category: state/persistence risk  
Affected component: `domian-calculator-a4/assets/js/table-ledger.js:274-299`

Evidence:

- `loadLedgerDraft()` catches parse/validation failures and returns `null`.
- The user-facing result is blank/manual ledger state, not an explicit "saved ledger draft could not be restored" warning.

Impact:

- If localStorage contains a corrupt or incompatible ledger draft, a user can think the app simply has no saved work.
- This is safer than crashing, but poor for data trust.

Recommended fix direction:

- Show a visible warning when a saved draft exists but fails validation.
- Consider preserving/renaming the bad payload for manual recovery before overwriting it.

### TEST-001: Existing newbuild tests give false confidence on the broken tier case

Severity: MEDIUM  
Category: test gap  
Affected files: `domian-calculator-a4/tests/a4-calculations.test.js`, `domian-calculator-a4/tests/table-ledger.test.js`

Evidence:

- Existing tests pass.
- They cover solo-newbuild qualification and manual-rate preservation.
- They do not cover a solo-newbuild automatic row after a prior qualifying row.
- The independent audit matrix catches this exact missing case.

Impact:

- A future refactor could keep all current tests green while leaving a real money bug in place.

Recommended fix direction:

- Add a focused core test for automatic scale index on newbuild rows.
- Add active ledger import/display assertion without manual override on the newbuild row.

### ARCH-001: Duplicate/non-active calculation surfaces can mislead maintenance

Severity: MEDIUM  
Category: architecture/maintenance risk  
Affected files: `a4-premium-demo.html`, `assets/js/table-mode.js`, `assets/js/extended-mode.js`

Evidence:

- `a4-premium-demo.html` contains inline standalone calculation code, including `calculateAgent`.
- `table-mode.js` and `table-mode.css` remain in the active source tree, but active `table-ledger.html` does not load them.
- `table-mode-parity.test.js` still passes, but it is legacy coverage, not active ledger proof.
- `extended-mode.js` uses the shared core for summary, but also renders detailed per-deal payout via local `amount * getDealRate(...)`.

Impact:

- Fixes can be applied to the wrong table implementation.
- Passing legacy tests can be mistaken for active ledger proof.
- Display-only/local calculations can diverge from core over time.

Recommended fix direction:

- Label legacy files/tests explicitly or move them to archive when safe.
- Keep active per-deal displays sourced from core `dealMetrics` wherever possible.

### UX-001: Active ledger row-level royalty/referral are local display allocations

Severity: LOW  
Category: UX/accounting interpretation risk  
Affected component: `domian-calculator-a4/assets/js/table-ledger.js:519`, `table-ledger.js:719-722`, `table-ledger.js:762-772`

Evidence:

- Office totals are core-calculated.
- Row-level royalty/referral cells use proportional/local display allocation.

Impact:

- Totals are not the issue.
- Risk is interpretive: a user can treat row-level allocation cells as authoritative per-deal legal/accounting values.

Recommended fix direction:

- Add small label/help text in the table header or tooltip: row royalty/referral are display allocation of office totals.

### A11Y-001: Remove deal button has weak accessible name

Severity: LOW  
Category: accessibility/usability  
Affected component: `domian-calculator-a4/assets/js/table-ledger.js:748`

Evidence:

- Deal remove button is rendered as `×`.
- No explicit `aria-label` or title is attached in that markup.

Impact:

- Screen readers and voice-control users may get an unclear button name.

Recommended fix direction:

- Add `aria-label="Удалить сделку"` or equivalent for remove buttons.

### CONSOLE-001: Missing favicon creates browser console noise

Severity: LOW  
Category: browser hygiene  
Affected route: browser-loaded local pages

Evidence:

- Browser audit captured two `favicon.ico` 404 console errors.
- No app crash was associated with them.

Impact:

- Low operational impact, but it adds noise to console checks.

Recommended fix direction:

- Add a favicon asset or suppress the request with an explicit icon link.

### TEST-002: No committed real-browser regression path for A4 to active ledger

Severity: LOW  
Category: test coverage gap  
Affected area: end-to-end browser workflow

Evidence:

- Existing tests are mostly VM/static Node harnesses.
- This audit created `_audit/tests/browser-cdp-audit.js`, but it is an audit artifact, not a production test.

Impact:

- DOM, localStorage and redirect regressions can slip through if they only occur in real browser behavior.

Recommended fix direction:

- Promote a small browser smoke into the repo test strategy when fixing `CALC-001`: A4 save -> reload -> snapshot -> table alias redirect -> ledger load.

## 14. What looks solid

These areas passed both source inspection and tests/audit smoke:

- Active ledger is `table-ledger.html`, not old `table-mode.js`.
- `table.html` alias redirects correctly.
- A4 draft save and reload work in real browser smoke.
- A4 snapshot v3 is written and imported into active ledger.
- Manual rate and newbuild flags survive A4 -> snapshot -> ledger.
- Ordinary small deals below threshold do not advance scale.
- Manual rate does not move the next automatic tier by its percent value.
- Fixed explicit zero is preserved.
- Trainee fourth qualifying deal uses partner fourth-tier rate.
- Boosted starting rate acts as a floor.
- Royalty boundary logic uses strict less-than tiers.
- Travel forced include and explicit zero are preserved.
- Active ledger does not load the legacy table-mode runtime.

## 15. Limitations of this audit

- No production code was changed, by request.
- No internet/public deployment audit was performed.
- No `git status` was run.
- Browser audit used Chrome headless/CDP, not Safari/WebKit.
- No exhaustive mobile/responsive screenshot matrix was performed.
- No large-volume real-browser performance run was performed; existing tests cover some large state/counter behavior, but not visual performance at scale.

## 16. Recommended fix order

1. Fix `CALC-001` in shared `calculateAgent()` tier selection.
2. Add focused tests for newbuild automatic tier after prior qualified rows in core and active ledger.
3. Re-run existing tests plus the independent matrix.
4. Repeat browser smoke: A4 save/reload -> snapshot -> `table.html` redirect -> ledger load.
5. Decide whether simple mode should be hidden/de-emphasized until it calculates.
6. Add visible warning for corrupt ledger draft.
7. Label or archive legacy table/demo surfaces to avoid future maintenance confusion.

## 17. Final operational verdict

Production files changed: no.  
Audit artifacts changed/created only under `_audit/`: yes.  
Existing tests: pass.  
Independent audit tests: 1 intentional fail exposing `CALC-001`.  
Real browser audit: yes, Chrome headless/CDP.  
Critical blockers: none found.  
High blocker: one shared calculation bug affecting solo-newbuild automatic tier.  

Do not ship or rely on the calculator as final financial truth until `CALC-001` is fixed and covered by regression tests.
