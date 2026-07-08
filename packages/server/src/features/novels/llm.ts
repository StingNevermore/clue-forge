import { generateLlmText, type LlmEnv } from "../../llm";
import type { ChapterDraft, NovelState } from "./types";

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
