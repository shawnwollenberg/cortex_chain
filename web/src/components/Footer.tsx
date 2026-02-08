export default function Footer() {
  return (
    <footer className="border-t border-border py-8 mt-auto">
      <div className="mx-auto max-w-6xl px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted">
        <p>Cortex &mdash; Agent-Native Ethereum L2</p>
        <div className="flex gap-6">
          <a href="/docs" className="hover:text-text transition-colors">Docs</a>
          <a href="/overview" className="hover:text-text transition-colors">Overview</a>
          <a href="https://github.com" className="hover:text-text transition-colors">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
