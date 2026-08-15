import { AlertCircle } from "lucide-react";
import { AnimatedSection, CodeBlock, ERROR_CODES, SectionHeading } from "./shared";

export function ErrorsSection() {
	const errorFormatCode = `{
	"error": {
	"message": "Rate limit exceeded. Please slow down.",
	"type": "rate_limit_error",
	"code": "rate_limit_exceeded"
	}
}`;

	const retryCode = `import time
from openai import OpenAI
client = OpenAI(api_key="oma_sk_...", base_url="https://api.oma-ai.com/v1")
for attempt in range(5):
	try:
	response = client.chat.completions.create(model="llama-3.3-70b", messages=[{"role": "user", "content": "Hi"}])
	break
	except Exception as e:
	if hasattr(e, 'status_code') and e.status_code == 429:
	time.sleep(2 ** attempt)
	else:
	raise`;

	return (
		<AnimatedSection delay={600}>
			<SectionHeading
				id="errors"
				icon={<AlertCircle className="h-5 w-5" />}
				title="Error Codes"
				subtitle="Standard HTTP status codes returned by the API."
			/>

			<div id="err-format" className="mb-6 scroll-mt-24">
				<h3 className="mb-3 font-semibold text-text">Response Format</h3>
				<p className="mb-3 text-sm text-text-muted">
					Every error returns a JSON body with an{" "}
					<code className="font-mono text-accent">error</code> object carrying{" "}
					<code className="font-mono text-accent">message</code>,{" "}
					<code className="font-mono text-accent">type</code>, and{" "}
					<code className="font-mono text-accent">code</code>.
				</p>
				<CodeBlock code={errorFormatCode} lang="json" />
			</div>

			<div id="err-common" tabIndex={0} aria-label="API error codes table" className="mb-6 overflow-x-auto overscroll-x-contain rounded-[var(--radius-xl)] border border-border scroll-mt-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
				<table className="w-full text-left text-sm" aria-label="API error codes">
					<thead>
						<tr className="border-b border-border bg-panel">
							<th className="px-4 py-3 font-medium text-text-muted">Code</th>
							<th className="px-4 py-3 font-medium text-text-muted">Status</th>
							<th className="px-4 py-3 font-medium text-text-muted">
								Description
							</th>
						</tr>
					</thead>
					<tbody>
						{ERROR_CODES.map((e) => (
							<tr key={e.code} className="border-b border-border/50">
								<td className="px-4 py-3 font-mono font-bold text-error">
									{e.code}
								</td>
								<td className="px-4 py-3 font-mono text-warning">{e.type}</td>
								<td className="px-4 py-3 text-text-muted">{e.desc}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div id="err-retry" className="relative rounded-[var(--radius-xl)] border border-border bg-panel shadow-[var(--shadow-md)] p-5 scroll-mt-24">
				<h3 className="mb-3 font-semibold text-text">Handling Rate Limits</h3>
				<CodeBlock code={retryCode} lang="python" />
			</div>
		</AnimatedSection>
	);
}
