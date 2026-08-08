const fs = require('fs');

let f1 = '/Users/tyson/Desktop/Code/products/OMA-AI/server/src/inference/models.ts';
let c1 = fs.readFileSync(f1, 'utf8');

const toRemove = [
  "claude-opus-5",
  "claude-sonnet-5",
  "openai-gpt-54",
  "openai-gpt-52",
  "grok-4-5",
  "deepseek-v4-pro",
  "gemini-3-5-flash",
  "deepseek-v4-flash",
  "mistral-small-2603",
  "mercury-2"
];

for (const id of toRemove) {
  // Regex to match: { id: "some-id", ... },
  const regex = new RegExp(`[ \\t]*\\{\\s*id:\\s*"${id}",[\\s\\S]*?\\},`, 'g');
  c1 = c1.replace(regex, '');
}

fs.writeFileSync(f1, c1);
