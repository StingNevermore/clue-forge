import { describe, expect, it } from "vitest";
import {
	applyConfirmation,
	draftChapterFromState,
	makeInitialState,
} from "./service";

describe("novel workflow service", () => {
	it("creates initial state from title keywords", () => {
		const state = makeInitialState({
			title: "仪式杀人",
			keywords: ["现代", "刑警", "宗教仪式"],
		});

		expect(state.brief.keywords).toStrictEqual([
			"现代",
			"刑警",
			"宗教仪式",
		]);
		expect(state.brief.length).toBe("30-60章");
		expect(state.confirmations).toStrictEqual([]);
	});

	it("appends confirmation without mutating previous state", () => {
		const state = makeInitialState({
			title: "仪式杀人",
			keywords: ["现代"],
		});

		const next = applyConfirmation(
			state,
			{
				step: "case_direction",
				decision: "现代都市刑侦，宗教元素只是伪装",
				lockedFields: ["brief.keywords", "case.surfaceMystery"],
			},
			"2026-07-08T00:00:00.000Z",
		);

		expect(state.confirmations).toHaveLength(0);
		expect(next.confirmations).toStrictEqual([
			{
				step: "case_direction",
				status: "confirmed",
				summary: "现代都市刑侦，宗教元素只是伪装",
				lockedFields: ["brief.keywords", "case.surfaceMystery"],
				createdAt: "2026-07-08T00:00:00.000Z",
			},
		]);
	});

	it("drafts chapter from chapter plan without new facts", () => {
		const state = makeInitialState({ title: "仪式杀人", keywords: ["现代"] });
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
