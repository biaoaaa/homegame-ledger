import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGame,
  createGameForDate,
  createInitialState,
  deleteGame,
  formatAmount,
  formatDateWithWeekday,
  formatGameTitleWithWeekday,
  getQuickAmounts,
  getBalanceStatus,
  getGameForDate,
  getGameEntries,
  getGameSwingLeaders,
  getDonationLeaderboard,
  getPlayerParticipationCount,
  getTopSingleGameWins,
  isPlayerInGame,
  joinGame,
  parseAmountInput,
  upsertEntry
} from "../src/ledger.js";

describe("ledger rules", () => {
  it("starts with Biao and Jiarou as default players", () => {
    const state = createInitialState();

    assert.deepEqual(
      state.players.map((player) => player.name),
      ["Biao", "Jiarou"]
    );
  });

  it("creates a game for a chosen date", () => {
    const game = createGame("2026-08-15");

    assert.equal(game.date, "2026-08-15");
    assert.equal(game.status, "open");
    assert.match(game.title, /Homegame/);
  });

  it("finds a game for a date even after it is locked", () => {
    const state = createInitialState();
    const game = createGame("2026-08-15");
    game.status = "locked";
    state.games.push(game);

    assert.equal(getGameForDate(state, "2026-08-15"), game);
  });

  it("creates multiple numbered games for the same date", () => {
    const state = createInitialState();

    const firstGame = createGameForDate(state, "2026-08-15");
    const secondGame = createGameForDate(state, "2026-08-15");
    const thirdGame = createGameForDate(state, "2026-08-15");

    assert.deepEqual(
      [firstGame.title, secondGame.title, thirdGame.title],
      ["2026-08-15 对局一", "2026-08-15 对局二", "2026-08-15 对局三"]
    );
    assert.equal(state.games.length, 3);
  });

  it("creates a game with the creator already participating", () => {
    const state = createInitialState();
    const creator = state.players[0];

    const game = createGameForDate(state, "2026-08-15", creator.id);

    assert.equal(isPlayerInGame(game, creator.id), true);
    assert.equal(isPlayerInGame(game, state.players[1].id), false);
  });

  it("lets a player enter a game before recording a result", () => {
    const state = createInitialState();
    const game = createGameForDate(state, "2026-08-15", state.players[0].id);
    const secondPlayer = state.players[1];

    const joined = joinGame(state, game.id, secondPlayer.id);

    assert.equal(joined, true);
    assert.equal(isPlayerInGame(game, secondPlayer.id), true);
    assert.deepEqual(
      getGameEntries(state, game.id).map(({ player }) => player.name),
      ["Biao", "Jiarou"]
    );
  });

  it("does not duplicate a player when entering the same game twice", () => {
    const state = createInitialState();
    const game = createGameForDate(state, "2026-08-15", state.players[0].id);

    joinGame(state, game.id, state.players[0].id);

    assert.deepEqual(game.participantIds, [state.players[0].id]);
  });

  it("counts how many games each player participated in", () => {
    const state = createInitialState();
    createGameForDate(state, "2026-08-15", state.players[0].id);
    const secondGame = createGameForDate(state, "2026-08-15", state.players[0].id);
    joinGame(state, secondGame.id, state.players[1].id);

    assert.equal(getPlayerParticipationCount(state, state.players[0].id), 2);
    assert.equal(getPlayerParticipationCount(state, state.players[1].id), 1);
  });

  it("parses common poker amount inputs", () => {
    assert.equal(parseAmountInput("+500"), 500);
    assert.equal(parseAmountInput("1000"), 1000);
    assert.equal(parseAmountInput("-2000"), -2000);
    assert.equal(parseAmountInput(" - 1,500 "), -1500);
  });

  it("formats positive, negative, and zero amounts", () => {
    assert.equal(formatAmount(500), "+500");
    assert.equal(formatAmount(-2000), "-2,000");
    assert.equal(formatAmount(0), "0");
  });

  it("formats dates with the weekday", () => {
    assert.equal(formatDateWithWeekday("2026-08-14"), "2026-08-14 周五");
    assert.equal(formatDateWithWeekday("bad-date"), "bad-date");
  });

  it("formats game titles with the weekday after the date", () => {
    assert.equal(
      formatGameTitleWithWeekday({ date: "2026-08-14", title: "2026-08-14 对局一" }),
      "2026-08-14 周五 对局一"
    );
  });

  it("recommends symmetric quick amount buttons", () => {
    assert.deepEqual(getQuickAmounts(), [-2000, -1000, -500, 500, 1000, 2000]);
  });

  it("updates one player's entry without duplicating rows", () => {
    const state = createInitialState();
    const game = createGame("2026-08-15");
    state.games.push(game);

    upsertEntry(state, game.id, state.players[0].id, 500);
    upsertEntry(state, game.id, state.players[0].id, 1000);

    assert.equal(state.entries.length, 1);
    assert.equal(state.entries[0].amount, 1000);
  });

  it("stores a player's final donation with their entry", () => {
    const state = createInitialState();
    const game = createGame("2026-08-15");
    state.games.push(game);

    upsertEntry(state, game.id, state.players[0].id, 500, 100);

    assert.equal(state.entries[0].donationAmount, 100);
  });

  it("reports the top three single-game wins", () => {
    const state = createInitialState();
    const thirdPlayer = { id: "player_c", name: "Cody", createdAt: new Date().toISOString() };
    const fourthPlayer = { id: "player_d", name: "Dylan", createdAt: new Date().toISOString() };
    state.players.push(thirdPlayer, fourthPlayer);
    const firstGame = createGameForDate(state, "2026-08-15");
    const secondGame = createGameForDate(state, "2026-08-15");

    upsertEntry(state, firstGame.id, state.players[0].id, 1200);
    upsertEntry(state, firstGame.id, state.players[1].id, -1200);
    upsertEntry(state, secondGame.id, thirdPlayer.id, 2500);
    upsertEntry(state, secondGame.id, fourthPlayer.id, 800);
    upsertEntry(state, secondGame.id, state.players[0].id, 1600);

    assert.deepEqual(getTopSingleGameWins(state), [
      { playerName: "Cody", gameTitle: "2026-08-15 周六 对局二", amount: 2500 },
      { playerName: "Biao", gameTitle: "2026-08-15 周六 对局二", amount: 1600 },
      { playerName: "Biao", gameTitle: "2026-08-15 周六 对局一", amount: 1200 }
    ]);
  });

  it("reports the top three total donations", () => {
    const state = createInitialState();
    const thirdPlayer = { id: "player_c", name: "Cody", createdAt: new Date().toISOString() };
    state.players.push(thirdPlayer);
    const firstGame = createGameForDate(state, "2026-08-15");
    const secondGame = createGameForDate(state, "2026-08-16");

    upsertEntry(state, firstGame.id, state.players[0].id, 1000, 100);
    upsertEntry(state, secondGame.id, state.players[0].id, 800, 200);
    upsertEntry(state, firstGame.id, state.players[1].id, 500, 50);
    upsertEntry(state, secondGame.id, thirdPlayer.id, 1200, 400);

    assert.deepEqual(getDonationLeaderboard(state), [
      { playerName: "Cody", amount: 400 },
      { playerName: "Biao", amount: 300 },
      { playerName: "Jiarou", amount: 50 }
    ]);
  });

  it("deletes a game with its entries and selects a remaining game", () => {
    const state = createInitialState();
    const firstGame = createGameForDate(state, "2026-08-15");
    const secondGame = createGameForDate(state, "2026-08-15");
    state.selectedGameId = secondGame.id;

    upsertEntry(state, firstGame.id, state.players[0].id, 500);
    upsertEntry(state, secondGame.id, state.players[0].id, 1000);

    const deleted = deleteGame(state, secondGame.id);

    assert.equal(deleted, true);
    assert.deepEqual(
      state.games.map((game) => game.id),
      [firstGame.id]
    );
    assert.deepEqual(
      state.entries.map((entry) => entry.gameId),
      [firstGame.id]
    );
    assert.equal(state.selectedGameId, firstGame.id);
  });

  it("returns false when deleting a game that does not exist", () => {
    const state = createInitialState();

    assert.equal(deleteGame(state, "missing"), false);
  });

  it("reports whether a game balances to zero", () => {
    const state = createInitialState();
    const game = createGame("2026-08-15");
    state.games.push(game);

    upsertEntry(state, game.id, state.players[0].id, 1000);
    upsertEntry(state, game.id, state.players[1].id, -500);

    assert.deepEqual(getBalanceStatus(state, game.id), {
      total: 500,
      balanced: false,
      adjustmentLabel: "-500"
    });

    upsertEntry(state, game.id, state.players[1].id, -1000);

    assert.deepEqual(getBalanceStatus(state, game.id), {
      total: 0,
      balanced: true,
      adjustmentLabel: "0"
    });
  });

  it("reports the biggest winner and loser in one game", () => {
    const state = createInitialState();
    const thirdPlayer = { id: "player_c", name: "Cody", createdAt: new Date().toISOString() };
    state.players.push(thirdPlayer);
    const game = createGame("2026-08-15");
    state.games.push(game);

    upsertEntry(state, game.id, state.players[0].id, 1500);
    upsertEntry(state, game.id, state.players[1].id, -2000);
    upsertEntry(state, game.id, thirdPlayer.id, 500);

    assert.deepEqual(getGameSwingLeaders(state, game.id), {
      biggestWinner: { playerName: "Biao", amount: 1500 },
      biggestLoser: { playerName: "Jiarou", amount: -2000 }
    });
  });

  it("uses higher donation as the biggest winner tie breaker", () => {
    const state = createInitialState();
    const thirdPlayer = { id: "player_c", name: "Cody", createdAt: new Date().toISOString() };
    state.players.push(thirdPlayer);
    const game = createGame("2026-08-15");
    state.games.push(game);

    upsertEntry(state, game.id, state.players[0].id, 1000, 100);
    upsertEntry(state, game.id, thirdPlayer.id, 1000, 800);
    upsertEntry(state, game.id, state.players[1].id, -2000);

    assert.deepEqual(getGameSwingLeaders(state, game.id), {
      biggestWinner: { playerName: "Cody", amount: 1000 },
      biggestLoser: { playerName: "Jiarou", amount: -2000 }
    });
  });
});
