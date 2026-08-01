"use client";

/**
 * EXAMPLE CONVERSATIONS — Sophisticated prompt showcase
 *
 * These examples demonstrate the range of OMA AI's capabilities,
 * from quick one-liners to complex multi-step analysis. Each is
 * designed to feel like a real prompt a power user would write —
 * not a toy demo.
 *
 * Categories:
 *   - Code: Real debugging, architecture, optimization
 *   - Analysis: Data reasoning, comparison, extraction
 *   - Creative: Writing, ideation, storytelling
 *   - Research: Multi-source synthesis, fact-checking
 *   - Quick: One-shot tasks that show speed
 */

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import {
	BarChart3,
	ChevronRight,
	Code2,
	Coins,
	FlaskConical,
	Lightbulb,
	Zap,
} from "lucide-react";
import { useState } from "react";

export interface ExampleConversation {
	id: string;
	title: string;
	subtitle: string;
	category: string;
	icon: typeof Code2;
	prompt: string;
	model: string;
	modelName: string;
	difficulty: "quick" | "moderate" | "advanced";
	estimatedCost?: string;
}

export const EXAMPLES: ExampleConversation[] = [
	// ─── CODE ───
	{
		id: "debug-race-condition",
		title: "Debug a race condition",
		subtitle: "Concurrency bug in async Node.js",
		category: "Code",
		icon: Code2,
		prompt: `This code sometimes double-charges users. Find the race condition and fix it:

\`\`\`typescript
async function processPayment(orderId: string) {
  const order = await db.orders.findById(orderId);
  if (order.status !== 'pending') return { error: 'Already processed' };
  
  const charge = await stripe.charges.create({
    amount: order.amount,
    currency: 'usd',
    customer: order.stripeCustomerId,
  });

  await db.orders.update(orderId, {
    status: 'paid',
    chargeId: charge.id,
  });

  return { success: true, chargeId: charge.id };
}
\`\`\`

Two concurrent requests with the same orderId can both pass the status check before either updates it. Show me a proper fix using database-level locking or an idempotency key.`,
		model: "minimax-m2.7",
		modelName: "MiniMax 2.7 (free)",
		difficulty: "advanced",
	},
	{
		id: "api-design",
		title: "Design a rate-limited API",
		subtitle: "REST API with sliding window",
		category: "Code",
		icon: Code2,
		prompt: `Design a production-grade rate limiter for a REST API that supports:
- Per-user AND per-endpoint limits (different limits per route)
- Sliding window algorithm (not fixed window)
- Redis-backed for distributed deployments
- Graceful degradation if Redis is down

Give me the TypeScript implementation with proper types, tests, and middleware integration for Express/Hono.`,
		model: "minimax-m2.7",
		modelName: "MiniMax 2.7 (free)",
		difficulty: "advanced",
	},

	// ─── ANALYSIS ───
	{
		id: "sql-optimization",
		title: "Optimize slow SQL query",
		subtitle: "Query taking 12s on 2M rows",
		category: "Analysis",
		icon: BarChart3,
		prompt: `This query takes 12 seconds on a table with 2M rows. How would you optimize it? Consider indexing, query restructuring, and whether materialized views would help.

\`\`\`sql
SELECT 
  u.name,
  COUNT(DISTINCT o.id) as order_count,
  SUM(oi.quantity * oi.price) as total_spent,
  MAX(o.created_at) as last_order_date
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.created_at >= NOW() - INTERVAL '90 days'
  AND u.country = 'US'
GROUP BY u.id, u.name
HAVING total_spent > 100
ORDER BY total_spent DESC
LIMIT 50;
\`\`\`

The users table has 500K rows, orders has 2M, order_items has 8M. Current indexes: users(id), orders(user_id), order_items(order_id).`,
		model: "kimi-k2.6",
		modelName: "Kimi K2.6 (free)",
		difficulty: "moderate",
	},
	{
		id: "compare-approaches",
		title: "Compare technical approaches",
		subtitle: "WebSocket vs SSE vs polling",
		category: "Analysis",
		icon: BarChart3,
		prompt: `I'm building a real-time dashboard that shows:
- Live metrics (CPU, memory, request rates) — updates every 1-2s
- Alert notifications — must arrive within 500ms
- User presence indicators — who's online

Compare WebSocket, Server-Sent Events, and polling for this use case. Consider: connection overhead, browser support, scaling behind a load balancer, and what happens when a connection drops. Give me a concrete recommendation with implementation notes.`,
		model: "kimi-k2.6",
		modelName: "Kimi K2.6 (free)",
		difficulty: "moderate",
	},

	// ─── CREATIVE ───
	{
		id: "technical-blog",
		title: "Write a technical deep-dive",
		subtitle: "Blog post on CRDTs for engineers",
		category: "Creative",
		icon: Lightbulb,
		prompt: `Write a technical blog post titled "CRDTs in Practice: What We Learned Building a Collaborative Editor"

Target audience: Backend engineers who've heard of CRDTs but never implemented one. Structure:
1. Hook — a real problem CRDTs solved for us
2. How CRDTs work (keep it visual, use ASCII diagrams)
3. Implementation choices we made and why
4. Performance gotchas we hit in production
5. When NOT to use CRDTs

Tone: Technical but conversational. Like explaining to a colleague over coffee. ~2000 words.`,
		model: "minimax-m2.7",
		modelName: "MiniMax 2.7 (free)",
		difficulty: "moderate",
	},
	{
		id: "product-naming",
		title: "Generate product names",
		subtitle: "SaaS tool for API monitoring",
		category: "Creative",
		icon: Lightbulb,
		prompt: `Generate 10 product name candidates for a developer tool that:
- Monitors API health and performance
- Provides intelligent alerting (not just threshold-based)
- Has a beautiful terminal-inspired UI

Requirements:
- Must be .com available (or clever alternative)
- 1-2 words max
- Evokes precision, visibility, or control
- Easy to say and spell

For each name, explain the reasoning in one sentence.`,
		model: "minimax-m2.7",
		modelName: "MiniMax 2.7 (free)",
		difficulty: "quick",
	},

	// ─── RESEARCH ───
	{
		id: "security-audit",
		title: "Security review",
		subtitle: "Audit auth middleware",
		category: "Research",
		icon: FlaskConical,
		prompt: `Review this authentication middleware for security vulnerabilities. Check for: token validation issues, timing attacks, injection vectors, privilege escalation, and OWASP top 10 gaps.

\`\`\`typescript
app.use('/api/admin/*', async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  
  const decoded = jwt.verify(token, SECRET_KEY);
  const user = await db.users.findById(decoded.userId);
  
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  req.user = user;
  next();
});
\`\`\`

Be specific about each vulnerability and provide the corrected code.`,
		model: "kimi-k2.6",
		modelName: "Kimi K2.6 (free)",
		difficulty: "advanced",
	},

	// ─── QUICK ───
	{
		id: "regex-explain",
		title: "Explain a regex",
		subtitle: "What does this pattern match?",
		category: "Quick",
		icon: Zap,
		prompt: `What does this regex match? Break it down piece by piece:

\`\`\`
/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,64}$/
\`\`\`

Then suggest 3 passwords that would pass and 3 that would fail, with explanations.`,
		model: "minimax-m2.7",
		modelName: "MiniMax 2.7 (free)",
		difficulty: "quick",
		estimatedCost: "< $0.001",
	},
	{
		id: "git-blame",
		title: "Git commit message",
		subtitle: "Conventional commit for a refactor",
		category: "Quick",
		icon: Zap,
		prompt: `Write a conventional commit message for this change:

Moved the rate limiter from middleware/rateLimit.ts to lib/rate-limiter.ts, switched from in-memory Map to Redis, added configurable window sizes per endpoint, and updated all route handlers to use the new interface. Old middleware is removed.`,
		model: "minimax-m2.7",
		modelName: "MiniMax 2.7 (free)",
		difficulty: "quick",
		estimatedCost: "< $0.001",
	},
];

