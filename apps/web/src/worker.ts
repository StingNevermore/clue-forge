export default {
	fetch(request, env) {
		const url = new URL(request.url);
		if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
			url.pathname = url.pathname.replace(/^\/api/, "") || "/";
			return env.API.fetch(new Request(url, request));
		}

		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<CloudflareBindings>;
