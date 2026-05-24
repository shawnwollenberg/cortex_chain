import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Cortex — Agentic Commerce Protocol",
    template: "%s — Cortex",
  },
  description:
    "A Base-native protocol for agentic commerce: merchant discovery, delegated budgets, payment rails, quote commitments, receipts, disputes, and machine-readable state.",
  metadataBase: new URL("https://cortex.dev"),
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Cortex",
    title: "Cortex — Agentic Commerce Protocol",
    description:
      "A Base-native protocol for agentic commerce: merchant discovery, delegated budgets, payment rails, quote commitments, receipts, disputes, and machine-readable state.",
  },
  twitter: {
    card: "summary",
    title: "Cortex — Agentic Commerce Protocol",
    description:
      "A Base-native protocol for agentic commerce: merchant discovery, delegated budgets, payment rails, quote commitments, receipts, disputes, and machine-readable state.",
  },
  alternates: {
    canonical: "https://cortex.dev",
  },
  other: {
    "ai-content-declaration": "This site documents an agentic commerce protocol. Machine-readable documentation is available at /llms.txt and /llms-full.txt. Markdown docs are served at /docs/*.md.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Cortex",
  description:
    "A Base-native protocol for agentic commerce. Onchain identity, merchant discovery, policy-aware smart accounts, payment rails, receipts, disputes, and machine-readable state.",
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
    <html lang="en">
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
