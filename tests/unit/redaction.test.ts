import { describe, expect, it } from "vitest";
import { redact, redactText } from "@/lib/domain/redaction";

/**
 * The specification forbids CNIC numbers, passwords, tokens and signed URLs from ever
 * reaching a log. These tests exist so that promise is checked rather than assumed.
 */

describe("redacting free text", () => {
  it("masks a dashed CNIC", () => {
    const result = redactText("Verified payment for 35202-1234567-1");
    expect(result).not.toContain("1234567");
    expect(result).toContain("35202");
  });

  it("masks a bare 13-digit CNIC", () => {
    const result = redactText("resident 3520212345671 admitted");
    expect(result).not.toContain("3520212345671");
  });

  it("removes a presigned URL", () => {
    const result = redactText(
      "opened https://minio.example.com/private/a.jpg?X-Amz-Signature=deadbeefcafe",
    );
    expect(result).not.toContain("X-Amz-Signature");
    expect(result).toContain("[signed-url-redacted]");
  });

  it("removes long opaque tokens", () => {
    const token = "a".repeat(48);
    expect(redactText(`session ${token}`)).not.toContain(token);
  });

  it("leaves ordinary text and rupee amounts alone", () => {
    const text = "Approved Rs 10,800 for Room 101 Bed D";
    expect(redactText(text)).toBe(text);
  });

  it("leaves a phone number readable, since staff need it", () => {
    expect(redactText("called 0300 1234567")).toContain("0300 1234567");
  });
});

describe("redacting structured metadata", () => {
  it("drops forbidden keys whatever the value looks like", () => {
    const result = redact({
      password: "hunter2",
      token: "short",
      cnic: "35202-1234567-1",
      amountPkr: 10_800,
    }) as Record<string, unknown>;

    expect(result.password).toBe("[redacted]");
    expect(result.token).toBe("[redacted]");
    expect(result.cnic).toBe("[redacted]");
    expect(result.amountPkr).toBe(10_800);
  });

  it("is case-insensitive about key names", () => {
    const result = redact({ Password: "x", AccessToken: "y" }) as Record<string, unknown>;
    expect(result.Password).toBe("[redacted]");
    expect(result.AccessToken).toBe("[redacted]");
  });

  it("recurses into nested objects and arrays", () => {
    const result = redact({
      resident: { name: "Ali Raza", cnic: "35202-1234567-1" },
      documents: [{ note: "CNIC 35202-7654321-9 attached" }],
    }) as { resident: Record<string, unknown>; documents: Record<string, unknown>[] };

    expect(result.resident.cnic).toBe("[redacted]");
    expect(result.resident.name).toBe("Ali Raza");
    expect(String(result.documents[0].note)).not.toContain("7654321");
  });

  it("preserves the shape of ordinary values", () => {
    const result = redact({ count: 3, ok: true, at: new Date("2026-08-04T00:00:00Z") });
    expect(result).toEqual({ count: 3, ok: true, at: "2026-08-04T00:00:00.000Z" });
  });

  it("stops recursing rather than hanging on deep structures", () => {
    let deep: Record<string, unknown> = { value: "end" };
    for (let i = 0; i < 20; i += 1) deep = { nested: deep };

    expect(() => redact(deep)).not.toThrow();
    expect(JSON.stringify(redact(deep))).toContain("[truncated]");
  });

  it("caps long arrays", () => {
    const result = redact(Array.from({ length: 500 }, (_, i) => i)) as unknown[];
    expect(result).toHaveLength(50);
  });
});
