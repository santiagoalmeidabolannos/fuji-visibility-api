'use strict';

let _data = null;
let _lastUpdated = null;
let _lastChanged = null; // timestamp of last actual data change

function get() {
  return _data;
}

function set(data) {
  const incoming = JSON.stringify(data);
  const current = _data ? JSON.stringify(_data) : null;
  const changed = incoming !== current;

  _data = data;
  _lastUpdated = new Date().toISOString();
  if (changed) {
    _lastChanged = _lastUpdated;
  }

  return changed;
}

function lastUpdated() {
  return _lastUpdated;
}

function lastChanged() {
  return _lastChanged;
}

module.exports = { get, set, lastUpdated, lastChanged };
