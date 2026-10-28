import { test, expect, openChat } from "./chat-fixtures";

test("comparison transcripts and drafts stay with the account that created them", async ({ page, chatApi }) => {
	chatApi.userId = "synthetic-chat-a";
	await page.goto("/chat?model=minimax-m2-7");
	await expect(page.getByRole("textbox", { name: "Enter your message", exact: true })).toBeEnabled();
	await page.getByRole("button", { name: "More chat actions" }).click();
	await page.getByRole("menuitem", { name: "Compare models" }).click();
	const panel = page.getByRole("complementary", { name: "Model comparison panel" });
	await expect(panel).toBeVisible();
	await panel.getByPlaceholder("Type to compare...").fill("Synthetic private prompt A");
	chatApi.replyNext("Synthetic account A response");
	chatApi.replyNext("Synthetic account A response");
	await panel.getByRole("button", { name: "SEND TO BOTH" }).click();
	await expect(panel.getByText("Synthetic account A response", { exact: true })).toBeVisible();
	await expect(panel.getByRole("button", { name: "SEND TO BOTH" })).toBeEnabled();
	await panel.getByPlaceholder("Type to compare...").fill("Synthetic unsent comparison draft A");
	await chatApi.switchAccount("synthetic-chat-b");
	await expect(panel).toBeHidden();
	await expect(page.getByText("Synthetic private prompt A", { exact: true })).toHaveCount(0);
	await expect(page.getByRole("textbox", { name: "Enter your message", exact: true })).toBeEnabled();
	await page.getByRole("button", { name: "More chat actions" }).click();
	await page.getByRole("menuitem", { name: "Compare models" }).click();
	await expect(panel.getByPlaceholder("Type to compare...")).toHaveValue("");
	await panel.getByPlaceholder("Type to compare...").fill("Synthetic independent prompt B");
	chatApi.replyNext("Synthetic account B response");
	chatApi.replyNext("Synthetic account B response");
	await panel.getByRole("button", { name: "SEND TO BOTH" }).click();
	await expect(panel.getByText("Synthetic account B response", { exact: true })).toBeVisible();
	expect(chatApi.requests).toHaveLength(4);
	for (const request of chatApi.requests.slice(2)) expect(request.messages).toEqual([{ role: "user", content: "Synthetic independent prompt B" }]);
});

