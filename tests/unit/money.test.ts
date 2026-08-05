import { describe, expect, it } from "vitest";
import {
  MoneyError,
  allocatePkr,
  assertNonNegativePkr,
  assertPositivePkr,
  formatPkr,
  parsePkr,
  remainingPkr,
  sumPkr,
} from "@/lib/domain/money";

describe("rupee validation", () => {
  it("accepts whole rupees", () => {
    expect(assertNonNegativePkr(0)).toBe(0);
    expect(assertNonNegativePkr(10_800)).toBe(10_800);
  });

  it("rejects fractional amounts instead of rounding them", () => {
    expect(() => assertNonNegativePkr(7500.6)).toThrow(MoneyError);
  });

  it("rejects NaN and Infinity", () => {
    expect(() => assertNonNegativePkr(Number.NaN)).toThrow(MoneyError);
    expect(() => assertNonNegativePkr(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });

  it("rejects negatives where a payment is expected", () => {
    expect(() => assertNonNegativePkr(-1)).toThrow(MoneyError);
    expect(() => assertPositivePkr(0)).toThrow(MoneyError);
  });

  it("rejects amounts beyond safe integer precision", () => {
    expect(() => assertNonNegativePkr(Number.MAX_SAFE_INTEGER + 1)).toThrow(MoneyError);
  });
});

describe("parsing typed amounts", () => {
  it("accepts the shapes a manager actually types", () => {
    expect(parsePkr("7500")).toBe(7500);
    expect(parsePkr("7,500")).toBe(7500);
    expect(parsePkr("Rs 10,800")).toBe(10_800);
    expect(parsePkr("  9000 ")).toBe(9000);
  });

  it("refuses decimals rather than silently rounding", () => {
    expect(() => parsePkr("7500.60")).toThrow(MoneyError);
  });

  it("refuses empty and non-numeric input", () => {
    expect(() => parsePkr("")).toThrow(MoneyError);
    expect(() => parsePkr("abc")).toThrow(MoneyError);
  });
});

describe("addition and remainders", () => {
  it("sums admission charges exactly", () => {
    expect(sumPkr([7500, 3000, 300])).toBe(10_800);
    expect(sumPkr([9000, 3000, 300])).toBe(12_300);
  });

  it("has none of the drift a float total would", () => {
    // 0.1 + 0.2 !== 0.3 is why this module exists at all.
    const hundredRupeesThirty = Array.from({ length: 3 }, () => 10);
    expect(sumPkr(hundredRupeesThirty)).toBe(30);
  });

  it("never reports a negative remaining balance", () => {
    expect(remainingPkr(10_800, 5000)).toBe(5800);
    expect(remainingPkr(10_800, 10_800)).toBe(0);
    expect(remainingPkr(10_800, 12_000)).toBe(0);
  });
});

describe("allocating a payment across invoice lines", () => {
  const lines = [
    { id: "rent", outstandingPkr: 7500 },
    { id: "deposit", outstandingPkr: 3000 },
    { id: "police", outstandingPkr: 300 },
  ];

  it("settles everything when the payment covers the total", () => {
    const result = allocatePkr(10_800, lines);
    expect(result.allocations).toEqual([
      { id: "rent", amountPkr: 7500 },
      { id: "deposit", amountPkr: 3000 },
      { id: "police", amountPkr: 300 },
    ]);
    expect(result.unappliedPkr).toBe(0);
  });

  it("supports partial payment, oldest line first", () => {
    const result = allocatePkr(5000, lines);
    expect(result.allocations).toEqual([{ id: "rent", amountPkr: 5000 }]);
    expect(result.unappliedPkr).toBe(0);
  });

  it("spills across lines without over-allocating any of them", () => {
    const result = allocatePkr(9000, lines);
    expect(result.allocations).toEqual([
      { id: "rent", amountPkr: 7500 },
      { id: "deposit", amountPkr: 1500 },
    ]);
    expect(result.unappliedPkr).toBe(0);
  });

  it("reports an overpayment as unapplied rather than absorbing it", () => {
    const result = allocatePkr(12_000, lines);
    expect(result.allocations.reduce((sum, a) => sum + a.amountPkr, 0)).toBe(10_800);
    expect(result.unappliedPkr).toBe(1200);
  });

  it("allocates nothing for a zero payment", () => {
    expect(allocatePkr(0, lines)).toEqual({ allocations: [], unappliedPkr: 0 });
  });

  it("skips lines that are already settled", () => {
    const result = allocatePkr(500, [
      { id: "settled", outstandingPkr: 0 },
      { id: "open", outstandingPkr: 800 },
    ]);
    expect(result.allocations).toEqual([{ id: "open", amountPkr: 500 }]);
  });
});

describe("display formatting", () => {
  it("renders the format used across the interface", () => {
    expect(formatPkr(9000)).toBe("Rs 9,000");
    expect(formatPkr(10_800)).toBe("Rs 10,800");
    expect(formatPkr(0)).toBe("Rs 0");
  });
});
