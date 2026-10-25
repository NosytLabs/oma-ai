import { describe, expect, it } from "vitest";
import { GET } from "../.well-known/agent-card.json/route";

describe("published API discovery capabilities", () => {
	it("advertises the text-only Messages input contract", async () => {
		const card = await GET().json();
		const messages = card.skills.find((skill: { id: string }) => skill.id === "anthropic-messages");
		expect(messages.inputModes).toEqual(["text"]);
		expect(messages.tags).not.toContain("multimodal");
	});

	it("does not advertise ignored JSON mode or an API UI protocol", async () => {
		const card = await GET().json();
		const chat = card.skills.find((skill: { id: string }) => skill.id === "chat-completions");
		expect(chat.tags).not.toContain("json-mode");
		expect(card.capabilities).not.toHaveProperty("a2ui");
		for (const skill of card.skills) {
			expect(skill.outputModes).not.toContain("application/a2ui+json");
		}
	});

});
