import { AlertCircle } from "lucide-react";
import { AnimatedSection, CodeBlock, ERROR_CODES, SectionHeading } from "./shared";

export function ErrorsSection() {
	const retryCode = `import time
from openai import OpenAI
client = OpenAI(api_key="oma_sk_...", base_url="https://api.oma-ai.com/v1")
for attempt in range(5):
    try:
        response = client.chat.completions.create(model="llama-3.2-3b", messages=[{"role": "user", "content": "Hi"}])
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

			<div className="mb-6 overflow-hidden rounded-xl border border-border">
				<table className="w-full text-left text-sm">
					<thead>
						<tr className="border-b border-border bg-surface/50">
							<th className="px-4 py-3 font-medium text-text-muted">Code</th>
							<th className="px-4 py-3 font-medium text-text-muted">Type</th>
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

			<div className="relative rounded-xl border border-border bg-panel p-5">
				<h4 className="mb-3 font-semibold text-text">Handling Rate Limits</h4>
				<CodeBlock code={retryCode} lang="python" />
			</div>
		</AnimatedSection>
	);
}
