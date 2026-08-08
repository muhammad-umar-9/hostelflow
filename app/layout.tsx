import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Noto_Nastaliq_Urdu, Plus_Jakarta_Sans } from "next/font/google";
import { HostelProvider } from "@/components/providers/hostel-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PATHNAME_HEADER } from "@/middleware";
import { isPublicPath, loginRedirectPath } from "@/lib/public-routes";
import { getViewer } from "@/lib/server/viewer";
import "@/styles/globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const urdu = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["400", "600"],
  variable: "--font-urdu",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HostelFlow — Private hostel management made simple",
  description:
    "Rooms, admissions, rent, payment proofs, police verification and checkout for an independently operated private hostel.",
  manifest: "/manifest.webmanifest",
  applicationName: "HostelFlow",
  appleWebApp: {
    capable: true,
    title: "HostelFlow",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/pwa-icons/icon-192.svg",
    apple: "/pwa-icons/icon-192.svg",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f2a47",
  viewportFit: "cover",
};

/**
 * Every route depends on who is asking, so none may be prerendered.
 *
 * This is the correct trade, not a regression: the previous build prerendered all 31
 * routes as static HTML only because every screen showed the same mock snapshot to
 * everybody. A page listing one hostel's residents must never be a cacheable artifact.
 *
 * Stated outright rather than left to `headers()` throwing its bailout, because that
 * signal only works while nothing between here and the call swallows it. A single
 * `.catch()` added later — which is exactly what happened once already, during this very
 * milestone — turns the whole site static again with signed-out navigation baked in, and
 * the build still reports success.
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  /*
   * The real authentication boundary.
   *
   * `middleware.ts` only checks that a cookie exists — it runs on the edge runtime and
   * cannot open a database connection. Its comment used to claim the page would re-check,
   * but no page did: every screen under app/ is a client component, and requireUser() was
   * called from exactly two API handlers. So a cookie of any value rendered every
   * authenticated screen.
   *
   * `getViewer()` above resolved the session against the database and rejected a disabled
   * account, so by this line `signedIn` is a fact rather than the presence of a string.
   * Every page in the tree is below this layout, which is what makes one check sufficient
   * — and this stays correct as the screens are converted from mock data to live queries.
   */
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/";
  if (!viewer.signedIn && !isPublicPath(pathname)) {
    redirect(loginRedirectPath(pathname));
  }

  return (
    <html lang="en" data-theme="navy">
      <body className={jakarta.variable + " " + mono.variable + " " + urdu.variable}>
        <ThemeProvider>
          <ToastProvider>
            {/*
              The role is resolved server-side from HostelMembership and passed down as a
              prop. It used to live in localStorage with a setter exposed to every client
              component, which meant one console line made anybody an owner.
            */}
            <HostelProvider viewer={viewer}>{children}</HostelProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
