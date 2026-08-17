import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveApiOrigin } from "../src/storage.js";

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