test.describe("Chat playground", () => {
	test.beforeEach(async ({ page }) => {
		await openChat(page);
	});

	test("opens parameters from an empty conversation", async ({ page }) => {
		const toolbar = page.locator('header[aria-label="Chat toolbar"]');
		await expect(toolbar.getByRole("button", { name: "New conversation", exact: true })).toBeVisible();
		await expect(toolbar.getByRole("button", { name: /history/i })).toBeVisible();
		await toolbar.getByRole("button", { name: "More chat actions", exact: true }).click();
		const menu = page.getByRole("menu", { name: "More chat actions", exact: true });
		await expect(menu).toBeVisible();
		await menu.getByRole("menuitem", { name: "Parameters", exact: true }).click();
		await expect(page.getByRole("slider", { name: "Temperature", exact: true }).filter({ visible: true })).toBeVisible();
		await page.getByRole("button", { name: "Close parameters panel", exact: true }).filter({ visible: true }).click();
		await expect(page.getByRole("slider", { name: "Temperature", exact: true }).filter({ visible: true })).toHaveCount(0);
	});

	test("copies a model link before the first message", async ({ page, context, chatApi }) => {
		await context.grantPermissions(["clipboard-read", "clipboard-write"]);
		await page.getByRole("button", { name: /^Select AI model/ }).click();
		await page.getByRole("menuitemradio", { name: /^MiniMax M2\.7,/ }).click();
		await page.getByRole("button", { name: "More chat actions", exact: true }).click();
		await page.getByRole("menuitem", { name: "Copy model link", exact: true }).click();
		await expect(page.getByText(/Model link copied/)).toBeVisible();
		const copied = await page.evaluate(() => navigator.clipboard.readText());
		expect(new URL(copied).pathname).toBe("/chat");
		expect([...new URL(copied).searchParams]).toEqual([["model", "minimax-m2-7"]]);
		expect(chatApi.requests).toHaveLength(0);
	});

	test("keyboard shortcuts target current controls and Escape closes only the active popup", async ({ page }) => {
		const modifier = await page.evaluate(() => /Mac|iPhone|iPad/.test(navigator.platform) ? "Meta" : "Control");
		const temperature = page.getByRole("slider", { name: "Temperature", exact: true }).filter({ visible: true });
		const modelMenu = page.getByRole("menu", { name: "Available AI models", exact: true });
		const more = page.getByRole("button", { name: "More chat actions", exact: true });
		await page.keyboard.press(`${modifier}+/`);
		await expect(temperature).toBeVisible();
		await page.keyboard.press(`${modifier}+k`);
		await expect(modelMenu).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(modelMenu).toBeHidden();
		await expect(temperature).toBeVisible();
		await more.click();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("menu", { name: "More chat actions", exact: true })).toBeHidden();
		await expect(more).toBeFocused();
		await expect(temperature).toBeVisible();
		await page.keyboard.press(`${modifier}+Shift+p`);
		await expect(page.getByRole("textbox", { name: "System prompt", exact: true })).toBeVisible();
		await more.click();
		await page.getByRole("menuitem", { name: "Keyboard shortcuts", exact: true }).click();
		const help = page.getByRole("dialog", { name: "Keyboard shortcuts", exact: true });
		await expect(help.getByText("Toggle instructions panel", { exact: true })).toBeVisible();
		await expect(help.getByText(/Create studio/)).toHaveCount(0);
		await page.keyboard.press("Escape");
		await expect(help).toBeHidden();
		await expect(temperature).toBeVisible();
	});

	test("keeps UI and web controls visible when the draft is typed and cleared", async ({ page }) => {
		const input = page.getByRole("textbox", { name: "Enter your message", exact: true });
		const ui = page.getByRole("button", { name: /^Toggle UI mode/ });
		const web = page.getByRole("button", { name: /^Toggle web search/ });
		await expect(ui).toBeVisible();
		await expect(web).toBeVisible();
		await ui.click();
		await web.click();
		await expect(ui).toHaveAttribute("aria-pressed", "true");
		await expect(web).toHaveAttribute("aria-pressed", "true");

		await input.fill("A draft that I decide to clear");
		await expect(ui).toBeVisible();
		await expect(web).toBeVisible();
		await input.clear();
		await expect(ui).toBeVisible();
		await expect(web).toBeVisible();
		await expect(ui).toHaveAttribute("aria-pressed", "true");
		await expect(web).toHaveAttribute("aria-pressed", "true");
		await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
	});

	test("selects a model and sends the prompt to that model", async ({ page, chatApi }) => {
		await page.getByRole("button", { name: /^Select AI model/ }).click();
		const menu = page.getByRole("menu", { name: "Available AI models", exact: true });
		// GLM-5.3 and DeepSeek V4 Flash are temporarily paused in the product
		// (server model-catalog.json disabledReason; the frontend mirrors it via
		// mapLiveModel's static-catalog AND). Guests get exactly ONE selectable
		// free model plus an explicit paused-models notice.
		await expect(menu.getByRole("menuitemradio")).toHaveCount(1);
		await expect(menu.getByText("2 models are temporarily unavailable.")).toBeVisible();
		await menu.getByRole("menuitemradio", { name: /^MiniMax M2\.7,/ }).click();
		await expect(menu).toBeHidden();
		await expect(page.getByRole("button", { name: /^Select AI model/ })).toHaveAccessibleName(/MiniMax M2\.7/);

		chatApi.replyNext("Model selection reached the completion request.");
		await page.getByRole("textbox", { name: "Enter your message", exact: true }).fill("Answer using the model I selected.");
		await page.getByRole("button", { name: "Send message", exact: true }).click();
		await expect(page.getByText("Model selection reached the completion request.", { exact: true })).toBeVisible();
		expect(chatApi.requests).toHaveLength(1);
		expect(chatApi.requests[0]).toMatchObject({
			model: "minimax-m2-7",
			stream: true,
			messages: [{ role: "user", content: "Answer using the model I selected." }],
		});
	});

	test("renders an answer and keeps send controls ready for the next turn", async ({ page, chatApi }) => {
		chatApi.replyNext("**Ready for the next turn.**\n\n1. First useful step.\n2. Second useful step.");
		const input = page.getByRole("textbox", { name: "Enter your message", exact: true });
		await input.fill("Give me two useful steps.");
		await input.press("Enter");
		await expect(page.locator("strong").filter({ hasText: "Ready for the next turn." })).toHaveText("Ready for the next turn.");
		await expect(page.getByRole("listitem").filter({ hasText: "Second useful step." })).toBeVisible();
		await expect(input).toHaveValue("");
		await expect(input).toBeEnabled();
		await expect(page.getByRole("button", { name: "Stop generation", exact: true })).toBeHidden();
		await expect(page.getByRole("button", { name: "Copy message", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "Regenerate response", exact: true })).toBeVisible();
		await expect(page.getByText("19 free left", { exact: true })).toBeVisible();
		await input.fill("Here is my next question.");
		await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeEnabled();
	});

	test("stops an in-flight request and can send again", async ({ page, chatApi }) => {
		const pending = chatApi.holdNextCompletion();
		const input = page.getByRole("textbox", { name: "Enter your message", exact: true });
		await input.fill("Keep this response pending until I stop it.");
		await input.press("Enter");
		await pending.started;
		const stop = page.getByRole("button", { name: "Stop generation", exact: true });
		await expect(stop).toBeVisible();
		await expect(input).toBeDisabled();
		await stop.click();
		// Assert recovery before releasing the fixture. Otherwise the fixture's
		// abort could hide a broken Stop button.
		await expect(stop).toBeHidden();
		await expect(input).toBeEnabled();
		await pending.release();

		chatApi.replyNext("The next request completed after cancellation.");
		await input.fill("Try the next request.");
		await input.press("Enter");
		await expect(page.getByText("The next request completed after cancellation.", { exact: true })).toBeVisible();
		expect(chatApi.requests).toHaveLength(2);
		expect(chatApi.requests[1].messages.at(-1)).toEqual({
			role: "user",
			content: "Try the next request.",
		});
	});

	test("applies an OpenUI form to the next request without another model call", async ({ page, chatApi }, testInfo) => {
		const ui = page.getByRole("button", { name: /^Toggle UI mode/ });
		await ui.click();
		// The form requests an AVAILABLE free model: DeepSeek V4 Flash and GLM-5.3
		// are temporarily paused in the product, so the only selectable guest model
		// is MiniMax M2.7. Keep the test deterministic about that selection.
		chatApi.replyNext('root = Card("Tune this request", [settings])\nsettings = SettingsForm("minimax-m2-7", 0.7, 0.9, 2048)');
		const input = page.getByRole("textbox", { name: "Enter your message", exact: true });
		await input.fill("Give me a form to tune the model settings.");
		await input.press("Enter");
		await expect(page.getByText("Tune this request", { exact: true })).toBeVisible();
		await expect(page.getByRole("combobox", { name: "Model", exact: true })).toHaveValue("minimax-m2-7");
		await page.getByRole("spinbutton", { name: "Temperature", exact: true }).fill("1.2");
		await page.getByRole("button", { name: "Apply settings", exact: true }).click();
		await expect(page.getByRole("status").filter({ hasText: "Settings applied" })).toBeVisible();
		expect(chatApi.requests).toHaveLength(1);
		await expect(page.getByRole("button", { name: /^Select AI model/ })).toHaveAccessibleName(/MiniMax M2\.7/);
		const screenshot = testInfo.outputPath("chat-openui-settings.png");
		await page.screenshot({ path: screenshot, animations: "disabled" });
		await testInfo.attach("OpenUI form after applying settings", { path: screenshot, contentType: "image/png" });

		await ui.click();
		chatApi.replyNext("The configured request completed.");
		await input.fill("Use the settings I just applied.");
		await input.press("Enter");
		await expect(page.getByText("The configured request completed.", { exact: true })).toBeVisible();
		expect(chatApi.requests).toHaveLength(2);
		expect(chatApi.requests[1]).toMatchObject({
			model: "minimax-m2-7",
			temperature: 1.2,
			top_p: 0.9,
			max_tokens: 2048,
		});
	});
});

