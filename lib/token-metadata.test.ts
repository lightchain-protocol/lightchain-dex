import { describe, expect, it } from "vitest";
import { isValidTokenMetadata } from "./token-metadata";

const success = <T>(result: T) => ({ status: "success" as const, result });
const failure = () => ({ status: "failure" as const, result: undefined });

describe("isValidTokenMetadata", () => {
  it("accepts a token whose decimals() call succeeded and returned 0", () => {
    // Regression test: this previously read as invalid because 0 is falsy
    // in JS, even though the call itself succeeded and 0 decimals is a
    // legitimate value for some real ERC-20 tokens.
    const valid = isValidTokenMetadata(
      success("Zero Decimal Token"),
      success("ZDT"),
      success(0)
    );
    expect(valid).toBe(true);
  });

  it("accepts a normal token with typical metadata", () => {
    const valid = isValidTokenMetadata(
      success("Tether USD"),
      success("USDT"),
      success(18)
    );
    expect(valid).toBe(true);
  });

  it("rejects when the decimals() call actually failed", () => {
    const valid = isValidTokenMetadata(success("Some Token"), success("TKN"), failure());
    expect(valid).toBe(false);
  });

  it("rejects when the name() call actually failed", () => {
    const valid = isValidTokenMetadata(failure(), success("TKN"), success(18));
    expect(valid).toBe(false);
  });

  it("rejects when the symbol() call actually failed", () => {
    const valid = isValidTokenMetadata(success("Some Token"), failure(), success(18));
    expect(valid).toBe(false);
  });

  it("rejects when every call failed (address is not an ERC-20 at all)", () => {
    const valid = isValidTokenMetadata(failure(), failure(), failure());
    expect(valid).toBe(false);
  });
});