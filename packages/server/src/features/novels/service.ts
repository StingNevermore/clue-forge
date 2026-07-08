import type { LlmEnv } from "../../llm";
import { generateChapterDraft } from "./llm";
import {
	createNovelRecord,
	loadNovelState,
	saveChapterDraft,
	saveNovelVersion,
} from "./storage";
import type {
	Brief,
	ChapterDraft,
	ConfirmStepRequest,
	CreateNovelRequest,
	NeedsClarificationResponse,
	NovelStage,
	NovelState,
	NovelSummary,
} from "./types";

const uniqueTrimmed = (items: string[]) => [
	...new Set(items.map((item) => item.trim()).filter(Boolean)),
];

export const normalizeBrief = (brief: Brief): Brief => ({
	keywords: uniqueTrimmed(brief.keywords),
	style: brief.style.trim(),
	length: brief.length.trim() || "30-60章",
	limits: uniqueTrimmed(brief.limits),
});

const hasLengthIntent = (length: string) =>
	/[0-9一二三四五六七八九十百千万两短中长章字篇]/.test(length);

export const validateBriefInput = (brief: Brief): string[] => {
	const normalized = normalizeBrief(brief);
	const questions: string[] = [];
	if (normalized.keywords.length < 2) {
		questions.push("关键词至少需要 2 个。");
	}
	if (!hasLengthIntent(normalized.length)) {
		questions.push("篇幅需要包含章节数、字数，或短/中/长篇等明确意图。");
	}

	const intentItems = [...normalized.keywords, ...normalized.limits];
	const wantsSupernatural = intentItems.some(
		(item) =>
			item.includes("超自然真相") &&
			!item.includes("不写") &&
			!item.includes("不要") &&
			!item.includes("禁止"),
	);
	const blocksSupernatural = intentItems.some(
		(item) =>
			item.includes("不写超自然真相") ||
			item.includes("不要超自然真相") ||
			item.includes("禁止超自然真相"),
	);
	if (wantsSupernatural && blocksSupernatural) {
		questions.push("关键词和限制对“超自然真相”的要求互相冲突。");
	}

	return questions;
};

const nextStage = (stage: NovelStage): NovelStage =>
	stage === "brief_input" ? "case_truth" : stage;

export const makeInitialState = (input: CreateNovelRequest): NovelState => ({
	stage: "brief_input",
	brief: normalizeBrief(input.brief),
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
	stage: nextStage(input.stage),
	confirmations: [
		...state.confirmations,
		{
			stage: input.stage,
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
): Promise<
	{ version: string; state: NovelState } | NeedsClarificationResponse
> => {
	const state = await loadNovelState(env, novelId);
	if (input.stage === "brief_input") {
		const questions = validateBriefInput(state.brief);
		if (questions.length > 0) {
			return { error: "needs_clarification", questions };
		}
	}

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
