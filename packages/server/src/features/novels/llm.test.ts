import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCaseTruthOptions, generateChapterDraft } from "./llm";
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
		victim: "被害人甲",
		surfaceMystery: "仪式杀人",
		truth: "旧案复仇",
		culprit: "凶手甲",
		motive: "复仇",
		method: "伪造仪式现场",
		coverUp: "误导警方",
		finalTwist: "宗教元素只是伪装",
		reasoningHook: "仪式符号与死亡时间矛盾",
		status: "confirmed",
	},
	caseTruthOptions: [],
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

describe("generateCaseTruthOptions", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("parses one to three complete case truth options from LLM JSON", async () => {
		const fetch = vi.fn<(...args: FetchCall) => Promise<Response>>(async () =>
			Response.json({
				id: "chatcmpl_test",
				object: "chat.completion",
				created: 0,
				model: "deepseek-model",
				choices: [
					{
						index: 0,
						message: {
							role: "assistant",
							content: JSON.stringify({
								options: [
									{
										title: "旧案伪证",
										victim: "顾铭",
										surfaceMystery: "宗教仪式现场",
										truth: "宗教元素是伪装",
										culprit: "林澈",
										motive: "掩盖十五年前伪证",
										method: "伪造密室后转移死亡时间",
										coverUp: "用仪式符号误导侦查方向",
										finalTwist: "真正被保护的是第二名凶手",
										reasoningHook: "仪式符号的摆放顺序与死亡时间矛盾",
									},
								],
							}),
						},
					},
				],
			}),
		);
		vi.stubGlobal("fetch", fetch);

		const options = await generateCaseTruthOptions(
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
			"更偏社会派",
			"deepseek",
		);

		expect(options).toStrictEqual([
			{
				id: "A",
				title: "旧案伪证",
				victim: "顾铭",
				surfaceMystery: "宗教仪式现场",
				truth: "宗教元素是伪装",
				culprit: "林澈",
				motive: "掩盖十五年前伪证",
				method: "伪造密室后转移死亡时间",
				coverUp: "用仪式符号误导侦查方向",
				finalTwist: "真正被保护的是第二名凶手",
				reasoningHook: "仪式符号的摆放顺序与死亡时间矛盾",
				status: "draft",
			},
		]);
	});

	it("rejects malformed case truth JSON", async () => {
		const fetch = vi.fn<(...args: FetchCall) => Promise<Response>>(async () =>
			Response.json({
				id: "chatcmpl_test",
				object: "chat.completion",
				created: 0,
				model: "deepseek-model",
				choices: [
					{
						index: 0,
						message: { role: "assistant", content: "{not-json" },
					},
				],
			}),
		);
		vi.stubGlobal("fetch", fetch);

		await expect(
			generateCaseTruthOptions(
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
				"",
				"deepseek",
			),
		).rejects.toThrow("LLM returned invalid case truth JSON");
	});
});
