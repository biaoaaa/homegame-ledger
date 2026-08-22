import {
  formatDateWithWeekday,
  formatGameTitleWithWeekday,
  formatAmount,
  getBalanceStatus,
  getDonationLeaderboard,
  getGameEntries,
  getGameSwingLeaders,
  getTopSingleGameWins,
  getQuickAmounts,
  isPlayerInGame,
  isValidAmountInput,
  parseAmountInput,
  sortGames,
  todayISO,
} from "./ledger.js";
import {
  createGame,
  createPlayer,
  deleteRemoteGame,
  hideRemotePlayer,
  joinRemoteGame,
  loadState,
  rememberSelectedPlayer,
  saveEntry,
  updateGameStatus
} from "./storage.js";

const quickAmounts = getQuickAmounts();
const app = document.querySelector("#app");
const ACCESS_PIN = "429";
const ADMIN_PIN = "924";
const ACCESS_KEY = "homegame-ledger:pin-ok";
const ADMIN_ACCESS_KEY = "homegame-ledger:admin-ok";
const LANGUAGE_KEY = "homegame-ledger:language";
const translations = {
  zh: {
    add: "添加",
    addPlayerPlaceholder: "新玩家名字",
    admin: "Admin",
    adminTitle: "Admin 管理",
    amountInvalid: "输赢金额只能输入数字，可以带 + 或 -，比如 +500 / -2000。",
    balance: "合计",
    balanced: "已平账",
    currentPlayer: "当前玩家",
    date: "日期",
    deleteGame: "删除对局",
    hideUser: "隐藏用户",
    donation: "本局捐献",
    donationBoard: "捐献榜 Top 3",
    donationEmpty: "还没有捐献记录",
    donationInvalid: "捐献金额只能输入 0 或正整数。",
    donationLabel: "捐赠金额",
    emptyDetailBody: "记录每个人最终买入、带走之后的净输赢。",
    emptyDetailTitle: "选择或新建一局",
    enter: "进入",
    enterGame: "进入对局",
    errorTitle: "操作失败",
    gamesTab: "对局",
    historyEmpty: "还没有历史对局",
    historyLabel: "历史对局",
    historyTab: "历史",
    hiddenUserNote: "隐藏后不会出现在登录名单里，历史记录仍保留名字。",
    inProgress: "进行中",
    joinBody: "先入局，之后再填写这一局的输赢。",
    joinTitle: "{name} 还没进入这局",
    leaderboardTitle: "榜单",
    leaderboardTab: "榜单",
    locked: "已锁定",
    lockGame: "锁定",
    newGame: "新建对局",
    needsAdjustment: "还需要",
    noWinRecords: "还没有赢钱记录",
    pin: "房间 PIN",
    pinWrong: "PIN 不对",
    selectName: "先选择你的名字",
    selectWho: "我是谁",
    saveResult: "保存本局记录",
    topWinBoard: "单局最高胜利 Top 3",
    totalDonation: "累计捐献",
    todayEmpty: "今天还没有对局",
    todayGamesLabel: "今日对局",
    unlockGame: "解锁",
    winner: "大赢家"
  },
  en: {
    add: "Add",
    addPlayerPlaceholder: "New player name",
    admin: "Admin",
    adminTitle: "Admin",
    amountInvalid: "Win/loss must be a number, optionally with + or -, like +500 / -2000.",
    balance: "Balance",
    balanced: "Settled",
    currentPlayer: "Current player",
    date: "Date",
    deleteGame: "Delete game",
    hideUser: "Hide user",
    donation: "Donation",
    donationBoard: "Donation Top 3",
    donationEmpty: "No donation records yet",
    donationInvalid: "Donation must be 0 or a positive whole number.",
    donationLabel: "Donation",
    emptyDetailBody: "Record each player's final net win/loss after buy-ins and cash-out.",
    emptyDetailTitle: "Select or create a game",
    enter: "Enter",
    enterGame: "Join game",
    errorTitle: "Action failed",
    gamesTab: "Games",
    historyEmpty: "No past games yet",
    historyLabel: "Past games",
    historyTab: "History",
    hiddenUserNote: "Hidden users disappear from login, but historical records keep their names.",
    inProgress: "In progress",
    joinBody: "Join this game first, then enter your result.",
    joinTitle: "{name} has not joined this game",
    leaderboardTitle: "Leaderboard",
    leaderboardTab: "Leaderboard",
    locked: "Locked",
    lockGame: "Lock",
    newGame: "New game",
    needsAdjustment: "Needs",
    noWinRecords: "No winning records yet",
    pin: "Room PIN",
    pinWrong: "Wrong PIN",
    selectName: "Choose your name first",
    selectWho: "Who am I?",
    saveResult: "Save result",
    topWinBoard: "Biggest Single-Game Wins Top 3",
    totalDonation: "Total donation",
    todayEmpty: "No games today yet",
    todayGamesLabel: "Today's games",
    unlockGame: "Unlock",
    winner: "Winner"
  }
};
let state = null;
let errorMessage = "";
let hasAccess = readAccess();
let hasAdminAccess = readAdminAccess();
let activeView = "games";
let language = readLanguage();

