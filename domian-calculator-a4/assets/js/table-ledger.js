(function () {
  'use strict';

  var SNAPSHOT_KEY = 'domianA4TableSnapshot';
  var SNAPSHOT_VERSION = 3;
  var LEDGER_DRAFT_KEY = 'domianA4LedgerDraftV1';
  var LEDGER_DRAFT_VERSION = 1;
  var DEFAULT_AGENT_NAME = 'Агент';
  var motivationPanelState = Object.create(null);
  var agentCounter = 0;
  var expenseCounter = 0;
  var dealCounter = 0;
  var ledgerMeta = createLedgerMeta();
  var ledgerSaveStatus = 'Изменения сохраняются автоматически';

  function nextAgentId() {
    agentCounter += 1;
    return 'ledger-agent-' + agentCounter;
  }

  function nextExpenseId() {
    expenseCounter += 1;
    return 'ledger-expense-' + expenseCounter;
  }

  function nextDealId() {
    dealCounter += 1;
    return 'ledger-deal-' + dealCounter;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeInputNumber(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[\s\u00a0\u202f]+/g, '')
      .replace(',', '.');
  }

  function readMoney(value) {
    var normalized = normalizeInputNumber(value);
    if (!normalized) {
      return 0;
    }
    var numeric = Number(normalized);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  }

  function readMoneyOrFallback(value, fallback) {
    if (value === undefined || value === null || String(value).trim() === '') {
      return readMoney(fallback);
    }
    return readMoney(value);
  }

  function firstDefined() {
    for (var i = 0; i < arguments.length; i += 1) {
      if (arguments[i] !== undefined && arguments[i] !== null) {
        return arguments[i];
      }
    }
    return undefined;
  }

  function normalizeSelectedMonth(value) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || '')) ? String(value) : '';
  }

  function formatInputMoney(value) {
    var numeric = readMoney(value);
    return numeric ? Math.round(numeric).toLocaleString('ru-RU') : '';
  }

  function moneyValue(value) {
    return Math.round(Number(value) || 0).toLocaleString('ru-RU') + ' ₽';
  }

  function percentValue(value) {
    return ((Number(value) || 0) * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + '%';
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
    return '<option value="' + escapeHtml(value) + '"' + (String(value) === String(current) ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
  }

  function isAgentActive(agent) {
    return getAgentCommission(agent) > 0;
  }

  function normalizeManualRate(value) {
    if (value === '' || value === null || value === undefined || String(value).trim() === '') {
      return '';
    }
    var numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : '';
  }

  function depositOrderToManualRate(value) {
    if (value === '' || value === null || value === undefined) {
      return '';
    }
    // Legacy snapshot migration only: converts deprecated dealDepositOrders.
    // Current deal rows and calculations use dealManualRates/newbuild flags.
    var order = Math.floor(readMoney(value));
    var legacyRates = (PAY_SCALES.standard.partner || []).map(function (rate) {
      return rate * 100;
    });
    return order > 0 ? legacyRates[Math.min(order - 1, legacyRates.length - 1)] : '';
  }

  function createDeal(amount, manualRate, isNewbuildSolo) {
    return {
      id: nextDealId(),
      amount: amount || 0,
      manualRate: normalizeManualRate(manualRate),
      isNewbuildSolo: Boolean(isNewbuildSolo),
      comment: ''
    };
  }

  function createAgent(name) {
    return {
      id: nextAgentId(),
      name: name || '',
      status: 'partner',
      paymentType: 'standard',
      fixedRate: PAY_SCALES.fixedDefault,
      boostedRates: clone(PAY_SCALES.boostedDefault),
      commissionMode: 'exact',
      quickCommission: 0,
      quickDealCount: 1,
      introduced: false,
      congressEnabled: true,
      congressPerYear: DEFAULT_MOTIVATION.congressPerYear,
      starEnabled: false,
      starPerYear: DEFAULT_MOTIVATION.starPerYear,
      motivationMode: DEFAULT_MOTIVATION.mode,
      partnerConfirmed: false,
      quarterlyCommission: 0,
      quarterlyDeposits: 0,
      halfYearCommission: 0,
      preTripQuarterDeposits: 0,
      travelQuarterPartnershipConfirmed: false,
      travelDecision: 'auto',
      stipendMode: DEFAULT_MOTIVATION.stipendMode,
      manualStipendMonthly: 0,
      manualReserveMonthly: 0,
      specialManualReserveEnabled: false,
      annualReserveMode: DEFAULT_MOTIVATION.annualReserveMode,
      manualAnnualReserveMonthly: 0,
      mountainSeaEnabled: false,
      mountainSeaPerTrip: DEFAULT_MOTIVATION.mountainSeaPerTrip,
      mountainSeaTripsPerYear: DEFAULT_MOTIVATION.mountainSeaTripsPerYear,
      travelEnabled: false,
      travelPerTrip: DEFAULT_MOTIVATION.travelPerTrip,
      travelTripsPerYear: DEFAULT_MOTIVATION.travelTripsPerYear,
      corporateEnabled: false,
      corporatePerYear: DEFAULT_MOTIVATION.corporatePerYear,
      motivationOverride: false,
      stipendOverride: false,
      mountainSeaOverride: false,
      travelOverride: false,
      eventsOverride: false,
      specialTermsOverride: false,
      manualExpenseShare: 0,
      deals: [createDeal(0)]
    };
  }

  function createExpense(name) {
    return {
      id: nextExpenseId(),
      name: name,
      amount: 0
    };
  }

  function createState() {
    return {
      selectedMonth: '',
      ownerSales: 0,
      expenses: [
        createExpense('Аренда'),
        createExpense('Зарплаты / администратор'),
        createExpense('Реклама'),
        createExpense('Связь / сервисы'),
        createExpense('Хозяйственные расходы'),
        createExpense('Прочее')
      ],
      agents: [createAgent('')]
    };
  }

  function createLedgerMeta() {
    return {
      sourceType: 'manual',
      snapshotSavedAt: '',
      loadedAt: '',
      modifiedAfterImport: false
    };
  }

  function normalizeTravelDecision(value) {
    return value === 'forceInclude' || value === 'forceExclude' ? value : 'auto';
  }

  function normalizeLedgerAgent(source) {
    var agentSource = source && typeof source === 'object' ? source : {};
    var normalized = Object.assign(createAgent(agentSource.name || ''), clone(agentSource));
    normalized.id = String(agentSource.id || normalized.id);
    normalized.status = agentSource.status === 'trainee' ? 'trainee' : 'partner';
    normalized.paymentType = normalized.status === 'trainee'
      ? 'standard'
      : (agentSource.paymentType === 'fixed' || agentSource.paymentType === 'boosted' ? agentSource.paymentType : 'standard');
    normalized.travelQuarterPartnershipConfirmed = agentSource.travelQuarterPartnershipConfirmed === true;
    normalized.travelDecision = normalizeTravelDecision(agentSource.travelDecision);
    normalized.deals = Array.isArray(agentSource.deals) && agentSource.deals.length
      ? agentSource.deals.map(function (dealSource) {
        var deal = createDeal(dealSource && dealSource.amount, dealSource && dealSource.manualRate, dealSource && dealSource.isNewbuildSolo);
        deal.id = String(dealSource && dealSource.id || deal.id);
        deal.comment = String(dealSource && dealSource.comment || '');
        return deal;
      })
      : [createDeal(0)];
    return normalized;
  }

  function normalizeLedgerDraftState(source) {
    if (!source || typeof source !== 'object') {
      return null;
    }
    var normalized = createState();
    normalized.selectedMonth = normalizeSelectedMonth(source.selectedMonth);
    normalized.ownerSales = readMoney(source.ownerSales);
    normalized.expenses = Array.isArray(source.expenses)
      ? source.expenses.map(function (expense) {
        return {
          id: String(expense && expense.id || nextExpenseId()),
          name: String(expense && expense.name || ''),
          amount: readMoney(expense && expense.amount)
        };
      })
      : normalized.expenses;
    normalized.agents = Array.isArray(source.agents) && source.agents.length
      ? source.agents.map(normalizeLedgerAgent)
      : normalized.agents;
    return normalized;
  }

  function syncCountersFromState(nextState) {
    function maxSuffix(items, pattern) {
      return (items || []).reduce(function (maximum, item) {
        var match = String(item && item.id || '').match(pattern);
        return match ? Math.max(maximum, Number(match[1]) || 0) : maximum;
      }, 0);
    }
    agentCounter = Math.max(agentCounter, maxSuffix(nextState.agents, /^ledger-agent-(\d+)$/));
    expenseCounter = Math.max(expenseCounter, maxSuffix(nextState.expenses, /^ledger-expense-(\d+)$/));
    dealCounter = Math.max(dealCounter, (nextState.agents || []).reduce(function (maximum, agent) {
      return Math.max(maximum, maxSuffix(agent.deals, /^ledger-deal-(\d+)$/));
    }, 0));
  }

  function loadLedgerDraft() {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return null;
    }
    try {
      var raw = localStorage.getItem(LEDGER_DRAFT_KEY);
      if (!raw) {
        return null;
      }
      var payload = JSON.parse(raw);
      if (!payload || payload.version !== LEDGER_DRAFT_VERSION) {
        return null;
      }
      var restoredState = normalizeLedgerDraftState(payload.state);
      if (!restoredState) {
        return null;
      }
      return {
        state: restoredState,
        savedAt: String(payload.savedAt || ''),
        meta: Object.assign(createLedgerMeta(), payload.meta || {})
      };
    } catch (error) {
      return null;
    }
  }

  function formatSavedAt(value) {
    if (!value) {
      return '';
    }
    var parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      return '';
    }
    return parsed.toLocaleString('ru-RU');
  }

  function saveLedgerDraft(reason) {
    if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') {
      ledgerSaveStatus = 'Не удалось сохранить черновик';
      renderLifecycleStatus();
      return false;
    }
    try {
      var savedAt = new Date().toISOString();
      if (reason === 'manual-change' && ledgerMeta.sourceType === 'a4') {
        ledgerMeta.modifiedAfterImport = true;
      }
      localStorage.setItem(LEDGER_DRAFT_KEY, JSON.stringify({
        version: LEDGER_DRAFT_VERSION,
        savedAt: savedAt,
        meta: clone(ledgerMeta),
        state: clone(state)
      }));
      ledgerSaveStatus = 'Сохранено: ' + formatSavedAt(savedAt);
      renderLifecycleStatus();
      return true;
    } catch (error) {
      ledgerSaveStatus = 'Не удалось сохранить черновик';
      renderLifecycleStatus();
      return false;
    }
  }

  function clearLedgerDraft() {
    try {
      localStorage.removeItem(LEDGER_DRAFT_KEY);
    } catch (error) {
      // The in-memory clear still succeeds when storage is unavailable.
    }
    ledgerMeta = createLedgerMeta();
    ledgerSaveStatus = 'Черновик очищен';
    renderLifecycleStatus();
  }

  var restoredDraft = loadLedgerDraft();
  var state = restoredDraft ? restoredDraft.state : createState();
  if (restoredDraft) {
    ledgerMeta = restoredDraft.meta;
    ledgerSaveStatus = 'Черновик восстановлен' + (restoredDraft.savedAt ? ': ' + formatSavedAt(restoredDraft.savedAt) : '');
  }
  syncCountersFromState(state);

  function getAgentCommission(agent) {
    if (agent.commissionMode === 'quick') {
      return readMoney(agent.quickCommission);
    }
    return (agent.deals || []).reduce(function (sum, deal) {
      return sum + readMoney(deal.amount);
    }, 0);
  }

  function getAgentDealCount(agent) {
    if (agent.commissionMode === 'quick') {
      return Math.max(1, Math.floor(readMoney(agent.quickDealCount)) || 1);
    }
    return Math.max(1, (agent.deals || []).length);
  }

  function getAgentDealsInput(agent) {
    if (agent.commissionMode === 'quick') {
      var count = getAgentDealCount(agent);
      var total = getAgentCommission(agent);
      var split = count ? total / count : 0;
      var result = [];
      for (var i = 0; i < count; i += 1) {
        result.push(split);
      }
      return result;
    }
    return (agent.deals || []).map(function (deal) {
      return readMoney(deal.amount);
    });
  }

  function getAgentDealManualRates(agent) {
    if (agent.commissionMode === 'quick') {
      return [];
    }
    return (agent.deals || []).map(function (deal) {
      return normalizeManualRate(deal.manualRate);
    });
  }

  function getAgentDealNewbuildSoloFlags(agent) {
    if (agent.commissionMode === 'quick') {
      return [];
    }
    return (agent.deals || []).map(function (deal) {
      return Boolean(deal.isNewbuildSolo);
    });
  }

  function convertQuickAgentToExact(agent, appendEmptyDeal) {
    if (!agent) {
      return;
    }
    if (agent.commissionMode === 'quick') {
      var count = getAgentDealCount(agent);
      var total = getAgentCommission(agent);
      var split = count ? total / count : 0;
      agent.deals = [];
      for (var i = 0; i < count; i += 1) {
        agent.deals.push(createDeal(split));
      }
      agent.commissionMode = 'exact';
    }
    if (!agent.deals || !agent.deals.length) {
      agent.deals = [createDeal(0)];
    }
    if (appendEmptyDeal) {
      agent.deals.push(createDeal(0));
    }
  }

  function buildCalculationAgent(agent) {
    var commission = getAgentCommission(agent);
    var dealsInput = getAgentDealsInput(agent);
    return {
      id: agent.id,
      name: agent.name || '',
      commission: commission,
      dealCount: getAgentDealCount(agent),
      commissionMode: agent.commissionMode,
      dealsInput: dealsInput,
      dealManualRates: getAgentDealManualRates(agent),
      dealNewbuildSoloFlags: getAgentDealNewbuildSoloFlags(agent),
      paymentType: agent.paymentType,
      status: agent.status,
      fixedRate: agent.fixedRate === undefined || agent.fixedRate === null || agent.fixedRate === ''
        ? PAY_SCALES.fixedDefault
        : readMoney(agent.fixedRate),
      startingRate: agent.startingRate === undefined || agent.startingRate === null || agent.startingRate === ''
        ? PAY_SCALES.boostedStartingDefault
        : readMoney(agent.startingRate),
      boostedRates: agent.boostedRates || PAY_SCALES.boostedDefault,
      introduced: Boolean(agent.introduced),
      partnerConfirmed: Boolean(agent.partnerConfirmed),
      quarterlyCommission: readMoney(agent.quarterlyCommission),
      quarterlyDeposits: readMoney(agent.quarterlyDeposits),
      halfYearCommission: readMoney(agent.halfYearCommission),
      preTripQuarterDeposits: readMoney(agent.preTripQuarterDeposits),
      travelQuarterPartnershipConfirmed: agent.travelQuarterPartnershipConfirmed === true,
      travelDecision: normalizeTravelDecision(agent.travelDecision),
      motivationOverride: Boolean(agent.motivationOverride),
      stipendOverride: Boolean(agent.stipendOverride),
      mountainSeaOverride: Boolean(agent.mountainSeaOverride),
      travelOverride: Boolean(agent.travelOverride),
      eventsOverride: Boolean(agent.eventsOverride),
      specialTermsOverride: Boolean(agent.specialTermsOverride),
      motivation: Object.assign({}, DEFAULT_MOTIVATION, {
        mode: agent.motivationMode || DEFAULT_MOTIVATION.mode,
        stipendMode: agent.stipendMode || DEFAULT_MOTIVATION.stipendMode,
        manualStipendMonthly: readMoney(agent.manualStipendMonthly),
        manualReserveMonthly: readMoney(agent.manualReserveMonthly),
        quarterlyCommission: readMoney(agent.quarterlyCommission),
        quarterlyDeposits: readMoney(agent.quarterlyDeposits),
        partnerConfirmed: Boolean(agent.partnerConfirmed),
        halfYearCommission: readMoney(agent.halfYearCommission),
        preTripQuarterDeposits: readMoney(agent.preTripQuarterDeposits),
        annualReserveMode: agent.annualReserveMode || DEFAULT_MOTIVATION.annualReserveMode,
        manualAnnualReserveMonthly: readMoney(agent.manualAnnualReserveMonthly),
        specialManualReserveEnabled: Boolean(agent.specialManualReserveEnabled),
        mountainSeaEnabled: Boolean(agent.mountainSeaEnabled),
        mountainSeaPerTrip: readMoneyOrFallback(agent.mountainSeaPerTrip, DEFAULT_MOTIVATION.mountainSeaPerTrip),
        mountainSeaTripsPerYear: readMoneyOrFallback(agent.mountainSeaTripsPerYear, DEFAULT_MOTIVATION.mountainSeaTripsPerYear),
        travelEnabled: Boolean(agent.travelEnabled),
        travelPerTrip: readMoneyOrFallback(agent.travelPerTrip, DEFAULT_MOTIVATION.travelPerTrip),
        travelTripsPerYear: readMoneyOrFallback(agent.travelTripsPerYear, DEFAULT_MOTIVATION.travelTripsPerYear),
        corporateEnabled: Boolean(agent.corporateEnabled),
        corporatePerYear: readMoneyOrFallback(agent.corporatePerYear, DEFAULT_MOTIVATION.corporatePerYear),
        congressEnabled: Boolean(agent.congressEnabled),
        congressPerYear: readMoneyOrFallback(agent.congressPerYear, DEFAULT_MOTIVATION.congressPerYear),
        starEnabled: Boolean(agent.starEnabled),
        starPerYear: readMoneyOrFallback(agent.starPerYear, DEFAULT_MOTIVATION.starPerYear)
      })
    };
  }

  function buildOfficeState() {
    return {
      selectedMonth: state.selectedMonth,
      expenses: state.expenses.map(function (expense) {
        return { id: expense.id, name: expense.name, amount: readMoney(expense.amount) };
      }),
      ownerSales: readMoney(state.ownerSales),
      agents: state.agents.map(buildCalculationAgent)
    };
  }

  function getOfficeResult() {
    return calculateOffice(buildOfficeState());
  }

  function getAgentResult(agent) {
    return calculateAgent(buildCalculationAgent(agent));
  }

  function getAgentEconomics(agent, officeResult) {
    return (officeResult.agentEconomics || []).find(function (item) {
      return item.id === agent.id;
    }) || null;
  }

  function getDistributedRoyalty(dealAmount, officeResult) {
    var agentTurnover = officeResult.agentTurnover || 0;
    if (!agentTurnover) {
      return 0;
    }
    return (officeResult.royaltyWithoutOwner || 0) * dealAmount / agentTurnover;
  }

  function getMotivationBreakdown(result) {
    var motivation = result && result.motivation ? result.motivation : {};
    var congress = Number(motivation.congressMonthly) || 0;
    var star = Number(motivation.starMonthly) || 0;
    var total = Number(result && result.motivationReserve) || 0;
    var standard = Math.max(0, total - congress - star);
    return {
      standard: standard,
      congress: congress,
      star: star,
      total: total
    };
  }

  function getOfficeMotivationBreakdown(officeResult) {
    return (officeResult.agents || []).reduce(function (total, agentResult) {
      var part = getMotivationBreakdown(agentResult);
      total.standard += part.standard;
      total.congress += part.congress;
      total.star += part.star;
      total.all += part.total;
      return total;
    }, { standard: 0, congress: 0, star: 0, all: 0 });
  }

  function monthlyFromYearly(value) {
    return (Number(value) || 0) / 12;
  }

  function preserveFocus(callback) {
    var active = document.activeElement;
    var selector = null;
    var start = null;
    var end = null;
    if (active && active.dataset && active.dataset.focusKey) {
      selector = '[data-focus-key="' + active.dataset.focusKey + '"]';
      start = active.selectionStart;
      end = active.selectionEnd;
    }
    callback();
    if (selector) {
      var restored = document.querySelector(selector);
      if (restored) {
        restored.focus();
        if (typeof start === 'number' && typeof restored.setSelectionRange === 'function') {
          var length = restored.value.length;
          restored.setSelectionRange(Math.min(start, length), Math.min(end, length));
        }
      }
    }
  }

  function isMotivationPanelOpen(agentId) {
    return Boolean(motivationPanelState[agentId]);
  }

  function setMotivationPanelOpen(agentId, isOpen) {
    if (!agentId) {
      return;
    }
    if (isOpen) {
      motivationPanelState[agentId] = true;
      return;
    }
    delete motivationPanelState[agentId];
  }

  function render() {
    var officeResult = getOfficeResult();
    renderExpenses();
    renderTable(officeResult);
    renderSummary(officeResult);
    updateTop(officeResult);
    renderLifecycleStatus();
  }

  function renderLifecycleStatus() {
    var monthNode = document.getElementById('ledgerSelectedMonth');
    var sourceNode = document.getElementById('ledgerDataSource');
    var saveNode = document.getElementById('ledgerSaveStatus');
    if (monthNode) {
      monthNode.textContent = state && state.selectedMonth
        ? 'Месяц: ' + state.selectedMonth
        : 'Месяц: не указан';
    }
    if (sourceNode) {
      if (ledgerMeta.sourceType === 'a4') {
        sourceNode.textContent = 'Источник: A4'
          + (ledgerMeta.snapshotSavedAt ? ', snapshot ' + formatSavedAt(ledgerMeta.snapshotSavedAt) : '')
          + (ledgerMeta.loadedAt ? ', загружено ' + formatSavedAt(ledgerMeta.loadedAt) : '')
          + (ledgerMeta.modifiedAfterImport ? ', есть ручные изменения' : '');
      } else {
        sourceNode.textContent = 'Источник: ручная ведомость';
      }
    }
    if (saveNode) {
      saveNode.textContent = ledgerSaveStatus;
    }
  }

  function rerender() {
    preserveFocus(render);
  }

  function renderExpenses() {
    var list = document.getElementById('expensesList');
    if (!list) {
      return;
    }
    list.innerHTML = state.expenses.map(function (expense) {
      return '<div class="expense-row" data-expense-id="' + expense.id + '">'
        + '<input class="text-cell" data-focus-key="expense-name-' + expense.id + '" data-expense-field="name" data-expense-id="' + expense.id + '" value="' + escapeHtml(expense.name) + '" placeholder="Название расхода">'
        + '<input class="money-cell" inputmode="numeric" autocomplete="off" data-focus-key="expense-amount-' + expense.id + '" data-expense-field="amount" data-expense-id="' + expense.id + '" value="' + escapeHtml(formatInputMoney(expense.amount)) + '">'
        + '<button class="small danger" type="button" data-action="remove-expense" data-expense-id="' + expense.id + '">Удалить</button>'
        + '</div>';
    }).join('');
  }

  function renderAgentSetupRow(agent, officeResult) {
    var starTakenBy = state.agents.find(function (candidate) {
      return candidate.id !== agent.id && candidate.starEnabled;
    });
    var starDisabled = starTakenBy ? ' disabled' : '';
    var starTitle = starTakenBy ? ' title="Звезда уже назначена: ' + escapeHtml(starTakenBy.name || DEFAULT_AGENT_NAME) + '"' : '';
    var fixedDisabled = agent.paymentType === 'fixed' ? '' : ' disabled';
    var startingDisabled = agent.paymentType === 'boosted' ? '' : ' disabled';
    var result = getAgentResult(agent);
    var motivation = result.motivation || {};
    var stipendText = motivation.stipendMonthly ? 'Стипендия: ' + moneyValue(motivation.stipendMonthly) : 'Стипендия: нет';
    var congressText = 'Конгресс учтён: ' + moneyValue(monthlyFromYearly(readMoneyOrFallback(agent.congressPerYear, DEFAULT_MOTIVATION.congressPerYear))) + '/мес';
    var starText = agent.starEnabled ? 'Звезда учтена: ' + moneyValue(monthlyFromYearly(readMoneyOrFallback(agent.starPerYear, DEFAULT_MOTIVATION.starPerYear))) + '/мес' : (starTakenBy ? 'Звезда уже у ' + (starTakenBy.name || DEFAULT_AGENT_NAME) : 'Звезда: нет');
    var motivationPanelOpen = isMotivationPanelOpen(agent.id);
    var paymentOptions = agent.status === 'trainee'
      ? option('standard', 'Стандарт', 'standard')
      : option('standard', 'Стандарт', agent.paymentType) + option('boosted', 'Повышенная', agent.paymentType) + option('fixed', 'Фикс', agent.paymentType);
    var traineeWarning = result.traineeScaleExceeded
      ? '<div class="notice warning trainee-ledger-warning"><strong>' + escapeHtml(result.traineeScaleWarning) + '</strong><span> Расчёт продолжен по соответствующим партнёрским ступеням.</span></div>'
      : '';

    return '<tr class="agent-setup-row" data-agent-id="' + agent.id + '">'
      + '<td colspan="14">'
      + '<div class="agent-setup-grid">'
      + '<label>Агент<input class="text-cell" data-focus-key="agent-name-' + agent.id + '" data-agent-field="name" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.name || '') + '" placeholder="Агент"></label>'
      + '<label>Статус<select data-agent-field="status" data-agent-id="' + agent.id + '">' + option('partner', 'Партнёр', agent.status) + option('trainee', 'Стажёр', agent.status) + '</select></label>'
      + '<label>Схема<select data-agent-field="paymentType" data-agent-id="' + agent.id + '"' + (agent.status === 'trainee' ? ' disabled' : '') + '>' + paymentOptions + '</select></label>'
      + '<label>Старт, %<input class="small-cell" inputmode="numeric" data-focus-key="starting-' + agent.id + '" data-agent-field="startingRate" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.startingRate) + '"' + startingDisabled + '></label>'
      + '<label>Фикс, %<input class="small-cell" inputmode="numeric" data-focus-key="fixed-' + agent.id + '" data-agent-field="fixedRate" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.fixedRate) + '"' + fixedDisabled + '></label>'
      + '<label>Режим сделок<select data-agent-field="commissionMode" data-agent-id="' + agent.id + '">' + option('exact', 'Точно', agent.commissionMode) + option('quick', 'Быстро', agent.commissionMode) + '</select></label>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="introduced" data-agent-id="' + agent.id + '"' + (agent.introduced ? ' checked' : '') + '> Приведённый</label>'
      + '<label class="flag-box mandatory"><input type="checkbox" data-agent-field="congressEnabled" data-agent-id="' + agent.id + '"' + (agent.congressEnabled ? ' checked' : '') + '> ' + congressText + '</label>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="starEnabled" data-agent-id="' + agent.id + '"' + (agent.starEnabled ? ' checked' : '') + starDisabled + starTitle + '> ' + escapeHtml(starText) + '</label>'
      + '</div>'
      + traineeWarning
      + '<details class="motivation-ledger-panel" data-motivation-panel-id="' + agent.id + '"' + (motivationPanelOpen ? ' open' : '') + '>'
      + '<summary>Мотивации и партнёрство <span>' + escapeHtml(stipendText) + ', всего: ' + moneyValue(getMotivationBreakdown(result).standard) + '</span></summary>'
      + '<div class="motivation-ledger-grid">'
      + '<label>Режим мотиваций<select data-agent-field="motivationMode" data-agent-id="' + agent.id + '">' + option('rules', 'По правилам', agent.motivationMode) + option('off', 'Не учитывать стандартные', agent.motivationMode) + option('manual', 'Ручной резерв', agent.motivationMode) + '</select></label>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="partnerConfirmed" data-agent-id="' + agent.id + '"' + (agent.partnerConfirmed ? ' checked' : '') + '> Партнёрство подтверждено</label>'
      + '<label>Квартал, комиссия<input class="money-cell" inputmode="numeric" data-focus-key="quarterly-commission-' + agent.id + '" data-agent-field="quarterlyCommission" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.quarterlyCommission)) + '"></label>'
      + '<label>Квартал, задатки<input class="money-cell" inputmode="numeric" data-focus-key="quarterly-deposits-' + agent.id + '" data-agent-field="quarterlyDeposits" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.quarterlyDeposits)) + '"></label>'
      + '<label>Стипендия<select data-agent-field="stipendMode" data-agent-id="' + agent.id + '">' + option('auto', 'Авто', agent.stipendMode || 'auto') + option('manual', 'Вручную', agent.stipendMode) + option('off', 'Не учитывать', agent.stipendMode) + '</select></label>'
      + '<label>Ручная стипендия/мес<input class="money-cell" inputmode="numeric" data-focus-key="manual-stipend-' + agent.id + '" data-agent-field="manualStipendMonthly" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.manualStipendMonthly)) + '"></label>'
      + '<label>Полугодие, комиссия<input class="money-cell" inputmode="numeric" data-focus-key="halfyear-' + agent.id + '" data-agent-field="halfYearCommission" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.halfYearCommission)) + '"></label>'
      + '<label>Задатки перед поездкой<input class="money-cell" inputmode="numeric" data-focus-key="pretrip-' + agent.id + '" data-agent-field="preTripQuarterDeposits" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.preTripQuarterDeposits)) + '"></label>'
      + '<label>Партнёрство перед поездкой<select data-agent-field="travelQuarterPartnershipConfirmed" data-agent-id="' + agent.id + '">' + option('false', 'Не подтверждено', String(agent.travelQuarterPartnershipConfirmed === true)) + option('true', 'Подтверждено', String(agent.travelQuarterPartnershipConfirmed === true)) + '</select></label>'
      + '<label>Решение по поездке<select data-agent-field="travelDecision" data-agent-id="' + agent.id + '">' + option('auto', 'Авто по правилу', agent.travelDecision) + option('forceInclude', 'Включить вручную', agent.travelDecision) + option('forceExclude', 'Исключить вручную', agent.travelDecision) + '</select></label>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="mountainSeaEnabled" data-agent-id="' + agent.id + '"' + (agent.mountainSeaEnabled ? ' checked' : '') + '> Море/Горы</label>'
      + '<label>Море/Горы, ₽ за поездку<input class="money-cell" inputmode="numeric" data-focus-key="mountain-sea-trip-' + agent.id + '" data-agent-field="mountainSeaPerTrip" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.mountainSeaPerTrip)) + '"></label>'
      + '<label>Кол-во Море/Горы<input class="small-cell" inputmode="numeric" data-focus-key="mountain-sea-count-' + agent.id + '" data-agent-field="mountainSeaTripsPerYear" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.mountainSeaTripsPerYear) + '"></label>'
      + '<label>Путешествие, ₽ за поездку<input class="money-cell" inputmode="numeric" data-focus-key="travel-trip-' + agent.id + '" data-agent-field="travelPerTrip" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.travelPerTrip)) + '"></label>'
      + '<label>Кол-во путешествий<input class="small-cell" inputmode="numeric" data-focus-key="travel-count-' + agent.id + '" data-agent-field="travelTripsPerYear" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.travelTripsPerYear) + '"></label>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="corporateEnabled" data-agent-id="' + agent.id + '"' + (agent.corporateEnabled ? ' checked' : '') + '> Корпоратив</label>'
      + '<label>Корпоратив, ₽/год<input class="money-cell" inputmode="numeric" data-focus-key="corporate-' + agent.id + '" data-agent-field="corporatePerYear" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.corporatePerYear)) + '"></label>'
      + '<label>Ручной резерв, ₽/мес<input class="money-cell" inputmode="numeric" data-focus-key="manual-reserve-' + agent.id + '" data-agent-field="manualReserveMonthly" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.manualReserveMonthly)) + '"></label>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="specialManualReserveEnabled" data-agent-id="' + agent.id + '"' + (agent.specialManualReserveEnabled ? ' checked' : '') + '> Учитывать ручной резерв при особых условиях</label>'
      + '</div>'
      + '</details>'
      + '<div class="agent-row-actions"><button class="small danger" type="button" data-action="remove-agent" data-agent-id="' + agent.id + '"' + (state.agents.length === 1 ? ' disabled' : '') + '>Удалить агента</button></div>'
      + '</td>'
      + '</tr>';
  }

  function renderExactDealRow(agent, deal, index, officeResult) {
    var calculated = calculateAgent(buildCalculationAgent(agent));
    var metric = (calculated.deals || []).find(function (item) {
      return item.sourceIndex === index;
    });
    var amount = readMoney(deal.amount);
    var rate = metric ? metric.rate : getDealRate(buildCalculationAgent(agent), index);
    // Empty exact rows are omitted by calculateAgent(). The shared rate helper
    // is display-only there; payout/referral stay zero until the engine emits a metric.
    var payout = metric ? metric.payout : 0;
    var referral = metric && calculated.commission
      ? calculated.referral * metric.commission / calculated.commission
      : 0;
    var royalty = getDistributedRoyalty(amount, officeResult);
    var isSmallOrdinaryDeal = amount > 0
      && amount < readMoney(window.QUALIFYING_DEAL_COMMISSION_THRESHOLD || 50000)
      && !deal.isNewbuildSolo;
    var manualRateControl = agent.paymentType === 'fixed'
      ? ''
      : '<label>Процент для этой сделки, %<input class="small-cell" type="number" min="0" max="100" step="1" autocomplete="off" data-focus-key="manual-rate-' + deal.id + '" data-deal-field="manualRate" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '" value="' + escapeHtml(deal.manualRate) + '" placeholder="авто"' + (isSmallOrdinaryDeal ? ' disabled' : '') + '>'
        + '<small>' + (isSmallOrdinaryDeal ? 'Для обычной сделки меньше 50 000 ₽ применяется 45%.' : 'Пусто — автоматическая шкала.') + '</small></label>';
    return '<tr class="deal-row" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '">'
      + '<td class="empty-note">' + escapeHtml(agent.name || DEFAULT_AGENT_NAME) + '</td>'
      + '<td class="number-cell">' + (index + 1) + '</td>'
      + '<td><input class="money-cell" inputmode="numeric" autocomplete="off" data-focus-key="deal-' + deal.id + '" data-deal-field="amount" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '" value="' + escapeHtml(formatInputMoney(deal.amount)) + '">'
      + '<div class="ledger-deal-meta">'
      + manualRateControl
      + '<label class="ledger-deal-flag"><input type="checkbox" data-deal-field="isNewbuildSolo" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '"' + (deal.isNewbuildSolo ? ' checked' : '') + '> Новостройка, один агент</label>'
      + '</div></td>'
      + '<td><span class="percent-pill">' + percentValue(rate) + '</span></td>'
      + '<td class="calc-cell">' + moneyValue(payout) + '</td>'
      + '<td class="calc-cell">' + moneyValue(referral) + '</td>'
      + '<td class="calc-cell">' + moneyValue(royalty) + '</td>'
      + '<td class="empty-note">—</td>'
      + '<td class="empty-note">' + (index === 0 && agent.congressEnabled && isAgentActive(agent) ? '✓' : '') + '</td>'
      + '<td class="empty-note">' + (index === 0 && agent.starEnabled && isAgentActive(agent) ? '✓' : '') + '</td>'
      + '<td class="empty-note">—</td>'
      + '<td class="empty-note">—</td>'
      + '<td><input class="text-cell" data-focus-key="comment-' + deal.id + '" data-deal-field="comment" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '" value="' + escapeHtml(deal.comment || '') + '" placeholder="Комментарий"></td>'
      + '<td><button class="small danger" type="button" data-action="remove-deal" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '"' + (agent.deals.length === 1 ? ' disabled' : '') + '>×</button></td>'
      + '</tr>';
  }

  function renderQuickRows(agent, officeResult) {
    var count = getAgentDealCount(agent);
    var total = getAgentCommission(agent);
    var split = count ? total / count : 0;
    var calculated = calculateAgent(buildCalculationAgent(agent));
    var rows = '';
    for (var i = 0; i < count; i += 1) {
      var metric = (calculated.deals || [])[i];
      var rate = metric ? metric.rate : 0;
      var payout = metric ? metric.payout : 0;
      var referral = metric && calculated.commission
        ? calculated.referral * metric.commission / calculated.commission
        : 0;
      rows += '<tr class="deal-row quick-row" data-agent-id="' + agent.id + '">'
        + '<td class="empty-note">' + escapeHtml(agent.name || DEFAULT_AGENT_NAME) + '</td>'
        + '<td class="number-cell">' + (i + 1) + '</td>'
        + '<td>' + (i === 0 ? '<input class="money-cell" inputmode="numeric" data-focus-key="quick-commission-' + agent.id + '" data-agent-field="quickCommission" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.quickCommission)) + '" placeholder="общая сумма">' : moneyValue(split)) + '</td>'
        + '<td><span class="percent-pill">' + percentValue(rate) + '</span></td>'
        + '<td class="calc-cell">' + moneyValue(payout) + '</td>'
        + '<td class="calc-cell">' + moneyValue(referral) + '</td>'
        + '<td class="calc-cell">' + moneyValue(getDistributedRoyalty(split, officeResult)) + '</td>'
        + '<td class="empty-note">—</td>'
        + '<td class="empty-note">' + (i === 0 && agent.congressEnabled && isAgentActive(agent) ? '✓' : '') + '</td>'
        + '<td class="empty-note">' + (i === 0 && agent.starEnabled && isAgentActive(agent) ? '✓' : '') + '</td>'
        + '<td class="empty-note">—</td>'
        + '<td class="empty-note">—</td>'
        + '<td class="empty-note">быстрый режим</td>'
        + '<td>' + (i === 0 ? '<input class="small-cell" inputmode="numeric" data-focus-key="quick-count-' + agent.id + '" data-agent-field="quickDealCount" data-agent-id="' + agent.id + '" value="' + escapeHtml(count) + '" title="Количество сделок">' : '') + '</td>'
        + '</tr>';
    }
    return rows;
  }

  function renderAgentTotalRow(agent, officeResult) {
    var result = getAgentResult(agent);
    var economics = getAgentEconomics(agent, officeResult) || {};
    var contribution = economics.contribution !== undefined ? economics.contribution : 0;
    var contributionClass = contribution >= 0 ? 'positive' : 'negative';
    return '<tr class="agent-total-row" data-agent-id="' + agent.id + '">'
      + '<td class="agent-total-label" colspan="2">Итого ' + escapeHtml(agent.name || DEFAULT_AGENT_NAME) + '</td>'
      + '<td>' + moneyValue(result.commission) + '</td>'
      + '<td></td>'
      + '<td>' + moneyValue(result.payout) + '</td>'
      + '<td>' + moneyValue(result.referral) + '</td>'
      + '<td>' + moneyValue(economics.royaltyShare || 0) + '</td>'
      + '<td>' + moneyValue(getMotivationBreakdown(result).standard) + '</td>'
      + '<td>' + moneyValue(getMotivationBreakdown(result).congress) + '</td>'
      + '<td>' + moneyValue(getMotivationBreakdown(result).star) + '</td>'
      + '<td>' + moneyValue(economics.expenseShare || 0) + '</td>'
      + '<td class="' + contributionClass + '">' + moneyValue(contribution) + '</td>'
      + '<td colspan="2"><button class="small" type="button" data-action="add-deal-to-agent" data-agent-id="' + agent.id + '">+ Сделка</button></td>'
      + '</tr>';
  }

  function renderTable(officeResult) {
    var body = document.getElementById('ledgerBody');
    var foot = document.getElementById('ledgerFoot');
    if (!body || !foot) {
      return;
    }
    var rows = [];
    state.agents.forEach(function (agent) {
      rows.push(renderAgentSetupRow(agent, officeResult));
      if (agent.commissionMode === 'quick') {
        rows.push(renderQuickRows(agent, officeResult));
      } else {
        (agent.deals || []).forEach(function (deal, index) {
          rows.push(renderExactDealRow(agent, deal, index, officeResult));
        });
      }
      rows.push(renderAgentTotalRow(agent, officeResult));
    });
    body.innerHTML = rows.join('');
    var officeMotivation = getOfficeMotivationBreakdown(officeResult);
    foot.innerHTML = '<tr class="office-total-row">'
      + '<td colspan="2">ИТОГО ПО ОФИСУ</td>'
      + '<td>' + moneyValue(officeResult.agentTurnover) + '</td>'
      + '<td></td>'
      + '<td>' + moneyValue(officeResult.agentPayouts) + '</td>'
      + '<td>' + moneyValue(officeResult.referrals) + '</td>'
      + '<td>' + moneyValue(officeResult.royaltyWithoutOwner) + '</td>'
      + '<td>' + moneyValue(officeMotivation.standard) + '</td>'
      + '<td>' + moneyValue(officeMotivation.congress) + '</td>'
      + '<td>' + moneyValue(officeMotivation.star) + '</td>'
      + '<td>' + moneyValue(officeResult.expenses) + '</td>'
      + '<td>' + moneyValue(officeResult.resultWithoutOwner) + '</td>'
      + '<td colspan="2">С собственником: ' + moneyValue(officeResult.resultWithOwner) + '</td>'
      + '</tr>';
  }

  function updateTop(officeResult) {
    var expenseTotal = document.querySelector('[data-office-expenses-total]');
    var royalty = document.querySelector('[data-office-royalty]');
    var royaltyRate = document.querySelector('[data-office-royalty-rate]');
    if (expenseTotal) expenseTotal.textContent = moneyValue(officeResult.expenses);
    if (royalty) royalty.textContent = moneyValue(officeResult.royaltyWithoutOwner);
    if (royaltyRate) royaltyRate.textContent = 'Ставка: ' + percentValue(getRoyaltyRate(officeResult.agentTurnover));
  }

  function renderAgentSummaryTable(officeResult) {
    var activeAgents = state.agents.filter(isAgentActive);
    var totals = {
      commission: 0,
      payout: 0,
      referral: 0,
      royalty: 0,
      motivation: 0,
      congress: 0,
      star: 0,
      expenses: 0,
      contribution: 0
    };

    if (!activeAgents.length) {
      return '<div class="agent-summary-empty">Активных агентов пока нет. Добавь сделки в ведомость выше.</div>';
    }

    var rows = activeAgents.map(function (agent) {
      var result = getAgentResult(agent);
      var economics = getAgentEconomics(agent, officeResult) || {};
      var motivationPart = getMotivationBreakdown(result);
      var congress = motivationPart.congress;
      var star = motivationPart.star;
      var standardMotivation = motivationPart.standard;
      var royalty = economics.royaltyShare || 0;
      var expenses = economics.expenseShare || 0;
      var contribution = economics.contribution !== undefined ? economics.contribution : 0;

      totals.commission += result.commission || 0;
      totals.payout += result.payout || 0;
      totals.referral += result.referral || 0;
      totals.royalty += royalty;
      totals.motivation += standardMotivation;
      totals.congress += congress;
      totals.star += star;
      totals.expenses += expenses;
      totals.contribution += contribution;

      return '<tr>'
        + '<td><strong>' + escapeHtml(agent.name || DEFAULT_AGENT_NAME) + '</strong><small>' + escapeHtml(agent.status === 'trainee' ? 'Стажёр' : 'Партнёр') + ' / ' + escapeHtml(agent.paymentType === 'fixed' ? 'Фикс' : (agent.paymentType === 'boosted' ? 'Повышенная' : 'Стандарт')) + '</small></td>'
        + '<td>' + moneyValue(result.commission) + '</td>'
        + '<td>' + moneyValue(result.payout) + '</td>'
        + '<td>' + moneyValue(result.referral) + '</td>'
        + '<td>' + moneyValue(royalty) + '</td>'
        + '<td>' + moneyValue(standardMotivation) + '</td>'
        + '<td>' + moneyValue(congress) + '</td>'
        + '<td>' + moneyValue(star) + '</td>'
        + '<td>' + moneyValue(expenses) + '</td>'
        + '<td class="' + (contribution >= 0 ? 'positive' : 'negative') + '">' + moneyValue(contribution) + '</td>'
        + '<td>' + escapeHtml(economics.status || '—') + '</td>'
        + '</tr>';
    }).join('');

    return '<div class="agent-summary-table-wrap">'
      + '<table class="agent-summary-table">'
      + '<thead><tr>'
      + '<th>Агент</th>'
      + '<th>Сумма сделок</th>'
      + '<th>Зарплата агенту</th>'
      + '<th>Реферал</th>'
      + '<th>Роялти</th>'
      + '<th>Мотивации всего</th>'
      + '<th>Конгресс</th>'
      + '<th>Звезда</th>'
      + '<th>Расходы</th>'
      + '<th>Остаётся офису</th>'
      + '<th>Статус</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '<tfoot><tr>'
      + '<td>ИТОГО</td>'
      + '<td>' + moneyValue(totals.commission) + '</td>'
      + '<td>' + moneyValue(totals.payout) + '</td>'
      + '<td>' + moneyValue(totals.referral) + '</td>'
      + '<td>' + moneyValue(totals.royalty) + '</td>'
      + '<td>' + moneyValue(totals.motivation) + '</td>'
      + '<td>' + moneyValue(totals.congress) + '</td>'
      + '<td>' + moneyValue(totals.star) + '</td>'
      + '<td>' + moneyValue(totals.expenses) + '</td>'
      + '<td class="' + (totals.contribution >= 0 ? 'positive' : 'negative') + '">' + moneyValue(totals.contribution) + '</td>'
      + '<td></td>'
      + '</tr></tfoot>'
      + '</table>'
      + '</div>';
  }

  function renderSummary(officeResult) {
    var panel = document.getElementById('summaryPanel');
    if (!panel) {
      return;
    }
    var activeAgents = state.agents.filter(isAgentActive);
    var agentNames = activeAgents.map(function (agent) {
      return escapeHtml(agent.name || DEFAULT_AGENT_NAME);
    });
    var diagnosisClass = officeResult.resultWithoutOwner > 0 ? 'good' : (officeResult.resultWithOwner > 0 ? 'warn' : 'bad');
    var diagnosis = officeResult.resultWithoutOwner > 0
      ? 'Офис окупается как система.'
      : (officeResult.resultWithOwner > 0 ? 'Офис держится за счёт личных сделок собственника.' : 'Офис в минусе при текущих вводных.');
    panel.innerHTML = '<div class="summary-headline">'
      + '<div><h2>Итоговая сводная таблица по агентам</h2><p>Формат как в управленческом отчёте: агент, сумма сделок, зарплата, расходы и остаток.</p></div>'
      + '<button class="primary" type="button" data-action="add-agent">+ Добавить агента</button>'
      + '</div>'
      + '<div class="summary-agent-list"><strong>В расчёте участвуют:</strong> ' + (agentNames.length ? agentNames.join(', ') : 'нет активных агентов') + '</div>'
      + renderAgentSummaryTable(officeResult)
      + '<div class="summary-grid">'
      + '<div class="summary-card"><span>Оборот агентов</span><strong>' + moneyValue(officeResult.agentTurnover) + '</strong></div>'
      + '<div class="summary-card"><span>Общий оборот</span><strong>' + moneyValue(officeResult.totalTurnover) + '</strong></div>'
      + '<div class="summary-card"><span>Выплаты агентам</span><strong>' + moneyValue(officeResult.agentPayouts) + '</strong></div>'
      + '<div class="summary-card"><span>Рефералы</span><strong>' + moneyValue(officeResult.referrals) + '</strong></div>'
      + '<div class="summary-card"><span>Мотивации</span><strong>' + moneyValue(officeResult.motivationReserves) + '</strong></div>'
      + '<div class="summary-card"><span>Роялти</span><strong>' + moneyValue(officeResult.royaltyWithoutOwner) + '</strong></div>'
      + '<div class="summary-card"><span>Расходы офиса</span><strong>' + moneyValue(officeResult.expenses) + '</strong></div>'
      + '<div class="summary-card"><span>Итог без собственника</span><strong>' + moneyValue(officeResult.resultWithoutOwner) + '</strong></div>'
      + '<div class="summary-card"><span>Итог с собственником</span><strong>' + moneyValue(officeResult.resultWithOwner) + '</strong></div>'
      + '<div class="diagnosis ' + diagnosisClass + '">' + diagnosis + '</div>'
      + '</div>';
  }

  function findAgent(id) {
    return state.agents.find(function (agent) { return agent.id === id; });
  }

  function findDeal(agent, id) {
    return agent && (agent.deals || []).find(function (deal) { return deal.id === id; });
  }

  function setAgentField(agent, field, value, input) {
    if (!agent) return;
    if (['introduced', 'congressEnabled', 'starEnabled', 'partnerConfirmed', 'mountainSeaEnabled', 'travelEnabled', 'corporateEnabled', 'motivationOverride', 'stipendOverride', 'mountainSeaOverride', 'travelOverride', 'eventsOverride', 'specialTermsOverride', 'specialManualReserveEnabled'].indexOf(field) !== -1) {
      if (field === 'starEnabled' && input.checked) {
        state.agents.forEach(function (candidate) {
          candidate.starEnabled = candidate.id === agent.id;
        });
      } else {
        agent[field] = Boolean(input.checked);
      }
      return;
    }
    if (['quarterlyCommission', 'quarterlyDeposits', 'halfYearCommission', 'preTripQuarterDeposits', 'manualStipendMonthly', 'manualReserveMonthly', 'manualAnnualReserveMonthly', 'mountainSeaPerTrip', 'mountainSeaTripsPerYear', 'travelPerTrip', 'travelTripsPerYear', 'corporatePerYear', 'manualExpenseShare', 'fixedRate', 'startingRate', 'quickCommission', 'quickDealCount'].indexOf(field) !== -1) {
      agent[field] = readMoney(value);
      return;
    }
    if (field === 'commissionMode') {
      if (value === 'exact' && agent.commissionMode === 'quick') {
        convertQuickAgentToExact(agent, false);
      } else {
        agent.commissionMode = value === 'quick' ? 'quick' : 'exact';
      }
      if (!agent.deals || !agent.deals.length) {
        agent.deals = [createDeal(0)];
      }
      return;
    }
    if (field === 'status') {
      agent.status = value === 'trainee' ? 'trainee' : 'partner';
      if (agent.status === 'trainee') {
        agent.paymentType = 'standard';
      }
      return;
    }
    if (field === 'paymentType') {
      agent.paymentType = agent.status === 'trainee'
        ? 'standard'
        : (value === 'fixed' || value === 'boosted' ? value : 'standard');
      return;
    }
    if (field === 'travelQuarterPartnershipConfirmed') {
      agent.travelQuarterPartnershipConfirmed = value === 'true';
      return;
    }
    if (field === 'travelDecision') {
      agent.travelDecision = normalizeTravelDecision(value);
      return;
    }
    agent[field] = value;
  }

  function setExpenseField(expense, field, value) {
    if (!expense) return;
    if (field === 'amount') {
      expense.amount = readMoney(value);
    } else {
      expense[field] = value;
    }
  }

  function hasMeaningfulDealData(deal) {
    return readMoney(deal && deal.amount) > 0
      || normalizeManualRate(deal && deal.manualRate) !== ''
      || Boolean(deal && deal.isNewbuildSolo)
      || Boolean(String(deal && deal.comment || '').trim());
  }

  function hasMeaningfulAgentData(agent) {
    return Boolean(String(agent && agent.name || '').trim())
      || (agent && agent.status === 'trainee')
      || (agent && agent.paymentType && agent.paymentType !== 'standard')
      || Boolean(agent && agent.introduced)
      || readMoney(agent && agent.quickCommission) > 0
      || (agent && Array.isArray(agent.deals) && agent.deals.some(hasMeaningfulDealData))
      || readMoney(agent && agent.quarterlyCommission) > 0
      || readMoney(agent && agent.quarterlyDeposits) > 0
      || readMoney(agent && agent.halfYearCommission) > 0
      || readMoney(agent && agent.manualReserveMonthly) > 0
      || Boolean(agent && agent.starEnabled);
  }

  function hasMeaningfulLedgerData(nextState) {
    return readMoney(nextState && nextState.ownerSales) > 0
      || Boolean(nextState && nextState.expenses && nextState.expenses.some(function (expense) {
        return readMoney(expense && expense.amount) > 0;
      }))
      || Boolean(nextState && nextState.agents && nextState.agents.some(hasMeaningfulAgentData));
  }

  function loadA4Snapshot() {
    var raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) {
      showNotice('Snapshot A4 не найден. Открой A4 и нажми переход/загрузку таблицы, либо заполни ведомость вручную.');
      return;
    }
    try {
      var parsed = JSON.parse(raw);
      var source = parsed;
      if (parsed && parsed.version !== undefined) {
        if ((parsed.version !== 1 && parsed.version !== 2 && parsed.version !== SNAPSHOT_VERSION) || !parsed.state) {
          showNotice('Snapshot A4 не подходит для загрузки.');
          return;
        }
        source = parsed.state;
      }
      if (!source || !Array.isArray(source.agents)) {
        showNotice('Snapshot A4 не подходит для загрузки.');
        return false;
      }
      if (hasMeaningfulLedgerData(state)
        && typeof window.confirm === 'function'
        && !window.confirm('Загрузить данные из A4 поверх заполненной ведомости? Текущие ручные правки будут заменены.')) {
        showNotice('Загрузка из A4 отменена. Ручная ведомость сохранена.');
        return false;
      }
      state.selectedMonth = normalizeSelectedMonth(source.selectedMonth);
      state.ownerSales = readMoney(source.ownerSales);
      state.expenses = (source.expenses || []).map(function (expense) {
        return { id: nextExpenseId(), name: expense.name || 'Расход', amount: readMoney(expense.amount) };
      });
      state.agents = source.agents.map(function (agent) {
        var created = createAgent(agent.name || '');
        created.status = agent.status === 'trainee' ? 'trainee' : 'partner';
        created.paymentType = created.status === 'trainee'
          ? 'standard'
          : (agent.paymentType === 'fixed' || agent.paymentType === 'boosted' ? agent.paymentType : 'standard');
        created.fixedRate = agent.fixedRate === undefined || agent.fixedRate === null || agent.fixedRate === '' ? PAY_SCALES.fixedDefault : readMoney(agent.fixedRate);
        created.boostedRates = agent.boostedRates || clone(PAY_SCALES.boostedDefault);
        created.startingRate = agent.startingRate === undefined || agent.startingRate === null || agent.startingRate === '' ? PAY_SCALES.boostedStartingDefault : readMoney(agent.startingRate);
        created.introduced = Boolean(agent.introduced);
        created.commissionMode = agent.commissionMode === 'quick' ? 'quick' : 'exact';
        created.quickCommission = readMoney(agent.commission);
        created.quickDealCount = Math.max(1, Math.floor(readMoney(agent.dealCount)) || 1);
        var hasManualRates = Array.isArray(agent.dealManualRates);
        var manualRates = hasManualRates ? agent.dealManualRates : [];
        var depositOrders = Array.isArray(agent.dealDepositOrders) ? agent.dealDepositOrders : [];
        var newbuildSoloFlags = Array.isArray(agent.dealNewbuildSoloFlags) ? agent.dealNewbuildSoloFlags : [];
        created.deals = (Array.isArray(agent.dealsInput) && agent.dealsInput.length ? agent.dealsInput : [agent.commission || 0]).map(function (amount, index) {
          return createDeal(
            readMoney(amount),
            hasManualRates ? manualRates[index] : depositOrderToManualRate(depositOrders[index]),
            newbuildSoloFlags[index]
          );
        });
        var motivation = agent.motivation || {};
        created.partnerConfirmed = Boolean(firstDefined(
          agent.partnerConfirmed,
          motivation.partnerConfirmed,
          false
        ));
        created.quarterlyCommission = readMoney(firstDefined(agent.quarterlyCommission, motivation.quarterlyCommission, motivation.quarterlyResult, 0));
        created.quarterlyDeposits = readMoney(firstDefined(agent.quarterlyDeposits, motivation.quarterlyDeposits, 0));
        created.halfYearCommission = readMoney(firstDefined(agent.halfYearCommission, motivation.halfYearCommission, 0));
        created.preTripQuarterDeposits = readMoney(firstDefined(agent.preTripQuarterDeposits, motivation.preTripQuarterDeposits, 0));
        created.travelQuarterPartnershipConfirmed = agent.travelQuarterPartnershipConfirmed === true;
        created.travelDecision = normalizeTravelDecision(agent.travelDecision);
        created.motivationMode = motivation.mode || DEFAULT_MOTIVATION.mode;
        created.stipendMode = motivation.stipendMode || DEFAULT_MOTIVATION.stipendMode;
        created.manualStipendMonthly = readMoney(motivation.manualStipendMonthly);
        created.manualReserveMonthly = readMoney(firstDefined(motivation.manualReserveMonthly, agent.motivationReserve, 0));
        created.specialManualReserveEnabled = motivation.specialManualReserveEnabled === true;
        created.annualReserveMode = motivation.annualReserveMode || DEFAULT_MOTIVATION.annualReserveMode;
        created.manualAnnualReserveMonthly = readMoney(motivation.manualAnnualReserveMonthly);
        created.mountainSeaEnabled = Boolean(motivation.mountainSeaEnabled);
        created.mountainSeaPerTrip = readMoneyOrFallback(motivation.mountainSeaPerTrip, DEFAULT_MOTIVATION.mountainSeaPerTrip);
        created.mountainSeaTripsPerYear = readMoneyOrFallback(motivation.mountainSeaTripsPerYear, DEFAULT_MOTIVATION.mountainSeaTripsPerYear);
        created.travelEnabled = Boolean(motivation.travelEnabled);
        created.travelPerTrip = readMoneyOrFallback(motivation.travelPerTrip, DEFAULT_MOTIVATION.travelPerTrip);
        created.travelTripsPerYear = readMoneyOrFallback(motivation.travelTripsPerYear, DEFAULT_MOTIVATION.travelTripsPerYear);
        created.corporateEnabled = Boolean(motivation.corporateEnabled);
        created.corporatePerYear = readMoneyOrFallback(motivation.corporatePerYear, DEFAULT_MOTIVATION.corporatePerYear);
        created.congressEnabled = firstDefined(motivation.congressEnabled, agent.congressEnabled, true) !== false;
        created.congressPerYear = readMoneyOrFallback(firstDefined(motivation.congressPerYear, agent.congressPerYear), DEFAULT_MOTIVATION.congressPerYear);
        created.starEnabled = Boolean(firstDefined(motivation.starEnabled, agent.starEnabled, false));
        created.starPerYear = readMoneyOrFallback(firstDefined(motivation.starPerYear, agent.starPerYear), DEFAULT_MOTIVATION.starPerYear);
        created.motivationOverride = Boolean(agent.motivationOverride);
        created.stipendOverride = Boolean(agent.stipendOverride);
        created.mountainSeaOverride = Boolean(agent.mountainSeaOverride);
        created.travelOverride = Boolean(agent.travelOverride);
        created.eventsOverride = Boolean(agent.eventsOverride);
        created.specialTermsOverride = Boolean(agent.specialTermsOverride);
        created.manualExpenseShare = readMoney(agent.manualExpenseShare);
        return created;
      });
      normalizeSingleStar();
      syncCountersFromState(state);
      motivationPanelState = Object.create(null);
      ledgerMeta = {
        sourceType: 'a4',
        snapshotSavedAt: String(parsed && parsed.savedAt || ''),
        loadedAt: new Date().toISOString(),
        modifiedAfterImport: false
      };
      showNotice('Данные из A4 загружены в ведомость.');
      render();
      saveLedgerDraft('snapshot-import');
      return true;
    } catch (error) {
      showNotice('Не удалось прочитать snapshot A4.');
      return false;
    }
  }

  function normalizeSingleStar() {
    var starUsed = false;
    state.agents.forEach(function (agent) {
      if (agent.starEnabled && !starUsed) {
        starUsed = true;
        return;
      }
      if (agent.starEnabled && starUsed) {
        agent.starEnabled = false;
      }
    });
  }

  function showNotice(text) {
    var notice = document.getElementById('ledgerNotice');
    if (notice) {
      notice.textContent = text;
    }
  }

  function confirmAction(message) {
    return typeof window.confirm !== 'function' || window.confirm(message);
  }

  function applyLedgerFieldValue(target) {
    if (target.dataset.agentField) {
      setAgentField(findAgent(target.dataset.agentId), target.dataset.agentField, target.value, target);
      return true;
    }
    if (target.dataset.dealField) {
      var agent = findAgent(target.dataset.agentId);
      var deal = findDeal(agent, target.dataset.dealId);
      if (deal) {
        if (target.dataset.dealField === 'amount') {
          deal.amount = readMoney(target.value);
        } else if (target.dataset.dealField === 'manualRate') {
          deal.manualRate = normalizeManualRate(target.value);
        } else if (target.dataset.dealField === 'isNewbuildSolo') {
          deal.isNewbuildSolo = Boolean(target.checked);
        } else {
          deal[target.dataset.dealField] = target.value;
        }
      }
      return true;
    }
    if (target.dataset.expenseField) {
      setExpenseField(state.expenses.find(function (expense) { return expense.id === target.dataset.expenseId; }), target.dataset.expenseField, target.value);
      return true;
    }
    if (target.dataset.officeField === 'ownerSales') {
      state.ownerSales = readMoney(target.value);
      return true;
    }
    return false;
  }

  document.addEventListener('input', function (event) {
    if (applyLedgerFieldValue(event.target)) {
      saveLedgerDraft('manual-change');
    }
  });

  document.addEventListener('change', function (event) {
    var target = event.target;
    if (applyLedgerFieldValue(target)) {
      rerender();
      saveLedgerDraft('manual-change');
    }
  });

  document.addEventListener('toggle', function (event) {
    var details = event.target;
    if (!details || !details.classList || !details.classList.contains('motivation-ledger-panel')) {
      return;
    }
    setMotivationPanelOpen(details.dataset.motivationPanelId, details.open);
  }, true);

  document.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;
    var action = button.dataset.action;
    if (action === 'add-agent') {
      state.agents.push(createAgent(''));
      showNotice('Добавлен новый агент.');
      render();
      saveLedgerDraft('manual-change');
    }
    if (action === 'add-deal') {
      var last = state.agents[state.agents.length - 1] || createAgent('');
      if (!state.agents.length) state.agents.push(last);
      convertQuickAgentToExact(last, true);
      showNotice('Добавлена сделка последнему агенту.');
      render();
      saveLedgerDraft('manual-change');
    }
    if (action === 'add-deal-to-agent') {
      var agent = findAgent(button.dataset.agentId);
      if (agent) {
        convertQuickAgentToExact(agent, true);
        render();
        saveLedgerDraft('manual-change');
      }
    }
    if (action === 'remove-deal') {
      var dealAgent = findAgent(button.dataset.agentId);
      if (dealAgent && dealAgent.deals.length > 1) {
        var removingDeal = findDeal(dealAgent, button.dataset.dealId);
        if (hasMeaningfulDealData(removingDeal) && !confirmAction('Удалить сделку? Заполненные данные строки будут потеряны.')) {
          return;
        }
        dealAgent.deals = dealAgent.deals.filter(function (deal) { return deal.id !== button.dataset.dealId; });
        render();
        saveLedgerDraft('manual-change');
      }
    }
    if (action === 'remove-agent') {
      if (state.agents.length > 1) {
        var removingAgent = findAgent(button.dataset.agentId);
        if (!confirmAction(hasMeaningfulAgentData(removingAgent)
          ? 'Удалить агента и все его сделки?'
          : 'Удалить агента из ведомости?')) {
          return;
        }
        state.agents = state.agents.filter(function (agent) { return agent.id !== button.dataset.agentId; });
        render();
        saveLedgerDraft('manual-change');
      }
    }
    if (action === 'add-expense') {
      state.expenses.push(createExpense(''));
      render();
      saveLedgerDraft('manual-change');
    }
    if (action === 'remove-expense') {
      if (!confirmAction('Удалить расход из ведомости?')) {
        return;
      }
      state.expenses = state.expenses.filter(function (expense) { return expense.id !== button.dataset.expenseId; });
      render();
      saveLedgerDraft('manual-change');
    }
    if (action === 'clear-ledger') {
      if (!confirmAction('Очистить всю ведомость и удалить её сохранённый черновик?')) {
        return;
      }
      state = createState();
      motivationPanelState = Object.create(null);
      syncCountersFromState(state);
      clearLedgerDraft();
      showNotice('Ведомость очищена.');
      render();
    }
    if (action === 'load-a4') {
      loadA4Snapshot();
    }
  });

  render();
}());
