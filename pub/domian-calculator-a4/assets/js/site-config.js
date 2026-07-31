(function (root) {
  'use strict';

  var ACCESS_CODE = 'FR072026';
  var STORAGE_KEY = 'domianPortalAccessV1';
  var CALENDAR_ID = '5b4b93c7f9aa9b97340a1b7858163771ac5e518814556cf6e1b4d8c2bfb155f7@group.calendar.google.com';
  var CALENDAR_EMBED_URL = 'https://calendar.google.com/calendar/embed?src=5b4b93c7f9aa9b97340a1b7858163771ac5e518814556cf6e1b4d8c2bfb155f7%40group.calendar.google.com&ctz=Europe%2FMoscow';
  var CALENDAR_ICS_URL = 'https://calendar.google.com/calendar/ical/5b4b93c7f9aa9b97340a1b7858163771ac5e518814556cf6e1b4d8c2bfb155f7%40group.calendar.google.com/public/basic.ics';
  var ADVERTISING_POINT_RUBLES = 350;
  var DOCUMENTS = {
    advertising: {
      label: 'Открыть правила рекламных возможностей',
      url: 'https://docs.yandex.ru/docs/view?url=ya-disk-public%3A%2F%2Fa7Jr1RaNr9gXWDpu6hEE2oqj%2Brip5HCmHrZnkC%2BBCQqa%2BTWx8hS7vhd4zf7doQTxq%2FJ6bpmRyOJonT3VoXnDag%3D%3D%3A%2F%D0%92%D0%B0%D0%B6%D0%BD%D1%8B%D0%B5%20%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D1%8B%2F%D0%9D%D0%BE%D0%B2%D1%8B%D0%B5%20%D1%83%D1%81%D0%BB%D0%BE%D0%B2%D0%B8%D1%8F%20%D0%A0%D0%B5%D0%BA%D0%BB%D0%B0%D0%BC%D0%BD%D1%8B%D0%B5%20%D0%B2%D0%BE%D0%B7%D0%BC%D0%BE%D0%B6%D0%BD%D0%BE%D1%81%D1%82%D0%B8%20%D0%B0%D0%B3%D0%B5%D0%BD%D1%82%D0%B0%20%D0%B7%D0%B0%20%D1%81%D1%87%D0%B5%D1%82%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D0%B8%20%E2%80%94%20%D0%BA%D0%BE%D0%BF%D0%B8%D1%8F%20(1).docx&name=%D0%9D%D0%BE%D0%B2%D1%8B%D0%B5%20%D1%83%D1%81%D0%BB%D0%BE%D0%B2%D0%B8%D1%8F%20%D0%A0%D0%B5%D0%BA%D0%BB%D0%B0%D0%BC%D0%BD%D1%8B%D0%B5%20%D0%B2%D0%BE%D0%B7%D0%BC%D0%BE%D0%B6%D0%BD%D0%BE%D1%81%D1%82%D0%B8%20%D0%B0%D0%B3%D0%B5%D0%BD%D1%82%D0%B0%20%D0%B7%D0%B0%20%D1%81%D1%87%D0%B5%D1%82%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D0%B8%20%E2%80%94%20%D0%BA%D0%BE%D0%BF%D0%B8%D1%8F%20(1).docx'
    },
    motivation2026: {
      label: 'Открыть правила мотивации 2026',
      url: 'https://docs.yandex.ru/docs/view?url=ya-disk-public%3A%2F%2Fa7Jr1RaNr9gXWDpu6hEE2oqj%2Brip5HCmHrZnkC%2BBCQqa%2BTWx8hS7vhd4zf7doQTxq%2FJ6bpmRyOJonT3VoXnDag%3D%3D%3A%2F%D0%92%D0%B0%D0%B6%D0%BD%D1%8B%D0%B5%20%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D1%8B%2F%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%20%D0%BC%D0%BE%D1%82%D0%B8%D0%B2%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BA%D0%B0%D1%80%D1%8C%D0%B5%D1%80%D0%BD%D0%BE%D0%B3%D0%BE%20%D1%80%D0%BE%D1%81%D1%82%D0%B0%202026.docx&name=%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F%20%D0%BC%D0%BE%D1%82%D0%B8%D0%B2%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BA%D0%B0%D1%80%D1%8C%D0%B5%D1%80%D0%BD%D0%BE%D0%B3%D0%BE%20%D1%80%D0%BE%D1%81%D1%82%D0%B0%202026.docx&nosw=1'
    }
  };

  var config = {
    ACCESS_CODE: ACCESS_CODE,
    STORAGE_KEY: STORAGE_KEY,
    CALENDAR_ID: CALENDAR_ID,
    CALENDAR_EMBED_URL: CALENDAR_EMBED_URL,
    CALENDAR_ICS_URL: CALENDAR_ICS_URL,
    ADVERTISING_POINT_RUBLES: ADVERTISING_POINT_RUBLES,
    DOCUMENTS: DOCUMENTS
  };

  root.DOMIAN_SITE_CONFIG = config;

  if (typeof module === 'object' && module.exports) {
    module.exports = config;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
