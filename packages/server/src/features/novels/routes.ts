import { Hono } from "hono";
import {
	confirmStep,
	createNovel,
	draftChapter,
	generateStep,
	listNovels,
} from "./service";
import { loadNovelState } from "./storage";
import type {
	ConfirmStepRequest,
	CreateNovelRequest,
	GenerateStepRequest,
} from "./types";

export const novelRoutes = new Hono<{ Bindings: CloudflareBindings }>();

type DraftChapterRequest = {
	provider?: string;
};

const isStringArray = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((item) => typeof item === "string");

novelRoutes.get("/novels", async (context) => {
	const novels = await listNovels(context.env);
	return context.json(novels);
});

novelRoutes.post("/novels", async (context) => {
	const input = await context.req.json<CreateNovelRequest>();
	if (
		!input.title?.trim() ||
		!input.brief ||
		!isStringArray(input.brief.keywords) ||
		typeof input.brief.style !== "string" ||
		typeof input.brief.length !== "string" ||
		!isStringArray(input.brief.limits)
	) {
		return context.json({ error: "title and brief are required" }, 400);
	}

	const novel = await createNovel(context.env, input);
	return context.json(novel, 201);
});

novelRoutes.get("/novels/:id", async (context) => {
	const state = await loadNovelState(context.env, context.req.param("id"));
	return context.json(state);
});

novelRoutes.post("/novels/:id/confirm", async (context) => {
	const input = await context.req.json<ConfirmStepRequest>();
	if (!input.stage || !input.decision || !Array.isArray(input.lockedFields)) {
		return context.json(
			{ error: "stage, decision, and lockedFields are required" },
			400,
		);
	}

	const result = await confirmStep(context.env, context.req.param("id"), input);
	if ("error" in result && result.error === "needs_clarification") {
		return context.json(result, 409);
	}
	if ("error" in result && result.error === "stage_conflict") {
		return context.json(result, 409);
	}
	return context.json(result);
});

novelRoutes.post("/novels/:id/generate", async (context) => {
	const input = await context.req.json<GenerateStepRequest>();
	if (input.stage !== "case_truth") {
		return context.json({ error: "stage must be case_truth" }, 400);
	}

	const result = await generateStep(
		context.env,
		context.req.param("id"),
		input,
	);
	if ("error" in result && result.error === "stage_conflict") {
		return context.json(result, 409);
	}
	return context.json(result);
});

novelRoutes.post("/novels/:id/chapters/:chapterNo/draft", async (context) => {
	const chapterNo = Number(context.req.param("chapterNo"));
	if (!Number.isInteger(chapterNo) || chapterNo < 1) {
		return context.json({ error: "chapterNo must be a positive integer" }, 400);
	}
	const input = await context.req
		.json<DraftChapterRequest>()
		.catch((): DraftChapterRequest => ({}));

	const result = await draftChapter(
		context.env,
		context.req.param("id"),
		chapterNo,
		input.provider,
	);
	return context.json(result);
});
