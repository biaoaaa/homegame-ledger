import { createInitialState } from "./ledger.js";

const REMOTE_API_ORIGIN = "https://homegame-ledger.ablee.workers.dev";
const DEPLOYED_HOSTNAME = "homegame-ledger.ablee.workers.dev";
const DONATION_FALLBACK_KEY = "homegame-ledger:donations";
const SELECTED_PLAYER_KEY = "homegame-ledger:selected-player";

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
  try {
    if (playerId) {
      window.sessionStorage?.setItem(SELECTED_PLAYER_KEY, playerId);
    } else {
      window.sessionStorage?.removeItem(SELECTED_PLAYER_KEY);
    }
  } catch {
    // Player selection is best-effort session state.
  }
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
    applySubmittedDonation(
      await requestJson("/api/entries", {
        method: "POST",
        body: JSON.stringify({ gameId, playerId, amount, donationAmount })
      }),
      gameId,
      playerId,
      donationAmount
    )
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

export async function hideRemotePlayer(playerId) {
  return withLocalSelection(
    await requestJson(`/api/players/${playerId}/hide`, {
      method: "POST"
    })
  );
}

export async function restoreRemotePlayer(playerId) {
  return withLocalSelection(
    await requestJson(`/api/players/${playerId}/restore`, {
      method: "POST"
    })
  );
}

function withLocalSelection(state) {
  applyStoredDonations(state);
  state.selectedPlayerId = readSelectedPlayer() || state.selectedPlayerId;
  if (!state.players.some((player) => player.id === state.selectedPlayerId)) {
    state.selectedPlayerId = null;
  }
  return state;
}

function readSelectedPlayer() {
  try {
    return window.sessionStorage?.getItem(SELECTED_PLAYER_KEY) || null;
  } catch {
    return null;
  }
}

export function applySubmittedDonation(state, gameId, playerId, donationAmount) {
  const parsedDonation = Math.max(0, Number.parseInt(donationAmount, 10) || 0);
  rememberDonationFallback(gameId, playerId, parsedDonation);
  if (!state?.entries) return state;

  const entry = state.entries.find(
    (item) => item.gameId === gameId && item.playerId === playerId
  );
  if (!entry || Object.hasOwn(entry, "donationAmount")) return state;

  entry.donationAmount = parsedDonation;
  return state;
}

export function applyStoredDonations(state) {
  const donations = readDonationFallbacks();
  if (!state?.entries || Object.keys(donations).length === 0) return state;

  for (const entry of state.entries) {
    if (Object.hasOwn(entry, "donationAmount")) continue;
    const donationAmount = donations[donationKey(entry.gameId, entry.playerId)];
    if (donationAmount > 0) {
      entry.donationAmount = donationAmount;
    }
  }

  return state;
}

function rememberDonationFallback(gameId, playerId, donationAmount) {
  try {
    const donations = readDonationFallbacks();
    if (donationAmount > 0) {
      donations[donationKey(gameId, playerId)] = donationAmount;
    } else {
      delete donations[donationKey(gameId, playerId)];
    }
    window.localStorage?.setItem(DONATION_FALLBACK_KEY, JSON.stringify(donations));
  } catch {
    // Local fallback is best-effort; database saves still run without it.
  }
}

function readDonationFallbacks() {
  try {
    return JSON.parse(window.localStorage?.getItem(DONATION_FALLBACK_KEY) || "{}");
  } catch {
    return {};
  }
}

function donationKey(gameId, playerId) {
  return `${gameId}:${playerId}`;
}
