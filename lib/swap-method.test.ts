import { describe, expect, it } from "vitest";
import { getSwapMethods } from "./swap-method";

describe("getSwapMethods", () => {
  it("uses the exact-input native-currency function for native -> token trades", () => {
    const [primary, fallback] = getSwapMethods(true, false);
    expect(primary).toBe("swapExactETHForTokens");
    expect(primary).not.toBe("swapETHForExactTokens");
    expect(fallback).toBe("swapExactETHForTokensSupportingFeeOnTransferTokens");
  });

  it("uses the exact-input native-currency function for token -> native trades", () => {
    const [primary, fallback] = getSwapMethods(false, true);
    expect(primary).toBe("swapExactTokensForETH");
    expect(fallback).toBe("swapExactTokensForETHSupportingFeeOnTransferTokens");
  });

  it("uses the exact-input token function for token -> token trades", () => {
    const [primary, fallback] = getSwapMethods(false, false);
    expect(primary).toBe("swapExactTokensForTokens");
    expect(fallback).toBe("swapExactTokensForTokensSupportingFeeOnTransferTokens");
  });

  it("every candidate method is an exact-input (swapExact...) variant", () => {
    const allCases: [boolean, boolean][] = [[true, false], [false, true], [false, false]];
    for (const [fromIsNative, toIsNative] of allCases) {
      for (const method of getSwapMethods(fromIsNative, toIsNative)) {
        expect(method.startsWith("swapExact")).toBe(true);
      }
    }
  });
});
