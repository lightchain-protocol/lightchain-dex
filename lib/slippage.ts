// Slippage and deadline settings come from a free-text number input and are
// persisted in localStorage, so they can hold anything: 0.375, 101, -1, an empty
// string read as 0. Every transaction normalizes them here first, and the
// minimum amounts are computed in whole basis points, so a fractional value can
// never reach BigInt() (which throws on non-integers).

export const DEFAULT_SLIPPAGE = 0.5;
export const MIN_SLIPPAGE = 0;
export const MAX_SLIPPAGE = 50;
// Above this the settings show a warning that the trade could fill far below the quote.
export const HIGH_SLIPPAGE = 5;

export const DEFAULT_TX_DEADLINE = 20;
export const MIN_TX_DEADLINE = 1;
export const MAX_TX_DEADLINE = 4320; // three days

const BPS = 10_000n;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * A slippage tolerance in percent that is safe to use: finite, within
 * [MIN_SLIPPAGE, MAX_SLIPPAGE] and rounded to two decimals (one basis point).
 * Anything that is not a finite number falls back to DEFAULT_SLIPPAGE.
 */
export function normalizeSlippage(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SLIPPAGE;
  return Math.round(clamp(n, MIN_SLIPPAGE, MAX_SLIPPAGE) * 100) / 100;
}

/**
 * A transaction deadline in whole minutes within [MIN_TX_DEADLINE,
 * MAX_TX_DEADLINE]. Zero, empty or invalid input falls back to the default
 * rather than producing a deadline that has already passed.
 */
export function normalizeTxDeadline(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TX_DEADLINE;
  return Math.round(clamp(n, MIN_TX_DEADLINE, MAX_TX_DEADLINE));
}

/** The share of an amount kept after slippage, in basis points (10000 = 100%). */
export function slippageBps(slippage: unknown): bigint {
  return BPS - BigInt(Math.round(normalizeSlippage(slippage) * 100));
}

/** The minimum acceptable amount for `amount` at the given slippage tolerance. */
export function applySlippage(amount: bigint, slippage: unknown): bigint {
  return (amount * slippageBps(slippage)) / BPS;
}

/** The minimum of `numerator / denominator` at the given slippage tolerance. */
export function applySlippageToRatio(
  numerator: bigint,
  denominator: bigint,
  slippage: unknown
): bigint {
  return (numerator * slippageBps(slippage)) / (denominator * BPS);
}

/** A deadline `minutes` after `nowSeconds`, in unix seconds. */
export function deadlineFrom(nowSeconds: bigint | number, minutes: unknown): bigint {
  return BigInt(nowSeconds) + BigInt(normalizeTxDeadline(minutes) * 60);
}
