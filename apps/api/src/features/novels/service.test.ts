import { describe, expect, it } from "vitest";
import { applyConfirmation, makeInitialState } from "./service";

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
});