const CATEGORY_COLORS: Record<string, string> = {
	Code: "var(--color-accent)",
	Analysis: "var(--color-success)",
	Creative: "var(--color-warning)",
	Research: "var(--color-info)",
	Quick: "var(--color-tertiary)",
};

const DIFFICULTY_LABELS = {
	quick: { label: "QUICK", color: "var(--color-success)" },
	moderate: { label: "MODERATE", color: "var(--color-warning)" },
	advanced: { label: "ADVANCED", color: "var(--color-accent)" },
};

interface ExampleConversationsProps {
	onSelect: (example: ExampleConversation) => void;
}

export function ExampleConversations({ onSelect }: ExampleConversationsProps) {
	const [expandedId, setExpandedId] = useState<string | null>(null);

	return (
		<div
			className="w-full max-w-4xl mx-auto px-4 md:px-0 py-8"
			id="example-conversations"
		>
			<div className="mb-6">
				<h2 className="text-xs font-mono font-bold text-text-muted uppercase tracking-widest">
					{"// PROMPT EXAMPLES"}
				</h2>
				<p className="text-[11px] text-text-muted font-mono mt-1">
					CLICK TO PRE-FILL · SWITCH MODELS TO COMPARE OUTPUTS
				</p>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{EXAMPLES.map((example, i) => {
					const Icon = example.icon;
					const isExpanded = expandedId === example.id;
					const catColor =
						CATEGORY_COLORS[example.category] || "var(--color-text-muted)";
					const diff = DIFFICULTY_LABELS[example.difficulty];

					return (
						<m.div
							key={example.id}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: i * 0.03, duration: 0.2 }}
						>
							<button
								type="button"
								onClick={() => {
									if (isExpanded) {
										onSelect(example);
									} else {
										setExpandedId(isExpanded ? null : example.id);
									}
								}}
								onMouseEnter={() => setExpandedId(example.id)}
								onMouseLeave={() => setExpandedId(null)}
								className="group w-full text-left p-4 border border-border bg-void hover:border-success/40 hover:bg-surface transition-all focus-ring"
							>
								<div className="flex items-start gap-3">
									<div
										className="shrink-0 w-8 h-8 flex items-center justify-center border border-border bg-surface group-hover:border-success/30 transition-colors"
										style={{
											borderColor: isExpanded ? `color-mix(in srgb, ${catColor} 25%, transparent)` : undefined,
										}}
									>
										<Icon className="w-4 h-4" style={{ color: catColor }} />
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-0.5">
											<h3 className="text-xs font-mono font-bold text-text uppercase tracking-wide truncate">
												{example.title}
											</h3>
											<ChevronRight
												className={`w-3 h-3 text-text-muted transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
											/>
										</div>
										<p className="text-[10px] font-mono text-text-muted truncate mb-2">
											{example.subtitle}
										</p>

										{/* Expanded preview */}
										<AnimatePresence>
											{isExpanded && (
												<m.div
													initial={{ height: 0, opacity: 0 }}
													animate={{ height: "auto", opacity: 1 }}
													exit={{ height: 0, opacity: 0 }}
													transition={{ duration: 0.15 }}
													className="overflow-hidden"
												>
													<p className="text-[10px] font-mono text-text-muted/80 leading-relaxed mb-2 line-clamp-3">
														{example.prompt.slice(0, 200)}...
													</p>
													<span className="inline-flex items-center gap-1 text-[10px] font-mono text-accent group-hover:text-success transition-colors">
														USE THIS PROMPT
														<ChevronRight className="w-2.5 h-2.5" />
													</span>
												</m.div>
											)}
										</AnimatePresence>

										{/* Badges */}
										<div className="flex items-center gap-1.5 mt-2 flex-wrap">
											<span
												className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border"
												style={{
													borderColor: `color-mix(in srgb, ${catColor} 19%, transparent)`,
													color: catColor,
													backgroundColor: `color-mix(in srgb, ${catColor} 3%, transparent)`,
												}}
											>
												{example.category}
											</span>
											<span
												className="px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border"
												style={{
													borderColor: `color-mix(in srgb, ${diff.color} 19%, transparent)`,
													color: diff.color,
													backgroundColor: `color-mix(in srgb, ${diff.color} 3%, transparent)`,
												}}
											>
												{diff.label}
											</span>
											<span className="px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20 text-[9px] font-mono uppercase tracking-wider">
												{example.modelName}
											</span>
											{example.estimatedCost && (
												<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-success/10 text-success border border-success/20 text-[9px] font-mono uppercase tracking-wider">
													<Coins className="w-2.5 h-2.5" />
													{example.estimatedCost}
												</span>
											)}
										</div>
									</div>
								</div>
							</button>
						</m.div>
					);
				})}
			</div>
		</div>
	);
}
