import { describe, expect, it } from "vitest";
import {
	applyConfirmation,
	draftChapterFromState,
	makeInitialState,
	validateBriefInput,
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
