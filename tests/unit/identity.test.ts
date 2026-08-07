import { describe, expect, it } from "vitest";
import {
  IdentityError,
  formatCnic,
  formatMobile,
  initialsOf,
  maskCnic,
  normalizeCnic,
  normalizeMobile,
  toInternationalMobile,
  tryNormalizeCnic,
  tryNormalizeMobile,
  whatsAppLink,
} from "@/lib/domain/identity";

describe("CNIC normalization", () => {
  it("accepts the dashed form staff type", () => {
    expect(normalizeCnic("35202-1234567-1")).toBe("3520212345671");
  });

  it("accepts bare digits and stray spaces", () => {
    expect(normalizeCnic("3520212345671")).toBe("3520212345671");
    expect(normalizeCnic(" 35202 1234567 1 ")).toBe("3520212345671");
  });

  it("rejects the wrong number of digits", () => {
    expect(() => normalizeCnic("35202-123456-1")).toThrow(IdentityError);
    expect(() => normalizeCnic("352021234567")).toThrow(IdentityError);
  });

  it("rejects letters", () => {
    expect(() => normalizeCnic("35202-ABCDEFG-1")).toThrow(IdentityError);
  });

  it("has a non-throwing variant for search boxes", () => {
    expect(tryNormalizeCnic("35202-1234567-1")).toBe("3520212345671");
    expect(tryNormalizeCnic("not a cnic")).toBeNull();
  });

  it("round-trips back to the display form", () => {
    expect(formatCnic(normalizeCnic("35202-1234567-1"))).toBe("35202-1234567-1");
  });
});

describe("CNIC masking", () => {
  it("hides the identifying middle digits", () => {
    expect(maskCnic("35202-1234567-1")).toBe("35202-*****67-1");
  });

  it("masks the normalized form identically", () => {
    expect(maskCnic("3520212345671")).toBe("35202-*****67-1");
  });

  it("never leaks the full number through an invalid input", () => {
    expect(maskCnic("garbage")).toBe("*****");
    expect(maskCnic("")).toBe("*****");
  });

  it("does not contain the seven-digit middle block", () => {
    const masked = maskCnic("35202-1234567-1");
    expect(masked).not.toContain("1234567");
  });
});

describe("mobile normalization", () => {
  it("accepts the local formats", () => {
    expect(normalizeMobile("0300 1234567")).toBe("03001234567");
    expect(normalizeMobile("03001234567")).toBe("03001234567");
    expect(normalizeMobile("0300-1234567")).toBe("03001234567");
  });

  it("accepts international formats", () => {
    expect(normalizeMobile("+923001234567")).toBe("03001234567");
    expect(normalizeMobile("+92 300 1234567")).toBe("03001234567");
    expect(normalizeMobile("00923001234567")).toBe("03001234567");
    expect(normalizeMobile("923001234567")).toBe("03001234567");
  });

  it("accepts a number typed without its leading zero", () => {
    expect(normalizeMobile("3001234567")).toBe("03001234567");
  });

  it("rejects landlines and wrong lengths", () => {
    expect(() => normalizeMobile("042 35678901")).toThrow(IdentityError);
    expect(() => normalizeMobile("0300 123456")).toThrow(IdentityError);
    expect(() => normalizeMobile("")).toThrow(IdentityError);
  });

  it("has a non-throwing variant", () => {
    expect(tryNormalizeMobile("0300 1234567")).toBe("03001234567");
    expect(tryNormalizeMobile("nope")).toBeNull();
  });

  it("formats back for display", () => {
    expect(formatMobile("03001234567")).toBe("0300 1234567");
  });
});

describe("WhatsApp links", () => {
  it("builds an international link", () => {
    expect(toInternationalMobile("03001234567")).toBe("+923001234567");
    expect(whatsAppLink("03001234567")).toBe("https://wa.me/923001234567");
  });

  it("encodes the message", () => {
    const link = whatsAppLink("03001234567", "Rent for August is due: Rs 7,500");
    expect(link).toContain("https://wa.me/923001234567?text=");
    expect(link).toContain("Rs%207%2C500");
  });

  it("refuses to build a link from an invalid number", () => {
    expect(() => whatsAppLink("12345")).toThrow(IdentityError);
  });
});

describe("initials", () => {
  it("takes the first two words", () => {
    expect(initialsOf("Ali Raza")).toBe("AR");
    expect(initialsOf("Muhammad Abdullah Ahmed")).toBe("MA");
    expect(initialsOf("Hamza")).toBe("H");
  });

  it("survives messy spacing", () => {
    expect(initialsOf("  bilal   hussain ")).toBe("BH");
  });
});
