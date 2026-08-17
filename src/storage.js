import { createInitialState } from "./ledger.js";

const REMOTE_API_ORIGIN = "https://homegame-ledger.ablee.workers.dev";
const DEPLOYED_HOSTNAME = "homegame-ledger.ablee.workers.dev";

async function requestJson(path, options = {}) {
  const response = await fetch(`${getApiOrigin()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

function getApiOrigin() {
  return resolveApiOrigin(window.location.hostname);
}

export function resolveApiOrigin(hostname) {
  return hostname === DEPLOYED_HOSTNAME ? "" : REMOTE_API_ORIGIN;
}

export async function loadState() {
  try {
    const state = await requestJson("/api/state");
    return withLocalSelection(state);
  } catch (error) {
    console.warn(error);
    return withLocalSelection(createInitialState());
  }
}

export function rememberSelectedPlayer(playerId) {
  return playerId;
}

export async function createPlayer(name) {
  return withLocalSelection(
    await requestJson("/api/players", {
      method: "POST",
      body: JSON.stringify({ name })
    })
  );
}

export async function createGame(date, creatorPlayerId) {
  return withLocalSelection(
    await requestJson("/api/games", {
      method: "POST",
      body: JSON.stringify({ date, creatorPlayerId })
    })
  );
}

export async function joinRemoteGame(gameId, playerId) {
  return withLocalSelection(
    await requestJson(`/api/games/${gameId}/join`, {
      method: "POST",
      body: JSON.stringify({ playerId })
    })
  );
}

export async function saveEntry(gameId, playerId, amount, donationAmount) {
  return withLocalSelection(
    await requestJson("/api/entries", {
      method: "POST",
      body: JSON.stringify({ gameId, playerId, amount, donationAmount })
    })
  );
}

export async function updateGameStatus(gameId, status, selectedPlayerId) {
  return withLocalSelection(
    await requestJson(`/api/games/${gameId}/lock`, {
      method: "POST",
      body: JSON.stringify({ status, selectedPlayerId })
    })
  );
}

export async function deleteRemoteGame(gameId, selectedPlayerId) {
  return withLocalSelection(
    await requestJson(`/api/games/${gameId}`, {
      method: "DELETE",
      body: JSON.stringify({ selectedPlayerId })
    })
  );
}

function withLocalSelection(state) {
  if (!state.players.some((player) => player.id === state.selectedPlayerId)) {
    state.selectedPlayerId = null;
  }
  return state;
}
