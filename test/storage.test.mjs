import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { applyStoredDonations, applySubmittedDonation, resolveApiOrigin } from "../src/storage.js";

describe("storage api origin", () => {
  it("uses the deployed worker api for localhost preview", () => {
    assert.equal(
      resolveApiOrigin("localhost"),
      "https://homegame-ledger.ablee.workers.dev"
    );
    assert.equal(
      resolveApiOrigin("127.0.0.1"),
      "https://homegame-ledger.ablee.workers.dev"
    );
  });

  it("uses the deployed worker api for phone LAN preview", () => {
    assert.equal(
      resolveApiOrigin("10.0.0.81"),
      "https://homegame-ledger.ablee.workers.dev"
    );
  });

  it("uses same-origin api on the deployed worker", () => {
    assert.equal(resolveApiOrigin("homegame-ledger.ablee.workers.dev"), "");
  });
});

describe("submitted donation fallback", () => {
  it("adds the submitted donation when an older api response omits it", () => {
    const state = {
      entries: [
        {
          gameId: "game_1",
          playerId: "player_1",
          amount: 500
        }
      ]
    };

    assert.deepEqual(applySubmittedDonation(state, "game_1", "player_1", 800), {
      entries: [
        {
          gameId: "game_1",
          playerId: "player_1",
          amount: 500,
          donationAmount: 800
        }
      ]
    });
  });

  it("does not overwrite a newer api response that already includes donation data", () => {
    const state = {
      entries: [
        {
          gameId: "game_1",
          playerId: "player_1",
          amount: 500,
          donationAmount: 300
        }
      ]
    };

    assert.deepEqual(applySubmittedDonation(state, "game_1", "player_1", 800), state);
  });

  it("restores saved donation fallback after another api action reloads state", () => {
    global.window = {
      localStorage: {
        getItem: () => JSON.stringify({ "game_1:player_1": 800 })
      }
    };
    const state = {
      entries: [
        {
          gameId: "game_1",
          playerId: "player_1",
          amount: 500
        }
      ]
    };

    assert.deepEqual(applyStoredDonations(state), {
      entries: [
        {
          gameId: "game_1",
          playerId: "player_1",
          amount: 500,
          donationAmount: 800
        }
      ]
    });

    delete global.window;
  });
});

describe("hidden players", () => {
  it("keeps hidden players in state so historical entries can still show their names", async () => {
    const { applyStoredDonations } = await import("../src/storage.js");
    const state = {
      players: [{ id: "p1", name: "Old Player", hiddenAt: "2026-08-22T00:00:00.000Z" }],
      entries: [{ gameId: "g1", playerId: "p1", amount: 100 }],
      selectedPlayerId: null
    };

    assert.equal(applyStoredDonations(state).players[0].hiddenAt, "2026-08-22T00:00:00.000Z");
  });

  it("exposes a restore player operation", async () => {
    const source = readFileSync(new URL("../src/storage.js", import.meta.url), "utf8");

    assert.equal(source.includes("export async function restoreRemotePlayer"), true);
    assert.equal(source.includes("/restore"), true);
  });
});
