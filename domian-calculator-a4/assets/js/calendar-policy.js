(function () {
  'use strict';

  var MONTH_NAMES = [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь'
  ];

  function padMonth(month) {
    return month < 10 ? '0' + month : String(month);
  }

  function parseSelectedMonth(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})$/);
    var year;
    var month;

    if (!match) {
      return null;
    }

    year = Number(match[1]);
    month = Number(match[2]);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return null;
    }

    return {
      value: String(year) + '-' + padMonth(month),
      year: year,
      month: month,
      monthIndex: month - 1
    };
  }

  function createMonth(year, month) {
    var nextYear = year;
    var nextMonth = month;

    while (nextMonth < 1) {
      nextMonth += 12;
      nextYear -= 1;
    }
    while (nextMonth > 12) {
      nextMonth -= 12;
      nextYear += 1;
    }

    return parseSelectedMonth(String(nextYear) + '-' + padMonth(nextMonth));
  }

  function shiftMonth(month, offset) {
    return createMonth(month.year, month.month + offset);
  }

  function monthLabel(month) {
    return month ? MONTH_NAMES[month.month - 1] + ' ' + month.year : '';
  }

  function compareMonths(left, right) {
    if (!left || !right) {
      return 0;
    }
    return (left.year * 12 + left.month) - (right.year * 12 + right.month);
  }

  function createEvent(config) {
    return {
      key: config.key,
      title: config.title,
      countsInSelectedMonth: Boolean(config.countsInSelectedMonth),
      uiStatus: config.uiStatus || 'infoOnly',
      reason: config.reason || '',
      resultPeriodLabel: config.resultPeriodLabel || '',
      collectionLabel: config.collectionLabel || '',
      eventLabel: config.eventLabel || ''
    };
  }

  function inactiveEvent(key, title) {
    return createEvent({
      key: key,
      title: title,
      uiStatus: 'infoOnly',
      reason: 'Месяц расчёта не выбран.'
    });
  }

  function getStatusByMilestones(selectedMonth, collectionMonth, eventMonth) {
    if (compareMonths(selectedMonth, collectionMonth) === 0) {
      return {
        countsInSelectedMonth: true,
        uiStatus: 'active',
        reason: 'Финансовое обязательство выбранного месяца.'
      };
    }
    if (compareMonths(selectedMonth, eventMonth) === 0) {
      return {
        countsInSelectedMonth: false,
        uiStatus: 'infoOnly',
        reason: 'Событие проходит в выбранном месяце, но финансовый сбор относится к другому месяцу.'
      };
    }
    if (compareMonths(selectedMonth, collectionMonth) < 0) {
      return {
        countsInSelectedMonth: false,
        uiStatus: 'future',
        reason: 'Финансовое обязательство ещё впереди.'
      };
    }
    if (compareMonths(selectedMonth, eventMonth) > 0) {
      return {
        countsInSelectedMonth: false,
        uiStatus: 'past',
        reason: 'Событие и финансовое окно уже прошли.'
      };
    }
    return {
      countsInSelectedMonth: false,
      uiStatus: 'infoOnly',
      reason: 'Выбранный месяц находится между сбором и событием.'
    };
  }

  function buildCongress(selectedMonth) {
    var collectionMonth = createMonth(selectedMonth.year, 1);
    var eventMonth = createMonth(selectedMonth.year, 2);
    var status = getStatusByMilestones(selectedMonth, collectionMonth, eventMonth);

    return createEvent(Object.assign({
      key: 'congress',
      title: 'Конгресс',
      resultPeriodLabel: 'Годовое участие',
      collectionLabel: monthLabel(collectionMonth),
      eventLabel: monthLabel(eventMonth)
    }, status));
  }

  function buildStar(selectedMonth) {
    var collectionMonth = createMonth(selectedMonth.year, 12);
    var eventMonth = createMonth(selectedMonth.year + 1, 2);
    var status;

    if (selectedMonth.month <= 2) {
      eventMonth = createMonth(selectedMonth.year, 2);
      collectionMonth = createMonth(selectedMonth.year - 1, 12);
    }
    status = getStatusByMilestones(selectedMonth, collectionMonth, eventMonth);

    return createEvent(Object.assign({
      key: 'star',
      title: 'Звезда',
      resultPeriodLabel: 'Награда на конгрессе',
      collectionLabel: monthLabel(collectionMonth),
      eventLabel: monthLabel(eventMonth)
    }, status));
  }

  function buildMountains(selectedMonth) {
    var collectionMonth = createMonth(selectedMonth.year, 3);
    var eventMonth = createMonth(selectedMonth.year, 4);
    var status = getStatusByMilestones(selectedMonth, collectionMonth, eventMonth);

    return createEvent(Object.assign({
      key: 'mountains',
      title: 'Горы',
      resultPeriodLabel: 'январь-февраль ' + selectedMonth.year,
      collectionLabel: monthLabel(collectionMonth),
      eventLabel: monthLabel(eventMonth)
    }, status));
  }

  function buildSea(selectedMonth) {
    var collectionMonth = createMonth(selectedMonth.year, 8);
    var eventMonth = createMonth(selectedMonth.year, 9);
    var status = getStatusByMilestones(selectedMonth, collectionMonth, eventMonth);

    if (selectedMonth.month === 7) {
      status = {
        countsInSelectedMonth: false,
        uiStatus: 'future',
        reason: 'Результат уже известен или закрывается, но сбор денег начинается в августе.'
      };
    }

    return createEvent(Object.assign({
      key: 'sea',
      title: 'Море',
      resultPeriodLabel: 'май-июнь ' + selectedMonth.year,
      collectionLabel: monthLabel(collectionMonth),
      eventLabel: monthLabel(eventMonth)
    }, status));
  }

  function normalizeAutumnTravelEventMonth(selectedMonth, options) {
    var configured = options && options.autumnTravelEventMonth
      ? parseSelectedMonth(options.autumnTravelEventMonth)
      : null;

    if (configured) {
      return configured;
    }

    return createMonth(selectedMonth.year, 10);
  }

  function buildAutumnTravel(selectedMonth, options) {
    var eventMonth = normalizeAutumnTravelEventMonth(selectedMonth, options);
    var collectionMonth = shiftMonth(eventMonth, -1);
    var status = getStatusByMilestones(selectedMonth, collectionMonth, eventMonth);

    return createEvent(Object.assign({
      key: 'autumnTravel',
      title: 'Путешествие осенью',
      resultPeriodLabel: '1-е полугодие ' + eventMonth.year,
      collectionLabel: monthLabel(collectionMonth),
      eventLabel: monthLabel(eventMonth)
    }, status));
  }

  function buildSummerCorporate(selectedMonth) {
    var eventMonth = createMonth(selectedMonth.year, 7);
    var status;

    if (selectedMonth.month === 6) {
      status = {
        countsInSelectedMonth: false,
        uiStatus: 'warning',
        reason: 'Организационное окно: списки и ответственность офиса до 25 июня.'
      };
    } else if (selectedMonth.month === 7) {
      status = {
        countsInSelectedMonth: true,
        uiStatus: 'active',
        reason: 'Крайний срок оплаты относится к июлю.'
      };
    } else if (selectedMonth.month < 6) {
      status = {
        countsInSelectedMonth: false,
        uiStatus: 'future',
        reason: 'Корпоративное обязательство ещё впереди.'
      };
    } else {
      status = {
        countsInSelectedMonth: false,
        uiStatus: 'past',
        reason: 'Летний корпоратив уже прошёл.'
      };
    }

    return createEvent(Object.assign({
      key: 'summerCorporate',
      title: 'Летний корпоратив',
      resultPeriodLabel: 'партнёрство предыдущего квартала',
      collectionLabel: 'конец июня / до 2 июля ' + selectedMonth.year,
      eventLabel: '15 июля ' + selectedMonth.year
    }, status));
  }

  function getStipendPaymentContext(selectedMonth) {
    var parsed = parseSelectedMonth(selectedMonth);
    var paymentQuarter;
    var paymentMonthIndex;
    var resultQuarter;
    var resultYear;

    if (!parsed) {
      return null;
    }

    paymentQuarter = Math.floor((parsed.month - 1) / 3) + 1;
    paymentMonthIndex = ((parsed.month - 1) % 3) + 1;
    resultQuarter = paymentQuarter - 1;
    resultYear = parsed.year;

    if (resultQuarter === 0) {
      resultQuarter = 4;
      resultYear -= 1;
    }

    return {
      resultPeriod: resultYear + '-Q' + resultQuarter,
      resultPeriodLabel: 'Q' + resultQuarter + ' ' + resultYear,
      paymentQuarter: parsed.year + '-Q' + paymentQuarter,
      paymentQuarterLabel: 'Q' + paymentQuarter + ' ' + parsed.year,
      paymentMonthIndex: paymentMonthIndex,
      countsInSelectedMonth: true,
      uiStatus: 'active',
      reason: 'Стипендия выплачивается ежемесячно в следующем квартале после квартала результата.'
    };
  }

  function buildCalendarContext(selectedMonth, options) {
    var parsed = parseSelectedMonth(selectedMonth);

    if (!parsed) {
      return {
        selectedMonth: '',
        selectedMonthLabel: 'Условный месяц',
        isSelected: false,
        events: {
          congress: inactiveEvent('congress', 'Конгресс'),
          star: inactiveEvent('star', 'Звезда'),
          mountains: inactiveEvent('mountains', 'Горы'),
          sea: inactiveEvent('sea', 'Море'),
          autumnTravel: inactiveEvent('autumnTravel', 'Путешествие осенью'),
          summerCorporate: inactiveEvent('summerCorporate', 'Летний корпоратив')
        },
        stipend: null
      };
    }

    return {
      selectedMonth: parsed.value,
      selectedMonthLabel: monthLabel(parsed),
      isSelected: true,
      events: {
        congress: buildCongress(parsed),
        star: buildStar(parsed),
        mountains: buildMountains(parsed),
        sea: buildSea(parsed),
        autumnTravel: buildAutumnTravel(parsed, options || {}),
        summerCorporate: buildSummerCorporate(parsed)
      },
      stipend: getStipendPaymentContext(parsed.value)
    };
  }

  window.parseSelectedMonth = parseSelectedMonth;
  window.buildCalendarContext = buildCalendarContext;
  window.getStipendPaymentContext = getStipendPaymentContext;
}());
