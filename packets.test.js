const assert = require("assert");
const {ackCmd} = require("./packets");

describe("packets.js", function () {
  describe("ackCmd", function () {
    it("gets the correct checksum", function () {
      assert.deepStrictEqual(ackCmd(), new Uint8Array([0xf0, 0xa0, 0x01, 0x01, 0x92]))
    });
  });
});