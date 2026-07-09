import type { LlmEnv } from "../../llm";
import {
	generateCaseTruthOptions,
	generateChapterDraft,
	generateCharacters,
	generateClues,
	generateQualityReports,
	generateTimeline,
} from "./llm";
import {
	createNovelRecord,
	listNovelRecords,
	loadNovelState,
	saveChapterDraft,
	saveNovelVersion,
} from "./storage";
import type {
	Brief,
	CaseStructure,
	CaseStructurePart,
	CaseTruth,
	ChapterDraft,
	CharacterProfile,
	Clue,
	ConfirmStepRequest,
	CreateNovelRequest,
	GenerateStepRequest,
	NeedsClarificationResponse,
	NovelStage,
	NovelState,
	NovelSummary,
	QualityReport,
	StageConflictResponse,
	TimelineEvent,
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

const caseTruthLockedFields = [
	"case.culprit",
	"case.motive",
	"case.method",
	"case.finalTwist",
];

const caseStructureLockedFields = ["timeline", "characters", "clues"];

const emptyCaseTruth = (): CaseTruth => ({
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

const caseTruthFields = [
	"victim",
	"surfaceMystery",
	"culprit",
	"motive",
	"method",
	"coverUp",
	"finalTwist",
	"reasoningHook",
] as const;

const caseTruthIncompleteQuestion =
	"案件真相需要包含被害人、谜面、真凶、动机、作案过程、掩盖方式、最终反转和推理卖点。";
const caseStructureIncompleteQuestion = "结构设定需要包含时间线、人物和线索。";

export const validateCaseTruthInput = (
	caseTruth: CaseTruth | undefined,
): string[] => {
	const complete =
		!!caseTruth &&
		caseTruthFields.every((field) => {
			const value = caseTruth[field];
			return typeof value === "string" && value.trim().length > 0;
		});
	return complete ? [] : [caseTruthIncompleteQuestion];
};

const hasCompleteCaseTruth = (caseTruth: CaseTruth | undefined) =>
	validateCaseTruthInput(caseTruth).length === 0;

export const validateCaseStructureInput = (
	structure: Pick<NovelState, "timeline" | "characters" | "clues">,
): string[] =>
	structure.timeline.length > 0 &&
	structure.characters.length > 0 &&
	structure.clues.length > 0
		? []
		: [caseStructureIncompleteQuestion];

const confirmCaseTruth = (caseTruth: CaseTruth): CaseTruth => ({
	victim: caseTruth.victim.trim(),
	surfaceMystery: caseTruth.surfaceMystery.trim(),
	truth: caseTruth.truth.trim() || caseTruth.method.trim(),
	culprit: caseTruth.culprit.trim(),
	motive: caseTruth.motive.trim(),
	method: caseTruth.method.trim(),
	coverUp: caseTruth.coverUp.trim(),
	finalTwist: caseTruth.finalTwist.trim(),
	reasoningHook: caseTruth.reasoningHook.trim(),
	status: "confirmed",
});

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
	stage === "brief_input"
		? "case_truth"
		: stage === "case_truth"
			? "case_truth_confirmed"
			: stage === "case_structure"
				? "case_structure_confirmed"
				: stage;

export const makeInitialState = (input: CreateNovelRequest): NovelState => ({
	stage: "brief_input",
	brief: normalizeBrief(input.brief),
	case: emptyCaseTruth(),
	caseTruthOptions: [],
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
): NovelState => {
	const isCaseTruth = input.stage === "case_truth";
	const isCaseStructure = input.stage === "case_structure";
	return {
		...state,
		stage: nextStage(input.stage),
		case:
			isCaseTruth && input.caseTruth
				? confirmCaseTruth(input.caseTruth)
				: state.case,
		confirmations: [
			...state.confirmations,
			{
				stage: input.stage,
				status: "confirmed",
				summary: input.decision,
				lockedFields: isCaseTruth
					? caseTruthLockedFields
					: isCaseStructure
						? caseStructureLockedFields
						: input.lockedFields,
				createdAt,
			},
		],
	};
};

export const applyCaseStructureGeneration = (
	state: NovelState,
	structure: CaseStructure,
): NovelState => ({
	...state,
	stage: "case_structure",
	timeline: structure.timeline,
	characters: structure.characters,
	clues: structure.clues,
	qualityReports: structure.qualityReports ?? [],
});

type CaseStructurePartValue =
	| TimelineEvent[]
	| CharacterProfile[]
	| Clue[]
	| QualityReport[];

export const applyCaseStructurePartGeneration = (
	state: NovelState,
	part: CaseStructurePart,
	value: CaseStructurePartValue,
): NovelState => {
	if (part === "timeline") {
		return {
			...state,
			stage: "case_structure",
			timeline: value as TimelineEvent[],
			characters: [],
			clues: [],
			qualityReports: [],
		};
	}
	if (part === "characters") {
		return {
			...state,
			stage: "case_structure",
			characters: value as CharacterProfile[],
			clues: [],
			qualityReports: [],
		};
	}
	if (part === "clues") {
		return {
			...state,
			stage: "case_structure",
			clues: value as Clue[],
			qualityReports: [],
		};
	}
	return {
		...state,
		stage: "case_structure",
		qualityReports: value as QualityReport[],
	};
};

export const createNovel = (
	env: CloudflareBindings,
	input: CreateNovelRequest,
): Promise<NovelSummary> =>
	createNovelRecord(env, input.title, makeInitialState(input));

export const listNovels = (env: CloudflareBindings): Promise<NovelSummary[]> =>
	listNovelRecords(env);

export const confirmStep = async (
	env: CloudflareBindings,
	novelId: string,
	input: ConfirmStepRequest,
): Promise<
	| { version: string; state: NovelState }
	| NeedsClarificationResponse
	| StageConflictResponse
> => {
	const state = await loadNovelState(env, novelId);
	if (input.stage !== state.stage) {
		return {
			error: "stage_conflict",
			message: "stage must match current state",
		};
	}
	if (input.stage === "brief_input") {
		const questions = validateBriefInput(state.brief);
		if (questions.length > 0) {
			return { error: "needs_clarification", questions };
		}
	}
	if (input.stage === "case_truth" && !hasCompleteCaseTruth(input.caseTruth)) {
		return {
			error: "needs_clarification",
			questions: validateCaseTruthInput(input.caseTruth),
		};
	}
	if (input.stage === "case_structure") {
		const questions = validateCaseStructureInput(state);
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

export const generateStep = async (
	env: CloudflareBindings,
	novelId: string,
	input: GenerateStepRequest,
): Promise<{ version: string; state: NovelState } | StageConflictResponse> => {
	const state = await loadNovelState(env, novelId);
	const canGenerateCaseStructure =
		input.stage === "case_structure" &&
		(state.stage === "case_truth_confirmed" ||
			state.stage === "case_structure");
	if (input.stage !== state.stage && !canGenerateCaseStructure) {
		return {
			error: "stage_conflict",
			message: "stage must match current state",
		};
	}
	if (input.stage !== "case_truth" && input.stage !== "case_structure") {
		return {
			error: "stage_conflict",
			message: "only case_truth and case_structure generation are supported",
		};
	}
	if (input.stage === "case_structure") {
		if (!input.part) {
			return {
				error: "stage_conflict",
				message: "case_structure part is required",
			};
		}
		const partValue =
			input.part === "timeline"
				? await generateTimeline(
						env as LlmEnv,
						state,
						input.feedback,
						input.provider,
					)
				: input.part === "characters"
					? await generateCharacters(
							env as LlmEnv,
							state,
							state.timeline,
							input.feedback,
							input.provider,
						)
					: input.part === "clues"
						? await generateClues(
								env as LlmEnv,
								state,
								state.timeline,
								state.characters,
								input.feedback,
								input.provider,
							)
						: await generateQualityReports(
								env as LlmEnv,
								state,
								{
									timeline: state.timeline,
									characters: state.characters,
									clues: state.clues,
								},
								input.feedback,
								input.provider,
							);
		const nextState = applyCaseStructurePartGeneration(
			state,
			input.part,
			partValue,
		);
		const version = await saveNovelVersion(
			env,
			novelId,
			`case_structure_${input.part}_generation`,
			nextState,
		);
		return { version, state: nextState };
	}

	const options = await generateCaseTruthOptions(
		env as LlmEnv,
		state,
		input.feedback,
		input.provider,
	);
	const nextState = { ...state, caseTruthOptions: options };
	const version = await saveNovelVersion(
		env,
		novelId,
		"case_truth_generation",
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
