"use client";

import { useState } from "react";

const TOPICS = [
	"General",
	"Billing",
	"Refund",
	"Privacy",
	"Security",
	"Bug",
	"Feature",
	"Partnership",
] as const;

export function ContactForm() {
	const [topic, setTopic] = useState<(typeof TOPICS)[number]>("General");
	const [email, setEmail] = useState("");
	const [message, setMessage] = useState("");
	const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">(
		"idle",
	);
	const [detail, setDetail] = useState<string | null>(null);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setStatus("sending");
		setDetail(null);
		try {
			const res = await fetch("/api/support", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ topic, email, message }),
			});
			const body = (await res.json().catch(() => null)) as {
				ticket?: string;
				error?: { message?: string };
			} | null;
			if (!res.ok) {
				setStatus("err");
				setDetail(body?.error?.message ?? "Could not send. Try email instead.");
				return;
			}
			setStatus("ok");
			setDetail(
				body?.ticket
					? `Queued as ${body.ticket}. We reply within one business day for outages.`
					: "Message queued.",
			);
			setMessage("");
		} catch {
			setStatus("err");
			setDetail("Network error. Email support@nosytlabs.com instead.");
		}
	};

	return (
		<form
			onSubmit={onSubmit}
			className="mt-10 rounded-[var(--radius-xl)] border border-border bg-surface p-5 sm:p-6"
		>
			<h2 className="text-base font-semibold text-text-bright">Send a note</h2>
			<p className="mt-1 text-sm text-text-muted">
				Outages first. We reply within one business day for production issues.
			</p>
			<div className="mt-5 grid gap-4 sm:grid-cols-2">
				<label className="block text-xs font-medium text-text-secondary">
					Topic
					<select
						value={topic}
						onChange={(e) =>
							setTopic(e.target.value as (typeof TOPICS)[number])
						}
						className="mt-1.5 min-h-11 w-full rounded-[var(--radius-md)] border border-border bg-void px-3 py-2.5 text-sm text-text-bright focus:border-accent/50 focus:outline-none"
					>
						{TOPICS.map((t) => (
							<option key={t} value={t}>
								{t}
							</option>
						))}
					</select>
				</label>
				<label className="block text-xs font-medium text-text-secondary">
					Email
					<input
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="mt-1.5 min-h-11 w-full rounded-[var(--radius-md)] border border-border bg-void px-3 py-2.5 text-sm text-text-bright focus:border-accent/50 focus:outline-none"
						placeholder="you@company.com"
					/>
				</label>
			</div>
			<label className="mt-4 block text-xs font-medium text-text-secondary">
				Message
				<textarea
					required
					minLength={10}
					rows={5}
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					className="mt-1.5 min-h-11 w-full rounded-[var(--radius-md)] border border-border bg-void px-3 py-2.5 text-sm text-text-bright focus:border-accent/50 focus:outline-none"
					placeholder="What broke, what you expected, and any request IDs."
				/>
			</label>
			<div className="mt-4 flex flex-wrap items-center gap-3">
				<button
					type="submit"
					disabled={status === "sending"}
					className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-accent px-5 text-sm font-semibold text-void transition-[background-color,transform] duration-200 ease-out hover:bg-accent-bright active:scale-[0.97] disabled:opacity-50"
				>
					{status === "sending" ? "Sending…" : "Send message"}
				</button>
				{detail && (
					<p
						className={`text-sm ${status === "err" ? "text-error" : "text-text-muted"}`}
						role="status"
					>
						{detail}
					</p>
				)}
			</div>
		</form>
	);
}
