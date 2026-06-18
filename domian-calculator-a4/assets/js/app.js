(function () {
  'use strict';

  var state = null;
  var uiState = null;
  var idCounter = 1;
  var expenseCounter = 100;
  var elements = {};
  var STATE_VERSION = 1;
  var TABLE_SNAPSHOT_VERSION = 1;
  var TABLE_SNAPSHOT_KEY = 'domianA4TableSnapshot';
  var DEFAULT_AGENT_NAME = 'Новый агент';
  var DEAL_PLACEHOLDER = '100 000';
  var hasUnsavedChanges = false;
  var deferredMotivationRenderTimer = null;

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

  function createAgent() {
    return {
      id: nextId(),
      name: '',
      commission: 0,
      dealCount: 1,
      commissionMode: 'exact',
      dealsInput: [''],
      paymentType: 'standard',
      status: 'partner',
      boostedRates: clone(PAY_SCALES.boostedDefault),
      startingRate: PAY_SCALES.boostedStartingDefault || PAY_SCALES.boostedDefault[0],
      fixedRate: PAY_SCALES.fixedDefault,
      introduced: false,
      partnerConfirmed: false,
      quarterlyCommission: 0,
      quarterlyDeposits: 0,
      halfYearCommission: 0,
      preTripQuarterDeposits: 0,
      motivationOverride: false,
      stipendOverride: false,
      mountainSeaOverride: false,
      travelOverride: false,
      eventsOverride: false,
      specialTermsOverride: false,
      motivation: createMotivation()
    };
  }

  function inferInitialMotivationMode(agent, motivation) {
    if (motivation.mode) {
      return motivation.mode;
    }
    if (positiveNumber(motivation.manualReserveMonthly) > 0) {
      return 'manual';
    }
    if (motivation.specialManualReserveEnabled) {
      return 'manual';
    }
    if (
      motivation.stipendMode !== DEFAULT_MOTIVATION.stipendMode
      || positiveNumber(motivation.manualStipendMonthly) > 0
      || positiveNumber(motivation.quarterlyResult) > 0
      || positiveNumber(agent.quarterlyCommission) > 0
      || positiveNumber(agent.quarterlyDeposits) > 0
      || positiveNumber(agent.halfYearCommission) > 0
      || positiveNumber(agent.preTripQuarterDeposits) > 0
      || motivation.mountainSeaEnabled
      || motivation.travelEnabled
      || motivation.corporateEnabled
      || positiveNumber(motivation.manualAnnualReserveMonthly) > 0
    ) {
      return 'rules';
    }
    return 'off';
  }

  function normalizeAgent(agent) {
    var normalized = Object.assign({}, agent || {});
    normalized.motivation = Object.assign(createMotivation(), normalized.motivation || {});
    if (normalized.startingRate === undefined || normalized.startingRate === null || normalized.startingRate === '') {
      normalized.startingRate = Array.isArray(normalized.boostedRates) && normalized.boostedRates.length
        ? positiveNumber(normalized.boostedRates[0])
        : positiveNumber(PAY_SCALES.boostedStartingDefault || PAY_SCALES.boostedDefault[0]);
    }
    if (normalized.partnerConfirmed === undefined) {
      normalized.partnerConfirmed = positiveNumber(normalized.quarterlyDeposits) >= PARTNERSHIP_DEPOSIT_THRESHOLD;
    }
    normalized.motivation.mode = inferInitialMotivationMode(normalized, normalized.motivation);
    return normalized;
  }

  function splitCommissionIntoDeals(commission, dealCount) {
    var count = Math.max(1, Math.floor(positiveNumber(dealCount)));
    var amount = count ? positiveNumber(commission) / count : 0;
    var deals = [];

    for (var i = 0; i < count; i += 1) {
      deals.push(amount);
    }

    return deals;
  }

  function hasMeaningfulDeals(deals) {
    return Array.isArray(deals) && deals.some(function (deal) {
      return positiveNumber(deal) > 0;
    });
  }

  function normalizeExactDealsInput(deals) {
    return Array.isArray(deals) && deals.length ? deals : [''];
  }

  function getDealDisplayValue(deal) {
    return deal === '' || deal === null || deal === undefined ? '' : formatMoneyInputValue(deal);
  }

  function createBlankExpense() {
    return {
      id: nextExpenseId(),
      name: '',
      amount: 0
    };
  }

  function createState() {
    return {
      version: STATE_VERSION,
      expenses: [createBlankExpense()],
      agents: [normalizeAgent(createAgent())],
      ownerSales: 0,
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

  function createExampleState() {
    var agents = clone(DEFAULT_AGENTS).map(function (agent) {
      return normalizeAgent(agent);
    });

    return {
      version: STATE_VERSION,
      expenses: clone(DEFAULT_EXPENSES),
      agents: agents,
      ownerSales: 150000,
      schemeCheck: {
        commission: 400000,
        dealCount: 4,
        introduced: false,
        expenseShareMode: 'manual',
        manualExpenseShare: 20000,
        motivationReserve: 0,
        manualRate: 75
      }
    };
  }

  function createBlankState() {
    return {
      version: STATE_VERSION,
      expenses: [createBlankExpense()],
      agents: [normalizeAgent(createAgent())],
      ownerSales: 0,
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

  function createUiState() {
    return {
      collapsedAgents: {}
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

  function normalizeInputNumber(value) {
    var normalized = String(value === null || value === undefined ? '' : value)
      .replace(/[\s\u00a0\u202f]+/g, '')
      .trim();

    if (!normalized) {
      return '';
    }

    if (/[,.].*[,.]/.test(normalized) || /^\d{1,3}([,.]\d{3})+$/.test(normalized)) {
      return normalized.replace(/[,.]/g, '');
    }

    return normalized.replace(',', '.');
  }

  function inputNumber(value) {
    return positiveNumber(normalizeInputNumber(value));
  }

  function formatMoneyInputValue(value) {
    var amount = inputNumber(value);
    return amount > 0 ? Math.round(amount).toLocaleString('ru-RU').replace(/\u00a0/g, ' ') : '';
  }

  function formatMoneyInputRaw(value) {
    var normalized = normalizeInputNumber(value);
    var amount = positiveNumber(normalized);
    if (!normalized) {
      return '';
    }
    return amount > 0 ? formatMoneyInputValue(amount) : '0';
  }

  function moneyInput(attributes, value, placeholder) {
    return '<input type="text" inputmode="numeric" autocomplete="off" data-money-input="true" '
      + (placeholder ? 'placeholder="' + escapeHtml(placeholder) + '" ' : '')
      + attributes + ' value="' + formatMoneyInputValue(value) + '">';
  }

  function getMoneyCaretPosition(value, digitsBeforeCaret) {
    var digitsSeen = 0;
    for (var index = 0; index < value.length; index += 1) {
      if (/\d/.test(value.charAt(index))) {
        digitsSeen += 1;
      }
      if (digitsSeen >= digitsBeforeCaret) {
        return index + 1;
      }
    }
    return value.length;
  }

  function formatMoneyInputElement(input) {
    if (!input || !input.dataset || input.dataset.moneyInput !== 'true') {
      return;
    }
    if (input.dataset.composing === 'true') {
      return;
    }

    var previousValue = input.value;
    var selectionStart = typeof input.selectionStart === 'number' ? input.selectionStart : previousValue.length;
    var digitsBeforeCaret = previousValue.slice(0, selectionStart).replace(/\D/g, '').length;
    var nextValue = formatMoneyInputRaw(previousValue);

    if (nextValue === previousValue) {
      return;
    }

    input.value = nextValue;
    if (typeof input.setSelectionRange === 'function') {
      var nextCaret = getMoneyCaretPosition(nextValue, digitsBeforeCaret);
      input.setSelectionRange(nextCaret, nextCaret);
    }
  }

  function markStateDirty() {
    hasUnsavedChanges = true;
  }

  function checked(value) {
    return value ? ' checked' : '';
  }

  function disabled(value) {
    return value ? ' disabled' : '';
  }

  function ensureUiState() {
    if (!uiState) {
      uiState = createUiState();
    }
    if (!uiState.collapsedAgents) {
      uiState.collapsedAgents = {};
    }
    return uiState;
  }

  function findAgent(agentId) {
    return state.agents.find(function (agent) {
      return agent.id === agentId;
    });
  }

  function getAgentIndex(agentId) {
    return state.agents.findIndex(function (agent) {
      return agent.id === agentId;
    });
  }

  function isAgentCollapsed(agentId) {
    return Boolean(ensureUiState().collapsedAgents[agentId]);
  }

  function setAgentCollapsed(agentId, collapsed) {
    if (!agentId) {
      return;
    }
    if (collapsed) {
      ensureUiState().collapsedAgents[agentId] = true;
    } else if (uiState && uiState.collapsedAgents) {
      delete uiState.collapsedAgents[agentId];
    }
  }

  function motivationAnnuals(motivation) {
    var data = Object.assign(createMotivation(), motivation || {});
    return {
      mountainSea: positiveNumber(data.mountainSeaPerTrip) * positiveNumber(data.mountainSeaTripsPerYear),
      travel: positiveNumber(data.travelPerTrip) * positiveNumber(data.travelTripsPerYear),
      corporate: positiveNumber(data.corporatePerYear),
      congress: positiveNumber(data.congressPerYear),
      star: positiveNumber(data.starPerYear)
    };
  }

  function renderMotivationMetric(agentId, key, label, value) {
    return '<div><dt>' + label + '</dt><dd data-agent-id="' + agentId + '" data-motivation-metric="' + key + '">' + moneyPrecise(value) + '</dd></div>';
  }

  function renderMotivationInfo(lines) {
    if (!Array.isArray(lines) || !lines.length) {
      return '';
    }

    return '<div class="motivation-card-note">' + lines.map(function (line) {
      return '<p>' + line + '</p>';
    }).join('') + '</div>';
  }

  function getEligibilityText(reason) {
    if (reason === 'level') {
      return 'Мотивация не положена: агент не достиг нужного уровня по результатам.';
    }
    if (reason === 'partnership') {
      return 'Мотивация не положена: партнёрство не подтверждено, задатков за квартал меньше 250 000 ₽.';
    }
    if (reason === 'specialTerms') {
      return 'У агента особые условия выплаты. По умолчанию мотивации за счёт офиса не предусмотрены.';
    }
    if (reason === 'halfYearLevel') {
      return 'Поездка не заработана: результат за полугодие меньше 1 600 000 ₽. Можно заложить вручную по решению собственника.';
    }
    if (reason === 'preTripDeposits') {
      return 'Поездка не заработана: в квартале перед поездкой задатков меньше 250 000 ₽. Можно заложить вручную по решению собственника.';
    }
    return 'Мотивация доступна по текущим данным.';
  }

  function renderOverrideCheckbox(agent, field, label) {
    return '<label class="override-row">'
      + '<input type="checkbox" data-agent-id="' + agent.id + '" data-agent-field="' + field + '" data-structural="true"' + checked(agent[field]) + '>'
      + '<span>' + label + '</span>'
      + '</label>';
  }

  function renderEligibilityNote(available, reason, overridden) {
    if (available) {
      return '<p class="eligibility-note ok">Доступно по текущим условиям.</p>';
    }
    if (overridden) {
      return '<p class="eligibility-note warning">Важно: условия для мотивации не выполнены. Вы вручную добавляете расход как решение собственника.</p>';
    }
    return '<p class="eligibility-note blocked">' + getEligibilityText(reason) + '</p>';
  }

  function renderTravelEligibilityNote(available, reason, overridden) {
    if (available) {
      return '<p class="eligibility-note ok">Агент заработал поездку.</p>';
    }
    if (overridden) {
      return '<p class="eligibility-note warning">Поездка не заработана: результат за полугодие меньше 1 600 000 ₽. Можно заложить вручную по решению собственника.</p>';
    }
    return '<p class="eligibility-note blocked">' + getEligibilityText(reason) + '</p>';
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
      + '<label class="motivation-card-toggle"><input type="checkbox" data-agent-id="' + agent.id + '" data-motivation-flag="' + config.enabledField + '"' + checked(motivation[config.enabledField]) + disabled(locked) + '>'
      + '<span><strong>' + config.title + '</strong><small>' + config.description + '</small></span></label>'
      + (config.key === 'travel' ? renderTravelEligibilityNote(available, reason, overridden) : renderEligibilityNote(available, reason, overridden))
      + (!available ? renderOverrideCheckbox(agent, config.overrideField, config.overrideLabel) : '')
      + renderMotivationInfo(config.infoLines)
      + '<div class="motivation-card-fields">'
      + '<label class="field"><span>Сумма за поездку, ₽</span>' + moneyInput('data-agent-id="' + agent.id + '" data-motivation-field="' + config.amountField + '"' + disabled(locked), motivation[config.amountField]) + '</label>'
      + '<label class="field"><span>Количество поездок в год</span><input type="number" min="0" step="1" data-agent-id="' + agent.id + '" data-motivation-field="' + config.countField + '" value="' + motivation[config.countField] + '"' + disabled(locked) + '></label>'
      + '</div>'
      + '<dl class="motivation-card-total">'
      + renderMotivationMetric(agent.id, config.key + 'Annual', 'Итого в год', annual)
      + renderMotivationMetric(agent.id, config.key + 'Monthly', 'Управленчески в месяц (÷12)', annual / 12)
      + '</dl>'
      + '</article>';
  }

  function renderAnnualMotivationCard(agent, config) {
    var motivation = Object.assign(createMotivation(), agent.motivation || {});
    var reserve = calculateMotivationReserve(agent);
    var annual = reserve[config.key + 'Annual'];
    var available = config.alwaysAvailable ? true : reserve[config.key + 'Available'];
    var reason = config.alwaysAvailable ? 'available' : reserve[config.key + 'Reason'];
    var overridden = !available && (agent[config.overrideField] || agent.motivationOverride);
    var selectedStarAgentId = getSelectedStarAgentId();
    var starTakenByAnotherAgent = config.key === 'star'
      && Boolean(selectedStarAgentId)
      && selectedStarAgentId !== agent.id
      && !motivation.starEnabled;
    var locked = (!available && !overridden) || starTakenByAnotherAgent;

    return '<article class="motivation-card' + (locked ? ' is-blocked' : '') + '">'
      + '<label class="motivation-card-toggle"><input type="checkbox" data-agent-id="' + agent.id + '" data-motivation-flag="' + config.enabledField + '"' + checked(motivation[config.enabledField]) + disabled(locked) + '>'
      + '<span><strong>' + config.title + '</strong><small>' + config.description + '</small></span></label>'
      + (config.key === 'congress'
        ? '<p class="eligibility-note ok">Конгресс включён по умолчанию. Снимите галочку, если его нужно исключить из резерва этого агента.</p>'
        : (config.key === 'star'
          ? (starTakenByAnotherAgent
            ? '<p class="eligibility-note blocked">Звезда уже назначена другому агенту. Сначала снимите её там, чтобы выбрать здесь.</p>'
            : '<p class="eligibility-note ok">Звезду можно назначить только одному агенту. Если это не лучший агент, оставьте её выключенной.</p>')
          : (config.alwaysAvailable ? '<p class="eligibility-note ok">Звезда и конгресс учитываются как отдельные годовые расходы и не зависят от стандартных мотиваций.</p>' : renderEligibilityNote(available, reason, overridden))))
      + (!available && !starTakenByAnotherAgent ? renderOverrideCheckbox(agent, config.overrideField, config.overrideLabel) : '')
      + renderMotivationInfo(config.infoLines)
      + '<div class="motivation-card-fields single">'
      + '<label class="field"><span>Сумма в год, ₽</span>' + moneyInput('data-agent-id="' + agent.id + '" data-motivation-field="' + config.amountField + '"' + disabled(locked), motivation[config.amountField]) + '</label>'
      + '</div>'
      + '<dl class="motivation-card-total">'
      + renderMotivationMetric(agent.id, config.key + 'Annual', 'Итого в год', annual)
      + renderMotivationMetric(agent.id, config.key + 'Monthly', 'Управленчески в месяц (÷12)', annual / 12)
      + '</dl>'
      + '</article>';
  }

  function renderExactDeals(agent, result) {
    var deals = normalizeExactDealsInput(agent.dealsInput);
    var dealMetrics = result.deals || [];
    var meaningfulDealIndex = 0;
    return '<div class="exact-deals-panel wide-field">'
      + '<p class="hint">Для точной зарплаты лучше ввести сделки отдельно. Особенно если одна сделка сильно больше других.</p>'
      + '<div class="exact-deals-list">'
      + deals.map(function (deal, index) {
        var amount = inputNumber(deal);
        var metric = amount > 0 ? dealMetrics[meaningfulDealIndex] : null;
        if (amount > 0) {
          meaningfulDealIndex += 1;
        }
        return '<div class="exact-deal-row">'
          + '<label class="field">'
          + '<span>Сделка ' + (index + 1) + ' — комиссия, ₽</span>'
          + moneyInput('data-agent-id="' + agent.id + '" data-deal-index="' + index + '"', getDealDisplayValue(deal), DEAL_PLACEHOLDER)
          + '</label>'
          + '<div class="deal-calculation" aria-live="polite" data-agent-id="' + agent.id + '" data-agent-deal-index="' + index + '">'
          + '<span><strong data-agent-deal-rate>' + (metric ? Math.round(metric.rate * 100) + '%' : '—') + '</strong><small>Применённый процент</small></span>'
          + '<span><strong data-agent-deal-payout>' + (metric ? money(metric.payout) : '—') + '</strong><small>Агенту</small></span>'
          + '</div>'
          + '<button class="button ghost" type="button" data-action="remove-deal" data-agent-id="' + agent.id + '" data-deal-index="' + index + '"' + (deals.length === 1 ? ' disabled' : '') + '>Удалить</button>'
          + '</div>';
      }).join('')
      + '</div>'
      + '<button class="button ghost" type="button" data-action="add-deal" data-agent-id="' + agent.id + '">Добавить сделку</button>'
      + '<dl class="exact-deals-total">'
      + '<div><dt>Итого комиссия по сделкам</dt><dd data-agent-summary="commission" data-agent-id="' + agent.id + '">' + money(result.commission) + '</dd></div>'
      + '<div><dt>Итого зарплата агенту</dt><dd data-agent-summary="payout" data-agent-id="' + agent.id + '">' + money(result.payout) + '</dd></div>'
      + '<div><dt>Количество сделок</dt><dd data-agent-summary="dealCount" data-agent-id="' + agent.id + '">' + result.dealCount + '</dd></div>'
      + '</dl>'
      + '</div>';
  }

  function renderQuickDealEstimate(agent, result) {
    return '<div class="exact-deals-panel wide-field quick-deals-panel">'
      + '<p class="deal-mode-hint">Быстрый расчёт — примерная оценка. Калькулятор делит общую комиссию поровну на сделки. Если сделки были разными по сумме, используйте точный расчёт.</p>'
      + '<div class="form-grid compact-grid deal-estimate-grid">'
      + '<label class="field"><span>Сколько агент принёс комиссии</span>' + moneyInput('data-agent-id="' + agent.id + '" data-agent-field="commission"', result.commission, DEAL_PLACEHOLDER) + '<small>Это вся комиссия за месяц.</small></label>'
      + '<label class="field"><span>Количество сделок</span><input type="number" min="1" step="1" data-agent-id="' + agent.id + '" data-agent-field="dealCount" value="' + result.dealCount + '"><small>Если сделки были разными по сумме, используйте точный расчёт по сделкам.</small></label>'
      + '</div>'
      + '</div>';
  }

  function renderDealInputs(agent, result) {
    if (agent.commissionMode === 'exact') {
      return renderExactDeals(agent, result);
    }
    return renderQuickDealEstimate(agent, result);
  }

  function renderExpenses() {
    elements.expensesList.innerHTML = '<div class="notice info expense-guidance wide-field">'
      + '<p>Что можно добавить: аренда офиса, связь, CRM, реклама, интернет, бухгалтерия, уборка, коммунальные платежи, зарплата администратора, прочие постоянные расходы.</p>'
      + '<p>Не добавляйте сюда роялти, выплаты агентам, рефералы и мотивации — калькулятор считает их отдельно.</p>'
      + '</div>'
      + state.expenses.map(function (expense, index) {
      var namePlaceholder = index === 0 ? 'Например: аренда офиса' : 'Добавьте категорию расхода';
      return '<label class="field expense-row">'
        + '<span>Категория</span>'
        + '<input type="text" data-expense-id="' + expense.id + '" data-expense-field="name" value="' + escapeHtml(expense.name) + '" placeholder="' + escapeHtml(namePlaceholder) + '">'
        + moneyInput('data-expense-id="' + expense.id + '" data-expense-field="amount" aria-label="Сумма расхода ' + escapeHtml(expense.name) + '"', expense.amount, 'Введите сумму расхода')
        + '<button class="button ghost" type="button" data-action="remove-expense" data-expense-id="' + expense.id + '">Удалить</button>'
        + '</label>';
    }).join('');
  }

  function hasSpecialPaymentTermsUi(agent) {
    return agent.paymentType === 'fixed' || agent.paymentType === 'boosted';
  }

  function getPartnerSystem(agent) {
    return hasSpecialPaymentTermsUi(agent) ? 'special' : 'standard';
  }

  function getVisibleMotivationMode(agent) {
    var motivation = Object.assign(createMotivation(), agent.motivation || {});
    var mode = motivation.mode || 'off';

    if (agent.status === 'trainee') {
      return mode === 'manual' ? 'manual' : 'off';
    }

    if (hasSpecialPaymentTermsUi(agent)) {
      return mode === 'manual' && motivation.specialManualReserveEnabled ? 'manual' : 'off';
    }

    return mode;
  }

  function getSelectedStarAgentId() {
    var selected = null;
    (state && state.agents || []).some(function (agent) {
      if (agent && agent.motivation && agent.motivation.starEnabled) {
        selected = agent.id;
        return true;
      }
      return false;
    });
    return selected;
  }

  function getAgentDisplayName(agent) {
    var name = String(agent && agent.name || '').trim();
    return name || DEFAULT_AGENT_NAME;
  }

  function hasMeaningfulAgentData(agent, result) {
    var motivation = Object.assign(createMotivation(), agent && agent.motivation || {});

    return getAgentDisplayName(agent) !== DEFAULT_AGENT_NAME
      || positiveNumber(result && result.commission) > 0
      || roundMoney(result && result.contribution) !== 0
      || positiveNumber(result && result.payout) > 0
      || positiveNumber(result && result.referral) > 0
      || positiveNumber(result && result.motivationReserve) > 0
      || positiveNumber(agent && agent.commission) > 0
      || positiveNumber(agent && agent.dealCount) > 1
      || hasMeaningfulDeals(agent && agent.dealsInput)
      || (agent && agent.status === 'trainee')
      || (agent && getPartnerSystem(agent) === 'special')
      || Boolean(agent && agent.introduced)
      || Boolean(agent && agent.partnerConfirmed)
      || positiveNumber(agent && agent.quarterlyCommission) > 0
      || positiveNumber(agent && agent.quarterlyDeposits) > 0
      || positiveNumber(agent && agent.halfYearCommission) > 0
      || positiveNumber(agent && agent.preTripQuarterDeposits) > 0
      || Boolean(agent && agent.motivationOverride)
      || Boolean(agent && agent.stipendOverride)
      || Boolean(agent && agent.mountainSeaOverride)
      || Boolean(agent && agent.travelOverride)
      || Boolean(agent && agent.eventsOverride)
      || Boolean(agent && agent.specialTermsOverride)
      || positiveNumber(motivation.manualReserveMonthly) > 0
      || positiveNumber(motivation.manualStipendMonthly) > 0
      || positiveNumber(motivation.manualAnnualReserveMonthly) > 0
      || Boolean(motivation.specialManualReserveEnabled)
      || Boolean(motivation.stipendManualEnabled)
      || Boolean(motivation.mountainSeaEnabled)
      || Boolean(motivation.travelEnabled)
      || Boolean(motivation.corporateEnabled);
  }

  function isAgentDraft(agent, result) {
    return !hasMeaningfulAgentData(agent, result);
  }

  function getAgentRoleLabel(agent) {
    return agent.status === 'trainee' ? 'Стажёр' : 'Партнёр';
  }

  function getAgentSystemLabel(agent) {
    if (agent.status !== 'partner') {
      return '';
    }
    return getPartnerSystem(agent) === 'special' ? 'Особые условия' : 'Стандарт';
  }

  function getCardStatusInfo(agent, result) {
    if (isAgentDraft(agent, result)) {
      return {
        label: 'черновик',
        className: 'draft'
      };
    }
    if (result.status === 'Окупается') {
      return {
        label: 'окупается',
        className: 'positive'
      };
    }
    if (result.status === 'На грани') {
      return {
        label: 'на грани',
        className: 'warning'
      };
    }
    return {
      label: 'не окупается',
      className: 'danger'
    };
  }

  function formatSignedMoney(value) {
    var amount = roundMoney(value);
    return (amount > 0 ? '+' : '') + money(amount);
  }

  function renderAgentHeaderMeta(agent, index, result) {
    var statusInfo = getCardStatusInfo(agent, result);
    var parts = ['Агент ' + (index + 1), getAgentDisplayName(agent), getAgentRoleLabel(agent)];
    var systemLabel = getAgentSystemLabel(agent);

    if (systemLabel) {
      parts.push(systemLabel);
    }
    if (!isAgentDraft(agent, result) && positiveNumber(result.commission) > 0) {
      parts.push(money(result.commission));
    }
    if (!isAgentDraft(agent, result) && roundMoney(result.contribution) !== 0) {
      parts.push(formatSignedMoney(result.contribution));
    }
    parts.push(statusInfo.label);

    return parts.join(' · ');
  }

  function renderCollapsedSummary(agent, result) {
    var topLine = [getAgentDisplayName(agent), getAgentRoleLabel(agent)];
    var statusInfo = getCardStatusInfo(agent, result);
    var systemLabel = getAgentSystemLabel(agent);

    if (systemLabel) {
      topLine.push(systemLabel);
    }

    if (isAgentDraft(agent, result)) {
      return '<p class="agent-collapsed-line agent-collapsed-line--title">' + escapeHtml(topLine.join(' · ')) + '</p>'
        + '<p class="agent-collapsed-line agent-collapsed-line--status">Статус: ' + escapeHtml(statusInfo.label) + '</p>'
        + '<p class="agent-collapsed-hint">Заполните сделки или комиссию, чтобы увидеть расчёт.</p>';
    }

    return '<p class="agent-collapsed-line agent-collapsed-line--title">' + escapeHtml(topLine.join(' · ')) + '</p>'
      + '<p class="agent-collapsed-line">Комиссия: ' + escapeHtml(money(result.commission)) + ' · Выплата: ' + escapeHtml(money(result.payout)) + ' · Вклад: ' + escapeHtml(formatSignedMoney(result.contribution)) + '</p>'
      + '<p class="agent-collapsed-line agent-collapsed-line--status">Статус: ' + escapeHtml(statusInfo.label) + '</p>';
  }

  function syncAgentCardChrome(agentId) {
    var agent = findAgent(agentId);
    var cardNode = document.querySelector('[data-agent-card][data-agent-id="' + agentId + '"]');
    var headerMetaNode = document.querySelector('[data-agent-header-meta][data-agent-id="' + agentId + '"]');
    var collapsedSummaryNode = document.querySelector('[data-agent-collapsed-summary][data-agent-id="' + agentId + '"]');
    var bodyNode = document.querySelector('[data-agent-body][data-agent-id="' + agentId + '"]');
    var toggleButtons = document.querySelectorAll('[data-action="toggle-agent-collapse"][data-agent-id="' + agentId + '"]');
    var result;
    var statusInfo;

    if (!agent) {
      return;
    }

    result = calculateAgent(agent);
    statusInfo = getCardStatusInfo(agent, result);

    if (headerMetaNode) {
      headerMetaNode.textContent = renderAgentHeaderMeta(agent, getAgentIndex(agentId), result);
    }
    if (collapsedSummaryNode) {
      collapsedSummaryNode.innerHTML = renderCollapsedSummary(agent, result);
    }
    if (cardNode) {
      cardNode.className = 'agent-card agent-card--' + statusInfo.className + (isAgentCollapsed(agentId) ? ' is-collapsed' : '');
    }
    if (bodyNode) {
      bodyNode.hidden = isAgentCollapsed(agentId);
    }
    if (collapsedSummaryNode) {
      collapsedSummaryNode.hidden = !isAgentCollapsed(agentId);
    }
    Array.prototype.forEach.call(toggleButtons, function (button) {
      button.textContent = isAgentCollapsed(agentId) ? 'Развернуть' : 'Свернуть';
    });
  }

  function enhanceAgentCards() {
    Array.prototype.forEach.call(elements.agentsList.querySelectorAll('.agent-card'), function (cardNode) {
      var removeButton = cardNode.querySelector('[data-action="remove-agent"]');
      var agentId = removeButton ? removeButton.dataset.agentId : '';
      var headNode;
      var titleNode;
      var headMainNode;
      var headActionsNode;
      var toggleButton;
      var bottomActionsNode;
      var bottomToggleButton;
      var collapsedSummaryNode;
      var bodyNode;

      if (!agentId) {
        return;
      }

      headNode = cardNode.querySelector('.agent-head');
      titleNode = headNode ? headNode.querySelector('h3') : null;
      headMainNode = headNode ? headNode.querySelector('.agent-head-main') : null;
      headActionsNode = headNode ? headNode.querySelector('.agent-head-actions') : null;
      toggleButton = headNode ? headNode.querySelector('[data-action="toggle-agent-collapse"]') : null;
      collapsedSummaryNode = cardNode.querySelector('[data-agent-collapsed-summary]');
      bodyNode = cardNode.querySelector('[data-agent-body]');

      cardNode.dataset.agentCard = 'true';
      cardNode.dataset.agentId = agentId;

      if (headNode && titleNode && !headMainNode) {
        headMainNode = document.createElement('div');
        headMainNode.className = 'agent-head-main';
        headNode.insertBefore(headMainNode, titleNode);
        headMainNode.appendChild(titleNode);
      }

      if (headMainNode && !headMainNode.querySelector('[data-agent-header-meta]')) {
        var metaNode = document.createElement('p');
        metaNode.className = 'agent-head-meta';
        metaNode.dataset.agentHeaderMeta = 'true';
        metaNode.dataset.agentId = agentId;
        headMainNode.appendChild(metaNode);
      }

      if (headNode && !headActionsNode) {
        headActionsNode = document.createElement('div');
        headActionsNode.className = 'agent-head-actions';
        headNode.appendChild(headActionsNode);
      }

      if (headActionsNode && removeButton && removeButton.parentNode !== headActionsNode) {
        headActionsNode.appendChild(removeButton);
      }

      if (headActionsNode && !toggleButton) {
        toggleButton = document.createElement('button');
        toggleButton.className = 'button ghost';
        toggleButton.type = 'button';
        toggleButton.dataset.action = 'toggle-agent-collapse';
        toggleButton.dataset.agentId = agentId;
        headActionsNode.insertBefore(toggleButton, headActionsNode.firstChild);
      }

      if (!collapsedSummaryNode) {
        collapsedSummaryNode = document.createElement('div');
        collapsedSummaryNode.className = 'agent-collapsed';
        collapsedSummaryNode.dataset.agentCollapsedSummary = 'true';
        collapsedSummaryNode.dataset.agentId = agentId;
        cardNode.insertBefore(collapsedSummaryNode, headNode ? headNode.nextSibling : cardNode.firstChild);
      }

      if (!bodyNode) {
        bodyNode = document.createElement('div');
        bodyNode.className = 'agent-body';
        bodyNode.dataset.agentBody = 'true';
        bodyNode.dataset.agentId = agentId;
        while (collapsedSummaryNode.nextSibling) {
          bodyNode.appendChild(collapsedSummaryNode.nextSibling);
        }
        cardNode.appendChild(bodyNode);
      }

      bottomActionsNode = bodyNode ? bodyNode.querySelector('.agent-bottom-actions') : null;
      bottomToggleButton = bodyNode ? bodyNode.querySelector('[data-agent-bottom-collapse]') : null;
      if (bodyNode && !bottomActionsNode) {
        bottomActionsNode = document.createElement('div');
        bottomActionsNode.className = 'agent-bottom-actions';
        bodyNode.appendChild(bottomActionsNode);
      }
      if (bottomActionsNode && !bottomToggleButton) {
        bottomToggleButton = document.createElement('button');
        bottomToggleButton.className = 'button ghost';
        bottomToggleButton.type = 'button';
        bottomToggleButton.dataset.action = 'toggle-agent-collapse';
        bottomToggleButton.dataset.agentId = agentId;
        bottomToggleButton.dataset.agentBottomCollapse = 'true';
        bottomToggleButton.textContent = 'Свернуть';
        bottomActionsNode.appendChild(bottomToggleButton);
      }

      syncAgentCardChrome(agentId);
    });
  }

  function collapsePreviousAgentIfReady() {
    var previousAgent = state.agents[state.agents.length - 1];

    if (previousAgent && previousAgent.commissionMode === 'exact') {
      syncAgentTotalsFromDeals(previousAgent);
    }
    if (previousAgent && !isAgentDraft(previousAgent, calculateAgent(previousAgent))) {
      setAgentCollapsed(previousAgent.id, true);
    }
  }

  function addAgentCard() {
    var agent;

    collapsePreviousAgentIfReady();
    agent = createAgent();
    markStateDirty();
    state.agents.push(agent);
    setAgentCollapsed(agent.id, false);
    renderPreservingUiState('[data-agent-field="name"][data-agent-id="' + agent.id + '"]');
  }

  function renderStandardScaleNote(agent) {
    var isTrainee = agent.status === 'trainee';
    var scale = isTrainee ? '30 / 35 / 40%' : '45 / 50 / 55 / 60%';
    var text = isTrainee
      ? 'Стажёр — новичок, считается по стажёрской шкале.'
      : 'Партнёр — опытный агент, может работать по стандартной системе или на особых условиях.';

    return '<div class="agent-inline-note">'
      + '<strong>Стандартная шкала: ' + scale + '.</strong> '
      + text
      + ' Чем щедрее условия, тем больше комиссии агент должен приносить, чтобы оставаться выгодным офису.'
      + '</div>';
  }

  function renderMotivationModeSelect(agent, label, hint, options) {
    var currentMode = getVisibleMotivationMode(agent);

    return '<label class="field wide-field"><span>' + label + '</span>'
      + '<select data-agent-id="' + agent.id + '" data-motivation-field="mode" data-structural="true">'
      + options.map(function (item) {
        return option(item.value, item.label, currentMode);
      }).join('')
      + '</select><small>' + hint + '</small></label>';
  }

  function renderReserveSummary(text, amount) {
    return '<div class="motivation-brief">'
      + '<p>' + text + '</p>'
      + '<div class="motivation-brief-total">Резерв мотиваций: <b>' + money(amount) + '</b></div>'
      + '</div>';
  }

  function renderStipendStatus(reserve) {
    if (reserve.stipendMode === 'manual') {
      return '<p class="eligibility-note warning">Стипендия изменена вручную. В резерв заложено: ' + money(reserve.stipendMonthly) + ' / месяц. Стипендия выплачивается ежемесячно в следующем квартале по результатам текущего квартала.</p>';
    }

    if (reserve.stipendAvailable) {
      return '<p class="eligibility-note ok">Стипендия доступна по текущим условиям. В резерв добавлено: ' + money(reserve.stipendMonthly) + ' / месяц. Стипендия выплачивается ежемесячно в следующем квартале по результатам текущего квартала.</p>';
    }

    return '<p class="eligibility-note blocked">' + getEligibilityText(reserve.stipendReason) + '</p>';
  }

  function renderStipendObligation(agent, reserve) {
    var stipendMonthly = positiveNumber(reserve && reserve.stipendMonthly);

    if (stipendMonthly <= 0) {
      return '';
    }

    return '<dl class="motivation-card-total stipend-obligation">'
      + renderMotivationMetric(agent.id, 'stipendMonthly', 'Стипендия в месяц', stipendMonthly)
      + renderMotivationMetric(agent.id, 'stipendQuarterObligation', 'Обязательство следующего квартала', stipendMonthly * 3)
      + '</dl>';
  }

  function renderMandatoryAnnualMotivationSection(agent) {
    return '<section class="motivation-section"><h4>Обязательные годовые расходы</h4>'
      + '<p class="hint compact">Конгресс и Звезда считаются отдельно от стандартных мотиваций. Фикс, повышенная шкала, ручной режим и отключение стандартных мотиваций не должны убирать эти расходы.</p>'
      + '<div class="motivation-card-grid">'
      + renderAnnualMotivationCard(agent, { key: 'congress', enabledField: 'congressEnabled', amountField: 'congressPerYear', alwaysAvailable: true, title: 'Конгресс', description: 'Участие агента в годовом мероприятии' })
      + renderAnnualMotivationCard(agent, { key: 'star', enabledField: 'starEnabled', amountField: 'starPerYear', alwaysAvailable: true, title: 'Звезда', description: 'Награда для лучшего агента офиса' })
      + '</div></section>';
  }

  function renderMotivationSummaryText(headerText) {
    return '<span class="motivation-summary-text">'
      + headerText
      + '<span class="motivation-summary-warning">Без проверки мотиваций расчёт может быть неполным.</span>'
      + '<span class="motivation-summary-list">Проверьте: конгресс, звезда, море/горы, путешествие, стипендия.</span>'
      + '</span>';
  }

  function renderMotivationSummaryAction() {
    return '<span class="collapse-text"><span class="summary-closed">Открыть и проверить мотивации</span><span class="summary-open">Скрыть мотивации</span></span>';
  }

  function renderQuarterlyConditionsSection(agent, motivation, reserve) {
    var partnershipConfirmed = Boolean(agent.partnerConfirmed);
    var quarterResultLocked = !partnershipConfirmed;

    return '<section class="motivation-section motivation-section--quarterly"><h4>Квартальные условия</h4><div class="form-grid compact-grid">'
      + '<label class="field wide-field"><span>Партнёрство подтверждено?</span><select data-agent-id="' + agent.id + '" data-agent-field="partnerConfirmed" data-structural="true">'
      + option('true', 'Да', String(partnershipConfirmed))
      + option('false', 'Нет', String(partnershipConfirmed))
      + '</select><small>Да — партнёрские бонусы можно учитывать. Нет — такие бонусы не считаются. 250 000 ₽ остаётся ориентиром правила.</small></label>'
      + '<label class="field' + (quarterResultLocked ? ' is-muted' : '') + '"><span>Результат агента за квартал, ₽</span>' + moneyInput('data-agent-id="' + agent.id + '" data-agent-field="quarterlyCommission" data-structural="true"' + disabled(quarterResultLocked), agent.quarterlyCommission) + '<small>' + (quarterResultLocked
        ? 'Сначала подтвердите партнёрство. Без подтверждения квартальный результат не учитывается для мотиваций.'
        : 'Результат используется для уровня и стипендии по текущей логике.') + '</small></label>'
      + '</div></section>';
  }

  function renderMotivationControls(agent) {
    var motivation = Object.assign(createMotivation(), agent.motivation || {});
    var motivationReserve = calculateAgent(agent).motivationReserve;
    var reserve = calculateMotivationReserve(agent);
    var currentMode = getVisibleMotivationMode(agent);
    var stipendManualEnabled = reserve.stipendMode === 'manual' || motivation.stipendMode === 'manual' || Boolean(motivation.stipendManualEnabled);
    var headerText = agent.status === 'trainee'
      ? 'Для стажёра можно оставить только простой ручной резерв без партнёрских мотиваций.'
      : (hasSpecialPaymentTermsUi(agent)
        ? 'При особых условиях стандартные мотивации обычно не применяются. Проверьте, остаётся ли офис в плюсе после повышенной выплаты агенту.'
        : 'Стандартная система — выплата по шкале и возможные мотивации.');

    if (agent.status === 'trainee') {
      return '<details class="motivation-box" data-agent-id="' + agent.id + '">'
        + '<summary class="motivation-summary">'
        + '<span class="motivation-summary-main">'
        + '<span class="motivation-summary-title"><span class="summary-closed">Резерв мотиваций стажёра</span><span class="summary-open">Скрыть резерв стажёра</span></span>'
        + renderMotivationSummaryText(headerText)
        + '</span>'
        + '<span class="motivation-summary-side">'
        + '<span class="motivation-current">Сейчас учтено: <b data-agent-summary="motivationInline" data-agent-id="' + agent.id + '">' + money(motivationReserve) + '</b> / месяц</span>'
        + renderMotivationSummaryAction()
        + '</span>'
        + '</summary>'
        + '<div class="motivation-content">'
        + '<div class="form-grid compact-grid">'
        + renderMotivationModeSelect(agent, 'Учитывать резерв мотиваций?', 'Для стажёра здесь только выбор: оставить резерв 0 ₽ или заложить сумму вручную.', [
          { value: 'off', label: 'Не учитывать' },
          { value: 'manual', label: 'Заложить вручную' }
        ])
        + (currentMode === 'off'
          ? renderReserveSummary('Стандартные мотивации не учитываются. Обязательные расходы ниже считаются отдельно.', reserve.congressMonthly + reserve.starMonthly)
          : '<label class="field wide-field"><span>Резерв мотиваций в месяц, ₽</span>' + moneyInput('data-agent-id="' + agent.id + '" data-motivation-field="manualReserveMonthly"', motivation.manualReserveMonthly) + '<small>Укажите сумму, которую собственник хочет ежемесячно закладывать на будущие мотивации этого агента.</small></label>')
        + '</div>'
        + renderMandatoryAnnualMotivationSection(agent)
        + '</div>'
        + '</details>';
    }

    if (hasSpecialPaymentTermsUi(agent)) {
      return '<details class="motivation-box" data-agent-id="' + agent.id + '">'
        + '<summary class="motivation-summary">'
        + '<span class="motivation-summary-main">'
        + '<span class="motivation-summary-title"><span class="summary-closed">Резерв при особых условиях</span><span class="summary-open">Скрыть резерв при особых условиях</span></span>'
        + renderMotivationSummaryText(headerText)
        + '</span>'
        + '<span class="motivation-summary-side">'
        + '<span class="motivation-current">Сейчас учтено: <b data-agent-summary="motivationInline" data-agent-id="' + agent.id + '">' + money(motivationReserve) + '</b> / месяц</span>'
        + renderMotivationSummaryAction()
        + '</span>'
        + '</summary>'
        + '<div class="motivation-content">'
        + '<p class="motivation-lead">Особые условия — это повышенная или фиксированная выплата, которую дают, чтобы привлечь или удержать сильного агента. Главный вопрос здесь: остаётся ли офис в плюсе после такой выплаты.</p>'
        + '<label class="check-field"><input type="checkbox" data-agent-id="' + agent.id + '" data-motivation-field="specialManualReserveEnabled" data-structural="true"' + checked(Boolean(motivation.specialManualReserveEnabled)) + '><span>Заложить ручной резерв мотиваций при особых условиях</span></label>'
        + (motivation.specialManualReserveEnabled
          ? '<label class="field"><span>Резерв мотиваций в месяц, ₽</span>' + moneyInput('data-agent-id="' + agent.id + '" data-motivation-field="manualReserveMonthly"', motivation.manualReserveMonthly) + '<small>Заполняйте только если хотите отдельно откладывать резерв сверх особых условий.</small></label>'
          : renderReserveSummary('Ручной резерв не учитывается. Конгресс и Звезда считаются отдельно ниже.', reserve.congressMonthly + reserve.starMonthly))
        + renderMandatoryAnnualMotivationSection(agent)
        + '</div>'
        + '</details>';
    }

    return '<details class="motivation-box" data-agent-id="' + agent.id + '">'
      + '<summary class="motivation-summary">'
      + '<span class="motivation-summary-main">'
      + '<span class="motivation-summary-title"><span class="summary-closed">Обязательно проверьте мотивации перед итогом</span><span class="summary-open">Скрыть мотивации</span></span>'
      + renderMotivationSummaryText(headerText)
      + '</span>'
      + '<span class="motivation-summary-side">'
      + '<span class="motivation-current">Сейчас учтено: <b data-agent-summary="motivationInline" data-agent-id="' + agent.id + '">' + money(motivationReserve) + '</b> / месяц</span>'
      + renderMotivationSummaryAction()
      + '</span>'
      + '</summary>'
      + '<div class="motivation-content">'
      + '<div class="form-grid compact-grid">'
      + renderMotivationModeSelect(agent, 'Учитывать мотивации агента?', 'Не учитывать — резерв 0 ₽. Вручную — вы задаёте сумму сами. По правилам — калькулятор откроет дополнительные поля.', [
        { value: 'off', label: 'Не учитывать' },
        { value: 'manual', label: 'Заложить вручную' },
        { value: 'rules', label: 'Рассчитать по правилам' }
      ])
      + '</div>'
      + (currentMode === 'off'
        ? renderReserveSummary('Стандартные мотивации не учитываются. Конгресс и Звезда считаются отдельно ниже.', reserve.congressMonthly + reserve.starMonthly)
        : '')
      + (currentMode === 'manual'
        ? '<div class="form-grid compact-grid"><label class="field wide-field"><span>Резерв мотиваций в месяц, ₽</span>' + moneyInput('data-agent-id="' + agent.id + '" data-motivation-field="manualReserveMonthly"', motivation.manualReserveMonthly) + '<small>Укажите сумму, которую собственник хочет ежемесячно закладывать на будущие мотивации этого агента. Конгресс и Звезда считаются отдельно ниже.</small></label></div>'
        : '')
      + (currentMode === 'rules'
        ? '<section class="motivation-section motivation-section--quarterly"><h4>Квартальные условия</h4><div class="form-grid compact-grid">'
          + '<label class="field wide-field"><span>Партнёрство подтверждено?</span><select data-agent-id="' + agent.id + '" data-agent-field="partnerConfirmed" data-structural="true">'
          + option('true', 'Да', String(Boolean(agent.partnerConfirmed)))
          + option('false', 'Нет', String(Boolean(agent.partnerConfirmed)))
          + '</select><small>Да — партнёрские бонусы можно учитывать. Нет — такие бонусы не считаются. 250 000 ₽ остаётся ориентиром правила.</small></label>'
          + '<label class="field' + (reserve.partnershipConfirmed ? '' : ' is-muted') + '"><span>Результат агента за квартал, ₽</span>' + moneyInput('data-agent-id="' + agent.id + '" data-agent-field="quarterlyCommission" data-structural="true"' + disabled(!reserve.partnershipConfirmed), agent.quarterlyCommission) + '<small>' + (!reserve.partnershipConfirmed ? 'Сначала подтвердите партнёрство. Без подтверждения квартальный результат не учитывается для мотиваций.' : 'Результат используется для уровня и стипендии по текущей логике.') + '</small></label>'
          + '</div></section>'
        : '')
      + (currentMode === 'rules'
        ? '<section class="motivation-section"><h4>Полугодовые условия</h4><div class="notice warning wide-field motivation-calendar-note">Поездки зависят от периода результата и квартала подтверждения. Точная календарная логика будет в расширенном режиме.</div><div class="form-grid compact-grid">'
          + '<label class="field"><span>Результат за полугодие, ₽</span>' + moneyInput('data-agent-id="' + agent.id + '" data-agent-field="halfYearCommission" data-structural="true"', agent.halfYearCommission) + '<small>Для путешествия нужен минимум 1 600 000 ₽.</small></label>'
          + '<label class="field"><span>Задатки в квартале перед поездкой, ₽</span>' + moneyInput('data-agent-id="' + agent.id + '" data-agent-field="preTripQuarterDeposits" data-structural="true"', agent.preTripQuarterDeposits) + '<small>Введите сумму задатков за квартал, который проверяется перед поездкой. Если период поездки непонятен, оставьте поле пустым и задайте резерв вручную.</small></label>'
          + '</div></section>'
          + '<section class="motivation-section"><h4>Дополнительные резервы</h4><div class="form-grid compact-grid">'
          + '<div class="wide-field">'
          + '<p class="hint compact">Стипендия в режиме “Рассчитать по правилам” считается автоматически, если выполнены условия партнёрства и уровня.</p>'
          + renderStipendStatus(reserve)
          + renderStipendObligation(agent, reserve)
          + '<label class="check-field"><input type="checkbox" data-agent-id="' + agent.id + '" data-motivation-field="stipendManualEnabled" data-structural="true"' + checked(stipendManualEnabled) + '><span>Изменить сумму стипендии вручную</span></label>'
          + (stipendManualEnabled
            ? '<label class="field"><span>Стипендия вручную, ₽ в месяц</span>' + moneyInput('data-agent-id="' + agent.id + '" data-motivation-field="manualStipendMonthly"', motivation.manualStipendMonthly) + '</label>'
            : '')
          + '</div>'
          + '<label class="field"><span>Как учитывать годовые мотивации?</span><select data-agent-id="' + agent.id + '" data-motivation-field="annualReserveMode">'
          + option('monthly', 'Распределить по 12 месяцам', motivation.annualReserveMode)
          + option('full', 'Учесть всю сумму сейчас', motivation.annualReserveMode)
          + option('manual', 'Ввести свою сумму в месяц', motivation.annualReserveMode)
          + '</select><small>Деление на 12 — это грубое управленческое распределение резерва, а не календарный расчёт. Реальные расходы могут приходиться на конкретные месяцы. Для точного календарного расчёта позже будет нужен расширенный режим.</small></label>'
          + (reserve.annualReserveMode === 'manual'
            ? '<label class="field"><span>Своя сумма резерва, ₽ в месяц</span>' + moneyInput('data-agent-id="' + agent.id + '" data-motivation-field="manualAnnualReserveMonthly"', motivation.manualAnnualReserveMonthly) + '<small>Срабатывает только после включения ручной суммы на месяц.</small></label>'
            : '')
          + '</div></section>'
          + '<section class="motivation-section"><h4>Годовые мотивации</h4><div class="motivation-card-grid">'
          + renderTripMotivationCard(agent, { key: 'mountainSea', enabledField: 'mountainSeaEnabled', amountField: 'mountainSeaPerTrip', countField: 'mountainSeaTripsPerYear', overrideField: 'mountainSeaOverride', overrideLabel: 'Всё равно заложить поездки по РФ', title: 'Горы / Море', description: 'Поездки по РФ для агента', infoLines: ['Горы и Море — разные сезонные акции. Сейчас блок показывает укрупнённый резерв по поездкам, а не календарный расчёт.', 'Горы: акция 1 января – 28 февраля, поездка в апреле.', 'Море: акция 1 мая – 30 июня, поездка в сентябре.', 'План офиса считается отдельно для акции: количество партнёров × 350 000 ₽.'] })
          + renderTripMotivationCard(agent, { key: 'travel', enabledField: 'travelEnabled', amountField: 'travelPerTrip', countField: 'travelTripsPerYear', overrideField: 'travelOverride', overrideLabel: 'Всё равно заложить путешествие', title: 'Заграница / Путешествие', description: 'Зарубежные поездки для агента' })
          + renderAnnualMotivationCard(agent, { key: 'corporate', enabledField: 'corporateEnabled', amountField: 'corporatePerYear', overrideField: 'eventsOverride', overrideLabel: 'Всё равно заложить корпоратив', title: 'Корпоративы', description: 'Годовой резерв на мероприятия', infoLines: ['Корпоративы — это разные календарные события, а текущий блок показывает укрупнённый резерв.', 'Летний корпоратив проходит в середине июля по подтверждению партнёрства за предыдущий квартал.', 'Зимний корпоратив проходит примерно 25 декабря по подтверждению партнёрства за 3 квартал.', 'Оборот / сделки для корпоративов не требуются.'] })
          + '</div></section>'
        : '')
      + renderMandatoryAnnualMotivationSection(agent)
      + '</div>'
      + '</details>';
  }

  function renderAgents() {
    elements.agentsList.innerHTML = state.agents.map(function (agent, index) {
      var result = calculateAgent(agent);
      var boostedControls = '';
      var fixedControl = '';
      var partnerSystemControl = '';
      var statusControl = '<label class="field"><span>Статус агента</span><select data-agent-id="' + agent.id + '" data-agent-field="status" data-structural="true">'
        + option('trainee', 'Стажёр', agent.status)
        + option('partner', 'Партнёр', agent.status)
        + '</select><small>Стажёр и партнёр считаются по разным шкалам выплат.</small></label>';

      if (agent.paymentType === 'boosted') {
        boostedControls = '<div class="rate-grid">'
          + '<label class="field"><span>Стартовый процент</span>'
          + '<input type="number" min="0" max="100" step="1" data-agent-id="' + agent.id + '" data-agent-field="startingRate" value="' + agent.startingRate + '">'
          + '<small>Сделка считается по большему значению: стандартная шкала партнёра или этот стартовый процент.</small></label>'
          + '</div><p class="hint compact">Например, 55% даст 55 / 55 / 55 / 60, 70% даст 70% на все сделки. Последующие сделки не падают ниже стартового процента.</p>';
      }

      if (agent.paymentType === 'fixed') {
        fixedControl = '<label class="field"><span>Фиксированный процент</span>'
          + '<input type="number" min="0" max="100" step="1" data-agent-id="' + agent.id + '" data-agent-field="fixedRate" value="' + agent.fixedRate + '">'
          + '<small>Один процент на все сделки. Чем выше процент, тем больше агент должен продавать.</small></label>';
      }

      if (agent.status === 'partner') {
        partnerSystemControl = '<label class="field"><span>Партнёр работает по какой системе?</span><select data-agent-id="' + agent.id + '" data-agent-field="partnerSystem" data-structural="true">'
          + option('standard', 'Стандартная система', getPartnerSystem(agent))
          + option('special', 'Особые условия', getPartnerSystem(agent))
          + '</select><small>' + (getPartnerSystem(agent) === 'standard'
            ? 'Стандартная система — выплата по шкале и возможные мотивации.'
            : 'Особые условия — повышенная выплата, которую нужно проверить на окупаемость.') + '</small></label>';
      }

      return '<article class="agent-card">'
        + '<div class="agent-head">'
        + '<h3>Агент ' + (index + 1) + '</h3>'
        + '<button class="button ghost" type="button" data-action="remove-agent" data-agent-id="' + agent.id + '"' + (state.agents.length === 1 ? ' disabled' : '') + '>Удалить</button>'
        + '</div>'
        + '<div class="form-grid">'
        + '<label class="field agent-main-field"><span>Имя</span><input type="text" data-agent-id="' + agent.id + '" data-agent-field="name" value="' + escapeHtml(agent.name || '') + '" placeholder="Новый агент"></label>'
        + statusControl
        + renderStandardScaleNote(agent)
        + partnerSystemControl
        + '<label class="field agent-main-field"><span>Как считать сделки?</span><select data-agent-id="' + agent.id + '" data-agent-field="commissionMode" data-structural="true">'
        + option('exact', 'Точно: ввести каждую сделку отдельно', agent.commissionMode || 'exact')
        + option('quick', 'Быстро: общая комиссия и количество сделок', agent.commissionMode || 'exact')
        + '</select><small>Точный режим нужен для сделок разного размера. Быстрый подходит для прикидки, но может отличаться от точного расчёта.</small></label>'
        + renderDealInputs(agent, result)
        + (agent.status === 'partner' && getPartnerSystem(agent) === 'special'
          ? '<label class="field agent-main-field"><span>Тип особых условий</span><select data-agent-id="' + agent.id + '" data-agent-field="paymentType" data-structural="true">'
            + option('boosted', 'Повышенная стартовая шкала', agent.paymentType)
            + option('fixed', 'Фиксированный процент', agent.paymentType)
            + '</select><small>Повышенная шкала мягче. Фиксированный процент рискованнее, если комиссия агента нестабильна.</small></label>'
          : '')
        + fixedControl
        + '<label class="field"><span>Приведённый агент</span><select data-agent-id="' + agent.id + '" data-agent-field="introduced">'
        + option('false', 'Нет', String(agent.introduced))
        + option('true', 'Да', String(agent.introduced))
        + '</select><small>Если выбрать “Да”, офис дополнительно платит 2,5% от комиссии этого агента.</small></label>'
        + '</div>'
        + (agent.status === 'partner' && getPartnerSystem(agent) === 'special' ? boostedControls : '')
        + renderMotivationControls(agent)
        + '<dl class="agent-summary">'
        + '<div><dt>Выплата агенту</dt><dd data-agent-summary="payout" data-agent-id="' + agent.id + '">' + money(result.payout) + '</dd></div>'
        + '<div><dt>Реферал</dt><dd data-agent-summary="referral" data-agent-id="' + agent.id + '">' + money(result.referral) + '</dd></div>'
        + '<div><dt>Мотивационный резерв</dt><dd data-agent-summary="motivation" data-agent-id="' + agent.id + '">' + money(result.motivationReserve) + '</dd></div>'
        + '<div><dt>До роялти и расходов</dt><dd data-agent-summary="office" data-agent-id="' + agent.id + '">' + money(result.officeBeforeRoyaltyAndReserve) + '</dd></div>'
        + '</dl>'
        + '</article>';
    }).join('');
    enhanceAgentCards();
  }

  function setText(id, value) {
    if (elements[id]) {
      elements[id].textContent = value;
    }
  }

  function resultClass(value) {
    if (value > 0.5) {
      return 'positive';
    }
    if (value < -0.5) {
      return 'negative';
    }
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

  function getContributionStatus(contribution) {
    if (contribution > 10000) {
      return {
        className: 'positive',
        title: 'Сильный агент',
        recommendation: 'Удерживать оборот и условия, при которых агент продолжает закрывать своё место.'
      };
    }
    if (contribution >= -10000) {
      return {
        className: 'warning',
        title: 'Почти в ноль',
        recommendation: 'Проверить запас прочности: небольшое снижение комиссии или рост расходов может увести вклад в минус.'
      };
    }
    return {
      className: 'danger',
      title: 'Зона риска',
      recommendation: 'Проверьте условия выплат и минимальный план комиссии по агенту.'
    };
  }

  function findSourceAgent(agentId) {
    return state.agents.find(function (agent) {
      return agent.id === agentId;
    }) || {};
  }

  function getRiskReasons(agentEconomics) {
    var source = findSourceAgent(agentEconomics.id);
    var reasons = [];
    var paymentType = agentEconomics.paymentType || source.paymentType || 'standard';
    var fixedRate = positiveNumber(agentEconomics.fixedRate || source.fixedRate || 0);
    var introduced = agentEconomics.introduced !== undefined ? agentEconomics.introduced : Boolean(source.introduced);
    var directLoad = agentEconomics.payout + agentEconomics.referral + agentEconomics.motivationReserve + agentEconomics.royaltyShare + agentEconomics.expenseShare;

    if (paymentType === 'fixed') {
      reasons.push('фиксированный процент' + (fixedRate ? ' ' + fixedRate + '%' : ''));
    }
    if (paymentType === 'boosted') {
      reasons.push('повышенная шкала');
    }
    if (agentEconomics.commission < 100000) {
      reasons.push('низкая комиссия');
    }
    if (introduced) {
      reasons.push('реферал');
    }
    if (agentEconomics.motivationReserve > 0) {
      reasons.push('мотивационный резерв');
    }
    if (agentEconomics.expenseShare > Math.max(10000, agentEconomics.beforeExpenses)) {
      reasons.push('высокая доля расходов');
    }
    if (agentEconomics.commission <= directLoad) {
      reasons.push('комиссия недостаточна для покрытия выплаты, роялти-оценки и доли расходов');
    }

    return reasons.length ? reasons : ['вклад ниже безопасного уровня при текущей комиссии и расходах'];
  }

  function getManagementDiagnosis(totals) {
    if (Math.abs(totals.resultWithOwner) <= 10000) {
      return 'Офис находится около точки безубыточности. Небольшое снижение оборота или рост расходов быстро уведёт его в минус.';
    }
    if (totals.resultWithOwner < 0) {
      return 'Офис убыточен даже с личными сделками собственника. При текущих показателях нужно увеличить оборот, снизить расходы или пересмотреть условия выплат.';
    }
    if (totals.resultWithoutOwner < 0 && totals.resultWithOwner > 0) {
      return 'Офис в плюсе только за счёт личных сделок собственника. Без них результат офиса: ' + money(totals.resultWithoutOwner) + '. Команда пока не покрывает расходы офиса самостоятельно.';
    }
    return 'Офис окупается как система. Даже без личных сделок собственника остаётся положительный результат: +' + money(totals.resultWithoutOwner) + '.';
  }

  function getManagementRecommendations(totals, riskyAgents) {
    var recommendations = [];
    var hasFixedRisk = false;
    var hasBoostedRisk = false;

    if (totals.resultWithoutOwner < 0 && totals.resultWithOwner > 0) {
      recommendations.push('Проверьте планы агентов: сейчас команда без личных сделок собственника не закрывает расходы офиса.');
    }

    riskyAgents.forEach(function (agent) {
      var source = findSourceAgent(agent.id);
      var paymentType = agent.paymentType || source.paymentType || 'standard';
      recommendations.push('Проверьте условия выплат и минимальный план комиссии по агенту ' + agent.name + '.');
      hasFixedRisk = hasFixedRisk || paymentType === 'fixed';
      hasBoostedRisk = hasBoostedRisk || paymentType === 'boosted';
    });

    if (hasFixedRisk) {
      recommendations.push('Фиксированный процент стоит оставлять только при понятном минимальном плане.');
    }
    if (hasBoostedRisk) {
      recommendations.push('Повышенная шкала требует контроля оборота.');
    }
    if (!riskyAgents.length) {
      recommendations.push('Команда окупает своё место. Следующий фокус — удержать оборот и не увеличивать постоянные расходы без необходимости.');
    }

    return recommendations.filter(function (item, index, list) {
      return list.indexOf(item) === index;
    });
  }

  function renderManagementSummary(totals) {
    var riskyAgents = totals.agentEconomics.filter(function (agent) {
      return agent.contribution < -10000;
    });
    var recommendations = getManagementRecommendations(totals, riskyAgents);

    elements.managementSummary.innerHTML = ''
      + '<div class="management-diagnosis">'
      + '<span class="small-label">Диагноз офиса</span>'
      + '<p>' + escapeHtml(getManagementDiagnosis(totals)) + '</p>'
      + '</div>'
      + '<div class="management-agents">'
      + totals.agentEconomics.map(function (agent) {
        var status = getContributionStatus(agent.contribution);
        var reasons = getRiskReasons(agent);
        return '<article class="management-agent ' + status.className + '">'
          + '<div class="management-agent-head"><strong>' + escapeHtml(agent.name) + '</strong><span>' + status.title + '</span></div>'
          + '<dl>'
          + '<div><dt>Вклад</dt><dd>' + money(agent.contribution) + '</dd></div>'
          + '<div><dt>Причина</dt><dd>' + escapeHtml(reasons.join(', ')) + '</dd></div>'
          + '<div><dt>Рекомендация</dt><dd>' + escapeHtml(status.recommendation) + '</dd></div>'
          + '</dl>'
          + '</article>';
      }).join('')
      + '</div>'
      + '<div class="management-recommendations">'
      + '<span class="small-label">Рекомендации собственнику</span>'
      + '<ul>' + recommendations.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
      + '</div>';
  }

  function renderForecast(totals) {
    var periods = [
      { label: 'Месяц ×1', months: 1 },
      { label: 'Квартал ×3', months: 3 },
      { label: 'Полугодие ×6', months: 6 },
      { label: 'Год ×12', months: 12 }
    ];

    elements.forecastRows.innerHTML = periods.map(function (period) {
      var months = period.months;
      return '<tr>'
        + '<th scope="row">' + period.label + '</th>'
        + '<td>' + money(totals.totalTurnover * months) + '</td>'
        + '<td>' + money(totals.agentPayouts * months) + '</td>'
        + '<td>' + money(totals.referrals * months) + '</td>'
        + '<td>' + money(totals.motivationReserves * months) + '</td>'
        + '<td>' + money(totals.royaltyWithOwner * months) + '</td>'
        + '<td>' + money(totals.expenses * months) + '</td>'
        + '<td>' + money(totals.resultWithoutOwner * months) + '</td>'
        + '<td>' + money(totals.resultWithOwner * months) + '</td>'
        + '</tr>';
    }).join('');
  }

  function renderTotals() {
    var totals = calculateOffice(state);
    var status = resultClass(totals.resultWithOwner);
    var message = 'Офис около нуля.';

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

    if (status === 'positive') {
      message = 'Офис в плюсе на ' + money(totals.resultWithOwner) + '.';
    } else if (status === 'negative') {
      message = 'Офис в минусе на ' + money(Math.abs(totals.resultWithOwner)) + '.';
    }
    elements.resultStatus.textContent = message;
    elements.resultStatus.className = 'result-status ' + status;

    renderProfitability(totals);
    renderManagementSummary(totals);
    renderForecast(totals);
    renderSchemeChecker(totals);
    renderWarnings(totals);
  }

  function updateAgentSummaries() {
    calculateOffice(state).agents.forEach(function (agent) {
      var sourceAgent = findAgent(agent.id);
      [
        ['payout', agent.payout],
        ['commission', agent.commission],
        ['referral', agent.referral],
        ['motivation', agent.motivationReserve],
        ['motivationInline', agent.motivationReserve],
        ['office', agent.officeBeforeRoyaltyAndReserve]
      ].forEach(function (item) {
        var node = document.querySelector('[data-agent-summary="' + item[0] + '"][data-agent-id="' + agent.id + '"]');
        if (node) {
          node.textContent = money(item[1]);
        }
      });
      if (agent.commissionMode === 'exact') {
        var commissionInput = document.querySelector('[data-agent-field="commission"][data-agent-id="' + agent.id + '"]');
        var dealCountInput = document.querySelector('[data-agent-field="dealCount"][data-agent-id="' + agent.id + '"]');
        if (commissionInput) {
          commissionInput.value = formatMoneyInputValue(agent.commission);
        }
        if (dealCountInput) {
          dealCountInput.value = agent.dealCount;
        }
        var dealCountNode = document.querySelector('[data-agent-summary="dealCount"][data-agent-id="' + agent.id + '"]');
        if (dealCountNode) {
          dealCountNode.textContent = agent.dealCount;
        }
        if (sourceAgent && sourceAgent.commissionMode === 'exact') {
          var sourceDeals = normalizeExactDealsInput(sourceAgent.dealsInput);
          var meaningfulDealIndex = 0;
          sourceDeals.forEach(function (deal, index) {
            var rowNode = document.querySelector('[data-agent-deal-index="' + index + '"][data-agent-id="' + agent.id + '"]');
            if (!rowNode) {
              if (positiveNumber(deal) > 0) {
                meaningfulDealIndex += 1;
              }
              return;
            }
            var metric = positiveNumber(deal) > 0 ? agent.deals[meaningfulDealIndex] : null;
            if (positiveNumber(deal) > 0) {
              meaningfulDealIndex += 1;
            }
            var rateNode = rowNode.querySelector('[data-agent-deal-rate]');
            var payoutNode = rowNode.querySelector('[data-agent-deal-payout]');
            if (rateNode) {
              rateNode.textContent = metric ? Math.round(metric.rate * 100) + '%' : '—';
            }
            if (payoutNode) {
              payoutNode.textContent = metric ? money(metric.payout) : '—';
            }
          });
        }
      }
      syncAgentCardChrome(agent.id);
    });
    updateMotivationCardMetrics();
  }

  function updateMotivationCardMetrics() {
    state.agents.forEach(function (agent) {
      var reserve = calculateMotivationReserve(agent);
      [
        ['mountainSeaAnnual', reserve.mountainSeaAnnual],
        ['mountainSeaMonthly', reserve.mountainSeaMonthly],
        ['travelAnnual', reserve.travelAnnual],
        ['travelMonthly', reserve.travelMonthly],
        ['corporateAnnual', reserve.corporateAnnual],
        ['corporateMonthly', reserve.corporateMonthly],
        ['congressAnnual', reserve.congressAnnual],
        ['congressMonthly', reserve.congressMonthly],
        ['starAnnual', reserve.starAnnual],
        ['starMonthly', reserve.starMonthly]
      ].forEach(function (item) {
        var node = document.querySelector('[data-motivation-metric="' + item[0] + '"][data-agent-id="' + agent.id + '"]');
        if (node) {
          node.textContent = moneyPrecise(item[1]);
        }
      });
    });
  }

  function renderProfitability(totals) {
    function getRetentionScenarioClass(status) {
      if (status === 'можно') {
        return 'positive';
      }
      if (status === 'осторожно' || status === 'риск') {
        return 'warning';
      }
      if (status === 'убыточно') {
        return 'danger';
      }
      return 'neutral';
    }

    function moneyDelta(value) {
      var amount = roundMoney(value);
      return (amount > 0 ? '+' : '') + money(amount);
    }

    function renderRetentionScenarios(agentEconomics) {
      var source = findSourceAgent(agentEconomics.id);
      var result = compareAgentRetentionScenarios(source, agentEconomics);

      return '<details class="retention-checker" data-agent-id="' + agentEconomics.id + '">'
        + '<summary class="retention-checker-summary">'
        + '<span class="retention-checker-main">'
        + '<strong>Можно ли дать этому агенту лучшие условия?</strong>'
        + '<small>Сравните текущие условия с повышенной шкалой и фиксированными процентами. Калькулятор покажет, сколько офис потеряет или сохранит в каждом варианте.</small>'
        + '</span>'
        + '<span class="retention-checker-action"><span class="summary-closed">Показать сценарии</span><span class="summary-open">Скрыть сценарии</span></span>'
        + '</summary>'
        + '<div class="table-wrap retention-checker-wrap">'
        + '<table class="scheme-table retention-checker-table">'
        + '<thead><tr><th>Сценарий</th><th>Выплата агенту</th><th>Остаётся офису</th><th>Разница к текущим</th><th>Вывод</th></tr></thead>'
        + '<tbody>'
        + result.scenarios.map(function (scenario) {
          return '<tr class="' + getRetentionScenarioClass(scenario.status) + '">'
            + '<td>' + escapeHtml(scenario.label) + '</td>'
            + '<td>' + money(scenario.payout) + '</td>'
            + '<td>' + money(scenario.contribution) + '</td>'
            + '<td>' + moneyDelta(scenario.deltaFromCurrent) + '</td>'
            + '<td>' + escapeHtml(scenario.status) + '</td>'
            + '</tr>';
        }).join('')
        + '</tbody></table></div>'
        + '</details>';
    }
    elements.profitabilityList.innerHTML = totals.agentEconomics.map(function (agent) {
      var statusClass = agent.status === 'Окупается' ? 'positive' : (agent.status === 'На грани' ? 'warning' : 'danger');
      return '<article class="economics-row ' + statusClass + '">'
        + '<div><strong>' + escapeHtml(agent.name) + '</strong><span>' + agent.status + '</span></div>'
        + '<dl>'
        + '<div><dt>Комиссия</dt><dd>' + money(agent.commission) + '</dd></div>'
        + '<div><dt>Выплата</dt><dd>' + money(agent.payout) + '</dd></div>'
        + '<div><dt>Реферал</dt><dd>' + money(agent.referral) + '</dd></div>'
        + '<div><dt>Резерв</dt><dd>' + money(agent.motivationReserve) + '</dd></div>'
        + '<div><dt>Роялти-оценка</dt><dd>' + money(agent.royaltyShare) + '</dd></div>'
        + '<div><dt>Доля расходов</dt><dd>' + money(agent.expenseShare) + '</dd></div>'
        + '<div><dt>Вклад</dt><dd>' + money(agent.contribution) + '</dd></div>'
        + '</dl>'
        + renderRetentionScenarios(agent)
        + '</article>';
    }).join('');
  }

  function renderSchemeChecker(totals) {
    var expenseShare = getSchemeExpenseShare(totals);
    var result = comparePaymentSchemes({
      commission: state.schemeCheck.commission,
      dealCount: state.schemeCheck.dealCount,
      introduced: state.schemeCheck.introduced,
      expenseShare: expenseShare,
      motivationReserve: state.schemeCheck.motivationReserve,
      manualRate: state.schemeCheck.manualRate
    });

    if (elements.schemeExpenseShare) {
      elements.schemeExpenseShare.textContent = money(expenseShare);
    }

    elements.schemeResults.innerHTML = result.variants.map(function (variant) {
      var statusClass = variant.contribution > 5000 ? 'positive' : (variant.contribution >= -5000 ? 'warning' : 'danger');
      return '<tr class="' + statusClass + '">'
        + '<td>' + escapeHtml(variant.label) + '</td>'
        + '<td>' + money(variant.payout) + '</td>'
        + '<td>' + money(variant.referral) + '</td>'
        + '<td>' + money(variant.royalty) + '</td>'
        + '<td>' + money(variant.beforeExpenses) + '</td>'
        + '<td>' + money(variant.contribution) + '</td>'
        + '<td>' + (variant.breakEvenCommission === null ? 'выше 10 млн ₽' : money(variant.breakEvenCommission)) + '</td>'
        + '<td>' + variant.conclusion + '</td>'
        + '</tr>';
    }).join('');

    renderSchemeAdvice(result.variants);
  }

  function renderSchemeAdvice(variants) {
    var safeVariants = variants.filter(function (variant) {
      return variant.contribution > 0;
    }).sort(function (left, right) {
      return right.contribution - left.contribution;
    });
    var riskyVariants = variants.filter(function (variant) {
      return variant.contribution < 0;
    });
    var message = '';

    if (safeVariants.length) {
      message = 'Самый безопасный вариант сейчас: ' + safeVariants[0].label + ' — вклад ' + money(safeVariants[0].contribution) + '.';
    } else {
      message = 'При текущих вводных все варианты выглядят убыточными. Сначала проверьте оборот, расходы и мотивации.';
    }

    if (riskyVariants.length) {
      message += ' Опасные или убыточные варианты: ' + riskyVariants.map(function (variant) {
        return variant.label;
      }).join(', ') + '.';
    }

    elements.schemeAdvice.textContent = message;
  }

  function renderWarnings(totals) {
    var warnings = [];

    if (totals.warningOwnerDependency) {
      warnings.push({
        type: 'warning',
        text: 'Без личных сделок собственника офис не окупается сам. Плюс появляется только благодаря собственнику.'
      });
    }

    if (totals.resultWithOwner < -0.5) {
      warnings.push({
        type: 'danger',
        text: 'Даже с личными сделками собственника офис остаётся в минусе. Проверьте расходы, выплаты агентам, мотивационные резервы и общий оборот.'
      });
    }

    if (totals.agentEconomics.some(function (agent) { return agent.status === 'Не окупается'; })) {
      warnings.push({
        type: 'danger',
        text: 'Есть агенты, которые не окупают свою долю расходов. Посмотрите блок “Кто окупает своё место” и проверьте их условия выплат.'
      });
    }

    warnings.push({
      type: 'info',
      text: 'Роялти рассчитано автоматически от общего оборота: ' + money(totals.totalTurnover) + ' × ' + percent(getRoyaltyRate(totals.totalTurnover)) + '.'
    });

    warnings.push({
      type: 'info',
      text: 'Роялти по агенту в блоке окупаемости показано как управленческая оценка: реальная ставка зависит от общего оборота офиса.'
    });

    elements.warningsList.innerHTML = warnings.map(function (warning) {
      return '<div class="notice ' + warning.type + '">' + escapeHtml(warning.text) + '</div>';
    }).join('');
  }

  function render() {
    renderExpenses();
    renderAgents();
    elements.ownerSalesInput.value = formatMoneyInputValue(state.ownerSales);
    elements.schemeCommission.value = formatMoneyInputValue(state.schemeCheck.commission);
    elements.schemeDealCount.value = state.schemeCheck.dealCount;
    elements.schemeIntroduced.value = String(state.schemeCheck.introduced);
    elements.schemeExpenseShareMode.value = state.schemeCheck.expenseShareMode;
    elements.schemeManualExpenseShare.value = formatMoneyInputValue(state.schemeCheck.manualExpenseShare);
    elements.schemeMotivationReserve.value = formatMoneyInputValue(state.schemeCheck.motivationReserve);
    elements.schemeManualRate.value = state.schemeCheck.manualRate;
    renderTotals();
  }

  function getFocusSelector(element) {
    if (!element || !element.dataset) {
      return null;
    }

    if (element.dataset.agentField && element.dataset.agentId) {
      return '[data-agent-field="' + element.dataset.agentField + '"][data-agent-id="' + element.dataset.agentId + '"]';
    }
    if (element.dataset.motivationField && element.dataset.agentId) {
      return '[data-motivation-field="' + element.dataset.motivationField + '"][data-agent-id="' + element.dataset.agentId + '"]';
    }
    if (element.dataset.motivationFlag && element.dataset.agentId) {
      return '[data-motivation-flag="' + element.dataset.motivationFlag + '"][data-agent-id="' + element.dataset.agentId + '"]';
    }
    if (element.dataset.dealIndex !== undefined && element.dataset.agentId) {
      return '[data-deal-index="' + element.dataset.dealIndex + '"][data-agent-id="' + element.dataset.agentId + '"]';
    }
    if (element.dataset.action === 'add-deal' && element.dataset.agentId) {
      return '[data-action="add-deal"][data-agent-id="' + element.dataset.agentId + '"]';
    }
    if (element.dataset.action === 'remove-deal' && element.dataset.agentId && element.dataset.dealIndex !== undefined) {
      return '[data-action="remove-deal"][data-agent-id="' + element.dataset.agentId + '"][data-deal-index="' + element.dataset.dealIndex + '"]';
    }
    return null;
  }

  function captureUiState() {
    var active = document.activeElement;
    return {
      openDetails: Array.prototype.map.call(document.querySelectorAll('details[open][data-agent-id]'), function (node) {
        return {
          agentId: node.dataset.agentId,
          className: node.className
        };
      }),
      focusSelector: getFocusSelector(active),
      selectionStart: active && active.selectionStart,
      selectionEnd: active && active.selectionEnd
    };
  }

  function restoreUiState(uiState) {
    uiState.openDetails.forEach(function (detail) {
      var selector = detail.className
        ? 'details.' + detail.className.split(/\s+/).filter(Boolean).join('.') + '[data-agent-id="' + detail.agentId + '"]'
        : 'details[data-agent-id="' + detail.agentId + '"]';
      var detailNode = document.querySelector(selector);
      if (detailNode) {
        detailNode.open = true;
      }
    });

    if (uiState.focusSelector) {
      var active = document.querySelector(uiState.focusSelector);
      if (active) {
        active.focus();
        if (typeof active.setSelectionRange === 'function' && uiState.selectionStart !== null && uiState.selectionStart !== undefined) {
          active.setSelectionRange(uiState.selectionStart, uiState.selectionEnd);
        }
      }
    }
  }

  function renderPreservingUiState(focusSelectorOverride) {
    var uiState = captureUiState();
    if (focusSelectorOverride) {
      uiState.focusSelector = focusSelectorOverride;
      uiState.selectionStart = null;
      uiState.selectionEnd = null;
    }
    render();
    restoreUiState(uiState);
  }

  function shouldRerenderStructuralField(target, eventType) {
    if (!target || target.dataset.structural !== 'true') {
      return false;
    }

    return !(eventType === 'input' && target.tagName === 'INPUT');
  }

  function shouldScheduleMotivationRerender(target, eventType) {
    if (!target || eventType !== 'input' || target.tagName !== 'INPUT') {
      return false;
    }

    return target.dataset.agentField === 'halfYearCommission';
  }

  function scheduleMotivationRerender() {
    if (deferredMotivationRenderTimer) {
      window.clearTimeout(deferredMotivationRenderTimer);
    }

    deferredMotivationRenderTimer = window.setTimeout(function () {
      deferredMotivationRenderTimer = null;
      renderPreservingUiState();
    }, 180);
  }

  function syncAgentTotalsFromDeals(agent) {
    if (!agent) {
      return;
    }
    agent.dealsInput = normalizeExactDealsInput(agent.dealsInput);
    var calculated = calculateAgent(Object.assign({}, agent, { commissionMode: 'exact' }));
    agent.commission = calculated.commission;
    agent.dealCount = calculated.dealCount;
  }

  function updateTotalsOnly() {
    updateAgentSummaries();
    renderTotals();
  }

  function onInput(event) {
    var target = event.target;
    formatMoneyInputElement(target);
    markStateDirty();

    if (target.dataset.expenseId && target.dataset.expenseField) {
      var expense = state.expenses.find(function (item) { return item.id === target.dataset.expenseId; });
      if (expense) {
        if (target.dataset.expenseField === 'amount') {
          expense.amount = inputNumber(target.value);
        } else {
          expense.name = target.value;
        }
        renderTotals();
      }
      return;
    }

    if (target.id === 'ownerSalesInput') {
      state.ownerSales = inputNumber(target.value);
      renderTotals();
      return;
    }

    if (target.dataset.schemeField) {
      updateSchemeField(target);
      renderTotals();
      return;
    }

    if (target.dataset.agentField) {
      updateAgentField(target, event.type);
      return;
    }

    if (target.dataset.motivationField) {
      updateMotivationField(target, event.type);
      return;
    }

    if (target.dataset.motivationFlag) {
      updateMotivationFlag(target);
      return;
    }

    if (target.dataset.dealIndex !== undefined) {
      var dealAgent = findAgent(target.dataset.agentId);
      if (dealAgent) {
        dealAgent.dealsInput = normalizeExactDealsInput(dealAgent.dealsInput);
        dealAgent.dealsInput[Number(target.dataset.dealIndex)] = normalizeInputNumber(target.value) === '' ? '' : inputNumber(target.value);
        syncAgentTotalsFromDeals(dealAgent);
        updateTotalsOnly();
      }
      return;
    }

  }

  function updateAgentField(target, eventType) {
    var agent = findAgent(target.dataset.agentId);
    var field = target.dataset.agentField;
    if (!agent) {
      return;
    }

    agent.motivation = Object.assign(createMotivation(), agent.motivation || {});

    if (field === 'commission' || field === 'fixedRate' || field === 'startingRate' || field === 'quarterlyCommission' || field === 'quarterlyDeposits' || field === 'halfYearCommission' || field === 'preTripQuarterDeposits') {
      agent[field] = inputNumber(target.value);
    } else if (field === 'dealCount') {
      agent[field] = Math.max(1, Math.floor(inputNumber(target.value)));
    } else if (field === 'partnerSystem') {
      if (target.value === 'standard') {
        agent.paymentType = 'standard';
      } else if (agent.paymentType === 'standard') {
        agent.paymentType = 'boosted';
        if (agent.startingRate === undefined || agent.startingRate === null || agent.startingRate === '') {
          agent.startingRate = positiveNumber(PAY_SCALES.boostedStartingDefault || PAY_SCALES.boostedDefault[0]);
        }
      }
    } else if (field === 'introduced' || field === 'partnerConfirmed' || field === 'motivationOverride' || field === 'stipendOverride' || field === 'mountainSeaOverride' || field === 'travelOverride' || field === 'eventsOverride' || field === 'specialTermsOverride') {
      agent[field] = target.type === 'checkbox' ? target.checked : target.value === 'true';
    } else if (field === 'commissionMode') {
      if (target.value === 'quick') {
        syncAgentTotalsFromDeals(agent);
      }
      agent[field] = target.value;
      if (target.value === 'exact') {
        agent.dealsInput = hasMeaningfulDeals(agent.dealsInput)
          ? agent.dealsInput
          : splitCommissionIntoDeals(agent.commission, agent.dealCount);
        syncAgentTotalsFromDeals(agent);
      }
    } else if (field === 'status') {
      agent[field] = target.value;
      if (target.value === 'trainee') {
        agent.paymentType = 'standard';
        if (agent.motivation.mode === 'rules') {
          agent.motivation.mode = 'off';
        }
      }
    } else {
      agent[field] = target.value;
    }

    if ((field === 'commission' || field === 'dealCount') && (agent.commissionMode || 'quick') === 'quick') {
      agent.dealsInput = splitCommissionIntoDeals(agent.commission, agent.dealCount);
    }

    if (shouldRerenderStructuralField(target, eventType)) {
      renderPreservingUiState();
    } else {
      updateTotalsOnly();
      if (shouldScheduleMotivationRerender(target, eventType)) {
        scheduleMotivationRerender();
      }
    }
  }

  function updateMotivationField(target, eventType) {
    var agent = findAgent(target.dataset.agentId);
    if (!agent) {
      return;
    }
    agent.motivation = Object.assign(createMotivation(), agent.motivation || {});

    if (target.dataset.motivationField === 'stipendMode' || target.dataset.motivationField === 'annualReserveMode' || target.dataset.motivationField === 'mode') {
      agent.motivation[target.dataset.motivationField] = target.value;
    } else if (target.dataset.motivationField === 'stipendManualEnabled') {
      agent.motivation[target.dataset.motivationField] = target.checked;
      agent.motivation.stipendMode = target.checked ? 'manual' : 'auto';
    } else if (target.dataset.motivationField === 'specialManualReserveEnabled') {
      agent.motivation[target.dataset.motivationField] = target.checked;
      agent.motivation.mode = target.checked ? 'manual' : 'off';
    } else {
      agent.motivation[target.dataset.motivationField] = inputNumber(target.value);
    }

    if (
      shouldRerenderStructuralField(target, eventType)
      || (eventType !== 'input' && (target.dataset.motivationField === 'mode' || target.dataset.motivationField === 'specialManualReserveEnabled' || target.dataset.motivationField === 'stipendManualEnabled'))
    ) {
      renderPreservingUiState();
    } else {
      updateTotalsOnly();
    }
  }

  function updateMotivationFlag(target) {
    var agent = findAgent(target.dataset.agentId);
    if (!agent) {
      return;
    }
    agent.motivation = Object.assign(createMotivation(), agent.motivation || {});
    if (target.dataset.motivationFlag === 'starEnabled' && target.checked) {
      state.agents.forEach(function (otherAgent) {
        if (otherAgent.id !== agent.id) {
          otherAgent.motivation = Object.assign(createMotivation(), otherAgent.motivation || {});
          otherAgent.motivation.starEnabled = false;
        }
      });
    }
    agent.motivation[target.dataset.motivationFlag] = target.checked;
    if (target.dataset.motivationFlag === 'starEnabled') {
      renderPreservingUiState('[data-agent-id="' + agent.id + '"][data-motivation-flag="starEnabled"]');
      return;
    }
    updateTotalsOnly();
  }

  function updateSchemeField(target) {
    var field = target.dataset.schemeField;
    if (field === 'introduced') {
      state.schemeCheck[field] = target.value === 'true';
    } else if (field === 'expenseShareMode') {
      state.schemeCheck[field] = target.value;
    } else if (field === 'dealCount') {
      state.schemeCheck[field] = Math.max(1, Math.floor(inputNumber(target.value)));
    } else {
      state.schemeCheck[field] = inputNumber(target.value);
    }
  }

  function openTableModePage() {
    try {
      localStorage.setItem(TABLE_SNAPSHOT_KEY, JSON.stringify({
        version: TABLE_SNAPSHOT_VERSION,
        state: clone(Object.assign({}, state, { version: STATE_VERSION }))
      }));
    } catch (error) {
      console.warn('Не удалось сохранить данные для табличного режима.', error);
    }

    var tableWindow = window.open('table.html', '_blank');
    if (!tableWindow) {
      window.location.href = 'table.html';
    }
  }

  function onClick(event) {
    var target = event.target.closest('[data-action]');
    if (!target) {
      return;
    }

    if (target.dataset.action === 'open-table-mode') {
      openTableModePage();
      return;
    }

    if (target.dataset.action === 'remove-agent') {
      markStateDirty();
      state.agents = state.agents.filter(function (agent) {
        return agent.id !== target.dataset.agentId;
      });
      setAgentCollapsed(target.dataset.agentId, false);
      if (!state.agents.length) {
        state.agents.push(createAgent());
        setAgentCollapsed(state.agents[0].id, false);
      }
      renderPreservingUiState();
    }

    if (target.dataset.action === 'toggle-agent-collapse') {
      var nextCollapsed = !isAgentCollapsed(target.dataset.agentId);
      setAgentCollapsed(target.dataset.agentId, nextCollapsed);
      renderPreservingUiState(nextCollapsed
        ? '[data-action="toggle-agent-collapse"][data-agent-id="' + target.dataset.agentId + '"]'
        : '[data-agent-field="name"][data-agent-id="' + target.dataset.agentId + '"]');
    }

    if (target.dataset.action === 'add-deal') {
      var addDealAgent = findAgent(target.dataset.agentId);
      if (addDealAgent) {
        markStateDirty();
        addDealAgent.dealsInput = normalizeExactDealsInput(addDealAgent.dealsInput);
        addDealAgent.dealsInput.push('');
        syncAgentTotalsFromDeals(addDealAgent);
        renderPreservingUiState('[data-deal-index="' + (addDealAgent.dealsInput.length - 1) + '"][data-agent-id="' + addDealAgent.id + '"]');
      }
    }

    if (target.dataset.action === 'remove-deal') {
      var removeDealAgent = findAgent(target.dataset.agentId);
      if (removeDealAgent) {
        markStateDirty();
        removeDealAgent.dealsInput = normalizeExactDealsInput(removeDealAgent.dealsInput);
        if (removeDealAgent.dealsInput.length > 1) {
          removeDealAgent.dealsInput.splice(Number(target.dataset.dealIndex), 1);
        }
        syncAgentTotalsFromDeals(removeDealAgent);
        renderPreservingUiState('[data-deal-index="' + Math.max(0, Number(target.dataset.dealIndex) - 1) + '"][data-agent-id="' + removeDealAgent.id + '"]');
      }
    }

    if (target.dataset.action === 'clear-all') {
      if (!window.confirm('Очистить все текущие данные на странице? Это действие заменит текущий ввод пустым шаблоном.')) {
        return;
      }
      markStateDirty();
      state = createBlankState();
      uiState = createUiState();
      try {
        localStorage.removeItem(TABLE_SNAPSHOT_KEY);
      } catch (error) {
        console.warn('Could not clear table snapshot.', error);
      }
      window.domianA4State = state;
      render();
    }

    if (target.dataset.action === 'restore-example') {
      if (!window.confirm('Вернуть демонстрационный пример и заменить им текущие данные?')) {
        return;
      }
      markStateDirty();
      state = createExampleState();
      uiState = createUiState();
      window.domianA4State = state;
      render();
    }

    if (target.dataset.action === 'add-expense') {
      markStateDirty();
      state.expenses.push({
        id: nextExpenseId(),
        name: '',
        amount: 0
      });
      renderPreservingUiState();
    }

    if (target.dataset.action === 'remove-expense') {
      markStateDirty();
      state.expenses = state.expenses.filter(function (expense) {
        return expense.id !== target.dataset.expenseId;
      });
      renderPreservingUiState();
    }
  }

  function collectElements() {
    [
      'expensesList',
      'agentsList',
      'addAgentBtn',
      'addAgentBottomBtn',
      'ownerSalesInput',
      'resultStatus',
      'agentTurnover',
      'ownerSales',
      'totalTurnover',
      'agentPayouts',
      'referrals',
      'motivationReserves',
      'royalty',
      'officeExpenses',
      'resultWithoutOwnerBeforeReserves',
      'resultWithoutOwner',
      'resultWithOwnerBeforeReserves',
      'resultWithOwner',
      'warningsList',
      'expensesInlineTotal',
      'profitabilityList',
      'managementSummary',
      'forecastRows',
      'schemeCommission',
      'schemeDealCount',
      'schemeIntroduced',
      'schemeExpenseShareMode',
      'schemeManualExpenseShare',
      'schemeMotivationReserve',
      'schemeManualRate',
      'schemeExpenseShare',
      'schemeResults',
      'schemeAdvice'
    ].forEach(function (id) {
      elements[id] = document.getElementById(id);
    });
  }

  function updateForecastNotice() {
    var forecastNotice = document.querySelector('.forecast-card .notice.info');
    if (forecastNotice) {
      forecastNotice.textContent = 'Это условный прогноз от текущего месяца, а не полноценный годовой расчёт. Роялти считается как сумма одинаковых месяцев; если реальный оборот по месяцам будет отличаться, ставка роялти может измениться.';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    collectElements();
    updateForecastNotice();
    state = createState();
    uiState = createUiState();
    window.addEventListener('beforeunload', function (event) {
      if (!hasUnsavedChanges) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    });
    document.body.addEventListener('compositionstart', function (event) {
      if (event.target && event.target.dataset && event.target.dataset.moneyInput === 'true') {
        event.target.dataset.composing = 'true';
      }
    });
    document.body.addEventListener('compositionend', function (event) {
      if (event.target && event.target.dataset && event.target.dataset.moneyInput === 'true') {
        event.target.dataset.composing = 'false';
        formatMoneyInputElement(event.target);
        onInput({ target: event.target, type: 'input' });
      }
    });
    document.body.addEventListener('input', onInput);
    document.body.addEventListener('change', onInput);
    document.body.addEventListener('click', onClick);
    elements.addAgentBtn.addEventListener('click', addAgentCard);
    elements.addAgentBottomBtn.addEventListener('click', addAgentCard);
    render();
    window.domianA4State = state;
  });
}());

