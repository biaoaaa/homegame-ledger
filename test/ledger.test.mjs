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
  getPlayerStats,
  getPlayerParticipationCount,
  getRecentGameTrend,
  getRecentGameTotals,
  getTopSingleGameWins,
  isValidAmountInput,
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

  it("reports a player's personal summary and top three wins", () => {
    const state = createInitialState();
    const player = state.players[0];
    const games = [
      createGameForDate(state, "2026-08-12", player.id),
      createGameForDate(state, "2026-08-13", player.id),
      createGameForDate(state, "2026-08-14", player.id),
      createGameForDate(state, "2026-08-15", player.id),
      createGameForDate(state, "2026-08-16", player.id)
    ];

    upsertEntry(state, games[0].id, player.id, 500, 100);
    upsertEntry(state, games[1].id, player.id, -200, 0);
    upsertEntry(state, games[2].id, player.id, 1200, 300);
    upsertEntry(state, games[3].id, player.id, 800, 50);
    upsertEntry(state, games[4].id, player.id, 0, 0);

    assert.deepEqual(getPlayerStats(state, player.id), {
      totalDonation: 450,
      gamesPlayed: 5,
      biggestWinnerCount: 3,
      topWins: [
        { gameTitle: "2026-08-14 周五 对局一", amount: 1200 },
        { gameTitle: "2026-08-15 周六 对局一", amount: 800 },
        { gameTitle: "2026-08-12 周三 对局一", amount: 500 }
      ]
    });
  });

  it("parses common poker amount inputs", () => {
    assert.equal(parseAmountInput("+500"), 500);
    assert.equal(parseAmountInput("1000"), 1000);
    assert.equal(parseAmountInput("-2000"), -2000);
    assert.equal(parseAmountInput(" - 1,500 "), -1500);
  });

  it("validates amount inputs before saving", () => {
    assert.equal(isValidAmountInput("+500"), true);
    assert.equal(isValidAmountInput("-2,000"), true);
    assert.equal(isValidAmountInput(" 1 000 "), true);
    assert.equal(isValidAmountInput(""), true);
    assert.equal(isValidAmountInput("abc"), false);
    assert.equal(isValidAmountInput("五百"), false);
    assert.equal(isValidAmountInput("500abc"), false);
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

  it("reports the top five single-game wins", () => {
    const state = createInitialState();
    const thirdPlayer = { id: "player_c", name: "Cody", createdAt: new Date().toISOString() };
    const fourthPlayer = { id: "player_d", name: "Dylan", createdAt: new Date().toISOString() };
    const fifthPlayer = { id: "player_e", name: "Erin", createdAt: new Date().toISOString() };
    state.players.push(thirdPlayer, fourthPlayer, fifthPlayer);
    const firstGame = createGameForDate(state, "2026-08-15");
    const secondGame = createGameForDate(state, "2026-08-15");

    upsertEntry(state, firstGame.id, state.players[0].id, 1200);
    upsertEntry(state, firstGame.id, state.players[1].id, -1200);
    upsertEntry(state, secondGame.id, thirdPlayer.id, 2500);
    upsertEntry(state, secondGame.id, fourthPlayer.id, 800);
    upsertEntry(state, firstGame.id, fifthPlayer.id, 600);
    upsertEntry(state, secondGame.id, state.players[0].id, 1600);

    assert.deepEqual(getTopSingleGameWins(state), [
      { playerName: "Cody", gameTitle: "2026-08-15 周六 对局二", amount: 2500 },
      { playerName: "Biao", gameTitle: "2026-08-15 周六 对局二", amount: 1600 },
      { playerName: "Biao", gameTitle: "2026-08-15 周六 对局一", amount: 1200 },
      { playerName: "Dylan", gameTitle: "2026-08-15 周六 对局二", amount: 800 },
      { playerName: "Erin", gameTitle: "2026-08-15 周六 对局一", amount: 600 }
    ]);
  });

  it("reports the top five total donations", () => {
    const state = createInitialState();
    const thirdPlayer = { id: "player_c", name: "Cody", createdAt: new Date().toISOString() };
    const fourthPlayer = { id: "player_d", name: "Dylan", createdAt: new Date().toISOString() };
    const fifthPlayer = { id: "player_e", name: "Erin", createdAt: new Date().toISOString() };
    state.players.push(thirdPlayer, fourthPlayer, fifthPlayer);
    const firstGame = createGameForDate(state, "2026-08-15");
    const secondGame = createGameForDate(state, "2026-08-16");

    upsertEntry(state, firstGame.id, state.players[0].id, 1000, 100);
    upsertEntry(state, secondGame.id, state.players[0].id, 800, 200);
    upsertEntry(state, firstGame.id, state.players[1].id, 500, 50);
    upsertEntry(state, secondGame.id, thirdPlayer.id, 1200, 400);
    upsertEntry(state, firstGame.id, fourthPlayer.id, 0, 40);
    upsertEntry(state, secondGame.id, fifthPlayer.id, 0, 30);

    assert.deepEqual(getDonationLeaderboard(state), [
      { playerName: "Cody", amount: 400 },
      { playerName: "Biao", amount: 300 },
      { playerName: "Jiarou", amount: 50 },
      { playerName: "Dylan", amount: 40 },
      { playerName: "Erin", amount: 30 }
    ]);
  });

  it("reports cumulative net results from only the most recent ten games", () => {
    const state = createInitialState();
    const thirdPlayer = { id: "player_c", name: "Cody", createdAt: new Date().toISOString() };
    state.players.push(thirdPlayer);

    const games = Array.from({ length: 11 }, (_, index) =>
      createGameForDate(state, `2026-08-${String(index + 1).padStart(2, "0")}`)
    );

    upsertEntry(state, games[0].id, state.players[0].id, 9999);
    upsertEntry(state, games[0].id, state.players[1].id, -9999);

    for (const game of games.slice(1)) {
      upsertEntry(state, game.id, state.players[0].id, 100);
      upsertEntry(state, game.id, state.players[1].id, -50);
    }
    upsertEntry(state, games[10].id, thirdPlayer.id, 50);
    upsertEntry(state, games[9].id, thirdPlayer.id, 50);

    assert.deepEqual(getRecentGameTotals(state, 10), [
      { playerName: "Biao", amount: 1000, gamesPlayed: 10 },
      { playerName: "Cody", amount: 100, gamesPlayed: 2 },
      { playerName: "Jiarou", amount: -500, gamesPlayed: 10 }
    ]);
  });

  it("builds recent ten cumulative trend lines and carries missed games forward", () => {
    const state = createInitialState();
    const thirdPlayer = { id: "player_c", name: "Cody", createdAt: new Date().toISOString() };
    const absentPlayer = { id: "player_d", name: "Absent", createdAt: new Date().toISOString() };
    state.players.push(thirdPlayer, absentPlayer);

    const games = Array.from({ length: 11 }, (_, index) =>
      createGameForDate(state, `2026-08-${String(index + 1).padStart(2, "0")}`)
    );

    upsertEntry(state, games[0].id, absentPlayer.id, 999);
    upsertEntry(state, games[1].id, state.players[0].id, 100);
    upsertEntry(state, games[2].id, state.players[0].id, -50);
    upsertEntry(state, games[2].id, thirdPlayer.id, 200);
    upsertEntry(state, games[4].id, thirdPlayer.id, -25);

    assert.deepEqual(getRecentGameTrend(state, 10), {
      games: games.slice(1).map((game) => ({
        id: game.id,
        label: formatGameTitleWithWeekday(game)
      })),
      series: [
        {
          playerId: thirdPlayer.id,
          playerName: "Cody",
          total: 175,
          points: [0, 200, 200, 175, 175, 175, 175, 175, 175, 175]
        },
        {
          playerId: state.players[0].id,
          playerName: "Biao",
          total: 50,
          points: [100, 50, 50, 50, 50, 50, 50, 50, 50, 50]
        }
      ]
    });
  });

  it("can limit recent ten trend lines to selected players", () => {
    const state = createInitialState();
    const thirdPlayer = { id: "player_c", name: "Cody", createdAt: new Date().toISOString() };
    state.players.push(thirdPlayer);

    const firstGame = createGameForDate(state, "2026-08-20");
    const secondGame = createGameForDate(state, "2026-08-21");
    upsertEntry(state, firstGame.id, state.players[0].id, 100);
    upsertEntry(state, secondGame.id, state.players[1].id, 200);
    upsertEntry(state, secondGame.id, thirdPlayer.id, 300);

    assert.deepEqual(
      getRecentGameTrend(state, 10, [state.players[0].id, thirdPlayer.id]).series.map(
        (row) => row.playerName
      ),
      ["Cody", "Biao"]
    );
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
