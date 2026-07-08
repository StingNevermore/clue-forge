import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	draftChapter: vi.fn(async () => ({
		version: "version-id",
		draft: { chapterNo: 2, title: "第2章", body: "正文" },
	})),
	confirmStep: vi.fn(),
	createNovel: vi.fn(),
	loadNovelState: vi.fn(),
}));

vi.mock("./service", () => ({
	confirmStep: mocks.confirmStep,
	createNovel: mocks.createNovel,
	draftChapter: mocks.draftChapter,
}));

vi.mock("./storage", () => ({
	loadNovelState: mocks.loadNovelState,
}));

import { novelRoutes } from "./routes";

describe("novel routes", () => {
	it("creates novels from the brief request shape", async () => {
		mocks.createNovel.mockResolvedValueOnce({
			id: "novel-id",
			title: "仪式杀人",
			currentVersion: "v1",
			updatedAt: "2026-07-08T00:00:00.000Z",
		});

		const env = {};
		const response = await novelRoutes.request(
			"/novels",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					title: "仪式杀人",
					brief: {
						keywords: ["现代", "刑警"],
						style: "冷峻社会派",
						length: "30章左右",
						limits: ["不写超自然真相"],
					},
				}),
			},
			env,
		);

		expect(response.status).toBe(201);
		expect(mocks.createNovel).toHaveBeenCalledWith(env, {
			title: "仪式杀人",
			brief: {
				keywords: ["现代", "刑警"],
				style: "冷峻社会派",
				length: "30章左右",
				limits: ["不写超自然真相"],
			},
		});
	});

	it("returns 409 when brief confirmation needs clarification", async () => {
		mocks.confirmStep.mockResolvedValueOnce({
			error: "needs_clarification",
			questions: ["关键词至少需要 2 个。"],
		});

		const response = await novelRoutes.request(
			"/novels/novel-id/confirm",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					stage: "brief_input",
					decision: "确认",
					lockedFields: ["brief.keywords"],
				}),
			},
			{},
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toStrictEqual({
			error: "needs_clarification",
			questions: ["关键词至少需要 2 个。"],
		});
	});

	it("passes the requested LLM provider to chapter drafting", async () => {
		const env = {};
		const response = await novelRoutes.request(
			"/novels/novel-id/chapters/2/draft",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ provider: "deepseek" }),
			},
			env,
		);

		expect(response.status).toBe(200);
		expect(mocks.draftChapter).toHaveBeenCalledWith(
			env,
			"novel-id",
			2,
			"deepseek",
		);
	});
});
