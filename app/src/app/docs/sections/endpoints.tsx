import { ChevronRight, Lock, Terminal } from "lucide-react";
import { useState } from "react";
import { AnimatedSection, CodeBlock, ENDPOINTS, SectionHeading } from "./shared";

export function EndpointsSection() {
	const [expanded, setExpanded] = useState<string | null>(
		"/v1/chat/completions",
	);

	return (
		<AnimatedSection delay={200}>
			<SectionHeading
				id="endpoints"
				icon={<Terminal className="h-5 w-5" />}
				title="Endpoints Reference"
				subtitle="OpenAI-compatible REST API endpoints."
			/>
			<p className="-mt-4 mb-6 text-sm text-text-muted">
				Every route, method, and auth surface at a glance — chat, models, auth,
				billing, and webhooks.
			</p>

			<div className="space-y-4">
				{ENDPOINTS.map((ep) => (
					<div
						key={ep.path}
						id={ep.anchor}
						className="rounded-xl border border-border bg-surface/50 overflow-hidden scroll-mt-24"
					>
						<button
							type="button"
							onClick={() => setExpanded(expanded === ep.path ? null : ep.path)}
							className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface/80"
						>
							<div className="flex min-w-0 flex-1 items-center gap-3">
								<span
									className={`shrink-0 rounded-md px-2.5 py-1 font-mono text-xs font-bold uppercase ${
										ep.method === "GET"
											? "bg-info/10 text-info"
											: "bg-accent/10 text-accent"
									}`}
								>
									{ep.method}
								</span>
								<div className="min-w-0">
									<code className="font-mono text-sm text-text">{ep.path}</code>
									<p className="truncate text-xs text-text-muted mt-0.5">
										{ep.title}
										{ep.path === "/v1/search" ? " · DuckDuckGo" : ""}
									</p>
								</div>
							</div>
							<div className="flex shrink-0 items-center gap-2">
								{ep.auth && !ep.auth.toLowerCase().includes("optional") && (
									<span className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-0.5 text-xs text-text-muted border border-border">
										<Lock className="h-3 w-3" /> Auth
									</span>
								)}
								{ep.auth && ep.auth.toLowerCase().includes("optional") && (
									<span className="hidden sm:inline rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-text-muted">
										Optional auth
									</span>
								)}
								<ChevronRight
									className={`h-4 w-4 text-text-muted transition-transform ${expanded === ep.path ? "rotate-90" : ""}`}
								/>
							</div>
						</button>

						{expanded === ep.path && (
							<div className="border-t border-border p-4 space-y-4">
								<p className="text-sm text-text-muted">{ep.desc}</p>

								{ep.body && (
									<div>
										<h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
											Request Body
										</h3>
										<div className="rounded-lg border border-border/50 bg-panel p-4 space-y-2">
											{Object.entries(ep.body).map(([key, val]) => (
												<div key={key} className="flex gap-3 font-mono text-sm">
													<span className="text-accent shrink-0">{key}</span>
													<span className="text-text-muted">{val}</span>
												</div>
											))}
										</div>
									</div>
								)}

								<div>
									<h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
										Response
									</h3>
									<CodeBlock code={ep.response} lang="json" />
								</div>
							</div>
						)}
					</div>
				))}
			</div>
		</AnimatedSection>
	);
}
