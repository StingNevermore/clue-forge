import type { ChapterDraft, NovelState } from "./types";

export const generateChapterDraft = async (
	state: NovelState,
	chapterNo: number,
): Promise<ChapterDraft> => {
	const plan = state.chapters.find((chapter) => chapter.chapter === chapterNo);
	const purpose = plan?.purpose ?? "推进案件调查";

	return {
		chapterNo,
		title: `第${chapterNo}章`,
		body: `本章功能：${purpose}\n\nLLM 接入后替换这里，但仍必须遵守 NovelState 和 lockedFields。`,
	};
};
