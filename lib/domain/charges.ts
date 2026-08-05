import { assertNonNegativePkr, assertPositivePkr, sumPkr } from "./money";

/**
 * Admission and settlement arithmetic.
 *
 * Every amount is supplied by the caller from configuration — room-type rent and the
 * hostel's charge types — never hard-coded here. The pilot's numbers (Rs 7,500 / Rs 9,000
 * rent, Rs 3,000 deposit, Rs 300 police form) live in the seed and in the database, so the
 * owner can change them in settings without a code change.
 *
 * Pure functions. The server calls these; the client may call them to preview a total, but
 * the server always recomputes before writing anything.
 */

export interface AdmissionChargeInput {
  /** Monthly rent for the selected bed's room type. */
  monthlyRentPkr: number;
  /** Refundable security deposit. Zero if the hostel does not take one. */
  securityDepositPkr: number;
  /** One-time police-form charge. Zero if the hostel does not levy it. */
  policeFormPkr: number;
  /** Any additional one-time charges configured for this hostel. */
  additionalPkr?: readonly { label: string; amountPkr: number }[];
}

export interface AdmissionChargeLine {
  kind: "RENT" | "SECURITY_DEPOSIT" | "POLICE_FORM" | "OTHER";
  label: string;
  amountPkr: number;
}

export interface AdmissionChargeBreakdown {
  lines: AdmissionChargeLine[];
  totalPkr: number;
  /** The refundable portion. Deposit is held, not earned — it never counts as income. */
  refundableDepositPkr: number;
}

/**
 * Builds the charge breakdown for a new admission.
 *
 * For the pilot this produces, from seeded configuration:
 *   four-seater  7,500 + 3,000 + 300 = 10,800
 *   three-seater 9,000 + 3,000 + 300 = 12,300
 */
export function calculateAdmissionCharges(
  input: AdmissionChargeInput,
): AdmissionChargeBreakdown {
  assertPositivePkr(input.monthlyRentPkr, "monthly rent");
  assertNonNegativePkr(input.securityDepositPkr, "security deposit");
  assertNonNegativePkr(input.policeFormPkr, "police-form charge");

  const lines: AdmissionChargeLine[] = [
    { kind: "RENT", label: "First month rent", amountPkr: input.monthlyRentPkr },
  ];

  if (input.securityDepositPkr > 0) {
    lines.push({
      kind: "SECURITY_DEPOSIT",
      label: "Refundable security deposit",
      amountPkr: input.securityDepositPkr,
    });
  }

  if (input.policeFormPkr > 0) {
    lines.push({
      kind: "POLICE_FORM",
      label: "Police form charge (one time)",
      amountPkr: input.policeFormPkr,
    });
  }

  for (const extra of input.additionalPkr ?? []) {
    assertNonNegativePkr(extra.amountPkr, extra.label);
    if (extra.amountPkr > 0) {
      lines.push({ kind: "OTHER", label: extra.label, amountPkr: extra.amountPkr });
    }
  }

  return {
    lines,
    totalPkr: sumPkr(lines.map((line) => line.amountPkr)),
    refundableDepositPkr: input.securityDepositPkr,
  };
}

export interface SettlementInput {
  /** Deposit currently held, i.e. the sum of the resident's deposit ledger. */
  depositHeldPkr: number;
  /** Rent and other charges still unpaid at checkout. */
  outstandingRentPkr: number;
  /** Itemized damage deductions. */
  damagesPkr?: readonly { description: string; amountPkr: number }[];
  /** Anything else deducted, with a reason recorded elsewhere. */
  otherChargesPkr?: number;
}

export interface SettlementBreakdown {
  depositHeldPkr: number;
  outstandingRentPkr: number;
  damageTotalPkr: number;
  otherChargesPkr: number;
  totalDeductionsPkr: number;
  /** What the hostel returns to the resident. Never negative. */
  refundablePkr: number;
  /**
   * What the resident still owes when deductions exceed the deposit. Exactly one of
   * `refundablePkr` and `residentOwesPkr` is non-zero.
   */
  residentOwesPkr: number;
  /** True when deductions exceed the held deposit, which requires owner approval. */
  exceedsDeposit: boolean;
}

/**
 * Computes a checkout settlement.
 *
 * Worked example from the specification: deposit 3,000, unpaid rent 0, damage 500,
 * other 0 gives a refundable amount of 2,500.
 */
export function calculateSettlement(input: SettlementInput): SettlementBreakdown {
  assertNonNegativePkr(input.depositHeldPkr, "deposit held");
  assertNonNegativePkr(input.outstandingRentPkr, "outstanding rent");

  const damages = input.damagesPkr ?? [];
  for (const damage of damages) {
    assertNonNegativePkr(damage.amountPkr, damage.description);
  }

  const damageTotalPkr = sumPkr(damages.map((damage) => damage.amountPkr));
  const otherChargesPkr = assertNonNegativePkr(
    input.otherChargesPkr ?? 0,
    "other charges",
  );

  const totalDeductionsPkr = sumPkr([
    input.outstandingRentPkr,
    damageTotalPkr,
    otherChargesPkr,
  ]);

  const net = input.depositHeldPkr - totalDeductionsPkr;

  return {
    depositHeldPkr: input.depositHeldPkr,
    outstandingRentPkr: input.outstandingRentPkr,
    damageTotalPkr,
    otherChargesPkr,
    totalDeductionsPkr,
    refundablePkr: Math.max(0, net),
    residentOwesPkr: Math.max(0, -net),
    exceedsDeposit: totalDeductionsPkr > input.depositHeldPkr,
  };
}

/**
 * Whether a checkout needs owner sign-off: either the deductions are larger than the
 * hostel's configured limit, or they eat into more than the deposit that is actually held.
 */
export function requiresOwnerApproval(
  settlement: SettlementBreakdown,
  approvalLimitPkr: number,
): boolean {
  assertNonNegativePkr(approvalLimitPkr, "approval limit");
  const deductionsExcludingRent = settlement.damageTotalPkr + settlement.otherChargesPkr;
  return deductionsExcludingRent > approvalLimitPkr || settlement.exceedsDeposit;
}
