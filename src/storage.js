import { createInitialState } from "./ledger.js";

const STORAGE_KEY = "homegame-poker-tracker:v1";

export function loadState() {
  try {
    const rawState = localStorage.getItem(STORAGE_KEY);
    if (!rawState) return createInitialState();

    const parsedState = JSON.parse(rawState);
    if (!Array.isArray(parsedState.players) || !Array.isArray(parsedState.games)) {
      return createInitialState();
    }

    return {
      players: parsedState.players,
      games: parsedState.games,
      entries: Array.isArray(parsedState.entries) ? parsedState.entries : [],
      selectedPlayerId: parsedState.selectedPlayerId ?? null,
      selectedGameId: parsedState.selectedGameId ?? null
    };
  } catch {
    return createInitialState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
