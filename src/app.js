import {
  formatAmount,
  getBalanceStatus,
  getGameEntries,
  getGameSwingLeaders,
  getOpenGameForDate,
  getPlayerParticipationCount,
  getPlayerTotal,
  getQuickAmounts,
  isPlayerInGame,
  parseAmountInput,
  sortGames,
  todayISO,
} from "./ledger.js";
import {
  createGame,
  createPlayer,
  deleteRemoteGame,
  joinRemoteGame,
  loadState,
  rememberSelectedPlayer,
  saveEntry,
  updateGameStatus
} from "./storage.js";

const quickAmounts = getQuickAmounts();
const app = document.querySelector("#app");
let state = null;
let errorMessage = "";

function setState(nextState) {
  state = nextState;
  errorMessage = "";
  render();
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    errorMessage = error.message || "操作失败";
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
  if (!state.selectedPlayerId && state.players[0]) {
    state.selectedPlayerId = state.players[0].id;
  }

  const todayGame = getOpenGameForDate(state, todayISO());
  if (!state.selectedGameId && todayGame) {
    state.selectedGameId = todayGame.id;
  }

  if (!state.selectedGameId && state.games[0]) {
    state.selectedGameId = sortGames(state.games)[0].id;
  }
}

function render() {
  if (!state) {
    app.innerHTML = `<div class="loading-screen">Loading Homegame Ledger...</div>`;
    return;
  }

  ensureSelection();

  app.innerHTML = `
    <div class="shell">
      ${renderError()}
      ${renderIdentity()}
      <main class="main">
        ${renderGames()}
        ${renderGameDetail()}
      </main>
      ${renderPlayerForm()}
      ${renderLeaderboard()}
    </div>
  `;

  bindEvents();
}

function renderError() {
  if (!errorMessage) return "";

  return `
    <div class="error-banner">
      <strong>操作失败</strong>
      <span>${escapeHtml(errorMessage)}</span>
    </div>
  `;
}

function renderIdentity() {
  const player = selectedPlayer();

  return `
    <section class="panel identity-panel">
      <div>
        <p class="eyebrow">Homegame Ledger</p>
        <h1>Homegame Ledger</h1>
      </div>
      <label class="field">
        <span>我是谁</span>
        <select id="playerSelect">
          ${state.players
            .map(
              (option) =>
                `<option value="${option.id}" ${option.id === player?.id ? "selected" : ""}>${escapeHtml(option.name)}</option>`
            )
            .join("")}
        </select>
      </label>
    </section>
  `;
}

function renderPlayerForm() {
  return `
    <section class="panel player-panel">
      <div class="section-head">
        <h2>玩家</h2>
        <span>${state.players.length} 人</span>
      </div>
      <form id="playerForm" class="inline-form">
        <input name="name" autocomplete="off" placeholder="新玩家名字" />
        <button type="submit">添加</button>
      </form>
    </section>
  `;
}

