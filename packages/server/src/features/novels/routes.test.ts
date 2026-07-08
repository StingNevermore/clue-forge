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
