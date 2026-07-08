export type ConfirmationStatus = "draft" | "confirmed";

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

export type CaseTruthStatus = "draft" | "confirmed";

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
	status: CaseTruthStatus;
};

export type CaseTruthOption = CaseTruth & {
	id: string;
	title: string;
};

export type Confirmation = {
	stage: NovelStage;
	status: ConfirmationStatus;
	summary: string;
	lockedFields: string[];
	createdAt: string;
};

export type ChapterPlan = {
	chapter: number;
	purpose: string;
	newClues: string[];
	misdirection: string;
	mustNotReveal: string;
};

export type NovelState = {
	stage: NovelStage;
	brief: Brief;
	case: CaseTruth;
	caseTruthOptions: CaseTruthOption[];
	characters: unknown[];
	timeline: unknown[];
	clues: unknown[];
	chapters: ChapterPlan[];
	confirmations: Confirmation[];
	qualityReports: unknown[];
};

export type CreateNovelRequest = {
	title: string;
	brief: Brief;
};

export type ConfirmStepRequest = {
	stage: NovelStage;
	decision: string;
	lockedFields: string[];
	caseTruth?: CaseTruth;
};

export type GenerateStepRequest = {
	stage: NovelStage;
	feedback?: string;
	provider?: string;
};

export type NeedsClarificationResponse = {
	error: "needs_clarification";
	questions: string[];
};

export type StageConflictResponse = {
	error: "stage_conflict";
	message: string;
};

export type NovelSummary = {
	id: string;
	title: string;
	currentVersion: string | null;
	updatedAt: string;
};

export type ChapterDraft = {
	chapterNo: number;
	title: string;
	body: string;
};
