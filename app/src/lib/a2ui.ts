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
- "Button": {"id":"x","component":"Button","child":"label_id","variant":"default"|"primary"|"borderless","action":{"event":{"name":"myEvent","context":{"email":{"path":"/email"}}}},"checks":[{"condition":{"call":"required","args":{"value":{"path":"/email"}}},"message":"Enter an email first"}]}
- "TextField": {"id":"x","component":"TextField","label":"Email","value":{"path":"/email"},"variant":"shortText"|"longText"|"number"|"obscured","checks":[{"condition":{"call":"required","args":{"value":{"path":"/email"}}},"message":"Email is required"},{"condition":{"call":"email","args":{"value":{"path":"/email"}}},"message":"Enter a valid email"}]}
- "CheckBox": {"id":"x","component":"CheckBox","label":"Subscribe","value":{"path":"/subscribe"}}
- "ChoicePicker": {"id":"x","component":"ChoicePicker","options":[{"label":"A","value":"a"}],"value":{"path":"/choice"},"variant":"mutuallyExclusive"|"multipleSelection","checks":[{"condition":{"call":"required","args":{"value":{"path":"/choice"}}},"message":"Pick one"}]}
- "Row"/"Column": {"id":"x","component":"Column","children":["a","b"],"justify":"start"|"center"|"end"|"spaceBetween","align":"start"|"center"|"end"|"stretch"}
- "Card": {"id":"x","component":"Card","title":"...","child":"root"} — Card child is usually the root
- "Divider": {"id":"x","component":"Divider"}, "Icon": {"id":"x","component":"Icon","name":"mail"|"user"|"settings"|"check"|"sparkles"}, "Link": {"id":"x","component":"Link","url":"...","text":"..."}

Validation rules (A2UI v0.9.1 — getting this shape wrong silently disables the check):
- A check is EXACTLY {"condition": <DynamicBoolean>, "message": "..."}. The
  function call goes INSIDE "condition" — never "call" as a sibling of it.
- DynamicBoolean is {"call":"required","args":{"value":{"path":"/email"}}} or
  {"path":"/someFlag"} or a literal true/false. "args.value" must be a
  {"path":...} binding pointing at the data.
- Available calls: required, email, regex (args: value, pattern), length
  (args: value, min, max), numeric (args: value, min, max), and/or (args:
  values: [...]), not (args: value).
- On a Button, a failing check disables the button and its message is the tooltip.

Binding rules:
- Bind every user-editable value to the data model with {"path":"/key"} —
  never a literal. The client writes the user's input back into the data
  model, so a {"path":"/email"} in a Button's action context resolves to what
  the user actually typed. A literal value cannot be read back.
- Do not use paths for static values (labels, ids, static URLs).

Keep the UI compact, dark-theme friendly, and functional. If the request is
not UI-related, answer normally.`;

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