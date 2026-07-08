export type NovelSummary = {
	id: string;
	title: string;
	currentVersion: string | null;
	updatedAt: string;
};

export type Confirmation = {
	step: string;
	status: "draft" | "confirmed";
	summary: string;
	lockedFields: string[];
	createdAt: string;
};

export type NovelState = {
	brief: {
		keywords: string[];
		length: string;
		style: string;
		limits: string[];
	};
	confirmations: Confirmation[];
};

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
	const response = await fetch(url, {
		...init,
		headers: { "content-type": "application/json", ...init?.headers },
	});
	if (!response.ok) {
		throw new Error(`Request failed: ${response.status}`);
	}
	return response.json() as Promise<T>;
};

export const createNovel = (title: string, keywords: string[]) =>
	requestJson<NovelSummary>("/api/novels", {
		method: "POST",
		body: JSON.stringify({ title, keywords }),
	});

export const loadNovel = (id: string) =>
	requestJson<NovelState>(`/api/novels/${id}`);

export const confirmStep = (id: string, decision: string) =>
	requestJson<{ version: string; state: NovelState }>(
		`/api/novels/${id}/confirm`,
		{
			method: "POST",
			body: JSON.stringify({
				step: "case_direction",
				decision,
				lockedFields: ["brief.keywords", "brief.style"],
			}),
		},
	);
