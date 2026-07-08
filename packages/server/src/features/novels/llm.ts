import { generateLlmText, type LlmEnv } from "../../llm";
import type { CaseTruthOption, ChapterDraft, NovelState } from "./types";

const caseTruthFields = [
	"title",
	"victim",
	"surfaceMystery",
	"culprit",
	"motive",
	"method",
	"coverUp",
	"finalTwist",
	"reasoningHook",
] as const;

const cleanJson = (text: string) =>
	text
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/i, "");

const requiredString = (value: unknown) =>
	typeof value === "string" && value.trim().length > 0;

const stringField = (record: Record<string, unknown>, field: string) =>
	String(record[field]).trim();

const parseCaseTruthOptions = (text: string): CaseTruthOption[] => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(cleanJson(text));
	} catch {
		throw new Error("LLM returned invalid case truth JSON");
	}

	const options =
		typeof parsed === "object" && parsed !== null && "options" in parsed
			? (parsed as { options: unknown }).options
			: parsed;

	if (!Array.isArray(options) || options.length < 1 || options.length > 3) {
		throw new Error("LLM returned invalid case truth JSON");
	}

	return options.map((option, index) => {
		if (typeof option !== "object" || option === null) {
			throw new Error("LLM returned invalid case truth JSON");
		}
		for (const field of caseTruthFields) {
			if (!requiredString((option as Record<string, unknown>)[field])) {
				throw new Error("LLM returned invalid case truth JSON");
			}
		}
		const record = option as Record<string, unknown>;
		const method = stringField(record, "method");
		const finalTwist = stringField(record, "finalTwist");
		return {
			id: String.fromCharCode(65 + index),
			title: stringField(record, "title"),
			victim: stringField(record, "victim"),
			surfaceMystery: stringField(record, "surfaceMystery"),
			truth:
				typeof record.truth === "string" && record.truth.trim()
					? record.truth.trim()
					: `${method}；${finalTwist}`,
			culprit: stringField(record, "culprit"),
			motive: stringField(record, "motive"),
			method,
			coverUp: stringField(record, "coverUp"),
			finalTwist,
			reasoningHook: stringField(record, "reasoningHook"),
			status: "draft",
		};
	});
};

export const generateCaseTruthOptions = async (
	env: LlmEnv,
	state: NovelState,
	feedback?: string,
	provider?: string,
): Promise<CaseTruthOption[]> => {
	const text = await generateLlmText(env, {
		provider,
		messages: [
			{
				role: "system",
				content:
					'你是推理小说案件真相设计助手。只返回 JSON，不要 Markdown。JSON 格式为 {"options":[...]}，生成 1 到 3 个方案。每个方案必须包含 title, victim, surfaceMystery, culprit, motive, method, coverUp, finalTwist, reasoningHook。真凶和核心反转必须明确展示，不要隐藏。',
			},
			{
				role: "user",
				content: JSON.stringify({
					brief: state.brief,
					feedback,
				}),
			},
		],
	});

	return parseCaseTruthOptions(text);
};

export const generateChapterDraft = async (
	env: LlmEnv,
	state: NovelState,
	chapterNo: number,
	provider?: string,
): Promise<ChapterDraft> => {
	const plan = state.chapters.find((chapter) => chapter.chapter === chapterNo);
	const purpose = plan?.purpose ?? "推进案件调查";
	const body = await generateLlmText(env, {
		provider,
		messages: [
			{
				role: "system",
				content:
					"你是推理小说正文写作助手。只基于已确认的 NovelState 和章节计划写正文，不新增未经确认的关键证据，不泄露 mustNotReveal。",
			},
			{
				role: "user",
				content: JSON.stringify({
					chapterNo,
					purpose,
					chapterPlan: plan,
					novelState: state,
				}),
			},
		],
	});

	return {
		chapterNo,
		title: `第${chapterNo}章`,
		body,
	};
};
