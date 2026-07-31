(function (root) {
  'use strict';

  var ACCESS_CODE = 'FR072026';
  var STORAGE_KEY = 'domianPortalAccessV1';
  var CALENDAR_ID = '5b4b93c7f9aa9b97340a1b7858163771ac5e518814556cf6e1b4d8c2bfb155f7@group.calendar.google.com';
  var CALENDAR_EMBED_URL = 'https://calendar.google.com/calendar/embed?src=5b4b93c7f9aa9b97340a1b7858163771ac5e518814556cf6e1b4d8c2bfb155f7%40group.calendar.google.com&ctz=Europe%2FMoscow';
  var CALENDAR_ICS_URL = 'https://calendar.google.com/calendar/ical/5b4b93c7f9aa9b97340a1b7858163771ac5e518814556cf6e1b4d8c2bfb155f7%40group.calendar.google.com/public/basic.ics';

  var config = {
    ACCESS_CODE: ACCESS_CODE,
    STORAGE_KEY: STORAGE_KEY,
    CALENDAR_ID: CALENDAR_ID,
    CALENDAR_EMBED_URL: CALENDAR_EMBED_URL,
    CALENDAR_ICS_URL: CALENDAR_ICS_URL
  };

  root.DOMIAN_SITE_CONFIG = config;

  if (typeof module === 'object' && module.exports) {
    module.exports = config;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
