"use client";

import { useState } from "react";

export default function CodeBlock({
  children,
  language,
}: {
  children: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <button
        onClick={copy}
        className="absolute right-3 top-3 text-xs px-2 py-1 rounded bg-border/50 text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-text"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="!bg-surface border border-border rounded-lg p-4 overflow-x-auto text-sm leading-relaxed">
        <code className={language ? `language-${language}` : ""}>{children}</code>
      </pre>
    </div>
  );
}
