(function (root) {
  'use strict';

  var STORAGE_KEY = 'domianCareerDraftV1';
  var STORAGE_VERSION = 1;
  var DEFAULT_POLICY_VERSION = 'motivation-2026.1';
  var idCounter = 0;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createId(prefix) {
    idCounter += 1;
    if (root.crypto && typeof root.crypto.randomUUID === 'function') {
      return prefix + '-' + root.crypto.randomUUID();
    }
    return prefix + '-' + Date.now().toString(36) + '-' + idCounter.toString(36);
  }

  function createEmptyStore() {
    return {
      version: STORAGE_VERSION,
      policyVersion: DEFAULT_POLICY_VERSION,
      profiles: [],
      decisions: [],
      mappings: [],
      updatedAt: null
    };
  }

  function normalizeProfile(profile) {
    var source = profile && typeof profile === 'object' ? profile : {};
    return {
      id: String(source.id || '').trim() || createId('career-agent'),
      name: String(source.name || '').trim(),
      status: source.status === 'trainee' ? 'trainee' : 'partner',
      employmentStartDate: String(source.employmentStartDate || ''),
      partnerStartDate: String(source.partnerStartDate || ''),
      contractualFloorRate: Math.max(0, Math.min(100, Number(source.contractualFloorRate) || 0)),
      notes: String(source.notes || ''),
      createdAt: source.createdAt || new Date().toISOString(),
      updatedAt: source.updatedAt || new Date().toISOString()
    };
  }

  function normalizeDecision(decision) {
    var source = decision && typeof decision === 'object' ? decision : {};
    return {
      id: String(source.id || '').trim() || createId('career-decision'),
      profileId: String(source.profileId || '').trim(),
      policyVersion: String(source.policyVersion || DEFAULT_POLICY_VERSION),
      effectivePeriod: String(source.effectivePeriod || ''),
      calculatedAt: source.calculatedAt || new Date().toISOString(),
      input: source.input && typeof source.input === 'object' ? clone(source.input) : {},
      result: source.result && typeof source.result === 'object' ? clone(source.result) : {},
      benefits: source.benefits && typeof source.benefits === 'object' ? clone(source.benefits) : {
        items: [],
        officeCostTotal: 0,
        agentCostTotal: 0,
        officeReserveTotal: 0
      }
    };
  }

  function normalizeMapping(mapping) {
    var source = mapping && typeof mapping === 'object' ? mapping : {};
    return {
      a4AgentId: String(source.a4AgentId || '').trim(),
      careerProfileId: String(source.careerProfileId || '').trim(),
      updatedAt: source.updatedAt || new Date().toISOString()
    };
  }

  function normalizeStore(value) {
    var source = value && typeof value === 'object' ? value : {};
    var profiles = Array.isArray(source.profiles) ? source.profiles.map(normalizeProfile) : [];
    var profileIds = profiles.map(function (profile) { return profile.id; });

    return {
      version: STORAGE_VERSION,
      policyVersion: String(source.policyVersion || DEFAULT_POLICY_VERSION),
      profiles: profiles,
      decisions: (Array.isArray(source.decisions) ? source.decisions : [])
        .map(normalizeDecision)
        .filter(function (decision) { return profileIds.indexOf(decision.profileId) >= 0; }),
      mappings: (Array.isArray(source.mappings) ? source.mappings : [])
        .map(normalizeMapping)
        .filter(function (mapping) {
          return mapping.a4AgentId && profileIds.indexOf(mapping.careerProfileId) >= 0;
        }),
      updatedAt: source.updatedAt || null
    };
  }

  function read() {
    var raw;
    if (!root.localStorage || typeof root.localStorage.getItem !== 'function') {
      return createEmptyStore();
    }
    try {
      raw = root.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeStore(JSON.parse(raw)) : createEmptyStore();
    } catch (error) {
      console.warn('Не удалось прочитать карьерное хранилище.', error);
      return createEmptyStore();
    }
  }

  function write(store) {
    var normalized = normalizeStore(store);
    normalized.updatedAt = new Date().toISOString();
    if (root.localStorage && typeof root.localStorage.setItem === 'function') {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  }

  function saveProfile(profile) {
    var store = read();
    var normalized = normalizeProfile(profile);
    var index = store.profiles.findIndex(function (item) { return item.id === normalized.id; });
    if (index >= 0) {
      normalized.createdAt = store.profiles[index].createdAt;
      normalized.updatedAt = new Date().toISOString();
      store.profiles[index] = normalized;
    } else {
      store.profiles.push(normalized);
    }
    write(store);
    return clone(normalized);
  }

  function deleteProfile(profileId) {
    var store = read();
    store.profiles = store.profiles.filter(function (profile) { return profile.id !== profileId; });
    store.decisions = store.decisions.filter(function (decision) { return decision.profileId !== profileId; });
    store.mappings = store.mappings.filter(function (mapping) { return mapping.careerProfileId !== profileId; });
    return write(store);
  }

  function saveDecision(decision) {
    var store = read();
    var normalized = normalizeDecision(decision);
    var profileExists = store.profiles.some(function (profile) {
      return profile.id === normalized.profileId;
    });
    var samePeriodIndex;

    if (!profileExists) {
      throw new Error('Нельзя сохранить решение без карьерного профиля.');
    }

    samePeriodIndex = store.decisions.findIndex(function (item) {
      return item.profileId === normalized.profileId
        && item.effectivePeriod === normalized.effectivePeriod;
    });
    if (samePeriodIndex >= 0) {
      normalized.id = store.decisions[samePeriodIndex].id;
      store.decisions[samePeriodIndex] = normalized;
    } else {
      store.decisions.push(normalized);
    }
    write(store);
    return clone(normalized);
  }

  function linkProfileToA4(a4AgentId, careerProfileId) {
    var store = read();
    var a4Id = String(a4AgentId || '').trim();
    var profileId = String(careerProfileId || '').trim();
    var profileExists = store.profiles.some(function (profile) { return profile.id === profileId; });

    store.mappings = store.mappings.filter(function (mapping) {
      return mapping.a4AgentId !== a4Id;
    });

    if (a4Id && profileId && profileExists) {
      store.mappings.push({
        a4AgentId: a4Id,
        careerProfileId: profileId,
        updatedAt: new Date().toISOString()
      });
    }
    write(store);
    return profileExists ? profileId : '';
  }

  function getLatestDecision(profileId, period) {
    var store = read();
    var selectedPeriod = String(period || '');
    var candidates = store.decisions.filter(function (decision) {
      return decision.profileId === profileId
        && (!selectedPeriod || !decision.effectivePeriod || decision.effectivePeriod <= selectedPeriod);
    });

    candidates.sort(function (left, right) {
      var leftKey = (left.effectivePeriod || '') + '|' + (left.calculatedAt || '');
      var rightKey = (right.effectivePeriod || '') + '|' + (right.calculatedAt || '');
      return rightKey.localeCompare(leftKey);
    });

    return candidates.length ? clone(candidates[0]) : null;
  }

  function getDecision(profileId, period) {
    var selectedProfileId = String(profileId || '').trim();
    var selectedPeriod = String(period || '').trim();
    var decision = read().decisions.find(function (item) {
      return item.profileId === selectedProfileId
        && item.effectivePeriod === selectedPeriod;
    });
    return decision ? clone(decision) : null;
  }

  function getPreviousDecision(profileId, period) {
    var selectedProfileId = String(profileId || '').trim();
    var selectedPeriod = String(period || '').trim();
    var candidates = read().decisions.filter(function (item) {
      return item.profileId === selectedProfileId
        && (!selectedPeriod || (item.effectivePeriod && item.effectivePeriod < selectedPeriod));
    });
    candidates.sort(function (left, right) {
      var leftKey = (left.effectivePeriod || '') + '|' + (left.calculatedAt || '');
      var rightKey = (right.effectivePeriod || '') + '|' + (right.calculatedAt || '');
      return rightKey.localeCompare(leftKey);
    });
    return candidates.length ? clone(candidates[0]) : null;
  }

  function getA4Integration(a4AgentId, directProfileId, period) {
    var store = read();
    var profileId = String(directProfileId || '').trim();
    var mapping;
    var profile;
    var decision;
    var officeItems;
    var agentItems;

    if (!profileId) {
      mapping = store.mappings.find(function (item) {
        return item.a4AgentId === a4AgentId;
      });
      profileId = mapping ? mapping.careerProfileId : '';
    }
    if (!profileId) {
      return null;
    }

    profile = store.profiles.find(function (item) { return item.id === profileId; });
    decision = getLatestDecision(profileId, period);
    if (!profile || !decision || !decision.result || !decision.result.effectivePackage) {
      return null;
    }

    officeItems = (decision.benefits && Array.isArray(decision.benefits.items)
      ? decision.benefits.items
      : []).filter(function (item) {
      return item.payer === 'office' && Number(item.officeCost) > 0;
    });
    agentItems = (decision.benefits && Array.isArray(decision.benefits.items)
      ? decision.benefits.items
      : []).filter(function (item) {
      return item.payer === 'agent' && Number(item.agentCost) > 0;
    });

    return {
      careerProfileId: profile.id,
      profileName: profile.name,
      effectivePackage: decision.result.effectivePackage,
      effectivePackageLabel: decision.result.effectivePackageLabel,
      tenurePackage: decision.result.tenurePackage,
      performancePackage: decision.result.performancePackage,
      packageFloorRate: Number(decision.result.packageFloorRate) || 0,
      contractualFloorRate: Number(decision.result.contractualFloorRate) || 0,
      effectiveFloorRate: Number(decision.result.effectiveFloorRate) || 0,
      motivationReserveMonthly: Number(decision.benefits && decision.benefits.officeReserveTotal) || 0,
      motivationAgentCost: Number(decision.benefits && decision.benefits.agentCostTotal) || 0,
      motivationCosts: clone(officeItems),
      agentMotivationCosts: clone(agentItems),
      benefits: clone(decision.benefits || {}),
      policyVersion: decision.policyVersion,
      effectivePeriod: decision.effectivePeriod,
      calculatedAt: decision.calculatedAt
    };
  }

  root.CareerStorage = {
    key: STORAGE_KEY,
    version: STORAGE_VERSION,
    createId: createId,
    createEmptyStore: createEmptyStore,
    normalizeStore: normalizeStore,
    read: read,
    write: write,
    saveProfile: saveProfile,
    deleteProfile: deleteProfile,
    saveDecision: saveDecision,
    linkProfileToA4: linkProfileToA4,
    getDecision: getDecision,
    getPreviousDecision: getPreviousDecision,
    getLatestDecision: getLatestDecision,
    getA4Integration: getA4Integration
  };
}(typeof window !== 'undefined' ? window : globalThis));