function t(key) {
  return translations[language]?.[key] ?? translations.zh[key] ?? key;
}

function setState(nextState) {
  state = nextState;
  errorMessage = "";
  render();
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    errorMessage = error.message || t("errorTitle");
    render();
  }
}

function selectedPlayer() {
  return state.players.find((player) => player.id === state.selectedPlayerId) ?? null;
}

function selectedGame() {
  return state.games.find((game) => game.id === state.selectedGameId) ?? null;
}

function ensureSelection() {
  if (
    state.selectedGameId &&
    !state.games.some((game) => game.id === state.selectedGameId)
  ) {
    state.selectedGameId = null;
  }
}

function render() {
  if (!state) {
    app.innerHTML = `<div class="loading-screen">Loading Homegame Ledger...</div>`;
    return;
  }

  if (hasAdminAccess) {
    app.innerHTML = renderAdminView();
    bindAdminEvents();
    return;
  }

  if (!hasAccess || !selectedPlayer()) {
    app.innerHTML = renderPinGate();
    bindPinGate();
    return;
  }

  ensureSelection();

  app.innerHTML = `
    <div class="shell">
      ${renderError()}
      <main class="main">
        ${renderViewTabs()}
        ${activeView === "history" ? renderHistoryView() : activeView === "leaderboard" ? renderLeaderboardView() : renderGamesView()}
      </main>
    </div>
  `;

  bindEvents();
}

function renderPinGate() {
  const player = selectedPlayer();

  return `
    <main class="pin-screen">
      <section class="pin-panel">
        <div class="pin-topline">
          <p class="eyebrow">Homegame Ledger</p>
          <div class="language-toggle" aria-label="Language">
            <button type="button" data-language="zh" class="${language === "zh" ? "active" : ""}">中</button>
            <button type="button" data-language="en" class="${language === "en" ? "active" : ""}">EN</button>
          </div>
        </div>
        <h1>Homegame Ledger</h1>
        <form id="pinForm" class="pin-form">
          <label class="field">
            <span>${t("selectWho")}</span>
            <select id="pinPlayerSelect" name="playerId" autofocus>
              <option value="" ${player ? "" : "selected"}>${t("selectName")}</option>
              <option value="__admin__">${t("admin")}</option>
              ${state.players
                .filter((option) => !option.hiddenAt)
                .map(
                  (option) =>
                    `<option value="${option.id}" ${option.id === player?.id ? "selected" : ""}>${escapeHtml(option.name)}</option>`
                )
                .join("")}
            </select>
          </label>
          <label class="field">
            <span>${t("pin")}</span>
            <input name="pin" inputmode="numeric" autocomplete="off" />
          </label>
          ${errorMessage ? `<div class="pin-error">${escapeHtml(errorMessage)}</div>` : ""}
          <button class="primary-action" type="submit">${t("enter")}</button>
        </form>
        <div class="pin-add-player">
          <input id="pinNewPlayerName" autocomplete="off" placeholder="${t("addPlayerPlaceholder")}" />
          <button id="pinAddPlayer" type="button">${t("add")}</button>
        </div>
      </section>
    </main>
  `;
}

