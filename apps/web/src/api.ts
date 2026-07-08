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

export type NovelState = {
	stage: NovelStage;
	brief: Brief;
	confirmations: Confirmation[];
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
		throw new Error(`Request failed: ${response.status}`);
	}
	return response.json() as Promise<T>;
};

export const createNovel = (title: string, brief: Brief) =>
	requestJson<NovelSummary>("/api/novels", {
		method: "POST",
		body: JSON.stringify({ title, brief }),
	});

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
