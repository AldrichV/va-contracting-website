import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "./PwaRegistration.tsx";
import { business } from "./_site/business";
import "./globals.css";
import "./site.css";

const title = "VA Contracting | Renovations and Construction in Vaughan, Concord and the GTA";
const description =
  "Kitchen and washroom renovations, interlock, landscaping, decks, and commercial improvements across the GTA. Based in Concord, ON. Call (647) 272-8938 or request an estimate online.";

export const metadata: Metadata = {
  metadataBase: new URL(business.siteUrl),
  applicationName: business.shortName,
  title,
  description,
  alternates: { canonical: "/" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: business.shortName,
  },
  formatDetection: { telephone: true },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/images/favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    siteName: business.name,
    title,
    description,
    url: "/",
    images: [
      {
        url: "/images/og-va-contracting.jpg",
        width: 1200,
        height: 630,
        alt: "VA Contracting: renovations and construction across the GTA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/og-va-contracting.jpg"],
  },
  manifest: "/manifest.json",
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#0d2a54",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d2a54",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-CA">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap"
        />
      </head>
      <body className="antialiased">
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
