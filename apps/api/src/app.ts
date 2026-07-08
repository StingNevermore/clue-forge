import { Hono } from "hono";
import { novelRoutes } from "./features/novels/routes";
import { healthRoutes } from "./routes/health";

export const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use("*", async (context, next) => {
	await next();
	context.header("cache-control", "no-store");
});

app.route("/", healthRoutes);
app.route("/", novelRoutes);

app.notFound((context) => context.json({ error: "Not found" }, 404));

app.onError((error, context) => {
	console.error(error);
	return context.json({ error: "Internal server error" }, 500);
});
