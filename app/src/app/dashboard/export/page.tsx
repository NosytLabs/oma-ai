

import { ExportDataButton } from "../_components/ExportDataButton";

/**
 * Standalone export page — surfaces OMA's usage/deposit export
 * endpoints in the dashboard UI. This is the #1 trust driver for credit-based
 * billing (Flexprice): users need to SEE where their credits went, not just a
 * balance number.
 *
 * Endpoints (server/src/routes/export.ts):
 * GET /v1/export/usage — per-request spend (model, tokens, cost, markup)
 * GET /v1/export/deposits — deposit history
 * GET /v1/export/summary — aggregated balance + totals
 * GET /v1/export/account — full GDPR Article 15/20 bundle (profile +
 * API keys, usage, deposits, credit balance,
 * audit log, sessions). Returns as a JSON
 * attachment. Settings → Privacy also links
 * to this for the one-click data download.
 */

export default function ExportPage() {
 return (
 <div className="mx-auto max-w-5xl px-4 py-10">
 <header className="mb-8">
 <h1 className="text-2xl font-semibold text-text-bright">Export your data</h1>
 <p className="mt-2 text-sm text-text-muted">
 Download a full record of where your credits went. CSV opens in
 Sheets/Excel; JSON is for scripts. All exports are scoped to your
 account only.
 </p>
 </header>

 <section className="space-y-6">
 <div className="border border-border bg-void p-5">
 <h2 className="text-sm font-semibold text-text-bright">Usage</h2>
 <p className="mt-1 mb-4 text-[11px] text-text-muted">
 Every request — model, provider, input/output tokens, cost, and markup.
 The clearest view of where credits went.
 </p>
 <div className="flex flex-wrap gap-3">
 <ExportDataButton kind="usage" format="csv" label="Usage (CSV)" />
 <ExportDataButton kind="usage" format="json" label="Usage (JSON)" />
 </div>
 </div>

 <div className="border border-border bg-void p-5">
 <h2 className="text-sm font-semibold text-text-bright">Deposits</h2>
 <p className="mt-1 mb-4 text-[11px] text-text-muted">
 USDC deposit history with tx hashes and credits issued.
 </p>
 <div className="flex flex-wrap gap-3">
 <ExportDataButton kind="deposits" format="csv" label="Deposits (CSV)" />
 <ExportDataButton kind="deposits" format="json" label="Deposits (JSON)" />
 </div>
 </div>

 <div className="border border-border bg-void p-5">
 <h2 className="text-sm font-semibold text-text-bright">Summary</h2>
 <p className="mt-1 mb-4 text-[11px] text-text-muted">
 Aggregated credits, total deposited, and total used.
 </p>
 <div className="flex flex-wrap gap-3">
 <ExportDataButton kind="summary" format="json" label="Summary (JSON)" />
 <ExportDataButton kind="summary" format="csv" label="Summary (CSV)" />
 </div>
 </div>
 </section>
 </div>
 );
}
