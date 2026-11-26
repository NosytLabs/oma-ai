"use client";

/**
 * Section 02 — The catalog (2026-11 revamp).
 *
 * A ledger table of the chat catalog: name · provider · in/out rates ·
 * context · status. Availability is live (same loader as the pricing
 * page); offline models stay listed and labelled, never hidden. While
 * the live catalog is being read, status reads "Checking" rather than
 * guessing. Copy is COPY.md §1 verbatim.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Reveal } from "@/app/_components/home/reveal";
import {
	formatPricePerMillion,
	loadModels,
	MODELS,
	type Model,
} from "@/lib/models-data";

type Availability = "checking" | "live" | "unavailable";

export function CatalogSection() {
	const [models, setModels] = useState<Model[]>(MODELS);
	const [availability, setAvailability] = useState<Availability>("checking");

	useEffect(() => {
		let cancelled = false;
		loadModels()
			.then((live) => {
				if (cancelled) return;
				setModels(live);
				setAvailability(live === MODELS ? "unavailable" : "live");
			})
			.catch(() => {
				if (!cancelled) setAvailability("unavailable");
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const chatModels = models.filter((m) => m.modality === "chat");

	return (
		<section
			aria-labelledby="catalog-heading"
			className="border-b border-border"
		>
			<div className="container-page py-16 sm:py-20">
				<Reveal>
					<div className="flex flex-wrap items-end justify-between gap-6">
						<div>
							<p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
								02 — The catalog
							</p>
							<h2
								id="catalog-heading"
								className="section-headline mt-4 text-text-bright"
							>
								One key. A curated catalog.
							</h2>
							<p className="mt-4 max-w-3xl text-base leading-relaxed text-text-secondary">
								Every model in the catalog answers through the same endpoint
								and the same API key, each with its own per-token rate.
								Availability is shown live, model by model — if a model is
								offline, the catalog says so before you spend anything.
							</p>
						</div>
						<Link
							href="/models"
							className="font-mono text-[12px] uppercase tracking-[0.18em] text-accent underline-offset-4 hover:underline"
						>
							Browse all models
						</Link>
					</div>
				</Reveal>
				<Reveal>
					<div className="mt-10 overflow-x-auto rounded-lg border border-border">
						<table className="w-full min-w-[640px] border-collapse text-left">
							<thead>
								<tr className="border-b border-border bg-panel">
									{["Model", "Provider", "Input", "Output", "Context", "Status"].map(
										(h) => (
											<th
												key={h}
												scope="col"
												className="px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted"
											>
												{h}
											</th>
										),
									)}
								</tr>
							</thead>
							<tbody>
								{chatModels.map((m) => {
									const offline =
										availability === "live" && m.available === false;
									return (
										<tr
											key={m.id}
											className="border-b border-border last:border-b-0"
										>
											<td className="px-4 py-3 text-sm font-medium text-text-bright">
												{m.name}
											</td>
											<td className="px-4 py-3 text-sm text-text-secondary">
												{m.provider}
											</td>
											<td className="ledger-figures px-4 py-3 font-mono text-[13px] text-text">
												{formatPricePerMillion(m.inputPricePer1M)}
											</td>
											<td className="ledger-figures px-4 py-3 font-mono text-[13px] text-text">
												{formatPricePerMillion(m.outputPricePer1M)}
											</td>
											<td className="ledger-figures px-4 py-3 font-mono text-[13px] text-text-secondary">
												{m.contextLength}
											</td>
											<td className="px-4 py-3">
												<span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
													<span
														aria-hidden="true"
														className={`h-2 w-2 rounded-full ${
															availability === "checking"
																? "bg-text-muted"
																: offline
																	? "bg-error"
																	: "bg-success"
														}`}
													/>
													<span
														className={
															offline ? "text-error" : "text-text-secondary"
														}
													>
														{availability === "checking"
															? "Checking"
															: offline
																? "Offline"
																: "Enabled"}
													</span>
												</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</Reveal>
			</div>
		</section>
	);
}
