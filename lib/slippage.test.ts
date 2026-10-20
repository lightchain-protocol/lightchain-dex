import { describe, expect, it } from "vitest";
import {
  DEFAULT_SLIPPAGE,
  DEFAULT_TX_DEADLINE,
  MAX_SLIPPAGE,
  MAX_TX_DEADLINE,
  applySlippage,
  applySlippageToRatio,
  deadlineFrom,
  normalizeSlippage,
  normalizeTxDeadline,
  slippageBps,
} from "./slippage";

describe("applySlippage", () => {
  it("matches the previous result for the preset values", () => {
    const amount = 1_000_000n;
    expect(applySlippage(amount, 0.1)).toBe(999_000n);
    expect(applySlippage(amount, 0.5)).toBe(995_000n);
    expect(applySlippage(amount, 1)).toBe(990_000n);
  });

  it("does not throw for values that made BigInt() throw before", () => {
    // (100 - s) * 100 was not an integer for these, so BigInt() threw a RangeError.
    for (const s of [0.375, 0.123, 2.333, 18.1, 18.15, 49.99]) {
      expect(() => applySlippage(10n ** 18n, s)).not.toThrow();
    }
    expect(applySlippage(1_000_000n, 0.375)).toBe(996_200n); // rounded to 0.38%
  });

  it("never sets the minimum to zero or above the quote", () => {
    expect(applySlippage(1_000_000n, 100)).toBe(500_000n); // clamped to 50%
    expect(applySlippage(1_000_000n, 101)).toBe(500_000n);
    expect(applySlippage(1_000_000n, -1)).toBe(1_000_000n); // clamped to 0%
  });

  it("falls back to the default for values that are not numbers", () => {
    expect(slippageBps(Number.NaN)).toBe(slippageBps(DEFAULT_SLIPPAGE));
    expect(slippageBps(undefined)).toBe(slippageBps(DEFAULT_SLIPPAGE));
    expect(slippageBps("abc")).toBe(slippageBps(DEFAULT_SLIPPAGE));
  });
});

describe("applySlippageToRatio", () => {
  it("computes the remove-liquidity minimum as before for preset values", () => {
    const liquidity = 500n;
    const reserve = 10_000n;
    const totalSupply = 1_000n;
    // liquidity * reserve / totalSupply = 5000, minus 0.5%
    expect(applySlippageToRatio(liquidity * reserve, totalSupply, 0.5)).toBe(4_975n);
  });

  it("does not throw for fractional basis points", () => {
    expect(() => applySlippageToRatio(10n ** 30n, 10n ** 12n, 0.375)).not.toThrow();
  });
});

describe("normalizeSlippage", () => {
  it("clamps and rounds to one basis point", () => {
    expect(normalizeSlippage(0.375)).toBe(0.38);
    expect(normalizeSlippage(0.5)).toBe(0.5);
    expect(normalizeSlippage(0)).toBe(0);
    expect(normalizeSlippage(80)).toBe(MAX_SLIPPAGE);
    expect(normalizeSlippage(-3)).toBe(0);
    expect(normalizeSlippage(Infinity)).toBe(DEFAULT_SLIPPAGE);
  });
});

describe("normalizeTxDeadline / deadlineFrom", () => {
  it("never produces a deadline that has already passed", () => {
    expect(normalizeTxDeadline(0)).toBe(DEFAULT_TX_DEADLINE);
    expect(normalizeTxDeadline("")).toBe(DEFAULT_TX_DEADLINE);
    expect(normalizeTxDeadline(-5)).toBe(DEFAULT_TX_DEADLINE);
    expect(normalizeTxDeadline(Number.NaN)).toBe(DEFAULT_TX_DEADLINE);
    expect(deadlineFrom(1_000n, 0)).toBe(1_000n + BigInt(DEFAULT_TX_DEADLINE * 60));
  });

  it("keeps valid values and clamps extremes", () => {
    expect(normalizeTxDeadline(20)).toBe(20);
    expect(normalizeTxDeadline(0.4)).toBe(1);
    expect(normalizeTxDeadline(2.6)).toBe(3);
    expect(normalizeTxDeadline(1e9)).toBe(MAX_TX_DEADLINE);
    expect(deadlineFrom(1_000, 20)).toBe(2_200n);
  });
});
