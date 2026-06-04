(function () {
  'use strict';

  var state = null;
  var idCounter = 1;
  var elements = {};

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nextId() {
    idCounter += 1;
    return 'agent-' + idCounter;
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
      introduced: false
    };
  }

  function createState() {
    return {
      expenses: clone(DEFAULT_EXPENSES),
      agents: clone(DEFAULT_AGENTS),
      ownerSales: 150000
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
    return '<option value="' + value + '"' + (value === current ? ' selected' : '') + '>' + label + '</option>';
  }

  function findAgent(agentId) {
    return state.agents.find(function (agent) {
      return agent.id === agentId;
    });
  }

  function renderExpenses() {
    elements.expensesList.innerHTML = state.expenses.map(function (expense) {
      return '<label class="field expense-row">'
        + '<span>' + escapeHtml(expense.name) + '</span>'
        + '<input type="number" min="0" step="1000" data-expense-id="' + expense.id + '" value="' + expense.amount + '">'
        + '</label>';
    }).join('');
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
        + '<dl class="agent-summary">'
        + '<div><dt>Выплата агенту</dt><dd data-agent-summary="payout" data-agent-id="' + agent.id + '">' + money(result.payout) + '</dd></div>'
        + '<div><dt>Реферал</dt><dd data-agent-summary="referral" data-agent-id="' + agent.id + '">' + money(result.referral) + '</dd></div>'
        + '<div><dt>До роялти</dt><dd data-agent-summary="office" data-agent-id="' + agent.id + '">' + money(result.officeBeforeRoyalty) + '</dd></div>'
        + '</dl>'
        + '</article>';
    }).join('');
  }

  function setText(id, value) {
    elements[id].textContent = value;
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

  function renderTotals() {
    var totals = calculateOffice(state);
    setText('agentTurnover', money(totals.agentTurnover));
    setText('ownerSales', money(totals.ownerSales));
    setText('totalTurnover', money(totals.totalTurnover));
    setText('agentPayouts', money(totals.agentPayouts));
    setText('referrals', money(totals.referrals));
    setText('royalty', money(totals.royaltyWithOwner));
    setText('officeExpenses', money(totals.expenses));
    setText('resultWithoutOwner', money(totals.resultWithoutOwner));
    setText('resultWithOwner', money(totals.resultWithOwner));

    var status = resultClass(totals.resultWithOwner);
    var message = 'Офис около нуля.';
    if (status === 'positive') {
      message = 'Офис в плюсе на ' + money(totals.resultWithOwner) + '.';
    } else if (status === 'negative') {
      message = 'Офис в минусе на ' + money(Math.abs(totals.resultWithOwner)) + '.';
    }
    elements.resultStatus.textContent = message;
    elements.resultStatus.className = 'result-status ' + status;

    renderWarnings(totals);
  }

  function updateAgentSummaries() {
    calculateOffice(state).agents.forEach(function (agent) {
      [
        ['payout', agent.payout],
        ['referral', agent.referral],
        ['office', agent.officeBeforeRoyalty]
      ].forEach(function (item) {
        var node = document.querySelector('[data-agent-summary="' + item[0] + '"][data-agent-id="' + agent.id + '"]');
        if (node) {
          node.textContent = money(item[1]);
        }
      });
    });
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
        text: 'Офис в минусе. Проверьте расходы, выплаты агентам и общий оборот.'
      });
    }

    warnings.push({
      type: 'info',
      text: 'Роялти рассчитано автоматически от общего оборота: ' + money(totals.totalTurnover) + ' × ' + percent(getRoyaltyRate(totals.totalTurnover)) + '.'
    });

    if (!warnings.length) {
      warnings.push({ type: 'info', text: 'Критичных предупреждений сейчас нет.' });
    }

    elements.warningsList.innerHTML = warnings.map(function (warning) {
      return '<div class="notice ' + warning.type + '">' + escapeHtml(warning.text) + '</div>';
    }).join('');
  }

  function render() {
    renderExpenses();
    renderAgents();
    elements.ownerSalesInput.value = state.ownerSales;
    renderTotals();
  }

  function updateTotalsOnly() {
    updateAgentSummaries();
    renderTotals();
  }

  function onInput(event) {
    var target = event.target;

    if (target.dataset.expenseId) {
      var expense = state.expenses.find(function (item) { return item.id === target.dataset.expenseId; });
      if (expense) {
        expense.amount = positiveNumber(target.value);
        renderTotals();
      }
      return;
    }

    if (target.id === 'ownerSalesInput') {
      state.ownerSales = positiveNumber(target.value);
      renderTotals();
      return;
    }

    if (target.dataset.agentField) {
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
      'royalty',
      'officeExpenses',
      'resultWithoutOwner',
      'resultWithOwner',
      'warningsList'
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
