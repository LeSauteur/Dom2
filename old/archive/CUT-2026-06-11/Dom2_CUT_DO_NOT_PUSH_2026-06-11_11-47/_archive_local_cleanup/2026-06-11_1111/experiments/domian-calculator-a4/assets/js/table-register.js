(function () {
  'use strict';

  var SNAPSHOT_KEY = 'domianA4TableSnapshot';
  var agentCounter = 0;
  var expenseCounter = 0;
  var state;
  var isComposing = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nextAgentId() {
    agentCounter += 1;
    return 'register-agent-' + agentCounter;
  }

  function nextExpenseId() {
    expenseCounter += 1;
    return 'register-expense-' + expenseCounter;
  }

  function normalizeInputNumber(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[\s\u00a0\u202f]+/g, '')
      .replace(',', '.');
  }

  function parseMoney(value) {
    var normalized = normalizeInputNumber(value);
    if (normalized === '' || normalized === '-') {
      return 0;
    }
    var parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function formatInputMoney(value) {
    var amount = parseMoney(value);
    return amount ? String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '';
  }

  function moneySafe(value) {
    return typeof window.money === 'function'
      ? window.money(value)
      : Math.round(parseMoney(value)).toLocaleString('ru-RU') + ' ₽';
  }

  function percentSafe(value) {
    return Math.round((parseMoney(value) || 0) * 100) + '%';
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
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

  function createMotivation() {
    return clone(window.DEFAULT_MOTIVATION || {});
  }

  function createAgent(name) {
    return {
      id: nextAgentId(),
      name: name || '',
      commission: 0,
      dealCount: 1,
      commissionMode: 'exact',
      dealsInput: [''],
      paymentType: 'standard',
      status: 'partner',
      boostedRates: clone((window.PAY_SCALES && window.PAY_SCALES.boostedDefault) || [55, 55, 55, 60]),
      fixedRate: (window.PAY_SCALES && window.PAY_SCALES.fixedDefault) || 80,
      introduced: false,
      partnerConfirmed: true,
      quarterlyCommission: 0,
      quarterlyDeposits: 0,
      halfYearCommission: 0,
      preTripQuarterDeposits: 0,
      motivation: createMotivation()
    };
  }

  function createExpense(name) {
    return { id: nextExpenseId(), name: name || 'Расход', amount: 0 };
  }

  function createState() {
    return {
      expenses: [
        createExpense('Аренда'),
        createExpense('Зарплаты / администратор'),
        createExpense('Реклама'),
        createExpense('Связь / сервисы'),
        createExpense('Хозяйственные расходы'),
        createExpense('Прочее')
      ],
      ownerSales: 0,
      agents: [createAgent('')]
    };
  }

  function normalizeAgent(source) {
    var agent = createAgent(source && source.name ? source.name : '');
    source = source || {};
    agent.id = source.id || agent.id;
    agent.name = source.name || '';
    agent.commissionMode = source.commissionMode === 'quick' ? 'quick' : 'exact';
    agent.dealsInput = Array.isArray(source.dealsInput) && source.dealsInput.length
      ? source.dealsInput.map(function (deal) { return parseMoney(deal); })
      : [''];
    agent.commission = parseMoney(source.commission);
    agent.dealCount = Math.max(1, parseInt(source.dealCount, 10) || agent.dealsInput.length || 1);
    agent.paymentType = source.paymentType || 'standard';
    agent.status = source.status === 'trainee' ? 'trainee' : 'partner';
    agent.boostedRates = Array.isArray(source.boostedRates) ? source.boostedRates.slice() : agent.boostedRates;
    agent.fixedRate = source.fixedRate === 0 ? 0 : parseMoney(source.fixedRate || agent.fixedRate);
    agent.introduced = Boolean(source.introduced);
    agent.partnerConfirmed = source.partnerConfirmed !== false;
    agent.quarterlyCommission = parseMoney(source.quarterlyCommission);
    agent.quarterlyDeposits = parseMoney(source.quarterlyDeposits);
    agent.halfYearCommission = parseMoney(source.halfYearCommission);
    agent.preTripQuarterDeposits = parseMoney(source.preTripQuarterDeposits);
    agent.motivation = Object.assign(createMotivation(), source.motivation || {});
    return agent;
  }

  function isAgentActive(agent) {
    return Boolean(String(agent.name || '').trim())
      || parseMoney(agent.commission) > 0
      || (Array.isArray(agent.dealsInput) && agent.dealsInput.some(function (deal) { return parseMoney(deal) > 0; }));
  }

  function normalizeActiveAgents(agents) {
    var starTaken = false;
    return (agents || []).filter(isAgentActive).map(function (agent) {
      var normalized = normalizeAgent(agent);
      if (normalized.commissionMode === 'exact') {
        normalized.commission = normalized.dealsInput.reduce(function (sum, deal) { return sum + parseMoney(deal); }, 0);
        normalized.dealCount = Math.max(1, normalized.dealsInput.filter(function (deal) { return parseMoney(deal) > 0; }).length || normalized.dealsInput.length || 1);
      }
      normalized.motivation = Object.assign(createMotivation(), normalized.motivation || {});
      if (!normalized.motivation.congressPerYear) {
        normalized.motivation.congressPerYear = 3500;
      }
      if (normalized.motivation.congressEnabled === undefined) {
        normalized.motivation.congressEnabled = true;
      }
      if (normalized.motivation.starEnabled && starTaken) {
        normalized.motivation.starEnabled = false;
      }
      if (normalized.motivation.starEnabled) {
        starTaken = true;
      }
      return normalized;
    });
  }

  function currentOfficeState() {
    return {
      expenses: state.expenses.map(function (expense) {
        return { id: expense.id, name: expense.name, amount: parseMoney(expense.amount) };
      }),
      ownerSales: parseMoney(state.ownerSales),
      agents: normalizeActiveAgents(state.agents)
    };
  }

  function calculate() {
    return window.calculateOffice(currentOfficeState());
  }

  function getAgent(id) {
    return state.agents.find(function (agent) { return agent.id === id; });
  }

  function getExpense(id) {
    return state.expenses.find(function (expense) { return expense.id === id; });
  }

  function agentResult(agent) {
    return window.calculateAgent(normalizeAgent(agent));
  }

  function getAgentContribution(agent, officeResult) {
    var found = (officeResult.agentEconomics || []).find(function (item) { return item.id === agent.id; });
    return found || null;
  }

  function renderExpenses() {
    var list = document.getElementById('expensesList');
    if (!list) return;
    list.innerHTML = state.expenses.map(function (expense) {
      return '<div class="expense-row" data-expense-id="' + expense.id + '">'
        + '<input type="text" data-expense-field="name" data-expense-id="' + expense.id + '" value="' + escapeHtml(expense.name) + '" placeholder="Название расхода">'
        + '<input class="money-cell" type="text" inputmode="numeric" autocomplete="off" data-money-input="true" data-expense-field="amount" data-expense-id="' + expense.id + '" value="' + formatInputMoney(expense.amount) + '" placeholder="0">'
        + '<button class="small-button" type="button" data-action="remove-expense" data-expense-id="' + expense.id + '">Удалить</button>'
        + '</div>';
    }).join('');
  }

  function renderDealRows(agent, result) {
    if (agent.commissionMode === 'quick') {
      return '<tr>'
        + '<td colspan="2">Общая комиссия</td>'
        + '<td colspan="2"><input class="money-cell" type="text" inputmode="numeric" autocomplete="off" data-money-input="true" data-agent-field="commission" data-agent-id="' + agent.id + '" value="' + formatInputMoney(agent.commission) + '" placeholder="0"></td>'
        + '<td colspan="2">Количество сделок</td>'
        + '<td><input type="number" min="1" step="1" data-agent-field="dealCount" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.dealCount || 1) + '"></td>'
        + '<td colspan="2" class="inline-note">Быстрый режим делит комиссию поровну между сделками.</td>'
        + '</tr>';
    }

    var rows = agent.dealsInput.length ? agent.dealsInput : [''];
    return rows.map(function (deal, index) {
      var calculatedDeal = result.deals[index] || { rate: window.getDealRate(normalizeAgent(agent), index), payout: 0 };
      return '<tr data-deal-index="' + index + '" data-agent-id="' + agent.id + '">'
        + '<td>' + (index + 1) + '</td>'
        + '<td colspan="2"><input class="money-cell" type="text" inputmode="numeric" autocomplete="off" data-money-input="true" data-deal-index="' + index + '" data-agent-field="deal" data-agent-id="' + agent.id + '" value="' + formatInputMoney(deal) + '" placeholder="0"></td>'
        + '<td><span class="rate-pill" data-output="deal-rate" data-agent-id="' + agent.id + '" data-deal-index="' + index + '">' + percentSafe(calculatedDeal.rate) + '</span></td>'
        + '<td colspan="2"><strong class="deal-output" data-output="deal-payout" data-agent-id="' + agent.id + '" data-deal-index="' + index + '">' + moneySafe(calculatedDeal.payout) + '</strong></td>'
        + '<td colspan="2"><input type="text" placeholder="Комментарий"></td>'
        + '<td><button class="small-button" type="button" data-action="remove-deal" data-agent-id="' + agent.id + '" data-deal-index="' + index + '"' + (rows.length <= 1 ? ' disabled' : '') + '>×</button></td>'
        + '</tr>';
    }).join('');
  }

  function renderAgent(agent, index, officeResult) {
    var normalized = normalizeAgent(agent);
    var result = window.calculateAgent(normalized);
    var economics = getAgentContribution(agent, officeResult);
    var motivation = Object.assign(createMotivation(), agent.motivation || {});
    var hasOtherStar = state.agents.some(function (other) {
      return other.id !== agent.id && other.motivation && other.motivation.starEnabled;
    });
    var isEmpty = !isAgentActive(agent);
    var contribution = economics ? economics.contributionAfterExpenses : 0;
    var statusText = economics ? economics.status : 'Пусто';

    return '<article class="agent-ledger' + (isEmpty ? ' is-empty' : '') + '" data-agent-id="' + agent.id + '">'
      + '<div class="agent-header">'
      + '<label class="field-mini"><span>Агент</span><input type="text" data-agent-field="name" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.name || '') + '" placeholder="Агент ' + (index + 1) + '"></label>'
      + '<label class="field-mini"><span>Статус</span><select data-agent-field="status" data-agent-id="' + agent.id + '">'
      + option('partner', 'Партнёр', agent.status || 'partner')
      + option('trainee', 'Стажёр', agent.status || 'partner')
      + '</select></label>'
      + '<label class="field-mini"><span>Схема</span><select data-agent-field="paymentType" data-agent-id="' + agent.id + '">'
      + option('standard', 'Стандарт', agent.paymentType || 'standard')
      + option('boosted', 'Повышенная', agent.paymentType || 'standard')
      + option('fixed', 'Фикс', agent.paymentType || 'standard')
      + '</select></label>'
      + '<label class="field-mini"><span>Режим сделок</span><select data-agent-field="commissionMode" data-agent-id="' + agent.id + '">'
      + option('exact', 'Точно', agent.commissionMode || 'exact')
      + option('quick', 'Быстро', agent.commissionMode || 'exact')
      + '</select></label>'
      + '<button class="small-button" type="button" data-action="remove-agent" data-agent-id="' + agent.id + '"' + (state.agents.length <= 1 ? ' disabled' : '') + '>Удалить</button>'
      + '</div>'
      + '<div class="agent-flags">'
      + '<label class="flag"><input type="checkbox" data-agent-field="introduced" data-agent-id="' + agent.id + '"' + checked(agent.introduced) + '> Приведённый агент</label>'
      + '<label class="flag"><input type="checkbox" data-motivation-field="congressEnabled" data-agent-id="' + agent.id + '"' + checked(motivation.congressEnabled !== false) + '> Конгресс включён</label>'
      + '<label class="flag"><span>Конгресс, ₽/год</span><input class="money-cell" type="text" inputmode="numeric" autocomplete="off" data-money-input="true" data-motivation-field="congressPerYear" data-agent-id="' + agent.id + '" value="' + formatInputMoney(motivation.congressPerYear || 3500) + '"></label>'
      + '<label class="flag' + (hasOtherStar ? ' is-disabled' : '') + '"><input type="checkbox" data-motivation-field="starEnabled" data-agent-id="' + agent.id + '"' + checked(motivation.starEnabled) + (hasOtherStar ? ' disabled' : '') + '> Звезда' + (hasOtherStar ? ' уже у другого' : '') + '</label>'
      + '<label class="flag"><span>Звезда, ₽/год</span><input class="money-cell" type="text" inputmode="numeric" autocomplete="off" data-money-input="true" data-motivation-field="starPerYear" data-agent-id="' + agent.id + '" value="' + formatInputMoney(motivation.starPerYear || 5000) + '"></label>'
      + '<label class="flag"><span>Фикс, %</span><input type="number" min="0" step="1" data-agent-field="fixedRate" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.fixedRate) + '"></label>'
      + '<label class="flag"><span>Резерв мотиваций, ₽/мес</span><input class="money-cell" type="text" inputmode="numeric" autocomplete="off" data-money-input="true" data-motivation-field="manualReserveMonthly" data-agent-id="' + agent.id + '" value="' + formatInputMoney(motivation.manualReserveMonthly || 0) + '"></label>'
      + '</div>'
      + '<div class="deals-table-wrap">'
      + '<table class="deals-table">'
      + '<thead><tr><th>№</th><th colspan="2">Сумма сделки</th><th>Процент</th><th colspan="2">Выплата агенту</th><th colspan="2">Комментарий</th><th></th></tr></thead>'
      + '<tbody>' + renderDealRows(agent, result) + '</tbody>'
      + '</table>'
      + '</div>'
      + '<div class="agent-actions">'
      + (agent.commissionMode === 'exact' ? '<button class="small-button" type="button" data-action="add-deal" data-agent-id="' + agent.id + '">+ Сделка</button>' : '')
      + '<span class="inline-note">Точный режим показывает каждую сделку. Быстрый режим нужен только для грубой оценки.</span>'
      + '</div>'
      + '<div class="agent-footer">'
      + '<div><span>Оборот</span><strong data-agent-output="commission" data-agent-id="' + agent.id + '">' + moneySafe(result.commission) + '</strong></div>'
      + '<div><span>Выплата</span><strong data-agent-output="payout" data-agent-id="' + agent.id + '">' + moneySafe(result.payout) + '</strong></div>'
      + '<div><span>Реферал</span><strong data-agent-output="referral" data-agent-id="' + agent.id + '">' + moneySafe(result.referral) + '</strong></div>'
      + '<div><span>Мотивации</span><strong data-agent-output="motivation" data-agent-id="' + agent.id + '">' + moneySafe(result.motivationReserve) + '</strong></div>'
      + '<div><span>Вклад</span><strong class="' + (contribution < 0 ? 'row-danger' : 'row-good') + '" data-agent-output="contribution" data-agent-id="' + agent.id + '">' + (economics ? moneySafe(contribution) : '—') + '</strong></div>'
      + '<div><span>Окупаемость</span><strong data-agent-output="status" data-agent-id="' + agent.id + '">' + statusText + '</strong></div>'
      + '</div>'
      + '</article>';
  }

  function renderAgents() {
    var container = document.getElementById('agentsRegister');
    if (!container) return;
    var officeResult = calculate();
    container.innerHTML = state.agents.map(function (agent, index) {
      return renderAgent(agent, index, officeResult);
    }).join('');
  }

  function render() {
    renderExpenses();
    renderAgents();
    updateOutputs();
  }

  function updateOutputs() {
    var result = calculate();
    var expensesTotal = window.calculateExpenses ? window.calculateExpenses(state.expenses) : 0;
    var rate = window.getRoyaltyRate ? window.getRoyaltyRate(result.totalTurnover || 0) : 0;

    setText('[data-office-output="expenses"]', moneySafe(expensesTotal));
    setText('[data-office-output="expensesAgain"]', moneySafe(expensesTotal));
    setText('[data-office-output="ownerSales"]', moneySafe(state.ownerSales));
    setText('[data-office-output="royalty"]', moneySafe(result.royaltyWithOwner || 0));
    setText('[data-office-output="royaltyRate"]', 'ставка ' + percentSafe(rate));
    setText('[data-office-output="agentTurnover"]', moneySafe(result.agentTurnover || 0));
    setText('[data-office-output="totalTurnover"]', moneySafe(result.totalTurnover || 0));
    setText('[data-office-output="agentPayouts"]', moneySafe(result.agentPayouts || 0));
    setText('[data-office-output="referrals"]', moneySafe(result.referrals || 0));
    setText('[data-office-output="motivationReserves"]', moneySafe(result.motivationReserves || 0));
    setText('[data-office-output="resultWithoutOwner"]', moneySafe(result.resultWithoutOwner || 0));
    setText('[data-office-output="resultWithOwner"]', moneySafe(result.resultWithOwner || 0));
    setText('[data-office-output="resultWithOwnerCard"]', moneySafe(result.resultWithOwner || 0));

    var active = currentOfficeState().agents;
    var activeText = active.length
      ? 'Активные агенты: ' + active.map(function (agent) {
          var eco = (result.agentEconomics || []).find(function (item) { return item.id === agent.id; });
          return (agent.name || 'Агент') + (eco ? ' — вклад ' + moneySafe(eco.contributionAfterExpenses) : '');
        }).join('; ')
      : 'Активные агенты: нет';
    setText('#activeAgentsSummary', activeText);

    var diagnosis = document.getElementById('officeDiagnosis');
    if (diagnosis) {
      diagnosis.className = 'diagnosis';
      if (!active.length) {
        diagnosis.textContent = 'Данных пока недостаточно.';
      } else if (result.resultWithoutOwner < 0) {
        diagnosis.textContent = 'Офис в минусе без личных сделок собственника.';
        diagnosis.classList.add('is-danger');
      } else if (result.resultWithoutOwner < 50000) {
        diagnosis.textContent = 'Офис около нуля. Нужен запас прочности по обороту или расходам.';
        diagnosis.classList.add('is-warning');
      } else {
        diagnosis.textContent = 'Офис окупается как система.';
      }
    }
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (node) {
      node.textContent = value;
    });
  }

  function updateAgentOutputs(agentId) {
    var agent = getAgent(agentId);
    if (!agent) return;
    var result = window.calculateAgent(normalizeAgent(agent));
    result.deals.forEach(function (deal, index) {
      setText('[data-output="deal-rate"][data-agent-id="' + agentId + '"][data-deal-index="' + index + '"]', percentSafe(deal.rate));
      setText('[data-output="deal-payout"][data-agent-id="' + agentId + '"][data-deal-index="' + index + '"]', moneySafe(deal.payout));
    });
    setText('[data-agent-output="commission"][data-agent-id="' + agentId + '"]', moneySafe(result.commission));
    setText('[data-agent-output="payout"][data-agent-id="' + agentId + '"]', moneySafe(result.payout));
    setText('[data-agent-output="referral"][data-agent-id="' + agentId + '"]', moneySafe(result.referral));
    setText('[data-agent-output="motivation"][data-agent-id="' + agentId + '"]', moneySafe(result.motivationReserve));

    var officeResult = calculate();
    var eco = getAgentContribution(agent, officeResult);
    if (eco) {
      setText('[data-agent-output="contribution"][data-agent-id="' + agentId + '"]', moneySafe(eco.contributionAfterExpenses));
      setText('[data-agent-output="status"][data-agent-id="' + agentId + '"]', eco.status);
    }
    updateOutputs();
  }

  function handleInput(event) {
    var target = event.target;
    var agentId = target.getAttribute('data-agent-id');
    var expenseId = target.getAttribute('data-expense-id');

    if (target.hasAttribute('data-office-field')) {
      state[target.getAttribute('data-office-field')] = parseMoney(target.value);
      updateOutputs();
      return;
    }

    if (expenseId) {
      var expense = getExpense(expenseId);
      if (!expense) return;
      var expenseField = target.getAttribute('data-expense-field');
      expense[expenseField] = expenseField === 'amount' ? parseMoney(target.value) : target.value;
      updateOutputs();
      return;
    }

    if (!agentId) return;
    var agent = getAgent(agentId);
    if (!agent) return;

    if (target.hasAttribute('data-motivation-field')) {
      var motivationField = target.getAttribute('data-motivation-field');
      agent.motivation = Object.assign(createMotivation(), agent.motivation || {});
      if (target.type === 'checkbox') {
        if (motivationField === 'starEnabled' && target.checked) {
          state.agents.forEach(function (other) {
            if (other.id !== agent.id) {
              other.motivation = Object.assign(createMotivation(), other.motivation || {});
              other.motivation.starEnabled = false;
            }
          });
        }
        agent.motivation[motivationField] = target.checked;
        render();
      } else {
        agent.motivation[motivationField] = parseMoney(target.value);
        updateAgentOutputs(agentId);
      }
      return;
    }

    var field = target.getAttribute('data-agent-field');
    if (!field) return;

    if (field === 'deal') {
      var dealIndex = parseInt(target.getAttribute('data-deal-index'), 10);
      agent.dealsInput[dealIndex] = parseMoney(target.value);
      updateAgentOutputs(agentId);
      return;
    }

    if (field === 'name') {
      agent.name = target.value;
      updateAgentOutputs(agentId);
      return;
    }

    if (field === 'commission' || field === 'expenseShare') {
      agent[field] = parseMoney(target.value);
      updateAgentOutputs(agentId);
      return;
    }

    if (field === 'dealCount') {
      agent.dealCount = Math.max(1, parseInt(target.value, 10) || 1);
      updateAgentOutputs(agentId);
      return;
    }

    if (field === 'fixedRate') {
      agent.fixedRate = parseMoney(target.value);
      updateAgentOutputs(agentId);
      return;
    }
  }

  function handleChange(event) {
    var target = event.target;
    if (target.hasAttribute('data-motivation-field')) {
      handleInput(event);
      return;
    }
    var agentId = target.getAttribute('data-agent-id');
    if (!agentId) return;
    var agent = getAgent(agentId);
    if (!agent) return;

    var field = target.getAttribute('data-agent-field');
    if (!field) return;

    if (field === 'status' || field === 'paymentType' || field === 'commissionMode') {
      if (field === 'commissionMode' && target.value === 'quick' && !parseMoney(agent.commission)) {
        agent.commission = (agent.dealsInput || []).reduce(function (sum, deal) { return sum + parseMoney(deal); }, 0);
        agent.dealCount = Math.max(1, (agent.dealsInput || []).filter(function (deal) { return parseMoney(deal) > 0; }).length || agent.dealsInput.length || 1);
      }
      if (field === 'commissionMode' && target.value === 'exact' && (!agent.dealsInput || !agent.dealsInput.length)) {
        agent.dealsInput = parseMoney(agent.commission) ? [agent.commission] : [''];
      }
      agent[field] = target.value;
      render();
      return;
    }

    if (field === 'introduced') {
      agent.introduced = target.checked;
      updateAgentOutputs(agentId);
    }
  }

  function handleClick(event) {
    var target = event.target.closest('[data-action]');
    if (!target) return;
    var action = target.getAttribute('data-action');
    var agentId = target.getAttribute('data-agent-id');
    var agent = agentId ? getAgent(agentId) : null;

    if (action === 'add-agent') {
      state.agents.push(createAgent(''));
      render();
      return;
    }

    if (action === 'remove-agent' && agent) {
      state.agents = state.agents.filter(function (item) { return item.id !== agent.id; });
      if (!state.agents.length) state.agents.push(createAgent(''));
      render();
      return;
    }

    if (action === 'add-deal' && agent) {
      agent.dealsInput.push('');
      agent.commissionMode = 'exact';
      render();
      return;
    }

    if (action === 'remove-deal' && agent) {
      var index = parseInt(target.getAttribute('data-deal-index'), 10);
      agent.dealsInput.splice(index, 1);
      if (!agent.dealsInput.length) agent.dealsInput.push('');
      render();
      return;
    }

    if (action === 'add-expense') {
      state.expenses.push(createExpense('Новый расход'));
      render();
      return;
    }

    if (action === 'remove-expense') {
      var expenseId = target.getAttribute('data-expense-id');
      state.expenses = state.expenses.filter(function (expense) { return expense.id !== expenseId; });
      render();
      return;
    }

    if (action === 'clear-register') {
      state = createState();
      setNotice('Реестр очищен. Можно заполнить строки вручную или загрузить данные из A4.');
      render();
      return;
    }

    if (action === 'load-a4') {
      loadSnapshot();
    }
  }

  function setNotice(text) {
    var notice = document.getElementById('registerNotice');
    if (notice) notice.textContent = text;
  }

  function loadSnapshot() {
    try {
      var raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) {
        setNotice('Данные из A4 не найдены. Сначала откройте A4 и перейдите в таблицу оттуда или заполните вручную.');
        return;
      }
      var parsed = JSON.parse(raw);
      var source = parsed && parsed.state ? parsed.state : parsed;
      state.expenses = Array.isArray(source.expenses) && source.expenses.length
        ? source.expenses.map(function (expense) {
            return { id: expense.id || nextExpenseId(), name: expense.name || 'Расход', amount: parseMoney(expense.amount) };
          })
        : state.expenses;
      state.ownerSales = parseMoney(source.ownerSales);
      state.agents = Array.isArray(source.agents) && source.agents.length
        ? source.agents.map(normalizeAgent)
        : state.agents;
      setNotice('Данные из A4 загружены в реестр. Старый A4 не изменён.');
      render();
    } catch (error) {
      setNotice('Не удалось загрузить данные из A4. Можно заполнить реестр вручную.');
    }
  }

  function handleBlur(event) {
    if (event.target.hasAttribute('data-money-input')) {
      event.target.value = formatInputMoney(event.target.value);
    }
  }

  function wireEvents() {
    document.addEventListener('input', handleInput);
    document.addEventListener('change', handleChange);
    document.addEventListener('click', handleClick);
    document.addEventListener('blur', handleBlur, true);
    document.addEventListener('compositionstart', function () { isComposing = true; });
    document.addEventListener('compositionend', function (event) {
      isComposing = false;
      if (event.target && event.target.hasAttribute('data-money-input')) {
        event.target.value = formatInputMoney(event.target.value);
        event.target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  function init() {
    state = createState();
    wireEvents();
    render();
  }

  document.addEventListener('DOMContentLoaded', init);

  window.tableRegisterDebug = {
    getState: function () { return clone(state); },
    setState: function (nextState) { state = nextState; render(); },
    parseMoney: parseMoney
  };
}());
