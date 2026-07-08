import {
	createNovelRecord,
	loadNovelState,
	saveNovelVersion,
} from "./storage";
import type {
	ConfirmStepRequest,
	CreateNovelRequest,
	NovelState,
	NovelSummary,
} from "./types";

export const makeInitialState = (input: CreateNovelRequest): NovelState => ({
	brief: {
		keywords: input.keywords,
		length: "30-60章",
		style: "",
		limits: [],
	},
	case: {
		surfaceMystery: "",
		truth: "",
		culprit: "",
		motive: "",
		method: "",
		coverUp: "",
		finalTwist: "",
	},
	characters: [],
	timeline: [],
	clues: [],
	chapters: [],
	confirmations: [],
	qualityReports: [],
});

export const applyConfirmation = (
	state: NovelState,
	input: ConfirmStepRequest,
	createdAt: string,
): NovelState => ({
	...state,
	confirmations: [
		...state.confirmations,
		{
			step: input.step,
			status: "confirmed",
			summary: input.decision,
			lockedFields: input.lockedFields,
			createdAt,
		},
	],
});

export const createNovel = (
	env: CloudflareBindings,
	input: CreateNovelRequest,
): Promise<NovelSummary> =>
	createNovelRecord(env, input.title, makeInitialState(input));

export const confirmStep = async (
	env: CloudflareBindings,
	novelId: string,
	input: ConfirmStepRequest,
): Promise<{ version: string; state: NovelState }> => {
	const state = await loadNovelState(env, novelId);
	const nextState = applyConfirmation(state, input, new Date().toISOString());
	const version = await saveNovelVersion(env, novelId, "confirmation", nextState);
	return { version, state: nextState };
};
