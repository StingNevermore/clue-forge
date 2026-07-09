import type { CaseTruth } from "./api";

const newNovelDraftKey = "clue-forge.newNovelDraft.v1";
const editorDraftsKey = "clue-forge.editorDrafts.v1";

export type NewNovelDraft = {
	title: string;
	keywords: string;
	style: string;
	length: string;
	limits: string;
	decision: string;
	savedBriefJson?: string;
};

export type EditorDraft = {
	caseFeedback: string;
	caseDecision: string;
	selectedOptionId: string;
	draftCase: CaseTruth | null;
};

const readJson = <T>(key: string): T | null => {
	const value = localStorage.getItem(key);
	if (!value) {
		return null;
	}
	try {
		return JSON.parse(value) as T;
	} catch {
		localStorage.removeItem(key);
		return null;
	}
};

const writeJson = (key: string, value: unknown) => {
	localStorage.setItem(key, JSON.stringify(value));
};

export const loadNewNovelDraft = () =>
	readJson<NewNovelDraft>(newNovelDraftKey);

export const saveNewNovelDraft = (draft: NewNovelDraft) =>
	writeJson(newNovelDraftKey, draft);

export const clearNewNovelDraft = () => {
	localStorage.removeItem(newNovelDraftKey);
};

const loadEditorDrafts = () =>
	readJson<Record<string, EditorDraft>>(editorDraftsKey) ?? {};

export const loadEditorDraft = (novelId: string): EditorDraft | null =>
	loadEditorDrafts()[novelId] ?? null;

export const saveEditorDraft = (novelId: string, draft: EditorDraft) => {
	writeJson(editorDraftsKey, { ...loadEditorDrafts(), [novelId]: draft });
};

export const clearEditorDraft = (novelId: string) => {
	const drafts = loadEditorDrafts();
	delete drafts[novelId];
	writeJson(editorDraftsKey, drafts);
};
