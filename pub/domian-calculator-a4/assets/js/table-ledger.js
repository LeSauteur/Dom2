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

  function parseWholeMoney(value) {
    var source = String(value === null || value === undefined ? '' : value).trim();
    if (!source) {
      return { valid: true, value: 0 };
    }
    if (!/^\d+(?:[\s\u00a0\u202f]\d{3})*$/.test(source)) {
      return { valid: false, value: null };
    }
    return { valid: true, value: Number(source.replace(/[\s\u00a0\u202f]/g, '')) };
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
      careerPackageId: 'standard',
      contractualFloorRate: 0,
      previousMonthDeposits: 0,
      officePlanCompleted: false,
      agentParticipated: false,
      mountainSeaCost: 0,
      travelCost: 0,
      corporateCost: 0,
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
    normalized.careerPackageId = window.MOTIVATION_POLICY_2026
      && window.MOTIVATION_POLICY_2026.getPackage(agentSource.careerPackageId)
      ? agentSource.careerPackageId
      : (normalized.status === 'trainee' ? 'newcomer' : 'standard');
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
    var source = {
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
      careerPackageId: agent.careerPackageId || (agent.status === 'trainee' ? 'newcomer' : 'standard'),
      contractualFloorRate: readMoney(agent.contractualFloorRate),
      careerPreviousMonthDeposits: readMoney(agent.previousMonthDeposits),
      careerOfficePlanCompleted: agent.officePlanCompleted === true,
      careerAgentParticipated: agent.agentParticipated === true,
      careerMountainSeaCost: readMoney(agent.mountainSeaCost),
      careerTravelCost: readMoney(agent.travelCost),
      careerCorporateCost: readMoney(agent.corporateCost),
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
    if (!window.MotivationCalculator2026
      || typeof window.MotivationCalculator2026.applyPackage !== 'function') {
      throw new Error('Не загружен расчёт мотивации 2026.');
    }
    return window.MotivationCalculator2026.applyPackage(source, source.careerPackageId);
  }

  function buildOfficeState() {
    return {
      selectedMonth: state.selectedMonth,
      expenses: state.expenses.map(function (expense) {
        return { id: expense.id, name: expense.name, amount: readMoney(expense.amount) };
      }),
      ownerSales: readMoney(state.ownerSales),
      agents: state.agents.map(buildCalculationAgent),
      agentEconomicsAllocation: 'officeExact'
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
    var congress = 0;
    var star = 0;
    var total = Number(result && result.motivationReserve) || 0;
    var standard = total;
    return {
      standard: standard,
      congress: congress,
      star: star,
      total: total,
      agent: Number(result && result.motivationAgentCost) || 0
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
        sourceNode.textContent = 'Данные: загружены из A4'
          + (ledgerMeta.snapshotSavedAt ? ', сохранены ' + formatSavedAt(ledgerMeta.snapshotSavedAt) : '')
          + (ledgerMeta.loadedAt ? ', загружено ' + formatSavedAt(ledgerMeta.loadedAt) : '')
          + (ledgerMeta.modifiedAfterImport ? ', есть ручные изменения' : '');
      } else {
        sourceNode.textContent = 'Данные: введены вручную';
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
    var result = getAgentResult(agent);
    var integration = result.careerIntegration || {};
    var packageItem = window.MOTIVATION_POLICY_2026.getPackage(agent.careerPackageId || 'standard')
      || window.MOTIVATION_POLICY_2026.getPackage('standard');
    var motivationPanelOpen = isMotivationPanelOpen(agent.id);
    var packageOptions = window.MOTIVATION_POLICY_2026.packages.map(function (item) {
      return option(item.id, item.label, packageItem.id);
    }).join('');
    var benefits = integration.benefits && integration.benefits.items
      ? integration.benefits.items
      : [];
    var benefitRows = benefits.map(function (benefit) {
      var payer = benefit.payer === 'office' ? 'офис' : (benefit.payer === 'agent' ? 'агент' : 'не предоставляется');
      return '<tr><td>' + escapeHtml(benefit.label) + '</td><td>' + escapeHtml(benefit.available ? 'Есть' : 'Нет') + '</td><td>'
        + escapeHtml(payer) + '</td><td>' + moneyValue(benefit.officeCost) + '</td><td>' + moneyValue(benefit.agentCost) + '</td></tr>';
    }).join('');

    return '<tr class="agent-setup-row" data-agent-id="' + agent.id + '">'
      + '<td colspan="13">'
      + '<div class="agent-setup-grid">'
      + '<label>Агент<input class="text-cell" data-focus-key="agent-name-' + agent.id + '" data-agent-field="name" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.name || '') + '" placeholder="Агент"></label>'
      + '<label>Карьерный пакет<select data-agent-field="careerPackageId" data-agent-id="' + agent.id + '">' + packageOptions + '</select></label>'
      + '<div class="formula-note"><span>Статус</span><strong>' + escapeHtml(packageItem.status === 'trainee' ? 'Новичок' : 'Партнёр') + '</strong></div>'
      + '<div class="formula-note"><span>Минимальная ставка</span><strong>' + escapeHtml(packageItem.floorRate) + '%</strong></div>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="introduced" data-agent-id="' + agent.id + '"' + (agent.introduced ? ' checked' : '') + '> Есть реферал</label>'
      + '</div>'
      + '<details class="motivation-ledger-panel" data-motivation-panel-id="' + agent.id + '"' + (motivationPanelOpen ? ' open' : '') + '>'
      + '<summary>Дополнительные условия <span>офис: ' + moneyValue(result.motivationReserve) + ', агент: ' + moneyValue(result.motivationAgentCost) + '</span></summary>'
      + '<div class="motivation-ledger-grid">'
      + '<label>Комиссия агента за квартал, ₽<input class="money-cell" inputmode="numeric" data-focus-key="quarterly-commission-' + agent.id + '" data-agent-field="quarterlyCommission" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.quarterlyCommission)) + '"></label>'
      + '<label>Задатки агента за квартал, ₽<input class="money-cell" inputmode="numeric" data-focus-key="quarterly-deposits-' + agent.id + '" data-agent-field="quarterlyDeposits" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.quarterlyDeposits)) + '"></label>'
      + '<label>Комиссия агента за полугодие, ₽<input class="money-cell" inputmode="numeric" data-focus-key="halfyear-' + agent.id + '" data-agent-field="halfYearCommission" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.halfYearCommission)) + '"></label>'
      + '<label>Задатки прошлого месяца, ₽<input class="money-cell" inputmode="numeric" data-focus-key="previous-deposits-' + agent.id + '" data-agent-field="previousMonthDeposits" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.previousMonthDeposits)) + '"></label>'
      + '<label>Договорной минимум, %<input class="small-cell" type="number" min="0" max="100" step="1" data-agent-field="contractualFloorRate" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.contractualFloorRate || '') + '"></label>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="officePlanCompleted" data-agent-id="' + agent.id + '"' + (agent.officePlanCompleted ? ' checked' : '') + '> План офиса выполнен</label>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="agentParticipated" data-agent-id="' + agent.id + '"' + (agent.agentParticipated ? ' checked' : '') + '> Агент участвовал</label>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="travelQuarterPartnershipConfirmed" data-agent-id="' + agent.id + '"' + (agent.travelQuarterPartnershipConfirmed ? ' checked' : '') + '> Условие перед поездкой выполнено</label>'
      + '<label>Стоимость «Горы / Море», ₽<input class="money-cell" inputmode="numeric" data-agent-field="mountainSeaCost" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.mountainSeaCost)) + '"></label>'
      + '<label>Стоимость путешествия, ₽<input class="money-cell" inputmode="numeric" data-agent-field="travelCost" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.travelCost)) + '"></label>'
      + '<label>Стоимость корпоратива, ₽<input class="money-cell" inputmode="numeric" data-agent-field="corporateCost" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.corporateCost)) + '"></label>'
      + '</div>'
      + '<div class="benefit-table-wrap"><table class="benefit-table"><thead><tr><th>Мотивация</th><th>Право</th><th>Кто платит</th><th>Офис</th><th>Агент</th></tr></thead><tbody>' + benefitRows + '</tbody></table></div>'
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
      + '<td class="empty-note">' + escapeHtml((window.MOTIVATION_POLICY_2026.getPackage(agent.careerPackageId) || {}).label || 'Стандарт') + '</td>'
      + '<td class="number-cell">' + (index + 1) + '</td>'
      + '<td><input class="money-cell" inputmode="numeric" autocomplete="off" data-focus-key="deal-' + deal.id + '" data-deal-field="amount" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '" value="' + escapeHtml(formatInputMoney(deal.amount)) + '">'
      + '<div class="ledger-deal-meta">'
      + manualRateControl
      + '<label class="ledger-deal-flag"><input type="checkbox" data-deal-field="isNewbuildSolo" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '"' + (deal.isNewbuildSolo ? ' checked' : '') + '> Новостройка, один агент</label>'
      + '</div></td>'
      + '<td><span class="percent-pill">' + percentValue(rate) + '</span></td>'
      + '<td class="calc-cell">' + moneyValue(payout) + '</td>'
      + '<td class="calc-cell">' + moneyValue(referral) + '</td>'
      + '<td class="empty-note">—</td>'
      + '<td class="empty-note">—</td>'
      + '<td class="calc-cell">' + moneyValue(royalty) + '</td>'
      + '<td class="empty-note">—</td>'
      + '<td class="empty-note">—</td>'
      + '<td><div class="comment-cell"><input class="text-cell" data-focus-key="comment-' + deal.id + '" data-deal-field="comment" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '" value="' + escapeHtml(deal.comment || '') + '" placeholder="Комментарий"><button class="small danger" type="button" data-action="remove-deal" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '"' + (agent.deals.length === 1 ? ' disabled' : '') + '>×</button></div></td>'
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
        + '<td class="empty-note">' + escapeHtml((window.MOTIVATION_POLICY_2026.getPackage(agent.careerPackageId) || {}).label || 'Стандарт') + '</td>'
        + '<td class="number-cell">' + (i + 1) + '</td>'
        + '<td>' + (i === 0 ? '<input class="money-cell" inputmode="numeric" data-focus-key="quick-commission-' + agent.id + '" data-agent-field="quickCommission" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.quickCommission)) + '" placeholder="общая сумма">' : moneyValue(split)) + '</td>'
        + '<td><span class="percent-pill">' + percentValue(rate) + '</span></td>'
        + '<td class="calc-cell">' + moneyValue(payout) + '</td>'
        + '<td class="calc-cell">' + moneyValue(referral) + '</td>'
        + '<td class="empty-note">—</td>'
        + '<td class="empty-note">—</td>'
        + '<td class="calc-cell">' + moneyValue(getDistributedRoyalty(split, officeResult)) + '</td>'
        + '<td class="empty-note">—</td>'
        + '<td class="empty-note">—</td>'
        + '<td>' + (i === 0 ? '<div class="comment-cell"><span>Общей суммой</span><input class="small-cell" inputmode="numeric" data-focus-key="quick-count-' + agent.id + '" data-agent-field="quickDealCount" data-agent-id="' + agent.id + '" value="' + escapeHtml(count) + '" title="Количество сделок"></div>' : '') + '</td>'
        + '</tr>';
    }
    return rows;
  }

  function renderAgentTotalRow(agent, officeResult) {
    var result = getAgentResult(agent);
    var economics = getAgentEconomics(agent, officeResult) || {};
    var contribution = economics.contribution !== undefined ? economics.contribution : 0;
    var contributionClass = contribution >= 0 ? 'positive' : 'negative';
    var motivation = getMotivationBreakdown(result);
    return '<tr class="agent-total-row" data-agent-id="' + agent.id + '">'
      + '<td class="agent-total-label" colspan="3">Итого ' + escapeHtml(agent.name || DEFAULT_AGENT_NAME) + '</td>'
      + '<td>' + moneyValue(result.commission) + '</td>'
      + '<td></td>'
      + '<td>' + moneyValue(result.payout) + '</td>'
      + '<td>' + moneyValue(result.referral) + '</td>'
      + '<td>' + moneyValue(motivation.standard) + '</td>'
      + '<td>' + moneyValue(motivation.agent) + '</td>'
      + '<td>' + moneyValue(economics.royaltyShare || 0) + '</td>'
      + '<td>' + moneyValue(economics.expenseShare || 0) + '</td>'
      + '<td class="' + contributionClass + '">' + moneyValue(contribution) + '</td>'
      + '<td><button class="small" type="button" data-action="add-deal-to-agent" data-agent-id="' + agent.id + '">+ Сделка</button></td>'
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
    var agentMotivationTotal = (officeResult.agents || []).reduce(function (sum, item) {
      return sum + (Number(item.motivationAgentCost) || 0);
    }, 0);
    foot.innerHTML = '<tr class="office-total-row">'
      + '<td colspan="3">ИТОГО ПО ОФИСУ</td>'
      + '<td>' + moneyValue(officeResult.agentTurnover) + '</td>'
      + '<td></td>'
      + '<td>' + moneyValue(officeResult.agentPayouts) + '</td>'
      + '<td>' + moneyValue(officeResult.referrals) + '</td>'
      + '<td>' + moneyValue(officeResult.motivationReserves) + '</td>'
      + '<td>' + moneyValue(agentMotivationTotal) + '</td>'
      + '<td>' + moneyValue(officeResult.royaltyWithoutOwner) + '</td>'
      + '<td>' + moneyValue(officeResult.expenses) + '</td>'
      + '<td>' + moneyValue(officeResult.resultWithoutOwner) + '</td>'
      + '<td>С собственником: ' + moneyValue(officeResult.resultWithOwner) + '</td>'
      + '</tr>';
  }

  function updateTop(officeResult) {
    var expenseTotal = document.querySelector('[data-office-expenses-total]');
    var royalty = document.querySelector('[data-office-royalty]');
    var royaltyRate = document.querySelector('[data-office-royalty-rate]');
    var ownerSales = document.getElementById('ledgerOwnerSales');
    if (expenseTotal) expenseTotal.textContent = moneyValue(officeResult.expenses);
    if (royalty) royalty.textContent = moneyValue(officeResult.royaltyWithoutOwner);
    if (royaltyRate) royaltyRate.textContent = 'Ставка: ' + percentValue(
      officeResult.agentTurnover > 0 ? getRoyaltyRate(officeResult.agentTurnover) : 0
    );
    if (ownerSales) ownerSales.value = formatInputMoney(state.ownerSales);
  }

  function renderAgentSummaryTable(officeResult) {
    var activeAgents = state.agents.filter(isAgentActive);
    var totals = {
      commission: 0,
      payout: 0,
      referral: 0,
      royalty: 0,
      officeMotivation: 0,
      agentMotivation: 0,
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
      var packageItem = window.MOTIVATION_POLICY_2026.getPackage(agent.careerPackageId || 'standard');
      var royalty = economics.royaltyShare || 0;
      var expenses = economics.expenseShare || 0;
      var contribution = economics.contribution !== undefined ? economics.contribution : 0;

      totals.commission += result.commission || 0;
      totals.payout += result.payout || 0;
      totals.referral += result.referral || 0;
      totals.royalty += royalty;
      totals.officeMotivation += motivationPart.standard;
      totals.agentMotivation += motivationPart.agent;
      totals.expenses += expenses;
      totals.contribution += contribution;

      return '<tr>'
        + '<td><strong>' + escapeHtml(agent.name || DEFAULT_AGENT_NAME) + '</strong></td>'
        + '<td>' + escapeHtml(packageItem ? packageItem.label : 'Стандарт') + '</td>'
        + '<td>' + moneyValue(result.commission) + '</td>'
        + '<td>' + moneyValue(result.payout) + '</td>'
        + '<td>' + moneyValue(result.referral) + '</td>'
        + '<td>' + moneyValue(motivationPart.standard) + '</td>'
        + '<td>' + moneyValue(motivationPart.agent) + '</td>'
        + '<td>' + moneyValue(royalty) + '</td>'
        + '<td>' + moneyValue(expenses) + '</td>'
        + '<td class="' + (contribution >= 0 ? 'positive' : 'negative') + '">' + moneyValue(contribution) + '</td>'
        + '<td>' + escapeHtml(economics.status || '—') + '</td>'
        + '</tr>';
    }).join('');

    return '<div class="agent-summary-table-wrap">'
      + '<table class="agent-summary-table">'
      + '<thead><tr>'
      + '<th>Агент</th>'
      + '<th>Пакет</th>'
      + '<th>Оборот</th>'
      + '<th>Выплата агенту</th>'
      + '<th>Реферал</th>'
      + '<th>Мотивации офиса</th>'
      + '<th>Мотивации агента</th>'
      + '<th>Доля роялти</th>'
      + '<th>Доля расходов</th>'
      + '<th>Остаётся офису</th>'
      + '<th>Статус</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '<tfoot><tr>'
      + '<td>ИТОГО</td>'
      + '<td></td>'
      + '<td>' + moneyValue(totals.commission) + '</td>'
      + '<td>' + moneyValue(totals.payout) + '</td>'
      + '<td>' + moneyValue(totals.referral) + '</td>'
      + '<td>' + moneyValue(totals.officeMotivation) + '</td>'
      + '<td>' + moneyValue(totals.agentMotivation) + '</td>'
      + '<td>' + moneyValue(totals.royalty) + '</td>'
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
      + '<div><h2>Итоговая таблица по агентам</h2><p>Для каждого агента показаны сумма сделок, выплата, расходы и сколько денег осталось офису.</p></div>'
      + '</div>'
      + '<div class="summary-agent-list"><strong>В расчёте участвуют:</strong> ' + (agentNames.length ? agentNames.join(', ') : 'нет активных агентов') + '</div>'
      + renderAgentSummaryTable(officeResult)
      + '<div class="summary-grid">'
      + '<div class="summary-card"><span>Оборот агентов</span><strong>' + moneyValue(officeResult.agentTurnover) + '</strong></div>'
      + '<div class="summary-card"><span>Личные сделки собственника</span><strong>' + moneyValue(officeResult.ownerSales) + '</strong></div>'
      + '<div class="summary-card"><span>Общий оборот</span><strong>' + moneyValue(officeResult.totalTurnover) + '</strong></div>'
      + '<div class="summary-card"><span>Выплаты агентам</span><strong>' + moneyValue(officeResult.agentPayouts) + '</strong></div>'
      + '<div class="summary-card"><span>Рефералы</span><strong>' + moneyValue(officeResult.referrals) + '</strong></div>'
      + '<div class="summary-card"><span>Мотивации за счёт офиса</span><strong>' + moneyValue(officeResult.motivationReserves) + '</strong></div>'
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
    if (['introduced', 'officePlanCompleted', 'agentParticipated', 'travelQuarterPartnershipConfirmed', 'congressEnabled', 'starEnabled', 'partnerConfirmed', 'mountainSeaEnabled', 'travelEnabled', 'corporateEnabled', 'motivationOverride', 'stipendOverride', 'mountainSeaOverride', 'travelOverride', 'eventsOverride', 'specialTermsOverride', 'specialManualReserveEnabled'].indexOf(field) !== -1) {
      if (field === 'starEnabled' && input.checked) {
        state.agents.forEach(function (candidate) {
          candidate.starEnabled = candidate.id === agent.id;
        });
      } else {
        agent[field] = Boolean(input.checked);
      }
      return;
    }
    if (['quarterlyCommission', 'quarterlyDeposits', 'halfYearCommission', 'previousMonthDeposits', 'mountainSeaCost', 'travelCost', 'corporateCost', 'preTripQuarterDeposits', 'manualStipendMonthly', 'manualReserveMonthly', 'manualAnnualReserveMonthly', 'mountainSeaPerTrip', 'mountainSeaTripsPerYear', 'travelPerTrip', 'travelTripsPerYear', 'corporatePerYear', 'manualExpenseShare', 'fixedRate', 'startingRate', 'quickCommission', 'quickDealCount'].indexOf(field) !== -1) {
      agent[field] = readMoney(value);
      return;
    }
    if (field === 'contractualFloorRate') {
      agent.contractualFloorRate = normalizeManualRate(value);
      return;
    }
    if (field === 'careerPackageId') {
      agent.careerPackageId = window.MOTIVATION_POLICY_2026.getPackage(value) ? value : 'standard';
      agent.status = window.MOTIVATION_POLICY_2026.getPackage(agent.careerPackageId).status;
      agent.paymentType = 'standard';
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
      showNotice('Сохранённые данные A4 не найдены. Откройте A4, нажмите «Ведомость сделок» и загрузите данные либо заполните ведомость вручную.');
      return;
    }
    try {
      var parsed = JSON.parse(raw);
      var source = parsed;
      if (parsed && parsed.version !== undefined) {
        if ((parsed.version !== 1 && parsed.version !== 2 && parsed.version !== SNAPSHOT_VERSION) || !parsed.state) {
          showNotice('Сохранённые данные A4 имеют неподдерживаемую версию и не были загружены.');
          return;
        }
        source = parsed.state;
      }
      if (!source || !Array.isArray(source.agents)) {
        showNotice('Сохранённые данные A4 имеют неподдерживаемую версию и не были загружены.');
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
        created.careerPackageId = window.MOTIVATION_POLICY_2026.getPackage(agent.careerPackageId)
          ? agent.careerPackageId
          : (agent.status === 'trainee' ? 'newcomer' : 'standard');
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
        created.previousMonthDeposits = readMoney(firstDefined(agent.previousMonthDeposits, agent.careerPreviousMonthDeposits, 0));
        created.contractualFloorRate = normalizeManualRate(agent.contractualFloorRate);
        created.officePlanCompleted = firstDefined(agent.officePlanCompleted, agent.careerOfficePlanCompleted, false) === true;
        created.agentParticipated = firstDefined(agent.agentParticipated, agent.careerAgentParticipated, false) === true;
        created.mountainSeaCost = readMoney(firstDefined(agent.mountainSeaCost, agent.careerMountainSeaCost, 0));
        created.travelCost = readMoney(firstDefined(agent.travelCost, agent.careerTravelCost, 0));
        created.corporateCost = readMoney(firstDefined(agent.corporateCost, agent.careerCorporateCost, 0));
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
      showNotice('Не удалось прочитать сохранённые данные A4. Данные ведомости не изменены.');
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
    var moneyAgentFields = ['quarterlyCommission', 'quarterlyDeposits', 'halfYearCommission', 'previousMonthDeposits', 'mountainSeaCost', 'travelCost', 'corporateCost', 'quickCommission'];
    var requiresWholeMoney = target.dataset.dealField === 'amount'
      || target.dataset.expenseField === 'amount'
      || target.dataset.officeField === 'ownerSales'
      || moneyAgentFields.indexOf(target.dataset.agentField) !== -1;
    if (requiresWholeMoney) {
      var parsedMoney = parseWholeMoney(target.value);
      if (!parsedMoney.valid) {
        if (typeof target.setAttribute === 'function') {
          target.setAttribute('aria-invalid', 'true');
        }
        showNotice('Введите целое неотрицательное число рублей. Пример: 300 000.');
        return false;
      }
      var wasInvalid = typeof target.getAttribute === 'function'
        && target.getAttribute('aria-invalid') === 'true';
      if (typeof target.removeAttribute === 'function') {
        target.removeAttribute('aria-invalid');
      }
      if (wasInvalid) {
        showNotice('Значение принято.');
      }
    }
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
