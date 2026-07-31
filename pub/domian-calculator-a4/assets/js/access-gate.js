(function (root) {
  'use strict';

  var MOSCOW_TIME_ZONE = 'Europe/Moscow';
  var ALLOWED_NEXT = [
    'index.html',
    'calculator.html',
    'calculator.html?mode=motivation2026',
    'motivation-calculator.html',
    'table.html',
    'table-ledger.html',
    'career.html'
  ];

  function getMoscowMonth(value) {
    var date = value instanceof Date ? value : new Date(value || Date.now());
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: MOSCOW_TIME_ZONE,
      year: 'numeric',
      month: '2-digit'
    }).formatToParts(date);
    var year = parts.find(function (part) { return part.type === 'year'; });
    var month = parts.find(function (part) { return part.type === 'month'; });
    return year.value + '-' + month.value;
  }

  function sanitizeNext(value) {
    var next = typeof value === 'string' ? value.trim() : '';
    return ALLOWED_NEXT.indexOf(next) >= 0 ? next : '';
  }

  function getCurrentRoute(locationObject) {
    var pathParts = String(locationObject.pathname || '').split('/');
    var fileName = pathParts[pathParts.length - 1] || 'index.html';
    return sanitizeNext(fileName + String(locationObject.search || '')) || 'index.html';
  }

  function hasCurrentAccess(storage, config, now) {
    if (!storage || !config) {
      return false;
    }
    try {
      return storage.getItem(config.STORAGE_KEY) === getMoscowMonth(now);
    } catch (error) {
      return false;
    }
  }

  function isCorrectCode(value, config) {
    return Boolean(config) && String(value || '') === config.ACCESS_CODE;
  }

  function storeCurrentAccess(storage, config, now) {
    storage.setItem(config.STORAGE_KEY, getMoscowMonth(now));
  }

  function clearAccess(storage, config) {
    if (storage && config) {
      storage.removeItem(config.STORAGE_KEY);
    }
  }

  function getNextFromSearch(search) {
    var params = new URLSearchParams(search || '');
    return sanitizeNext(params.get('next'));
  }

  function isLegacyMotivationRoute(locationObject) {
    var pathParts = String(locationObject.pathname || '').split('/');
    var fileName = pathParts[pathParts.length - 1] || 'index.html';
    var params = new URLSearchParams(locationObject.search || '');
    return fileName === 'index.html' && params.get('mode') === 'motivation2026';
  }

  function setDocumentReady(documentObject) {
    documentObject.documentElement.classList.remove('access-pending');
    documentObject.documentElement.classList.add('access-ready');
  }

  function loadCalendar(documentObject, config) {
    var frame = documentObject.querySelector('[data-calendar-frame]');
    if (!frame || frame.getAttribute('src')) {
      return;
    }
    frame.setAttribute('src', frame.dataset.src || config.CALENDAR_EMBED_URL);
  }

  function showPortal(documentObject, config) {
    var gate = documentObject.querySelector('[data-access-gate]');
    var content = documentObject.querySelector('[data-portal-content]');
    if (gate) {
      gate.hidden = true;
    }
    if (content) {
      content.hidden = false;
    }
    setDocumentReady(documentObject);
    loadCalendar(documentObject, config);
  }

  function showLogin(documentObject) {
    var gate = documentObject.querySelector('[data-access-gate]');
    var content = documentObject.querySelector('[data-portal-content]');
    var input = documentObject.querySelector('[data-access-input]');
    if (gate) {
      gate.hidden = false;
    }
    if (content) {
      content.hidden = true;
    }
    setDocumentReady(documentObject);
    if (input) {
      input.focus();
    }
  }

  function getActiveRoute(locationObject) {
    var route = getCurrentRoute(locationObject);
    if (route === 'calculator.html?mode=motivation2026') {
      return 'motivation';
    }
    if (route === 'calculator.html') {
      return 'calculator';
    }
    if (route === 'table.html' || route === 'table-ledger.html') {
      return 'table';
    }
    if (route === 'career.html') {
      return 'career';
    }
    return 'home';
  }

  function activateNavigation(documentObject, locationObject) {
    var activeRoute = getActiveRoute(locationObject);
    Array.prototype.forEach.call(
      documentObject.querySelectorAll('[data-nav-route]'),
      function (link) {
        if (link.dataset.navRoute === activeRoute) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.removeAttribute('aria-current');
        }
      }
    );
  }

  function bindLogout(documentObject, locationObject, storage, config) {
    Array.prototype.forEach.call(
      documentObject.querySelectorAll('[data-access-logout]'),
      function (button) {
        button.addEventListener('click', function () {
          clearAccess(storage, config);
          locationObject.href = 'index.html';
        });
      }
    );
  }

  function bindPortalLogin(rootObject, config) {
    var documentObject = rootObject.document;
    var form = documentObject.querySelector('[data-access-form]');
    var input = documentObject.querySelector('[data-access-input]');
    var message = documentObject.querySelector('[data-access-message]');
    if (!form || !input) {
      return;
    }

    form.addEventListener('submit', function (event) {
      var next;
      event.preventDefault();
      if (!isCorrectCode(input.value, config)) {
        if (message) {
          message.textContent = 'Неверный пароль. Попробуйте ещё раз.';
        }
        input.focus();
        input.select();
        return;
      }

      try {
        storeCurrentAccess(rootObject.localStorage, config);
      } catch (error) {
        if (message) {
          message.textContent = 'Не удалось сохранить доступ в этом браузере.';
        }
        return;
      }

      next = getNextFromSearch(rootObject.location.search);
      if (next && next !== 'index.html') {
        rootObject.location.replace(next);
        return;
      }
      showPortal(documentObject, config);
    });
  }

  function onReady(rootObject, config, isPortal, hasAccess) {
    var documentObject = rootObject.document;
    activateNavigation(documentObject, rootObject.location);
    bindLogout(documentObject, rootObject.location, rootObject.localStorage, config);

    if (!isPortal) {
      setDocumentReady(documentObject);
      return;
    }

    bindPortalLogin(rootObject, config);
    if (hasAccess) {
      showPortal(documentObject, config);
    } else {
      showLogin(documentObject);
    }
  }

  function bootstrap(rootObject) {
    var activeRoot = rootObject || root;
    var documentObject = activeRoot.document;
    var config = activeRoot.DOMIAN_SITE_CONFIG;
    var isPortal;
    var hasAccess;
    var next;
    var readyHandler;

    if (!documentObject || !config) {
      return;
    }

    isPortal = documentObject.documentElement.dataset.accessPage === 'portal';

    if (isPortal && isLegacyMotivationRoute(activeRoot.location)) {
      activeRoot.location.replace('calculator.html?mode=motivation2026');
      return;
    }

    hasAccess = hasCurrentAccess(activeRoot.localStorage, config);
    if (!isPortal && !hasAccess) {
      next = getCurrentRoute(activeRoot.location);
      activeRoot.location.replace('index.html?next=' + encodeURIComponent(next));
      return;
    }

    if (isPortal && hasAccess) {
      next = getNextFromSearch(activeRoot.location.search);
      if (next && next !== 'index.html') {
        activeRoot.location.replace(next);
        return;
      }
    }

    if (!isPortal) {
      setDocumentReady(documentObject);
    }

    readyHandler = function () {
      onReady(activeRoot, config, isPortal, hasAccess);
    };
    if (documentObject.readyState === 'loading') {
      documentObject.addEventListener('DOMContentLoaded', readyHandler);
    } else {
      readyHandler();
    }
  }

  var api = {
    ALLOWED_NEXT: ALLOWED_NEXT.slice(),
    MOSCOW_TIME_ZONE: MOSCOW_TIME_ZONE,
    getMoscowMonth: getMoscowMonth,
    sanitizeNext: sanitizeNext,
    getCurrentRoute: getCurrentRoute,
    hasCurrentAccess: hasCurrentAccess,
    isCorrectCode: isCorrectCode,
    storeCurrentAccess: storeCurrentAccess,
    clearAccess: clearAccess,
    getNextFromSearch: getNextFromSearch,
    isLegacyMotivationRoute: isLegacyMotivationRoute,
    getActiveRoute: getActiveRoute,
    bootstrap: bootstrap
  };

  root.DomianAccessGate = api;

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root.document) {
    bootstrap(root);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
