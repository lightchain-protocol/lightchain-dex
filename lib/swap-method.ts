export function getSwapMethods(
  fromIsNative: boolean,
  toIsNative: boolean
): [string, string] {
  if (fromIsNative) {
    return [
      "swapExactETHForTokens",
      "swapExactETHForTokensSupportingFeeOnTransferTokens",
    ];
  }

  if (toIsNative) {
    return [
      "swapExactTokensForETH",
      "swapExactTokensForETHSupportingFeeOnTransferTokens",
    ];
  }

  return [
    "swapExactTokensForTokens",
    "swapExactTokensForTokensSupportingFeeOnTransferTokens",
  ];
}
