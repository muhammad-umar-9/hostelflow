const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

/** Rs 9,000 */
export function formatPKR(value: number): string {
  return "Rs " + Number(value || 0).toLocaleString("en-US");
}

/** 04 Aug 2026 */
export function formatDate(date: Date | string): string {
  if (typeof date === "string") return date;
  const day = String(date.getDate()).padStart(2, "0");
  return day + " " + MONTHS[date.getMonth()] + " " + date.getFullYear();
}

/** 0300 1234567 */
export function formatPhone(raw: string): string {
  const digits = (raw || "").replace(/[^0-9]/g, "");
  if (digits.length < 11) return raw;
  return digits.slice(0, 4) + " " + digits.slice(4, 11);
}

/** 35202-*****67-1 — list screens only */
export function maskCnic(cnic: string): string {
  if (!cnic || cnic.length < 12) return cnic;
  return cnic.slice(0, 6) + "*****" + cnic.slice(11);
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
