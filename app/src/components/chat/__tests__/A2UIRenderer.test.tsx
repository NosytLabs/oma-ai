/**
 * A2UI (v0.9.1) renderer — data-model write-back and CheckRule evaluation.
 *
 * Two audit blockers are covered here:
 *
 * 1. User input was kept in local React state only, so a Button's
 *    `action.event.context` binding — resolved against the SERVER-supplied
 *    data model — carried the initial/undefined value instead of what the
 *    user typed. The client now writes input back into the surface data
 *    model and echoes it with the action.
 *
 * 2. The system prompt taught `{"call":"required","message":"..."}` while
 *    the v0.9.1 `CheckRule` schema is `{condition: <DynamicBoolean>,
 *    message: string}`. The old renderer read `check.call`/`check.args`, so
 *    every check the prompt taught was silently dropped. Checks are now
 *    read from `check.condition` and evaluated as a DynamicBoolean.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { A2UIRenderer, type A2UIActionEvent } from "../A2UIRenderer";
import { formatA2UIAction } from "@/lib/a2ui";

/** A one-field form: TextField bound to /email + a submit Button. */
interface FormPayload {
	version: string;
	createSurface: { surfaceId: string };
	updateComponents: { surfaceId: string; components: Array<Record<string, unknown>> };
	updateDataModel: { surfaceId: string; path: string; value: Record<string, unknown> };
}

function formPayload(overrides?: {
	textField?: Record<string, unknown>;
	button?: Record<string, unknown>;
}): FormPayload {
	return {
		version: "v0.9.1",
		createSurface: { surfaceId: "app" },
		updateComponents: {
			surfaceId: "app",
			components: [
				{ id: "root", component: "Column", children: ["field", "submit"] },
				{
					id: "field",
					component: "TextField",
					label: "Email",
					value: { path: "/email" },
					...overrides?.textField,
				},
				{
					id: "submitLabel",
					component: "Text",
					text: "Submit",
				},
				{
					id: "submit",
					component: "Button",
					child: "submitLabel",
					action: {
						event: {
							name: "submitForm",
							context: { email: { path: "/email" } },
						},
					},
					...overrides?.button,
				},
			],
		},
		updateDataModel: { surfaceId: "app", path: "/", value: { email: "" } },
	};
}

describe("A2UIRenderer — user input reaches the data model", () => {
	it("resolves an action's path binding to the value the user typed", () => {
		const onAction = vi.fn<(e: A2UIActionEvent) => void>();
		render(<A2UIRenderer payload={formPayload()} onAction={onAction} />);

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "user@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: /submit/i }));

		expect(onAction).toHaveBeenCalledTimes(1);
		const event = onAction.mock.calls[0][0];
		// The blocker: this used to be "" (the server's initial value).
		expect(event.context).toEqual({ email: "user@example.com" });
	});

	it("echoes the whole data model with the action", () => {
		const onAction = vi.fn<(e: A2UIActionEvent) => void>();
		render(<A2UIRenderer payload={formPayload()} onAction={onAction} />);

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "typed@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: /submit/i }));

		expect(onAction.mock.calls[0][0].dataModel).toMatchObject({
			email: "typed@example.com",
		});
	});

	it("keeps a bound CheckBox in the data model", () => {
		const onAction = vi.fn<(e: A2UIActionEvent) => void>();
		const payload = formPayload();
		payload.updateComponents.components = [
			{ id: "root", component: "Column", children: ["terms", "submit"] },
			{
				id: "terms",
				component: "CheckBox",
				label: "Accept terms",
				value: { path: "/terms" },
			},
			{
				id: "submit",
				component: "Button",
				child: "submitLabel",
				action: {
					event: { name: "submitForm", context: { terms: { path: "/terms" } } },
				},
			},
			{ id: "submitLabel", component: "Text", text: "Submit" },
		];
		payload.updateDataModel = {
			surfaceId: "app",
			path: "/",
			value: { terms: false },
		};

		render(<A2UIRenderer payload={payload} onAction={onAction} />);
		fireEvent.click(screen.getByLabelText("Accept terms"));
		fireEvent.click(screen.getByRole("button", { name: /submit/i }));

		expect(onAction.mock.calls[0][0].context).toEqual({ terms: true });
	});

	it("keeps a bound ChoicePicker selection in the data model", () => {
		const onAction = vi.fn<(e: A2UIActionEvent) => void>();
		const payload = formPayload();
		payload.updateComponents.components = [
			{ id: "root", component: "Column", children: ["plan", "submit"] },
			{
				id: "plan",
				component: "ChoicePicker",
				options: [{ label: "Pro", value: "pro" }],
				value: { path: "/plan" },
			},
			{
				id: "submit",
				component: "Button",
				child: "submitLabel",
				action: {
					event: { name: "submitForm", context: { plan: { path: "/plan" } } },
				},
			},
			{ id: "submitLabel", component: "Text", text: "Submit" },
		];
		payload.updateDataModel = { surfaceId: "app", path: "/", value: { plan: [] } };

		render(<A2UIRenderer payload={payload} onAction={onAction} />);
		fireEvent.click(screen.getByRole("button", { name: "Pro" }));
		fireEvent.click(screen.getByRole("button", { name: /submit/i }));

		expect(onAction.mock.calls[0][0].context).toEqual({ plan: ["pro"] });
	});

	it("writes an unbound control to a deterministic fallback path", () => {
		const onAction = vi.fn<(e: A2UIActionEvent) => void>();
		// No {"path":...} binding — the model chose no identity for the field.
		render(
			<A2UIRenderer
				payload={formPayload({ textField: { value: "seed" } })}
				onAction={onAction}
			/>,
		);

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "typed" },
		});
		fireEvent.click(screen.getByRole("button", { name: /submit/i }));

		expect(onAction.mock.calls[0][0].dataModel).toMatchObject({
			fields: { field: "typed" },
		});
	});
});

