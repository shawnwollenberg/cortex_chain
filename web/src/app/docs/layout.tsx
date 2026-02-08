import type { Metadata } from "next";
import DocsSidebar from "@/components/DocsSidebar";

export const metadata: Metadata = {
  title: {
    default: "Docs",
    template: "%s — Cortex Docs",
  },
  openGraph: {
    type: "website",
    siteName: "Cortex Docs",
  },
};

const docsJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  name: "Cortex Documentation",
  description: "Developer documentation for the Cortex agent-native Ethereum L2.",
  url: "https://cortex.dev/docs",
  about: {
    "@type": "SoftwareApplication",
    name: "Cortex",
  },
  inLanguage: "en",
  isAccessibleForFree: true,
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(docsJsonLd) }}
      />
      <div className="mx-auto max-w-6xl px-4 py-10 lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <DocsSidebar />
          </div>
        </aside>
        <article className="prose-custom min-w-0">
          {children}
        </article>
      </div>
    </>
  );
}
