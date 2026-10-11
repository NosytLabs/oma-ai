"use client";

import { useState } from "react";
import Link from "next/link";
import type { ApiKeyCreateOptions } from "@/lib/api";

export function ApiKeyCreateForm({ name, setName, creating, onCreate, onCancel }: {
	name: string;
	setName: (name: string) => void;
	creating: boolean;
	onCreate: (options: ApiKeyCreateOptions) => void;
	onCancel: () => void;
}) {
	const [expiryDays, setExpiryDays] = useState("90");
	const [modelIds, setModelIds] = useState("");
	const [ipRanges, setIpRanges] = useState("");
	const inputClass = "w-full min-w-0 rounded-[var(--radius-sm)] border border-border bg-void px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50";
	return (
		<form className="mb-6 rounded-[var(--radius-md)] border border-accent/30 bg-accent/5 p-5" onSubmit={event => {
			event.preventDefault();
			if (creating || !name.trim()) return;
			const allowedModels = [...new Set(modelIds.split(",").map(id => id.trim()).filter(Boolean))];
			const ipAllowlist = [...new Set(ipRanges.split(/[,\n]/).map(ip => ip.trim()).filter(Boolean))];
			onCreate({ expiresInDays: Number(expiryDays), ...(allowedModels.length ? { allowedModels } : {}), ...(ipAllowlist.length ? { ipAllowlist } : {}) });
		}}>
			<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
				<label className="grid gap-2 text-sm text-text-secondary">
					API key name
					<input value={name} onChange={event => setName(event.target.value)} maxLength={64} placeholder="Production, staging, development…" className={inputClass} disabled={creating} autoFocus required />
				</label>
				<label className="grid gap-2 text-sm text-text-secondary">
					Expires after
					<select value={expiryDays} onChange={event => setExpiryDays(event.target.value)} className={inputClass} disabled={creating}>
						{[1, 7, 30, 90, 365].map(days => <option key={days} value={days}>{days} day{days === 1 ? "" : "s"}</option>)}
					</select>
				</label>
			</div>
			<label className="mt-4 grid gap-2 text-sm text-text-secondary">
				Allowed model IDs (optional)
				<input value={modelIds} onChange={event => setModelIds(event.target.value)} placeholder="minimax-m2-7, google-gemma-4-31b-it" className={inputClass} disabled={creating} aria-describedby="key-model-help" />
			</label>
			<p id="key-model-help" className="mt-2 text-xs text-text-muted">Use comma-separated IDs from <Link href="/models" className="text-accent underline">Models</Link>. Leave blank to allow all models. Restrictions also apply to fallback routes.</p>
			<label className="mt-4 grid gap-2 text-sm text-text-secondary">
				Allowed IP addresses (optional)
				<textarea value={ipRanges} onChange={event => setIpRanges(event.target.value)} maxLength={1400} rows={2} placeholder="203.0.113.10, 2001:db8::/32" className={inputClass} disabled={creating} aria-describedby="key-ip-help" />
			</label>
			<p id="key-ip-help" className="mt-2 text-xs text-text-muted">Only these addresses can use this key. Enter up to 20 IPv4, IPv6 or CIDR ranges separated by commas or new lines. Include your server’s public outbound IP; a changing address may block requests. Leave blank for unrestricted access.</p>
			<div className="mt-4 flex flex-wrap gap-2">
				<button type="submit" disabled={creating || !name.trim()} className="rounded-[var(--radius-sm)] bg-accent px-5 py-2.5 text-sm font-semibold text-text-inverse disabled:opacity-50 focus-ring">{creating ? "Creating…" : "Create key"}</button>
				<button type="button" onClick={onCancel} disabled={creating} className="rounded-[var(--radius-sm)] border border-border px-4 py-2.5 text-sm text-text-secondary focus-ring">Cancel</button>
			</div>
		</form>
	);
}
