import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

describe("game detail layout", () => {
  it("does not show per-game winner and loser cards in the detail view", () => {
    assert.equal(appSource.includes("swing-grid"), false);
    assert.equal(appSource.includes("本局最大赢"), false);
    assert.equal(appSource.includes("本局最大输"), false);
  });

  it("keeps quick win/loss buttons before the donation field", () => {
    assert.ok(appSource.indexOf("quick-grid") < appSource.indexOf("donationAmount"));
  });
});
