(function () {
  'use strict';

  var state = {
    rows: [],
    period: '',
    calculated: false,
    saved: false
  };
  var elements = {};

  function element(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function number(value) {
    return CareerReportEngine.positiveNumber(value);
  }

  function localDate(value) {
    var date = value || new Date();
    var instance = date instanceof Date ? date : new Date(date);
    return [instance.getFullYear(), String(instance.getMonth() + 1).padStart(2, '0'), String(instance.getDate()).padStart(2, '0')].join('-');
  }

  function money(value) {
    return Math.round(number(value)).toLocaleString('ru-RU') + ' ₽';
  }

  function displayDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
      return '—';
    }
    return String(value).slice(8, 10) + '.' + String(value).slice(5, 7) + '.' + String(value).slice(0, 4);
  }

  function selectedPeriod() {
    return CareerReportEngine.periodFromSelection(elements.year.value, elements.half.value);
  }

  function defaultValues(profile, source) {
    var input = source && source.input ? source.input : {};
    var result = source && source.result ? source.result : {};
    return {
      asOfDate: input.asOfDate || elements.asOf.value || localDate(),
      halfYearCommission: number(input.halfYearCommission),
      halfYearResultConfirmed: input.halfYearResult ? input.halfYearResult.confirmed === true : true,
      previousPerformancePackage: input.previousPerformancePackage || result.performancePackage || 'standard',
      quarterDeposits: number(input.quarterDeposits),
      quarterlyCommission: number(input.quarterlyCommission),
      previousMonthDeposits: number(input.previousMonthDeposits),
      officePlanCompleted: input.officePlanCompleted === true,
      agentParticipated: input.agentParticipated === true,
      travelQuarterPartnershipConfirmed: input.travelQuarterPartnershipConfirmed === true,
      mountainSeaCost: input.mountainSeaCost === undefined ? 15000 : number(input.mountainSeaCost),
      travelCost: input.travelCost === undefined ? 100000 : number(input.travelCost),
      corporateCost: input.corporateCost === undefined ? 20000 : number(input.corporateCost)
    };
  }

  function loadRows() {
    var store = CareerStorage.read();
    var period = selectedPeriod();
    var hasSaved = false;
    state.period = period;
    state.rows = store.profiles.map(function (profile) {
      var exact = CareerStorage.getDecision(profile.id, period);
      var previous = CareerStorage.getPreviousDecision(profile.id, period);
      var source = exact || previous;
      hasSaved = hasSaved || Boolean(exact);
      return {
        id: profile.id,
        profile: Object.assign({}, profile),
        values: defaultValues(profile, source),
        calculation: exact ? {
          profile: profile,
          input: exact.input,
          result: exact.result,
          benefits: exact.benefits,
          level: CareerReportEngine.halfYearLevel(exact.input && exact.input.halfYearCommission),
          tenureLabel: CareerReportEngine.fullYearsMonths(exact.result && exact.result.tenureMonths, Boolean(profile.employmentStartDate)),
          motivation: motivationLabels(exact.benefits)
        } : null,
        previousDecision: previous,
        savedForPeriod: Boolean(exact),
        isNew: false
      };
    });
    state.calculated = state.rows.length > 0 && state.rows.every(function (row) { return row.calculation; });
    state.saved = state.rows.length > 0 && state.rows.every(function (row) { return row.savedForPeriod; });
    render();
    setStatus(hasSaved ? (state.saved ? 'Данные сохранены' : 'Для части сотрудников период ещё не сохранён') : 'Текущий период ещё не сохранён', state.saved ? 'saved' : 'clean');
  }

  function benefit(id, benefits) {
    return benefits && Array.isArray(benefits.items)
      ? benefits.items.find(function (item) { return item.id === id; }) || null
      : null;
  }

  function motivationLabels(benefits) {
    var stipend = benefit('stipend', benefits);
    return {
      mountainSea: CareerReportEngine.benefitLabel(benefit('mountainSea', benefits)),
      travel: CareerReportEngine.benefitLabel(benefit('travel', benefits)),
      advertising: CareerReportEngine.benefitLabel(benefit('leadGeneration', benefits), true),
      corporate: CareerReportEngine.benefitLabel(benefit('corporate', benefits)),
      stipend: stipend && stipend.available ? money(stipend.officeCost) + '/мес.' : '—'
    };
  }

  function packageOptions(selected) {
    return MOTIVATION_POLICY_2026.packages.filter(function (item) {
      return item.status === 'partner';
    }).map(function (item) {
      return '<option value="' + item.id + '"' + (item.id === selected ? ' selected' : '') + '>' + escapeHtml(item.label) + '</option>';
    }).join('');
  }

  function cellResult(row, key, fallback) {
    return row.calculation ? row.calculation[key] : fallback;
  }

  function rowHtml(row, index) {
    var calculation = row.calculation;
    var result = calculation && calculation.result;
    var motivation = calculation && calculation.motivation;
    var level = calculation ? calculation.level : CareerReportEngine.halfYearLevel(row.values.halfYearCommission);
    var warning = result && result.performanceStatus === 'unconfirmed'
      ? '<p class="career-report-row-warning">Доход и уровень показаны справочно: неподтверждённый результат не меняет пакет по результатам.</p>'
      : '';
    return '<tr class="career-report-main-row" data-report-row="' + escapeHtml(row.id) + '">'
      + '<td>' + (index + 1) + '</td>'
      + '<td class="career-report-name-column"><input aria-label="Ф. И. О. сотрудника" data-report-field="name" value="' + escapeHtml(row.profile.name) + '"></td>'
      + '<td><input aria-label="Дата начала работы" data-report-field="employmentStartDate" type="date" value="' + escapeHtml(row.profile.employmentStartDate) + '"></td>'
      + '<td>' + escapeHtml(calculation ? calculation.tenureLabel : 'Не рассчитано') + '</td>'
      + '<td><input aria-label="Доход за полугодие" data-report-field="halfYearCommission" type="number" min="0" step="1000" value="' + (row.values.halfYearCommission || '') + '"></td>'
      + '<td>' + (level ? level + ' уровень' : 'Ниже 1 уровня') + '</td>'
      + '<td>' + escapeHtml(result ? result.effectivePackageLabel : 'Не рассчитано') + '</td>'
      + '<td>' + (result ? escapeHtml(result.effectiveFloorRate) + '%' : '—') + '</td>'
      + '<td>' + escapeHtml(motivation ? motivation.mountainSea : '—') + '</td>'
      + '<td>' + escapeHtml(motivation ? motivation.travel : '—') + '</td>'
      + '<td>' + escapeHtml(motivation ? motivation.advertising : '—') + '</td>'
      + '<td>' + escapeHtml(motivation ? motivation.corporate : '—') + '</td>'
      + '<td>' + escapeHtml(motivation ? motivation.stipend : '—') + '</td>'
      + '<td class="career-report-actions-column"><div class="career-report-row-actions">'
      + '<button type="button" data-report-action="toggle" data-row-id="' + escapeHtml(row.id) + '" aria-expanded="false">Условия</button>'
      + (row.isNew ? '' : '<button type="button" data-report-action="open-card" data-row-id="' + escapeHtml(row.id) + '">Открыть карточку</button>')
      + '<button class="is-danger" type="button" data-report-action="delete" data-row-id="' + escapeHtml(row.id) + '">Удалить</button>'
      + '</div></td></tr>'
      + '<tr class="career-report-detail-row" data-report-detail="' + escapeHtml(row.id) + '" hidden><td colspan="14">'
      + '<div class="career-report-details">'
      + '<label><span>Статус</span><select data-report-field="status"><option value="partner"' + (row.profile.status !== 'trainee' ? ' selected' : '') + '>Партнёр</option><option value="trainee"' + (row.profile.status === 'trainee' ? ' selected' : '') + '>Стажёр</option></select></label>'
      + '<label><span>Предыдущий пакет</span><select data-report-field="previousPerformancePackage">' + packageOptions(row.values.previousPerformancePackage) + '</select></label>'
      + '<label class="career-report-check"><input type="checkbox" data-report-field="halfYearResultConfirmed"' + (row.values.halfYearResultConfirmed ? ' checked' : '') + '><span>Результат полугодия подтверждён</span></label>'
      + '<label><span>Минимальный % по договору</span><input type="number" min="0" max="100" data-report-field="contractualFloorRate" value="' + (row.profile.contractualFloorRate || '') + '"></label>'
      + '<label><span>Задатки за квартал</span><input type="number" min="0" step="1000" data-report-field="quarterDeposits" value="' + (row.values.quarterDeposits || '') + '"></label>'
      + '<label><span>Доход за квартал</span><input type="number" min="0" step="1000" data-report-field="quarterlyCommission" value="' + (row.values.quarterlyCommission || '') + '"></label>'
      + '<label><span>Задатки предыдущего месяца</span><input type="number" min="0" step="1000" data-report-field="previousMonthDeposits" value="' + (row.values.previousMonthDeposits || '') + '"></label>'
      + '<label class="career-report-check"><input type="checkbox" data-report-field="officePlanCompleted"' + (row.values.officePlanCompleted ? ' checked' : '') + '><span>План офиса выполнен</span></label>'
      + '<label class="career-report-check"><input type="checkbox" data-report-field="agentParticipated"' + (row.values.agentParticipated ? ' checked' : '') + '><span>Агент участвовал в плане</span></label>'
      + '<label class="career-report-check"><input type="checkbox" data-report-field="travelQuarterPartnershipConfirmed"' + (row.values.travelQuarterPartnershipConfirmed ? ' checked' : '') + '><span>Партнёрство перед поездкой подтверждено</span></label>'
      + '<label><span>Стоимость «Море / горы»</span><input type="number" min="0" step="1000" data-report-field="mountainSeaCost" value="' + row.values.mountainSeaCost + '"></label>'
      + '<label><span>Стоимость путешествия</span><input type="number" min="0" step="1000" data-report-field="travelCost" value="' + row.values.travelCost + '"></label>'
      + '<label><span>Стоимость корпоратива</span><input type="number" min="0" step="1000" data-report-field="corporateCost" value="' + row.values.corporateCost + '"></label>'
      + '<label class="career-report-comment"><span>Комментарий</span><textarea rows="2" data-report-field="notes">' + escapeHtml(row.profile.notes) + '</textarea></label>'
      + '</div>' + warning + benefitReasons(calculation && calculation.benefits) + '</td></tr>';
  }

  function benefitReasons(benefits) {
    if (!benefits || !Array.isArray(benefits.items)) {
      return '';
    }
    return '<ul class="career-report-reasons">' + benefits.items.map(function (item) {
      return '<li><b>' + escapeHtml(item.label) + ':</b> ' + escapeHtml(item.reason) + '</li>';
    }).join('') + '</ul>';
  }

  function renderPrintRows() {
    elements.printRows.innerHTML = state.rows.map(function (row, index) {
      var calc = row.calculation;
      var result = calc && calc.result;
      var motivation = calc && calc.motivation;
      return '<tr><td>' + (index + 1) + '</td><td>' + escapeHtml(row.profile.name || 'Без имени') + '</td>'
        + '<td>' + displayDate(row.profile.employmentStartDate) + '</td><td>' + escapeHtml(calc ? calc.tenureLabel : 'Не рассчитано') + '</td>'
        + '<td>' + money(row.values.halfYearCommission) + '</td><td>' + (result ? result.effectiveFloorRate + '%<small>' + escapeHtml(result.effectivePackageLabel) + '</small>' : '—') + '</td>'
        + '<td>' + escapeHtml(motivation ? motivation.mountainSea : '—') + '</td><td>' + escapeHtml(motivation ? motivation.travel : '—') + '</td>'
        + '<td>' + escapeHtml(motivation ? motivation.advertising : '—') + '</td><td>' + escapeHtml(motivation ? motivation.corporate : '—') + '</td><td>' + escapeHtml(motivation ? motivation.stipend : '—') + '</td></tr>';
    }).join('');
  }

  function render() {
    var title = CareerReportEngine.reportTitle(elements.year.value, elements.half.value);
    elements.effective.value = selectedPeriod();
    elements.title.textContent = title;
    elements.printTitle.textContent = title;
    elements.rows.innerHTML = state.rows.length
      ? state.rows.map(rowHtml).join('')
      : '<tr><td colspan="14" class="career-report-empty">Добавьте сотрудника или создайте профиль в карточке сотрудника.</td></tr>';
    elements.printDate.textContent = displayDate(elements.asOf.value);
    elements.printPolicy.textContent = MOTIVATION_POLICY_2026.id;
    renderPrintRows();
  }

  function setStatus(message, type) {
    elements.status.textContent = message;
    elements.status.className = 'career-report-status career-report-status--' + type;
  }

  function markDirty() {
    state.saved = false;
    state.calculated = false;
    setStatus('Есть несохранённые изменения', 'dirty');
  }

  function calculateAll() {
    state.rows.forEach(function (row) {
      row.values.asOfDate = elements.asOf.value || localDate();
      row.calculation = CareerReportEngine.calculateRow(row.profile, row.values, state.period, row.previousDecision);
    });
    state.calculated = true;
    state.saved = false;
    render();
    setStatus('Рассчитано, но не сохранено', 'calculated');
  }

  function saveAll() {
    if (!state.calculated) {
      calculateAll();
    }
    state.rows.forEach(function (row) {
      var profile = CareerStorage.saveProfile(row.profile);
      row.profile = profile;
      CareerStorage.saveDecision({
        profileId: profile.id,
        policyVersion: row.calculation.result.policyVersion,
        effectivePeriod: state.period,
        calculatedAt: new Date().toISOString(),
        input: row.calculation.input,
        result: row.calculation.result,
        benefits: row.calculation.benefits
      });
      row.savedForPeriod = true;
      row.isNew = false;
    });
    state.saved = true;
    render();
    setStatus('Данные сохранены', 'saved');
  }

  function addRow() {
    var id = CareerStorage.createId('career-agent');
    state.rows.push({
      id: id,
      profile: { id: id, name: '', status: 'partner', employmentStartDate: '', partnerStartDate: '', contractualFloorRate: 0, notes: '' },
      values: defaultValues({}, null),
      calculation: null,
      previousDecision: null,
      savedForPeriod: false,
      isNew: true
    });
    render();
    markDirty();
    var input = elements.rows.querySelector('[data-report-row="' + id + '"] [data-report-field="name"]');
    if (input) {
      input.focus();
    }
  }

  function rowById(id) {
    return state.rows.find(function (row) { return row.id === id; });
  }

  function fieldChanged(target) {
    var mainRow = target.closest('[data-report-row]');
    var detailRow = target.closest('[data-report-detail]');
    var id = mainRow ? mainRow.dataset.reportRow : (detailRow ? detailRow.dataset.reportDetail : '');
    var row = rowById(id);
    var field = target.dataset.reportField;
    var value;
    if (!row || !field) {
      return;
    }
    value = target.type === 'checkbox' ? target.checked : target.value;
    if (['name', 'employmentStartDate', 'status', 'contractualFloorRate', 'notes'].indexOf(field) >= 0) {
      row.profile[field] = field === 'contractualFloorRate' ? number(value) : value;
    } else {
      row.values[field] = target.type === 'number' ? number(value) : value;
    }
    row.calculation = null;
    row.savedForPeriod = false;
    markDirty();
  }

  function switchView(view) {
    document.querySelectorAll('[data-career-view]').forEach(function (panel) {
      panel.hidden = panel.dataset.careerView !== view;
    });
    document.querySelectorAll('[data-career-view-button]').forEach(function (button) {
      var active = button.dataset.careerViewButton === view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (view === 'report') {
      loadRows();
    }
  }

  function actionClicked(target) {
    var action = target.dataset.reportAction;
    var id = target.dataset.rowId;
    var row;
    var detail;
    if (action === 'add') {
      addRow();
    } else if (action === 'calculate') {
      calculateAll();
    } else if (action === 'save') {
      saveAll();
    } else if (action === 'print') {
      if (!state.calculated) {
        calculateAll();
      }
      window.print();
    } else if (action === 'toggle') {
      detail = document.querySelector('[data-report-detail="' + id + '"]');
      if (detail) {
        detail.hidden = !detail.hidden;
        target.setAttribute('aria-expanded', detail.hidden ? 'false' : 'true');
      }
    } else if (action === 'open-card') {
      switchView('card');
      target = document.querySelector('[data-profile-id="' + id + '"]');
      if (target) {
        target.click();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (action === 'delete') {
      row = rowById(id);
      if (row && window.confirm('Удалить сотрудника и всю историю его карьерных решений?')) {
        if (!row.isNew) {
          CareerStorage.deleteProfile(id);
        }
        state.rows = state.rows.filter(function (item) { return item.id !== id; });
        render();
        markDirty();
      }
    }
  }

  function initialize() {
    var now = new Date();
    elements.year = element('reportYear');
    elements.half = element('reportHalfYear');
    elements.asOf = element('reportAsOfDate');
    elements.effective = element('reportEffectivePeriod');
    elements.title = element('careerReportTitle');
    elements.status = element('careerReportStatus');
    elements.rows = element('careerReportRows');
    elements.printRows = element('careerPrintRows');
    elements.printTitle = element('careerPrintTitle');
    elements.printDate = element('careerPrintDate');
    elements.printPolicy = element('careerPrintPolicy');
    if (!elements.rows) {
      return;
    }
    elements.year.value = now.getFullYear();
    elements.half.value = now.getMonth() >= 6 ? '2' : '1';
    elements.asOf.value = localDate(now);
    state.period = selectedPeriod();
    render();

    document.addEventListener('click', function (event) {
      var viewButton = event.target.closest('[data-career-view-button]');
      var action = event.target.closest('[data-report-action]');
      if (viewButton) {
        switchView(viewButton.dataset.careerViewButton);
      } else if (action) {
        actionClicked(action);
      }
    });
    elements.rows.addEventListener('input', function (event) {
      fieldChanged(event.target);
    });
    elements.rows.addEventListener('change', function (event) {
      fieldChanged(event.target);
    });
    [elements.year, elements.half].forEach(function (control) {
      control.addEventListener('change', loadRows);
    });
    elements.asOf.addEventListener('change', function () {
      state.rows.forEach(function (row) { row.values.asOfDate = elements.asOf.value; row.calculation = null; });
      markDirty();
      render();
    });
  }

  document.addEventListener('DOMContentLoaded', initialize);
}());
