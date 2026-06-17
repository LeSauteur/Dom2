(function () {
  'use strict';

  var DRAFT_KEY = 'domianExtendedDraft';
  var periods = {
    month: { label: 'месяц', months: 1 },
    quarter: { label: 'квартал', months: 3 },
    halfyear: { label: 'полугодие', months: 6 },
    year: { label: 'год', months: 12 }
  };

  var state = {
    period: 'month',
    inputMode: 'quick',
    quick: {
      commission: '',
      agentCount: '',
      expenses: '',
      dealCount: ''
    },
    office: {
      expenses: '',
      mountainSeaEnabled: false,
      travelEnabled: false,
      stipendEnabled: false
    },
    agents: [createAgent()]
  };

  var agentCounter = 1;
  var dealCounter = 1;

  function createAgent() {
    var id = 'extended-agent-' + agentCounter;
    agentCounter += 1;
    return {
      id: id,
      name: '',
      status: 'partner',
      paymentType: 'standard',
      startingRate: PAY_SCALES.boostedStartingDefault || 55,
      fixedRate: PAY_SCALES.fixedDefault || 80,
      introduced: false,
      starEnabled: false,
      congressEnabled: true,
      deals: [createDeal()]
    };
  }

  function createDeal(amount) {
    var id = 'extended-deal-' + dealCounter;
    dealCounter += 1;
    return { id: id, amount: amount || '' };
  }

  function readMoney(value) {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    var normalized = String(value).replace(/\s+/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    var parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  function readCount(value, fallback) {
    var parsed = Math.floor(readMoney(value));
    return parsed > 0 ? parsed : fallback;
  }

  function money(value) {
    return Math.round(readMoney(value)).toLocaleString('ru-RU') + ' ₽';
  }

  function percent(value) {
    return Math.round((Number(value) || 0) * 1000) / 10 + '%';
  }

  function activePeriod() {
    return periods[state.period] || periods.month;
  }

  function scaledMotivation(agent) {
    var months = activePeriod().months;
    return Object.assign({}, DEFAULT_MOTIVATION, {
      mode: (state.office.mountainSeaEnabled || state.office.travelEnabled || state.office.stipendEnabled) ? 'rules' : 'off',
      stipendMode: state.office.stipendEnabled ? 'auto' : 'off',
      quarterlyCommission: totalAgentCommission(agent),
      quarterlyDeposits: totalAgentCommission(agent),
      halfYearCommission: totalAgentCommission(agent),
      preTripQuarterDeposits: totalAgentCommission(agent),
      partnerConfirmed: true,
      mountainSeaEnabled: Boolean(state.office.mountainSeaEnabled),
      travelEnabled: Boolean(state.office.travelEnabled),
      congressEnabled: Boolean(agent.congressEnabled),
      congressPerYear: DEFAULT_MOTIVATION.congressPerYear * months,
      starEnabled: Boolean(agent.starEnabled),
      starPerYear: DEFAULT_MOTIVATION.starPerYear * months
    });
  }

  function totalAgentCommission(agent) {
    return agent.deals.reduce(function (sum, deal) {
      return sum + readMoney(deal.amount);
    }, 0);
  }

  function buildCalculationAgent(agent) {
    return {
      name: agent.name,
      status: agent.status,
      paymentType: agent.paymentType,
      commissionMode: 'exact',
      dealsInput: agent.deals.map(function (deal) { return readMoney(deal.amount); }),
      dealCount: agent.deals.length,
      commission: totalAgentCommission(agent),
      startingRate: readMoney(agent.startingRate),
      fixedRate: agent.fixedRate === '' || agent.fixedRate === null || agent.fixedRate === undefined
        ? PAY_SCALES.fixedDefault
        : readMoney(agent.fixedRate),
      introduced: Boolean(agent.introduced),
      partnerConfirmed: true,
      motivation: scaledMotivation(agent)
    };
  }

  function buildQuickAgent() {
    var dealCount = readCount(state.quick.dealCount, 1);
    var commission = readMoney(state.quick.commission);
    var perDeal = dealCount ? commission / dealCount : 0;
    var deals = [];
    for (var i = 0; i < dealCount; i += 1) {
      deals.push(perDeal);
    }
    return {
      name: 'Быстрый расчёт',
      status: 'partner',
      paymentType: 'standard',
      commissionMode: 'exact',
      dealsInput: deals,
      dealCount: dealCount,
      commission: commission,
      fixedRate: PAY_SCALES.fixedDefault,
      startingRate: PAY_SCALES.boostedStartingDefault,
      introduced: false,
      partnerConfirmed: true,
      motivation: Object.assign({}, DEFAULT_MOTIVATION, {
        mode: 'off',
        stipendMode: 'off',
        congressEnabled: false,
        starEnabled: false
      })
    };
  }

  function calculateDetailed() {
    var calculated = state.agents.map(function (agent) {
      return {
        source: agent,
        result: calculateAgent(buildCalculationAgent(agent))
      };
    });
    return summarize(calculated, readMoney(state.office.expenses));
  }

  function calculateQuick() {
    var agentCount = readCount(state.quick.agentCount, 1);
    var calculated = [{
      source: { name: 'Общий ручной ввод', deals: new Array(readCount(state.quick.dealCount, 1)) },
      result: calculateAgent(buildQuickAgent())
    }];
    var summary = summarize(calculated, readMoney(state.quick.expenses));
    summary.agentCount = agentCount;
    return summary;
  }

  function summarize(calculated, expenses) {
    var commission = calculated.reduce(function (sum, item) { return sum + item.result.commission; }, 0);
    var payouts = calculated.reduce(function (sum, item) { return sum + item.result.payout; }, 0);
    var referrals = calculated.reduce(function (sum, item) { return sum + item.result.referral; }, 0);
    var motivations = calculated.reduce(function (sum, item) { return sum + item.result.motivationReserve; }, 0);
    var royalty = calculateRoyalty(commission);
    var beforeObligations = commission - payouts - referrals - royalty - expenses;
    var owner = beforeObligations - motivations;
    var dealCount = calculated.reduce(function (sum, item) { return sum + item.result.dealCount; }, 0);
    var agentCount = state.inputMode === 'detailed' ? state.agents.length : readCount(state.quick.agentCount, 1);
    var royaltyRate = commission > 0 ? royalty / commission : 0;

    return {
      calculated: calculated,
      commission: commission,
      payouts: payouts,
      referrals: referrals,
      royalty: royalty,
      royaltyRate: royaltyRate,
      expenses: expenses,
      motivations: motivations,
      beforeObligations: beforeObligations,
      owner: owner,
      margin: commission > 0 ? owner / commission : 0,
      agentCount: agentCount,
      dealCount: dealCount
    };
  }

  function currentSummary() {
    return state.inputMode === 'quick' ? calculateQuick() : calculateDetailed();
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setStarOwner(agentId) {
    state.agents.forEach(function (agent) {
      agent.starEnabled = agent.id === agentId;
    });
  }

  function normalizeSingleStar() {
    var starUsed = false;
    state.agents.forEach(function (agent) {
      if (agent.starEnabled && starUsed) {
        agent.starEnabled = false;
      }
      if (agent.starEnabled) {
        starUsed = true;
      }
    });
  }

  function renderAgents() {
    var host = document.getElementById('agentsEditor');
    if (!host) return;
    host.innerHTML = state.agents.map(function (agent, agentIndex) {
      var starOwner = state.agents.find(function (candidate) {
        return candidate.id !== agent.id && candidate.starEnabled;
      });
      var startingDisabled = agent.paymentType === 'boosted' ? '' : ' disabled';
      var fixedDisabled = agent.paymentType === 'fixed' ? '' : ' disabled';
      var deals = agent.deals.map(function (deal, dealIndex) {
        var calcAgent = buildCalculationAgent(agent);
        var rate = getDealRate(calcAgent, dealIndex);
        var amount = readMoney(deal.amount);
        return '<div class="deal-row-extended" data-agent-id="' + agent.id + '" data-deal-id="' + deal.id + '">'
          + '<label>№ сделки<input type="text" value="' + (dealIndex + 1) + '" disabled></label>'
          + '<label>Комиссия сделки<input type="text" inputmode="numeric" data-deal-field="amount" value="' + escapeHtml(deal.amount) + '" placeholder="Например, 100 000"></label>'
          + '<div class="deal-stat"><span>Процент</span>' + percent(rate) + '</div>'
          + '<div class="deal-stat"><span>Агенту</span>' + money(amount * rate) + '</div>'
          + '<button class="button danger-button" type="button" data-action="remove-deal" ' + (agent.deals.length === 1 ? 'disabled' : '') + '>×</button>'
          + '</div>';
      }).join('');

      return '<article class="agent-card" data-agent-id="' + agent.id + '">'
        + '<div class="agent-card__head">'
        + '<h3>Агент ' + (agentIndex + 1) + '</h3>'
        + '<button class="button danger-button" type="button" data-action="remove-agent" ' + (state.agents.length === 1 ? 'disabled' : '') + '>Удалить агента</button>'
        + '</div>'
        + '<div class="agent-fields">'
        + '<label>Имя агента<input type="text" data-agent-field="name" value="' + escapeHtml(agent.name) + '" placeholder="Имя"></label>'
        + '<label>Роль<select data-agent-field="status">' + option('trainee', 'Стажёр', agent.status) + option('partner', 'Партнёр', agent.status) + '</select></label>'
        + '<label>Схема выплаты<select data-agent-field="paymentType">' + option('standard', 'Стандарт', agent.paymentType) + option('boosted', 'Повышенная стартовая', agent.paymentType) + option('fixed', 'Фикс', agent.paymentType) + '</select></label>'
        + '<label>Стартовый процент<input type="number" min="0" max="100" step="1" data-agent-field="startingRate" value="' + escapeHtml(agent.startingRate) + '"' + startingDisabled + '></label>'
        + '<label>Фиксированный процент<input type="number" min="0" max="100" step="1" data-agent-field="fixedRate" value="' + escapeHtml(agent.fixedRate) + '"' + fixedDisabled + '></label>'
        + '<label class="flag-line"><input type="checkbox" data-agent-field="introduced" ' + (agent.introduced ? 'checked' : '') + '> Приведённый агент</label>'
        + '<label class="flag-line"><input type="checkbox" data-agent-field="congressEnabled" ' + (agent.congressEnabled ? 'checked' : '') + '> Конгресс</label>'
        + '<label class="flag-line" title="' + (starOwner ? 'Звезда уже назначена другому агенту' : '') + '"><input type="checkbox" data-agent-field="starEnabled" ' + (agent.starEnabled ? 'checked' : '') + (starOwner ? ' disabled' : '') + '> Звезда</label>'
        + '</div>'
        + '<div class="deals-list">' + deals + '</div>'
        + '<div class="button-row"><button class="button primary" type="button" data-action="add-deal">+ Сделка</button></div>'
        + '</article>';
    }).join('');
  }

  function option(value, label, selected) {
    return '<option value="' + value + '"' + (value === selected ? ' selected' : '') + '>' + label + '</option>';
  }

  function renderSummary() {
    var summary = currentSummary();
    var block = document.getElementById('summaryBlock');
    var ownerResult = document.getElementById('ownerResult');
    if (ownerResult) ownerResult.textContent = money(summary.owner);
    if (block) {
      block.innerHTML = '<h2>Управленческая сводка</h2>'
        + '<div class="summary-list-extended">'
        + summaryRow('Общий оборот/комиссия периода', money(summary.commission))
        + summaryRow('Выплаты агентам', money(summary.payouts))
        + summaryRow('Реферальные выплаты', money(summary.referrals))
        + summaryRow('Роялти', money(summary.royalty) + ' · ' + percent(summary.royaltyRate))
        + summaryRow('Расходы офиса', money(summary.expenses))
        + summaryRow('Мотивационные резервы / обязательства', money(summary.motivations))
        + summaryRow('Итог до обязательств', money(summary.beforeObligations))
        + summaryRow('Итог собственнику', money(summary.owner))
        + summaryRow('Маржинальность / доля остатка', percent(summary.margin))
        + summaryRow('Количество агентов', String(summary.agentCount))
        + summaryRow('Количество сделок', String(summary.dealCount))
        + '</div>';
    }
    renderAgentSummary(summary);
    var period = activePeriod();
    var periodNote = document.getElementById('periodNote');
    if (periodNote) {
      periodNote.textContent = 'Выбран период: ' + period.label + ', ' + period.months + ' ' + monthWord(period.months) + '.';
    }
  }

  function summaryRow(label, value) {
    return '<div class="summary-row"><span>' + label + '</span><strong>' + value + '</strong></div>';
  }

  function monthWord(count) {
    if (count === 1) return 'месяц';
    if (count >= 2 && count <= 4) return 'месяца';
    return 'месяцев';
  }

  function renderAgentSummary(summary) {
    var host = document.getElementById('agentSummary');
    if (!host) return;
    if (state.inputMode !== 'detailed') {
      host.innerHTML = '<p class="calculation-note">В общем ручном вводе сводка по агентам заменена агрегированной оценкой.</p>';
      return;
    }
    host.innerHTML = '<div class="agent-summary-cards">' + summary.calculated.map(function (item, index) {
      var result = item.result;
      var royaltyShare = summary.commission > 0 ? summary.royalty * (result.commission / summary.commission) : 0;
      var expenseShare = summary.commission > 0 ? summary.expenses * (result.commission / summary.commission) : 0;
      var contribution = result.commission - result.payout - result.referral - result.motivationReserve - royaltyShare - expenseShare;
      return '<article class="agent-summary-card">'
        + '<h3>' + escapeHtml(item.source.name || ('Агент ' + (index + 1))) + '</h3>'
        + '<dl>'
        + summaryTerm('Комиссия', money(result.commission))
        + summaryTerm('Количество сделок', String(result.dealCount))
        + summaryTerm('Выплата агенту', money(result.payout))
        + summaryTerm('Реферал', money(result.referral))
        + summaryTerm('Мотивации/обязательства', money(result.motivationReserve))
        + summaryTerm('Вклад после основных расходов', money(contribution))
        + '</dl>'
        + '</article>';
    }).join('') + '</div>';
  }

  function summaryTerm(label, value) {
    return '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>';
  }

  function renderMode() {
    var quick = document.getElementById('quickModePanel');
    var detailed = document.getElementById('detailedModePanel');
    var buttons = document.querySelectorAll('[data-input-mode]');
    if (quick) quick.hidden = state.inputMode !== 'quick';
    if (detailed) detailed.hidden = state.inputMode !== 'detailed';
    buttons.forEach(function (button) {
      button.classList.toggle('primary', button.dataset.inputMode === state.inputMode);
    });
  }

  function renderDraftNotice() {
    var notice = document.getElementById('draftStatus');
    if (!notice) return;
    notice.hidden = !localStorage.getItem(DRAFT_KEY);
  }

  function render() {
    normalizeSingleStar();
    renderMode();
    renderAgents();
    renderSummary();
    renderDraftNotice();
  }

  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    showMessage('Черновик сохранён.');
    renderDraftNotice();
  }

  function loadDraft() {
    var raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      showMessage('Сохранённый черновик не найден.');
      return;
    }
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.agents)) throw new Error('bad draft');
      state = parsed;
      agentCounter = 1;
      dealCounter = 1;
      state.agents.forEach(function (agent) {
        var agentNum = Number(String(agent.id || '').replace(/\D/g, ''));
        if (agentNum >= agentCounter) agentCounter = agentNum + 1;
        (agent.deals || []).forEach(function (deal) {
          var dealNum = Number(String(deal.id || '').replace(/\D/g, ''));
          if (dealNum >= dealCounter) dealCounter = dealNum + 1;
        });
      });
      showMessage('Черновик загружен.');
      render();
    } catch (error) {
      showMessage('Не удалось загрузить черновик.');
    }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    showMessage('Черновик очищен.');
    renderDraftNotice();
  }

  function showMessage(text) {
    var node = document.getElementById('saveMessage');
    if (node) node.textContent = text;
  }

  function bindEvents() {
    document.addEventListener('input', function (event) {
      var target = event.target;
      var agentNode = target.closest('[data-agent-id]');
      var dealNode = target.closest('[data-deal-id]');
      if (target.name === 'period') {
        state.period = target.value;
      } else if (target.dataset.quickField) {
        state.quick[target.dataset.quickField] = target.value;
      } else if (target.dataset.officeField) {
        state.office[target.dataset.officeField] = target.type === 'checkbox' ? target.checked : target.value;
      } else if (target.dataset.agentField && agentNode) {
        var agent = state.agents.find(function (item) { return item.id === agentNode.dataset.agentId; });
        if (!agent) return;
        if (target.dataset.agentField === 'starEnabled' && target.checked) {
          setStarOwner(agent.id);
        } else {
          agent[target.dataset.agentField] = target.type === 'checkbox' ? target.checked : target.value;
        }
      } else if (target.dataset.dealField && agentNode && dealNode) {
        var owner = state.agents.find(function (item) { return item.id === agentNode.dataset.agentId; });
        var deal = owner && owner.deals.find(function (item) { return item.id === dealNode.dataset.dealId; });
        if (deal) deal[target.dataset.dealField] = target.value;
      }
      renderSummary();
      renderMode();
    });

    document.addEventListener('change', function (event) {
      if (event.target.name === 'period') {
        state.period = event.target.value;
        render();
      }
      if (event.target.dataset.agentField || event.target.dataset.officeField) {
        render();
      }
    });

    document.addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (!button) return;
      var action = button.dataset.action;
      var mode = button.dataset.inputMode;
      var agentNode = button.closest('[data-agent-id]');
      var dealNode = button.closest('[data-deal-id]');
      if (mode) {
        state.inputMode = mode;
        render();
        return;
      }
      if (action === 'add-agent') {
        state.agents.push(createAgent());
      }
      if (action === 'remove-agent' && agentNode && state.agents.length > 1) {
        state.agents = state.agents.filter(function (agent) { return agent.id !== agentNode.dataset.agentId; });
      }
      if (action === 'add-deal' && agentNode) {
        var agent = state.agents.find(function (item) { return item.id === agentNode.dataset.agentId; });
        if (agent) agent.deals.push(createDeal());
      }
      if (action === 'remove-deal' && agentNode && dealNode) {
        var dealAgent = state.agents.find(function (item) { return item.id === agentNode.dataset.agentId; });
        if (dealAgent && dealAgent.deals.length > 1) {
          dealAgent.deals = dealAgent.deals.filter(function (deal) { return deal.id !== dealNode.dataset.dealId; });
        }
      }
      if (action === 'save-draft') saveDraft();
      if (action === 'load-draft') loadDraft();
      if (action === 'clear-draft') clearDraft();
      if (action) render();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindEvents();
    render();
  });

  window.DomianExtended = {
    currentSummary: currentSummary,
    readMoney: readMoney,
    state: state
  };
}());
