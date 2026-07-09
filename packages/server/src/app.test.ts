import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "./app";

const makeEnv = () => {
	const first = vi.fn(async () => null);
	const prepare = vi.fn(() => ({
		bind: vi.fn(() => ({ first })),
		first,
	}));
	return {
		env: {
			NOVEL_DB: { prepare },
		} as unknown as CloudflareBindings,
		first,
		prepare,
	};
};

describe("API app", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns JSON for unknown routes", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { env } = makeEnv();
		const response = await app.request("/missing", {}, env);
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body).toStrictEqual({ error: "Not found" });
		expect(response.headers.get("x-error-log-id")).toBeTruthy();
		expect(warn).toHaveBeenCalledOnce();
		expect(JSON.parse(warn.mock.calls[0]?.[0] ?? "{}")).toMatchObject({
			message: "request returned error",
			method: "GET",
			path: "/missing",
			status: 404,
			error: "Not found",
		});
	});

	it("records thrown request errors with a queryable id", async () => {
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const { env } = makeEnv();
		const response = await app.request("/novels/missing", {}, env);
		const body = await response.json<{ errorLogId: string }>();

		expect(response.status).toBe(500);
		expect(body.errorLogId).toBeTruthy();
		expect(error).toHaveBeenCalledOnce();
		expect(JSON.parse(error.mock.calls[0]?.[0] ?? "{}")).toMatchObject({
			id: body.errorLogId,
			message: "request failed",
			error: "Novel not found",
			method: "GET",
			path: "/novels/missing",
		});
	});
});
