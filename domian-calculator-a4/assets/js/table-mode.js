(function () {
  'use strict';

  var SNAPSHOT_KEY = 'domianA4TableSnapshot';
  var DEFAULT_AGENT_ROWS = 10;
  var agentCounter = 0;
  var state = null;
  var elements = {};

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nextAgentId() {
    agentCounter += 1;
    return 'table-agent-' + agentCounter;
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

  function createBlankAgent() {
    return {
      id: nextAgentId(),
      name: '',
      commission: 0,
      dealCount: 1,
      paymentType: 'standard',
      status: 'partner',
      fixedRate: PAY_SCALES.fixedDefault,
      introduced: false,
      motivationReserve: 0,
      manualExpenseShare: 0
    };
  }

  function createBlankState() {
    return {
      expenses: 0,
      ownerSales: 0,
      agents: createBlankAgents(DEFAULT_AGENT_ROWS)
    };
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

  function isActiveAgent(agent) {
    return positiveNumber(agent.commission) > 0
      || positiveNumber(agent.motivationReserve) > 0
      || positiveNumber(agent.manualExpenseShare) > 0;
  }

  function toTableAgent(source) {
    var calculated = calculateAgent(Object.assign({}, source, {
      motivation: Object.assign({}, DEFAULT_MOTIVATION, source.motivation || {})
    }));

    return {
      id: source.id || nextAgentId(),
      name: source.name || 'Агент',
      commission: calculated.commission,
      dealCount: calculated.dealCount,
      paymentType: source.paymentType || calculated.paymentType || 'standard',
      status: source.status || calculated.status || 'partner',
      fixedRate: positiveNumber(source.fixedRate || calculated.fixedRate || PAY_SCALES.fixedDefault),
      introduced: Boolean(source.introduced),
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
      var agents = Array.isArray(snapshot.agents) && snapshot.agents.length
        ? snapshot.agents.map(toTableAgent)
        : createBlankAgents(DEFAULT_AGENT_ROWS);

      return {
        expenses: calculateExpenses(snapshot.expenses || []),
        ownerSales: positiveNumber(snapshot.ownerSales),
        agents: fillToDefaultRows(agents)
      };
    } catch (error) {
      return null;
    }
  }

  function getCalculationAgent(agent) {
    return {
      id: agent.id,
      name: agent.name,
      commission: positiveNumber(agent.commission),
      dealCount: Math.max(1, Math.floor(positiveNumber(agent.dealCount))),
      paymentType: agent.paymentType || 'standard',
      status: agent.status || 'partner',
      fixedRate: positiveNumber(agent.fixedRate || PAY_SCALES.fixedDefault),
      introduced: Boolean(agent.introduced),
      boostedRates: clone(PAY_SCALES.boostedDefault),
      motivation: {
        stipendMode: 'manual',
        manualStipendMonthly: positiveNumber(agent.motivationReserve)
      }
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
    var activeSources = state.agents.filter(isActiveAgent);
    var calculatedAgents = activeSources.map(function (agent) {
      return calculateAgent(getCalculationAgent(agent));
    });
    var agentTurnover = calculatedAgents.reduce(function (sum, agent) { return sum + agent.commission; }, 0);
    var ownerSales = positiveNumber(state.ownerSales);
    var expenses = positiveNumber(state.expenses);
    var totalTurnover = agentTurnover + ownerSales;
    var agentPayouts = calculatedAgents.reduce(function (sum, agent) { return sum + agent.payout; }, 0);
    var referrals = calculatedAgents.reduce(function (sum, agent) { return sum + agent.referral; }, 0);
    var motivationReserves = calculatedAgents.reduce(function (sum, agent) { return sum + agent.motivationReserve; }, 0);
    var royaltyWithoutOwner = calculateRoyalty(agentTurnover);
    var royaltyWithOwner = calculateRoyalty(totalTurnover);
    var autoExpenseShare = calculatedAgents.length ? expenses / calculatedAgents.length : expenses;
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
      + '<td><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="commission" value="' + positiveNumber(agent.commission) + '"></td>'
      + '<td><input type="number" min="1" step="1" data-agent-id="' + agent.id + '" data-agent-field="dealCount" value="' + Math.max(1, Math.floor(positiveNumber(agent.dealCount))) + '"></td>'
      + '<td><select data-agent-id="' + agent.id + '" data-agent-field="paymentType">'
      + option('standard', 'Стандарт', agent.paymentType)
      + option('boosted', 'Повышенная', agent.paymentType)
      + option('fixed', 'Фикс', agent.paymentType)
      + '</select></td>'
      + '<td><select data-agent-id="' + agent.id + '" data-agent-field="status">'
      + option('trainee', 'Стажёр', agent.status)
      + option('partner', 'Партнёр', agent.status)
      + '</select></td>'
      + '<td><input type="number" min="0" max="100" step="1" data-agent-id="' + agent.id + '" data-agent-field="fixedRate" value="' + positiveNumber(agent.fixedRate || PAY_SCALES.fixedDefault) + '"></td>'
      + '<td><select data-agent-id="' + agent.id + '" data-agent-field="introduced">'
      + option('false', 'Нет', String(Boolean(agent.introduced)))
      + option('true', 'Да', String(Boolean(agent.introduced)))
      + '</select></td>'
      + '<td><input type="number" min="0" step="500" data-agent-id="' + agent.id + '" data-agent-field="motivationReserve" value="' + positiveNumber(agent.motivationReserve) + '"></td>'
      + '<td><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="manualExpenseShare" value="' + positiveNumber(agent.manualExpenseShare) + '"></td>'
      + '<td>' + money(calculated.payout) + '</td>'
      + '<td>' + money(calculated.referral) + '</td>'
      + '<td>' + money(row.royaltyShare) + '</td>'
      + '<td>' + money(row.beforeExpenses) + '</td>'
      + '<td class="strong-value">' + money(row.contribution) + '</td>'
      + '<td><span class="status-pill">' + row.status.label + '</span></td>'
      + '<td class="comment-cell">' + escapeHtml(row.comment) + '</td>'
      + '<td><button class="row-button" type="button" data-action="remove-agent" data-agent-id="' + agent.id + '">Удалить</button></td>'
      + '</tr>';
  }

  function renderBlankAgentRow(agent) {
    return '<tr class="empty-row">'
      + '<td><input type="text" placeholder="Агент" data-agent-id="' + agent.id + '" data-agent-field="name" value="' + escapeHtml(agent.name) + '"></td>'
      + '<td><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="commission" value="' + positiveNumber(agent.commission) + '"></td>'
      + '<td><input type="number" min="1" step="1" data-agent-id="' + agent.id + '" data-agent-field="dealCount" value="' + Math.max(1, Math.floor(positiveNumber(agent.dealCount))) + '"></td>'
      + '<td><select data-agent-id="' + agent.id + '" data-agent-field="paymentType">'
      + option('standard', 'Стандарт', agent.paymentType)
      + option('boosted', 'Повышенная', agent.paymentType)
      + option('fixed', 'Фикс', agent.paymentType)
      + '</select></td>'
      + '<td><select data-agent-id="' + agent.id + '" data-agent-field="status">'
      + option('trainee', 'Стажёр', agent.status)
      + option('partner', 'Партнёр', agent.status)
      + '</select></td>'
      + '<td><input type="number" min="0" max="100" step="1" data-agent-id="' + agent.id + '" data-agent-field="fixedRate" value="' + positiveNumber(agent.fixedRate || PAY_SCALES.fixedDefault) + '"></td>'
      + '<td><select data-agent-id="' + agent.id + '" data-agent-field="introduced">'
      + option('false', 'Нет', String(Boolean(agent.introduced)))
      + option('true', 'Да', String(Boolean(agent.introduced)))
      + '</select></td>'
      + '<td><input type="number" min="0" step="500" data-agent-id="' + agent.id + '" data-agent-field="motivationReserve" value="' + positiveNumber(agent.motivationReserve) + '"></td>'
      + '<td><input type="number" min="0" step="1000" data-agent-id="' + agent.id + '" data-agent-field="manualExpenseShare" value="' + positiveNumber(agent.manualExpenseShare) + '"></td>'
      + '<td class="muted-value">—</td>'
      + '<td class="muted-value">—</td>'
      + '<td class="muted-value">—</td>'
      + '<td class="muted-value">—</td>'
      + '<td class="muted-value">—</td>'
      + '<td><span class="status-pill muted">Пусто</span></td>'
      + '<td class="comment-cell">Не влияет на итог</td>'
      + '<td><button class="row-button" type="button" data-action="remove-agent" data-agent-id="' + agent.id + '">Удалить</button></td>'
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

  function render() {
    var totals = calculateTable();
    elements.officeExpensesInput.value = positiveNumber(state.expenses);
    elements.ownerSalesInput.value = positiveNumber(state.ownerSales);
    elements.officeRoyalty.textContent = money(totals.royaltyWithOwner);
    elements.agentsTableBody.innerHTML = state.agents.map(function (agent) {
      var row = totals.rows.find(function (item) {
        return item.source.id === agent.id;
      });
      return row ? renderAgentRow(row) : renderBlankAgentRow(agent);
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
    if (element.dataset.agentField && element.dataset.agentId) {
      return '[data-agent-field="' + element.dataset.agentField + '"][data-agent-id="' + element.dataset.agentId + '"]';
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
    if (target.dataset.officeField === 'expenses') {
      state.expenses = positiveNumber(target.value);
      renderPreservingFocus();
      return;
    }
    if (target.dataset.officeField === 'ownerSales') {
      state.ownerSales = positiveNumber(target.value);
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
      } else if (field === 'introduced') {
        agent.introduced = target.value === 'true';
      } else if (field === 'dealCount') {
        agent.dealCount = Math.max(1, Math.floor(positiveNumber(target.value)));
      } else {
        agent[field] = positiveNumber(target.value);
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
      state = createBlankState();
      elements.snapshotNotice.textContent = 'Таблица очищена. Данные основной A4-страницы не изменены.';
      render();
    }
    if (action.dataset.action === 'add-agent') {
      state.agents.push(createBlankAgent());
      render();
    }
    if (action.dataset.action === 'remove-agent') {
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
      'officeExpensesInput',
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
    state = loadSnapshotState() || createBlankState();
    elements.snapshotNotice.textContent = state.agents.some(function (agent) { return agent.commission > 0; })
      ? 'Данные из A4 загружены из локального snapshot.'
      : 'Данные из A4 не найдены. Можно заполнить таблицу вручную.';
    document.body.addEventListener('input', onInput);
    document.body.addEventListener('change', onInput);
    document.body.addEventListener('click', onClick);
    render();
  });
}());
