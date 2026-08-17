const DEFAULT_PLAYERS = ["Biao", "Jiarou"];
const QUICK_AMOUNTS = [-2000, -1000, -500, 500, 1000, 2000];
const CHINESE_NUMERALS = [
  "零",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
  "十"
];

export function createId(prefix = "id") {
  const randomPart =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${randomPart}`;
}

export function todayISO(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createInitialState() {
  return {
    players: DEFAULT_PLAYERS.map((name) => ({
      id: createId("player"),
      name,
      createdAt: new Date().toISOString()
    })),
    games: [],
    entries: [],
    selectedPlayerId: null,
    selectedGameId: null
  };
}

export function createGame(date = todayISO()) {
  return {
    id: createId("game"),
    date,
    title: `${date} Homegame`,
    participantIds: [],
    status: "open",
    createdAt: new Date().toISOString()
  };
}

export function createGameForDate(state, date = todayISO(), creatorPlayerId = null) {
  const gameCount = state.games.filter((game) => game.date === date).length;
  const gameNumber = gameCount + 1;
  const label = gameNumberToLabel(gameNumber);
  const game = {
    ...createGame(date),
    title: `${date} 对局${label}`,
    participantIds: creatorPlayerId ? [creatorPlayerId] : []
  };

  state.games.push(game);
  return game;
}

export function gameNumberToLabel(number) {
  if (number >= 1 && number <= 10) return CHINESE_NUMERALS[number];
  return String(number);
}

export function parseAmountInput(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : 0;
  }

  const normalized = String(value)
    .trim()
    .replace(/,/g, "")
    .replace(/\s+/g, "");

  if (!normalized) return 0;

  const amount = Number.parseInt(normalized, 10);
  return Number.isFinite(amount) ? amount : 0;
}

export function formatAmount(amount) {
  const numericAmount = Number(amount) || 0;
  if (numericAmount === 0) return "0";

  const absolute = Math.abs(numericAmount).toLocaleString("en-US");
  return `${numericAmount > 0 ? "+" : "-"}${absolute}`;
}

export function getQuickAmounts() {
  return [...QUICK_AMOUNTS];
}

export function deleteGame(state, gameId) {
  const gameExists = state.games.some((game) => game.id === gameId);
  if (!gameExists) return false;

  state.games = state.games.filter((game) => game.id !== gameId);
  state.entries = state.entries.filter((entry) => entry.gameId !== gameId);

  if (state.selectedGameId === gameId) {
    state.selectedGameId = sortGames(state.games)[0]?.id ?? null;
  }

  return true;
}

export function getGameParticipantIds(state, game) {
  if (Array.isArray(game.participantIds)) return game.participantIds;

  return state.entries
    .filter((entry) => entry.gameId === game.id)
    .map((entry) => entry.playerId);
}

export function isPlayerInGame(game, playerId) {
  return Array.isArray(game.participantIds) && game.participantIds.includes(playerId);
}

export function joinGame(state, gameId, playerId) {
  const game = state.games.find((item) => item.id === gameId);
  const playerExists = state.players.some((player) => player.id === playerId);
  if (!game || !playerExists) return false;

  if (!Array.isArray(game.participantIds)) {
    game.participantIds = getGameParticipantIds(state, game);
  }

  if (!game.participantIds.includes(playerId)) {
    game.participantIds.push(playerId);
  }

  upsertEntry(state, gameId, playerId, 0);
  return true;
}

export function upsertEntry(state, gameId, playerId, amount, donationAmount = undefined) {
  const game = state.games.find((item) => item.id === gameId);
  if (game && Array.isArray(game.participantIds) && !game.participantIds.includes(playerId)) {
    game.participantIds.push(playerId);
  }

  const parsedAmount = parseAmountInput(amount);
  const parsedDonation =
    donationAmount === undefined ? undefined : Math.max(0, parseAmountInput(donationAmount));
  const existingEntry = state.entries.find(
    (entry) => entry.gameId === gameId && entry.playerId === playerId
  );

  if (existingEntry) {
    existingEntry.amount = parsedAmount;
    if (parsedDonation !== undefined) {
      existingEntry.donationAmount = parsedDonation;
    }
    existingEntry.updatedAt = new Date().toISOString();
    return existingEntry;
  }

  const entry = {
    id: createId("entry"),
    gameId,
    playerId,
    amount: parsedAmount,
    donationAmount: parsedDonation ?? 0,
    note: "",
    updatedAt: new Date().toISOString()
  };
  state.entries.push(entry);
  return entry;
}

export function addPlayer(state, name) {
  const cleanName = String(name).trim();
  if (!cleanName) return null;

  const existingPlayer = state.players.find(
    (player) => player.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (existingPlayer) return existingPlayer;

  const player = {
    id: createId("player"),
    name: cleanName,
    createdAt: new Date().toISOString()
  };
  state.players.push(player);
  return player;
}

export function getGameEntries(state, gameId) {
  const game = state.games.find((item) => item.id === gameId);
  const participantIds = game ? getGameParticipantIds(state, game) : [];
  const players = participantIds.length
    ? state.players.filter((player) => participantIds.includes(player.id))
    : [];

  return players.map((player) => {
    const entry = state.entries.find(
      (item) => item.gameId === gameId && item.playerId === player.id
    );

    return {
      player,
      entry,
      amount: entry?.amount ?? 0,
      donationAmount: entry?.donationAmount ?? 0
    };
  });
}

export function getBalanceStatus(state, gameId) {
  const total = state.entries
    .filter((entry) => entry.gameId === gameId)
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    total,
    balanced: total === 0,
    adjustmentLabel: formatAmount(-total)
  };
}

export function getPlayerTotal(state, playerId) {
  return state.entries
    .filter((entry) => entry.playerId === playerId)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function getPlayerParticipationCount(state, playerId) {
  return state.games.filter((game) => getGameParticipantIds(state, game).includes(playerId))
    .length;
}

export function getTopSingleGameWins(state, limit = 3) {
  const gamesById = new Map(state.games.map((game) => [game.id, game]));
  const playersById = new Map(state.players.map((player) => [player.id, player]));

  return state.entries
    .filter((entry) => entry.amount > 0 && gamesById.has(entry.gameId) && playersById.has(entry.playerId))
    .map((entry) => ({
      playerName: playersById.get(entry.playerId).name,
      gameTitle: gamesById.get(entry.gameId).title,
      amount: entry.amount
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, limit);
}

export function getDonationLeaderboard(state, limit = 3) {
  const totals = new Map();

  for (const entry of state.entries) {
    const donationAmount = Math.max(0, parseAmountInput(entry.donationAmount ?? 0));
    if (donationAmount === 0) continue;
    totals.set(entry.playerId, (totals.get(entry.playerId) ?? 0) + donationAmount);
  }

  return state.players
    .map((player) => ({
      playerName: player.name,
      amount: totals.get(player.id) ?? 0
    }))
    .filter((row) => row.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, limit);
}

export function getGameSwingLeaders(state, gameId) {
  const rows = getGameEntries(state, gameId).filter(({ amount }) => amount !== 0);
  if (rows.length === 0) {
    return {
      biggestWinner: null,
      biggestLoser: null
    };
  }

  const biggestWinner = rows.reduce((winner, row) =>
    row.amount > winner.amount ? row : winner
  );
  const biggestLoser = rows.reduce((loser, row) =>
    row.amount < loser.amount ? row : loser
  );

  return {
    biggestWinner:
      biggestWinner.amount > 0
        ? { playerName: biggestWinner.player.name, amount: biggestWinner.amount }
        : null,
    biggestLoser:
      biggestLoser.amount < 0
        ? { playerName: biggestLoser.player.name, amount: biggestLoser.amount }
        : null
  };
}

export function getOpenGameForDate(state, date = todayISO()) {
  return state.games.find((game) => game.date === date && game.status === "open");
}

export function getGameForDate(state, date = todayISO()) {
  return state.games.find((game) => game.date === date);
}

export function sortGames(games) {
  return [...games].sort((left, right) => {
    const dateSort = right.date.localeCompare(left.date);
    if (dateSort !== 0) return dateSort;
    return right.createdAt.localeCompare(left.createdAt);
  });
}