function bindPinGate() {
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.addEventListener("click", () => {
      language = button.dataset.language === "en" ? "en" : "zh";
      rememberLanguage(language);
      render();
    });
  });

  document.querySelector("#pinPlayerSelect")?.addEventListener("change", (event) => {
    state.selectedPlayerId = event.target.value || null;
    rememberSelectedPlayer(state.selectedPlayerId);
    render();
  });

  document.querySelector("#pinAddPlayer")?.addEventListener("click", () => {
    runAction(async () => {
      const input = document.querySelector("#pinNewPlayerName");
      const nextState = await createPlayer(input?.value || "");
      const player = nextState.players.find(
        (item) => item.name.toLowerCase() === String(input?.value || "").trim().toLowerCase()
      );
      if (player) {
        nextState.selectedPlayerId = player.id;
        rememberSelectedPlayer(player.id);
      }
      setState(nextState);
    });
  });

  document.querySelector("#pinForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const playerId = String(form.get("playerId") || "").trim();
    if (!playerId) {
      errorMessage = t("selectName");
      render();
      return;
    }

    const pin = String(form.get("pin") || "").trim();
    if (playerId === "__admin__") {
      if (pin !== ADMIN_PIN) {
        errorMessage = t("pinWrong");
        render();
        return;
      }

      hasAdminAccess = true;
      hasAccess = false;
      state.selectedPlayerId = null;
      rememberSelectedPlayer(null);
      rememberAdminAccess();
      render();
      return;
    }

    if (pin !== ACCESS_PIN) {
      errorMessage = t("pinWrong");
      render();
      return;
    }

    hasAccess = true;
    state.selectedPlayerId = playerId;
    errorMessage = "";
    rememberSelectedPlayer(playerId);
    rememberAccess();
    render();
  });
}

function renderError() {
  if (!errorMessage) return "";

  return `
    <div class="error-banner">
      <strong>${t("errorTitle")}</strong>
      <span>${escapeHtml(errorMessage)}</span>
    </div>
  `;
}

function renderAdminView() {
  return `
    <div class="shell">
      ${renderError()}
      <main class="main">
        <section class="panel admin-panel">
          <div class="section-head">
            <h2>${t("adminTitle")}</h2>
            <span>${state.players.filter((player) => !player.hiddenAt).length} users</span>
          </div>
          <div class="admin-grid">
            <div class="leaderboard">
              <h3>${t("historyLabel")}</h3>
              ${sortGames(state.games)
                .map(
                  (game) => `
                    <div class="entry-row">
                      <span>
                        <strong>${escapeHtml(formatGameTitleWithWeekday(game))}</strong>
                        <small>${game.status === "locked" ? t("locked") : t("inProgress")}</small>
                      </span>
                      <button class="danger-action" data-admin-delete-game="${game.id}" type="button">${t("deleteGame")}</button>
                    </div>
                  `
                )
                .join("") || `<div class="empty-state compact">${t("historyEmpty")}</div>`}
            </div>
            <div class="leaderboard">
              <h3>${t("selectWho")}</h3>
              <p class="admin-note">${t("hiddenUserNote")}</p>
              ${state.players
                .filter((player) => !player.hiddenAt)
                .map(
                  (player) => `
                    <div class="entry-row">
                      <span><strong>${escapeHtml(player.name)}</strong></span>
                      <button class="danger-action" data-admin-hide-player="${player.id}" type="button">${t("hideUser")}</button>
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}

function bindAdminEvents() {
  document.querySelectorAll("[data-admin-delete-game]").forEach((button) => {
    button.addEventListener("click", () => {
      const game = state.games.find((item) => item.id === button.dataset.adminDeleteGame);
      if (!game || !window.confirm(`${t("deleteGame")} ${formatGameTitleWithWeekday(game)}?`)) return;
      runAction(async () => setState(await deleteRemoteGame(game.id, null)));
    });
  });

  document.querySelectorAll("[data-admin-hide-player]").forEach((button) => {
    button.addEventListener("click", () => {
      const player = state.players.find((item) => item.id === button.dataset.adminHidePlayer);
      if (!player || !window.confirm(`${t("hideUser")} ${player.name}?`)) return;
      runAction(async () => setState(await hideRemotePlayer(player.id)));
    });
  });
}

function renderViewTabs() {
  return `
    <nav class="view-tabs" aria-label="主视图">
      <button type="button" data-view="games" class="${activeView === "games" ? "active" : ""}">${t("gamesTab")}</button>
      <button type="button" data-view="history" class="${activeView === "history" ? "active" : ""}">${t("historyTab")}</button>
      <button type="button" data-view="leaderboard" class="${activeView === "leaderboard" ? "active" : ""}">${t("leaderboardTab")}</button>
    </nav>
  `;
}

