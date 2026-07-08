import { app } from "@clue-forge/server/app";

export default {
	fetch(request, env, context) {
		const url = new URL(request.url);
		if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
			url.pathname = url.pathname.replace(/^\/api/, "") || "/";
			return app.fetch(new Request(url, request), env, context);
		}

		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<CloudflareBindings>;
