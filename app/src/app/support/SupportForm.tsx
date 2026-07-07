"use client";

import { CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import { useId, useState } from "react";

type Status =
	| { kind: "idle" }
	| { kind: "submitting" }
	| { kind: "success"; ticket: string; inbox: string; message: string }
	| { kind: "error"; message: string };

export function SupportForm() {
	const formId = useId();
	const [status, setStatus] = useState<Status>({ kind: "idle" });

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const data = new FormData(form);
		const payload = {
			topic: String(data.get("topic") ?? ""),
			email: String(data.get("email") ?? ""),
			wallet: String(data.get("wallet") ?? ""),
			message: String(data.get("message") ?? ""),
		};

		setStatus({ kind: "submitting" });
		try {
			const res = await fetch("/api/support", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const body = (await res.json().catch(() => ({}))) as {
				error?: { message?: string };
				ticket?: string;
				inbox?: string;
				message?: string;
			};
			if (!res.ok) {
				setStatus({
					kind: "error",
					message: body.error?.message ?? "Submission failed. Please try again.",
				});
				return;
			}
			setStatus({
				kind: "success",
				ticket: body.ticket ?? "",
				inbox: body.inbox ?? "",
				message: body.message ?? "Message received.",
			});
			form.reset();
		} catch {
			setStatus({
				kind: "error",
				message: "Network error. Please check your connection and try again.",
			});
		}
	}

	if (status.kind === "success") {
		return (
			<div
				role="status"
				aria-live="polite"
				className="border border-success/30 bg-success/5 p-5 sm:p-6 space-y-3"
			>
				<div className="flex items-center gap-2 text-success">
					<CheckCircle2 className="h-4 w-4" aria-hidden="true" />
					<p className="text-[13px] font-semibold">Message sent</p>
				</div>
				<p className="text-[12.5px] text-text-secondary leading-relaxed">
					{status.message}
				</p>
				<dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px]">
					<div>
						<dt className="text-text-tertiary uppercase tracking-wide">Ticket</dt>
						<dd className="font-mono text-text">{status.ticket || "—"}</dd>
					</div>
					<div>
						<dt className="text-text-tertiary uppercase tracking-wide">Inbox</dt>
						<dd className="font-mono text-text">{status.inbox || "—"}</dd>
					</div>
				</dl>
				<button
					type="button"
					onClick={() => setStatus({ kind: "idle" })}
					className="text-[12px] text-accent hover:underline underline-offset-2"
				>
					Send another message
				</button>
			</div>
		);
	}

	return (
		<form
			id={formId}
			onSubmit={onSubmit}
			className="border border-border bg-surface p-5 sm:p-6 space-y-4"
			noValidate
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1.5">
					<label
						htmlFor={`${formId}-topic`}
						className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
					>
						Topic
					</label>
					<select
						id={`${formId}-topic`}
						name="topic"
						required
						defaultValue=""
						className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-[13px] text-text-secondary outline-none focus:border-accent transition-colors cursor-pointer"
					>
						<option value="" disabled>
							Select a topic
						</option>
						<option value="General">General question</option>
						<option value="Billing">Billing / credits</option>
						<option value="Refund">Refund request</option>
						<option value="Privacy">Privacy / data</option>
						<option value="Security">Security issue</option>
						<option value="Bug">Bug report</option>
						<option value="Feature">Feature request</option>
						<option value="Partnership">Partnership</option>
					</select>
				</div>

				<div className="space-y-1.5">
					<label
						htmlFor={`${formId}-email`}
						className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
					>
						Your email
					</label>
					<input
						id={`${formId}-email`}
						name="email"
						type="email"
						placeholder="you@example.com"
						required
						className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-[13px] text-text-secondary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
					/>
				</div>
			</div>

			<div className="space-y-1.5">
				<label
					htmlFor={`${formId}-wallet`}
					className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
				>
					Wallet address{" "}
					<span className="normal-case font-normal text-text-tertiary">
						(optional)
					</span>
				</label>
				<input
					id={`${formId}-wallet`}
					name="wallet"
					type="text"
					placeholder="0x..."
					pattern="^0x[a-fA-F0-9]{40}$"
					className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-[13px] text-text-secondary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors font-mono"
				/>
			</div>

			<div className="space-y-1.5">
				<label
					htmlFor={`${formId}-message`}
					className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
				>
					Message
				</label>
				<textarea
					id={`${formId}-message`}
					name="message"
					rows={5}
					placeholder="Describe the issue. Include transaction hashes or request IDs, but never API keys or secrets."
					required
					minLength={10}
					maxLength={5000}
					className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-[13px] text-text-secondary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors resize-y min-h-[120px]"
				/>
			</div>

			{status.kind === "error" && (
				<div
					role="alert"
					aria-live="assertive"
					className="border border-error/30 bg-error/5 text-error text-[12.5px] p-3"
				>
					{status.message}
				</div>
			)}

			<button
				type="submit"
				disabled={status.kind === "submitting"}
				className="w-full sm:w-auto bg-accent text-void hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed px-6 py-2.5 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-center gap-2"
			>
				{status.kind === "submitting" ? (
					<>
						<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
						Sending…
					</>
				) : (
					<>
						<Send className="h-3.5 w-3.5" aria-hidden="true" />
						Send message
					</>
				)}
			</button>

			<p className="text-[11px] text-text-tertiary flex items-start gap-2">
				<Mail className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
				<span>
					Your message is routed to the right team based on the topic you
					pick. Average response is 14 days.
				</span>
			</p>
		</form>
	);
}
