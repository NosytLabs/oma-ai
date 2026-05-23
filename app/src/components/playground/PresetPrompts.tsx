'use client'

import { motion } from 'framer-motion'
import { Code2, FileText, Lightbulb, Bug, Sparkles } from 'lucide-react'

interface Preset {
  id: string
  label: string
  icon: typeof Code2
  prompt: string
}

const PRESETS: Preset[] = [
  {
    id: 'code-review',
    label: 'Code Review',
    icon: Code2,
    prompt: 'Review this code for bugs, performance issues, and best practices:\n\n```python\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n```'
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: FileText,
    prompt: 'Summarize the following text in 3 bullet points:\n\nArtificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of "intelligent agents": any device that perceives its environment and takes actions that maximize its chance of success. However, no unified definition of AI exists, and the field has been criticized for inconsistency and bias.'
  },
  {
    id: 'explain',
    label: 'Explain',
    icon: Lightbulb,
    prompt: 'Explain quantum computing in simple terms, covering: 1) What makes it different from classical computing, 2) What are qubits, 3) Why it matters for the future.'
  },
  {
    id: 'debug',
    label: 'Debug',
    icon: Bug,
    prompt: 'Find and fix the bug in this JavaScript code:\n\n```javascript\nfunction findDuplicates(arr) {\n    let duplicates = [];\n    for (let i = 0; i < arr.length; i++) {\n        for (let j = i + 1; j < arr.length; j++) {\n            if (arr[i] === arr[j]) {\n                duplicates.push(arr[i]);\n            }\n        }\n    }\n    return duplicates;\n}\n\nconsole.log(findDuplicates([1, 2, 3, 2, 4, 3, 5]));\n```'
  },
]

interface EmptyStateProps {
  onPreset: (prompt: string) => void
}

export function EmptyState({ onPreset }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-16">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-8"
      >
        <Sparkles className="w-10 h-10 text-accent" />
      </motion.div>
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-3xl font-syne font-bold text-text mb-4"
      >
        What would you like to create?
      </motion.h1>
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-zinc-500 text-lg max-w-md mb-8"
      >
        Ask any question, brainstorm ideas, or explore concepts together.
      </motion.p>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 gap-3"
      >
        {PRESETS.map((preset) => {
          const Icon = preset.icon
          return (
            <button
              key={preset.id}
              onClick={() => onPreset(preset.prompt)}
              className="flex items-center gap-2 px-4 py-3 bg-surface-elevated border border-border rounded-xl text-sm text-zinc-300 hover:border-accent/50 hover:text-accent transition-all"
            >
              <Icon className="w-4 h-4" />
              {preset.label}
            </button>
          )
        })}
      </motion.div>
    </div>
  )
}