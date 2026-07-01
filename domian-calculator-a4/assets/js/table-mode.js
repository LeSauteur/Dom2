(function () {
  'use strict';

  var SNAPSHOT_KEY = 'domianA4TableSnapshot';
  var SNAPSHOT_VERSION = 3;
  var DEFAULT_AGENT_ROWS = 10;
  var DEFAULT_TABLE_EXPENSE_CATEGORIES = [
    { id: 'rent', label: 'Аренда', amount: 0 },
    { id: 'salary', label: 'Зарплаты / администратор', amount: 0 },
    { id: 'ads', label: 'Реклама', amount: 0 },
    { id: 'communications', label: 'Связь / сервисы', amount: 0 },
    { id: 'household', label: 'Хозяйственные расходы', amount: 0 },
    { id: 'other', label: 'Прочее', amount: 0 }
  ];
  var agentCounter = 0;
  var expenseCounter = 0;
  var state = null;
  var elements = {};
  var expandedAgents = {};

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nextAgentId() {
    agentCounter += 1;
    return 'table-agent-' + agentCounter;
  }

  function nextExpenseId() {
    expenseCounter += 1;
    return 'table-expense-' + expenseCounter;
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
    return String(value === null || value === undefined ? '' : value)
      .replace(/[\s\u00a0\u202f]+/g, '')
      .replace(',', '.');
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

  function normalizeSelectedMonth(value) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || '')) ? String(value) : '';
  }

  function moneyInput(attributes, value) {
    return '<input type="text" inputmode="numeric" autocomplete="off" data-money-input="true" ' + attributes + ' value="' + formatMoneyInputValue(value) + '">';
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

  function createBlankAgent() {
    var startingRate = PAY_SCALES.boostedStartingDefault || PAY_SCALES.boostedDefault[0];
    var boostedRates = clone(PAY_SCALES.boostedDefault);
    boostedRates[0] = startingRate;
    return {
      id: nextAgentId(),
      name: '',
      commission: 0,
      dealCount: 1,
      commissionMode: 'quick',
      dealsInput: [],
      dealDepositOrders: [],
      dealNewbuildSoloFlags: [],
      paymentType: 'standard',
      status: 'partner',
      boostedRates: boostedRates,
      startingRate: startingRate,
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
      motivation: Object.assign({}, DEFAULT_MOTIVATION, { mode: 'manual', manualReserveMonthly: 0 }),
      motivationReserve: 0,
      manualExpenseShare: 0
    };
  }

  function createBlankState() {
    var expenseItems = createDefaultExpenseItems();
    return {
      selectedMonth: '',
      expenses: 0,
      expenseItems: expenseItems,
      expenseCategories: expenseItems,
      ownerSales: 0,
      agents: createBlankAgents(DEFAULT_AGENT_ROWS)
    };
  }

  function createInitialState() {
    return createBlankState();
  }

  function createBlankAgents(count) {
    var agents = [];
    for (var i = 0; i < count; i += 1) {
      agents.push(createBlankAgent());
    }
    return agents;
  }

  function fillToDefaultRows(agents) {
    var result = agents.slice();
    while (result.length < DEFAULT_AGENT_ROWS) {
      result.push(createBlankAgent());
    }
    return result;
  }

  function createBlankExpenseCategories() {
    return DEFAULT_TABLE_EXPENSE_CATEGORIES.map(function (category) {
      return Object.assign({}, category);
    });
  }

  function createDefaultExpenseItems() {
    return DEFAULT_TABLE_EXPENSE_CATEGORIES.map(function (category) {
      return {
        id: category.id,
        name: category.label,
        amount: positiveNumber(category.amount)
      };
    });
  }

  function normalizeExpenseItems(items) {
    var source = Array.isArray(items) && items.length ? items : createDefaultExpenseItems();
    return source.map(function (item) {
      return {
        id: item && item.id ? String(item.id) : nextExpenseId(),
        name: item && item.name ? String(item.name) : 'Расход',
        amount: positiveNumber(item && item.amount)
      };
    });
  }

  function normalizeExpenseCategories(categories) {
    var source = Array.isArray(categories) ? categories : [];
    return DEFAULT_TABLE_EXPENSE_CATEGORIES.map(function (category) {
      var match = source.find(function (item) {
        return item && item.id === category.id;
      });
      return {
        id: category.id,
        label: category.label,
        amount: positiveNumber(match && match.amount)
      };
    });
  }

  function calculateExpenseCategories(categories) {
    return normalizeExpenseCategories(categories).reduce(function (sum, category) {
      return sum + positiveNumber(category.amount);
    }, 0);
  }

  function calculateExpenseItems(items) {
    return normalizeExpenseItems(items).reduce(function (sum, item) {
      return sum + positiveNumber(item.amount);
    }, 0);
  }

  function getTableExpenses(tableState) {
    if (Array.isArray(tableState.expenseItems) && tableState.expenseItems.length) {
      return calculateExpenseItems(tableState.expenseItems);
    }
    if (Array.isArray(tableState.expenseCategories) && tableState.expenseCategories.length) {
      return calculateExpenseCategories(tableState.expenseCategories);
    }
    return positiveNumber(tableState.expenses);
  }

  function mapExpenseCategoriesToItems(categories) {
    return normalizeExpenseCategories(categories).map(function (category) {
      return {
        id: category.id,
        name: category.label,
        amount: positiveNumber(category.amount)
      };
    });
  }

  function mapSnapshotExpenseItems(expenses) {
    if (!Array.isArray(expenses) || !expenses.length) {
      return createDefaultExpenseItems();
    }

    return expenses.map(function (expense) {
      return {
        id: expense && expense.id ? String(expense.id) : nextExpenseId(),
        name: expense && expense.name ? String(expense.name) : 'Расход',
        amount: positiveNumber(expense && expense.amount)
      };
    });
  }

  function getSnapshotExpenseCategoryId(expense) {
    var id = expense && expense.id ? String(expense.id) : '';

    if (id === 'rent') {
      return 'rent';
    }
    if (id === 'admin' || id === 'accounting') {
      return 'salary';
    }
    if (id === 'ads') {
      return 'ads';
    }
    if (id === 'internet' || id === 'phone') {
      return 'communications';
    }
    if (id === 'utilities') {
      return 'household';
    }
    return 'other';
  }

  function mapSnapshotExpenses(expenses) {
    var categories = createBlankExpenseCategories();
    if (!Array.isArray(expenses)) {
      return categories;
    }

    expenses.forEach(function (expense) {
      var categoryId = getSnapshotExpenseCategoryId(expense);
      var category = categories.find(function (item) {
        return item.id === categoryId;
      });
      if (category) {
        category.amount += positiveNumber(expense && expense.amount);
      }
    });

    return categories;
  }

  function normalizeDealsInput(deals) {
    return Array.isArray(deals) && deals.length ? deals.slice() : [''];
  }

  function normalizeDealDepositOrders(values, length) {
    var source = Array.isArray(values) ? values : [];
    var result = [];
    for (var i = 0; i < length; i += 1) {
      var value = source[i];
      var numeric = value === '' || value === null || value === undefined ? 0 : Math.floor(positiveNumber(value));
      result.push(numeric > 0 ? numeric : '');
    }
    return result;
  }

  function normalizeDealNewbuildSoloFlags(values, length) {
    var source = Array.isArray(values) ? values : [];
    var result = [];
    for (var i = 0; i < length; i += 1) {
      result.push(Boolean(source[i]));
    }
    return result;
  }

  function syncExactDealMetadata(agent) {
    var deals = normalizeDealsInput(agent.dealsInput);
    agent.dealsInput = deals;
    agent.dealDepositOrders = normalizeDealDepositOrders(agent.dealDepositOrders, deals.length);
    agent.dealNewbuildSoloFlags = normalizeDealNewbuildSoloFlags(agent.dealNewbuildSoloFlags, deals.length);
  }

  function hasMeaningfulDeals(deals) {
    return Array.isArray(deals) && deals.some(function (deal) {
      return positiveNumber(deal) > 0;
    });
  }

  function getDealDisplayValue(deal) {
    return deal === '' || deal === null || deal === undefined ? '' : formatMoneyInputValue(deal);
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

  function normalizeBoostedRates(rates) {
    var sourceRates = Array.isArray(rates) ? rates : [];
    return PAY_SCALES.boostedDefault.map(function (fallback, index) {
      var value = sourceRates[index];
      return value === undefined || value === null || value === '' ? fallback : positiveNumber(value);
    });
  }

  function normalizeMotivation(source, reserve) {
    var motivation = Object.assign({}, DEFAULT_MOTIVATION, source && source.motivation ? source.motivation : {});

    if (!source || !source.motivation) {
      motivation.mode = positiveNumber(reserve) > 0 ? 'manual' : 'off';
      motivation.manualReserveMonthly = positiveNumber(reserve);
      motivation.congressEnabled = false;
    }

    return motivation;
  }

  function normalizeStarSelection(agentSources) {
    var starAssigned = false;

    return (agentSources || []).map(function (source) {
      var agent = Object.assign({}, source || {});

      if (agent.motivation && typeof agent.motivation === 'object') {
        agent.motivation = Object.assign({}, agent.motivation);
        if (agent.motivation.starEnabled) {
          if (starAssigned) {
            agent.motivation.starEnabled = false;
          } else {
            starAssigned = true;
          }
        }
      }

      return agent;
    });
  }

  function syncExactAgentTotals(agent) {
    if (!agent || agent.commissionMode !== 'exact') {
      return;
    }
    syncExactDealMetadata(agent);
    var calculated = calculateAgent(getCalculationAgent(agent));
    agent.commission = calculated.commission;
    agent.dealCount = calculated.dealCount;
  }

  function isActiveAgent(agent) {
    var name = String(agent.name || '').trim();

    return (name && name !== 'Новый агент')
      || positiveNumber(agent.commission) > 0
      || hasMeaningfulDeals(agent.dealsInput)
      || (agent.paymentType && agent.paymentType !== 'standard')
      || positiveNumber(agent.fixedRate) !== PAY_SCALES.fixedDefault
      || Boolean(agent.introduced)
      || Boolean(agent.partnerConfirmed)
      || positiveNumber(agent.quarterlyCommission) > 0
      || positiveNumber(agent.quarterlyDeposits) > 0
      || positiveNumber(agent.halfYearCommission) > 0
      || positiveNumber(agent.preTripQuarterDeposits) > 0
      || Boolean(agent.motivationOverride)
      || Boolean(agent.stipendOverride)
      || positiveNumber(agent.motivationReserve) > 0
      || positiveNumber(agent.manualExpenseShare) > 0
      || Boolean(agent.mountainSeaOverride)
      || Boolean(agent.travelOverride)
      || Boolean(agent.eventsOverride)
      || Boolean(agent.specialTermsOverride)
      || Boolean(agent.motivation && agent.motivation.starEnabled);
  }

  function toTableAgent(source) {
    var commissionMode = source.commissionMode === 'exact' ? 'exact' : 'quick';
    var dealsInput = normalizeDealsInput(source.dealsInput);
    var dealDepositOrders = normalizeDealDepositOrders(source.dealDepositOrders, dealsInput.length);
    var dealNewbuildSoloFlags = normalizeDealNewbuildSoloFlags(source.dealNewbuildSoloFlags, dealsInput.length);
    var boostedRates = normalizeBoostedRates(source.boostedRates);
    var startingRate = source.startingRate;
    if (startingRate === undefined || startingRate === null || startingRate === '') {
      startingRate = boostedRates[0];
    }
    startingRate = positiveNumber(startingRate);
    boostedRates[0] = startingRate;
    var motivation = normalizeMotivation(source, source.motivationReserve);
    var calculated = calculateAgent(Object.assign({}, source, {
      commissionMode: commissionMode,
      dealsInput: dealsInput,
      dealDepositOrders: dealDepositOrders,
      dealNewbuildSoloFlags: dealNewbuildSoloFlags,
      boostedRates: boostedRates,
      startingRate: startingRate,
      motivation: motivation
    }));
    var fixedRate = source.fixedRate;

    if (fixedRate === undefined || fixedRate === null || fixedRate === '') {
      fixedRate = calculated.fixedRate;
    }

    return {
      id: source.id || nextAgentId(),
      name: source.name || 'Агент',
      commission: calculated.commission,
      dealCount: calculated.dealCount,
      commissionMode: commissionMode,
      dealsInput: dealsInput,
      dealDepositOrders: dealDepositOrders,
      dealNewbuildSoloFlags: dealNewbuildSoloFlags,
      paymentType: source.paymentType || calculated.paymentType || 'standard',
      status: source.status || calculated.status || 'partner',
      boostedRates: boostedRates,
      startingRate: startingRate,
      fixedRate: positiveNumber(fixedRate),
      introduced: Boolean(source.introduced),
      partnerConfirmed: Boolean(source.partnerConfirmed),
      quarterlyCommission: positiveNumber(source.quarterlyCommission),
      quarterlyDeposits: positiveNumber(source.quarterlyDeposits),
      halfYearCommission: positiveNumber(source.halfYearCommission),
      preTripQuarterDeposits: positiveNumber(source.preTripQuarterDeposits),
      motivationOverride: Boolean(source.motivationOverride),
      stipendOverride: Boolean(source.stipendOverride),
      mountainSeaOverride: source.mountainSeaOverride !== undefined ? Boolean(source.mountainSeaOverride) : Boolean(source.travelOverride),
      travelOverride: Boolean(source.travelOverride),
      eventsOverride: Boolean(source.eventsOverride),
      specialTermsOverride: Boolean(source.specialTermsOverride),
      motivation: motivation,
      motivationReserve: calculated.motivationReserve,
      manualExpenseShare: 0
    };
  }

  function loadSnapshotState() {
    var raw = null;
    try {
      raw = localStorage.getItem(SNAPSHOT_KEY);
    } catch (error) {
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      var snapshot = JSON.parse(raw);
      if (snapshot && snapshot.version !== undefined) {
        if ((snapshot.version !== 1 && snapshot.version !== 2 && snapshot.version !== SNAPSHOT_VERSION) || !snapshot.state) {
          return null;
        }
        snapshot = snapshot.state;
      }
      if (!snapshot || typeof snapshot !== 'object') {
        return null;
      }
      var agents = Array.isArray(snapshot.agents) && snapshot.agents.length
        ? snapshot.agents.map(toTableAgent)
        : createBlankAgents(DEFAULT_AGENT_ROWS);
      var expenseCategories = mapSnapshotExpenses(snapshot.expenses || []);
      var expenseItems = mapSnapshotExpenseItems(snapshot.expenses || []);

      return {
        selectedMonth: normalizeSelectedMonth(snapshot.selectedMonth),
        expenses: calculateExpenseItems(expenseItems),
        expenseItems: expenseItems,
        expenseCategories: expenseCategories,
        ownerSales: positiveNumber(snapshot.ownerSales),
        agents: fillToDefaultRows(agents)
      };
    } catch (error) {
      return null;
    }
  }

  function getCalculationAgent(agent) {
    var fixedRate = agent.fixedRate;

    if (fixedRate === undefined || fixedRate === null || fixedRate === '') {
      fixedRate = PAY_SCALES.fixedDefault;
    }

    return {
      id: agent.id,
      name: agent.name,
      commission: positiveNumber(agent.commission),
      dealCount: Math.max(1, Math.floor(positiveNumber(agent.dealCount))),
      commissionMode: agent.commissionMode === 'exact' ? 'exact' : 'quick',
      dealsInput: normalizeDealsInput(agent.dealsInput),
      dealDepositOrders: normalizeDealDepositOrders(agent.dealDepositOrders, normalizeDealsInput(agent.dealsInput).length),
      dealNewbuildSoloFlags: normalizeDealNewbuildSoloFlags(agent.dealNewbuildSoloFlags, normalizeDealsInput(agent.dealsInput).length),
      paymentType: agent.paymentType || 'standard',
      status: agent.status || 'partner',
      fixedRate: positiveNumber(fixedRate),
      introduced: Boolean(agent.introduced),
      partnerConfirmed: Boolean(agent.partnerConfirmed),
      quarterlyCommission: positiveNumber(agent.quarterlyCommission),
      quarterlyDeposits: positiveNumber(agent.quarterlyDeposits),
      halfYearCommission: positiveNumber(agent.halfYearCommission),
      preTripQuarterDeposits: positiveNumber(agent.preTripQuarterDeposits),
      motivationOverride: Boolean(agent.motivationOverride),
      stipendOverride: Boolean(agent.stipendOverride),
      mountainSeaOverride: Boolean(agent.mountainSeaOverride),
      travelOverride: Boolean(agent.travelOverride),
      eventsOverride: Boolean(agent.eventsOverride),
      specialTermsOverride: Boolean(agent.specialTermsOverride),
      boostedRates: normalizeBoostedRates(agent.boostedRates),
      startingRate: positiveNumber(agent.startingRate),
      motivation: normalizeMotivation(agent, agent.motivationReserve)
    };
  }

  function getContributionStatus(contribution) {
    if (contribution > 10000) {
      return { className: 'positive', label: 'Окупается' };
    }
    if (contribution >= -10000) {
      return { className: 'warning', label: 'Около нуля' };
    }
    return { className: 'danger', label: 'Не окупается' };
  }

  function getComment(agent, calculated, expenseShare, contribution) {
    var parts = [];
    if (agent.paymentType === 'fixed') {
      parts.push('фикс ' + positiveNumber(agent.fixedRate) + '%');
    }
    if (agent.paymentType === 'boosted') {
      parts.push('повышенная шкала');
    }
    if (agent.introduced) {
      parts.push('есть реферал');
    }
    parts.push(positiveNumber(agent.manualExpenseShare) > 0 ? 'расходы вручную' : 'расходы авто');
    if (contribution < -10000) {
      parts.push('нужен контроль плана');
    }
    if (calculated.commission <= calculated.payout + calculated.referral + calculated.motivationReserve + expenseShare) {
      parts.push('комиссии мало для нагрузки');
    }
    return parts.join(', ');
  }

  function calculateTable() {
    var activeSources = normalizeStarSelection(state.agents.filter(isActiveAgent));
    var calculatedAgents = activeSources.map(function (agent) {
      return calculateAgent(getCalculationAgent(agent));
    });
    var agentTurnover = calculatedAgents.reduce(function (sum, agent) { return sum + agent.commission; }, 0);
    var ownerSales = positiveNumber(state.ownerSales);
    if (Array.isArray(state.expenseItems) && state.expenseItems.length) {
      state.expenseItems = normalizeExpenseItems(state.expenseItems);
    } else if (Array.isArray(state.expenseCategories) && state.expenseCategories.length) {
      state.expenseCategories = normalizeExpenseCategories(state.expenseCategories);
      state.expenseItems = mapExpenseCategoriesToItems(state.expenseCategories);
    }
    var expenses = getTableExpenses(state);
    state.expenses = expenses;
    var totalTurnover = agentTurnover + ownerSales;
    var agentPayouts = calculatedAgents.reduce(function (sum, agent) { return sum + agent.payout; }, 0);
    var referrals = calculatedAgents.reduce(function (sum, agent) { return sum + agent.referral; }, 0);
    var motivationReserves = calculatedAgents.reduce(function (sum, agent) { return sum + agent.motivationReserve; }, 0);
    var royaltyWithoutOwner = calculateRoyalty(agentTurnover);
    var royaltyWithOwner = calculateRoyalty(totalTurnover);
    var manualExpenseTotal = activeSources.reduce(function (sum, agent) {
      return sum + (positiveNumber(agent.manualExpenseShare) > 0 ? positiveNumber(agent.manualExpenseShare) : 0);
    }, 0);
    var autoExpenseAgents = activeSources.filter(function (agent) {
      return positiveNumber(agent.manualExpenseShare) <= 0;
    }).length;
    var autoExpenseShare = autoExpenseAgents ? Math.max(0, expenses - manualExpenseTotal) / autoExpenseAgents : 0;
    var rows = activeSources.map(function (source, index) {
      var calculated = calculatedAgents[index];
      var expenseShare = positiveNumber(source.manualExpenseShare) > 0 ? positiveNumber(source.manualExpenseShare) : autoExpenseShare;
      var royaltyShare = calculateRoyalty(calculated.commission);
      var beforeExpenses = roundMoney(calculated.commission - calculated.payout - calculated.referral - calculated.motivationReserve - royaltyShare);
      var contribution = roundMoney(beforeExpenses - expenseShare);
      var status = getContributionStatus(contribution);

      return {
        source: source,
        calculated: calculated,
        expenseShare: expenseShare,
        royaltyShare: royaltyShare,
        beforeExpenses: beforeExpenses,
        contribution: contribution,
        status: status,
        comment: getComment(source, calculated, expenseShare, contribution)
      };
    });

    return {
      selectedMonth: normalizeSelectedMonth(state.selectedMonth),
      rows: rows,
      activeAgentIds: activeSources.map(function (agent) { return agent.id; }),
      expenses: expenses,
      ownerSales: ownerSales,
      agentTurnover: agentTurnover,
      totalTurnover: totalTurnover,
      agentPayouts: agentPayouts,
      referrals: referrals,
      motivationReserves: motivationReserves,
      royaltyWithoutOwner: royaltyWithoutOwner,
      royaltyWithOwner: royaltyWithOwner,
      resultWithoutOwner: agentTurnover - agentPayouts - referrals - motivationReserves - royaltyWithoutOwner - expenses,
      resultWithOwner: totalTurnover - agentPayouts - referrals - motivationReserves - royaltyWithOwner - expenses
    };
  }

  function getDiagnosis(totals) {
    if (Math.abs(totals.resultWithOwner) <= 10000) {
      return {
        className: 'warning',
        title: 'Офис около нуля',
        text: 'Небольшое снижение оборота или рост расходов быстро уведёт офис в минус.'
      };
    }
    if (totals.resultWithOwner < 0) {
      return {
        className: 'danger',
        title: 'Офис убыточен',
        text: 'При текущих вводных нужно увеличить оборот, снизить расходы или пересмотреть условия выплат.'
      };
    }
    if (totals.resultWithoutOwner < 0 && totals.resultWithOwner > 0) {
      return {
        className: 'warning',
        title: 'Офис зависит от собственника',
        text: 'Команда пока не закрывает расходы самостоятельно, плюс появляется за счёт личных сделок собственника.'
      };
    }
    return {
      className: 'positive',
      title: 'Офис окупается как система',
      text: 'Даже без личных сделок собственника остаётся положительный результат.'
    };
  }

  function renderAgentRow(row) {
    var agent = row.source;
    var calculated = row.calculated;
    return '<tr class="' + row.status.className + '">'
      + '<td><input type="text" data-agent-id="' + agent.id + '" data-agent-field="name" value="' + escapeHtml(agent.name) + '"></td>'
      + renderCommissionCell(agent)
      + renderDealModeCell(agent)
      + '<td><select data-agent-id="' + agent.id + '" data-agent-field="paymentType">'
      + option('standard', 'Стандарт', agent.paymentType)
      + option('boosted', 'Повышенная', agent.paymentType)
      + option('fixed', 'Фикс', agent.paymentType)
      + '</select></td>'
      + '<td>' + money(calculated.payout) + '</td>'
      + '<td>' + money(calculated.referral) + '</td>'
      + '<td>' + money(calculated.motivationReserve) + '</td>'
      + '<td>' + money(row.expenseShare) + '</td>'
      + '<td class="strong-value">' + money(row.contribution) + '</td>'
      + '<td><span class="status-pill">' + row.status.label + '</span></td>'
      + '<td><button class="row-button detail-toggle" type="button" data-action="toggle-agent-details" data-agent-id="' + agent.id + '">' + (expandedAgents[agent.id] ? 'Скрыть' : 'Настроить') + '</button></td>'
      + '</tr>';
  }

  function renderBlankAgentRow(agent) {
    return '<tr class="empty-row">'
      + '<td><input type="text" placeholder="Агент" data-agent-id="' + agent.id + '" data-agent-field="name" value="' + escapeHtml(agent.name) + '"></td>'
      + renderCommissionCell(agent)
      + renderDealModeCell(agent)
      + '<td><select data-agent-id="' + agent.id + '" data-agent-field="paymentType">'
      + option('standard', 'Стандарт', agent.paymentType)
      + option('boosted', 'Повышенная', agent.paymentType)
      + option('fixed', 'Фикс', agent.paymentType)
      + '</select></td>'
      + '<td class="muted-value">—</td>'
      + '<td class="muted-value">—</td>'
      + '<td>' + money(positiveNumber(agent.motivationReserve)) + '</td>'
      + '<td>' + money(positiveNumber(agent.manualExpenseShare)) + '</td>'
      + '<td class="muted-value">—</td>'
      + '<td><span class="status-pill muted">Пусто</span></td>'
      + '<td><button class="row-button detail-toggle" type="button" data-action="toggle-agent-details" data-agent-id="' + agent.id + '">' + (expandedAgents[agent.id] ? 'Скрыть' : 'Настроить') + '</button></td>'
      + '</tr>';
  }

  function renderCommissionCell(agent) {
    var exactMode = agent.commissionMode === 'exact';
    return '<td>' + moneyInput('data-agent-id="' + agent.id + '" data-agent-field="commission"' + (exactMode ? ' disabled' : ''), agent.commission) + '</td>';
  }

  function renderDealModeCell(agent) {
    var exactMode = agent.commissionMode === 'exact';
    return '<td class="deal-mode-cell">'
      + '<input type="number" min="1" step="1" data-agent-id="' + agent.id + '" data-agent-field="dealCount" value="' + Math.max(1, Math.floor(positiveNumber(agent.dealCount))) + '"' + (exactMode ? ' disabled' : '') + '>'
      + '<small>' + (exactMode ? 'точно' : 'быстро') + '</small>'
      + '</td>';
  }

  function renderExactDealsRow(agent) {
    var deals = normalizeDealsInput(agent.dealsInput);
    return '<div class="exact-details">'
      + '<div class="exact-details-head"><strong>Точные сделки</strong><span>Комиссия и количество считаются по отдельным суммам.</span></div>'
      + '<div class="exact-details-list">'
      + deals.map(function (deal, index) {
        return '<label class="exact-deal-field">'
          + '<span>Сделка ' + (index + 1) + '</span>'
          + moneyInput('data-agent-id="' + agent.id + '" data-deal-index="' + index + '"', getDealDisplayValue(deal))
          + '<button class="row-button" type="button" data-action="remove-deal" data-agent-id="' + agent.id + '" data-deal-index="' + index + '"' + (deals.length === 1 ? ' disabled' : '') + '>Удалить</button>'
          + '</label>';
      }).join('')
      + '</div>'
      + '<button class="row-button exact-add-button" type="button" data-action="add-deal" data-agent-id="' + agent.id + '">Добавить сделку</button>'
      + '</div>';
  }

  function renderBoostedRatesRow(agent) {
    var startingRate = agent.startingRate;
    if (startingRate === undefined || startingRate === null || startingRate === '') {
      startingRate = normalizeBoostedRates(agent.boostedRates)[0];
    }
    return '<div class="boosted-details">'
      + '<div class="boosted-details-head"><strong>Стартовый процент</strong><span>Таблица считает по большему значению: стандартная шкала партнёра или этот стартовый процент.</span></div>'
      + '<div class="rate-grid">'
      + '<label class="field"><span>Стартовый процент</span>'
      + '<input type="number" min="0" max="100" step="1" data-agent-id="' + agent.id + '" data-agent-field="startingRate" value="' + positiveNumber(startingRate) + '">'
      + '<small>Если эта ставка выше стандартной, каждая сделка не опустится ниже неё.</small></label>'
      + '</div>'
      + '</div>';
  }

  function renderMotivationDetails(row) {
    var motivation = row.calculated.motivation || {};
    var reserve = positiveNumber(row.calculated.motivationReserve);

    if (reserve <= 0) {
      return '';
    }

    return '<div class="motivation-details">'
      + '<div class="motivation-details-head"><strong>Мотивационный резерв</strong><span>Сумма учтена в строке агента и в итогах офиса.</span></div>'
      + '<dl class="motivation-details-grid">'
      + '<div><dt>Всего / месяц</dt><dd>' + money(reserve) + '</dd></div>'
      + '<div><dt>Стипендия</dt><dd>' + money(motivation.stipendMonthly || 0) + '</dd></div>'
      + '<div><dt>Годовые резервы</dt><dd>' + money(motivation.annualReserveMonthly || 0) + '</dd></div>'
      + '<div><dt>Режим</dt><dd>' + escapeHtml(motivation.mode || 'manual') + '</dd></div>'
      + '</dl>'
      + '</div>';
  }

  function renderAgentDetailsRow(row, agent) {
    var source = row ? row.source : agent;
    var calculated = row ? row.calculated : calculateAgent(getCalculationAgent(source));
    var motivation = Object.assign({}, DEFAULT_MOTIVATION, source.motivation || {});

    if (!expandedAgents[source.id]) {
      return '';
    }

    return '<tr class="agent-detail-row">'
      + '<td colspan="11">'
      + '<div class="agent-detail-panel">'
      + '<section class="detail-section"><h3>Условия агента</h3><div class="detail-grid">'
      + '<label class="field"><span>Как считать сделки</span><select data-agent-id="' + source.id + '" data-agent-field="commissionMode">'
      + option('quick', 'Быстро: сумма и количество', source.commissionMode || 'quick')
      + option('exact', 'Точно: каждая сделка', source.commissionMode || 'quick')
      + '</select></label>'
      + '<label class="field"><span>Статус</span><select data-agent-id="' + source.id + '" data-agent-field="status">'
      + option('trainee', 'Стажёр', source.status)
      + option('partner', 'Партнёр', source.status)
      + '</select></label>'
      + '<label class="field"><span>Фикс, %</span><input type="number" min="0" max="100" step="1" data-agent-id="' + source.id + '" data-agent-field="fixedRate" value="' + positiveNumber(source.fixedRate === undefined || source.fixedRate === null || source.fixedRate === '' ? PAY_SCALES.fixedDefault : source.fixedRate) + '"></label>'
      + '<label class="field"><span>Приведённый</span><select data-agent-id="' + source.id + '" data-agent-field="introduced">'
      + option('false', 'Нет', String(Boolean(source.introduced)))
      + option('true', 'Да', String(Boolean(source.introduced)))
      + '</select></label>'
      + '<label class="field"><span>Резерв мотиваций, ₽/мес</span>' + moneyInput('data-agent-id="' + source.id + '" data-agent-field="motivationReserve"', source.motivationReserve) + '</label>'
      + '<label class="field"><span>Доля расходов, ₽</span>' + moneyInput('data-agent-id="' + source.id + '" data-agent-field="manualExpenseShare"', source.manualExpenseShare) + '</label>'
      + '<label class="field"><span>Партнёрство подтверждено</span><select data-agent-id="' + source.id + '" data-agent-field="partnerConfirmed">'
      + option('false', 'Нет', String(Boolean(source.partnerConfirmed)))
      + option('true', 'Да', String(Boolean(source.partnerConfirmed)))
      + '</select></label>'
      + '<label class="field"><span>Комиссия за квартал</span>' + moneyInput('data-agent-id="' + source.id + '" data-agent-field="quarterlyCommission"', source.quarterlyCommission) + '</label>'
      + '<label class="field"><span>Депозиты за квартал</span>' + moneyInput('data-agent-id="' + source.id + '" data-agent-field="quarterlyDeposits"', source.quarterlyDeposits) + '</label>'
      + '<label class="field"><span>Комиссия за полгода</span>' + moneyInput('data-agent-id="' + source.id + '" data-agent-field="halfYearCommission"', source.halfYearCommission) + '</label>'
      + '<label class="field"><span>Депозиты перед поездкой</span>' + moneyInput('data-agent-id="' + source.id + '" data-agent-field="preTripQuarterDeposits"', source.preTripQuarterDeposits) + '</label>'
      + '<label class="field"><span>Конгресс</span><select data-agent-id="' + source.id + '" data-agent-field="congressEnabled">'
      + option('true', 'Включён', String(motivation.congressEnabled !== false))
      + option('false', 'Исключён', String(motivation.congressEnabled !== false))
      + '</select></label>'
      + '<label class="field"><span>Конгресс, ₽/год</span>' + moneyInput('data-agent-id="' + source.id + '" data-agent-field="congressPerYear"', motivation.congressPerYear) + '</label>'
      + '<label class="field"><span>Звезда</span><select data-agent-id="' + source.id + '" data-agent-field="starEnabled">'
      + option('false', 'Нет', String(Boolean(motivation.starEnabled)))
      + option('true', 'Да', String(Boolean(motivation.starEnabled)))
      + '</select></label>'
      + '<label class="field"><span>Звезда, ₽/год</span>' + moneyInput('data-agent-id="' + source.id + '" data-agent-field="starPerYear"', motivation.starPerYear) + '</label>'
      + '</div></section>'
      + '<section class="detail-section"><h3>Расчётная справка</h3><dl class="detail-metrics">'
      + '<div><dt>Роялти-оценка</dt><dd>' + money(row ? row.royaltyShare : 0) + '</dd></div>'
      + '<div><dt>До расходов</dt><dd>' + money(row ? row.beforeExpenses : 0) + '</dd></div>'
      + '<div><dt>Комментарий</dt><dd>' + escapeHtml(row ? row.comment : 'Строка пока не влияет на итог') + '</dd></div>'
      + '<div><dt>Сделок в расчёте</dt><dd>' + calculated.dealCount + '</dd></div>'
      + '</dl></section>'
      + (source.commissionMode === 'exact' ? '<section class="detail-section">' + renderExactDealsRow(source) + '</section>' : '')
      + (source.paymentType === 'boosted' ? '<section class="detail-section">' + renderBoostedRatesRow(source) + '</section>' : '')
      + (row ? '<section class="detail-section">' + renderMotivationDetails(row) + '</section>' : '')
      + '<div class="detail-actions"><button class="row-button danger-button" type="button" data-action="remove-agent" data-agent-id="' + source.id + '">Удалить агента</button></div>'
      + '</div>'
      + '</td>'
      + '</tr>';
  }

  function renderSummary(totals) {
    elements.officeSummary.innerHTML = [
      ['Оборот агентов', totals.agentTurnover],
      ['Личные сделки собственника', totals.ownerSales],
      ['Общий оборот', totals.totalTurnover],
      ['Выплаты агентам', totals.agentPayouts],
      ['Рефералы', totals.referrals],
      ['Мотивации', totals.motivationReserves],
      ['Роялти', totals.royaltyWithOwner],
      ['Расходы офиса', totals.expenses],
      ['Итог без собственника', totals.resultWithoutOwner],
      ['Итог с собственником', totals.resultWithOwner]
    ].map(function (item) {
      return '<div><dt>' + item[0] + '</dt><dd>' + money(item[1]) + '</dd></div>';
    }).join('');
  }

  function renderDiagnosis(totals) {
    var diagnosis = getDiagnosis(totals);
    var riskyAgents = totals.rows.filter(function (row) {
      return row.contribution < -10000;
    });
    var warningText = riskyAgents.length
      ? 'Зоны риска: ' + riskyAgents.map(function (row) { return row.source.name; }).join(', ') + '.'
      : 'Критичных убыточных строк по агентам нет.';

    elements.diagnosisBox.className = 'diagnosis-box ' + diagnosis.className;
    elements.diagnosisBox.innerHTML = '<strong>' + diagnosis.title + '</strong>'
      + '<p>' + diagnosis.text + '</p>'
      + '<p>' + warningText + '</p>';
  }

  function renderExpenseItems() {
    if (!elements.officeExpensesList) {
      return;
    }

    state.expenseItems = normalizeExpenseItems(state.expenseItems);
    elements.officeExpensesList.innerHTML = state.expenseItems.map(function (item) {
      return '<div class="expense-item-row">'
        + '<label class="field"><span>Название расхода</span><input type="text" data-expense-item-id="' + item.id + '" data-expense-item-field="name" value="' + escapeHtml(item.name) + '"></label>'
        + '<label class="field"><span>Сумма, ₽</span>' + moneyInput('data-expense-item-id="' + item.id + '" data-expense-item-field="amount"', item.amount) + '</label>'
        + '<button class="row-button" type="button" data-action="remove-expense" data-expense-item-id="' + item.id + '"' + (state.expenseItems.length === 1 ? ' disabled' : '') + '>Удалить</button>'
        + '</div>';
    }).join('');
  }

  function render() {
    var totals = calculateTable();
    if (elements.officeExpensesTotal) {
      elements.officeExpensesTotal.textContent = money(totals.expenses);
    }
    renderExpenseItems();
    elements.ownerSalesInput.value = formatMoneyInputValue(state.ownerSales);
    elements.officeRoyalty.textContent = money(totals.royaltyWithOwner);
    elements.agentsTableBody.innerHTML = state.agents.map(function (agent) {
      var row = totals.rows.find(function (item) {
        return item.source.id === agent.id;
      });
      return (row ? renderAgentRow(row) : renderBlankAgentRow(agent))
        + renderAgentDetailsRow(row, agent);
    }).join('');
    renderSummary(totals);
    renderDiagnosis(totals);
  }

  function getFocusSelector(element) {
    if (!element || !element.dataset) {
      return null;
    }
    if (element.dataset.officeField) {
      return '[data-office-field="' + element.dataset.officeField + '"]';
    }
    if (element.dataset.expenseItemId && element.dataset.expenseItemField) {
      return '[data-expense-item-id="' + element.dataset.expenseItemId + '"][data-expense-item-field="' + element.dataset.expenseItemField + '"]';
    }
    if (element.dataset.agentField && element.dataset.agentId) {
      return '[data-agent-field="' + element.dataset.agentField + '"][data-agent-id="' + element.dataset.agentId + '"]';
    }
    if (element.dataset.dealIndex !== undefined && element.dataset.agentId) {
      return '[data-deal-index="' + element.dataset.dealIndex + '"][data-agent-id="' + element.dataset.agentId + '"]';
    }
    if (element.dataset.rateIndex !== undefined && element.dataset.agentId) {
      return '[data-rate-index="' + element.dataset.rateIndex + '"][data-agent-id="' + element.dataset.agentId + '"]';
    }
    return null;
  }

  function renderPreservingFocus() {
    var active = document.activeElement;
    var focusSelector = getFocusSelector(active);
    var selectionStart = null;
    var selectionEnd = null;

    try {
      selectionStart = active && active.selectionStart;
      selectionEnd = active && active.selectionEnd;
    } catch (error) {
      selectionStart = null;
      selectionEnd = null;
    }

    render();

    if (focusSelector) {
      var nextActive = document.querySelector(focusSelector);
      if (nextActive) {
        nextActive.focus();
        if (typeof nextActive.setSelectionRange === 'function' && selectionStart !== null && selectionStart !== undefined) {
          try {
            nextActive.setSelectionRange(selectionStart, selectionEnd);
          } catch (error) {
            // Some input types, such as number, do not support text selection.
          }
        }
      }
    }
  }

  function findAgent(agentId) {
    return state.agents.find(function (agent) {
      return agent.id === agentId;
    });
  }

  function onInput(event) {
    var target = event.target;
    formatMoneyInputElement(target);
    if (target.dataset.officeField === 'expenses') {
      state.expenses = inputNumber(target.value);
      state.expenseItems = [];
      state.expenseCategories = [];
      renderPreservingFocus();
      return;
    }
    if (target.dataset.expenseItemId && target.dataset.expenseItemField) {
      state.expenseItems = normalizeExpenseItems(state.expenseItems);
      var expenseItem = state.expenseItems.find(function (item) {
        return item.id === target.dataset.expenseItemId;
      });
      if (expenseItem) {
        if (target.dataset.expenseItemField === 'amount') {
          expenseItem.amount = inputNumber(target.value);
        } else {
          expenseItem.name = target.value;
        }
        state.expenses = calculateExpenseItems(state.expenseItems);
      }
      renderPreservingFocus();
      return;
    }
    if (target.dataset.officeField === 'ownerSales') {
      state.ownerSales = inputNumber(target.value);
      renderPreservingFocus();
      return;
    }
    if (target.dataset.dealIndex !== undefined && target.dataset.agentId) {
      var dealAgent = findAgent(target.dataset.agentId);
      if (!dealAgent) {
        return;
      }
      dealAgent.commissionMode = 'exact';
      dealAgent.dealsInput = normalizeDealsInput(dealAgent.dealsInput);
      dealAgent.dealsInput[Number(target.dataset.dealIndex)] = normalizeInputNumber(target.value) === '' ? '' : inputNumber(target.value);
      syncExactAgentTotals(dealAgent);
      renderPreservingFocus();
      return;
    }
    if (target.dataset.rateIndex !== undefined && target.dataset.agentId) {
      var rateAgent = findAgent(target.dataset.agentId);
      if (!rateAgent) {
        return;
      }
      rateAgent.paymentType = 'boosted';
      rateAgent.boostedRates = normalizeBoostedRates(rateAgent.boostedRates);
      rateAgent.boostedRates[Number(target.dataset.rateIndex)] = inputNumber(target.value);
      renderPreservingFocus();
      return;
    }
    if (target.dataset.agentField && target.dataset.agentId) {
      var agent = findAgent(target.dataset.agentId);
      if (!agent) {
        return;
      }
      var field = target.dataset.agentField;
      if (field === 'name' || field === 'paymentType' || field === 'status') {
        agent[field] = target.value;
        if (field === 'paymentType' && agent.paymentType === 'boosted') {
          agent.boostedRates = normalizeBoostedRates(agent.boostedRates);
        }
      } else if (field === 'introduced') {
        agent.introduced = target.value === 'true';
      } else if (field === 'partnerConfirmed') {
        agent.partnerConfirmed = target.value === 'true';
      } else if (field === 'congressEnabled' || field === 'starEnabled') {
        agent.motivation = Object.assign({}, DEFAULT_MOTIVATION, agent.motivation || {});
        agent.motivation[field] = target.value === 'true';
        if (field === 'starEnabled' && agent.motivation.starEnabled) {
          state.agents.forEach(function (otherAgent) {
            if (otherAgent.id !== agent.id) {
              otherAgent.motivation = Object.assign({}, DEFAULT_MOTIVATION, otherAgent.motivation || {});
              otherAgent.motivation.starEnabled = false;
            }
          });
        }
      } else if (field === 'congressPerYear' || field === 'starPerYear') {
        agent.motivation = Object.assign({}, DEFAULT_MOTIVATION, agent.motivation || {});
        agent.motivation[field] = inputNumber(target.value);
      } else if (field === 'commissionMode') {
        agent.commissionMode = target.value === 'exact' ? 'exact' : 'quick';
        if (agent.commissionMode === 'exact') {
          agent.dealsInput = hasMeaningfulDeals(agent.dealsInput)
            ? normalizeDealsInput(agent.dealsInput)
            : splitCommissionIntoDeals(agent.commission, agent.dealCount);
          syncExactDealMetadata(agent);
          syncExactAgentTotals(agent);
        } else {
          agent.dealsInput = [];
          agent.dealDepositOrders = [];
          agent.dealNewbuildSoloFlags = [];
        }
      } else if (field === 'dealCount') {
        agent.dealCount = Math.max(1, Math.floor(inputNumber(target.value)));
      } else if (field === 'startingRate') {
        agent.startingRate = inputNumber(target.value);
        if (agent.paymentType === 'boosted') {
          agent.boostedRates = normalizeBoostedRates(agent.boostedRates);
          agent.boostedRates[0] = agent.startingRate;
        }
      } else {
        agent[field] = inputNumber(target.value);
        if (field === 'motivationReserve') {
          agent.motivation = Object.assign({}, DEFAULT_MOTIVATION, agent.motivation || {}, {
            mode: inputNumber(target.value) > 0 ? 'manual' : 'off',
            manualReserveMonthly: inputNumber(target.value)
          });
        }
      }
      if ((field === 'commission' || field === 'dealCount') && agent.commissionMode !== 'exact') {
        agent.dealsInput = [];
      }
      renderPreservingFocus();
    }
  }

  function onClick(event) {
    var action = event.target.closest('[data-action]');
    if (!action) {
      return;
    }
    if (action.dataset.action === 'load-a4') {
      var snapshot = loadSnapshotState();
      state = snapshot || createBlankState();
      elements.snapshotNotice.textContent = snapshot
        ? 'Данные из A4 загружены из локального snapshot.'
        : 'Данные из A4 не найдены. Можно заполнить таблицу вручную.';
      render();
    }
    if (action.dataset.action === 'clear-table') {
      if (!window.confirm('Очистить табличный расчёт? Данные на этой странице будут сброшены, A4-калькулятор не изменится.')) {
        return;
      }
      state = createBlankState();
      elements.snapshotNotice.textContent = 'Таблица очищена. Данные основной A4-страницы не изменены.';
      render();
    }
    if (action.dataset.action === 'add-agent') {
      state.agents.push(createBlankAgent());
      render();
    }
    if (action.dataset.action === 'toggle-agent-details') {
      expandedAgents[action.dataset.agentId] = !expandedAgents[action.dataset.agentId];
      render();
    }
    if (action.dataset.action === 'add-expense') {
      state.expenseItems = normalizeExpenseItems(state.expenseItems);
      state.expenseItems.push({ id: nextExpenseId(), name: 'Новый расход', amount: 0 });
      state.expenses = calculateExpenseItems(state.expenseItems);
      render();
    }
    if (action.dataset.action === 'remove-expense') {
      state.expenseItems = normalizeExpenseItems(state.expenseItems);
      if (state.expenseItems.length > 1) {
        state.expenseItems = state.expenseItems.filter(function (item) {
          return item.id !== action.dataset.expenseItemId;
        });
        state.expenses = calculateExpenseItems(state.expenseItems);
      }
      render();
    }
    if (action.dataset.action === 'add-deal') {
      var addDealAgent = findAgent(action.dataset.agentId);
      if (addDealAgent) {
        addDealAgent.commissionMode = 'exact';
        syncExactDealMetadata(addDealAgent);
        addDealAgent.dealsInput.push('');
        addDealAgent.dealDepositOrders.push('');
        addDealAgent.dealNewbuildSoloFlags.push(false);
        syncExactAgentTotals(addDealAgent);
        render();
      }
    }
    if (action.dataset.action === 'remove-deal') {
      var removeDealAgent = findAgent(action.dataset.agentId);
      if (removeDealAgent) {
        syncExactDealMetadata(removeDealAgent);
        if (removeDealAgent.dealsInput.length > 1) {
          var dealIndex = Number(action.dataset.dealIndex);
          removeDealAgent.dealsInput.splice(dealIndex, 1);
          removeDealAgent.dealDepositOrders.splice(dealIndex, 1);
          removeDealAgent.dealNewbuildSoloFlags.splice(dealIndex, 1);
        }
        syncExactAgentTotals(removeDealAgent);
        render();
      }
    }
    if (action.dataset.action === 'remove-agent') {
      if (!window.confirm('Удалить строку агента из таблицы? Введённые данные в этой строке будут потеряны.')) {
        return;
      }
      state.agents = state.agents.filter(function (agent) {
        return agent.id !== action.dataset.agentId;
      });
      if (!state.agents.length) {
        state.agents = createBlankAgents(DEFAULT_AGENT_ROWS);
      }
      render();
    }
  }

  function collectElements() {
    [
      'snapshotNotice',
      'officeExpensesTotal',
      'officeExpensesList',
      'ownerSalesInput',
      'officeRoyalty',
      'agentsTableBody',
      'officeSummary',
      'diagnosisBox'
    ].forEach(function (id) {
      elements[id] = document.getElementById(id);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    collectElements();
    state = createInitialState();
    elements.snapshotNotice.textContent = 'Таблица открыта пустой. Можно заполнить строки вручную или загрузить данные из A4 кнопкой выше.';
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
    render();
  });
}());
