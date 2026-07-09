export type NovelSummary = {
	id: string;
	title: string;
	currentVersion: string | null;
	updatedAt: string;
};

export type NovelStage =
	| "brief_input"
	| "case_truth"
	| "case_truth_confirmed"
	| "case_structure"
	| "case_structure_confirmed"
	| "chapter_plan"
	| "chapter_plan_confirmed"
	| "drafting"
	| "revision";

export type Brief = {
	keywords: string[];
	style: string;
	length: string;
	limits: string[];
};

export type Confirmation = {
	stage: NovelStage;
	status: "draft" | "confirmed";
	summary: string;
	lockedFields: string[];
	createdAt: string;
};

export type TimelineEvent = {
	time: string;
	location: string;
	actualEvent: string;
	claimedEvent: string;
	people: string[];
	readerKnowsAt: string;
	detectiveKnowsAt: string;
};

export type CharacterProfile = {
	name: string;
	role: string;
	relationship: string;
	motive: string;
	secret: string;
	lie: string;
	truthStatus: string;
};

export type Clue = {
	id: string;
	description: string;
	firstSeen: string;
	surfaceMeaning: string;
	realMeaning: string;
	payoff: string;
	fair: boolean;
};

export type QualityReport = {
	pass: boolean;
	questions: string[];
	problems: string[];
};

export type CaseTruth = {
	victim: string;
	surfaceMystery: string;
	truth: string;
	culprit: string;
	motive: string;
	method: string;
	coverUp: string;
	finalTwist: string;
	reasoningHook: string;
	status: "draft" | "confirmed";
};

export type CaseTruthOption = CaseTruth & {
	id: string;
	title: string;
};

export type NovelState = {
	stage: NovelStage;
	brief: Brief;
	case: CaseTruth;
	caseTruthOptions: CaseTruthOption[];
	timeline: TimelineEvent[];
	characters: CharacterProfile[];
	clues: Clue[];
	confirmations: Confirmation[];
	qualityReports: QualityReport[];
};

export class NeedsClarificationError extends Error {
	questions: string[];

	constructor(questions: string[]) {
		super("需要补充信息");
		this.questions = questions;
	}
}

const isNeedsClarificationBody = (
	body: unknown,
): body is { error: "needs_clarification"; questions: string[] } =>
	typeof body === "object" &&
	body !== null &&
	"error" in body &&
	"questions" in body &&
	body.error === "needs_clarification" &&
	Array.isArray(body.questions);

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
	const response = await fetch(url, {
		...init,
		headers: { "content-type": "application/json", ...init?.headers },
	});
	if (!response.ok) {
		const body = await response.json().catch(() => undefined);
		if (response.status === 409 && isNeedsClarificationBody(body)) {
			throw new NeedsClarificationError(body.questions);
		}
		if (
			typeof body === "object" &&
			body !== null &&
			"message" in body &&
			typeof body.message === "string"
		) {
			throw new Error(body.message);
		}
		throw new Error(`Request failed: ${response.status}`);
	}
	return response.json() as Promise<T>;
};

export const createNovel = (title: string, brief: Brief) =>
	requestJson<NovelSummary>("/api/novels", {
		method: "POST",
		body: JSON.stringify({ title, brief }),
	});

export const listNovels = () => requestJson<NovelSummary[]>("/api/novels");

export const loadNovel = (id: string) =>
	requestJson<NovelState>(`/api/novels/${id}`);

export const confirmBriefInput = (id: string, decision: string) =>
	requestJson<{ version: string; state: NovelState }>(
		`/api/novels/${id}/confirm`,
		{
			method: "POST",
			body: JSON.stringify({
				stage: "brief_input",
				decision,
				lockedFields: [
					"brief.keywords",
					"brief.style",
					"brief.length",
					"brief.limits",
				],
			}),
		},
	);

export const generateCaseTruth = (
	id: string,
	input: { feedback?: string; provider?: string },
) =>
	requestJson<{ version: string; state: NovelState }>(
		`/api/novels/${id}/generate`,
		{
			method: "POST",
			body: JSON.stringify({ stage: "case_truth", ...input }),
		},
	);

export const generateCaseStructure = (
	id: string,
	input: { feedback?: string; provider?: string },
) =>
	requestJson<{ version: string; state: NovelState }>(
		`/api/novels/${id}/generate`,
		{
			method: "POST",
			body: JSON.stringify({ stage: "case_structure", ...input }),
		},
	);

export const confirmCaseTruth = (
	id: string,
	decision: string,
	caseTruth: CaseTruth,
) =>
	requestJson<{ version: string; state: NovelState }>(
		`/api/novels/${id}/confirm`,
		{
			method: "POST",
			body: JSON.stringify({
				stage: "case_truth",
				decision,
				lockedFields: [
					"case.culprit",
					"case.motive",
					"case.method",
					"case.finalTwist",
				],
				caseTruth,
			}),
		},
	);

export const confirmCaseStructure = (id: string, decision: string) =>
	requestJson<{ version: string; state: NovelState }>(
		`/api/novels/${id}/confirm`,
		{
			method: "POST",
			body: JSON.stringify({
				stage: "case_structure",
				decision,
				lockedFields: ["timeline", "characters", "clues"],
			}),
		},
	);
