/** Follow-up actions from saved conversations using the legacy A2UI renderer. */

/** Format an A2UI server action into a follow-up chat message. */
export function formatA2UIAction(event: {
	name: string;
	context?: Record<string, unknown>;
	dataModel?: Record<string, unknown>;
}): string {
	const payload: Record<string, unknown> = {};
	if (event.context && Object.keys(event.context).length > 0) {
		payload.context = event.context;
	}
	// A2UI v0.9.1 "Client to server updates": the client owns the data model
	// between server messages, so an action carries the whole model back. Any
	// value the user typed lives here, not just the fields the action
	// explicitly bound.
	if (event.dataModel && Object.keys(event.dataModel).length > 0) {
		payload.dataModel = event.dataModel;
	}
	const ctx =
		Object.keys(payload).length > 0
			? `\n\nContext: \`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``
			: "";
	return `[UI action: ${event.name}]${ctx}\n\nPlease continue — act on this UI action result.`;
}
