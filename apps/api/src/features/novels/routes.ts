import { Hono } from "hono";
import { confirmStep, createNovel } from "./service";
import { loadNovelState } from "./storage";
import type { ConfirmStepRequest, CreateNovelRequest } from "./types";

export const novelRoutes = new Hono<{ Bindings: CloudflareBindings }>();

novelRoutes.post("/novels", async (context) => {
	const input = await context.req.json<CreateNovelRequest>();
	if (!input.title || !Array.isArray(input.keywords)) {
		return context.json({ error: "title and keywords are required" }, 400);
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
	if (!input.step || !input.decision || !Array.isArray(input.lockedFields)) {
		return context.json(
			{ error: "step, decision, and lockedFields are required" },
			400,
		);
	}

	const result = await confirmStep(context.env, context.req.param("id"), input);
	return context.json(result);
});
