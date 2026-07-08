import type { NovelState, NovelSummary } from "./types";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const stateKey = (novelId: string, version: string) =>
	`novels/${novelId}/state/${version}.json`;

export const createNovelRecord = async (
	env: CloudflareBindings,
	title: string,
	initialState: NovelState,
): Promise<NovelSummary> => {
	const novelId = id();
	const version = id();
	const createdAt = now();
	const r2Key = stateKey(novelId, version);

	await env.NOVEL_BUCKET.put(r2Key, JSON.stringify(initialState));
	await env.NOVEL_DB.batch([
		env.NOVEL_DB.prepare(
			"INSERT INTO novels (id, title, current_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
		).bind(novelId, title, version, createdAt, createdAt),
		env.NOVEL_DB.prepare(
			"INSERT INTO versions (id, novel_id, kind, r2_key, created_at) VALUES (?, ?, ?, ?, ?)",
		).bind(version, novelId, "initial", r2Key, createdAt),
	]);

	return { id: novelId, title, currentVersion: version, updatedAt: createdAt };
};

export const loadNovelState = async (
	env: CloudflareBindings,
	novelId: string,
): Promise<NovelState> => {
	const novel = await env.NOVEL_DB.prepare(
		"SELECT current_version FROM novels WHERE id = ?",
	)
		.bind(novelId)
		.first<{ current_version: string | null }>();

	if (!novel?.current_version) {
		throw new Error("Novel not found");
	}

	const version = await env.NOVEL_DB.prepare(
		"SELECT r2_key FROM versions WHERE id = ? AND novel_id = ?",
	)
		.bind(novel.current_version, novelId)
		.first<{ r2_key: string }>();

	if (!version) {
		throw new Error("Novel version not found");
	}

	const object = await env.NOVEL_BUCKET.get(version.r2_key);
	if (!object) {
		throw new Error("Novel state not found");
	}

	return object.json<NovelState>();
};

export const saveNovelVersion = async (
	env: CloudflareBindings,
	novelId: string,
	kind: string,
	state: NovelState,
): Promise<string> => {
	const version = id();
	const createdAt = now();
	const r2Key = stateKey(novelId, version);

	await env.NOVEL_BUCKET.put(r2Key, JSON.stringify(state));
	await env.NOVEL_DB.batch([
		env.NOVEL_DB.prepare(
			"INSERT INTO versions (id, novel_id, kind, r2_key, created_at) VALUES (?, ?, ?, ?, ?)",
		).bind(version, novelId, kind, r2Key, createdAt),
		env.NOVEL_DB.prepare(
			"UPDATE novels SET current_version = ?, updated_at = ? WHERE id = ?",
		).bind(version, createdAt, novelId),
	]);

	return version;
};
