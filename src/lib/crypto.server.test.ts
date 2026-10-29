import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt, signState, verifyState } from "./crypto.server";

beforeAll(() => {
  process.env["TOKEN_ENCRYPTION_KEY"] = randomBytes(32).toString("base64");
});

describe("token encryption", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encrypt("refresh-token");
    expect(a).not.toBe(encrypt("refresh-token"));
    expect(decrypt(a)).toBe("refresh-token");
  });
  it("rejects tampered ciphertext", () => {
    const [iv, tag, data] = encrypt("secret").split(".");
    const flipped = Buffer.from(data!, "base64url");
    flipped[0]! ^= 1;
    expect(() => decrypt([iv, tag, flipped.toString("base64url")].join("."))).toThrow();
  });
});

describe("OAuth state", () => {
  it("returns the user for a valid state", () => {
    expect(verifyState(signState("user-1"))).toBe("user-1");
  });
  it("rejects a forged signature", () => {
    const [body] = signState("user-1").split(".");
    expect(verifyState(`${body}.forged`)).toBeNull();
  });
  it("rejects an expired state", () => {
    const now = Date.now();
    expect(verifyState(signState("user-1", 1000, now), now + 2000)).toBeNull();
  });
});
