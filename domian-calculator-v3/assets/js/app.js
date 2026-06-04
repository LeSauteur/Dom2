(function () {
  'use strict';

  var state = null;
  var idCounter = 100;

  var elements = {};

  var TAB_DESCRIPTIONS = {
    quick: 'Прикинуть плюс или минус за 2 минуты.',
    cards: 'Подробно ввести агентов, сделки, условия и мотивацию.',
    table: 'Посмотреть всех агентов и итоги одной таблицей.',
    analytics: 'Проверить пессимистичный, реалистичный и оптимистичный варианты.'
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nextId(prefix) {
    idCounter += 1;
    return prefix + idCounter;
  }

  function numberValue(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function createBlankAgent() {
    return {
      id: nextId('agent'),
      name: 'Новый агент',
      terms: 'standard',
      status: 'trainee',
      introduced: false,
      boostedRates: clone(PAY_SCALES.boostedDefault).map(function (rate) { return rate * 100; }),
      fixedRate: PAY_SCALES.fixedDefault * 100,
      quarterDeposits: 0,
      stipendMode: 'forecast',
      quarterManual: 0,
      expanded: false,
      deals: [
        { id: nextId('deal'), commission: 0 }
      ]
    };
  }

  function createQuickAgent() {
    return {
      id: nextId('quickAgent'),
      name: 'Новый агент',
      terms: 'standard',
      status: 'partner',
      specialType: 'fixed',
      fixedRate: 80,
      boostedRates: clone(PAY_SCALES.boostedDefault).map(function (rate) { return rate * 100; }),
      deals: [
        { id: nextId('quickDeal'), commission: 0 }
      ]
    };
  }

  function createQuickCheck() {
    return {
      period: 'month',
      royaltyMode: 'monthly',
      monthGross: 100000,
      periodGross: 0,
      monthTurnovers: [100000],
      agents: [
        createQuickAgent()
      ],
      periodExpenses: 0
    };
  }

  function createDefaultScenarios() {
    return [
      { id: 'pessimistic', name: 'Пессимистичный', coefficient: 0.70 },
      { id: 'realistic', name: 'Реалистичный', coefficient: 1.00 },
      { id: 'optimistic', name: 'Оптимистичный', coefficient: 1.30 }
    ];
  }

  function createInitialState(useDemo) {
    var now = new Date();
    return {
      month: now.getMonth(),
      year: now.getFullYear(),
      view: 'quick',
      quickCheck: createQuickCheck(),
      scenarios: createDefaultScenarios(),
      agents: useDemo ? clone(DEMO_AGENTS) : [createBlankAgent()],
      expenses: clone(DEFAULT_EXPENSES),
      currentMotivation: 0,
      manualReserve: 0,
      stipendReserveMode: 'quarter'
    };
  }

  function findAgent(agentId) {
    return state.agents.find(function (agent) {
      return agent.id === agentId;
    });
  }

  function findDeal(agent, dealId) {
    return (agent.deals || []).find(function (deal) {
      return deal.id === dealId;
    });
  }

  function findQuickAgent(agentId) {
    return state.quickCheck.agents.find(function (agent) {
      return agent.id === agentId;
    });
  }

  function findQuickDeal(agent, dealId) {
    return (agent.deals || []).find(function (deal) {
      return deal.id === dealId;
    });
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
    return '<option value="' + value + '"' + (value === current ? ' selected' : '') + '>' + label + '</option>';
  }

  function termsLabel(agent) {
    if (agent.terms === 'fixed') {
      return 'Фиксированный процент';
    }
    if (agent.terms === 'boosted') {
      return 'Повышенная стартовая шкала';
    }
    return 'Стандартные условия';
  }

  function statusLabel(agent) {
    if (agent.terms === 'fixed') {
      return agent.fixedRate + '% всем сделкам';
    }
    if (agent.terms === 'boosted') {
      return agent.boostedRates.join(' / ') + '%';
    }
    return agent.status === 'partner' ? 'Партнёр' : 'Стажёр';
  }

  function agentField(agent, field, type, label, attrs) {
    return '<div class="field">'
      + '<label>' + label + '</label>'
      + '<input type="' + type + '" data-agent-id="' + agent.id + '" data-agent-field="' + field + '" value="'
      + escapeHtml(agent[field]) + '" ' + (attrs || '') + '>'
      + '</div>';
  }

  function renderMonthOptions() {
    elements.monthSelect.innerHTML = MONTHS.map(function (month, index) {
      return option(String(index), month, String(state.month));
    }).join('');
  }

  function renderAgentCards() {
    elements.agentCards.innerHTML = state.agents.map(function (agent) {
      var result = calculateAgent(agent);
      var specialFields = '';
      var stipendControls = '';
      var stipendNotice = '';

      if (agent.terms === 'boosted') {
        specialFields = '<div class="rate-grid">'
          + [0, 1, 2, 3].map(function (index) {
            var labels = ['1-я сделка, %', '2-я сделка, %', '3-я сделка, %', '4-я и далее, %'];
            return '<div class="field"><label>' + labels[index] + '</label>'
              + '<input type="number" min="0" max="100" step="1" data-agent-id="' + agent.id + '" data-rate-index="' + index + '" value="' + agent.boostedRates[index] + '"></div>';
          }).join('')
          + '</div>';
      } else if (agent.terms === 'fixed') {
        specialFields = agentField(agent, 'fixedRate', 'number', 'Фиксированный процент агенту', 'min="0" max="100" step="1"');
      }

      if (agent.terms === 'standard') {
        stipendControls = '<div class="form-grid">'
          + '<div class="field wide"><label>Расчёт стипендии</label><select data-agent-id="' + agent.id + '" data-agent-field="stipendMode">'
          + option('forecast', 'Использовать прогноз по текущему месяцу × 3', agent.stipendMode)
          + option('manual', 'Ввести квартальную сумму вручную', agent.stipendMode)
          + '</select></div>'
          + (agent.stipendMode === 'manual' ? agentField(agent, 'quarterManual', 'number', 'Квартальная сумма вручную', 'min="0" step="1000"') : '')
          + '</div>';
      } else {
        stipendNotice = '<div class="notice-line warning">Мотивация отключена: агент на спецусловиях.</div>';
      }

      return '<article class="agent-card" data-card-id="' + agent.id + '">'
        + '<div class="agent-card-head">'
        + '<h2>' + escapeHtml(agent.name || 'Агент') + '</h2>'
        + '<button class="button button-danger" type="button" data-action="remove-agent" data-agent-id="' + agent.id + '">Удалить</button>'
        + '</div>'
        + '<div class="section-label">Что вводите вы</div>'
        + '<div class="form-grid">'
        + agentField(agent, 'name', 'text', 'Имя агента')
        + '<div class="field"><label>Тип условий агента</label><select data-agent-id="' + agent.id + '" data-agent-field="terms" data-structural="true">'
        + option('standard', 'Стандартные условия', agent.terms)
        + option('boosted', 'Повышенная стартовая шкала', agent.terms)
        + option('fixed', 'Фиксированный процент', agent.terms)
        + '</select></div>'
        + (agent.terms === 'standard'
          ? '<div class="field"><label>Статус агента</label><select data-agent-id="' + agent.id + '" data-agent-field="status">'
            + option('trainee', 'Стажёр', agent.status)
            + option('partner', 'Партнёр', agent.status)
            + '</select></div>'
          : specialFields)
        + '<div class="field"><label>Агент приведённый</label><select data-agent-id="' + agent.id + '" data-agent-field="introduced">'
        + option('false', 'Нет', String(agent.introduced))
        + option('true', 'Да', String(agent.introduced))
        + '</select></div>'
        + agentField(agent, 'quarterDeposits', 'number', 'Задатки за квартал', 'min="0" step="1000"')
        + '</div>'
        + '<div class="deal-list">'
        + agent.deals.map(function (deal, index) { return renderDealRow(agent, deal, index); }).join('')
        + '</div>'
        + '<button class="button button-muted" type="button" data-action="add-deal" data-agent-id="' + agent.id + '">Добавить сделку</button>'
        + '<div class="section-label calculated">Что считает калькулятор</div>'
        + '<div class="agent-summary">' + renderAgentSummary(agent, result) + '</div>'
        + stipendControls
        + stipendNotice
        + renderDepositNotice(agent, result)
        + '</article>';
    }).join('');
  }

  function renderDealRow(agent, deal, index) {
    var rate = getDealRate(agent, index);
    return '<div class="deal-row" data-deal-row="' + deal.id + '">'
      + '<div class="field"><label>Комиссия сделки ' + (index + 1) + '</label>'
      + '<input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '" data-deal-field="commission" value="' + deal.commission + '"></div>'
      + '<div class="summary-item"><span>Ставка</span><strong data-deal-calc="rate" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '">' + percent(rate) + '</strong></div>'
      + '<div class="summary-item"><span>ЗП</span><strong data-deal-calc="payout" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '">' + money(numberValue(deal.commission) * rate) + '</strong></div>'
      + '<button class="icon-button" type="button" title="Удалить сделку" data-action="remove-deal" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '">×</button>'
      + '</div>';
  }

  function renderAgentSummary(agent, result) {
    return [
      ['Комиссия <span class="term-note user-hint">Весь доход по сделкам до выплат агенту.</span>', money(result.gross), 'gross'],
      ['ЗП агента', money(result.payout), 'payout'],
      ['Реферал <span class="term-note user-hint">Автоматически 2,5%, если агент приведённый.</span>', money(result.referral), 'referral'],
      ['Остаётся офису', money(result.officeBeforeRoyalty), 'office'],
      ['Квартальный результат', result.stipend.enabled ? money(result.stipend.quarterResult) : 'Не считается', 'quarter'],
      ['Уровень', result.stipend.enabled ? (result.stipend.level ? 'Уровень ' + result.stipend.level : 'Нет уровня') : 'Отключено', 'level'],
      ['Стипендия / месяц <span class="term-note user-hint">Будущая выплата, не расход текущего месяца.</span>', result.stipend.enabled ? money(result.stipend.monthly) : '0 ₽', 'stipendMonth'],
      ['Стипендия / квартал', result.stipend.enabled ? money(result.stipend.quarter) : '0 ₽', 'stipendQuarter']
    ].map(function (item) {
      return '<div class="summary-item"><span>' + item[0] + '</span><strong data-agent-calc="' + item[2] + '" data-agent-id="' + agent.id + '">' + item[1] + '</strong></div>';
    }).join('');
  }

  function renderDepositNotice(agent, result) {
    var cls = result.depositBonusAvailable ? 'positive' : 'negative';
    var text = result.depositBonusAvailable
      ? 'Партнёрские бонусы доступны: задатки за квартал от 250 000 ₽.'
      : 'Партнёрские бонусы недоступны: задатки за квартал ниже 250 000 ₽.';
    return '<div class="notice-line ' + cls + '" data-agent-deposit="' + agent.id + '">' + text + '</div>';
  }

  function renderTable() {
    var totals = calculateOfficeTotals(state);
    elements.agentTableBody.innerHTML = state.agents.map(function (agent) {
      var result = totals.agentResults.find(function (item) { return item.id === agent.id; });
      var royaltyShare = result.gross * totals.royaltyRate;
      var officeRest = result.officeBeforeRoyalty - royaltyShare;
      var mainRow = '<tr data-row-id="' + agent.id + '">'
        + '<td><input type="text" data-agent-id="' + agent.id + '" data-agent-field="name" value="' + escapeHtml(agent.name) + '"></td>'
        + '<td><select data-agent-id="' + agent.id + '" data-agent-field="terms" data-structural="true">'
        + option('standard', 'Стандартные', agent.terms)
        + option('boosted', 'Повышенная', agent.terms)
        + option('fixed', 'Фикс', agent.terms)
        + '</select></td>'
        + '<td data-table-calc="status" data-agent-id="' + agent.id + '">' + statusLabel(agent) + '</td>'
        + '<td><select data-agent-id="' + agent.id + '" data-agent-field="introduced">'
        + option('false', 'Нет', String(agent.introduced))
        + option('true', 'Да', String(agent.introduced))
        + '</select></td>'
        + '<td data-table-calc="dealCount" data-agent-id="' + agent.id + '">' + result.dealCount + '</td>'
        + '<td data-table-calc="gross" data-agent-id="' + agent.id + '">' + money(result.gross) + '</td>'
        + '<td data-table-calc="payout" data-agent-id="' + agent.id + '">' + money(result.payout) + '</td>'
        + '<td data-table-calc="referral" data-agent-id="' + agent.id + '">' + money(result.referral) + '</td>'
        + '<td data-table-calc="royaltyShare" data-agent-id="' + agent.id + '">' + money(royaltyShare) + '</td>'
        + '<td data-table-calc="officeRest" data-agent-id="' + agent.id + '">' + money(officeRest) + '</td>'
        + '<td><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="quarterDeposits" value="' + agent.quarterDeposits + '"></td>'
        + '<td data-table-calc="stipendMonth" data-agent-id="' + agent.id + '">' + (result.stipend.enabled ? money(result.stipend.monthly) : 'Отключено') + '</td>'
        + '<td><button class="icon-button" type="button" title="Раскрыть сделки" data-action="toggle-agent" data-agent-id="' + agent.id + '">' + (agent.expanded ? '−' : '+') + '</button></td>'
        + '</tr>';
      var nestedRow = agent.expanded ? renderNestedRow(agent) : '';
      return mainRow + nestedRow;
    }).join('');
  }

  function renderNestedRow(agent) {
    var specialControls = '';
    if (agent.terms === 'standard') {
      specialControls = '<div class="field"><label>Статус</label><select data-agent-id="' + agent.id + '" data-agent-field="status">'
        + option('trainee', 'Стажёр', agent.status)
        + option('partner', 'Партнёр', agent.status)
        + '</select></div>';
    } else if (agent.terms === 'fixed') {
      specialControls = agentField(agent, 'fixedRate', 'number', 'Фиксированный процент', 'min="0" max="100" step="1"');
    } else {
      specialControls = '<div class="rate-grid">' + [0, 1, 2, 3].map(function (index) {
        return '<div class="field"><label>' + (index + 1) + '-я %</label><input type="number" min="0" max="100" step="1" data-agent-id="' + agent.id + '" data-rate-index="' + index + '" value="' + agent.boostedRates[index] + '"></div>';
      }).join('') + '</div>';
    }

    return '<tr class="nested-row"><td colspan="13">'
      + '<div class="nested-deals">'
      + specialControls
      + agent.deals.map(function (deal, index) {
        var rate = getDealRate(agent, index);
        return '<div class="nested-deal">'
          + '<div class="field"><label>Комиссия сделки ' + (index + 1) + '</label><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '" data-deal-field="commission" value="' + deal.commission + '"></div>'
          + '<div class="summary-item"><span>Ставка</span><strong data-deal-calc="rate" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '">' + percent(rate) + '</strong></div>'
          + '<div class="summary-item"><span>ЗП</span><strong data-deal-calc="payout" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '">' + money(numberValue(deal.commission) * rate) + '</strong></div>'
          + '<button class="icon-button" type="button" title="Удалить сделку" data-action="remove-deal" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '">×</button>'
          + '</div>';
      }).join('')
      + '<button class="button button-muted" type="button" data-action="add-deal" data-agent-id="' + agent.id + '">Добавить сделку</button>'
      + '</div></td></tr>';
  }

  function renderExpenses() {
    elements.expensesBody.innerHTML = state.expenses.map(function (expense) {
      return '<tr>'
        + '<td><input type="text" data-expense-id="' + expense.id + '" data-expense-field="name" value="' + escapeHtml(expense.name) + '"></td>'
        + '<td><input type="number" min="0" step="1000" data-expense-id="' + expense.id + '" data-expense-field="amount" value="' + expense.amount + '"></td>'
        + '<td><select data-expense-id="' + expense.id + '" data-expense-field="period">'
        + option('month', 'Месяц', expense.period)
        + option('quarter', 'Квартал', expense.period)
        + option('year', 'Год', expense.period)
        + '</select></td>'
        + '<td data-expense-monthly="' + expense.id + '">' + money(normalizeExpenseToMonth(expense)) + '</td>'
        + '</tr>';
    }).join('');
  }

  function quickPeriodLabel(period) {
    if (period === 'quarter') {
      return 'квартал';
    }
    if (period === 'halfyear') {
      return 'полугодие';
    }
    if (period === 'year') {
      return 'год';
    }
    return 'месяц';
  }

  function ensureQuickMonthTurnovers() {
    var months = getPeriodMonths(state.quickCheck.period);
    while (state.quickCheck.monthTurnovers.length < months) {
      state.quickCheck.monthTurnovers.push(0);
    }
    if (state.quickCheck.monthTurnovers.length > months) {
      state.quickCheck.monthTurnovers = state.quickCheck.monthTurnovers.slice(0, months);
    }
  }

  function renderQuickCheck() {
    ensureQuickMonthTurnovers();
    elements.quickPeriod.value = state.quickCheck.period;
    elements.quickRoyaltyMode.value = state.quickCheck.royaltyMode;
    elements.quickRoyaltyModeWrap.classList.toggle('hidden', getPeriodMonths(state.quickCheck.period) === 1);
    elements.quickPeriodExpenses.value = state.quickCheck.periodExpenses;
    renderQuickTurnoverFields();
    renderQuickAgents();
    updateQuickSummaries();
  }

  function renderQuickTurnoverFields() {
    var quick = state.quickCheck;
    var months = getPeriodMonths(quick.period);

    if (months === 1) {
      elements.quickTurnoverHint.textContent = 'Для месяца роялти считается автоматически по действующей сетке от месячного оборота.';
      elements.quickTurnoverFields.innerHTML = '<div class="field wide">'
        + '<label for="quickMonthGross">Оборот за месяц</label>'
        + '<input id="quickMonthGross" type="number" min="0" step="1000" data-quick-field="monthGross" value="' + quick.monthGross + '">'
        + '<p class="field-hint">Введите валовую комиссию офиса за месяц.</p>'
        + '</div>';
      return;
    }

    elements.quickTurnoverHint.textContent = 'Точный вариант считает роялти отдельно по каждому месяцу. Быстрый вариант берёт ставку по среднемесячному обороту.';

    if (quick.royaltyMode === 'average') {
      elements.quickTurnoverFields.innerHTML = '<div class="field wide">'
        + '<label for="quickPeriodGross">Оборот за ' + quickPeriodLabel(quick.period) + '</label>'
        + '<input id="quickPeriodGross" type="number" min="0" step="1000" data-quick-field="periodGross" value="' + quick.periodGross + '">'
        + '<p class="field-hint">Введите общий оборот за период. Ставка роялти будет выбрана по среднемесячному обороту.</p>'
        + '</div>';
      return;
    }

    elements.quickTurnoverFields.innerHTML = quick.monthTurnovers.map(function (amount, index) {
      return '<div class="field">'
        + '<label>Оборот месяца ' + (index + 1) + '</label>'
        + '<input type="number" min="0" step="1000" data-quick-month-index="' + index + '" value="' + amount + '">'
        + '<p class="field-hint">Комиссия за месяц ' + (index + 1) + '.</p>'
        + '</div>';
    }).join('');
  }

  function renderQuickAgents() {
    elements.quickAgents.innerHTML = state.quickCheck.agents.map(function (agent) {
      var normalized = quickAgentToCalculationAgent(agent);
      var result = calculateAgent(normalized);
      return '<article class="quick-agent-card" data-quick-agent-card="' + agent.id + '">'
        + '<div class="quick-agent-head">'
        + '<h3>' + escapeHtml(agent.name || 'Агент') + '</h3>'
        + '<button class="button button-danger" type="button" data-action="quick-remove-agent" data-quick-agent-id="' + agent.id + '">Удалить агента</button>'
        + '</div>'
        + '<div class="form-grid">'
        + '<div class="field"><label>Имя агента</label><input type="text" data-quick-agent-id="' + agent.id + '" data-quick-agent-field="name" value="' + escapeHtml(agent.name) + '"><p class="field-hint">Для удобства списка.</p></div>'
        + '<div class="field"><label>Тип условий</label><select data-quick-agent-id="' + agent.id + '" data-quick-agent-field="terms" data-quick-structural="true">'
        + option('standard', 'Стандартные условия', agent.terms)
        + option('special', 'Особые условия', agent.terms)
        + '</select><p class="field-hint">Стандартные шкалы или индивидуальные проценты.</p></div>'
        + renderQuickAgentConditionFields(agent)
        + '</div>'
        + '<div class="quick-agent-deals">'
        + agent.deals.map(function (deal, index) { return renderQuickDealRow(agent, deal, index); }).join('')
        + '</div>'
        + '<button class="button button-muted" type="button" data-action="quick-add-deal" data-quick-agent-id="' + agent.id + '">Добавить сделку агенту</button>'
        + '<div class="quick-agent-summary">'
        + '<div class="summary-item"><span>Комиссия сделок</span><strong data-quick-agent-calc="gross" data-quick-agent-id="' + agent.id + '">' + money(result.gross) + '</strong></div>'
        + '<div class="summary-item"><span>ЗП агента</span><strong data-quick-agent-calc="payout" data-quick-agent-id="' + agent.id + '">' + money(result.payout) + '</strong></div>'
        + '<div class="summary-item"><span>Сделок</span><strong data-quick-agent-calc="count" data-quick-agent-id="' + agent.id + '">' + result.dealCount + '</strong></div>'
        + '</div>'
        + '</article>';
    }).join('');
  }

  function renderQuickAgentConditionFields(agent) {
    if (agent.terms === 'standard') {
      return '<div class="field"><label>Статус</label><select data-quick-agent-id="' + agent.id + '" data-quick-agent-field="status">'
        + option('partner', 'Партнёр', agent.status)
        + option('trainee', 'Стажёр', agent.status)
        + '</select><p class="field-hint">Партнёр 45/50/55/60%, стажёр 30/35/40%.</p></div>';
    }

    var specialType = '<div class="field"><label>Тип особых условий</label><select data-quick-agent-id="' + agent.id + '" data-quick-agent-field="specialType" data-quick-structural="true">'
      + option('fixed', 'Фиксированный процент', agent.specialType)
      + option('boosted', 'Повышенная шкала', agent.specialType)
      + '</select><p class="field-hint">Выберите схему спецусловий.</p></div>';

    if (agent.specialType === 'boosted') {
      return specialType + '<div class="rate-grid wide">'
        + [0, 1, 2, 3].map(function (index) {
          var labels = ['1-я сделка, %', '2-я сделка, %', '3-я сделка, %', '4-я и далее, %'];
          return '<div class="field"><label>' + labels[index] + '</label><input type="number" min="0" max="100" step="1" data-quick-agent-id="' + agent.id + '" data-quick-rate-index="' + index + '" value="' + agent.boostedRates[index] + '"><p class="field-hint">Процент выплаты.</p></div>';
        }).join('')
        + '</div>';
    }

    return specialType + '<div class="field"><label>Фиксированный процент</label><input type="number" min="0" max="100" step="1" data-quick-agent-id="' + agent.id + '" data-quick-agent-field="fixedRate" value="' + agent.fixedRate + '"><p class="field-hint">Один процент для всех сделок.</p></div>';
  }

  function renderQuickDealRow(agent, deal, index) {
    var normalized = quickAgentToCalculationAgent(agent);
    var rate = getDealRate(normalized, index);
    return '<div class="quick-deal-row" data-quick-deal-row="' + deal.id + '">'
      + '<div class="field"><label>Сделка ' + (index + 1) + ' — комиссия</label><input type="number" min="0" step="1000" data-quick-agent-id="' + agent.id + '" data-quick-deal-id="' + deal.id + '" data-quick-deal-field="commission" value="' + deal.commission + '"><p class="field-hint">Валовая комиссия сделки.</p></div>'
      + '<div class="summary-item"><span>Ставка</span><strong data-quick-deal-calc="rate" data-quick-agent-id="' + agent.id + '" data-quick-deal-id="' + deal.id + '">' + percent(rate) + '</strong></div>'
      + '<div class="summary-item"><span>ЗП</span><strong data-quick-deal-calc="payout" data-quick-agent-id="' + agent.id + '" data-quick-deal-id="' + deal.id + '">' + money(numberValue(deal.commission) * rate) + '</strong></div>'
      + '<button class="icon-button" type="button" title="Удалить сделку" data-action="quick-remove-deal" data-quick-agent-id="' + agent.id + '" data-quick-deal-id="' + deal.id + '">×</button>'
      + '</div>';
  }

  function quickAgentToCalculationAgent(agent) {
    return {
      id: agent.id,
      name: agent.name,
      terms: agent.terms === 'special' ? agent.specialType : 'standard',
      status: agent.status,
      introduced: false,
      fixedRate: agent.fixedRate,
      boostedRates: agent.boostedRates,
      quarterDeposits: 0,
      stipendMode: 'forecast',
      quarterManual: 0,
      deals: agent.deals
    };
  }

  function renderAnalytics() {
    elements.scenarioControls.innerHTML = state.scenarios.map(function (scenario) {
      return '<div class="field">'
        + '<label>' + escapeHtml(scenario.name) + '</label>'
        + '<input type="number" min="0" step="5" data-scenario-id="' + scenario.id + '" value="' + Math.round(scenario.coefficient * 100) + '">'
        + '<p class="field-hint">Оборот относительно текущего, %.</p>'
        + '</div>';
    }).join('');
    if (state.view === 'analytics') {
      updateAnalytics();
    }
  }

  function updateAnalytics() {
    var scenarios = calculateScenarios(state);
    var breakEven = calculateBreakEven(state, 1000, 100000000);
    elements.scenarioCards.innerHTML = scenarios.map(renderScenarioCard).join('');
    setText('breakEvenCurrentGross', money(breakEven.currentGross));
    setText('breakEvenTurnover', breakEven.found ? money(breakEven.turnover) : 'Не найдена');

    if (!breakEven.found) {
      setText('breakEvenGap', money(breakEven.shortage));
      elements.breakEvenMessage.className = 'quick-result-message negative';
      elements.breakEvenMessage.textContent = 'Точка безубыточности не найдена в пределах 100 000 000 ₽ оборота. Проверьте условия выплат и расходы.';
    } else if (breakEven.shortage > 0) {
      setText('breakEvenGap', 'Не хватает ' + money(breakEven.shortage));
      elements.breakEvenMessage.className = 'quick-result-message negative';
      elements.breakEvenMessage.textContent = 'Чтобы офис не был в минусе, нужен оборот не ниже ' + money(breakEven.turnover) + '. До безубыточности не хватает ' + money(breakEven.shortage) + '.';
    } else if (breakEven.reserve > 0) {
      setText('breakEvenGap', 'Запас ' + money(breakEven.reserve));
      elements.breakEvenMessage.className = 'quick-result-message positive';
      elements.breakEvenMessage.textContent = 'Чтобы офис не был в минусе, нужен оборот не ниже ' + money(breakEven.turnover) + '. Запас над безубыточностью ' + money(breakEven.reserve) + '.';
    } else {
      setText('breakEvenGap', '0 ₽');
      elements.breakEvenMessage.className = 'quick-result-message positive';
      elements.breakEvenMessage.textContent = 'Чтобы офис не был в минусе, нужен оборот не ниже ' + money(breakEven.turnover) + '. Текущая модель уже около точки безубыточности или выше неё.';
    }
  }

  function renderScenarioCard(scenario) {
    var verdict = scenarioVerdict(scenario);
    var gapText = scenario.netProfit >= 0
      ? 'Запас над безубыточностью: ' + money(scenario.reserveAboveBreakEven)
      : 'Не хватает до безубыточности: ' + money(scenario.shortageToBreakEven);
    return '<article class="scenario-card">'
      + '<h3>' + escapeHtml(scenario.name) + '</h3>'
      + '<p class="hint">Оборот относительно текущего: ' + Math.round(scenario.coefficient * 100) + '%</p>'
      + '<dl class="metric-list">'
      + '<div><dt>Оборот</dt><dd>' + money(scenario.grossCommission) + '</dd></div>'
      + '<div><dt>Выплаты агентам</dt><dd>' + money(scenario.agentPayouts) + '</dd></div>'
      + '<div><dt>Рефералы</dt><dd>' + money(scenario.referralPayouts) + '</dd></div>'
      + '<div><dt>Роялти</dt><dd>' + money(scenario.royaltyAmount) + '</dd></div>'
      + '<div><dt>Постоянные расходы</dt><dd>' + money(scenario.fixedExpenses) + '</dd></div>'
      + '<div><dt>Текущая мотивация</dt><dd>' + money(scenario.currentMotivation) + '</dd></div>'
      + '<div class="result"><dt>Текущая прибыль / убыток</dt><dd>' + money(scenario.netProfit) + '</dd></div>'
      + '<div><dt>Безопасная прибыль</dt><dd>' + money(scenario.safeProfit) + '</dd></div>'
      + '<div><dt>Рентабельность</dt><dd>' + percent(scenario.profitability) + '</dd></div>'
      + '<div><dt>Безубыточность</dt><dd>' + gapText + '</dd></div>'
      + '</dl>'
      + '<div class="scenario-verdict ' + verdict.type + '">' + verdict.text + '</div>'
      + '</article>';
  }

  function scenarioVerdict(scenario) {
    if (scenario.netProfit > 0.5) {
      if (scenario.id === 'realistic') {
        return { type: 'positive', text: 'Реалистичный сценарий выше точки безубыточности. Офис в плюсе на ' + money(scenario.netProfit) + '.' };
      }
      return { type: 'positive', text: 'Офис в плюсе на ' + money(scenario.netProfit) + '.' };
    }
    if (scenario.netProfit < -0.5) {
      if (scenario.id === 'optimistic') {
        return { type: 'negative', text: 'Даже оптимистичный сценарий не выводит офис в плюс. Минус ' + money(Math.abs(scenario.netProfit)) + '.' };
      }
      return { type: 'negative', text: 'Офис в минусе на ' + money(Math.abs(scenario.netProfit)) + '.' };
    }
    return { type: 'neutral', text: 'Офис около нуля.' };
  }

  function render() {
    elements.yearInput.value = state.year;
    renderMonthOptions();
    elements.currentMotivation.value = state.currentMotivation;
    elements.manualReserve.value = state.manualReserve;
    elements.stipendReserveMode.value = state.stipendReserveMode;
    elements.quickView.classList.toggle('hidden', state.view !== 'quick');
    elements.cardsView.classList.toggle('hidden', state.view !== 'cards');
    elements.tableView.classList.toggle('hidden', state.view !== 'table');
    elements.analyticsView.classList.toggle('hidden', state.view !== 'analytics');
    elements.detailedPeriodPanel.classList.toggle('hidden', state.view === 'quick' || state.view === 'analytics');
    elements.detailedActionRow.classList.toggle('hidden', state.view === 'quick' || state.view === 'analytics');
    elements.detailedSummaryLayout.classList.toggle('hidden', state.view === 'quick' || state.view === 'analytics');
    document.querySelectorAll('.mode-button').forEach(function (button) {
      button.classList.toggle('active', button.dataset.view === state.view);
    });
    elements.tabDescription.textContent = TAB_DESCRIPTIONS[state.view] || '';
    renderQuickCheck();
    renderAnalytics();
    renderAgentCards();
    renderTable();
    renderExpenses();
    updateSummaries();
  }

  function updateQuickSummaries() {
    var quick = calculateQuickCheck(state.quickCheck);
    setText('quickTotalGross', money(quick.periodGross));
    setText('quickAgentPayouts', money(quick.agentPayouts));
    setText('quickRoyaltyAmount', money(quick.royalty.amount));
    setText('quickExpensesTotal', money(quick.periodExpenses));
    setText('quickProfitability', percent(quick.profitability));
    setText('quickResult', money(quick.result));

    quick.agentResults.forEach(function (result) {
      setAll('[data-quick-agent-calc="gross"][data-quick-agent-id="' + result.id + '"]', money(result.gross));
      setAll('[data-quick-agent-calc="payout"][data-quick-agent-id="' + result.id + '"]', money(result.payout));
      setAll('[data-quick-agent-calc="count"][data-quick-agent-id="' + result.id + '"]', result.dealCount);
      result.deals.forEach(function (deal) {
        setAll('[data-quick-deal-calc="rate"][data-quick-agent-id="' + result.id + '"][data-quick-deal-id="' + deal.id + '"]', percent(deal.rate));
        setAll('[data-quick-deal-calc="payout"][data-quick-agent-id="' + result.id + '"][data-quick-deal-id="' + deal.id + '"]', money(deal.payout));
      });
    });

    var message = 'Офис около нуля';
    var messageClass = 'neutral';
    if (quick.result > 0.5) {
      message = 'Офис в плюсе на ' + money(quick.result);
      messageClass = 'positive';
    } else if (quick.result < -0.5) {
      message = 'Офис в минусе на ' + money(Math.abs(quick.result));
      messageClass = 'negative';
    }
    elements.quickResultMessage.textContent = message;
    elements.quickResultMessage.className = 'quick-result-message ' + messageClass;
    elements.quickResultBox.className = 'result ' + (quick.result >= 0 ? 'safe' : '');
    renderQuickRoyaltyDetails(quick);
  }

  function renderQuickRoyaltyDetails(quick) {
    var details = [];
    if (quick.royalty.mode === 'monthly') {
      details = quick.royalty.monthDetails.map(function (month) {
        return 'Месяц ' + (month.index + 1) + ': ' + money(month.gross) + ' × ' + percent(month.rate) + ' = ' + money(month.amount);
      });
    } else if (quick.royalty.mode === 'average') {
      details = [
        'Среднемесячный оборот: ' + money(quick.royalty.averageMonthlyGross),
        'Ставка по среднемесячному обороту: ' + percent(quick.royalty.rate),
        'Роялти за период: ' + money(quick.periodGross) + ' × ' + percent(quick.royalty.rate)
      ];
    } else {
      details = [
        'Ставка роялти за месяц: ' + percent(quick.royalty.rate)
      ];
    }
    elements.quickRoyaltyDetails.innerHTML = details.map(function (detail) {
      return '<div>' + escapeHtml(detail) + '</div>';
    }).join('');
  }

  function updateSummaries() {
    var totals = calculateOfficeTotals(state);
    setText('grossCommission', money(totals.grossCommission));
    setText('royaltyRate', percent(totals.royaltyRate));
    setText('royaltyAmount', money(totals.royaltyAmount));
    setText('referralPayouts', money(totals.referralPayouts));
    setText('autoExpenses', money(totals.autoExpenses));
    setText('fixedExpensesTotal', money(totals.fixedExpenses));
    setText('totalGross', money(totals.grossCommission));
    setText('totalAgentPayouts', money(totals.agentPayouts));
    setText('totalReferrals', money(totals.referralPayouts));
    setText('totalRoyalty', money(totals.royaltyAmount));
    setText('totalFixedExpenses', money(totals.fixedExpenses));
    setText('totalCurrentMotivation', money(totals.currentMotivation));
    setText('netProfit', money(totals.netProfit));
    setText('futureStipendsMonth', money(totals.futureStipendsMonth));
    setText('futureStipendsQuarter', money(totals.futureStipendsQuarter));
    setText('selectedStipendReserve', money(totals.selectedFutureStipendReserve));
    setText('totalManualReserve', money(totals.manualReserve));
    setText('safeProfit', money(totals.safeProfit));

    state.expenses.forEach(function (expense) {
      setAll('[data-expense-monthly="' + expense.id + '"]', money(normalizeExpenseToMonth(expense)));
    });

    totals.agentResults.forEach(function (result) {
      var agent = findAgent(result.id);
      var royaltyShare = result.gross * totals.royaltyRate;
      setAgentCalc(agent.id, 'gross', money(result.gross));
      setAgentCalc(agent.id, 'payout', money(result.payout));
      setAgentCalc(agent.id, 'referral', money(result.referral));
      setAgentCalc(agent.id, 'office', money(result.officeBeforeRoyalty));
      setAgentCalc(agent.id, 'quarter', result.stipend.enabled ? money(result.stipend.quarterResult) : 'Не считается');
      setAgentCalc(agent.id, 'level', result.stipend.enabled ? (result.stipend.level ? 'Уровень ' + result.stipend.level : 'Нет уровня') : 'Отключено');
      setAgentCalc(agent.id, 'stipendMonth', result.stipend.enabled ? money(result.stipend.monthly) : '0 ₽');
      setAgentCalc(agent.id, 'stipendQuarter', result.stipend.enabled ? money(result.stipend.quarter) : '0 ₽');
      setTableCalc(agent.id, 'status', statusLabel(agent));
      setTableCalc(agent.id, 'dealCount', result.dealCount);
      setTableCalc(agent.id, 'gross', money(result.gross));
      setTableCalc(agent.id, 'payout', money(result.payout));
      setTableCalc(agent.id, 'referral', money(result.referral));
      setTableCalc(agent.id, 'royaltyShare', money(royaltyShare));
      setTableCalc(agent.id, 'officeRest', money(result.officeBeforeRoyalty - royaltyShare));
      setTableCalc(agent.id, 'stipendMonth', result.stipend.enabled ? money(result.stipend.monthly) : 'Отключено');
      updateDepositNotice(agent, result);

      result.deals.forEach(function (deal) {
        setAll('[data-deal-calc="rate"][data-agent-id="' + agent.id + '"][data-deal-id="' + deal.id + '"]', percent(deal.rate));
        setAll('[data-deal-calc="payout"][data-agent-id="' + agent.id + '"][data-deal-id="' + deal.id + '"]', money(deal.payout));
      });
    });

    elements.netProfit.className = totals.netProfit >= 0 ? 'is-plus' : 'is-minus';
    elements.safeProfit.className = totals.safeProfit >= 0 ? 'is-plus' : 'is-minus';
    updateMainResultMessage(totals.netProfit);
    if (state.view === 'analytics') {
      updateAnalytics();
    }
  }

  function updateMainResultMessage(netProfit) {
    var message = 'Офис около нуля';
    var status = 'neutral';
    if (netProfit > 0.5) {
      message = 'Офис в плюсе на ' + money(netProfit);
      status = 'positive';
    } else if (netProfit < -0.5) {
      message = 'Офис в минусе на ' + money(Math.abs(netProfit));
      status = 'negative';
    }
    elements.mainResultMessage.textContent = message;
    elements.mainResultMessage.className = 'main-result-banner ' + status;
  }

  function setText(id, value) {
    if (elements[id]) {
      elements[id].textContent = value;
    }
  }

  function setAll(selector, value) {
    document.querySelectorAll(selector).forEach(function (node) {
      node.textContent = value;
    });
  }

  function setAgentCalc(agentId, key, value) {
    setAll('[data-agent-calc="' + key + '"][data-agent-id="' + agentId + '"]', value);
  }

  function setTableCalc(agentId, key, value) {
    setAll('[data-table-calc="' + key + '"][data-agent-id="' + agentId + '"]', value);
  }

  function updateDepositNotice(agent, result) {
    document.querySelectorAll('[data-agent-deposit="' + agent.id + '"]').forEach(function (node) {
      node.classList.toggle('positive', result.depositBonusAvailable);
      node.classList.toggle('negative', !result.depositBonusAvailable);
      node.textContent = result.depositBonusAvailable
        ? 'Партнёрские бонусы доступны: задатки за квартал от 250 000 ₽.'
        : 'Партнёрские бонусы недоступны: задатки за квартал ниже 250 000 ₽.';
    });
  }

  function updateAgentField(input) {
    var agent = findAgent(input.dataset.agentId);
    var field = input.dataset.agentField;
    if (!agent || !field) {
      return false;
    }
    var oldTerms = agent.terms;
    var value = input.value;

    if (field === 'introduced') {
      agent[field] = value === 'true';
    } else if (['fixedRate', 'quarterDeposits', 'quarterManual'].indexOf(field) >= 0) {
      agent[field] = numberValue(value);
    } else {
      agent[field] = value;
    }

    return input.dataset.structural === 'true' || (field === 'stipendMode') || (field === 'terms' && oldTerms !== agent.terms);
  }

  function updateDealField(input) {
    var agent = findAgent(input.dataset.agentId);
    var deal = agent ? findDeal(agent, input.dataset.dealId) : null;
    if (!deal) {
      return;
    }
    deal[input.dataset.dealField] = numberValue(input.value);
  }

  function updateRateField(input) {
    var agent = findAgent(input.dataset.agentId);
    if (!agent) {
      return;
    }
    agent.boostedRates[Number(input.dataset.rateIndex)] = numberValue(input.value);
  }

  function updateExpenseField(input) {
    var expense = state.expenses.find(function (item) {
      return item.id === input.dataset.expenseId;
    });
    if (!expense) {
      return;
    }
    expense[input.dataset.expenseField] = input.dataset.expenseField === 'amount'
      ? numberValue(input.value)
      : input.value;
  }

  function updateQuickField(input) {
    var field = input.dataset.quickField;
    if (!field) {
      return false;
    }
    state.quickCheck[field] = field === 'period' || field === 'royaltyMode'
      ? input.value
      : numberValue(input.value);
    return field === 'period' || field === 'royaltyMode';
  }

  function updateQuickAgentField(input) {
    var agent = findQuickAgent(input.dataset.quickAgentId);
    var field = input.dataset.quickAgentField;
    if (!agent || !field) {
      return false;
    }
    if (field === 'fixedRate') {
      agent[field] = numberValue(input.value);
    } else {
      agent[field] = input.value;
    }
    return input.dataset.quickStructural === 'true';
  }

  function updateQuickDealField(input) {
    var agent = findQuickAgent(input.dataset.quickAgentId);
    var deal = agent ? findQuickDeal(agent, input.dataset.quickDealId) : null;
    if (!deal) {
      return;
    }
    deal[input.dataset.quickDealField] = numberValue(input.value);
  }

  function updateQuickRateField(input) {
    var agent = findQuickAgent(input.dataset.quickAgentId);
    if (!agent) {
      return;
    }
    agent.boostedRates[Number(input.dataset.quickRateIndex)] = numberValue(input.value);
  }

  function updateQuickMonthField(input) {
    state.quickCheck.monthTurnovers[Number(input.dataset.quickMonthIndex)] = numberValue(input.value);
  }

  function updateScenarioField(input) {
    var scenario = state.scenarios.find(function (item) {
      return item.id === input.dataset.scenarioId;
    });
    if (!scenario) {
      return;
    }
    scenario.coefficient = numberValue(input.value) / 100;
  }

  function onInput(event) {
    var target = event.target;
    if (target.dataset.scenarioId) {
      updateScenarioField(target);
      updateAnalytics();
      return;
    }
    if (target.dataset.quickField) {
      var quickStructural = updateQuickField(target);
      if (quickStructural) {
        if (state.quickCheck.period === 'month') {
          state.quickCheck.royaltyMode = 'monthly';
        }
        ensureQuickMonthTurnovers();
        render();
      } else {
        updateQuickSummaries();
      }
      return;
    }
    if (target.dataset.quickAgentField) {
      var quickAgentStructural = updateQuickAgentField(target);
      if (quickAgentStructural) {
        render();
      } else {
        updateQuickSummaries();
      }
      return;
    }
    if (target.dataset.quickDealField) {
      updateQuickDealField(target);
      updateQuickSummaries();
      return;
    }
    if (target.dataset.quickRateIndex !== undefined) {
      updateQuickRateField(target);
      updateQuickSummaries();
      return;
    }
    if (target.dataset.quickMonthIndex !== undefined) {
      updateQuickMonthField(target);
      updateQuickSummaries();
      return;
    }
    if (target.dataset.agentField) {
      var structural = updateAgentField(target);
      if (structural) {
        render();
      } else {
        updateSummaries();
      }
      return;
    }
    if (target.dataset.dealField) {
      updateDealField(target);
      updateSummaries();
      return;
    }
    if (target.dataset.rateIndex !== undefined) {
      updateRateField(target);
      updateSummaries();
      return;
    }
    if (target.dataset.expenseField) {
      updateExpenseField(target);
      updateSummaries();
    }
  }

  function onClick(event) {
    var target = event.target.closest('[data-action]');
    if (!target) {
      return;
    }
    var quickAgent = findQuickAgent(target.dataset.quickAgentId);
    if (target.dataset.action === 'quick-add-agent') {
      state.quickCheck.agents.push(createQuickAgent());
      render();
      return;
    }
    if (target.dataset.action === 'quick-add-deal' && quickAgent) {
      quickAgent.deals.push({ id: nextId('quickDeal'), commission: 0 });
      render();
      return;
    }
    if (target.dataset.action === 'quick-remove-deal' && quickAgent) {
      quickAgent.deals = quickAgent.deals.filter(function (deal) {
        return deal.id !== target.dataset.quickDealId;
      });
      render();
      return;
    }
    if (target.dataset.action === 'quick-remove-agent') {
      state.quickCheck.agents = state.quickCheck.agents.filter(function (agent) {
        return agent.id !== target.dataset.quickAgentId;
      });
      if (!state.quickCheck.agents.length) {
        state.quickCheck.agents.push(createQuickAgent());
      }
      render();
      return;
    }
    var agent = findAgent(target.dataset.agentId);
    if (target.dataset.action === 'add-deal' && agent) {
      agent.deals.push({ id: nextId('deal'), commission: 0 });
      render();
    }
    if (target.dataset.action === 'remove-deal' && agent) {
      agent.deals = agent.deals.filter(function (deal) {
        return deal.id !== target.dataset.dealId;
      });
      render();
    }
    if (target.dataset.action === 'remove-agent') {
      state.agents = state.agents.filter(function (item) {
        return item.id !== target.dataset.agentId;
      });
      if (!state.agents.length) {
        state.agents.push(createBlankAgent());
      }
      render();
    }
    if (target.dataset.action === 'toggle-agent' && agent) {
      agent.expanded = !agent.expanded;
      render();
    }
  }

  function showToast(message) {
    elements.toast.textContent = message;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      elements.toast.textContent = '';
    }, 2200);
  }

  function bindEvents() {
    document.body.addEventListener('input', onInput);
    document.body.addEventListener('change', onInput);
    document.body.addEventListener('click', onClick);

    elements.addAgentBtn.addEventListener('click', function () {
      state.agents.push(createBlankAgent());
      render();
    });

    elements.monthSelect.addEventListener('change', function () {
      state.month = Number(elements.monthSelect.value);
    });

    elements.yearInput.addEventListener('input', function () {
      state.year = numberValue(elements.yearInput.value);
    });

    elements.currentMotivation.addEventListener('input', function () {
      state.currentMotivation = numberValue(elements.currentMotivation.value);
      updateSummaries();
    });

    elements.manualReserve.addEventListener('input', function () {
      state.manualReserve = numberValue(elements.manualReserve.value);
      updateSummaries();
    });

    elements.stipendReserveMode.addEventListener('change', function () {
      state.stipendReserveMode = elements.stipendReserveMode.value;
      updateSummaries();
    });

    elements.hintsToggle.addEventListener('change', function () {
      document.body.classList.toggle('hints-hidden', !elements.hintsToggle.checked);
    });

    elements.restoreDemoBtn.addEventListener('click', function () {
      state = createInitialState(true);
      window.domianCalculatorState = state;
      render();
      showToast('Пример заполнения восстановлен');
    });

    elements.clearBtn.addEventListener('click', function () {
      if (!window.confirm('Очистить все введённые данные? Это действие нельзя отменить.')) {
        return;
      }
      state = createInitialState(false);
      state.expenses.forEach(function (expense) {
        expense.amount = 0;
      });
      state.quickCheck.monthGross = 0;
      state.quickCheck.monthTurnovers = [0];
      state.quickCheck.agents = [createQuickAgent()];
      state.scenarios = createDefaultScenarios();
      window.domianCalculatorState = state;
      render();
      showToast('Данные очищены');
    });

    document.querySelectorAll('.mode-button').forEach(function (button) {
      button.addEventListener('click', function () {
        state.view = button.dataset.view;
        render();
      });
    });
  }

  function collectElements() {
    [
      'monthSelect',
      'yearInput',
      'hintsToggle',
      'tabDescription',
      'detailedPeriodPanel',
      'detailedActionRow',
      'detailedSummaryLayout',
      'quickView',
      'quickPeriod',
      'quickRoyaltyMode',
      'quickRoyaltyModeWrap',
      'quickTurnoverHint',
      'quickTurnoverFields',
      'quickAgents',
      'quickPeriodExpenses',
      'quickTotalGross',
      'quickAgentPayouts',
      'quickRoyaltyAmount',
      'quickExpensesTotal',
      'quickProfitability',
      'quickResultBox',
      'quickResult',
      'quickResultMessage',
      'quickRoyaltyDetails',
      'analyticsView',
      'scenarioControls',
      'scenarioCards',
      'breakEvenCurrentGross',
      'breakEvenTurnover',
      'breakEvenGap',
      'breakEvenMessage',
      'cardsView',
      'tableView',
      'agentCards',
      'agentTableBody',
      'expensesBody',
      'grossCommission',
      'royaltyRate',
      'royaltyAmount',
      'referralPayouts',
      'autoExpenses',
      'fixedExpensesTotal',
      'currentMotivation',
      'manualReserve',
      'stipendReserveMode',
      'totalGross',
      'totalAgentPayouts',
      'totalReferrals',
      'totalRoyalty',
      'totalFixedExpenses',
      'totalCurrentMotivation',
      'netProfit',
      'mainResultMessage',
      'futureStipendsMonth',
      'futureStipendsQuarter',
      'selectedStipendReserve',
      'totalManualReserve',
      'safeProfit',
      'restoreDemoBtn',
      'clearBtn',
      'addAgentBtn',
      'toast'
    ].forEach(function (id) {
      elements[id] = document.getElementById(id);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    collectElements();
    state = createInitialState(true);
    bindEvents();
    render();
    window.domianCalculatorState = state;
  });
}());
