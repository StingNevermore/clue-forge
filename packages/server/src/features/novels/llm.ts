import { generateLlmText, type LlmEnv } from "../../llm";
import type {
	CaseStructure,
	CaseTruthOption,
	ChapterDraft,
	CharacterProfile,
	Clue,
	NovelState,
	QualityReport,
	TimelineEvent,
} from "./types";

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

const timelineFields = [
	"time",
	"location",
	"actualEvent",
	"claimedEvent",
	"readerKnowsAt",
	"detectiveKnowsAt",
] as const;

const characterFields = [
	"name",
	"role",
	"relationship",
	"motive",
	"secret",
	"lie",
	"truthStatus",
] as const;

const clueFields = [
	"id",
	"description",
	"firstSeen",
	"surfaceMeaning",
	"realMeaning",
	"payoff",
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

const stringArrayField = (record: Record<string, unknown>, field: string) => {
	const value = record[field];
	if (!Array.isArray(value) || value.some((item) => !requiredString(item))) {
		throw new Error("LLM returned invalid case structure JSON");
	}
	return value.map((item) => String(item).trim());
};

const parseJsonRecord = (text: string) => {
	try {
		const parsed = JSON.parse(cleanJson(text));
		if (typeof parsed === "object" && parsed !== null) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		// handled below
	}
	throw new Error("LLM returned invalid case structure JSON");
};

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

const parseTimeline = (text: string): TimelineEvent[] => {
	const record = parseJsonRecord(text);
	if (!Array.isArray(record.timeline) || record.timeline.length === 0) {
		throw new Error("LLM returned invalid case structure JSON");
	}

	return record.timeline.map((item) => {
		if (typeof item !== "object" || item === null) {
			throw new Error("LLM returned invalid case structure JSON");
		}
		const event = item as Record<string, unknown>;
		for (const field of timelineFields) {
			if (!requiredString(event[field])) {
				throw new Error("LLM returned invalid case structure JSON");
			}
		}
		return {
			time: stringField(event, "time"),
			location: stringField(event, "location"),
			actualEvent: stringField(event, "actualEvent"),
			claimedEvent: stringField(event, "claimedEvent"),
			people: stringArrayField(event, "people"),
			readerKnowsAt: stringField(event, "readerKnowsAt"),
			detectiveKnowsAt: stringField(event, "detectiveKnowsAt"),
		};
	});
};

const parseCharacters = (text: string): CharacterProfile[] => {
	const record = parseJsonRecord(text);
	if (!Array.isArray(record.characters) || record.characters.length === 0) {
		throw new Error("LLM returned invalid case structure JSON");
	}

	return record.characters.map((item) => {
		if (typeof item !== "object" || item === null) {
			throw new Error("LLM returned invalid case structure JSON");
		}
		const character = item as Record<string, unknown>;
		for (const field of characterFields) {
			if (!requiredString(character[field])) {
				throw new Error("LLM returned invalid case structure JSON");
			}
		}
		return {
			name: stringField(character, "name"),
			role: stringField(character, "role"),
			relationship: stringField(character, "relationship"),
			motive: stringField(character, "motive"),
			secret: stringField(character, "secret"),
			lie: stringField(character, "lie"),
			truthStatus: stringField(character, "truthStatus"),
		};
	});
};

const parseClues = (text: string): Clue[] => {
	const record = parseJsonRecord(text);
	if (!Array.isArray(record.clues) || record.clues.length === 0) {
		throw new Error("LLM returned invalid case structure JSON");
	}

	return record.clues.map((item) => {
		if (typeof item !== "object" || item === null) {
			throw new Error("LLM returned invalid case structure JSON");
		}
		const clue = item as Record<string, unknown>;
		for (const field of clueFields) {
			if (!requiredString(clue[field])) {
				throw new Error("LLM returned invalid case structure JSON");
			}
		}
		if (typeof clue.fair !== "boolean") {
			throw new Error("LLM returned invalid case structure JSON");
		}
		return {
			id: stringField(clue, "id"),
			description: stringField(clue, "description"),
			firstSeen: stringField(clue, "firstSeen"),
			surfaceMeaning: stringField(clue, "surfaceMeaning"),
			realMeaning: stringField(clue, "realMeaning"),
			payoff: stringField(clue, "payoff"),
			fair: clue.fair,
		};
	});
};

const parseQualityReports = (text: string): QualityReport[] => {
	const record = parseJsonRecord(text);
	if (!Array.isArray(record.qualityReports)) {
		throw new Error("LLM returned invalid case structure JSON");
	}

	return record.qualityReports.map((item) => {
		if (typeof item !== "object" || item === null) {
			throw new Error("LLM returned invalid case structure JSON");
		}
		const report = item as Record<string, unknown>;
		if (typeof report.pass !== "boolean") {
			throw new Error("LLM returned invalid case structure JSON");
		}
		return {
			pass: report.pass,
			questions: stringArrayField(report, "questions"),
			problems: stringArrayField(report, "problems"),
		};
	});
};

export const generateTimeline = async (
	env: LlmEnv,
	state: NovelState,
	feedback?: string,
	provider?: string,
): Promise<TimelineEvent[]> => {
	const text = await generateLlmText(env, {
		provider,
		messages: [
			{
				role: "system",
				content:
					"你是推理小说时间线设计助手。只返回 JSON，不要 Markdown。JSON 必须只包含 timeline。timeline 每项包含 time, location, actualEvent, claimedEvent, people, readerKnowsAt, detectiveKnowsAt。时间线必须支撑已确认案件真相，不能修改真凶、动机、作案方式和最终反转。",
			},
			{
				role: "user",
				content: JSON.stringify({
					brief: state.brief,
					caseTruth: state.case,
					feedback,
				}),
			},
		],
	});

	return parseTimeline(text);
};

export const generateCharacters = async (
	env: LlmEnv,
	state: NovelState,
	timeline: TimelineEvent[],
	feedback?: string,
	provider?: string,
): Promise<CharacterProfile[]> => {
	const text = await generateLlmText(env, {
		provider,
		messages: [
			{
				role: "system",
				content:
					"你是推理小说人物设定助手。只返回 JSON，不要 Markdown。JSON 必须只包含 characters。characters 每项包含 name, role, relationship, motive, secret, lie, truthStatus。人物设定必须支撑已确认案件真相和时间线。",
			},
			{
				role: "user",
				content: JSON.stringify({
					brief: state.brief,
					caseTruth: state.case,
					timeline,
					feedback,
				}),
			},
		],
	});

	return parseCharacters(text);
};

export const generateClues = async (
	env: LlmEnv,
	state: NovelState,
	timeline: TimelineEvent[],
	characters: CharacterProfile[],
	feedback?: string,
	provider?: string,
): Promise<Clue[]> => {
	const text = await generateLlmText(env, {
		provider,
		messages: [
			{
				role: "system",
				content:
					"你是推理小说线索设定助手。只返回 JSON，不要 Markdown。JSON 必须只包含 clues。clues 每项包含 id, description, firstSeen, surfaceMeaning, realMeaning, payoff, fair。线索必须支撑已确认案件真相、时间线和人物设定。",
			},
			{
				role: "user",
				content: JSON.stringify({
					brief: state.brief,
					caseTruth: state.case,
					timeline,
					characters,
					feedback,
				}),
			},
		],
	});

	return parseClues(text);
};

export const generateQualityReports = async (
	env: LlmEnv,
	state: NovelState,
	structure: Pick<CaseStructure, "timeline" | "characters" | "clues">,
	feedback?: string,
	provider?: string,
): Promise<QualityReport[]> => {
	const text = await generateLlmText(env, {
		provider,
		messages: [
			{
				role: "system",
				content:
					"你是推理小说结构检查助手。只返回 JSON，不要 Markdown。JSON 必须只包含 qualityReports。qualityReports 每项包含 pass, questions, problems。只检查时间线、人物和线索是否支撑已确认案件真相。",
			},
			{
				role: "user",
				content: JSON.stringify({
					brief: state.brief,
					caseTruth: state.case,
					structure,
					feedback,
				}),
			},
		],
	});

	return parseQualityReports(text);
};

export const generateCaseStructure = async (
	env: LlmEnv,
	state: NovelState,
	feedback?: string,
	provider?: string,
): Promise<CaseStructure> => {
	const timeline = await generateTimeline(env, state, feedback, provider);
	const characters = await generateCharacters(
		env,
		state,
		timeline,
		feedback,
		provider,
	);
	const clues = await generateClues(
		env,
		state,
		timeline,
		characters,
		feedback,
		provider,
	);
	const structure = { timeline, characters, clues };
	const qualityReports = await generateQualityReports(
		env,
		state,
		structure,
		feedback,
		provider,
	);

	return { ...structure, qualityReports };
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
