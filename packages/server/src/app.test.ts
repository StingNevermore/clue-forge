import { describe, expect, it } from "vitest";
import { app } from "./app";

describe("API app", () => {
	it("returns JSON for unknown routes", async () => {
		const response = await app.request("/missing");
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body).toStrictEqual({ error: "Not found" });
	});
});
