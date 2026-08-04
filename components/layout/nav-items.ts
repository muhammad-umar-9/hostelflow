import {
  CreditCard,
  Grid2x2,
  Home,
  MessageSquare,
  MoreHorizontal,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  urdu: string;
  icon: LucideIcon;
  match: string[];
}

export const STAFF_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", urdu: "ہوم", icon: Home, match: ["/dashboard"] },
  { href: "/rooms", label: "Rooms", urdu: "کمرے", icon: Grid2x2, match: ["/rooms"] },
  {
    href: "/residents",
    label: "Residents",
    urdu: "رہائشی",
    icon: Users,
    match: ["/residents", "/admissions"],
  },
  {
    href: "/payments",
    label: "Payments",
    urdu: "ادائیگیاں",
    icon: CreditCard,
    match: ["/payments", "/receipts"],
  },
  {
    href: "/more",
    label: "More",
    urdu: "مزید",
    icon: MoreHorizontal,
    match: ["/more", "/settings", "/police-verification", "/enquiries"],
  },
];

export const RESIDENT_NAV: NavItem[] = [
  {
    href: "/resident-portal",
    label: "Home",
    urdu: "ہوم",
    icon: Home,
    match: ["/resident-portal"],
  },
  {
    href: "/resident-portal/payments",
    label: "Payments",
    urdu: "ادائیگیاں",
    icon: CreditCard,
    match: ["/resident-portal/payments"],
  },
  {
    href: "/resident-portal/requests",
    label: "Requests",
    urdu: "درخواستیں",
    icon: MessageSquare,
    match: ["/resident-portal/requests"],
  },
  {
    href: "/resident-portal/profile",
    label: "Profile",
    urdu: "پروفائل",
    icon: User,
    match: ["/resident-portal/profile"],
  },
];

export function navForRole(role: Role): NavItem[] {
  return role === "resident" ? RESIDENT_NAV : STAFF_NAV;
}
