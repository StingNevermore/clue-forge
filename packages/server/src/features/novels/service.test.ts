import { describe, expect, it } from "vitest";
import {
	applyCaseStructureGeneration,
	applyConfirmation,
	draftChapterFromState,
	makeInitialState,
	validateBriefInput,
	validateCaseStructureInput,
	validateCaseTruthInput,
} from "./service";

describe("novel workflow service", () => {
	it("creates initial brief_input state from a complete brief", () => {
		const state = makeInitialState({
			title: "仪式杀人",
			brief: {
				keywords: ["现代", "刑警", "宗教仪式"],
				style: "冷峻社会派",
				length: "",
				limits: ["不写超自然真相"],
			},
		});

		expect(state.stage).toBe("brief_input");
		expect(state.brief.keywords).toStrictEqual(["现代", "刑警", "宗教仪式"]);
		expect(state.brief.length).toBe("30-60章");
		expect(state.brief.style).toBe("冷峻社会派");
		expect(state.brief.limits).toStrictEqual(["不写超自然真相"]);
		expect(state.case).toStrictEqual({
			victim: "",
			surfaceMystery: "",
			truth: "",
			culprit: "",
			motive: "",
			method: "",
			coverUp: "",
			finalTwist: "",
			reasoningHook: "",
			status: "draft",
		});
		expect(state.caseTruthOptions).toStrictEqual([]);
		expect(state.confirmations).toStrictEqual([]);
	});

	it("confirms brief_input and advances to case_truth", () => {
		const state = makeInitialState({
			title: "仪式杀人",
			brief: {
				keywords: ["现代", "刑警"],
				style: "",
				length: "30章左右",
				limits: [],
			},
		});

		const next = applyConfirmation(
			state,
			{
				stage: "brief_input",
				decision: "确认关键词方向",
				lockedFields: [
					"brief.keywords",
					"brief.style",
					"brief.length",
					"brief.limits",
				],
			},
			"2026-07-08T00:00:00.000Z",
		);

		expect(state.stage).toBe("brief_input");
		expect(state.confirmations).toHaveLength(0);
		expect(next.stage).toBe("case_truth");
		expect(next.confirmations).toStrictEqual([
			{
				stage: "brief_input",
				status: "confirmed",
				summary: "确认关键词方向",
				lockedFields: [
					"brief.keywords",
					"brief.style",
					"brief.length",
					"brief.limits",
				],
				createdAt: "2026-07-08T00:00:00.000Z",
			},
		]);
	});

	it("confirms case_truth, stores selected truth, and locks canonical fields", () => {
		const state = makeInitialState({
			title: "仪式杀人",
			brief: {
				keywords: ["现代", "刑警"],
				style: "",
				length: "30章左右",
				limits: [],
			},
		});
		state.stage = "case_truth";
		state.caseTruthOptions = [
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
		];
		const caseTruth = state.caseTruthOptions[0];
		if (!caseTruth) {
			throw new Error("missing test option");
		}

		const next = applyConfirmation(
			state,
			{
				stage: "case_truth",
				decision: "确认方案 A",
				lockedFields: [],
				caseTruth,
			},
			"2026-07-08T00:00:00.000Z",
		);

		expect(next.stage).toBe("case_truth_confirmed");
		expect(next.case).toStrictEqual({
			victim: "顾铭",
			surfaceMystery: "宗教仪式现场",
			truth: "宗教元素是伪装",
			culprit: "林澈",
			motive: "掩盖十五年前伪证",
			method: "伪造密室后转移死亡时间",
			coverUp: "用仪式符号误导侦查方向",
			finalTwist: "真正被保护的是第二名凶手",
			reasoningHook: "仪式符号的摆放顺序与死亡时间矛盾",
			status: "confirmed",
		});
		expect(next.confirmations[0]?.lockedFields).toStrictEqual([
			"case.culprit",
			"case.motive",
			"case.method",
			"case.finalTwist",
		]);
	});

	it("applies generated case structure and moves into case_structure review", () => {
		const state = makeInitialState({
			title: "仪式杀人",
			brief: {
				keywords: ["现代", "刑警"],
				style: "",
				length: "30章左右",
				limits: [],
			},
		});
		state.stage = "case_truth_confirmed";

		const next = applyCaseStructureGeneration(state, {
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
			clues: [
				{
					id: "c001",
					description: "未发送短信",
					firstSeen: "第3章",
					surfaceMeaning: "看似指向前妻",
					realMeaning: "实际指向备用手机",
					payoff: "第26章",
					fair: true,
				},
			],
			qualityReports: [
				{
					pass: true,
					questions: [],
					problems: [],
				},
			],
		});

		expect(next.stage).toBe("case_structure");
		expect(next.timeline).toHaveLength(1);
		expect(next.characters).toHaveLength(1);
		expect(next.clues).toHaveLength(1);
		expect(next.qualityReports).toStrictEqual([
			{ pass: true, questions: [], problems: [] },
		]);
	});

	it("confirms case_structure and locks structure fields", () => {
		const state = makeInitialState({
			title: "仪式杀人",
			brief: {
				keywords: ["现代", "刑警"],
				style: "",
				length: "30章左右",
				limits: [],
			},
		});
		state.stage = "case_structure";
		state.timeline = [
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
		state.characters = [
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
		state.clues = [
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

		const next = applyConfirmation(
			state,
			{
				stage: "case_structure",
				decision: "确认结构设定",
				lockedFields: [],
			},
			"2026-07-08T00:00:00.000Z",
		);

		expect(next.stage).toBe("case_structure_confirmed");
		expect(next.confirmations[0]?.lockedFields).toStrictEqual([
			"timeline",
			"characters",
			"clues",
		]);
	});

	it("rejects incomplete case truth input", () => {
		expect(validateCaseTruthInput(undefined)).toStrictEqual([
			"案件真相需要包含被害人、谜面、真凶、动机、作案过程、掩盖方式、最终反转和推理卖点。",
		]);
		expect(
			validateCaseTruthInput({
				victim: "顾铭",
				surfaceMystery: "",
				truth: "",
				culprit: "林澈",
				motive: "掩盖伪证",
				method: "伪造密室",
				coverUp: "误导警方",
				finalTwist: "宗教元素是伪装",
				reasoningHook: "符号顺序矛盾",
				status: "draft",
			}),
		).toHaveLength(1);
	});

	it("rejects incomplete case structure input", () => {
		expect(
			validateCaseStructureInput({
				timeline: [],
				characters: [],
				clues: [],
			}),
		).toStrictEqual(["结构设定需要包含时间线、人物和线索。"]);
	});

	it("asks for clarification when brief_input is not ready", () => {
		expect(
			validateBriefInput({
				keywords: ["现代"],
				style: "",
				length: "很多",
				limits: [],
			}),
		).toStrictEqual([
			"关键词至少需要 2 个。",
			"篇幅需要包含章节数、字数，或短/中/长篇等明确意图。",
		]);
	});

	it("asks for clarification when supernatural truth conflicts with limits", () => {
		expect(
			validateBriefInput({
				keywords: ["现代", "超自然真相"],
				style: "",
				length: "30章左右",
				limits: ["不写超自然真相"],
			}),
		).toStrictEqual(["关键词和限制对“超自然真相”的要求互相冲突。"]);
	});

	it("drafts chapter from chapter plan without new facts", () => {
		const state = makeInitialState({
			title: "仪式杀人",
			brief: { keywords: ["现代", "刑警"], style: "", length: "", limits: [] },
		});
		state.chapters = [
			{
				chapter: 1,
				purpose: "案发、谜面、主角进入案件",
				newClues: [],
				misdirection: "",
				mustNotReveal: "真凶身份",
			},
		];

		expect(draftChapterFromState(state, 1)).toStrictEqual({
			chapterNo: 1,
			title: "第1章",
			body: "本章功能：案发、谜面、主角进入案件\n\n本章只基于已确认设定生成，不新增关键证据。",
		});
	});
});
