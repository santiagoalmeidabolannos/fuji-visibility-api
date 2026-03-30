'use strict';

let _data = null;
let _lastUpdated = null;

function get() {
  return _data;
}

function set(data) {
  _data = data;
  _lastUpdated = new Date().toISOString();
}

function lastUpdated() {
  return _lastUpdated;
}

module.exports = { get, set, lastUpdated };
