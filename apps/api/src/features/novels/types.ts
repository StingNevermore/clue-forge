export type ConfirmationStatus = "draft" | "confirmed";

export type Confirmation = {
	step: string;
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
	brief: {
		keywords: string[];
		length: string;
		style: string;
		limits: string[];
	};
	case: {
		surfaceMystery: string;
		truth: string;
		culprit: string;
		motive: string;
		method: string;
		coverUp: string;
		finalTwist: string;
	};
	characters: unknown[];
	timeline: unknown[];
	clues: unknown[];
	chapters: ChapterPlan[];
	confirmations: Confirmation[];
	qualityReports: unknown[];
};

export type CreateNovelRequest = {
	title: string;
	keywords: string[];
};

export type ConfirmStepRequest = {
	step: string;
	decision: string;
	lockedFields: string[];
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
