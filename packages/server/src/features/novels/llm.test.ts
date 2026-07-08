import { afterEach, describe, expect, it, vi } from "vitest";
import { generateChapterDraft } from "./llm";
import type { NovelState } from "./types";

type FetchCall = [RequestInfo | URL, RequestInit?];

const state: NovelState = {
	stage: "chapter_plan_confirmed",
	brief: {
		keywords: ["现代", "刑警"],
		length: "30-60章",
		style: "冷峻",
		limits: ["不写超自然真相"],
	},
	case: {
		surfaceMystery: "仪式杀人",
		truth: "旧案复仇",
		culprit: "凶手甲",
		motive: "复仇",
		method: "伪造仪式现场",
		coverUp: "误导警方",
		finalTwist: "宗教元素只是伪装",
	},
	characters: [],
	timeline: [],
	clues: [],
	chapters: [
		{
			chapter: 1,
			purpose: "案发、谜面、主角进入案件",
			newClues: [],
			misdirection: "怀疑宗教动机",
			mustNotReveal: "凶手身份",
		},
	],
	confirmations: [],
	qualityReports: [],
};

describe("generateChapterDraft", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("uses the requested provider and returns the LLM text as chapter body", async () => {
		const fetch = vi.fn<(...args: FetchCall) => Promise<Response>>(async () =>
			Response.json({
				id: "chatcmpl_test",
				object: "chat.completion",
				created: 0,
				model: "deepseek-model",
				choices: [
					{
						index: 0,
						message: { role: "assistant", content: "第一章正文。" },
					},
				],
			}),
		);
		vi.stubGlobal("fetch", fetch);

		const draft = await generateChapterDraft(
			{
				LLM_PROVIDERS_JSON: JSON.stringify({
					deepseek: {
						baseURL: "https://deepseek.example.test/v1",
						apiKey: "secret",
						model: "deepseek-model",
					},
				}),
			},
			state,
			1,
			"deepseek",
		);

		expect(draft).toStrictEqual({
			chapterNo: 1,
			title: "第1章",
			body: "第一章正文。",
		});
		expect(String((fetch.mock.calls[0] as FetchCall)[0])).toBe(
			"https://deepseek.example.test/v1/chat/completions",
		);
	});
});
