/**
 * viem's multicall results carry a `status` field ("success" | "failure")
 * specifically so callers don't have to infer success from the shape of
 * `result`. Checking truthiness of `result` instead of `status` is the
 * wrong tool for this job: it misclassifies any falsy-but-valid return
 * value as a failure. The concrete case that bit this app is ERC-20
 * `decimals()` returning 0 - a valid value for some tokens - which reads
 * as falsy in JS and was being treated as "call failed."
 */
export type MulticallResult<T> = {
  status: "success" | "failure";
  result?: T;
};

export function isValidTokenMetadata(
  name: MulticallResult<string>,
  symbol: MulticallResult<string>,
  decimals: MulticallResult<number>
): boolean {
  return (
    name.status === "success" &&
    symbol.status === "success" &&
    decimals.status === "success"
  );
}