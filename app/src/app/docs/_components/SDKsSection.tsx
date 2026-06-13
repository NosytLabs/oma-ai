'use client'

import { Package, Terminal } from 'lucide-react'
import { SectionHeading, AnimatedSection, SubHeading, TabbedCode, CodeBlock } from './SharedComponents'

const INSTALL: { manager: string; command: string }[] = [
  { manager: 'npm',     command: 'npm install openai' },
  { manager: 'pnpm',    command: 'pnpm add openai' },
  { manager: 'yarn',    command: 'yarn add openai' },
  { manager: 'pip',     command: 'pip install openai' },
  { manager: 'poetry',  command: 'poetry add openai' },
  { manager: 'go get',  command: 'go get github.com/sashabaranov/go-openai' },
]

const TABS = [
  {
    label: 'Python',
    lang: 'python',
    code: `# pip install openai
from openai import OpenAI

client = OpenAI(
    api_key="oma_sk_your_key_here",
    base_url="https://api.oma-ai.com/v1",
)

response = client.chat.completions.create(
    model="llama-3.2-3b",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`,
  },
  {
    label: 'JavaScript',
    lang: 'javascript',
    code: `// npm install openai
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "oma_sk_your_key_here",
  baseURL: "https://api.oma-ai.com/v1",
});

const response = await client.chat.completions.create({
  model: "llama-3.2-3b",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(response.choices[0].message.content);`,
  },
  {
    label: 'cURL',
    lang: 'bash',
    code: `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer oma_sk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.2-3b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
  },
  {
    label: 'Go',
    lang: 'go',
    code: `// go get github.com/sashabaranov/go-openai
package main

import (
    "fmt"
    openai "github.com/sashabaranov/go-openai"
)

func main() {
    client := openai.NewClient("oma_sk_your_key_here")
    client.BaseURL = "https://api.oma-ai.com/v1"

    resp, err := client.CreateChatCompletion(
        context.Background(),
        openai.ChatCompletionRequest{
            Model: "llama-3.2-3b",
            Messages: []openai.ChatCompletionMessage{
                {Role: "user", Content: "Hello!"},
            },
        },
    )
    if err != nil { panic(err) }
    fmt.Println(resp.Choices[0].Message.Content)
}`,
  },
]

export function SDKsSection() {
  return (
    <AnimatedSection delay={500}>
      <SectionHeading
        id="sdks"
        icon={<Package className="h-5 w-5" />}
        title="SDK installation"
        subtitle="Any OpenAI-compatible client works. Change the base URL and you&apos;re done."
      />

      <SubHeading id="sdk-openai">OpenAI SDK</SubHeading>

      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {INSTALL.map((i) => (
          <div
            key={i.manager}
            className="group rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 px-3 py-2.5 transition-colors hover:border-[var(--color-border-bright)]/60"
          >
            <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
              <Terminal className="h-3 w-3" />
              {i.manager}
            </div>
            <code className="block truncate font-mono text-[13px] text-[var(--color-accent)]">
              {i.command}
            </code>
          </div>
        ))}
      </div>

      <TabbedCode tabs={TABS} />

      <SubHeading id="sdk-vercel">Vercel AI SDK</SubHeading>
      <CodeBlock
        code={`import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const oma = createOpenAI({
  baseURL: 'https://api.oma-ai.com/v1',
  apiKey: 'oma_sk_...',
});

const { text } = await generateText({
  model: oma('llama-3.2-3b'),
  prompt: 'Hello!',
});
console.log(text);`}
        title="Vercel AI SDK"
        lang="typescript"
      />

      <SubHeading id="sdk-langchain">LangChain</SubHeading>
      <CodeBlock
        code={`from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(
    model="llama-3.2-3b",
    api_key="oma_sk_...",
    base_url="https://api.oma-ai.com/v1",
)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are concise."),
    ("human", "{input}"),
])

chain = prompt | llm
print(chain.invoke({"input": "Hello!"}).content)`}
        title="LangChain"
        lang="python"
      />

      <SubHeading id="sdk-direct">Direct HTTP</SubHeading>
      <p className="mb-3 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
        No SDK? No problem. Plain HTTP works just as well — just POST JSON to{' '}
        <code className="rounded border border-[var(--color-border)]/60 bg-[var(--color-panel)] px-1 font-mono text-[0.85em] text-[var(--color-accent)]">
          /v1/chat/completions
        </code>
        .
      </p>
      <CodeBlock
        code={`import requests

response = requests.post(
    "https://api.oma-ai.com/v1/chat/completions",
    headers={
        "Authorization": "Bearer oma_sk_your_key_here",
        "Content-Type": "application/json",
    },
    json={
        "model": "llama-3.2-3b",
        "messages": [{"role": "user", "content": "Hello!"}],
    },
)
print(response.json())`}
        title="Direct HTTP"
        lang="python"
      />
    </AnimatedSection>
  )
}
