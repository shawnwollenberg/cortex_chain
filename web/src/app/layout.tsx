import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Cortex — Agent-Native Ethereum L2",
    template: "%s — Cortex",
  },
  description:
    "An EVM-compatible Layer 2 designed for AI agents. Onchain identity, policy-aware smart accounts, intent-based execution, and machine-readable state.",
  metadataBase: new URL("https://cortex.dev"),
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Cortex",
    title: "Cortex — Agent-Native Ethereum L2",
    description:
      "An EVM-compatible Layer 2 designed for AI agents. Onchain identity, policy-aware smart accounts, intent-based execution, and machine-readable state.",
  },
  twitter: {
    card: "summary",
    title: "Cortex — Agent-Native Ethereum L2",
    description:
      "An EVM-compatible Layer 2 designed for AI agents. Onchain identity, policy-aware smart accounts, intent-based execution, and machine-readable state.",
  },
  alternates: {
    canonical: "https://cortex.dev",
  },
  other: {
    "ai-content-declaration": "This site documents an agent-native Ethereum L2. Machine-readable documentation is available at /llms.txt and /llms-full.txt. Markdown docs are served at /docs/*.md.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Cortex",
  description:
    "An EVM-compatible Layer 2 designed for AI agents. Onchain identity, policy-aware smart accounts, intent-based execution, and machine-readable state.",
  applicationCategory: "Blockchain",
  operatingSystem: "Cross-platform",
  url: "https://cortex.dev",
  documentation: "https://cortex.dev/docs",
  softwareRequirements: "Docker, Foundry, Node.js >= 18",
  programmingLanguage: ["Solidity", "TypeScript"],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col font-[family-name:var(--font-sans)] antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
