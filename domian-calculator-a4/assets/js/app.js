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

  function createAgent() {
    return {
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
    };
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

  function createBlankExpense() {
    return {
      id: nextExpenseId(),
      name: '',
      amount: 0
    };
  }

  function createState() {
    var agents = clone(DEFAULT_AGENTS).map(function (agent) {
      agent.motivation = Object.assign(createMotivation(), agent.motivation || {});
      return agent;
    });

    return {
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
      expenses: [createBlankExpense()],
      agents: [createAgent()],
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
    return state.agents.find(function (agent) {
      return agent.id === agentId;
    });
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
      return 'Путешествие недоступно: результат за полугодие меньше 1 600 000 ₽.';
    }
    if (reason === 'preTripDeposits') {
      return 'Путешествие недоступно: в квартале перед поездкой задатков меньше 250 000 ₽.';
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
      + renderEligibilityNote(available, reason, overridden)
      + (!available ? renderOverrideCheckbox(agent, config.overrideField, config.overrideLabel) : '')
      + '<div class="motivation-card-fields">'
      + '<label class="field"><span>Сумма за поездку, ₽</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-motivation-field="' + config.amountField + '" value="' + motivation[config.amountField] + '"' + disabled(locked) + '></label>'
      + '<label class="field"><span>Количество поездок в год</span><input type="number" min="0" step="1" data-agent-id="' + agent.id + '" data-motivation-field="' + config.countField + '" value="' + motivation[config.countField] + '"' + disabled(locked) + '></label>'
      + '</div>'
      + '<dl class="motivation-card-total">'
      + renderMotivationMetric(agent.id, config.key + 'Annual', 'Итого в год', annual)
      + renderMotivationMetric(agent.id, config.key + 'Monthly', 'В месяц при делении на 12', annual / 12)
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
    var locked = !available && !overridden;

    return '<article class="motivation-card' + (locked ? ' is-blocked' : '') + '">'
      + '<label class="motivation-card-toggle"><input type="checkbox" data-agent-id="' + agent.id + '" data-motivation-flag="' + config.enabledField + '"' + checked(motivation[config.enabledField]) + disabled(locked) + '>'
      + '<span><strong>' + config.title + '</strong><small>' + config.description + '</small></span></label>'
      + (config.alwaysAvailable ? '<p class="eligibility-note ok">Конгресс и Звезда учитываются как обязательный годовой расход собственника и доступны независимо от условий агента.</p>' : renderEligibilityNote(available, reason, overridden))
      + (!available ? renderOverrideCheckbox(agent, config.overrideField, config.overrideLabel) : '')
      + '<div class="motivation-card-fields single">'
      + '<label class="field"><span>Сумма в год, ₽</span><input type="number" min="0" step="500" data-agent-id="' + agent.id + '" data-motivation-field="' + config.amountField + '" value="' + motivation[config.amountField] + '"' + disabled(locked) + '></label>'
      + '</div>'
      + '<dl class="motivation-card-total">'
      + renderMotivationMetric(agent.id, config.key + 'Annual', 'Итого в год', annual)
      + renderMotivationMetric(agent.id, config.key + 'Monthly', 'В месяц при делении на 12', annual / 12)
      + '</dl>'
      + '</article>';
  }

  function renderExactDeals(agent, result) {
    var deals = Array.isArray(agent.dealsInput) && agent.dealsInput.length ? agent.dealsInput : [0];
    return '<div class="exact-deals-panel wide-field">'
      + '<p class="hint">Для точной зарплаты лучше ввести сделки отдельно. Особенно если одна сделка сильно больше других.</p>'
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
      + '<div><dt>Итого комиссия по сделкам</dt><dd data-agent-summary="commission" data-agent-id="' + agent.id + '">' + money(result.commission) + '</dd></div>'
      + '<div><dt>Количество сделок</dt><dd data-agent-summary="dealCount" data-agent-id="' + agent.id + '">' + result.dealCount + '</dd></div>'
      + '</dl>'
      + '</div>';
  }

  function renderQuickDealEstimate(agent, result) {
    return '<div class="exact-deals-panel wide-field quick-deals-panel">'
      + '<p class="deal-mode-hint">Быстрый расчёт — примерная оценка. Калькулятор делит общую комиссию поровну на сделки. Если сделки были разными по сумме, используйте точный расчёт.</p>'
      + '<div class="form-grid compact-grid deal-estimate-grid">'
      + '<label class="field"><span>Сколько агент принёс комиссии</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="commission" value="' + result.commission + '"><small>Это вся комиссия за месяц.</small></label>'
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
    elements.expensesList.innerHTML = state.expenses.map(function (expense) {
      return '<label class="field expense-row">'
        + '<span>Категория</span>'
        + '<input type="text" data-expense-id="' + expense.id + '" data-expense-field="name" value="' + escapeHtml(expense.name) + '">'
        + '<input type="number" min="0" step="1000" data-expense-id="' + expense.id + '" data-expense-field="amount" value="' + expense.amount + '" aria-label="Сумма расхода ' + escapeHtml(expense.name) + '">'
        + '<button class="button ghost" type="button" data-action="remove-expense" data-expense-id="' + expense.id + '">Удалить</button>'
        + '</label>';
    }).join('');
  }

  function renderMotivationControls(agent) {
    var motivation = Object.assign(createMotivation(), agent.motivation || {});
    var motivationReserve = calculateAgent(agent).motivationReserve;
    var reserve = calculateMotivationReserve(agent);

    return '<details class="motivation-box" data-agent-id="' + agent.id + '">'
      + '<summary class="motivation-summary">'
      + '<span class="motivation-summary-main">'
      + '<span class="motivation-summary-title"><span class="summary-closed">Открыть настройки мотиваций</span><span class="summary-open">Скрыть настройки мотиваций</span></span>'
      + '<span class="motivation-summary-text">Здесь можно изменить стипендию, поездки, корпоративы, конгресс и звезду. Эти суммы влияют на итог офиса.</span>'
      + '</span>'
      + '<span class="motivation-summary-side">'
      + '<span class="motivation-current">Сейчас учтено: <b data-agent-summary="motivationInline" data-agent-id="' + agent.id + '">' + money(motivationReserve) + '</b> / месяц</span>'
      + '<span class="collapse-text"><span class="summary-closed">Раскрыть ↓</span><span class="summary-open">Скрыть ↑</span></span>'
      + '</span>'
      + '</summary>'
      + '<section class="eligibility-panel">'
      + '<p><strong>Проверка права на мотивации.</strong> Заполните квартальный результат и задатки: по ним калькулятор понимает, какие мотивации положены агенту.</p>'
      + '<div class="form-grid compact-grid">'
      + '<label class="field"><span>Результат агента за квартал, ₽</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="quarterlyCommission" data-structural="true" value="' + positiveNumber(agent.quarterlyCommission) + '"><small>Нужно для уровня и стипендии.</small></label>'
      + '<label class="field"><span>Задатки за квартал, ₽</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="quarterlyDeposits" data-structural="true" value="' + positiveNumber(agent.quarterlyDeposits) + '"><small>Партнёрство подтверждено от 250 000 ₽.</small></label>'
      + '<label class="field"><span>Результат за полугодие, ₽</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="halfYearCommission" data-structural="true" value="' + positiveNumber(agent.halfYearCommission) + '"><small>Для Путешествия с Домиан: минимум 1 600 000 ₽.</small></label>'
      + '<label class="field"><span>Задатки перед поездкой, ₽</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="preTripQuarterDeposits" data-structural="true" value="' + positiveNumber(agent.preTripQuarterDeposits) + '"><small>Для поездки нужен квартал от 250 000 ₽ задатков.</small></label>'
      + '</div>'
      + '<p class="eligibility-note ' + (reserve.partnershipConfirmed ? 'ok' : 'blocked') + '">' + (reserve.partnershipConfirmed ? 'Партнёрство подтверждено: задатков за квартал 250 000 ₽ или больше.' : 'Партнёрство не подтверждено: задатков за квартал меньше 250 000 ₽. Партнёрские бонусы по умолчанию не положены.') + '</p>'
      + renderOverrideCheckbox(agent, 'specialTermsOverride', 'Разрешить мотивации при особых условиях агента')
      + '</section>'
      + '<div class="form-grid compact-grid">'
      + '<label class="field wide-field"><span>Как учитывать стипендию?</span><select data-agent-id="' + agent.id + '" data-motivation-field="stipendMode">'
      + option('off', 'Не считать', motivation.stipendMode)
      + option('auto', 'Посчитать по кварталу', motivation.stipendMode)
      + option('manual', 'Ввести сумму вручную', motivation.stipendMode)
      + '</select><small>Стипендия — это будущая ежемесячная нагрузка по результатам квартала.</small></label>'
      + renderEligibilityNote(reserve.stipendAvailable, reserve.stipendReason, reserve.stipendOverride)
      + (!reserve.stipendAvailable ? renderOverrideCheckbox(agent, 'stipendOverride', 'Всё равно заложить стипендию') : '')
      + '<label class="field"><span>Стипендия вручную, ₽ в месяц</span><input type="number" min="0" step="500" data-agent-id="' + agent.id + '" data-motivation-field="manualStipendMonthly" value="' + motivation.manualStipendMonthly + '"' + disabled(!reserve.stipendAvailable && !reserve.stipendOverride) + '></label>'
      + '</div>'
      + '<section class="reserve-mode-card">'
      + '<label class="field"><span>Как учитывать годовые мотивации?</span><select data-agent-id="' + agent.id + '" data-motivation-field="annualReserveMode">'
      + option('monthly', 'Распределить по 12 месяцам', motivation.annualReserveMode)
      + option('full', 'Учесть всю сумму сейчас', motivation.annualReserveMode)
      + option('manual', 'Ввести свою сумму в месяц', motivation.annualReserveMode)
      + '</select><small>Собственник сам выбирает: копить равномерно, заложить всю сумму сразу или указать частичный резерв.</small></label>'
      + '<label class="field"><span>Своя сумма резерва, ₽ в месяц</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-motivation-field="manualAnnualReserveMonthly" value="' + motivation.manualAnnualReserveMonthly + '"><small>Используется только в режиме “Ввести свою сумму в месяц”. В остальных режимах поле не влияет на расчёт.</small></label>'
      + '</section>'
      + '<div class="motivation-card-grid">'
      + renderTripMotivationCard(agent, { key: 'mountainSea', enabledField: 'mountainSeaEnabled', amountField: 'mountainSeaPerTrip', countField: 'mountainSeaTripsPerYear', overrideField: 'travelOverride', overrideLabel: 'Всё равно заложить поездки по РФ', title: 'Горы / Море', description: 'Поездки по РФ для агента' })
      + renderTripMotivationCard(agent, { key: 'travel', enabledField: 'travelEnabled', amountField: 'travelPerTrip', countField: 'travelTripsPerYear', overrideField: 'travelOverride', overrideLabel: 'Всё равно заложить путешествие', title: 'Заграница / Путешествие', description: 'Зарубежные поездки для агента' })
      + renderAnnualMotivationCard(agent, { key: 'corporate', enabledField: 'corporateEnabled', amountField: 'corporatePerYear', overrideField: 'eventsOverride', overrideLabel: 'Всё равно заложить корпоратив', title: 'Корпоративы', description: 'Годовой резерв на мероприятия' })
      + renderAnnualMotivationCard(agent, { key: 'congress', enabledField: 'congressEnabled', amountField: 'congressPerYear', alwaysAvailable: true, title: 'Конгресс', description: 'Участие агента в годовом мероприятии' })
      + renderAnnualMotivationCard(agent, { key: 'star', enabledField: 'starEnabled', amountField: 'starPerYear', alwaysAvailable: true, title: 'Звезда', description: 'Награда для лучшего агента офиса' })
      + '</div>'
      + '</details>';
  }

  function renderAgents() {
    elements.agentsList.innerHTML = state.agents.map(function (agent, index) {
      var result = calculateAgent(agent);
      var boostedControls = '';
      var fixedControl = '';
      var statusControl = '';

      if (agent.paymentType === 'standard') {
        statusControl = '<label class="field"><span>Статус</span><select data-agent-id="' + agent.id + '" data-agent-field="status">'
          + option('trainee', 'Стажёр', agent.status)
          + option('partner', 'Партнёр', agent.status)
          + '</select><small>Обычная шкала выплат по номеру сделки.</small></label>';
      }

      if (agent.paymentType === 'boosted') {
        boostedControls = '<div class="rate-grid">'
          + [0, 1, 2, 3].map(function (rateIndex) {
            var labels = ['1-я сделка, %', '2-я сделка, %', '3-я сделка, %', '4-я и далее, %'];
            return '<label class="field"><span>' + labels[rateIndex] + '</span>'
              + '<input type="number" min="0" max="100" step="1" data-agent-id="' + agent.id + '" data-rate-index="' + rateIndex + '" value="' + agent.boostedRates[rateIndex] + '"></label>';
          }).join('')
          + '</div><p class="hint compact">Компромиссный вариант: первые сделки оплачиваются выше стандарта, но это ещё не фиксированный процент.</p>';
      }

      if (agent.paymentType === 'fixed') {
        fixedControl = '<label class="field"><span>Фиксированный процент</span>'
          + '<input type="number" min="0" max="100" step="1" data-agent-id="' + agent.id + '" data-agent-field="fixedRate" value="' + agent.fixedRate + '">'
          + '<small>Один процент на все сделки. Чем выше процент, тем больше агент должен продавать.</small></label>';
      }

      return '<article class="agent-card">'
        + '<div class="agent-head">'
        + '<h3>Агент ' + (index + 1) + '</h3>'
        + '<button class="button ghost" type="button" data-action="remove-agent" data-agent-id="' + agent.id + '"' + (state.agents.length === 1 ? ' disabled' : '') + '>Удалить</button>'
        + '</div>'
        + '<div class="form-grid">'
        + '<label class="field agent-main-field"><span>Имя</span><input type="text" data-agent-id="' + agent.id + '" data-agent-field="name" value="' + escapeHtml(agent.name) + '"></label>'
        + '<label class="field agent-main-field"><span>Как считать сделки?</span><select data-agent-id="' + agent.id + '" data-agent-field="commissionMode" data-structural="true">'
        + option('exact', 'Точно: ввести каждую сделку отдельно', agent.commissionMode || 'exact')
        + option('quick', 'Быстро: общая комиссия и количество сделок', agent.commissionMode || 'exact')
        + '</select><small>Точный режим нужен, если сделки были разными по сумме.</small></label>'
        + renderDealInputs(agent, result)
        + '<label class="field agent-main-field"><span>Тип расчёта выплаты</span><select data-agent-id="' + agent.id + '" data-agent-field="paymentType" data-structural="true">'
        + option('standard', 'Стандартная шкала', agent.paymentType)
        + option('boosted', 'Повышенная стартовая шкала', agent.paymentType)
        + option('fixed', 'Фиксированный процент', agent.paymentType)
        + '</select></label>'
        + statusControl
        + fixedControl
        + '<label class="field"><span>Приведённый агент</span><select data-agent-id="' + agent.id + '" data-agent-field="introduced">'
        + option('false', 'Нет', String(agent.introduced))
        + option('true', 'Да', String(agent.introduced))
        + '</select><small>Если да, дополнительно считается 2,5% от его комиссии.</small></label>'
        + '</div>'
        + boostedControls
        + renderMotivationControls(agent)
        + '<dl class="agent-summary">'
        + '<div><dt>Выплата агенту</dt><dd data-agent-summary="payout" data-agent-id="' + agent.id + '">' + money(result.payout) + '</dd></div>'
        + '<div><dt>Реферал</dt><dd data-agent-summary="referral" data-agent-id="' + agent.id + '">' + money(result.referral) + '</dd></div>'
        + '<div><dt>Мотивационный резерв</dt><dd data-agent-summary="motivation" data-agent-id="' + agent.id + '">' + money(result.motivationReserve) + '</dd></div>'
        + '<div><dt>До роялти и расходов</dt><dd data-agent-summary="office" data-agent-id="' + agent.id + '">' + money(result.officeBeforeRoyaltyAndReserve) + '</dd></div>'
        + '</dl>'
        + '</article>';
    }).join('');
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
          commissionInput.value = agent.commission;
        }
        if (dealCountInput) {
          dealCountInput.value = agent.dealCount;
        }
        var dealCountNode = document.querySelector('[data-agent-summary="dealCount"][data-agent-id="' + agent.id + '"]');
        if (dealCountNode) {
          dealCountNode.textContent = agent.dealCount;
        }
      }
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
        text: 'Офис выходит в плюс только за счёт личных продаж собственника. Как система офис пока не окупается сам.'
      });
    }

    if (totals.resultWithOwner < -0.5) {
      warnings.push({
        type: 'danger',
        text: 'Офис в минусе. Проверьте расходы, выплаты агентам, мотивационные резервы и общий оборот.'
      });
    }

    if (totals.agentEconomics.some(function (agent) { return agent.status === 'Не окупается'; })) {
      warnings.push({
        type: 'danger',
        text: 'Есть агенты, которые не окупают свою долю расходов. Посмотрите блок “Кто окупает своё место”.'
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
    if (element.dataset.rateIndex !== undefined && element.dataset.agentId) {
      return '[data-rate-index="' + element.dataset.rateIndex + '"][data-agent-id="' + element.dataset.agentId + '"]';
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

  function syncAgentTotalsFromDeals(agent) {
    if (!agent) {
      return;
    }
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

    if (target.dataset.expenseId && target.dataset.expenseField) {
      var expense = state.expenses.find(function (item) { return item.id === target.dataset.expenseId; });
      if (expense) {
        if (target.dataset.expenseField === 'amount') {
          expense.amount = positiveNumber(target.value);
        } else {
          expense.name = target.value;
        }
        renderTotals();
      }
      return;
    }

    if (target.id === 'ownerSalesInput') {
      state.ownerSales = positiveNumber(target.value);
      renderTotals();
      return;
    }

    if (target.dataset.schemeField) {
      updateSchemeField(target);
      renderTotals();
      return;
    }

    if (target.dataset.agentField) {
      updateAgentField(target);
      return;
    }

    if (target.dataset.motivationField) {
      updateMotivationField(target);
      return;
    }

    if (target.dataset.motivationFlag) {
      updateMotivationFlag(target);
      return;
    }

    if (target.dataset.dealIndex !== undefined) {
      var dealAgent = findAgent(target.dataset.agentId);
      if (dealAgent) {
        dealAgent.dealsInput = Array.isArray(dealAgent.dealsInput) && dealAgent.dealsInput.length ? dealAgent.dealsInput : [0];
        dealAgent.dealsInput[Number(target.dataset.dealIndex)] = positiveNumber(target.value);
        syncAgentTotalsFromDeals(dealAgent);
        updateTotalsOnly();
      }
      return;
    }

    if (target.dataset.rateIndex !== undefined) {
      var rateAgent = findAgent(target.dataset.agentId);
      if (rateAgent) {
        rateAgent.boostedRates[Number(target.dataset.rateIndex)] = positiveNumber(target.value);
        updateTotalsOnly();
      }
    }
  }

  function updateAgentField(target) {
    var agent = findAgent(target.dataset.agentId);
    var field = target.dataset.agentField;
    if (!agent) {
      return;
    }

    if (field === 'commission' || field === 'fixedRate' || field === 'quarterlyCommission' || field === 'quarterlyDeposits' || field === 'halfYearCommission' || field === 'preTripQuarterDeposits') {
      agent[field] = positiveNumber(target.value);
    } else if (field === 'dealCount') {
      agent[field] = Math.max(1, Math.floor(positiveNumber(target.value)));
    } else if (field === 'introduced' || field === 'motivationOverride' || field === 'stipendOverride' || field === 'travelOverride' || field === 'eventsOverride' || field === 'specialTermsOverride') {
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
    } else {
      agent[field] = target.value;
    }

    if ((field === 'commission' || field === 'dealCount') && (agent.commissionMode || 'quick') === 'quick') {
      agent.dealsInput = splitCommissionIntoDeals(agent.commission, agent.dealCount);
    }

    if (target.dataset.structural === 'true') {
      renderPreservingUiState();
    } else {
      updateTotalsOnly();
    }
  }

  function updateMotivationField(target) {
    var agent = findAgent(target.dataset.agentId);
    if (!agent) {
      return;
    }
    agent.motivation = Object.assign(createMotivation(), agent.motivation || {});

    if (target.dataset.motivationField === 'stipendMode' || target.dataset.motivationField === 'annualReserveMode') {
      agent.motivation[target.dataset.motivationField] = target.value;
    } else {
      agent.motivation[target.dataset.motivationField] = positiveNumber(target.value);
    }

    updateTotalsOnly();
  }

  function updateMotivationFlag(target) {
    var agent = findAgent(target.dataset.agentId);
    if (!agent) {
      return;
    }
    agent.motivation = Object.assign(createMotivation(), agent.motivation || {});
    agent.motivation[target.dataset.motivationFlag] = target.checked;
    updateTotalsOnly();
  }

  function updateSchemeField(target) {
    var field = target.dataset.schemeField;
    if (field === 'introduced') {
      state.schemeCheck[field] = target.value === 'true';
    } else if (field === 'expenseShareMode') {
      state.schemeCheck[field] = target.value;
    } else if (field === 'dealCount') {
      state.schemeCheck[field] = Math.max(1, Math.floor(positiveNumber(target.value)));
    } else {
      state.schemeCheck[field] = positiveNumber(target.value);
    }
  }

  function openTableModePage() {
    try {
      localStorage.setItem('domianA4TableSnapshot', JSON.stringify(clone(state)));
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
      state.agents = state.agents.filter(function (agent) {
        return agent.id !== target.dataset.agentId;
      });
      if (!state.agents.length) {
        state.agents.push(createAgent());
      }
      renderPreservingUiState();
    }

    if (target.dataset.action === 'add-deal') {
      var addDealAgent = findAgent(target.dataset.agentId);
      if (addDealAgent) {
        addDealAgent.dealsInput = Array.isArray(addDealAgent.dealsInput) && addDealAgent.dealsInput.length ? addDealAgent.dealsInput : [0];
        addDealAgent.dealsInput.push(0);
        syncAgentTotalsFromDeals(addDealAgent);
        renderPreservingUiState('[data-deal-index="' + (addDealAgent.dealsInput.length - 1) + '"][data-agent-id="' + addDealAgent.id + '"]');
      }
    }

    if (target.dataset.action === 'remove-deal') {
      var removeDealAgent = findAgent(target.dataset.agentId);
      if (removeDealAgent) {
        removeDealAgent.dealsInput = Array.isArray(removeDealAgent.dealsInput) && removeDealAgent.dealsInput.length ? removeDealAgent.dealsInput : [0];
        if (removeDealAgent.dealsInput.length > 1) {
          removeDealAgent.dealsInput.splice(Number(target.dataset.dealIndex), 1);
        }
        syncAgentTotalsFromDeals(removeDealAgent);
        renderPreservingUiState('[data-deal-index="' + Math.max(0, Number(target.dataset.dealIndex) - 1) + '"][data-agent-id="' + removeDealAgent.id + '"]');
      }
    }

    if (target.dataset.action === 'clear-all') {
      state = createBlankState();
      window.domianA4State = state;
      render();
    }

    if (target.dataset.action === 'restore-example') {
      state = createState();
      window.domianA4State = state;
      render();
    }

    if (target.dataset.action === 'add-expense') {
      state.expenses.push({
        id: nextExpenseId(),
        name: 'Новый расход',
        amount: 0
      });
      renderPreservingUiState();
    }

    if (target.dataset.action === 'remove-expense') {
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

  document.addEventListener('DOMContentLoaded', function () {
    collectElements();
    state = createState();
    document.body.addEventListener('input', onInput);
    document.body.addEventListener('change', onInput);
    document.body.addEventListener('click', onClick);
    elements.addAgentBtn.addEventListener('click', function () {
      state.agents.push(createAgent());
      renderPreservingUiState('[data-agent-field="name"][data-agent-id="' + state.agents[state.agents.length - 1].id + '"]');
    });
    elements.addAgentBottomBtn.addEventListener('click', function () {
      state.agents.push(createAgent());
      renderPreservingUiState('[data-agent-field="name"][data-agent-id="' + state.agents[state.agents.length - 1].id + '"]');
    });
    render();
    window.domianA4State = state;
  });
}());