test.describe("Chat history migration", () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test("migrates a legacy thread and restores each thread's messages and draft after reload", async ({ page, chatApi }) => {
		await page.addInitScript(() => {
			if (sessionStorage.getItem("oma_e2e_legacy_seeded")) return;
			localStorage.setItem("oma_chat_conversation:guest", JSON.stringify([
				{ id: "legacy-user", role: "user", content: "Help me keep notes.", timestamp: 1791489600000 },
				{ id: "legacy-assistant", role: "assistant", content: "Your legacy notes are still here.", timestamp: 1791489601000 },
			]));
			sessionStorage.setItem("oma_e2e_legacy_seeded", "1");
		});
		await openChat(page);
		await expect(page.getByText("Your legacy notes are still here.", { exact: true })).toBeVisible();
		const input = page.getByRole("textbox", { name: "Enter your message", exact: true });
		await input.fill("Keep this draft with my legacy notes.");
		await page.locator('header[aria-label="Chat toolbar"]').getByRole("button", { name: "New conversation", exact: true }).click();
		await expect(input).toHaveValue("");
		await expect(page.getByText("Your legacy notes are still here.", { exact: true })).toBeHidden();

		chatApi.replyNext("This answer belongs to the second thread.");
		await input.fill("Create a second thread.");
		await input.press("Enter");
		await expect(page.getByText("This answer belongs to the second thread.", { exact: true })).toBeVisible();
		await input.fill("Draft kept in the second thread.");
		await page.getByRole("button", { name: "Conversation history", exact: true }).click();
		const history = page.getByRole("dialog", { name: "Conversation history", exact: true });
		await expect(history).toBeVisible();
		await expect(history.getByText("Saved only in this browser on this device.", { exact: true })).toBeVisible();
		await history.getByRole("searchbox", { name: "Search chats", exact: true }).fill("help me keep");
		await history.getByRole("button", { name: "Open Help me keep notes.", exact: true }).click();
		await expect(history).toBeHidden();
		await expect(input).toHaveValue("Keep this draft with my legacy notes.");
		await expect(page.getByText("Your legacy notes are still here.", { exact: true })).toBeVisible();
		await expect(page.getByText("This answer belongs to the second thread.", { exact: true })).toBeHidden();

		// Reload immediately, without waiting for the save debounce: pagehide /
		// beforeunload must flush the selected thread and draft.
		await page.reload();
		await expect(page.getByText("Your legacy notes are still here.", { exact: true })).toBeVisible();
		await expect(input).toHaveValue("Keep this draft with my legacy notes.");
		await page.getByRole("button", { name: "Conversation history", exact: true }).click();
		await history.getByRole("button", { name: "Open Create a second thread.", exact: true }).click();
		await expect(input).toHaveValue("Draft kept in the second thread.");
		await expect(page.getByText("This answer belongs to the second thread.", { exact: true })).toBeVisible();
		await expect(page.getByText("Your legacy notes are still here.", { exact: true })).toBeHidden();
	});
});
