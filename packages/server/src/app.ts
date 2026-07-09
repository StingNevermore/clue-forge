import { Hono } from "hono";
import { novelRoutes } from "./features/novels/routes";

export const app = new Hono<{ Bindings: CloudflareBindings }>();

const errorLogId = () => crypto.randomUUID();

const errorMessageFromResponse = async (response: Response) => {
	const contentType = response.headers.get("content-type") ?? "";
	if (contentType.includes("application/json")) {
		const body = await response
			.clone()
			.json<{ error?: unknown; message?: unknown }>()
			.catch(() => undefined);
		if (typeof body?.error === "string") {
			return body.error;
		}
		if (typeof body?.message === "string") {
			return body.message;
		}
	}
	return response.statusText || `HTTP ${response.status}`;
};

app.use("*", async (context, next) => {
	await next();
	context.header("cache-control", "no-store");
	if (context.res.status < 400 || context.res.headers.has("x-error-log-id")) {
		return;
	}

	const id = errorLogId();
	const url = new URL(context.req.url);
	const log = {
		id,
		event: "request returned error",
		message: await errorMessageFromResponse(context.res),
		method: context.req.method,
		path: url.pathname,
		status: context.res.status,
	};
	if (context.res.status >= 500) {
		console.error(JSON.stringify(log));
	} else {
		console.warn(JSON.stringify(log));
	}
	context.header("x-error-log-id", id);
});

app.route("/", novelRoutes);

app.notFound((context) => context.json({ error: "Not found" }, 404));

app.onError(async (error, context) => {
	const url = new URL(context.req.url);
	const id = errorLogId();
	const message = error instanceof Error ? error.message : String(error);
	console.error(
		JSON.stringify({
			id,
			event: "request failed",
			message,
			method: context.req.method,
			path: url.pathname,
			stack: error instanceof Error ? error.stack : undefined,
		}),
	);
	context.header("x-error-log-id", id);
	return context.json({ error: "Internal server error", errorLogId: id }, 500);
});
