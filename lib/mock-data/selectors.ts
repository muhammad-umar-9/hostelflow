import { CURRENT_MONTH } from "@/lib/constants";
import type { HostelData, Invoice, OccupancyStats, Resident } from "@/lib/types";

export function getResident(data: HostelData, id: string): Resident | undefined {
  return data.residents.find((resident) => resident.id === id);
}

export function getInvoice(data: HostelData, residentId: string): Invoice | undefined {
  return data.invoices.find(
    (invoice) => invoice.residentId === residentId && invoice.month === CURRENT_MONTH,
  );
}

export function getStats(data: HostelData): OccupancyStats {
  const beds = data.rooms.flatMap((room) => room.beds);
  const occupied = beds.filter((bed) => bed.state === "occupied").length;
  const held = beds.filter((bed) => bed.state === "held").length;
  const maintenance = beds.filter((bed) => bed.state === "maintenance").length;
  const expected = data.invoices.reduce((sum, invoice) => sum + invoice.due, 0);
  const collected = data.invoices.reduce((sum, invoice) => sum + invoice.received, 0);
  return {
    totalBeds: beds.length,
    occupied,
    vacant: beds.length - occupied,
    ready: beds.length - occupied - held - maintenance,
    held,
    maintenance,
    occupancyRate: ((occupied / beds.length) * 100).toFixed(1),
    expected,
    collected,
    outstanding: expected - collected,
    collectedPercent: expected ? Math.round((collected / expected) * 100) : 0,
    unpaidResidents: data.invoices.filter(
      (invoice) => invoice.status === "unpaid" || invoice.status === "overdue",
    ).length,
    pendingProofs: data.proofs.filter((proof) => proof.status === "pending").length,
    pendingPolice: data.residents.filter(
      (resident) => resident.status === "active" && resident.police !== "verified",
    ).length,
    leavingSoon: data.residents.filter((resident) => resident.checkoutDate).length,
  };
}

export function vacantBeds(data: HostelData) {
  return data.rooms
    .map((room) => ({
      room,
      beds: room.beds.filter((bed) => bed.state === "vacant"),
    }))
    .filter((entry) => entry.beds.length > 0);
}
