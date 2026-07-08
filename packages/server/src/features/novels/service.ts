import type { LlmEnv } from "../../llm";
import { generateChapterDraft } from "./llm";
import {
	createNovelRecord,
	loadNovelState,
	saveChapterDraft,
	saveNovelVersion,
} from "./storage";
import type {
	ChapterDraft,
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
	const version = await saveNovelVersion(
		env,
		novelId,
		"confirmation",
		nextState,
	);
	return { version, state: nextState };
};

export const draftChapterFromState = (
	state: NovelState,
	chapterNo: number,
): ChapterDraft => {
	const plan = state.chapters.find((chapter) => chapter.chapter === chapterNo);
	const purpose = plan?.purpose ?? "推进案件调查";
	return {
		chapterNo,
		title: `第${chapterNo}章`,
		body: `本章功能：${purpose}\n\n本章只基于已确认设定生成，不新增关键证据。`,
	};
};

export const draftChapter = async (
	env: CloudflareBindings,
	novelId: string,
	chapterNo: number,
	provider?: string,
): Promise<{ version: string; draft: ChapterDraft }> => {
	const state = await loadNovelState(env, novelId);
	const draft = await generateChapterDraft(
		env as LlmEnv,
		state,
		chapterNo,
		provider,
	);
	const version = await saveChapterDraft(env, novelId, draft, state);
	return { version, draft };
};
