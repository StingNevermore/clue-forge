import { afterEach, describe, expect, it, vi } from "vitest";
import {
	generateCaseStructure,
	generateCaseTruthOptions,
	generateChapterDraft,
} from "./llm";
import type { NovelState } from "./types";

type FetchCall = [RequestInfo | URL, RequestInit?];

const chatResponse = (content: string) =>
	Response.json({
		id: "chatcmpl_test",
		object: "chat.completion",
		created: 0,
		model: "deepseek-model",
		choices: [
			{
				index: 0,
				message: { role: "assistant", content },
			},
		],
	});

const requestBody = (call: FetchCall) => JSON.parse(String(call[1]?.body));

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

describe("generateCaseStructure", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("generates structure through four smaller LLM calls with prior results", async () => {
		const timeline = [
			{
				time: "21:35",
				location: "地下停车场",
				actualEvent: "真凶转移尸体",
				claimedEvent: "真凶声称在会议室",
				people: ["林澈", "顾铭"],
				readerKnowsAt: "第3章",
				detectiveKnowsAt: "第18章",
			},
		];
		const characters = [
			{
				name: "林澈",
				role: "刑警 / 真凶",
				relationship: "被害人的旧案搭档",
				motive: "掩盖十五年前伪证",
				secret: "伪造旧案证词",
				lie: "声称案发时在会议室",
				truthStatus: "culprit",
			},
		];
		const clues = [
			{
				id: "c001",
				description: "未发送短信",
				firstSeen: "第3章",
				surfaceMeaning: "看似指向前妻",
				realMeaning: "实际指向备用手机",
				payoff: "第26章",
				fair: true,
			},
		];
		const qualityReports = [
			{
				pass: true,
				questions: [],
				problems: [],
			},
		];
		const responses = [
			JSON.stringify({ timeline }),
			JSON.stringify({ characters }),
			JSON.stringify({ clues }),
			JSON.stringify({ qualityReports }),
		];
		const fetch = vi.fn<(...args: FetchCall) => Promise<Response>>(async () =>
			chatResponse(responses.shift() ?? "{}"),
		);
		vi.stubGlobal("fetch", fetch);

		const structure = await generateCaseStructure(
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
			"误导更克制",
			"deepseek",
		);

		expect(structure.timeline).toHaveLength(1);
		expect(structure.characters[0]?.truthStatus).toBe("culprit");
		expect(structure.clues[0]?.fair).toBe(true);
		expect(structure.qualityReports).toStrictEqual([
			{ pass: true, questions: [], problems: [] },
		]);
		expect(fetch).toHaveBeenCalledTimes(4);
		const bodies = fetch.mock.calls.map((call) =>
			requestBody(call as FetchCall),
		);
		expect(JSON.stringify(bodies[1]?.messages)).toContain("真凶转移尸体");
		expect(JSON.stringify(bodies[2]?.messages)).toContain("林澈");
		expect(JSON.stringify(bodies[2]?.messages)).toContain("真凶转移尸体");
		expect(JSON.stringify(bodies[3]?.messages)).toContain("未发送短信");
	});

	it("rejects malformed case structure JSON", async () => {
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
			generateCaseStructure(
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
		).rejects.toThrow("LLM returned invalid case structure JSON");
	});

	it("rejects empty case structure arrays", async () => {
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
								timeline: [],
								characters: [],
								clues: [],
							}),
						},
					},
				],
			}),
		);
		vi.stubGlobal("fetch", fetch);

		await expect(
			generateCaseStructure(
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
		).rejects.toThrow("LLM returned invalid case structure JSON");
	});

	it("rejects when a later case structure step returns invalid JSON", async () => {
		const responses = [
			JSON.stringify({
				timeline: [
					{
						time: "21:35",
						location: "地下停车场",
						actualEvent: "真凶转移尸体",
						claimedEvent: "真凶声称在会议室",
						people: ["林澈", "顾铭"],
						readerKnowsAt: "第3章",
						detectiveKnowsAt: "第18章",
					},
				],
			}),
			JSON.stringify({
				characters: [
					{
						name: "林澈",
						role: "刑警 / 真凶",
						relationship: "被害人的旧案搭档",
						motive: "掩盖十五年前伪证",
						secret: "伪造旧案证词",
						lie: "声称案发时在会议室",
						truthStatus: "culprit",
					},
				],
			}),
			"{not-json",
		];
		const fetch = vi.fn<(...args: FetchCall) => Promise<Response>>(async () =>
			chatResponse(responses.shift() ?? "{}"),
		);
		vi.stubGlobal("fetch", fetch);

		await expect(
			generateCaseStructure(
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
		).rejects.toThrow("LLM returned invalid case structure JSON");
		expect(fetch).toHaveBeenCalledTimes(3);
	});
});
