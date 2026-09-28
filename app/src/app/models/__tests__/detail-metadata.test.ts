import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMetadata } from "../[slug]/page";

vi.mock("../[slug]/_components/StaticModelDetail", () => ({ StaticModelDetail: () => null }));
vi.mock("../[slug]/_components/LiveModelDetail", () => ({ LiveModelDetail: () => null }));

afterEach(() => vi.unstubAllGlobals());

describe("model detail indexing", () => {
	it("keeps catalog reference pages indexable without checking provider health", async () => {
		const fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ data: [{ id: "kimi-k3", available: false }] }),
		});
		vi.stubGlobal("fetch", fetch);

		const metadata = await generateMetadata({ params: Promise.resolve({ slug: "kimi-k3" }) });

		expect(metadata.robots).toEqual({ index: true, follow: true });
		expect(metadata.alternates?.canonical).toBe("https://www.oma-ai.com/models/kimi-k3");
		expect(fetch).not.toHaveBeenCalled();
	});
});
