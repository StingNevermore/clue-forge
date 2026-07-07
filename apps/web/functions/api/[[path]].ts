export const onRequest: PagesFunction<CloudflareBindings> = ({
	env,
	request,
}) => {
	const url = new URL(request.url);
	url.pathname = url.pathname.replace(/^\/api/, "") || "/";
	return env.API.fetch(new Request(url, request));
};
