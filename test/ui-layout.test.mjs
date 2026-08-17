import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("game detail layout", () => {
  it("does not show per-game winner and loser cards in the detail view", () => {
    assert.equal(appSource.includes("swing-grid"), false);
    assert.equal(appSource.includes("本局最大赢"), false);
    assert.equal(appSource.includes("本局最大输"), false);
  });

  it("keeps quick win/loss buttons before the donation field", () => {
    const formStart = appSource.indexOf("function renderEntryForm");
    const formEnd = appSource.indexOf("function renderJoinGamePrompt");
    const formSource = appSource.slice(formStart, formEnd);

    assert.ok(formSource.indexOf("quick-grid") < formSource.indexOf("donationAmount"));
  });

  it("does not show a placeholder on the donation field", () => {
    const formStart = appSource.indexOf("function renderEntryForm");
    const formEnd = appSource.indexOf("function renderJoinGamePrompt");
    const formSource = appSource.slice(formStart, formEnd);

    assert.equal(formSource.includes('name="donationAmount"'), true);
    assert.equal(formSource.includes('placeholder="0 / 500"'), false);
  });

  it("lets users choose a date when creating a game", () => {
    const gamesStart = appSource.indexOf("function renderGames");
    const gamesEnd = appSource.indexOf("function renderGameButton");
    const gamesSource = appSource.slice(gamesStart, gamesEnd);

    assert.equal(gamesSource.includes('type="date"'), true);
    assert.equal(gamesSource.includes('id="gameDate"'), true);
    assert.equal(appSource.includes("createGame(todayISO(), state.selectedPlayerId)"), false);
  });

  it("keeps sidebar panels from stretching with the opened game detail", () => {
    const shellStart = stylesSource.indexOf(".shell {");
    const shellEnd = stylesSource.indexOf("}", shellStart);
    const shellSource = stylesSource.slice(shellStart, shellEnd);

    assert.equal(shellSource.includes("align-items: start"), true);
  });

  it("groups left panels in one sidebar so row gaps do not expand", () => {
    const renderStart = appSource.indexOf("function render()");
    const renderEnd = appSource.indexOf("function renderError");
    const renderSource = appSource.slice(renderStart, renderEnd);

    assert.equal(renderSource.includes('<aside class="sidebar">'), true);
    assert.equal(stylesSource.includes(".sidebar {"), true);
    assert.equal(stylesSource.includes("grid-template-areas:\n    \"sidebar main\""), true);
  });

  it("prevents sidebar children from sharing the same grid cell", () => {
    assert.equal(stylesSource.includes(".sidebar > .panel {"), true);
    assert.equal(stylesSource.includes("grid-area: auto"), true);
  });
});
