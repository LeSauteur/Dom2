'use strict';

function toInteger(value) {
  var numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : NaN;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseQuarter(quarter) {
  var match = String(quarter || '').trim().match(/^(\d{4})-Q([1-4])$/);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    quarter: Number(match[2]),
    key: match[0]
  };
}

function getQuarterMonths(quarter) {
  var parsed = parseQuarter(quarter);
  var months = [];
  var startMonth;
  var i;

  if (!parsed) {
    return months;
  }

  startMonth = (parsed.quarter - 1) * 3 + 1;
  for (i = 0; i < 3; i += 1) {
    months.push(parsed.year + '-' + pad2(startMonth + i));
  }

  return months;
}

function getNextQuarter(quarter) {
  var parsed = parseQuarter(quarter);

  if (!parsed) {
    return '';
  }

  if (parsed.quarter === 4) {
    return (parsed.year + 1) + '-Q1';
  }

  return parsed.year + '-Q' + (parsed.quarter + 1);
}

function getHalfYearMonths(halfYear) {
  var match = String(halfYear || '').trim().match(/^(\d{4})-H([12])$/);
  var months = [];
  var year;
  var startMonth;
  var i;

  if (!match) {
    return months;
  }

  year = Number(match[1]);
  startMonth = match[2] === '1' ? 1 : 7;

  for (i = 0; i < 6; i += 1) {
    months.push(year + '-' + pad2(startMonth + i));
  }

  return months;
}

function getMonthQuarter(month) {
  var match = String(month || '').trim().match(/^(\d{4})-(\d{2})$/);
  var year;
  var monthNumber;
  var quarter;

  if (!match) {
    return '';
  }

  year = Number(match[1]);
  monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    return '';
  }

  quarter = Math.floor((monthNumber - 1) / 3) + 1;
  return year + '-Q' + quarter;
}

module.exports = {
  parseQuarter: parseQuarter,
  getQuarterMonths: getQuarterMonths,
  getNextQuarter: getNextQuarter,
  getHalfYearMonths: getHalfYearMonths,
  getMonthQuarter: getMonthQuarter,
  toInteger: toInteger
};
