import type { ChapterDraft, NovelState, NovelSummary } from "./types";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const stateKey = (novelId: string, version: string) =>
	`novels/${novelId}/state/${version}.json`;
const chapterKey = (novelId: string, chapterNo: number, version: string) =>
	`novels/${novelId}/chapters/${chapterNo}/${version}.md`;

type NovelRecordRow = {
	id: string;
	title: string;
	current_version: string | null;
	updated_at: string;
};

export const listNovelRecords = async (
	env: CloudflareBindings,
): Promise<NovelSummary[]> => {
	const { results } = await env.NOVEL_DB.prepare(
		"SELECT id, title, current_version, updated_at FROM novels ORDER BY updated_at DESC",
	).all<NovelRecordRow>();
	return results.map((row) => ({
		id: row.id,
		title: row.title,
		currentVersion: row.current_version,
		updatedAt: row.updated_at,
	}));
};

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

export const saveChapterDraft = async (
	env: CloudflareBindings,
	novelId: string,
	draft: ChapterDraft,
	state: NovelState,
): Promise<string> => {
	const chapterId = id();
	const version = id();
	const createdAt = now();
	const stateR2Key = stateKey(novelId, version);
	const chapterR2Key = chapterKey(novelId, draft.chapterNo, version);

	await env.NOVEL_BUCKET.put(stateR2Key, JSON.stringify(state));
	await env.NOVEL_BUCKET.put(chapterR2Key, draft.body);
	await env.NOVEL_DB.batch([
		env.NOVEL_DB.prepare(
			"INSERT INTO versions (id, novel_id, kind, r2_key, created_at) VALUES (?, ?, ?, ?, ?)",
		).bind(version, novelId, "chapter_draft", stateR2Key, createdAt),
		env.NOVEL_DB.prepare(
			"UPDATE novels SET current_version = ?, updated_at = ? WHERE id = ?",
		).bind(version, createdAt, novelId),
		env.NOVEL_DB.prepare(
			`INSERT INTO chapters (id, novel_id, chapter_no, title, status, r2_key, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(novel_id, chapter_no) DO UPDATE SET
				title = excluded.title,
				status = excluded.status,
				r2_key = excluded.r2_key,
				updated_at = excluded.updated_at`,
		).bind(
			chapterId,
			novelId,
			draft.chapterNo,
			draft.title,
			"draft",
			chapterR2Key,
			createdAt,
		),
	]);

	return version;
};