function renderLeaderboard() {
  const rows = state.players
    .map((player) => ({
      player,
      participationCount: getPlayerParticipationCount(state, player.id),
      total: getPlayerTotal(state, player.id)
    }))
    .sort((left, right) => right.total - left.total);

  return `
    <section class="panel leaderboard-panel">
      <div class="section-head">
        <h2>总输赢</h2>
        <span>${state.games.length} 局</span>
      </div>
      <div class="leaderboard">
        ${rows
          .map(
            ({ player, total, participationCount }) => `
              <button class="leader-row" data-player-id="${player.id}">
                <span><strong>${escapeHtml(player.name)}</strong><small>${participationCount} 局</small></span>
                <strong class="${amountClass(total)}">${formatAmount(total)}</strong>
              </button>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderGames() {
  const today = todayISO();
  const todayGames = state.games.filter((game) => game.date === today);

  return `
    <section class="toolbar">
      <div>
        <p class="eyebrow">${today}</p>
        <h2>对局</h2>
      </div>
      <button id="createTodayGame">
        新建对局${todayGames.length ? ` ${todayGames.length + 1}` : ""}
      </button>
    </section>
    <section class="game-list" aria-label="对局列表">
      ${sortGames(state.games)
        .map((game) => renderGameButton(game))
        .join("") || `<div class="empty-state">今天还没有对局</div>`}
    </section>
  `;
}

function renderGameButton(game) {
  const status = getBalanceStatus(state, game.id);
  const isSelected = game.id === state.selectedGameId;

  return `
    <button class="game-item ${isSelected ? "selected" : ""}" data-game-id="${game.id}">
      <span>
        <strong>${escapeHtml(game.title)}</strong>
        <small>${game.status === "locked" ? "已锁定" : "进行中"}</small>
      </span>
      <b class="${status.balanced ? "balanced" : "unbalanced"}">${formatAmount(status.total)}</b>
    </button>
  `;
}

function renderGameDetail() {
  const game = selectedGame();
  if (!game) {
    return `
      <section class="detail empty-detail">
        <h2>选择或新建一局</h2>
        <p>记录每个人最终买入、带走之后的净输赢。</p>
      </section>
    `;
  }

  const player = selectedPlayer();
  const status = getBalanceStatus(state, game.id);
  const myEntry = state.entries.find(
    (entry) => entry.gameId === game.id && entry.playerId === player?.id
  );
  const isLocked = game.status === "locked";
  const detailTitle = game.title.replace(`${game.date} `, "");
  const swingLeaders = getGameSwingLeaders(state, game.id);
  const isLegacyParticipant = Boolean(myEntry && !Array.isArray(game.participantIds));
  const isParticipant = player
    ? isPlayerInGame(game, player.id) || isLegacyParticipant
    : false;

  return `
    <section class="detail">
      <div class="detail-head">
        <div>
          <p class="eyebrow">${game.date}</p>
          <h2>${escapeHtml(detailTitle)}</h2>
        </div>
        <div class="detail-actions">
          <button id="toggleLock">${isLocked ? "解锁" : "锁定"}</button>
          <button id="deleteGame" class="danger-action">删除对局</button>
        </div>
      </div>

      <div class="balance-strip ${status.balanced ? "ok" : "warn"}">
        <span>合计</span>
        <strong>${formatAmount(status.total)}</strong>
        <small>${status.balanced ? "已平账" : `还需要 ${status.adjustmentLabel}`}</small>
      </div>

      <div class="swing-grid">
        ${renderSwingCard("本局最大赢", swingLeaders.biggestWinner, "positive")}
        ${renderSwingCard("本局最大输", swingLeaders.biggestLoser, "negative")}
      </div>

      ${
        isParticipant
          ? renderEntryForm(player, myEntry, isLocked)
          : renderJoinGamePrompt(player, isLocked)
      }

      <div class="entries">
        ${getGameEntries(state, game.id)
          .map(
            ({ player: rowPlayer, amount }) => `
              <div class="entry-row">
                <span>${escapeHtml(rowPlayer.name)}</span>
                <strong class="${amountClass(amount)}">${formatAmount(amount)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderEntryForm(player, myEntry, isLocked) {
  return `
    <form id="entryForm" class="entry-form">
      <label class="field">
        <span>${escapeHtml(player?.name ?? "")} 的输赢</span>
        <input name="amount" inputmode="numeric" value="${myEntry ? formatAmount(myEntry.amount) : ""}" placeholder="+500 / -2000" ${isLocked ? "disabled" : ""} />
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
      <button class="primary-action" type="submit" ${isLocked ? "disabled" : ""}>保存我的输赢</button>
    </form>
  `;
}

function renderJoinGamePrompt(player, isLocked) {
  return `
    <div class="join-panel">
      <div>
        <strong>${escapeHtml(player?.name ?? "当前玩家")} 还没进入这局</strong>
        <span>先入局，之后再填写这一局的输赢。</span>
      </div>
      <button id="joinGame" class="primary-action" ${isLocked ? "disabled" : ""}>进入对局</button>
    </div>
  `;
}

function renderSwingCard(label, leader, tone) {
  return `
    <div class="swing-card">
      <span>${label}</span>
      ${
        leader
          ? `<strong>${escapeHtml(leader.playerName)}</strong><b class="${tone}">${formatAmount(leader.amount)}</b>`
          : `<strong>暂无</strong><b class="zero">0</b>`
      }
    </div>
  `;
}

function bindEvents() {
  document.querySelector("#playerSelect")?.addEventListener("change", (event) => {
    state.selectedPlayerId = event.target.value;
    rememberSelectedPlayer(state.selectedPlayerId);
    render();
  });

  document.querySelector("#playerForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    runAction(async () => {
      const form = new FormData(event.currentTarget);
      const nextState = await createPlayer(form.get("name"));
      const player = nextState.players.find(
        (item) => item.name.toLowerCase() === String(form.get("name")).trim().toLowerCase()
      );
      if (player) {
        nextState.selectedPlayerId = player.id;
        rememberSelectedPlayer(player.id);
      }
      setState(nextState);
    });
  });

  document.querySelectorAll("[data-player-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPlayerId = button.dataset.playerId;
      rememberSelectedPlayer(state.selectedPlayerId);
      render();
    });
  });

  document.querySelector("#createTodayGame")?.addEventListener("click", () => {
    runAction(async () => setState(await createGame(todayISO(), state.selectedPlayerId)));
  });

  document.querySelectorAll("[data-game-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedGameId = button.dataset.gameId;
      render();
    });
  });

  document.querySelector("#entryForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    runAction(async () => {
      const game = selectedGame();
      const player = selectedPlayer();
      if (!game || !player || game.status === "locked") return;

      const form = new FormData(event.currentTarget);
      setState(await saveEntry(game.id, player.id, parseAmountInput(form.get("amount"))));
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
