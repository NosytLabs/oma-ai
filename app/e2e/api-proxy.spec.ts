import { expect, test } from "@playwright/test";

test("auth proxy rejects decoded route escapes before contacting its backend", async ({ request }) => {
	for (const path of ["..%2F..%2Fadmin", "..%5C..%5Cinternal"]) {
		const response = await request.get(`/api/auth/${path}`);
		expect(response.status()).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: "Invalid auth path" });
	}
});
