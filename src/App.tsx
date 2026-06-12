import { RefreshCw } from "lucide-react";

export default function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Codex Session Manager</h1>
          <p>Scan, inspect, and clean local Codex sessions.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Rescan sessions">
          <RefreshCw size={18} />
        </button>
      </header>
      <section className="empty-state">Scanner will be wired in Task 7.</section>
    </main>
  );
}
