import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applySubmittedDonation, resolveApiOrigin } from "../src/storage.js";

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
});