function renderLeaderboard() {
  const topWins = getTopSingleGameWins(state);
  const donationRows = getDonationLeaderboard(state);

  return `
    <section class="panel leaderboard-panel">
      <div class="section-head">
        <h2>${t("leaderboardTitle")}</h2>
        <span>${state.games.length} 局</span>
      </div>
      ${renderTopWinBoard(topWins)}
      ${renderDonationBoard(donationRows)}
    </section>
  `;
}

function renderLeaderboardView() {
  return `
    <section class="leaderboard-view">
      ${renderLeaderboard()}
    </section>
  `;
}

function renderTopWinBoard(rows) {
  return `
    <div class="leaderboard">
      <h3>${t("topWinBoard")}</h3>
      ${
        rows.length
          ? rows
              .map(
                (row, index) => `
                  <div class="leader-row">
                    <span><strong>${index + 1}. ${escapeHtml(row.playerName)}</strong><small>${escapeHtml(row.gameTitle)}</small></span>
                    <strong class="positive">${formatAmount(row.amount)}</strong>
                  </div>
                `
              )
              .join("")
          : `<div class="empty-state compact">${t("noWinRecords")}</div>`
      }
    </div>
  `;
}

function renderDonationBoard(rows) {
  return `
    <div class="leaderboard">
      <h3>${t("donationBoard")}</h3>
      ${
        rows.length
          ? rows
              .map(
                (row, index) => `
                  <div class="leader-row">
                    <span><strong>${index + 1}. ${escapeHtml(row.playerName)}</strong><small>${t("totalDonation")}</small></span>
                    <strong class="donation-amount">${formatPlainAmount(row.amount)}</strong>
                  </div>
                `
              )
              .join("")
          : `<div class="empty-state compact">${t("donationEmpty")}</div>`
      }
    </div>
  `;
}

function renderGames() {
  const today = todayISO();
  const player = selectedPlayer();

  return `
    <section class="toolbar">
      <div>
        <p class="eyebrow">${formatDateWithWeekday(today)}</p>
        <h2>${t("gamesTab")}</h2>
      </div>
      <form id="createGameForm" class="create-game-form">
        <label class="date-field">
          <span>${t("date")}</span>
          <input id="gameDate" name="date" type="date" value="${today}" />
        </label>
        <button type="submit" ${player ? "" : "disabled"}>
          ${t("newGame")}
        </button>
      </form>
    </section>
  `;
}

function renderGamesView() {
  const recentGames = sortGames(state.games).filter((game) => game.date === todayISO());

  return `
    ${renderGames()}
    ${renderGameDetail()}
    ${renderRecentGames(recentGames)}
  `;
}

function renderRecentGames(games) {
  return `
    <section class="game-list" aria-label="${t("todayGamesLabel")}">
      ${games
        .map((game) => renderGameButton(game))
        .join("") || `<div class="empty-state">${t("todayEmpty")}</div>`}
    </section>
  `;
}

function renderHistoryView() {
  return `
    <section class="toolbar">
      <div>
        <p class="eyebrow">${state.games.length} 局</p>
        <h2>${t("historyLabel")}</h2>
      </div>
    </section>
    ${renderGameDetail({ showEmpty: false })}
    <section class="game-list" aria-label="${t("historyLabel")}">
      ${sortGames(state.games)
        .map((game) => renderGameButton(game))
        .join("") || `<div class="empty-state">${t("historyEmpty")}</div>`}
    </section>
  `;
}

function renderGameButton(game) {
  const status = getBalanceStatus(state, game.id);
  const isSelected = game.id === state.selectedGameId;
  const summary = renderGameCardSummary(game, status);

  return `
    <button class="game-item ${isSelected ? "selected" : ""}" data-game-id="${game.id}">
      <span>
        <strong>${escapeHtml(formatGameTitleWithWeekday(game))}</strong>
        <small>${game.status === "locked" ? t("locked") : t("inProgress")}</small>
      </span>
      ${summary}
    </button>
  `;
}

function renderGameCardSummary(game, status) {
  const winner = getGameSwingLeaders(state, game.id).biggestWinner;

  if (winner) {
    return `
      <span class="game-summary">
        <small>${t("winner")}</small>
        <strong>${escapeHtml(winner.playerName)}</strong>
        <b class="positive">${formatAmount(winner.amount)}</b>
        ${status.balanced ? `<em>${t("balanced")}</em>` : `<em class="unbalanced">${formatAmount(status.total)}</em>`}
      </span>
    `;
  }

  return `
    <span class="game-summary">
      <strong class="${status.balanced ? "balanced" : "unbalanced"}">
        ${status.balanced ? t("balanced") : formatAmount(status.total)}
      </strong>
    </span>
  `;
}

