import { describe, expect, it } from "vitest";
import { app } from "./app";

describe("API app", () => {
	it("returns health data", async () => {
		const response = await app.request("/health");
		const body: unknown = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(body).toMatchObject({
			ok: true,
			service: "clue-forge-api",
		});

		if (!body || typeof body !== "object") {
			throw new Error("Health response must be an object");
		}

		const { time } = body as { time?: unknown };
		if (typeof time !== "string") {
			throw new Error("Health time must be a string");
		}

		expect(Date.parse(time)).not.toBeNaN();
	});

	it("returns JSON for unknown routes", async () => {
		const response = await app.request("/missing");
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body).toStrictEqual({ error: "Not found" });
	});
});
