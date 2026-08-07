import { describe, expect, it } from "vitest";
import {
  calculateAdmissionCharges,
  calculateSettlement,
  requiresOwnerApproval,
} from "@/lib/domain/charges";
import { MoneyError } from "@/lib/domain/money";

/** The pilot's seeded configuration. Passed in, never hard-coded in the calculator. */
const PILOT = {
  fourSeaterRentPkr: 7500,
  threeSeaterRentPkr: 9000,
  securityDepositPkr: 3000,
  policeFormPkr: 300,
};

describe("admission charges", () => {
  it("totals a four-seater admission at Rs 10,800", () => {
    const result = calculateAdmissionCharges({
      monthlyRentPkr: PILOT.fourSeaterRentPkr,
      securityDepositPkr: PILOT.securityDepositPkr,
      policeFormPkr: PILOT.policeFormPkr,
    });

    expect(result.totalPkr).toBe(10_800);
    expect(result.lines.map((line) => line.amountPkr)).toEqual([7500, 3000, 300]);
    expect(result.refundableDepositPkr).toBe(3000);
  });

  it("totals a three-seater admission at Rs 12,300", () => {
    const result = calculateAdmissionCharges({
      monthlyRentPkr: PILOT.threeSeaterRentPkr,
      securityDepositPkr: PILOT.securityDepositPkr,
      policeFormPkr: PILOT.policeFormPkr,
    });

    expect(result.totalPkr).toBe(12_300);
  });

  it("keeps the deposit separate from the amount earned", () => {
    const result = calculateAdmissionCharges({
      monthlyRentPkr: PILOT.fourSeaterRentPkr,
      securityDepositPkr: PILOT.securityDepositPkr,
      policeFormPkr: PILOT.policeFormPkr,
    });

    const earned = result.totalPkr - result.refundableDepositPkr;
    expect(earned).toBe(7800);
  });

  it("omits charges the hostel has set to zero", () => {
    const result = calculateAdmissionCharges({
      monthlyRentPkr: 7500,
      securityDepositPkr: 0,
      policeFormPkr: 0,
    });

    expect(result.lines).toHaveLength(1);
    expect(result.totalPkr).toBe(7500);
  });

  it("includes configured extra charges", () => {
    const result = calculateAdmissionCharges({
      monthlyRentPkr: 7500,
      securityDepositPkr: 3000,
      policeFormPkr: 300,
      additionalPkr: [{ label: "Mess advance", amountPkr: 2000 }],
    });

    expect(result.totalPkr).toBe(12_800);
  });

  it("refuses a zero or fractional rent", () => {
    expect(() =>
      calculateAdmissionCharges({
        monthlyRentPkr: 0,
        securityDepositPkr: 3000,
        policeFormPkr: 300,
      }),
    ).toThrow(MoneyError);

    expect(() =>
      calculateAdmissionCharges({
        monthlyRentPkr: 7500.5,
        securityDepositPkr: 3000,
        policeFormPkr: 300,
      }),
    ).toThrow(MoneyError);
  });
});

describe("checkout settlement", () => {
  it("matches the worked example from the specification", () => {
    // deposit 3,000 − unpaid rent 0 − damage 500 − other 0 = refund 2,500
    const result = calculateSettlement({
      depositHeldPkr: 3000,
      outstandingRentPkr: 0,
      damagesPkr: [{ description: "Broken chair", amountPkr: 500 }],
    });

    expect(result.refundablePkr).toBe(2500);
    expect(result.residentOwesPkr).toBe(0);
    expect(result.totalDeductionsPkr).toBe(500);
    expect(result.exceedsDeposit).toBe(false);
  });

  it("subtracts unpaid rent as well as damages", () => {
    const result = calculateSettlement({
      depositHeldPkr: 3000,
      outstandingRentPkr: 7500,
      damagesPkr: [{ description: "Wall damage", amountPkr: 500 }],
    });

    expect(result.refundablePkr).toBe(0);
    expect(result.residentOwesPkr).toBe(5000);
    expect(result.exceedsDeposit).toBe(true);
  });

  it("returns the whole deposit when nothing is owed", () => {
    const result = calculateSettlement({ depositHeldPkr: 3000, outstandingRentPkr: 0 });
    expect(result.refundablePkr).toBe(3000);
  });

  it("never returns both a refund and a debt", () => {
    const cases = [
      { depositHeldPkr: 3000, outstandingRentPkr: 0 },
      { depositHeldPkr: 3000, outstandingRentPkr: 3000 },
      { depositHeldPkr: 3000, outstandingRentPkr: 9000 },
    ];

    for (const input of cases) {
      const result = calculateSettlement(input);
      expect(result.refundablePkr === 0 || result.residentOwesPkr === 0).toBe(true);
    }
  });

  it("totals several damage items", () => {
    const result = calculateSettlement({
      depositHeldPkr: 3000,
      outstandingRentPkr: 0,
      damagesPkr: [
        { description: "Broken chair", amountPkr: 500 },
        { description: "Lost key", amountPkr: 250 },
      ],
      otherChargesPkr: 150,
    });

    expect(result.damageTotalPkr).toBe(750);
    expect(result.totalDeductionsPkr).toBe(900);
    expect(result.refundablePkr).toBe(2100);
  });
});

describe("owner approval", () => {
  const limitPkr = 1000;

  it("is not needed for a small deduction", () => {
    const settlement = calculateSettlement({
      depositHeldPkr: 3000,
      outstandingRentPkr: 0,
      damagesPkr: [{ description: "Broken chair", amountPkr: 500 }],
    });
    expect(requiresOwnerApproval(settlement, limitPkr)).toBe(false);
  });

  it("is needed above the configured limit", () => {
    const settlement = calculateSettlement({
      depositHeldPkr: 3000,
      outstandingRentPkr: 0,
      damagesPkr: [{ description: "Window", amountPkr: 1500 }],
    });
    expect(requiresOwnerApproval(settlement, limitPkr)).toBe(true);
  });

  it("is needed whenever deductions exceed the deposit held", () => {
    const settlement = calculateSettlement({
      depositHeldPkr: 500,
      outstandingRentPkr: 7500,
    });
    expect(requiresOwnerApproval(settlement, 100_000)).toBe(true);
  });
});
