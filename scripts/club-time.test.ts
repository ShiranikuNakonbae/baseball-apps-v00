import assert from "node:assert/strict";
import test from "node:test";

import { clubLocalToIso } from "../lib/time.ts";
import { hits, percent, plain, rate, toDateTimeLocal } from "../lib/format.ts";

// Club timezone is the default (America/New_York) because the env var is unset here.
test("club wall clock converts to the right instant in summer", () => {
  assert.equal(clubLocalToIso("2026-07-15T10:00"), "2026-07-15T14:00:00.000Z");
});

test("club wall clock converts to the right instant in winter", () => {
  assert.equal(clubLocalToIso("2026-01-15T10:00"), "2026-01-15T15:00:00.000Z");
});

test("a spring-forward time that never exists still resolves to an instant", () => {
  // 02:30 on the day DST begins is skipped; it must not crash or return NaN.
  const iso = clubLocalToIso("2026-03-08T02:30");
  assert.equal(Number.isNaN(Date.parse(iso)), false);
});

test("toDateTimeLocal reads back what clubLocalToIso wrote", () => {
  const wall = "2026-07-15T10:00";
  assert.equal(toDateTimeLocal(clubLocalToIso(wall)), wall);
});

test("unparsable input throws instead of storing a null time", () => {
  assert.throws(() => clubLocalToIso("tomorrow at 10"), /Unparsable/);
});

test("batting rates print in baseball notation", () => {
  assert.equal(rate(0.348), ".348");
  assert.equal(rate("0.42"), ".420");
  assert.equal(rate(null), "—");
  assert.equal(rate(undefined), "—");
});

test("percentages round to whole numbers", () => {
  assert.equal(percent(94.4), "94%");
  assert.equal(percent(null), "—");
});

test("plain numbers drop trailing zeros", () => {
  assert.equal(plain(2.45, 2), "2.45");
  assert.equal(plain(45, 0), "45");
});

test("hits sums the bases hit", () => {
  assert.equal(hits({ singles: 2, doubles: 1, triples: 0, hr: 1 }), 4);
});
