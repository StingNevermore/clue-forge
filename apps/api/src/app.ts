import { Hono } from "hono";
import { novelRoutes } from "./features/novels/routes";

export const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use("*", async (context, next) => {
	await next();
	context.header("cache-control", "no-store");
});

app.route("/", novelRoutes);

app.notFound((context) => context.json({ error: "Not found" }, 404));

app.onError((error, context) => {
	const url = new URL(context.req.url);
	console.error(
		JSON.stringify({
			message: "request failed",
			error: error instanceof Error ? error.message : String(error),
			method: context.req.method,
			path: url.pathname,
		}),
	);
	return context.json({ error: "Internal server error" }, 500);
});
