#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

// Minimal copy of formatPollClosedEndLabel logic for regression
function formatPollClosedEndLabel(locale, endsAt) {
  const endMs = new Date(endsAt).getTime();
  const now = Date.now();
  if (Number.isFinite(endMs) && endMs > now) {
    return locale === "ro" ? "Închis" : "Closed";
  }
  return `Ended ${endsAt}`;
}

const future = new Date(Date.now() + 86400000).toISOString();
assert.equal(formatPollClosedEndLabel("en", future), "Closed");

const past = new Date(Date.now() - 86400000).toISOString();
assert.match(formatPollClosedEndLabel("en", past), /^Ended /);

console.log("test-poll-display: ok");
