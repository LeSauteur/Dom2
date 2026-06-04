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
      paymentType: 'standard',
      status: 'partner',
      boostedRates: clone(PAY_SCALES.boostedDefault),
      fixedRate: PAY_SCALES.fixedDefault,
      introduced: false,
      motivation: createMotivation()
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

  function findAgent(agentId) {
    return state.agents.find(function (agent) {
      return agent.id === agentId;
    });
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

    return '<details class="motivation-box">'
      + '<summary>Мотивации и резервы агента</summary>'
      + '<p class="hint">Здесь можно добавить будущие расходы на удержание агента: стипендию, поездки, корпоративы и конгресс. Если не уверены — оставьте выключенным.</p>'
      + '<div class="form-grid compact-grid">'
      + '<label class="field wide-field"><span>Как учитывать стипендию?</span><select data-agent-id="' + agent.id + '" data-motivation-field="stipendMode">'
      + option('off', 'Не считать', motivation.stipendMode)
      + option('auto', 'Посчитать по кварталу', motivation.stipendMode)
      + option('manual', 'Ввести сумму вручную', motivation.stipendMode)
      + '</select><small>Стипендия — это будущая ежемесячная нагрузка по результатам квартала.</small></label>'
      + '<label class="field"><span>Результат агента за квартал, ₽</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-motivation-field="quarterlyResult" value="' + motivation.quarterlyResult + '"><small>Если оставить 0, берём комиссию агента за месяц × 3.</small></label>'
      + '<label class="field"><span>Стипендия вручную, ₽ в месяц</span><input type="number" min="0" step="500" data-agent-id="' + agent.id + '" data-motivation-field="manualStipendMonthly" value="' + motivation.manualStipendMonthly + '"></label>'
      + '<label class="check-field"><input type="checkbox" data-agent-id="' + agent.id + '" data-motivation-flag="mountainSeaEnabled"' + checked(motivation.mountainSeaEnabled) + '> Горы/Море</label>'
      + '<label class="field"><span>Горы/Море, ₽ за поездку</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-motivation-field="mountainSeaPerTrip" value="' + motivation.mountainSeaPerTrip + '"></label>'
      + '<label class="field"><span>Поездок в год</span><input type="number" min="0" step="1" data-agent-id="' + agent.id + '" data-motivation-field="mountainSeaTripsPerYear" value="' + motivation.mountainSeaTripsPerYear + '"></label>'
      + '<label class="check-field"><input type="checkbox" data-agent-id="' + agent.id + '" data-motivation-flag="travelEnabled"' + checked(motivation.travelEnabled) + '> Путешествие</label>'
      + '<label class="field"><span>Путешествие, ₽ в год</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-motivation-field="travelPerYear" value="' + motivation.travelPerYear + '"></label>'
      + '<label class="check-field"><input type="checkbox" data-agent-id="' + agent.id + '" data-motivation-flag="corporateEnabled"' + checked(motivation.corporateEnabled) + '> Корпоративы</label>'
      + '<label class="field"><span>Корпоративы, ₽ в год</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-motivation-field="corporatePerYear" value="' + motivation.corporatePerYear + '"></label>'
      + '<label class="check-field"><input type="checkbox" data-agent-id="' + agent.id + '" data-motivation-flag="congressEnabled"' + checked(motivation.congressEnabled) + '> Конгресс</label>'
      + '<label class="field"><span>Конгресс, ₽ в год</span><input type="number" min="0" step="500" data-agent-id="' + agent.id + '" data-motivation-field="congressPerYear" value="' + motivation.congressPerYear + '"></label>'
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
        + '<label class="field"><span>Имя</span><input type="text" data-agent-id="' + agent.id + '" data-agent-field="name" value="' + escapeHtml(agent.name) + '"></label>'
        + '<label class="field"><span>Сколько агент принёс комиссии</span><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="commission" value="' + agent.commission + '"><small>Это вся комиссия за месяц.</small></label>'
        + '<label class="field"><span>Количество сделок</span><input type="number" min="1" step="1" data-agent-id="' + agent.id + '" data-agent-field="dealCount" value="' + agent.dealCount + '"><small>Если точных сделок нет, укажите примерное количество.</small></label>'
        + '<label class="field"><span>Тип расчёта выплаты</span><select data-agent-id="' + agent.id + '" data-agent-field="paymentType" data-structural="true">'
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
    renderSchemeChecker(totals);
    renderWarnings(totals);
  }

  function updateAgentSummaries() {
    calculateOffice(state).agents.forEach(function (agent) {
      [
        ['payout', agent.payout],
        ['referral', agent.referral],
        ['motivation', agent.motivationReserve],
        ['office', agent.officeBeforeRoyaltyAndReserve]
      ].forEach(function (item) {
        var node = document.querySelector('[data-agent-summary="' + item[0] + '"][data-agent-id="' + agent.id + '"]');
        if (node) {
          node.textContent = money(item[1]);
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

    if (field === 'commission' || field === 'fixedRate') {
      agent[field] = positiveNumber(target.value);
    } else if (field === 'dealCount') {
      agent[field] = Math.max(1, Math.floor(positiveNumber(target.value)));
    } else if (field === 'introduced') {
      agent[field] = target.value === 'true';
    } else {
      agent[field] = target.value;
    }

    if (target.dataset.structural === 'true') {
      render();
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

    if (target.dataset.motivationField === 'stipendMode') {
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

  function onClick(event) {
    var target = event.target.closest('[data-action]');
    if (!target) {
      return;
    }

    if (target.dataset.action === 'remove-agent') {
      state.agents = state.agents.filter(function (agent) {
        return agent.id !== target.dataset.agentId;
      });
      if (!state.agents.length) {
        state.agents.push(createAgent());
      }
      render();
    }

    if (target.dataset.action === 'add-expense') {
      state.expenses.push({
        id: nextExpenseId(),
        name: 'Новый расход',
        amount: 0
      });
      render();
    }

    if (target.dataset.action === 'remove-expense') {
      state.expenses = state.expenses.filter(function (expense) {
        return expense.id !== target.dataset.expenseId;
      });
      render();
    }
  }

  function collectElements() {
    [
      'expensesList',
      'agentsList',
      'addAgentBtn',
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
      'schemeCommission',
      'schemeDealCount',
      'schemeIntroduced',
      'schemeExpenseShareMode',
      'schemeManualExpenseShare',
      'schemeMotivationReserve',
      'schemeManualRate',
      'schemeExpenseShare',
      'schemeResults'
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
      render();
    });
    render();
    window.domianA4State = state;
  });
}());
