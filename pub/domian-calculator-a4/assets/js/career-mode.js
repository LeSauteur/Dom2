(function () {
  'use strict';

  var currentProfileId = '';
  var latestPreview = null;
  var hasUnsavedChanges = false;
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

  function numberValue(id) {
    var value = Number(element(id).value);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function checked(id) {
    return element(id).checked;
  }

  function today() {
    var date = new Date();
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  function currentMonth() {
    return today().slice(0, 7);
  }

  function formatMoney(value) {
    return Math.round(Number(value) || 0).toLocaleString('ru-RU') + ' ₽';
  }

  function getStore() {
    return CareerStorage.read();
  }

  function getCurrentProfile() {
    return getStore().profiles.find(function (profile) {
      return profile.id === currentProfileId;
    }) || null;
  }

  function packageOptions(selected) {
    return MOTIVATION_POLICY_2026.packages
      .filter(function (item) { return item.status === 'partner'; })
      .map(function (item) {
        return '<option value="' + item.id + '"' + (item.id === selected ? ' selected' : '') + '>'
          + escapeHtml(item.label) + ' · агенту не меньше ' + item.floorRate + '%</option>';
      }).join('');
  }

  function renderProfiles() {
    var store = getStore();
    if (!store.profiles.length) {
      elements.profileList.innerHTML = '<p class="empty-state">Профилей пока нет.</p>';
      return;
    }

    elements.profileList.innerHTML = store.profiles.map(function (profile) {
      var latest = CareerStorage.getLatestDecision(profile.id);
      return '<button type="button" class="profile-item' + (profile.id === currentProfileId ? ' is-active' : '')
        + '" data-profile-id="' + escapeHtml(profile.id) + '">'
        + '<strong>' + escapeHtml(profile.name || 'Без имени') + '</strong>'
        + '<span>' + escapeHtml(latest && latest.result.effectivePackageLabel
          ? latest.result.effectivePackageLabel + ' · агенту не меньше ' + latest.result.effectiveFloorRate + '%'
          : 'Решение не сохранено') + '</span>'
        + '</button>';
    }).join('');
  }

  function setProfileForm(profile) {
    element('profileName').value = profile.name || '';
    element('profileStatus').value = profile.status || 'partner';
    element('employmentStartDate').value = profile.employmentStartDate || '';
    element('partnerStartDate').value = profile.partnerStartDate || '';
    element('contractualFloorRate').value = profile.contractualFloorRate || '';
    element('profileNotes').value = profile.notes || '';
    element('profileIdValue').textContent = profile.id;
  }

  function setDecisionForm(profile) {
    var latest = CareerStorage.getLatestDecision(profile.id);
    var input = latest && latest.input ? latest.input : {};
    var previousPackage = input.previousPerformancePackage
      || (latest && latest.result && latest.result.performancePackage)
      || 'standard';

    element('asOfDate').value = input.asOfDate || today();
    element('effectivePeriod').value = input.effectivePeriod || currentMonth();
    element('previousPerformancePackage').innerHTML = packageOptions(previousPackage);
    element('halfYearResultStatus').value = input.halfYearResult && input.halfYearResult.confirmed
      ? 'confirmed'
      : 'unconfirmed';
    element('halfYearLevel').value = input.halfYearResult && input.halfYearResult.level
      ? input.halfYearResult.level
      : '1';
    element('quarterDeposits').value = input.quarterDeposits || '';
    element('quarterlyCommission').value = input.quarterlyCommission || '';
    element('previousMonthDeposits').value = input.previousMonthDeposits || '';
    element('officePlanCompleted').checked = input.officePlanCompleted === true;
    element('agentParticipated').checked = input.agentParticipated === true;
    element('travelQuarterPartnershipConfirmed').checked = input.travelQuarterPartnershipConfirmed === true;
    element('mountainSeaCost').value = input.mountainSeaCost || '';
    element('travelCost').value = input.travelCost || '';
    element('corporateCost').value = input.corporateCost || '';
  }

  function loadProfile(profileId) {
    var profile;
    currentProfileId = profileId;
    profile = getCurrentProfile();
    if (!profile) {
      return;
    }
    setProfileForm(profile);
    setDecisionForm(profile);
    renderProfiles();
    renderHistory();
    calculatePreview();
    hasUnsavedChanges = false;
  }

  function resetProfileEditor() {
    var emptyProfile = {
      id: '',
      name: '',
      status: 'partner',
      employmentStartDate: '',
      partnerStartDate: '',
      contractualFloorRate: 0,
      notes: ''
    };
    currentProfileId = '';
    setProfileForm(emptyProfile);
    setDecisionForm(emptyProfile);
    renderProfiles();
    renderHistory();
    calculatePreview();
    hasUnsavedChanges = false;
    setStatus('Выберите существующий профиль или создайте новый.', 'info');
  }

  function refreshFromStorage() {
    var store = getStore();
    var currentExists = store.profiles.some(function (profile) {
      return profile.id === currentProfileId;
    });
    if (currentExists) {
      loadProfile(currentProfileId);
    } else if (store.profiles.length) {
      loadProfile(store.profiles[0].id);
    } else {
      resetProfileEditor();
    }
  }

  function confirmDiscardChanges() {
    if (!hasUnsavedChanges) {
      return true;
    }
    if (!window.confirm('Есть несохранённые изменения в карточке сотрудника. Продолжить без сохранения?')) {
      return false;
    }
    hasUnsavedChanges = false;
    refreshFromStorage();
    return true;
  }

  function createProfile() {
    var profile = CareerStorage.saveProfile({
      id: CareerStorage.createId('career-agent'),
      name: 'Новый агент',
      status: 'partner',
      employmentStartDate: '',
      partnerStartDate: '',
      contractualFloorRate: 0,
      notes: ''
    });
    loadProfile(profile.id);
    element('profileName').focus();
    element('profileName').select();
    setStatus('Создан новый карьерный профиль.', 'saved');
  }

  function readProfileForm() {
    var current = getCurrentProfile() || {};
    return {
      id: currentProfileId || current.id || CareerStorage.createId('career-agent'),
      name: element('profileName').value.trim(),
      status: element('profileStatus').value === 'trainee' ? 'trainee' : 'partner',
      employmentStartDate: element('employmentStartDate').value,
      partnerStartDate: element('partnerStartDate').value,
      contractualFloorRate: numberValue('contractualFloorRate'),
      notes: element('profileNotes').value,
      createdAt: current.createdAt
    };
  }

  function saveProfile(showStatus) {
    var profileData = readProfileForm();
    var nameInput = element('profileName');
    var profile;
    if (!profileData.name) {
      nameInput.setCustomValidity('Укажите Ф. И. О. сотрудника.');
      nameInput.reportValidity();
      nameInput.focus();
      setStatus('Не заполнено Ф. И. О. сотрудника.', 'dirty');
      return null;
    }
    nameInput.setCustomValidity('');
    profile = CareerStorage.saveProfile(profileData);
    currentProfileId = profile.id;
    hasUnsavedChanges = false;
    renderProfiles();
    if (showStatus !== false) {
      setStatus('Профиль сохранён.', 'saved');
    }
    return profile;
  }

  function readDecisionInput(profile) {
    var confirmed = element('halfYearResultStatus').value === 'confirmed';
    return {
      status: profile.status,
      employmentStartDate: profile.employmentStartDate,
      partnerStartDate: profile.partnerStartDate,
      contractualFloorRate: profile.contractualFloorRate,
      asOfDate: element('asOfDate').value || today(),
      effectivePeriod: element('effectivePeriod').value || currentMonth(),
      previousPerformancePackage: element('previousPerformancePackage').value || 'standard',
      halfYearResult: {
        confirmed: confirmed,
        level: confirmed ? numberValue('halfYearLevel') : null
      },
      halfYearLevel: confirmed ? numberValue('halfYearLevel') : 0,
      quarterDeposits: numberValue('quarterDeposits'),
      quarterlyCommission: numberValue('quarterlyCommission'),
      previousMonthDeposits: numberValue('previousMonthDeposits'),
      officePlanCompleted: checked('officePlanCompleted'),
      agentParticipated: checked('agentParticipated'),
      travelQuarterPartnershipConfirmed: checked('travelQuarterPartnershipConfirmed'),
      mountainSeaCost: numberValue('mountainSeaCost'),
      travelCost: numberValue('travelCost'),
      corporateCost: numberValue('corporateCost'),
      selectedPeriod: element('effectivePeriod').value || currentMonth()
    };
  }

  function payerLabel(payer) {
    if (payer === 'office') {
      return 'Офис';
    }
    if (payer === 'agent') {
      return 'Агент';
    }
    return '—';
  }

  function renderDecision(decision, benefits) {
    var warnings = decision.warnings || [];
    elements.decisionResult.innerHTML = '<div class="decision-hero">'
      + '<div><span>Итоговый пакет</span><strong>' + escapeHtml(decision.effectivePackageLabel) + '</strong></div>'
      + '<div><span>Агенту не меньше</span><strong>' + escapeHtml(decision.effectiveFloorRate) + '%</strong></div>'
      + '<div><span>Почему выбран этот пакет</span><strong>' + escapeHtml(
        decision.source === 'tenure' ? 'Стаж' : (decision.source === 'performance' ? 'Результат' : 'Стаж и результат')
      ) + '</strong></div>'
      + '</div>'
      + '<dl class="decision-details">'
      + '<div><dt>Пакет по стажу</dt><dd>' + escapeHtml(MOTIVATION_POLICY_2026.getPackage(decision.tenurePackage).label) + '</dd></div>'
      + '<div><dt>Пакет по результатам</dt><dd>' + escapeHtml(MOTIVATION_POLICY_2026.getPackage(decision.performancePackage).label) + '</dd></div>'
      + '<div><dt>Как учтён результат</dt><dd>' + escapeHtml(decision.performanceReason) + '</dd></div>'
      + '<div><dt>Стаж</dt><dd>' + decision.tenureMonths + ' мес.</dd></div>'
      + '</dl>'
      + (warnings.length
        ? '<div class="career-warning">' + warnings.map(escapeHtml).join('<br>') + '</div>'
        : '');

    elements.benefitRows.innerHTML = benefits.items.map(function (item) {
      return '<tr>'
        + '<th scope="row">' + escapeHtml(item.label) + '</th>'
        + '<td><span class="status-pill status-pill--' + (item.available ? 'ok' : 'off') + '">'
        + (item.available ? 'Да' : 'Нет') + '</span></td>'
        + '<td>' + payerLabel(item.payer) + '</td>'
        + '<td>' + formatMoney(item.officeCost) + '</td>'
        + '<td>' + formatMoney(item.agentCost) + '</td>'
        + '<td>' + escapeHtml(item.reason) + '</td>'
        + '</tr>';
    }).join('');

    element('officeCostTotal').textContent = formatMoney(benefits.officeCostTotal);
    element('agentCostTotal').textContent = formatMoney(benefits.agentCostTotal);
  }

  function calculatePreview() {
    var profile = readProfileForm();
    var input;
    var decision;
    var benefits;

    if (!profile.id) {
      return;
    }

    input = readDecisionInput(profile);
    decision = CareerEngine.calculateDecision(input);
    benefits = BenefitEngine.calculateBenefits(Object.assign({}, input, {
      decision: decision
    }));
    latestPreview = {
      profile: profile,
      input: input,
      decision: decision,
      benefits: benefits
    };
    renderDecision(decision, benefits);
  }

  function saveDecision() {
    var profile = saveProfile(false);
    if (!profile) {
      return;
    }
    var input = readDecisionInput(profile);
    var decision = CareerEngine.calculateDecision(input);
    var benefits = BenefitEngine.calculateBenefits(Object.assign({}, input, {
      decision: decision
    }));

    CareerStorage.saveDecision({
      profileId: profile.id,
      policyVersion: decision.policyVersion,
      effectivePeriod: input.effectivePeriod,
      calculatedAt: new Date().toISOString(),
      input: input,
      result: decision,
      benefits: benefits
    });

    latestPreview = {
      profile: profile,
      input: input,
      decision: decision,
      benefits: benefits
    };
    renderProfiles();
    renderHistory();
    renderDecision(decision, benefits);
    setStatus('Пакет и мотивации сохранены. Теперь этот профиль можно вручную выбрать у агента в A4.', 'saved');
  }

  function renderHistory() {
    var store = getStore();
    var decisions = store.decisions.filter(function (decision) {
      return decision.profileId === currentProfileId;
    }).sort(function (left, right) {
      return (right.effectivePeriod + right.calculatedAt).localeCompare(left.effectivePeriod + left.calculatedAt);
    });

    elements.history.innerHTML = decisions.length
      ? decisions.map(function (decision) {
        return '<li><div><strong>' + escapeHtml(decision.effectivePeriod || 'Без периода') + '</strong>'
          + '<span>' + escapeHtml(decision.result.effectivePackageLabel || decision.result.effectivePackage)
          + ' · агенту не меньше ' + escapeHtml(decision.result.effectiveFloorRate) + '%</span></div>'
          + '<small>Версия правил ' + escapeHtml(decision.policyVersion) + ' · '
          + escapeHtml(new Date(decision.calculatedAt).toLocaleString('ru-RU')) + '</small></li>';
      }).join('')
      : '<li class="empty-state">Сохранённых решений пока нет.</li>';
  }

  function setStatus(message, type) {
    elements.saveStatus.textContent = message;
    elements.saveStatus.className = 'career-save-status career-save-status--' + (type || 'info');
  }

  function deleteCurrentProfile() {
    var profile = getCurrentProfile();
    var remaining;
    if (!profile || !window.confirm('Удалить профиль «' + (profile.name || 'Без имени')
      + '», всю историю его пакетов и связь с агентом в A4?')) {
      return;
    }
    CareerStorage.deleteProfile(profile.id);
    remaining = getStore().profiles;
    currentProfileId = '';
    if (remaining.length) {
      loadProfile(remaining[0].id);
    } else {
      createProfile();
    }
    setStatus('Карьерный профиль удалён.', 'saved');
  }

  function onClick(event) {
    var target = event.target.closest('[data-action], [data-profile-id]');
    if (!target) {
      return;
    }
    if (target.dataset.profileId) {
      loadProfile(target.dataset.profileId);
      return;
    }
    if (target.dataset.action === 'new-profile') {
      createProfile();
    } else if (target.dataset.action === 'save-profile') {
      if (saveProfile(true)) {
        calculatePreview();
      }
    } else if (target.dataset.action === 'save-decision') {
      saveDecision();
    } else if (target.dataset.action === 'delete-profile') {
      deleteCurrentProfile();
    }
  }

  function initialize() {
    elements = {
      profileList: element('profileList'),
      decisionResult: element('decisionResult'),
      benefitRows: element('benefitRows'),
      history: element('decisionHistory'),
      saveStatus: element('careerSaveStatus')
    };

    element('previousPerformancePackage').innerHTML = packageOptions('standard');
    element('asOfDate').value = today();
    element('effectivePeriod').value = currentMonth();

    document.addEventListener('click', onClick);
    document.addEventListener('input', function (event) {
      if (event.target.closest('#careerEditor')) {
        hasUnsavedChanges = true;
        calculatePreview();
        setStatus('Есть несохранённые изменения.', 'dirty');
      }
    });
    document.addEventListener('change', function (event) {
      if (event.target.closest('#careerEditor')) {
        hasUnsavedChanges = true;
        calculatePreview();
        setStatus('Есть несохранённые изменения.', 'dirty');
      }
    });
    document.addEventListener('career-storage-changed', function () {
      refreshFromStorage();
    });
    window.CareerCardView = {
      confirmDiscardChanges: confirmDiscardChanges,
      refreshFromStorage: refreshFromStorage
    };

    var profiles = getStore().profiles;
    if (profiles.length) {
      loadProfile(profiles[0].id);
    } else {
      createProfile();
    }
  }

  document.addEventListener('DOMContentLoaded', initialize);
}());
