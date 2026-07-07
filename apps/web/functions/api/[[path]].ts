interface Env {
	API: Fetcher;
}

export const onRequest: PagesFunction<Env> = ({ env, request }) => {
	const url = new URL(request.url);
	url.pathname = url.pathname.replace(/^\/api/, "") || "/";
	return env.API.fetch(new Request(url, request));
};