function renderGameDetail({ showEmpty = true } = {}) {
  const game = selectedGame();
  if (!game && !showEmpty) return "";
  if (!game) {
    return `
      <section class="detail empty-detail">
        <h2>${t("emptyDetailTitle")}</h2>
        <p>${t("emptyDetailBody")}</p>
      </section>
    `;
  }

  const player = selectedPlayer();
  const status = getBalanceStatus(state, game.id);
  const myEntry = state.entries.find(
    (entry) => entry.gameId === game.id && entry.playerId === player?.id
  );
  const isLocked = game.status === "locked";
  const detailTitle = formatGameTitleWithWeekday(game);
  const isLegacyParticipant = Boolean(myEntry && !Array.isArray(game.participantIds));
  const isParticipant = player
    ? isPlayerInGame(game, player.id) || isLegacyParticipant
    : false;

  return `
    <section class="detail">
      <div class="detail-head">
        <button id="detailTitleToggle" class="detail-title-toggle" type="button">
          <p class="eyebrow">${formatDateWithWeekday(game.date)}</p>
          <h2>${escapeHtml(detailTitle)}</h2>
        </button>
        <div class="detail-actions">
          <button id="toggleLock">${isLocked ? t("unlockGame") : t("lockGame")}</button>
          <button id="deleteGame" class="danger-action">${t("deleteGame")}</button>
        </div>
      </div>

      <div class="balance-strip ${status.balanced ? "ok" : "warn"}">
        <span>${t("balance")}</span>
        <strong>${formatAmount(status.total)}</strong>
        <small>${status.balanced ? t("balanced") : `${t("needsAdjustment")} ${status.adjustmentLabel}`}</small>
      </div>

      ${renderParticipationControl(player, myEntry, isLocked, isParticipant)}

      <div class="entries">
        ${getGameEntries(state, game.id)
          .map(
            ({ player: rowPlayer, amount, donationAmount }) => `
              <div class="entry-row">
                <span>
                  <strong>${escapeHtml(rowPlayer.name)}</strong>
                  ${donationAmount > 0 ? `<small>${t("donationLabel")} ${formatPlainAmount(donationAmount)}</small>` : ""}
                </span>
                <strong class="${amountClass(amount)}">${formatAmount(amount)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderParticipationControl(player, myEntry, isLocked, isParticipant) {
  if (!player) return renderSelectPlayerPrompt();
  if (!isParticipant) return renderJoinGamePrompt(player, isLocked);
  return renderEntryForm(player, myEntry, isLocked);
}

function renderSelectPlayerPrompt() {
  return `
    <div class="join-panel">
      <div>
        <strong>${t("selectWho")}</strong>
        <span>${t("selectName")}</span>
      </div>
    </div>
  `;
}

function renderEntryForm(player, myEntry, isLocked) {
  return `
    <form id="entryForm" class="entry-form">
      <label class="field">
        <span>${escapeHtml(player?.name ?? "")} ${language === "zh" ? "的输赢" : "win/loss"}</span>
        <input name="amount" inputmode="text" autocapitalize="off" spellcheck="false" value="${myEntry ? formatEntryAmountInput(myEntry.amount) : ""}" placeholder="+500 / -2000" ${isLocked ? "disabled" : ""} />
      </label>
      <div class="quick-grid">
        ${quickAmounts
          .map(
            (amount) => `
              <button type="button" data-quick-amount="${amount}" ${isLocked ? "disabled" : ""}>
                ${formatAmount(amount)}
              </button>
            `
          )
          .join("")}
      </div>
      <label class="field">
        <span>${t("donation")}</span>
        <input name="donationAmount" inputmode="numeric" value="${myEntry ? formatDonationInput(myEntry.donationAmount) : ""}" ${isLocked ? "disabled" : ""} />
      </label>
      <button class="primary-action" type="submit" ${isLocked ? "disabled" : ""}>${t("saveResult")}</button>
    </form>
  `;
}

function renderJoinGamePrompt(player, isLocked) {
  return `
    <div class="join-panel">
      <div>
        <strong>${t("joinTitle").replace("{name}", escapeHtml(player?.name ?? t("currentPlayer")))}</strong>
        <span>${t("joinBody")}</span>
      </div>
      <button id="joinGame" class="primary-action" ${isLocked ? "disabled" : ""}>${t("enterGame")}</button>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.view || "games";
      if (activeView === "games") {
        state.selectedGameId = null;
      }
      render();
    });
  });

  document.querySelector("#createGameForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date") || todayISO());
    runAction(async () => setState(await createGame(date, state.selectedPlayerId)));
  });

  document.querySelectorAll("[data-game-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedGameId =
        state.selectedGameId === button.dataset.gameId ? null : button.dataset.gameId;
      render();
    });
  });

  document.querySelector("#detailTitleToggle")?.addEventListener("click", () => {
    state.selectedGameId = null;
    render();
  });

  document.querySelector("#entryForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amountInput = form.get("amount");
    const donationInput = form.get("donationAmount");

    if (!isValidAmountInput(amountInput)) {
      errorMessage = t("amountInvalid");
      render();
      return;
    }

    if (!isValidAmountInput(donationInput, { allowNegative: false })) {
      errorMessage = t("donationInvalid");
      render();
      return;
    }

    runAction(async () => {
      const game = selectedGame();
      const player = selectedPlayer();
      if (!game || !player || game.status === "locked") return;

      setState(
        await saveEntry(
          game.id,
          player.id,
          parseAmountInput(form.get("amount")),
          Math.max(0, parseAmountInput(form.get("donationAmount")))
        )
      );
    });
  });

  document.querySelector("#joinGame")?.addEventListener("click", () => {
    runAction(async () => {
      const game = selectedGame();
      const player = selectedPlayer();
      if (!game || !player || game.status === "locked") return;

      setState(await joinRemoteGame(game.id, player.id));
    });
  });

  document.querySelectorAll("[data-quick-amount]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.querySelector("#entryForm input[name='amount']");
      if (!input) return;
      input.value = formatAmount(parseAmountInput(input.value) + Number(button.dataset.quickAmount));
      input.focus();
    });
  });

  document.querySelector("#toggleLock")?.addEventListener("click", () => {
    runAction(async () => {
      const game = selectedGame();
      if (!game) return;

      if (game.status === "locked") {
        const confirmed = window.confirm(`确认解锁 ${formatGameTitleWithWeekday(game)}？解锁后大家可以继续修改这一局记录。`);
        if (!confirmed) return;
      }

      const status = game.status === "locked" ? "open" : "locked";
      setState(await updateGameStatus(game.id, status, state.selectedPlayerId));
    });
  });

  document.querySelector("#deleteGame")?.addEventListener("click", () => {
    const game = selectedGame();
    if (!game) return;

    const confirmed = window.confirm(`删除 ${game.title}？这一局的输赢记录也会一起删除。`);
    if (!confirmed) return;

    runAction(async () => setState(await deleteRemoteGame(game.id, state.selectedPlayerId)));
  });
}

function amountClass(amount) {
  if (amount > 0) return "positive";
  if (amount < 0) return "negative";
  return "zero";
}

function formatPlainAmount(amount) {
  return Math.max(0, Number(amount) || 0).toLocaleString("en-US");
}

function formatDonationInput(amount) {
  const numericAmount = Math.max(0, Number(amount) || 0);
  return numericAmount > 0 ? numericAmount.toLocaleString("en-US") : "";
}

function formatEntryAmountInput(amount) {
  const numericAmount = Number(amount) || 0;
  return numericAmount === 0 ? "" : formatAmount(numericAmount);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

render();
loadState().then(setState);

function readAccess() {
  try {
    return window.sessionStorage?.getItem(ACCESS_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberAccess() {
  try {
    window.sessionStorage?.setItem(ACCESS_KEY, "1");
  } catch {
    // Session remember is best-effort.
  }
}

function readAdminAccess() {
  try {
    return window.sessionStorage?.getItem(ADMIN_ACCESS_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberAdminAccess() {
  try {
    window.sessionStorage?.setItem(ADMIN_ACCESS_KEY, "1");
    window.sessionStorage?.removeItem(ACCESS_KEY);
  } catch {
    // Session remember is best-effort.
  }
}

function readLanguage() {
  try {
    return window.sessionStorage?.getItem(LANGUAGE_KEY) === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

function rememberLanguage(nextLanguage) {
  try {
    window.sessionStorage?.setItem(LANGUAGE_KEY, nextLanguage);
  } catch {
    // Language preference is best-effort.
  }
}
