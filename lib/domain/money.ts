/**
 * Money in HostelFlow is an integer number of Pakistani rupees. Always.
 *
 * PKR has no circulating subunit — nobody pays 7,500.25 — so the whole rupee is the minor
 * unit and there is nothing to round. Every monetary column is `Int`, every monetary field
 * is suffixed `Pkr`, and no binary floating-point value is ever allowed to represent an
 * amount. `0.1 + 0.2 !== 0.3` is not an acceptable property for a deposit ledger.
 *
 * These helpers are pure and run on both the server and the client.
 */

/** Thrown when a value that must be an integer rupee amount is not one. */
export class MoneyError extends Error {
  /**
   * Bad input, not a server fault.
   *
   * Without a status these reached `statusForError` as ordinary errors and became 500s,
   * so a manager who typed "7500.60" was told something went wrong on the server instead
   * of being told the amount must be whole rupees — the exact message this class exists
   * to carry.
   */
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/**
 * Asserts that a value is a usable rupee amount: a finite, safe integer.
 * Rejects `NaN`, `Infinity`, decimals and values beyond `Number.MAX_SAFE_INTEGER`.
 */
export function assertPkr(value: number, label = "amount"): number {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`${label} must be a finite number, received ${String(value)}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(
      `${label} must be a whole number of rupees, received ${String(value)}`,
    );
  }
  return value;
}

/** Asserts an amount is a whole number of rupees and not negative. */
export function assertNonNegativePkr(value: number, label = "amount"): number {
  assertPkr(value, label);
  if (value < 0) {
    throw new MoneyError(`${label} must not be negative, received ${String(value)}`);
  }
  return value;
}

/** Asserts an amount is a whole number of rupees and strictly positive. */
export function assertPositivePkr(value: number, label = "amount"): number {
  assertNonNegativePkr(value, label);
  if (value === 0) {
    throw new MoneyError(`${label} must be greater than zero`);
  }
  return value;
}

/**
 * Parses user input into rupees. Accepts `"7500"`, `"7,500"`, `"Rs 7,500"` and `" 7500 "`.
 * Rejects anything with a fractional part rather than silently rounding it, because
 * silently turning 7500.60 into 7501 is how ledgers stop reconciling.
 */
export function parsePkr(input: string | number, label = "amount"): number {
  if (typeof input === "number") return assertPkr(input, label);

  const cleaned = input.replace(/[\s,]/g, "").replace(/^Rs\.?/i, "");
  if (cleaned === "" || !/^-?\d+$/.test(cleaned)) {
    throw new MoneyError(
      `${label} must be a whole number of rupees, received "${input}"`,
    );
  }
  return assertPkr(Number(cleaned), label);
}

/** Adds rupee amounts, validating each one. */
export function sumPkr(amounts: readonly number[], label = "amount"): number {
  return amounts.reduce<number>((total, amount) => total + assertPkr(amount, label), 0);
}

/** Subtracts, never dropping below zero. Used for "how much is still owed". */
export function remainingPkr(totalPkr: number, paidPkr: number): number {
  assertNonNegativePkr(totalPkr, "total");
  assertNonNegativePkr(paidPkr, "paid");
  return Math.max(0, totalPkr - paidPkr);
}

/**
 * Splits a payment across outstanding amounts, oldest first, without ever over-allocating.
 * Returns what each target receives plus whatever is left unapplied.
 *
 * Partial payment falls out of this naturally: a payment smaller than the first target
 * simply allocates less than that target's outstanding balance.
 */
export function allocatePkr(
  paymentPkr: number,
  targets: readonly { id: string; outstandingPkr: number }[],
): { allocations: { id: string; amountPkr: number }[]; unappliedPkr: number } {
  assertNonNegativePkr(paymentPkr, "payment");

  let remaining = paymentPkr;
  const allocations: { id: string; amountPkr: number }[] = [];

  for (const target of targets) {
    assertNonNegativePkr(target.outstandingPkr, `outstanding for ${target.id}`);
    if (remaining === 0) break;

    const amountPkr = Math.min(remaining, target.outstandingPkr);
    if (amountPkr > 0) {
      allocations.push({ id: target.id, amountPkr });
      remaining -= amountPkr;
    }
  }

  return { allocations, unappliedPkr: remaining };
}

/** `Rs 9,000`. The display format used everywhere in the interface. */
export function formatPkr(value: number): string {
  assertPkr(value, "amount");
  return `Rs ${value.toLocaleString("en-US")}`;
}
