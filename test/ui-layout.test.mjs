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

  it("collects player identity and allows adding a player before entering", () => {
    const renderStart = appSource.indexOf("function render()");
    const renderEnd = appSource.indexOf("function renderPinGate");
    const renderSource = appSource.slice(renderStart, renderEnd);
    const gateStart = appSource.indexOf("function renderPinGate");
    const gateEnd = appSource.indexOf("function bindPinGate");
    const gateSource = appSource.slice(gateStart, gateEnd);
    const bindGateStart = appSource.indexOf("function bindPinGate");
    const bindGateEnd = appSource.indexOf("function renderError");
    const bindGateSource = appSource.slice(bindGateStart, bindGateEnd);

    assert.equal(renderSource.includes('<aside class="sidebar">'), false);
    assert.equal(renderSource.includes("renderIdentity()"), false);
    assert.equal(renderSource.includes("renderPlayerForm()"), false);
    assert.equal(gateSource.includes('select id="pinPlayerSelect"'), true);
    assert.equal(gateSource.includes('id="pinAddPlayer"'), true);
    assert.equal(bindGateSource.includes('document.querySelector("#pinAddPlayer")'), true);
    assert.equal(bindGateSource.includes("createPlayer"), true);
    assert.equal(bindGateSource.includes('t("selectName")'), true);
  });

  it("provides a Chinese and English language toggle from the entry gate", () => {
    const gateStart = appSource.indexOf("function renderPinGate");
    const gateEnd = appSource.indexOf("function bindPinGate");
    const gateSource = appSource.slice(gateStart, gateEnd);
    const bindGateStart = appSource.indexOf("function bindPinGate");
    const bindGateEnd = appSource.indexOf("function renderError");
    const bindGateSource = appSource.slice(bindGateStart, bindGateEnd);

    assert.equal(appSource.includes('const LANGUAGE_KEY = "homegame-ledger:language"'), true);
    assert.equal(appSource.includes("const translations = {"), true);
    assert.equal(gateSource.includes('class="language-toggle"'), true);
    assert.equal(gateSource.includes('data-language="zh"'), true);
    assert.equal(gateSource.includes('data-language="en"'), true);
    assert.equal(bindGateSource.includes('document.querySelectorAll("[data-language]")'), true);
    assert.equal(bindGateSource.includes("rememberLanguage"), true);
    assert.equal(appSource.includes("t(\"gamesTab\")"), true);
    assert.equal(appSource.includes("t(\"enter\")"), true);
  });

  it("lets admin enter with a separate pin and manage games and hidden users", () => {
    const gateStart = appSource.indexOf("function renderPinGate");
    const gateEnd = appSource.indexOf("function bindPinGate");
    const gateSource = appSource.slice(gateStart, gateEnd);
    const bindGateStart = appSource.indexOf("function bindPinGate");
    const bindGateEnd = appSource.indexOf("function renderError");
    const bindGateSource = appSource.slice(bindGateStart, bindGateEnd);

    assert.equal(appSource.includes('const ADMIN_PIN = "924"'), true);
    assert.equal(gateSource.includes('value="__admin__"'), true);
    assert.equal(bindGateSource.includes("ADMIN_PIN"), true);
    assert.equal(appSource.includes("function renderAdminView"), true);
    assert.equal(appSource.includes("hideRemotePlayer"), true);
    assert.equal(appSource.includes("[data-admin-delete-game]"), true);
    assert.equal(appSource.includes("[data-admin-hide-player]"), true);
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
    assert.equal(historyViewSource.includes("${renderGameDetail({ showEmpty: false })}"), true);
    assert.equal(appSource.includes("function renderGameDetail({ showEmpty = true } = {})"), true);
    assert.equal(appSource.includes("if (!game && !showEmpty) return \"\""), true);
  });

  it("lets the opened game detail title collapse the selected game", () => {
    const detailStart = appSource.indexOf("function renderGameDetail");
    const detailEnd = appSource.indexOf("function renderParticipationControl");
    const detailSource = appSource.slice(detailStart, detailEnd);
    const titleClickStart = appSource.indexOf('document.querySelector("#detailTitleToggle")');
    const titleClickEnd = appSource.indexOf('document.querySelector("#toggleLock")');
    const titleClickSource = appSource.slice(titleClickStart, titleClickEnd);

    assert.equal(detailSource.includes('id="detailTitleToggle"'), true);
    assert.equal(detailSource.includes('type="button"'), true);
    assert.equal(titleClickSource.includes("state.selectedGameId = null"), true);
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

    assert.equal(detailSource.includes('t("donationLabel")'), true);
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

  it("keeps the main app layout in one column after identity moves to entry", () => {
    const shellStart = stylesSource.indexOf(".shell {");
    const shellEnd = stylesSource.indexOf("}", shellStart);
    const shellSource = stylesSource.slice(shellStart, shellEnd);
    const renderStart = appSource.indexOf("function render()");
    const renderEnd = appSource.indexOf("function renderPinGate");
    const renderSource = appSource.slice(renderStart, renderEnd);

    assert.equal(renderSource.includes('<aside class="sidebar">'), false);
    assert.equal(shellSource.includes("grid-template-columns: minmax(0, 1fr)"), true);
    assert.equal(shellSource.includes("sidebar main"), false);
    assert.equal(shellSource.includes("align-items: start"), true);
  });
});
