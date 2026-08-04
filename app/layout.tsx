import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Noto_Nastaliq_Urdu, Plus_Jakarta_Sans } from "next/font/google";
import { HostelProvider } from "@/components/providers/hostel-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="navy">
      <body className={jakarta.variable + " " + mono.variable + " " + urdu.variable}>
        <ThemeProvider>
          <ToastProvider>
            <HostelProvider>{children}</HostelProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
