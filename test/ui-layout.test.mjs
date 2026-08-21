import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

describe("game detail layout", () => {
  it("requires the hardcoded pin before showing the ledger", () => {
    assert.equal(appSource.includes('const ACCESS_PIN = "429"'), true);
    assert.equal(appSource.includes("renderPinGate"), true);
    assert.equal(appSource.includes("sessionStorage"), true);
  });

  it("moves leaderboard into a separate main tab", () => {
    const renderStart = appSource.indexOf("function render()");
    const renderEnd = appSource.indexOf("function renderPinGate");
    const renderSource = appSource.slice(renderStart, renderEnd);

    assert.equal(renderSource.includes("renderLeaderboard()"), false);
    assert.equal(appSource.includes("view-tabs"), true);
    assert.equal(appSource.includes("leaderboard-view"), true);
    assert.equal(appSource.includes("activeView"), true);
  });

  it("moves historical games into their own main tab", () => {
    const renderStart = appSource.indexOf("function render()");
    const renderEnd = appSource.indexOf("function renderPinGate");
    const renderSource = appSource.slice(renderStart, renderEnd);
    const gamesViewStart = appSource.indexOf("function renderGamesView");
    const gamesViewEnd = appSource.indexOf("function renderGameButton");
    const gamesViewSource = appSource.slice(gamesViewStart, gamesViewEnd);
    const gameClickStart = appSource.indexOf('document.querySelectorAll("[data-game-id]")');
    const gameClickEnd = appSource.indexOf('document.querySelector("#entryForm")');
    const gameClickSource = appSource.slice(gameClickStart, gameClickEnd);
    const historyViewStart = appSource.indexOf("function renderHistoryView");
    const historyViewEnd = appSource.indexOf("function renderGameButton");
    const historyViewSource = appSource.slice(historyViewStart, historyViewEnd);

    assert.equal(appSource.includes('data-view="history"'), true);
    assert.equal(renderSource.includes('activeView === "history" ? renderHistoryView()'), true);
    assert.ok(gamesViewSource.indexOf("${renderGameDetail()}") < gamesViewSource.indexOf("${renderRecentGames(recentGames)}"));
    assert.equal(gameClickSource.includes('activeView = "games"'), false);
    assert.equal(historyViewSource.includes("${renderGameDetail()}"), true);
  });

  it("clears an expanded historical game when switching back to the games tab", () => {
    const tabClickStart = appSource.indexOf('document.querySelectorAll("[data-view]")');
    const tabClickEnd = appSource.indexOf('document.querySelector("#playerSelect")');
    const tabClickSource = appSource.slice(tabClickStart, tabClickEnd);

    assert.equal(tabClickSource.includes('activeView = button.dataset.view || "games"'), true);
    assert.equal(tabClickSource.includes('if (activeView === "games")'), true);
    assert.equal(tabClickSource.includes("state.selectedGameId = null"), true);
  });

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

  it("does not prefill zero in the win/loss amount field", () => {
    const formStart = appSource.indexOf("function renderEntryForm");
    const formEnd = appSource.indexOf("function renderJoinGamePrompt");
    const formSource = appSource.slice(formStart, formEnd);

    assert.equal(formSource.includes("formatAmount(myEntry.amount)"), false);
    assert.equal(formSource.includes("formatEntryAmountInput(myEntry.amount)"), true);
  });

  it("keeps the win/loss amount field friendly to plus and minus signs on phones", () => {
    const formStart = appSource.indexOf("function renderEntryForm");
    const formEnd = appSource.indexOf("function renderJoinGamePrompt");
    const formSource = appSource.slice(formStart, formEnd);

    assert.equal(formSource.includes('name="amount" inputmode="text"'), true);
    assert.equal(formSource.includes('name="amount" inputmode="numeric"'), false);
    assert.equal(formSource.includes('name="donationAmount" inputmode="numeric"'), true);
  });

  it("does not show a placeholder on the donation field", () => {
    const formStart = appSource.indexOf("function renderEntryForm");
    const formEnd = appSource.indexOf("function renderJoinGamePrompt");
    const formSource = appSource.slice(formStart, formEnd);

    assert.equal(formSource.includes('name="donationAmount"'), true);
    assert.equal(formSource.includes('placeholder="0 / 500"'), false);
  });

  it("shows donation amount wording in the entry details", () => {
    const detailStart = appSource.indexOf("function renderGameDetail");
    const detailEnd = appSource.indexOf("function renderParticipationControl");
    const detailSource = appSource.slice(detailStart, detailEnd);

    assert.equal(detailSource.includes("捐赠金额"), true);
    assert.equal(detailSource.includes("捐献 ${formatPlainAmount(donationAmount)}"), false);
  });

  it("lets users choose a date when creating a game", () => {
    const gamesStart = appSource.indexOf("function renderGames");
    const gamesEnd = appSource.indexOf("function renderGameButton");
    const gamesSource = appSource.slice(gamesStart, gamesEnd);

    assert.equal(gamesSource.includes('type="date"'), true);
    assert.equal(gamesSource.includes('id="gameDate"'), true);
    assert.equal(appSource.includes("createGame(todayISO(), state.selectedPlayerId)"), false);
  });

  it("shows a game winner summary and balanced label on game cards", () => {
    const buttonStart = appSource.indexOf("function renderGameButton");
    const buttonEnd = appSource.indexOf("function renderGameCardSummary");
    const buttonSource = appSource.slice(buttonStart, buttonEnd);

    assert.equal(buttonSource.includes("renderGameCardSummary"), true);
    assert.equal(buttonSource.includes("formatAmount(status.total)"), false);
    assert.equal(appSource.includes("已平账"), true);
  });

  it("asks for confirmation before unlocking a game", () => {
    const lockStart = appSource.indexOf('document.querySelector("#toggleLock")');
    const lockEnd = appSource.indexOf('document.querySelector("#deleteGame")');
    const lockSource = appSource.slice(lockStart, lockEnd);

    assert.equal(lockSource.includes('game.status === "locked"'), true);
    assert.equal(lockSource.includes("window.confirm"), true);
    assert.equal(lockSource.includes("if (!confirmed) return"), true);
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