describe("A2UIRenderer — CheckRule uses check.condition", () => {
	it("evaluates a condition-wrapped required check against typed input", () => {
		render(
			<A2UIRenderer
				payload={formPayload({
					textField: {
						checks: [
							{
								condition: { call: "required", args: { value: { path: "/email" } } },
								message: "Email is required",
							},
						],
					},
				})}
			/>,
		);

		const input = screen.getByLabelText("Email");
		// Type, then clear. Firing a change straight to the already-rendered
		// "" is a no-op for React's synthetic change event, so the checks
		// would never re-run.
		fireEvent.change(input, { target: { value: "a@b.co" } });
		expect(screen.queryByText("Email is required")).not.toBeInTheDocument();

		// Empty + required → the message must appear. Under the old
		// `check.call` reader this check was never evaluated at all.
		fireEvent.change(input, { target: { value: "" } });
		expect(screen.getByText("Email is required")).toBeInTheDocument();
	});

	it("supports the boolean and/or composition the spec documents", () => {
		render(
			<A2UIRenderer
				payload={formPayload({
					button: {
						checks: [
							{
								condition: {
									call: "and",
									args: {
										values: [
											{ call: "required", args: { value: { path: "/email" } } },
											{
												call: "or",
												args: {
													values: [
														{ call: "required", args: { value: { path: "/email" } } },
													],
												},
											},
										],
									},
								},
								message: "Provide an email",
							},
						],
					},
				})}
			/>,
		);

		const submit = screen.getByRole("button", { name: /submit/i });
		expect(submit).toBeDisabled();

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.co" },
		});
		expect(screen.getByRole("button", { name: /submit/i })).toBeEnabled();
	});

	it("disables a Button whose check fails (v0.9.1 button validation)", () => {
		const onAction = vi.fn<(e: A2UIActionEvent) => void>();
		render(
			<A2UIRenderer
				payload={formPayload({
					button: {
						checks: [
							{
								condition: { call: "email", args: { value: { path: "/email" } } },
								message: "Enter a valid email",
							},
						],
					},
				})}
				onAction={onAction}
			/>,
		);

		const submit = screen.getByRole("button", { name: /submit/i });
		expect(submit).toBeDisabled();
		fireEvent.click(submit);
		expect(onAction).not.toHaveBeenCalled();

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "not-an-email" },
		});
		expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.co" },
		});
		const enabled = screen.getByRole("button", { name: /submit/i });
		expect(enabled).toBeEnabled();
		fireEvent.click(enabled);
		expect(onAction).toHaveBeenCalledTimes(1);
	});

	it("still accepts the flat {call,args,message} form from the spec prose", () => {
		render(
			<A2UIRenderer
				payload={formPayload({
					textField: {
						checks: [{ call: "required", args: { value: { path: "/email" } }, message: "Needed" }],
					},
				})}
			/>,
		);
		const input = screen.getByLabelText("Email");
		fireEvent.change(input, { target: { value: "a@b.co" } });
		fireEvent.change(input, { target: { value: "" } });
		expect(screen.getByText("Needed")).toBeInTheDocument();
	});
});

describe("formatA2UIAction", () => {
	it("carries the data model so the server sees user input", () => {
		const msg = formatA2UIAction({
			name: "submitForm",
			context: { email: "a@b.co" },
			dataModel: { email: "a@b.co", plan: ["pro"] },
		});
		expect(msg).toContain("submitForm");
		expect(msg).toContain('"email": "a@b.co"');
		expect(msg).toContain('"plan"');
	});

	it("stays clean when there is nothing to send", () => {
		expect(formatA2UIAction({ name: "ping" })).toBe(
			"[UI action: ping]\n\nPlease continue — act on this UI action result.",
		);
	});
});
