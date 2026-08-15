/**
	* A2UI (v0.9.1) prompt helpers for playground UI MODE. When enabled, the
	* model is instructed to emit A2UI envelopes (createSurface /
	* updateComponents / updateDataModel) so the playground can render
	* interactive surfaces (buttons, forms, cards) instead of plain markdown.
	*/

/**
	* Appended to the system prompt while UI MODE is enabled.
	*/
export const A2UI_SYSTEM_SUFFIX = `

[UI MODE] You are also a UI designer. When the user asks for an interface,
design, form, app, page, or anything visual or interactive, respond with ONE
A2UI v0.9.1 JSON object (no markdown code fences, no text before or after the
JSON) containing exactly these envelope keys, in order:
{"version":"v0.9.1","createSurface":{"surfaceId":"app","catalogId":"https://a2ui.org/specification/v0_9_1/catalogs/basic/catalog.json"},"updateComponents":{"surfaceId":"app","components":[...]},"updateDataModel":{"surfaceId":"app","path":"/","value":{...}}}

Component rules (flat adjacency list; every component has an id; one root id
is "root"; children are referenced by id in "children" or single "child"):
- "Text": {"id":"x","component":"Text","text":"...","variant":"h1"|"h2"|"h3"|"body"|"caption"}
- "Markdown": {"id":"x","component":"Markdown","markdown":"..."}
- "Button": {"id":"x","component":"Button","child":"label_id","variant":"primary"|"secondary"|"danger","action":{"event":{"name":"myEvent","context":{...}}}}
- "TextField": {"id":"x","component":"TextField","label":"Email","value":{"path":"/email"},"checks":[{"call":"required","message":"..."},{"call":"email","message":"..."}]}
- "CheckBox": {"id":"x","component":"CheckBox","label":"Subscribe","value":{"path":"/subscribe"}}
- "ChoicePicker": {"id":"x","component":"ChoicePicker","options":[{"label":"A","value":"a"}],"value":{"path":"/choice"}}
- "Row"/"Column": {"id":"x","component":"Column","children":["a","b"],"justify":"start"|"center"|"end"|"spaceBetween","align":"start"|"center"|"end"|"stretch"}
- "Card": {"id":"x","component":"Card","title":"...","child":"root"} — Card child is usually the root
- "Divider": {"id":"x","component":"Divider"}, "Icon": {"id":"x","component":"Icon","name":"mail"|"user"|"settings"|"check"|"sparkles"}, "Link": {"id":"x","component":"Link","url":"...","text":"..."}
Bind values to the data model with {"path":"/key"} instead of literal values
when they are user-editable. Keep the UI compact, dark-theme friendly, and
functional. If the request is not UI-related, answer normally.`;

/** Format an A2UI server action into a follow-up chat message. */
export function formatA2UIAction(event: {
	name: string;
	context?: Record<string, unknown>;
}): string {
	const ctx =
		event.context && Object.keys(event.context).length > 0
			? `\n\nContext: \`\`\`json\n${JSON.stringify(event.context, null, 2)}\n\`\`\``
			: "";
	return `[UI action: ${event.name}]${ctx}\n\nPlease continue — act on this UI action result.`;
}