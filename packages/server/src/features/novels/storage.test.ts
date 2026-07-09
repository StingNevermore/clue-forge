import { describe, expect, it, vi } from "vitest";
import { listNovelRecords } from "./storage";

const makeEnv = (
	results: {
		id: string;
		title: string;
		current_version: string | null;
		updated_at: string;
	}[],
) => {
	const all = vi.fn(async () => ({ results }));
	const prepare = vi.fn(() => ({ all }));
	return {
		env: { NOVEL_DB: { prepare } } as unknown as CloudflareBindings,
		all,
		prepare,
	};
};

describe("novel storage", () => {
	it("lists novel records newest first", async () => {
		const { env, prepare } = makeEnv([
			{
				id: "novel-id",
				title: "仪式杀人",
				current_version: "v2",
				updated_at: "2026-07-09T00:00:00.000Z",
			},
		]);

		await expect(listNovelRecords(env)).resolves.toStrictEqual([
			{
				id: "novel-id",
				title: "仪式杀人",
				currentVersion: "v2",
				updatedAt: "2026-07-09T00:00:00.000Z",
			},
		]);
		expect(prepare).toHaveBeenCalledWith(
			"SELECT id, title, current_version, updated_at FROM novels ORDER BY updated_at DESC",
		);
	});

	it("returns an empty array when there are no novels", async () => {
		const { env } = makeEnv([]);

		await expect(listNovelRecords(env)).resolves.toStrictEqual([]);
	});
});
