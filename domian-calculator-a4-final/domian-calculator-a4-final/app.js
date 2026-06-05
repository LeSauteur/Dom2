(function () {
  'use strict';

  var state = null;
  var idCounter = 1;
  var expenseCounter = 100;
  var elements = {};

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nextId() {
    idCounter += 1;
    return 'agent-' + idCounter;
  }

  function nextExpenseId() {
    expenseCounter += 1;
    return 'expense-' + expenseCounter;
  }

  function createMotivation() {
    return clone(DEFAULT_MOTIVATION);
  }

  function normalizeAgent(agent) {
    var normalized = Object.assign({
      id: nextId(),
      name: 'Новый агент',
      commission: 0,
      dealCount: 1,
      commissionMode: 'exact',
      dealsInput: [0],
      paymentType: 'standard',
      status: 'partner',
      boostedRates: clone(PAY_SCALES.boostedDefault),
      fixedRate: PAY_SCALES.fixedDefault,
      introduced: false,
      quarterlyCommission: 0,
      quarterlyDeposits: 0,
      halfYearCommission: 0,
      preTripQuarterDeposits: 0,
      motivationOverride: false,
      stipendOverride: false,
      travelOverride: false,
      eventsOverride: false,
      specialTermsOverride: false,
      motivation: createMotivation()
    }, agent || {});
    normalized.motivation = Object.assign(createMotivation(), normalized.motivation || {});
    normalized.boostedRates = Array.isArray(normalized.boostedRates) ? normalized.boostedRates.slice() : clone(PAY_SCALES.boostedDefault);
    if (!Array.isArray(normalized.dealsInput) || !normalized.dealsInput.length) {
      normalized.dealsInput = [positiveNumber(normalized.commission) || 0];
    }
    return normalized;
  }

  function createAgent() {
    return normalizeAgent({ id: nextId(), name: 'Новый агент' });
  }

  function createBlankExpense() {
    return { id: nextExpenseId(), name: 'Новый расход', amount: 0 };
  }

  function createState() {
    return {
      expenses: clone(DEFAULT_EXPENSES),
      agents: clone(DEFAULT_AGENTS).map(normalizeAgent),
      ownerSales: 150000,
      showTableView: false,
      schemeCheck: {
        commission: 400000,
        dealCount: 4,
        introduced: false,
        expenseShareMode: 'manual',
        manualExpenseShare: 20000,
        motivationReserve: 0,
        manualRate: 80
      }
    };
  }

  function createBlankState() {
    return {
      expenses: [createBlankExpense()],
      agents: [createAgent()],
      ownerSales: 0,
      showTableView: false,
      schemeCheck: {
        commission: 0,
        dealCount: 1,
        introduced: false,
        expenseShareMode: 'manual',
        manualExpenseShare: 0,
        motivationReserve: 0,
        manualRate: 80
      }
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function option(value, label, current) {
    return '<option value="' + value + '"' + (String(value) === String(current) ? ' selected' : '') + '>' + label + '</option>';
  }

  function checked(value) {
    return value ? ' checked' : '';
  }

  function disabled(value) {
    return value ? ' disabled' : '';
  }

  function findAgent(agentId) {
    return state.agents.find(function (agent) { return agent.id === agentId; });
  }

  function splitCommissionIntoDeals(commission, dealCount) {
    var count = Math.max(1, Math.floor(positiveNumber(dealCount) || 1));
    var amount = count ? positiveNumber(commission) / count : 0;
    var deals = [];
    for (var i = 0; i < count; i += 1) {
      deals.push(amount);
    }
    return deals;
  }

  function setText(id, value) {
    if (elements[id]) {
      elements[id].textContent = value;
    }
  }

  function resultClass(value) {
    if (value > 0.5) return 'positive';
    if (value < -0.5) return 'negative';
    return 'neutral';
  }

  function getAutoExpenseShare(totals) {
    return totals.agentEconomics.length ? totals.expenses / totals.agentEconomics.length : totals.expenses;
  }

  function getSchemeExpenseShare(totals) {
    if (state.schemeCheck.expenseShareMode === 'manual') {
      return positiveNumber(state.schemeCheck.manualExpenseShare);
    }
    return getAutoExpenseShare(totals);
  }

  function renderExpenses() {
    elements.expensesList.innerHTML = state.expenses.map(function (expense) {
      return '<label class="field expense-row">'
        + '<span>Категория</span>'
        + '<input type="text" data-expense-id="' + expense.id + '" data-expense-field="name" value="' + escapeHtml(expense.name) + '">'
        + '<input type="number" min="0" step="1000" data-expense-id="' + expense.id + '" data-expense-field="amount" value="' + positiveNumber(expense.amount) + '" aria-label="Сумма расхода">'
        + '<button class="button ghost" type="button" data-action="remove-expense" data-expense-id="' + expense.id + '"' + (state.expenses.length === 1 ? ' disabled' : '') + '>Удалить</button>'
        + '</label>';
    }).join('');
  }

  function renderDealInputs(agent, result) {
    if (agent.commissionMode === 'quick') {
      return '<div class="exact-deals-panel wide-field quick-deals-panel">'
        + '<p class="hint">Быстрый расчёт — примерная оценка. Калькулятор делит общую комиссию поровну на сделки.</p>'
        + '<div class="form-grid compact-grid">'
        + '<label class="field"><span>Сколько агент принёс комиссии, ₽</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="commission" value="' + result.commission + '"></label>'
        + '<label class="field"><span>Количество сделок</span><input type="number" min="1" step="1" data-agent-id="' + agent.id + '" data-agent-field="dealCount" value="' + result.dealCount + '"></label>'
        + '</div></div>';
    }

    var deals = Array.isArray(agent.dealsInput) && agent.dealsInput.length ? agent.dealsInput : [0];
    return '<div class="exact-deals-panel wide-field">'
      + '<p class="hint">Для точной зарплаты вводите сделки отдельно. Особенно если одна сделка сильно больше других.</p>'
      + '<div class="exact-deals-list">'
      + deals.map(function (deal, index) {
        return '<label class="field exact-deal-row">'
          + '<span>Сделка ' + (index + 1) + ' — комиссия, ₽</span>'
          + '<input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-deal-index="' + index + '" value="' + positiveNumber(deal) + '">'
          + '<button class="button ghost" type="button" data-action="remove-deal" data-agent-id="' + agent.id + '" data-deal-index="' + index + '"' + (deals.length === 1 ? ' disabled' : '') + '>Удалить</button>'
          + '</label>';
      }).join('')
      + '</div>'
      + '<button class="button ghost" type="button" data-action="add-deal" data-agent-id="' + agent.id + '">Добавить сделку</button>'
      + '<dl class="exact-deals-total">'
      + '<div><dt>Итого комиссия</dt><dd data-agent-summary="commission" data-agent-id="' + agent.id + '">' + money(result.commission) + '</dd></div>'
      + '<div><dt>Количество сделок</dt><dd data-agent-summary="dealCount" data-agent-id="' + agent.id + '">' + result.dealCount + '</dd></div>'
      + '</dl></div>';
  }

  function renderOverrideCheckbox(agent, field, label) {
    return '<label class="override-row">'
      + '<input type="checkbox" data-agent-id="' + agent.id + '" data-agent-field="' + field + '" data-structural="true"' + checked(agent[field]) + '>'
      + '<span>' + label + '</span></label>';
  }

  function renderEligibilityNote(available, reason, overridden) {
    if (available) return '<p class="eligibility-note ok">Доступно по текущим условиям.</p>';
    if (overridden) return '<p class="eligibility-note warning">Условия не выполнены, но расход добавлен вручную как решение собственника.</p>';
    var text = 'Мотивация недоступна по текущим условиям.';
    if (reason === 'partnership') text = 'Партнёрство не подтверждено: задатков за квартал меньше 250 000 ₽.';
    if (reason === 'specialTerms') text = 'У агента особые условия выплаты. По умолчанию мотивации за счёт офиса не предусмотрены.';
    if (reason === 'halfYearLevel') text = 'Путешествие недоступно: результат за полугодие меньше 1 600 000 ₽.';
    if (reason === 'preTripDeposits') text = 'Путешествие недоступно: в квартале перед поездкой задатков меньше 250 000 ₽.';
    if (reason === 'level') text = 'Стипендия не положена: агент не достиг нужного уровня по результатам.';
    return '<p class="eligibility-note blocked">' + text + '</p>';
  }

  function renderMotivationMetric(agentId, key, label, value) {
    return '<div><dt>' + label + '</dt><dd data-agent-id="' + agentId + '" data-motivation-metric="' + key + '">' + moneyPrecise(value) + '</dd></div>';
  }

  function renderTripMotivationCard(agent, config) {
    var motivation = Object.assign(createMotivation(), agent.motivation || {});
    var reserve = calculateMotivationReserve(agent);
    var annual = reserve[config.key + 'Annual'];
    var available = reserve[config.key + 'Available'];
    var reason = reserve[config.key + 'Reason'];
    var overridden = !available && (agent[config.overrideField] || agent.motivationOverride);
    var locked = !available && !overridden;
    return '<article class="motivation-card' + (locked ? ' is-blocked' : '') + '">'
      + '<label class="motivation-card-toggle"><input type="checkbox" data-agent-id="' + agent.id + '" data-motivation-flag="' + config.enabledField + '"' + checked(motivation[config.enabledField]) + disabled(locked) + '><span><strong>' + config.title + '</strong><small>' + config.description + '</small></span></label>'
      + renderEligibilityNote(available, reason, overridden)
      + (!available ? renderOverrideCheckbox(agent, config.overrideField, config.overrideLabel) : '')
      + '<div class="motivation-card-fields">'
      + '<label class="field"><span>Сумма за поездку, ₽</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-motivation-field="' + config.amountField + '" value="' + motivation[config.amountField] + '"' + disabled(locked) + '></label>'
      + '<label class="field"><span>Количество поездок в год</span><input type="number" min="0" step="1" data-agent-id="' + agent.id + '" data-motivation-field="' + config.countField + '" value="' + motivation[config.countField] + '"' + disabled(locked) + '></label>'
      + '</div><dl class="motivation-card-total">'
      + renderMotivationMetric(agent.id, config.key + 'Annual', 'Итого в год', annual)
      + renderMotivationMetric(agent.id, config.key + 'Monthly', 'В месяц при делении на 12', annual / 12)
      + '</dl></article>';
  }

  function renderAnnualMotivationCard(agent, config) {
    var motivation = Object.assign(createMotivation(), agent.motivation || {});
    var reserve = calculateMotivationReserve(agent);
    var annual = reserve[config.key + 'Annual'];
    var available = config.alwaysAvailable ? true : reserve[config.key + 'Available'];
    var reason = config.alwaysAvailable ? 'available' : reserve[config.key + 'Reason'];
    var overridden = !available && (agent[config.overrideField] || agent.motivationOverride);
    var locked = !available && !overridden;
    return '<article class="motivation-card' + (locked ? ' is-blocked' : '') + '">'
      + '<label class="motivation-card-toggle"><input type="checkbox" data-agent-id="' + agent.id + '" data-motivation-flag="' + config.enabledField + '"' + checked(motivation[config.enabledField]) + disabled(locked) + '><span><strong>' + config.title + '</strong><small>' + config.description + '</small></span></label>'
      + (config.alwaysAvailable ? '<p class="eligibility-note ok">Конгресс и Звезда учитываются как обязательный годовой расход собственника и доступны независимо от условий агента.</p>' : renderEligibilityNote(available, reason, overridden))
      + (!available ? renderOverrideCheckbox(agent, config.overrideField, config.overrideLabel) : '')
      + '<div class="motivation-card-fields single">'
      + '<label class="field"><span>Сумма в год, ₽</span><input type="number" min="0" step="500" data-agent-id="' + agent.id + '" data-motivation-field="' + config.amountField + '" value="' + motivation[config.amountField] + '"' + disabled(locked) + '></label>'
      + '</div><dl class="motivation-card-total">'
      + renderMotivationMetric(agent.id, config.key + 'Annual', 'Итого в год', annual)
      + renderMotivationMetric(agent.id, config.key + 'Monthly', 'В месяц при делении на 12', annual / 12)
      + '</dl></article>';
  }

  function renderMotivationControls(agent) {
    var motivation = Object.assign(createMotivation(), agent.motivation || {});
    var reserve = calculateMotivationReserve(agent);
    var result = calculateAgent(agent);
    return '<details class="motivation-box" data-agent-id="' + agent.id + '">'
      + '<summary class="motivation-summary"><span><strong>Мотивации и резервы агента</strong><span class="motivation-summary-text">Стипендии, поездки, корпоративы, Конгресс и Звезда.</span></span><span class="motivation-current">Сейчас учтено: <b data-agent-summary="motivationInline" data-agent-id="' + agent.id + '">' + money(result.motivationReserve) + '</b> / месяц</span></summary>'
      + '<section class="eligibility-panel"><p><strong>Проверка права на мотивации.</strong> Заполните квартальный результат и задатки.</p>'
      + '<div class="form-grid compact-grid">'
      + '<label class="field"><span>Результат агента за квартал, ₽</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="quarterlyCommission" data-structural="true" value="' + positiveNumber(agent.quarterlyCommission) + '"></label>'
      + '<label class="field"><span>Задатки за квартал, ₽</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="quarterlyDeposits" data-structural="true" value="' + positiveNumber(agent.quarterlyDeposits) + '"></label>'
      + '<label class="field"><span>Результат за полугодие, ₽</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="halfYearCommission" data-structural="true" value="' + positiveNumber(agent.halfYearCommission) + '"></label>'
      + '<label class="field"><span>Задатки перед поездкой, ₽</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="preTripQuarterDeposits" data-structural="true" value="' + positiveNumber(agent.preTripQuarterDeposits) + '"></label>'
      + '</div>'
      + '<p class="eligibility-note ' + (reserve.partnershipConfirmed ? 'ok' : 'blocked') + '">' + (reserve.partnershipConfirmed ? 'Партнёрство подтверждено.' : 'Партнёрство не подтверждено: задатков за квартал меньше 250 000 ₽.') + '</p>'
      + renderOverrideCheckbox(agent, 'specialTermsOverride', 'Разрешить мотивации при особых условиях агента') + '</section>'
      + '<section class="reserve-mode-card"><div class="form-grid compact-grid">'
      + '<label class="field wide-field"><span>Как учитывать стипендию?</span><select data-agent-id="' + agent.id + '" data-motivation-field="stipendMode">' + option('off', 'Не считать', motivation.stipendMode) + option('auto', 'Посчитать по кварталу', motivation.stipendMode) + option('manual', 'Ввести сумму вручную', motivation.stipendMode) + '</select></label>'
      + (!reserve.stipendAvailable ? renderOverrideCheckbox(agent, 'stipendOverride', 'Всё равно заложить стипендию') : '')
      + '<label class="field"><span>Стипендия вручную, ₽/мес</span><input type="number" min="0" step="500" data-agent-id="' + agent.id + '" data-motivation-field="manualStipendMonthly" value="' + motivation.manualStipendMonthly + '"></label>'
      + '<label class="field"><span>Как учитывать годовые мотивации?</span><select data-agent-id="' + agent.id + '" data-motivation-field="annualReserveMode">' + option('monthly', 'Распределить по 12 месяцам', motivation.annualReserveMode) + option('full', 'Учесть всю сумму сейчас', motivation.annualReserveMode) + option('manual', 'Ввести свою сумму в месяц', motivation.annualReserveMode) + '</select></label>'
      + '<label class="field"><span>Своя сумма резерва, ₽/мес</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-motivation-field="manualAnnualReserveMonthly" value="' + motivation.manualAnnualReserveMonthly + '"></label>'
      + '</div></section>'
      + '<div class="motivation-card-grid">'
      + renderTripMotivationCard(agent, { key: 'mountainSea', enabledField: 'mountainSeaEnabled', amountField: 'mountainSeaPerTrip', countField: 'mountainSeaTripsPerYear', overrideField: 'travelOverride', overrideLabel: 'Всё равно заложить поездки по РФ', title: 'Горы / Море', description: '2 поездки по 15 000 ₽ в год' })
      + renderTripMotivationCard(agent, { key: 'travel', enabledField: 'travelEnabled', amountField: 'travelPerTrip', countField: 'travelTripsPerYear', overrideField: 'travelOverride', overrideLabel: 'Всё равно заложить путешествие', title: 'Заграница / Путешествие', description: '2 поездки по 120 000 ₽ в год' })
      + renderAnnualMotivationCard(agent, { key: 'corporate', enabledField: 'corporateEnabled', amountField: 'corporatePerYear', overrideField: 'eventsOverride', overrideLabel: 'Всё равно заложить корпоратив', title: 'Корпоративы', description: 'Годовой резерв на мероприятия' })
      + renderAnnualMotivationCard(agent, { key: 'congress', enabledField: 'congressEnabled', amountField: 'congressPerYear', alwaysAvailable: true, title: 'Конгресс', description: 'Обязательный годовой расход' })
      + renderAnnualMotivationCard(agent, { key: 'star', enabledField: 'starEnabled', amountField: 'starPerYear', alwaysAvailable: true, title: 'Звезда', description: 'Обязательный годовой расход' })
      + '</div></details>';
  }

  function renderAgents() {
    elements.agentsList.innerHTML = state.agents.map(function (agent, index) {
      var result = calculateAgent(agent);
      var boostedControls = '';
      var fixedControl = '';
      var statusControl = '';
      if (agent.paymentType === 'standard') {
        statusControl = '<label class="field"><span>Статус</span><select data-agent-id="' + agent.id + '" data-agent-field="status">' + option('trainee', 'Стажёр', agent.status) + option('partner', 'Партнёр', agent.status) + '</select></label>';
      }
      if (agent.paymentType === 'boosted') {
        boostedControls = '<div class="rate-grid">' + [0, 1, 2, 3].map(function (rateIndex) {
          var labels = ['1-я сделка, %', '2-я сделка, %', '3-я сделка, %', '4-я и далее, %'];
          return '<label class="field"><span>' + labels[rateIndex] + '</span><input type="number" min="0" max="100" step="1" data-agent-id="' + agent.id + '" data-rate-index="' + rateIndex + '" value="' + agent.boostedRates[rateIndex] + '"></label>';
        }).join('') + '</div>';
      }
      if (agent.paymentType === 'fixed') {
        fixedControl = '<label class="field"><span>Фиксированный процент</span><input type="number" min="0" max="100" step="1" data-agent-id="' + agent.id + '" data-agent-field="fixedRate" value="' + agent.fixedRate + '"></label>';
      }
      return '<article class="agent-card">'
        + '<div class="agent-head"><h3>Агент ' + (index + 1) + '</h3><button class="button ghost" type="button" data-action="remove-agent" data-agent-id="' + agent.id + '"' + (state.agents.length === 1 ? ' disabled' : '') + '>Удалить</button></div>'
        + '<div class="form-grid">'
        + '<label class="field"><span>Имя</span><input type="text" data-agent-id="' + agent.id + '" data-agent-field="name" value="' + escapeHtml(agent.name) + '"></label>'
        + '<label class="field"><span>Как считать сделки?</span><select data-agent-id="' + agent.id + '" data-agent-field="commissionMode" data-structural="true">' + option('exact', 'Точно: ввести каждую сделку отдельно', agent.commissionMode) + option('quick', 'Быстро: общая комиссия и количество сделок', agent.commissionMode) + '</select></label>'
        + renderDealInputs(agent, result)
        + '<label class="field"><span>Тип расчёта выплаты</span><select data-agent-id="' + agent.id + '" data-agent-field="paymentType" data-structural="true">' + option('standard', 'Стандартная шкала', agent.paymentType) + option('boosted', 'Повышенная стартовая шкала', agent.paymentType) + option('fixed', 'Фиксированный процент', agent.paymentType) + '</select></label>'
        + statusControl + fixedControl
        + '<label class="field"><span>Приведённый агент</span><select data-agent-id="' + agent.id + '" data-agent-field="introduced">' + option('false', 'Нет', String(agent.introduced)) + option('true', 'Да', String(agent.introduced)) + '</select><small>Если да, дополнительно считается 2,5% от комиссии агента.</small></label>'
        + '</div>' + boostedControls + renderMotivationControls(agent)
        + '<dl class="agent-summary">'
        + '<div><dt>Выплата агенту</dt><dd data-agent-summary="payout" data-agent-id="' + agent.id + '">' + money(result.payout) + '</dd></div>'
        + '<div><dt>Реферал</dt><dd data-agent-summary="referral" data-agent-id="' + agent.id + '">' + money(result.referral) + '</dd></div>'
        + '<div><dt>Мотивационный резерв</dt><dd data-agent-summary="motivation" data-agent-id="' + agent.id + '">' + money(result.motivationReserve) + '</dd></div>'
        + '<div><dt>До роялти и расходов</dt><dd data-agent-summary="office" data-agent-id="' + agent.id + '">' + money(result.officeBeforeRoyaltyAndReserve) + '</dd></div>'
        + '</dl></article>';
    }).join('');
  }

  function renderProfitability(totals) {
    elements.profitabilityList.innerHTML = totals.agentEconomics.map(function (agent) {
      var statusClass = agent.status === 'Окупается' ? 'positive' : (agent.status === 'На грани' ? 'warning' : 'danger');
      return '<article class="economics-row ' + statusClass + '">'
        + '<div><strong>' + escapeHtml(agent.name) + '</strong><span>' + agent.status + '</span></div>'
        + '<dl><div><dt>Комиссия</dt><dd>' + money(agent.commission) + '</dd></div><div><dt>Выплата</dt><dd>' + money(agent.payout) + '</dd></div><div><dt>Реферал</dt><dd>' + money(agent.referral) + '</dd></div><div><dt>Резерв</dt><dd>' + money(agent.motivationReserve) + '</dd></div><div><dt>Роялти-оценка</dt><dd>' + money(agent.royaltyShare) + '</dd></div><div><dt>Доля расходов</dt><dd>' + money(agent.expenseShare) + '</dd></div><div><dt>Вклад</dt><dd>' + money(agent.contribution) + '</dd></div></dl>'
        + '</article>';
    }).join('');
  }

  function getManagementDiagnosis(totals) {
    if (Math.abs(totals.resultWithoutOwner) <= CONTRIBUTION_EDGE || Math.abs(totals.resultWithOwner) <= CONTRIBUTION_EDGE) {
      return { cls: 'neutral', text: 'Офис находится около точки безубыточности. Небольшое снижение оборота или рост расходов быстро уведёт его в минус.' };
    }
    if (totals.resultWithOwner < 0) {
      return { cls: 'danger', text: 'Офис убыточен даже с личными сделками собственника. При текущих показателях нужно увеличить оборот, снизить расходы или пересмотреть условия выплат.' };
    }
    if (totals.resultWithoutOwner < 0 && totals.resultWithOwner > 0) {
      return { cls: 'warning', text: 'Офис в плюсе только за счёт личных сделок собственника. Без них результат офиса: ' + money(totals.resultWithoutOwner) + '. Команда пока не покрывает расходы офиса самостоятельно.' };
    }
    return { cls: 'positive', text: 'Офис окупается как система. Даже без личных сделок собственника остаётся положительный результат: +' + money(totals.resultWithoutOwner) + '.' };
  }

  function getAgentRiskReasons(agentEcon) {
    var stateAgent = findAgent(agentEcon.id) || {};
    var reasons = [];
    if (stateAgent.paymentType === 'fixed') reasons.push('фиксированный процент');
    if (stateAgent.paymentType === 'boosted') reasons.push('повышенная шкала');
    if (agentEcon.referral > 0) reasons.push('реферал 2,5%');
    if (agentEcon.motivationReserve > 5000) reasons.push('мотивационный резерв');
    if (agentEcon.commission < 150000) reasons.push('низкая комиссия');
    if (agentEcon.expenseShare > agentEcon.commission * 0.3) reasons.push('высокая доля расходов офиса');
    if (!reasons.length && agentEcon.contribution < -CONTRIBUTION_EDGE) reasons.push('комиссия недостаточна для выплаты, роялти-оценки и доли расходов');
    return reasons;
  }

  function renderManagementSummary(totals) {
    if (!elements.managementSummary) return;
    var diagnosis = getManagementDiagnosis(totals);
    var maxAbs = Math.max(1, Math.max.apply(null, totals.agentEconomics.map(function (a) { return Math.abs(a.contribution); })));
    var riskyAgents = [];
    var agentsHtml = totals.agentEconomics.map(function (agent) {
      var cls = agent.contribution > CONTRIBUTION_EDGE ? 'positive' : (agent.contribution >= -CONTRIBUTION_EDGE ? 'warning' : 'danger');
      var label = cls === 'positive' ? 'Сильный агент' : (cls === 'warning' ? 'Почти в ноль' : 'Зона риска');
      var width = Math.max(4, Math.min(100, Math.abs(agent.contribution) / maxAbs * 100));
      if (cls === 'danger') riskyAgents.push(agent);
      var reasons = cls === 'danger' ? getAgentRiskReasons(agent) : [];
      return '<div class="management-agent-row">'
        + '<div class="management-agent-head"><strong>' + escapeHtml(agent.name) + '</strong><span class="badge ' + cls + '">' + label + '</span></div>'
        + '<div>Вклад: <strong class="' + cls + '-text">' + money(agent.contribution) + '</strong></div>'
        + '<div class="management-bar-shell"><div class="management-bar ' + cls + '" style="width:' + width.toFixed(1) + '%"></div></div>'
        + '<p class="hint">' + (cls === 'positive' ? 'Оставляет офису деньги после выплаты, реферала, мотиваций, роялти-оценки и своей доли расходов.' : (cls === 'warning' ? 'Близок к окупаемости, но запаса почти нет.' : 'Сейчас не окупает своё место.')) + '</p>'
        + (reasons.length ? '<p class="hint danger-text"><strong>Причины:</strong> ' + reasons.join(', ') + '.</p>' : '')
        + '</div>';
    }).join('');
    var recs = [];
    if (totals.warningOwnerDependency) recs.push('Проверьте планы агентов: сейчас команда без личных сделок собственника не закрывает расходы офиса.');
    riskyAgents.forEach(function (agent) {
      var stateAgent = findAgent(agent.id) || {};
      if (stateAgent.paymentType === 'fixed') recs.push('Фиксированный процент у ' + escapeHtml(agent.name) + ' стоит оставлять только при понятном минимальном плане.');
      else if (stateAgent.paymentType === 'boosted') recs.push('Повышенная шкала у ' + escapeHtml(agent.name) + ' требует контроля оборота.');
      else recs.push('Проверьте условия выплат и минимальный план комиссии по агенту ' + escapeHtml(agent.name) + '.');
    });
    if (!recs.length && totals.agentEconomics.length > 0) recs.push('Команда окупает своё место. Следующий фокус — удержать оборот и не увеличивать постоянные расходы без необходимости.');
    elements.managementSummary.innerHTML = '<div class="section-head"><span class="step-label">Вывод</span><h2>Управленческий итог</h2><p class="hint">Диагноз офиса, вклад агентов и практические рекомендации.</p></div>'
      + '<div class="management-content"><div class="management-diagnosis ' + diagnosis.cls + '">' + diagnosis.text + '</div>'
      + '<h3>Вклад агентов</h3><div class="management-agents-list">' + agentsHtml + '</div>'
      + '<h3>Рекомендации собственнику</h3><ul class="management-recs">' + recs.map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ul></div>';
  }

  function renderForecast(totals) {
    if (!elements.forecastSection) return;
    var periods = [{ label: 'Месяц', mult: 1 }, { label: 'Квартал', mult: 3 }, { label: 'Полугодие', mult: 6 }, { label: 'Год', mult: 12 }];
    var rows = periods.map(function (p) {
      var resWithout = totals.resultWithoutOwner * p.mult;
      var resWith = totals.resultWithOwner * p.mult;
      return '<tr><td><strong>' + p.label + ' ×' + p.mult + '</strong></td><td>' + money(totals.totalTurnover * p.mult) + '</td><td>' + money(totals.agentPayouts * p.mult) + '</td><td>' + money(totals.referrals * p.mult) + '</td><td>' + money(totals.motivationReserves * p.mult) + '</td><td>' + money(totals.royaltyWithOwner * p.mult) + '</td><td>' + money(totals.expenses * p.mult) + '</td><td class="' + (resWithout >= 0 ? 'positive' : 'danger') + '">' + money(resWithout) + '</td><td class="' + (resWith >= 0 ? 'positive' : 'danger') + '">' + money(resWith) + '</td></tr>';
    }).join('');
    var annualResult = totals.resultWithOwner * 12;
    var annualWithout = totals.resultWithoutOwner * 12;
    var note = 'При текущих показателях офис за год даст примерно ' + money(annualResult) + '. ';
    if (annualWithout < 0) note += 'Без личных сделок собственника годовой прогноз отрицательный: ' + money(annualWithout) + '. ';
    var risky = totals.agentEconomics.find(function (agent) { return agent.contribution < -CONTRIBUTION_EDGE; });
    if (risky) note += 'Главный риск прогноза — агент ' + escapeHtml(risky.name) + ', его отрицательный вклад за год составит около ' + money(risky.contribution * 12) + '.';
    elements.forecastSection.innerHTML = '<div class="section-head"><span class="step-label">Прогноз</span><h2>Прогноз при текущих показателях</h2><p class="hint">Прогноз показывает, что будет, если офис каждый месяц будет работать с такими же показателями. Это не фактический отчёт за период.</p><p class="hint"><strong>Важно:</strong> роялти считается как сумма одинаковых месяцев. Если оборот по месяцам будет отличаться, ставка роялти может измениться.</p></div>'
      + '<div class="table-wrap"><table class="scheme-table forecast-table"><thead><tr><th>Период</th><th>Оборот</th><th>Выплаты</th><th>Рефералы</th><th>Мотивации</th><th>Роялти</th><th>Расходы</th><th>Итог без собственника</th><th>Итог с собственником</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div class="scheme-advice">' + note + '</div>';
  }

  function renderSchemeChecker(totals) {
    var expenseShare = getSchemeExpenseShare(totals);
    var result = comparePaymentSchemes({ commission: state.schemeCheck.commission, dealCount: state.schemeCheck.dealCount, introduced: state.schemeCheck.introduced, expenseShare: expenseShare, motivationReserve: state.schemeCheck.motivationReserve, manualRate: state.schemeCheck.manualRate });
    setText('schemeExpenseShare', money(expenseShare));
    elements.schemeResults.innerHTML = result.variants.map(function (variant) {
      var statusClass = variant.contribution > 5000 ? 'positive' : (variant.contribution >= -5000 ? 'warning' : 'danger');
      return '<tr class="' + statusClass + '"><td>' + escapeHtml(variant.label) + '</td><td>' + money(variant.payout) + '</td><td>' + money(variant.referral) + '</td><td>' + money(variant.royalty) + '</td><td>' + money(variant.beforeExpenses) + '</td><td>' + money(variant.contribution) + '</td><td>' + (variant.breakEvenCommission === null ? 'выше 10 млн ₽' : money(variant.breakEvenCommission)) + '</td><td>' + variant.conclusion + '</td></tr>';
    }).join('');
    var safe = result.variants.filter(function (variant) { return variant.contribution > 0; }).sort(function (a, b) { return b.contribution - a.contribution; });
    elements.schemeAdvice.textContent = safe.length ? 'Самый безопасный вариант сейчас: ' + safe[0].label + ' — вклад ' + money(safe[0].contribution) + '.' : 'При текущих вводных все варианты убыточны. Проверьте оборот, расходы и мотивации.';
  }

  function renderWarnings(totals) {
    var warnings = [];
    if (totals.warningOwnerDependency) warnings.push({ type: 'warning', text: 'Офис выходит в плюс только за счёт личных продаж собственника. Как система офис пока не окупается сам.' });
    if (totals.resultWithOwner < -0.5) warnings.push({ type: 'danger', text: 'Офис в минусе. Проверьте расходы, выплаты агентам, мотивационные резервы и общий оборот.' });
    if (totals.agentEconomics.some(function (agent) { return agent.status === 'Не окупается'; })) warnings.push({ type: 'danger', text: 'Есть агенты, которые не окупают свою долю расходов. Посмотрите блок “Кто окупает своё место”.' });
    warnings.push({ type: 'info', text: 'Роялти рассчитано автоматически от общего оборота: ' + money(totals.totalTurnover) + ' × ' + percent(getRoyaltyRate(totals.totalTurnover)) + '.' });
    warnings.push({ type: 'info', text: 'Роялти по агенту в блоке окупаемости показано как управленческая оценка: реальная ставка зависит от общего оборота офиса.' });
    elements.warningsList.innerHTML = warnings.map(function (warning) { return '<div class="notice ' + warning.type + '">' + escapeHtml(warning.text) + '</div>'; }).join('');
  }

  function renderTableView(totals) {
    if (!elements.tableViewSection) return;
    if (!state.showTableView) {
      elements.tableViewSection.style.display = 'none';
      elements.tableViewSection.innerHTML = '';
      return;
    }
    elements.tableViewSection.style.display = 'block';
    var agentRows = totals.agentEconomics.map(function (agent) {
      var stateAgent = findAgent(agent.id) || {};
      var schemeLabel = stateAgent.paymentType === 'fixed' ? 'Фикс ' + stateAgent.fixedRate + '%' : (stateAgent.paymentType === 'boosted' ? 'Повышенная' : 'Стандарт (' + (stateAgent.status === 'trainee' ? 'стажёр' : 'партнёр') + ')');
      var dealsLabel = stateAgent.commissionMode === 'exact' && Array.isArray(stateAgent.dealsInput) ? stateAgent.dealsInput.map(function (deal, index) { return (index + 1) + ': ' + money(deal); }).join('; ') : agent.dealCount + ' сдел. примерно поровну';
      return '<tr><td>' + escapeHtml(agent.name) + '</td><td>' + schemeLabel + '</td><td>' + dealsLabel + '</td><td>' + money(agent.commission) + '</td><td>' + (stateAgent.introduced ? 'Да' : 'Нет') + '</td><td>' + money(agent.referral) + '</td><td>' + money(agent.payout) + '</td><td>' + money(agent.motivationReserve) + '</td><td>' + money(agent.royaltyShare) + '</td><td>' + money(agent.expenseShare) + '</td><td class="' + (agent.contribution >= 0 ? 'positive' : 'danger') + '">' + money(agent.contribution) + '</td><td>' + agent.status + '</td></tr>';
    }).join('');
    elements.tableViewSection.innerHTML = '<div class="section-head split"><div><span class="step-label">Таблица</span><h2>Табличная версия расчёта</h2><p class="hint">Read-only режим. Редактирование выполняется в основном A4-маршруте выше. Таблица обновляется автоматически при изменении данных.</p></div><button class="button ghost" type="button" data-action="toggle-table-view">Закрыть таблицу</button></div>'
      + '<div class="table-wrap"><table class="scheme-table"><thead><tr><th>Агент</th><th>Схема</th><th>Сделки</th><th>Комиссия</th><th>Приведённый</th><th>Реферал 2,5%</th><th>Выплата</th><th>Мотивации</th><th>Роялти-оценка</th><th>Доля расходов</th><th>Вклад</th><th>Окупаемость</th></tr></thead><tbody>' + agentRows + '<tr><td colspan="3"><strong>ИТОГО по агентам</strong></td><td><strong>' + money(totals.agentTurnover) + '</strong></td><td>—</td><td><strong>' + money(totals.referrals) + '</strong></td><td><strong>' + money(totals.agentPayouts) + '</strong></td><td><strong>' + money(totals.motivationReserves) + '</strong></td><td><strong>' + money(totals.royaltyWithoutOwner) + '</strong></td><td><strong>' + money(totals.expenses) + '</strong></td><td>—</td><td>—</td></tr></tbody></table></div>'
      + '<dl class="totals"><div><dt>Личные сделки собственника</dt><dd>' + money(totals.ownerSales) + '</dd></div><div><dt>Общий оборот</dt><dd>' + money(totals.totalTurnover) + '</dd></div><div><dt>Роялти с собственником</dt><dd>' + money(totals.royaltyWithOwner) + '</dd></div><div class="total-line"><dt>Итог без личных сделок</dt><dd>' + money(totals.resultWithoutOwner) + '</dd></div><div class="total-line"><dt>Итог с личными сделками</dt><dd>' + money(totals.resultWithOwner) + '</dd></div></dl>';
  }

  function renderTotals() {
    var totals = calculateOffice(state);
    var status = resultClass(totals.resultWithOwner);
    setText('expensesInlineTotal', money(totals.expenses));
    setText('agentTurnover', money(totals.agentTurnover));
    setText('ownerSales', money(totals.ownerSales));
    setText('totalTurnover', money(totals.totalTurnover));
    setText('agentPayouts', money(totals.agentPayouts));
    setText('referrals', money(totals.referrals));
    setText('motivationReserves', money(totals.motivationReserves));
    setText('royalty', money(totals.royaltyWithOwner));
    setText('officeExpenses', money(totals.expenses));
    setText('resultWithoutOwnerBeforeReserves', money(totals.resultWithoutOwnerBeforeReserves));
    setText('resultWithoutOwner', money(totals.resultWithoutOwner));
    setText('resultWithOwnerBeforeReserves', money(totals.resultWithOwnerBeforeReserves));
    setText('resultWithOwner', money(totals.resultWithOwner));
    elements.resultStatus.textContent = status === 'positive' ? 'Офис в плюсе на ' + money(totals.resultWithOwner) + '.' : (status === 'negative' ? 'Офис в минусе на ' + money(Math.abs(totals.resultWithOwner)) + '.' : 'Офис около нуля.');
    elements.resultStatus.className = 'result-status ' + status;
    renderProfitability(totals);
    renderManagementSummary(totals);
    renderForecast(totals);
    renderSchemeChecker(totals);
    renderWarnings(totals);
    renderTableView(totals);
  }

  function updateMotivationCardMetrics() {
    state.agents.forEach(function (agent) {
      var reserve = calculateMotivationReserve(agent);
      [['mountainSeaAnnual', reserve.mountainSeaAnnual], ['mountainSeaMonthly', reserve.mountainSeaMonthly], ['travelAnnual', reserve.travelAnnual], ['travelMonthly', reserve.travelMonthly], ['corporateAnnual', reserve.corporateAnnual], ['corporateMonthly', reserve.corporateMonthly], ['congressAnnual', reserve.congressAnnual], ['congressMonthly', reserve.congressMonthly], ['starAnnual', reserve.starAnnual], ['starMonthly', reserve.starMonthly]].forEach(function (item) {
        var node = document.querySelector('[data-motivation-metric="' + item[0] + '"][data-agent-id="' + agent.id + '"]');
        if (node) node.textContent = moneyPrecise(item[1]);
      });
    });
  }

  function updateAgentSummaries() {
    calculateOffice(state).agents.forEach(function (agent) {
      [['payout', agent.payout], ['commission', agent.commission], ['referral', agent.referral], ['motivation', agent.motivationReserve], ['motivationInline', agent.motivationReserve], ['office', agent.officeBeforeRoyaltyAndReserve], ['dealCount', agent.dealCount]].forEach(function (item) {
        var node = document.querySelector('[data-agent-summary="' + item[0] + '"][data-agent-id="' + agent.id + '"]');
        if (node) node.textContent = item[0] === 'dealCount' ? item[1] : money(item[1]);
      });
    });
    updateMotivationCardMetrics();
  }

  function render() {
    renderExpenses();
    renderAgents();
    elements.ownerSalesInput.value = state.ownerSales;
    elements.schemeCommission.value = state.schemeCheck.commission;
    elements.schemeDealCount.value = state.schemeCheck.dealCount;
    elements.schemeIntroduced.value = String(state.schemeCheck.introduced);
    elements.schemeExpenseShareMode.value = state.schemeCheck.expenseShareMode;
    elements.schemeManualExpenseShare.value = state.schemeCheck.manualExpenseShare;
    elements.schemeMotivationReserve.value = state.schemeCheck.motivationReserve;
    elements.schemeManualRate.value = state.schemeCheck.manualRate;
    renderTotals();
  }

  function captureUiState() {
    return {
      openDetails: Array.prototype.map.call(document.querySelectorAll('details[open][data-agent-id]'), function (node) { return node.dataset.agentId; }),
      activeId: document.activeElement && document.activeElement.id
    };
  }

  function restoreUiState(uiState) {
    (uiState.openDetails || []).forEach(function (agentId) {
      var node = document.querySelector('details[data-agent-id="' + agentId + '"]');
      if (node) node.open = true;
    });
    if (uiState.activeId) {
      var active = document.getElementById(uiState.activeId);
      if (active) active.focus();
    }
  }

  function renderPreservingUiState() {
    var uiState = captureUiState();
    render();
    restoreUiState(uiState);
  }

  function syncAgentTotalsFromDeals(agent) {
    if (!agent) return;
    var calculated = calculateAgent(agent);
    agent.commission = calculated.commission;
    agent.dealCount = calculated.dealCount;
  }

  function updateAgentField(target) {
    var agent = findAgent(target.dataset.agentId);
    if (!agent) return;
    var field = target.dataset.agentField;
    var value = target.type === 'checkbox' ? target.checked : target.value;
    if (['commission', 'dealCount', 'fixedRate', 'quarterlyCommission', 'quarterlyDeposits', 'halfYearCommission', 'preTripQuarterDeposits'].indexOf(field) !== -1) value = positiveNumber(value);
    if (['introduced', 'motivationOverride', 'stipendOverride', 'travelOverride', 'eventsOverride', 'specialTermsOverride'].indexOf(field) !== -1) value = value === true || value === 'true';
    agent[field] = value;
    if (field === 'commissionMode') {
      if (value === 'exact') agent.dealsInput = splitCommissionIntoDeals(agent.commission, agent.dealCount);
      if (value === 'quick') syncAgentTotalsFromDeals(agent);
    }
    if (target.dataset.structural === 'true') renderPreservingUiState();
    else { updateAgentSummaries(); renderTotals(); }
  }

  function updateMotivationField(target) {
    var agent = findAgent(target.dataset.agentId);
    if (!agent) return;
    var field = target.dataset.motivationField;
    var value = target.value;
    if (target.type === 'number') value = positiveNumber(value);
    agent.motivation[field] = value;
    updateAgentSummaries();
    renderTotals();
  }

  function updateMotivationFlag(target) {
    var agent = findAgent(target.dataset.agentId);
    if (!agent) return;
    agent.motivation[target.dataset.motivationFlag] = target.checked;
    renderPreservingUiState();
  }

  function updateRate(target) {
    var agent = findAgent(target.dataset.agentId);
    if (!agent) return;
    agent.boostedRates[Number(target.dataset.rateIndex)] = positiveNumber(target.value);
    updateAgentSummaries();
    renderTotals();
  }

  function updateDeal(target) {
    var agent = findAgent(target.dataset.agentId);
    if (!agent) return;
    agent.dealsInput[Number(target.dataset.dealIndex)] = positiveNumber(target.value);
    syncAgentTotalsFromDeals(agent);
    updateAgentSummaries();
    renderTotals();
  }

  function updateExpense(target) {
    var expense = state.expenses.find(function (item) { return item.id === target.dataset.expenseId; });
    if (!expense) return;
    expense[target.dataset.expenseField] = target.dataset.expenseField === 'amount' ? positiveNumber(target.value) : target.value;
    renderTotals();
  }

  function updateSchemeField(target) {
    var field = target.dataset.schemeField;
    var value = target.value;
    if (field === 'introduced') value = value === 'true';
    if (['commission', 'dealCount', 'manualExpenseShare', 'motivationReserve', 'manualRate'].indexOf(field) !== -1) value = positiveNumber(value);
    state.schemeCheck[field] = value;
    renderTotals();
  }

  function onInput(event) {
    var target = event.target;
    if (target.dataset.expenseField) updateExpense(target);
    if (target.dataset.agentField) updateAgentField(target);
    if (target.dataset.motivationField) updateMotivationField(target);
    if (target.dataset.rateIndex !== undefined) updateRate(target);
    if (target.dataset.dealIndex !== undefined) updateDeal(target);
    if (target.dataset.schemeField) updateSchemeField(target);
    if (target.id === 'ownerSalesInput') { state.ownerSales = positiveNumber(target.value); renderTotals(); }
  }

  function onClick(event) {
    var target = event.target.closest('button');
    if (!target) return;
    var action = target.dataset.action;
    if (!action) return;
    if (action === 'clear-all') { state = createBlankState(); render(); }
    if (action === 'restore-example') { state = createState(); render(); }
    if (action === 'toggle-table-view') { state.showTableView = !state.showTableView; renderTotals(); }
    if (action === 'add-expense') { state.expenses.push(createBlankExpense()); renderPreservingUiState(); }
    if (action === 'remove-expense') { state.expenses = state.expenses.filter(function (expense) { return expense.id !== target.dataset.expenseId; }); renderPreservingUiState(); }
    if (action === 'remove-agent') { state.agents = state.agents.filter(function (agent) { return agent.id !== target.dataset.agentId; }); renderPreservingUiState(); }
    if (action === 'add-deal') { var agentAdd = findAgent(target.dataset.agentId); if (agentAdd) { agentAdd.dealsInput.push(0); syncAgentTotalsFromDeals(agentAdd); renderPreservingUiState(); } }
    if (action === 'remove-deal') { var agentRemove = findAgent(target.dataset.agentId); if (agentRemove && agentRemove.dealsInput.length > 1) { agentRemove.dealsInput.splice(Number(target.dataset.dealIndex), 1); syncAgentTotalsFromDeals(agentRemove); renderPreservingUiState(); } }
  }

  function collectElements() {
    ['expensesList', 'agentsList', 'addAgentBtn', 'addAgentBottomBtn', 'ownerSalesInput', 'resultStatus', 'agentTurnover', 'ownerSales', 'totalTurnover', 'agentPayouts', 'referrals', 'motivationReserves', 'royalty', 'officeExpenses', 'resultWithoutOwnerBeforeReserves', 'resultWithoutOwner', 'resultWithOwnerBeforeReserves', 'resultWithOwner', 'warningsList', 'expensesInlineTotal', 'profitabilityList', 'managementSummary', 'forecastSection', 'tableViewSection', 'schemeCommission', 'schemeDealCount', 'schemeIntroduced', 'schemeExpenseShareMode', 'schemeManualExpenseShare', 'schemeMotivationReserve', 'schemeManualRate', 'schemeExpenseShare', 'schemeResults', 'schemeAdvice'].forEach(function (id) {
      elements[id] = document.getElementById(id);
    });
  }

  function addAgentAndRender() {
    var agent = createAgent();
    state.agents.push(agent);
    renderPreservingUiState();
  }

  document.addEventListener('DOMContentLoaded', function () {
    collectElements();
    state = createState();
    document.body.addEventListener('input', onInput);
    document.body.addEventListener('change', onInput);
    document.body.addEventListener('click', onClick);
    elements.addAgentBtn.addEventListener('click', addAgentAndRender);
    elements.addAgentBottomBtn.addEventListener('click', addAgentAndRender);
    render();
    window.domianA4State = state;
    window.domianA4CalculateOffice = calculateOffice;
  });
}());
