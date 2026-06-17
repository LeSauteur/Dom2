(function () {
  'use strict';

  var SNAPSHOT_KEY = 'domianA4TableSnapshot';
  var SNAPSHOT_VERSION = 1;
  var DEFAULT_AGENT_NAME = 'Агент';
  var agentCounter = 0;
  var expenseCounter = 0;
  var dealCounter = 0;

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

  function createDeal(amount) {
    return {
      id: nextDealId(),
      amount: amount || 0,
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
      stipendMode: DEFAULT_MOTIVATION.stipendMode,
      manualStipendMonthly: 0,
      manualReserveMonthly: 0,
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

  var state = createState();

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

  function buildCalculationAgent(agent) {
    var active = isAgentActive(agent);
    var commission = getAgentCommission(agent);
    var dealsInput = getAgentDealsInput(agent);
    return {
      id: agent.id,
      name: agent.name || DEFAULT_AGENT_NAME,
      commission: commission,
      dealCount: getAgentDealCount(agent),
      commissionMode: agent.commissionMode,
      dealsInput: dealsInput,
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
        mountainSeaPerTrip: readMoney(agent.mountainSeaPerTrip) || DEFAULT_MOTIVATION.mountainSeaPerTrip,
        mountainSeaTripsPerYear: readMoney(agent.mountainSeaTripsPerYear) || DEFAULT_MOTIVATION.mountainSeaTripsPerYear,
        travelEnabled: Boolean(agent.travelEnabled),
        travelPerTrip: readMoney(agent.travelPerTrip) || DEFAULT_MOTIVATION.travelPerTrip,
        travelTripsPerYear: readMoney(agent.travelTripsPerYear) || DEFAULT_MOTIVATION.travelTripsPerYear,
        corporateEnabled: Boolean(agent.corporateEnabled),
        corporatePerYear: readMoney(agent.corporatePerYear) || DEFAULT_MOTIVATION.corporatePerYear,
        congressEnabled: active && Boolean(agent.congressEnabled),
        congressPerYear: DEFAULT_MOTIVATION.congressPerYear,
        starEnabled: active && Boolean(agent.starEnabled),
        starPerYear: DEFAULT_MOTIVATION.starPerYear
      })
    };
  }

  function buildOfficeState() {
    return {
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

  function getDealAmount(agent, index) {
    if (agent.commissionMode === 'quick') {
      var total = getAgentCommission(agent);
      var count = getAgentDealCount(agent);
      return count ? total / count : 0;
    }
    return readMoney(agent.deals[index] && agent.deals[index].amount);
  }

  function getDealPayout(agent, index) {
    var calcAgent = buildCalculationAgent(agent);
    return getDealAmount(agent, index) * getDealRate(calcAgent, index);
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

  function render() {
    var officeResult = getOfficeResult();
    renderExpenses();
    renderTable(officeResult);
    renderSummary(officeResult);
    updateTop(officeResult);
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
        + '<input class="text-cell" data-focus-key="expense-name-' + expense.id + '" data-expense-field="name" data-expense-id="' + expense.id + '" value="' + escapeHtml(expense.name) + '">'
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
    var congressText = 'Конгресс учтён: ' + moneyValue(monthlyFromYearly(DEFAULT_MOTIVATION.congressPerYear)) + '/мес';
    var starText = agent.starEnabled ? 'Звезда учтена: ' + moneyValue(monthlyFromYearly(DEFAULT_MOTIVATION.starPerYear)) + '/мес' : (starTakenBy ? 'Звезда уже у ' + (starTakenBy.name || DEFAULT_AGENT_NAME) : 'Звезда: нет');

    return '<tr class="agent-setup-row" data-agent-id="' + agent.id + '">'
      + '<td colspan="14">'
      + '<div class="agent-setup-grid">'
      + '<label>Агент<input class="text-cell" data-focus-key="agent-name-' + agent.id + '" data-agent-field="name" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.name || '') + '" placeholder="Агент"></label>'
      + '<label>Статус<select data-agent-field="status" data-agent-id="' + agent.id + '">' + option('partner', 'Партнёр', agent.status) + option('trainee', 'Стажёр', agent.status) + '</select></label>'
      + '<label>Схема<select data-agent-field="paymentType" data-agent-id="' + agent.id + '">' + option('standard', 'Стандарт', agent.paymentType) + option('boosted', 'Повышенная', agent.paymentType) + option('fixed', 'Фикс', agent.paymentType) + '</select></label>'
      + '<label>Старт, %<input class="small-cell" inputmode="numeric" data-focus-key="starting-' + agent.id + '" data-agent-field="startingRate" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.startingRate) + '"' + startingDisabled + '></label>'
      + '<label>Фикс, %<input class="small-cell" inputmode="numeric" data-focus-key="fixed-' + agent.id + '" data-agent-field="fixedRate" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.fixedRate) + '"' + fixedDisabled + '></label>'
      + '<label>Режим сделок<select data-agent-field="commissionMode" data-agent-id="' + agent.id + '">' + option('exact', 'Точно', agent.commissionMode) + option('quick', 'Быстро', agent.commissionMode) + '</select></label>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="introduced" data-agent-id="' + agent.id + '"' + (agent.introduced ? ' checked' : '') + '> Приведённый</label>'
      + '<label class="flag-box mandatory"><input type="checkbox" data-agent-field="congressEnabled" data-agent-id="' + agent.id + '"' + (agent.congressEnabled ? ' checked' : '') + '> ' + congressText + '</label>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="starEnabled" data-agent-id="' + agent.id + '"' + (agent.starEnabled ? ' checked' : '') + starDisabled + starTitle + '> ' + escapeHtml(starText) + '</label>'
      + '</div>'
      + '<details class="motivation-ledger-panel">'
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
      + '<label class="flag-box"><input type="checkbox" data-agent-field="mountainSeaEnabled" data-agent-id="' + agent.id + '"' + (agent.mountainSeaEnabled ? ' checked' : '') + '> Море/Горы</label>'
      + '<label>Море/Горы, ₽ за поездку<input class="money-cell" inputmode="numeric" data-focus-key="mountain-sea-trip-' + agent.id + '" data-agent-field="mountainSeaPerTrip" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.mountainSeaPerTrip)) + '"></label>'
      + '<label>Кол-во Море/Горы<input class="small-cell" inputmode="numeric" data-focus-key="mountain-sea-count-' + agent.id + '" data-agent-field="mountainSeaTripsPerYear" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.mountainSeaTripsPerYear) + '"></label>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="travelEnabled" data-agent-id="' + agent.id + '"' + (agent.travelEnabled ? ' checked' : '') + '> Заграница/путешествие</label>'
      + '<label>Путешествие, ₽ за поездку<input class="money-cell" inputmode="numeric" data-focus-key="travel-trip-' + agent.id + '" data-agent-field="travelPerTrip" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.travelPerTrip)) + '"></label>'
      + '<label>Кол-во путешествий<input class="small-cell" inputmode="numeric" data-focus-key="travel-count-' + agent.id + '" data-agent-field="travelTripsPerYear" data-agent-id="' + agent.id + '" value="' + escapeHtml(agent.travelTripsPerYear) + '"></label>'
      + '<label class="flag-box"><input type="checkbox" data-agent-field="corporateEnabled" data-agent-id="' + agent.id + '"' + (agent.corporateEnabled ? ' checked' : '') + '> Корпоратив</label>'
      + '<label>Корпоратив, ₽/год<input class="money-cell" inputmode="numeric" data-focus-key="corporate-' + agent.id + '" data-agent-field="corporatePerYear" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.corporatePerYear)) + '"></label>'
      + '<label>Ручной резерв, ₽/мес<input class="money-cell" inputmode="numeric" data-focus-key="manual-reserve-' + agent.id + '" data-agent-field="manualReserveMonthly" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.manualReserveMonthly)) + '"></label>'
      + '</div>'
      + '</details>'
      + '<div class="agent-row-actions"><button class="small danger" type="button" data-action="remove-agent" data-agent-id="' + agent.id + '"' + (state.agents.length === 1 ? ' disabled' : '') + '>Удалить агента</button></div>'
      + '</td>'
      + '</tr>';
  }

  function renderExactDealRow(agent, deal, index, officeResult) {
    var rate = getDealRate(buildCalculationAgent(agent), index);
    var amount = readMoney(deal.amount);
    var payout = amount * rate;
    var royalty = getDistributedRoyalty(amount, officeResult);
    return '<tr class="deal-row" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '">'
      + '<td class="empty-note">' + escapeHtml(agent.name || DEFAULT_AGENT_NAME) + '</td>'
      + '<td class="number-cell">' + (index + 1) + '</td>'
      + '<td><input class="money-cell" inputmode="numeric" autocomplete="off" data-focus-key="deal-' + deal.id + '" data-deal-field="amount" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '" value="' + escapeHtml(formatInputMoney(deal.amount)) + '"></td>'
      + '<td><span class="percent-pill">' + percentValue(rate) + '</span></td>'
      + '<td class="calc-cell">' + moneyValue(payout) + '</td>'
      + '<td class="calc-cell">' + moneyValue(agent.introduced ? amount * REFERRAL_RATE : 0) + '</td>'
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
    var rows = '';
    for (var i = 0; i < count; i += 1) {
      var rate = getDealRate(buildCalculationAgent(agent), i);
      rows += '<tr class="deal-row quick-row" data-agent-id="' + agent.id + '">'
        + '<td class="empty-note">' + escapeHtml(agent.name || DEFAULT_AGENT_NAME) + '</td>'
        + '<td class="number-cell">' + (i + 1) + '</td>'
        + '<td>' + (i === 0 ? '<input class="money-cell" inputmode="numeric" data-focus-key="quick-commission-' + agent.id + '" data-agent-field="quickCommission" data-agent-id="' + agent.id + '" value="' + escapeHtml(formatInputMoney(agent.quickCommission)) + '" placeholder="общая сумма">' : moneyValue(split)) + '</td>'
        + '<td><span class="percent-pill">' + percentValue(rate) + '</span></td>'
        + '<td class="calc-cell">' + moneyValue(split * rate) + '</td>'
        + '<td class="calc-cell">' + moneyValue(agent.introduced ? split * REFERRAL_RATE : 0) + '</td>'
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
      agent.commissionMode = value === 'quick' ? 'quick' : 'exact';
      if (!agent.deals || !agent.deals.length) {
        agent.deals = [createDeal(0)];
      }
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

  function loadA4Snapshot() {
    var raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) {
      showNotice('Snapshot A4 не найден. Открой A4 и нажми переход/загрузку таблицы, либо заполни ведомость вручную.');
      return;
    }
    try {
      var parsed = JSON.parse(raw);
      var source = parsed && parsed.version === SNAPSHOT_VERSION && parsed.state ? parsed.state : parsed;
      if (!source || !Array.isArray(source.agents)) {
        showNotice('Snapshot A4 не подходит для загрузки.');
        return;
      }
      state.ownerSales = readMoney(source.ownerSales);
      state.expenses = (source.expenses || []).map(function (expense) {
        return { id: nextExpenseId(), name: expense.name || 'Расход', amount: readMoney(expense.amount) };
      });
      state.agents = source.agents.map(function (agent) {
        var created = createAgent(agent.name || '');
        created.status = agent.status === 'trainee' ? 'trainee' : 'partner';
        created.paymentType = agent.paymentType || 'standard';
        created.fixedRate = agent.fixedRate === undefined || agent.fixedRate === null || agent.fixedRate === '' ? PAY_SCALES.fixedDefault : readMoney(agent.fixedRate);
        created.boostedRates = agent.boostedRates || clone(PAY_SCALES.boostedDefault);
        created.startingRate = agent.startingRate === undefined || agent.startingRate === null || agent.startingRate === '' ? PAY_SCALES.boostedStartingDefault : readMoney(agent.startingRate);
        created.introduced = Boolean(agent.introduced);
        created.commissionMode = agent.commissionMode === 'quick' ? 'quick' : 'exact';
        created.quickCommission = readMoney(agent.commission);
        created.quickDealCount = Math.max(1, Math.floor(readMoney(agent.dealCount)) || 1);
        created.deals = (Array.isArray(agent.dealsInput) && agent.dealsInput.length ? agent.dealsInput : [agent.commission || 0]).map(function (amount) {
          return createDeal(readMoney(amount));
        });
        var motivation = agent.motivation || {};
        created.partnerConfirmed = Boolean(agent.partnerConfirmed || motivation.partnerConfirmed);
        created.quarterlyCommission = readMoney(agent.quarterlyCommission || motivation.quarterlyCommission || motivation.quarterlyResult);
        created.quarterlyDeposits = readMoney(agent.quarterlyDeposits || motivation.quarterlyDeposits);
        created.halfYearCommission = readMoney(agent.halfYearCommission || motivation.halfYearCommission);
        created.preTripQuarterDeposits = readMoney(agent.preTripQuarterDeposits || motivation.preTripQuarterDeposits);
        created.motivationMode = motivation.mode || DEFAULT_MOTIVATION.mode;
        created.stipendMode = motivation.stipendMode || DEFAULT_MOTIVATION.stipendMode;
        created.manualStipendMonthly = readMoney(motivation.manualStipendMonthly);
        created.manualReserveMonthly = readMoney(motivation.manualReserveMonthly || agent.motivationReserve);
        created.annualReserveMode = motivation.annualReserveMode || DEFAULT_MOTIVATION.annualReserveMode;
        created.manualAnnualReserveMonthly = readMoney(motivation.manualAnnualReserveMonthly);
        created.mountainSeaEnabled = Boolean(motivation.mountainSeaEnabled);
        created.mountainSeaPerTrip = readMoney(motivation.mountainSeaPerTrip) || DEFAULT_MOTIVATION.mountainSeaPerTrip;
        created.mountainSeaTripsPerYear = readMoney(motivation.mountainSeaTripsPerYear) || DEFAULT_MOTIVATION.mountainSeaTripsPerYear;
        created.travelEnabled = Boolean(motivation.travelEnabled);
        created.travelPerTrip = readMoney(motivation.travelPerTrip) || DEFAULT_MOTIVATION.travelPerTrip;
        created.travelTripsPerYear = readMoney(motivation.travelTripsPerYear) || DEFAULT_MOTIVATION.travelTripsPerYear;
        created.corporateEnabled = Boolean(motivation.corporateEnabled);
        created.corporatePerYear = readMoney(motivation.corporatePerYear) || DEFAULT_MOTIVATION.corporatePerYear;
        created.congressEnabled = motivation.congressEnabled !== undefined ? Boolean(motivation.congressEnabled) : true;
        created.starEnabled = Boolean(motivation.starEnabled);
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
      showNotice('Данные из A4 загружены в ведомость.');
      render();
    } catch (error) {
      showNotice('Не удалось прочитать snapshot A4.');
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

  document.addEventListener('input', function (event) {
    var target = event.target;
    if (target.dataset.agentField) {
      setAgentField(findAgent(target.dataset.agentId), target.dataset.agentField, target.value, target);
      rerender();
      return;
    }
    if (target.dataset.dealField) {
      var agent = findAgent(target.dataset.agentId);
      var deal = findDeal(agent, target.dataset.dealId);
      if (deal) {
        if (target.dataset.dealField === 'amount') {
          deal.amount = readMoney(target.value);
        } else {
          deal[target.dataset.dealField] = target.value;
        }
      }
      rerender();
      return;
    }
    if (target.dataset.expenseField) {
      setExpenseField(state.expenses.find(function (expense) { return expense.id === target.dataset.expenseId; }), target.dataset.expenseField, target.value);
      rerender();
      return;
    }
    if (target.dataset.officeField === 'ownerSales') {
      state.ownerSales = readMoney(target.value);
      rerender();
    }
  });

  document.addEventListener('change', function (event) {
    var target = event.target;
    if (target.dataset.agentField) {
      setAgentField(findAgent(target.dataset.agentId), target.dataset.agentField, target.value, target);
      rerender();
    }
  });

  document.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;
    var action = button.dataset.action;
    if (action === 'add-agent') {
      state.agents.push(createAgent(''));
      showNotice('Добавлен новый агент.');
      render();
    }
    if (action === 'add-deal') {
      var last = state.agents[state.agents.length - 1] || createAgent('');
      if (!state.agents.length) state.agents.push(last);
      last.commissionMode = 'exact';
      last.deals.push(createDeal(0));
      showNotice('Добавлена сделка последнему агенту.');
      render();
    }
    if (action === 'add-deal-to-agent') {
      var agent = findAgent(button.dataset.agentId);
      if (agent) {
        agent.commissionMode = 'exact';
        agent.deals.push(createDeal(0));
        render();
      }
    }
    if (action === 'remove-deal') {
      var dealAgent = findAgent(button.dataset.agentId);
      if (dealAgent && dealAgent.deals.length > 1) {
        dealAgent.deals = dealAgent.deals.filter(function (deal) { return deal.id !== button.dataset.dealId; });
        render();
      }
    }
    if (action === 'remove-agent') {
      if (state.agents.length > 1) {
        state.agents = state.agents.filter(function (agent) { return agent.id !== button.dataset.agentId; });
        render();
      }
    }
    if (action === 'add-expense') {
      state.expenses.push(createExpense('Новый расход'));
      render();
    }
    if (action === 'remove-expense') {
      state.expenses = state.expenses.filter(function (expense) { return expense.id !== button.dataset.expenseId; });
      render();
    }
    if (action === 'clear-ledger') {
      state = createState();
      showNotice('Ведомость очищена.');
      render();
    }
    if (action === 'load-a4') {
      loadA4Snapshot();
    }
  });

  render();
}());
