"use client";

import { useState } from "react";
import Link from "next/link";
import { CopyableCode } from "@/components/copyable-code";
import { ModelDetailTabs } from "./ModelDetailTabs";

const LANGUAGES = [
	{ id: "curl", label: "cURL" },
	{ id: "python", label: "Python" },
	{ id: "javascript", label: "JavaScript" },
] as const;

export function ModelApiExamples({ modelId, name }: { modelId: string; name: string }) {
	const [language, setLanguage] = useState<(typeof LANGUAGES)[number]["id"]>("curl");
	const quotedId = JSON.stringify(modelId);
	const examples = {
		curl: `curl https://www.oma-ai.com/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OMA_API_KEY" \\
  -d '{
    "model": ${quotedId},
    "messages": [{ "role": "user", "content": "Hello!" }],
    "max_tokens": 150
  }'`,
		python: `import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["OMA_API_KEY"],
    base_url="https://www.oma-ai.com/api/v1",
)

response = client.chat.completions.create(
    model=${quotedId},
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=150,
)

print(response.choices[0].message.content)`,
		javascript: `import { OpenAI } from "openai";

const client = new OpenAI({
  apiKey: process.env.OMA_API_KEY,
  baseURL: "https://www.oma-ai.com/api/v1",
});

const response = await client.chat.completions.create({
  model: ${quotedId},
  messages: [{ role: "user", content: "Hello!" }],
  max_tokens: 150,
});

console.log(response.choices[0].message.content);`,
	};
	return (
		<section aria-labelledby="api-example-heading" className="min-w-0 rounded-[var(--radius-xl)] border border-border bg-panel p-5 sm:p-6">
			<h2 id="api-example-heading" className="font-display text-xl font-medium text-text-bright">Use {name} with the API</h2>
			<p className="mt-2 mb-5 text-sm leading-relaxed text-text-secondary">
				Set <code className="font-mono text-text-bright">OMA_API_KEY</code> to your API key. API requests use your account credits.
			</p>
			<ModelDetailTabs label="Code language" tabs={LANGUAGES} selected={language} onSelect={setLanguage} prefix="example" />
			{LANGUAGES.map((tab) => (
				<div key={tab.id} role="tabpanel" id={`example-panel-${tab.id}`} aria-labelledby={`example-tab-${tab.id}`} hidden={language !== tab.id} className="mt-4">
					<CopyableCode code={examples[tab.id]} aria-label={`${name} ${tab.label} example`} />
				</div>
			))}
			<Link href="/docs" className="mt-5 inline-flex min-h-9 items-center text-sm font-medium text-accent hover:underline">Read the API documentation →</Link>
		</section>
	);
}
