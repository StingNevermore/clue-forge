# Clue Forge MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Cloudflare-based MVP for a mystery-novel writing agent: create a novel, confirm each planning step, persist versioned state, and draft chapters from confirmed state.

**Architecture:** Keep Workers stateless. Store searchable metadata in D1 and large state/body snapshots in R2. Use one generic confirmation flow instead of one custom endpoint per step.

**Tech Stack:** Vue 3, Arco Design Vue, Hono, Cloudflare Worker, Cloudflare Pages Functions, D1, R2, Vitest, TypeScript.

## Global Constraints

- Do not add PostgreSQL, Redis, pgvector, BullMQ, queues, or a multi-agent framework.
- Do not use Worker memory as persistent state.
- Persist every user confirmation and generated chapter as a new version.
- Store large `NovelState` snapshots and chapter markdown in R2, not D1.
- Use D1 only for project indexes, version pointers, and chapter metadata.
- Do not add Durable Object in the first pass; add it only if concurrent writes to the same novel become a real issue.
- Confirm one layer at a time: direction, case, suspects, timeline/clues, chapter plan, chapter draft.

---

## File Structure

- Create: `apps/api/migrations/0001_novel_storage.sql`
  - D1 tables for novels, versions, chapters.
- Modify: `apps/api/wrangler.jsonc`
  - Add D1 and R2 bindings.
- Create: `apps/api/src/features/novels/types.ts`
  - Shared API and `NovelState` types.
- Create: `apps/api/src/features/novels/storage.ts`
  - D1/R2 read/write helpers.
- Create: `apps/api/src/features/novels/service.ts`
  - Pure business logic for create, confirm, load, draft.
- Create: `apps/api/src/features/novels/routes.ts`
  - Hono route definitions.
- Modify: `apps/api/src/app.ts`
  - Mount novel routes.
- Create: `apps/api/src/features/novels/service.test.ts`
  - Unit tests for versioning and locked-field behavior.
- Create: `apps/web/src/api.ts`
  - Small fetch wrapper.
- Replace: `apps/web/src/App.vue`
  - Minimal three-column workflow UI.

---

### Task 1: Add Cloudflare Storage Bindings And Schema

**Files:**
- Create: `apps/api/migrations/0001_novel_storage.sql`
- Modify: `apps/api/wrangler.jsonc`

**Interfaces:**
- Produces D1 tables: `novels`, `versions`, `chapters`
- Produces bindings: `NOVEL_DB`, `NOVEL_BUCKET`

- [ ] **Step 1: Create D1 migration**

Create `apps/api/migrations/0001_novel_storage.sql`:

```sql
CREATE TABLE IF NOT EXISTS novels (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	current_version TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS versions (
	id TEXT PRIMARY KEY,
	novel_id TEXT NOT NULL,
	kind TEXT NOT NULL,
	r2_key TEXT NOT NULL,
	created_at TEXT NOT NULL,
	FOREIGN KEY (novel_id) REFERENCES novels(id)
);

CREATE TABLE IF NOT EXISTS chapters (
	id TEXT PRIMARY KEY,
	novel_id TEXT NOT NULL,
	chapter_no INTEGER NOT NULL,
	title TEXT NOT NULL,
	status TEXT NOT NULL,
	r2_key TEXT,
	updated_at TEXT NOT NULL,
	UNIQUE (novel_id, chapter_no),
	FOREIGN KEY (novel_id) REFERENCES novels(id)
);
```

- [ ] **Step 2: Create the D1 database and R2 bucket**

Run with the user's normal Wrangler login:

```bash
pnpm -C apps/api exec wrangler d1 create clue-forge
pnpm -C apps/api exec wrangler r2 bucket create clue-forge-novels
```

Expected: Wrangler prints a D1 `database_id`. Use that exact value in the next step; the UUID below is an example and must be replaced before commit.

- [ ] **Step 3: Add bindings to Wrangler**

Modify `apps/api/wrangler.jsonc`:

```jsonc
{
	"$schema": "../../node_modules/wrangler/config-schema.json",
	"name": "clue-forge-api",
	"main": "./src/index.ts",
	"compatibility_date": "2026-07-07",
	"compatibility_flags": ["nodejs_compat"],
	"workers_dev": false,
	"preview_urls": false,
	"observability": {
		"enabled": true,
		"head_sampling_rate": 1
	},
	"d1_databases": [
		{
			"binding": "NOVEL_DB",
			"database_name": "clue-forge",
			"database_id": "11111111-1111-1111-1111-111111111111"
		}
	],
	"r2_buckets": [
		{
			"binding": "NOVEL_BUCKET",
			"bucket_name": "clue-forge-novels"
		}
	]
}
```

- [ ] **Step 4: Generate Cloudflare types**

Run:

```bash
pnpm -C apps/api run types
```

Expected: `apps/api/worker-configuration.d.ts` includes `NOVEL_DB` and `NOVEL_BUCKET`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/migrations/0001_novel_storage.sql apps/api/wrangler.jsonc apps/api/worker-configuration.d.ts
git commit -m "feat: add novel storage bindings"
```

---

### Task 2: Define The Minimal Novel State Model

**Files:**
- Create: `apps/api/src/features/novels/types.ts`

**Interfaces:**
- Produces: `NovelState`, `Confirmation`, `ChapterPlan`, `CreateNovelRequest`, `ConfirmStepRequest`
- Later tasks import these types.

- [ ] **Step 1: Create types**

Create `apps/api/src/features/novels/types.ts`:

```ts
export type ConfirmationStatus = "draft" | "confirmed";

export type Confirmation = {
	step: string;
	status: ConfirmationStatus;
	summary: string;
	lockedFields: string[];
	createdAt: string;
};

export type ChapterPlan = {
	chapter: number;
	purpose: string;
	newClues: string[];
	misdirection: string;
	mustNotReveal: string;
};

export type NovelState = {
	brief: {
		keywords: string[];
		length: string;
		style: string;
		limits: string[];
	};
	case: {
		surfaceMystery: string;
		truth: string;
		culprit: string;
		motive: string;
		method: string;
		coverUp: string;
		finalTwist: string;
	};
	characters: unknown[];
	timeline: unknown[];
	clues: unknown[];
	chapters: ChapterPlan[];
	confirmations: Confirmation[];
	qualityReports: unknown[];
};

export type CreateNovelRequest = {
	title: string;
	keywords: string[];
};

export type ConfirmStepRequest = {
	step: string;
	decision: string;
	lockedFields: string[];
};

export type NovelSummary = {
	id: string;
	title: string;
	currentVersion: string | null;
	updatedAt: string;
};
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm -C apps/api run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/novels/types.ts
git commit -m "feat: define novel state model"
```

---

### Task 3: Implement Versioned D1/R2 Storage

**Files:**
- Create: `apps/api/src/features/novels/storage.ts`
- Test: `apps/api/src/features/novels/service.test.ts`

**Interfaces:**
- Consumes: `NovelState`, `NovelSummary`
- Produces:
  - `createNovelRecord(env, title, initialState): Promise<NovelSummary>`
  - `loadNovelState(env, novelId): Promise<NovelState>`
  - `saveNovelVersion(env, novelId, kind, state): Promise<string>`

- [ ] **Step 1: Create storage helper**

Create `apps/api/src/features/novels/storage.ts`:

```ts
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
```

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm -C apps/api run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/novels/storage.ts
git commit -m "feat: add versioned novel storage"
```

---

### Task 4: Implement Pure Novel Workflow Service

**Files:**
- Create: `apps/api/src/features/novels/service.ts`
- Create: `apps/api/src/features/novels/service.test.ts`

**Interfaces:**
- Consumes: storage helpers from Task 3.
- Produces:
  - `makeInitialState(input: CreateNovelRequest): NovelState`
  - `applyConfirmation(state, input, createdAt): NovelState`
  - `createNovel(env, input): Promise<NovelSummary>`
  - `confirmStep(env, novelId, input): Promise<{ version: string; state: NovelState }>`

- [ ] **Step 1: Write service**

Create `apps/api/src/features/novels/service.ts`:

```ts
import {
	createNovelRecord,
	loadNovelState,
	saveNovelVersion,
} from "./storage";
import type {
	ConfirmStepRequest,
	CreateNovelRequest,
	NovelState,
	NovelSummary,
} from "./types";

export const makeInitialState = (input: CreateNovelRequest): NovelState => ({
	brief: {
		keywords: input.keywords,
		length: "30-60章",
		style: "",
		limits: [],
	},
	case: {
		surfaceMystery: "",
		truth: "",
		culprit: "",
		motive: "",
		method: "",
		coverUp: "",
		finalTwist: "",
	},
	characters: [],
	timeline: [],
	clues: [],
	chapters: [],
	confirmations: [],
	qualityReports: [],
});

export const applyConfirmation = (
	state: NovelState,
	input: ConfirmStepRequest,
	createdAt: string,
): NovelState => ({
	...state,
	confirmations: [
		...state.confirmations,
		{
			step: input.step,
			status: "confirmed",
			summary: input.decision,
			lockedFields: input.lockedFields,
			createdAt,
		},
	],
});

export const createNovel = (
	env: CloudflareBindings,
	input: CreateNovelRequest,
): Promise<NovelSummary> =>
	createNovelRecord(env, input.title, makeInitialState(input));

export const confirmStep = async (
	env: CloudflareBindings,
	novelId: string,
	input: ConfirmStepRequest,
): Promise<{ version: string; state: NovelState }> => {
	const state = await loadNovelState(env, novelId);
	const nextState = applyConfirmation(state, input, new Date().toISOString());
	const version = await saveNovelVersion(env, novelId, "confirmation", nextState);
	return { version, state: nextState };
};
```

- [ ] **Step 2: Write unit tests for pure logic**

Create `apps/api/src/features/novels/service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyConfirmation, makeInitialState } from "./service";

describe("novel workflow service", () => {
	it("creates initial state from title keywords", () => {
		const state = makeInitialState({
			title: "仪式杀人",
			keywords: ["现代", "刑警", "宗教仪式"],
		});

		expect(state.brief.keywords).toStrictEqual([
			"现代",
			"刑警",
			"宗教仪式",
		]);
		expect(state.brief.length).toBe("30-60章");
		expect(state.confirmations).toStrictEqual([]);
	});

	it("appends confirmation without mutating previous state", () => {
		const state = makeInitialState({
			title: "仪式杀人",
			keywords: ["现代"],
		});

		const next = applyConfirmation(
			state,
			{
				step: "case_direction",
				decision: "现代都市刑侦，宗教元素只是伪装",
				lockedFields: ["brief.keywords", "case.surfaceMystery"],
			},
			"2026-07-08T00:00:00.000Z",
		);

		expect(state.confirmations).toHaveLength(0);
		expect(next.confirmations).toStrictEqual([
			{
				step: "case_direction",
				status: "confirmed",
				summary: "现代都市刑侦，宗教元素只是伪装",
				lockedFields: ["brief.keywords", "case.surfaceMystery"],
				createdAt: "2026-07-08T00:00:00.000Z",
			},
		]);
	});
});
```

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm -C apps/api test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/features/novels/service.ts apps/api/src/features/novels/service.test.ts
git commit -m "feat: add novel confirmation workflow"
```

---

### Task 5: Add Novel API Routes

**Files:**
- Create: `apps/api/src/features/novels/routes.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces API:
  - `POST /novels`
  - `GET /novels/:id`
  - `POST /novels/:id/confirm`

- [ ] **Step 1: Create routes**

Create `apps/api/src/features/novels/routes.ts`:

```ts
import { Hono } from "hono";
import { createNovel, confirmStep } from "./service";
import { loadNovelState } from "./storage";
import type { ConfirmStepRequest, CreateNovelRequest } from "./types";

export const novelRoutes = new Hono<{ Bindings: CloudflareBindings }>();

novelRoutes.post("/novels", async (context) => {
	const input = await context.req.json<CreateNovelRequest>();
	if (!input.title || !Array.isArray(input.keywords)) {
		return context.json({ error: "title and keywords are required" }, 400);
	}

	const novel = await createNovel(context.env, input);
	return context.json(novel, 201);
});

novelRoutes.get("/novels/:id", async (context) => {
	const state = await loadNovelState(context.env, context.req.param("id"));
	return context.json(state);
});

novelRoutes.post("/novels/:id/confirm", async (context) => {
	const input = await context.req.json<ConfirmStepRequest>();
	if (!input.step || !input.decision || !Array.isArray(input.lockedFields)) {
		return context.json({ error: "step, decision, and lockedFields are required" }, 400);
	}

	const result = await confirmStep(context.env, context.req.param("id"), input);
	return context.json(result);
});
```

- [ ] **Step 2: Mount routes**

Modify `apps/api/src/app.ts`:

```ts
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
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm -C apps/api run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/features/novels/routes.ts apps/api/src/app.ts
git commit -m "feat: expose novel workflow routes"
```

---

### Task 6: Add Minimal Web UI For Confirmation Flow

**Files:**
- Create: `apps/web/src/api.ts`
- Replace: `apps/web/src/App.vue`

**Interfaces:**
- Consumes API routes from Task 5.
- Produces a first screen where the user can create a novel, confirm direction text, and see confirmation history.

- [ ] **Step 1: Create API client**

Create `apps/web/src/api.ts`:

```ts
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
	brief: { keywords: string[]; length: string; style: string; limits: string[] };
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
	requestJson<{ version: string; state: NovelState }>(`/api/novels/${id}/confirm`, {
		method: "POST",
		body: JSON.stringify({
			step: "case_direction",
			decision,
			lockedFields: ["brief.keywords", "brief.style"],
		}),
	});
```

- [ ] **Step 2: Replace the smoke page**

Replace `apps/web/src/App.vue` with a compact workflow UI:

```vue
<script setup lang="ts">
import { computed, ref } from "vue";
import { confirmStep, createNovel, loadNovel, type NovelState } from "./api";

const title = ref("仪式杀人");
const keywords = ref("现代,刑警,连环杀人,宗教仪式,反转");
const decision = ref("现代都市刑侦，宗教仪式只是伪装，核心是真实旧案复仇。");
const novelId = ref("");
const state = ref<NovelState | null>(null);
const error = ref("");
const loading = ref(false);

const keywordList = computed(() =>
	keywords.value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean),
);

const run = async <T,>(fn: () => Promise<T>) => {
	loading.value = true;
	error.value = "";
	try {
		return await fn();
	} catch (err) {
		error.value = err instanceof Error ? err.message : "请求失败";
	} finally {
		loading.value = false;
	}
};

const create = () =>
	run(async () => {
		const novel = await createNovel(title.value, keywordList.value);
		novelId.value = novel.id;
		state.value = await loadNovel(novel.id);
	});

const confirm = () =>
	run(async () => {
		if (!novelId.value) {
			throw new Error("请先创建小说项目");
		}
		const result = await confirmStep(novelId.value, decision.value);
		state.value = result.state;
	});
</script>

<template>
	<main class="workspace">
		<section class="panel">
			<h2>输入</h2>
			<a-input v-model="title" placeholder="标题" />
			<a-textarea v-model="keywords" :auto-size="{ minRows: 3, maxRows: 5 }" />
			<a-button type="primary" :loading="loading" @click="create">创建项目</a-button>
		</section>

		<section class="panel">
			<h2>确认</h2>
			<a-textarea v-model="decision" :auto-size="{ minRows: 5, maxRows: 8 }" />
			<a-button :disabled="!novelId" :loading="loading" @click="confirm">
				确认本轮方向
			</a-button>
			<a-alert v-if="error" type="error" show-icon :title="error" />
		</section>

		<section class="panel">
			<h2>状态</h2>
			<a-descriptions v-if="state" :column="1" bordered>
				<a-descriptions-item label="关键词">
					{{ state.brief.keywords.join(" / ") }}
				</a-descriptions-item>
				<a-descriptions-item label="确认次数">
					{{ state.confirmations.length }}
				</a-descriptions-item>
			</a-descriptions>
			<a-list v-if="state" :data="state.confirmations">
				<template #item="{ item }">
					<a-list-item>{{ item.step }}：{{ item.summary }}</a-list-item>
				</template>
			</a-list>
		</section>
	</main>
</template>
```

- [ ] **Step 3: Run web typecheck**

Run:

```bash
pnpm -C apps/web run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api.ts apps/web/src/App.vue
git commit -m "feat: add confirmation workflow ui"
```

---

### Task 7: Add Draft Chapter Stub

**Files:**
- Modify: `apps/api/src/features/novels/types.ts`
- Modify: `apps/api/src/features/novels/service.ts`
- Modify: `apps/api/src/features/novels/routes.ts`
- Modify: `apps/api/src/features/novels/service.test.ts`

**Interfaces:**
- Produces API: `POST /novels/:id/chapters/:chapterNo/draft`
- This task uses a deterministic stub first. Real LLM integration comes after state persistence works.

- [ ] **Step 1: Add chapter draft type**

Append to `apps/api/src/features/novels/types.ts`:

```ts
export type ChapterDraft = {
	chapterNo: number;
	title: string;
	body: string;
};
```

- [ ] **Step 2: Add deterministic draft function**

Modify the type import in `apps/api/src/features/novels/service.ts`:

```ts
import type {
	ChapterDraft,
	ConfirmStepRequest,
	CreateNovelRequest,
	NovelState,
	NovelSummary,
} from "./types";
```

Then append this function in the same file:

```ts
export const draftChapterFromState = (
	state: NovelState,
	chapterNo: number,
): ChapterDraft => {
	const plan = state.chapters.find((chapter) => chapter.chapter === chapterNo);
	const purpose = plan?.purpose ?? "推进案件调查";
	return {
		chapterNo,
		title: `第${chapterNo}章`,
		body: `本章功能：${purpose}\n\n本章只基于已确认设定生成，不新增关键证据。`,
	};
};
```

- [ ] **Step 3: Add route**

Modify the service import in `apps/api/src/features/novels/routes.ts`:

```ts
import { confirmStep, createNovel, draftChapterFromState } from "./service";
```

Then append this route in the same file:

```ts

novelRoutes.post("/novels/:id/chapters/:chapterNo/draft", async (context) => {
	const novelId = context.req.param("id");
	const chapterNo = Number(context.req.param("chapterNo"));
	if (!Number.isInteger(chapterNo) || chapterNo < 1) {
		return context.json({ error: "chapterNo must be a positive integer" }, 400);
	}

	const state = await loadNovelState(context.env, novelId);
	return context.json(draftChapterFromState(state, chapterNo));
});
```

- [ ] **Step 4: Test deterministic draft**

Append to `apps/api/src/features/novels/service.test.ts`:

```ts
import { draftChapterFromState } from "./service";

it("drafts chapter from chapter plan without new facts", () => {
	const state = makeInitialState({ title: "仪式杀人", keywords: ["现代"] });
	state.chapters = [
		{
			chapter: 1,
			purpose: "案发、谜面、主角进入案件",
			newClues: [],
			misdirection: "",
			mustNotReveal: "真凶身份",
		},
	];

	expect(draftChapterFromState(state, 1)).toStrictEqual({
		chapterNo: 1,
		title: "第1章",
		body: "本章功能：案发、谜面、主角进入案件\n\n本章只基于已确认设定生成，不新增关键证据。",
	});
});
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm -C apps/api test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/features/novels
git commit -m "feat: add deterministic chapter draft"
```

---

### Task 8: Replace Stub With LLM Adapter

**Files:**
- Create: `apps/api/src/features/novels/llm.ts`
- Modify: `apps/api/src/features/novels/service.ts`
- Modify: `apps/api/src/features/novels/routes.ts`

**Interfaces:**
- Produces: `generateChapterDraft(state, chapterNo): Promise<ChapterDraft>`
- Keeps deterministic `draftChapterFromState` as fallback for local tests.

- [ ] **Step 1: Create adapter boundary**

Create `apps/api/src/features/novels/llm.ts`:

```ts
import type { ChapterDraft, NovelState } from "./types";

export const generateChapterDraft = async (
	state: NovelState,
	chapterNo: number,
): Promise<ChapterDraft> => {
	const plan = state.chapters.find((chapter) => chapter.chapter === chapterNo);
	const purpose = plan?.purpose ?? "推进案件调查";

	return {
		chapterNo,
		title: `第${chapterNo}章`,
		body: `本章功能：${purpose}\n\nLLM 接入后替换这里，但仍必须遵守 NovelState 和 lockedFields。`,
	};
};
```

- [ ] **Step 2: Use adapter in route**

Modify the imports in `apps/api/src/features/novels/routes.ts`:

```ts
import { Hono } from "hono";
import { generateChapterDraft } from "./llm";
import { confirmStep, createNovel } from "./service";
import { loadNovelState } from "./storage";
import type { ConfirmStepRequest, CreateNovelRequest } from "./types";
```

Replace the chapter draft route with:

```ts
novelRoutes.post("/novels/:id/chapters/:chapterNo/draft", async (context) => {
	const novelId = context.req.param("id");
	const chapterNo = Number(context.req.param("chapterNo"));
	if (!Number.isInteger(chapterNo) || chapterNo < 1) {
		return context.json({ error: "chapterNo must be a positive integer" }, 400);
	}

	const state = await loadNovelState(context.env, novelId);
	return context.json(await generateChapterDraft(state, chapterNo));
});
```

- [ ] **Step 3: Keep tests deterministic**

Do not call a real external model in unit tests. Unit tests keep using `draftChapterFromState`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/features/novels/llm.ts apps/api/src/features/novels/routes.ts
git commit -m "feat: add chapter generation adapter"
```

---

### Task 9: Local End-To-End Check

**Files:**
- No source files required.

**Interfaces:**
- Verifies API and Web still build.

- [ ] **Step 1: Run API tests**

```bash
pnpm -C apps/api test
```

Expected: PASS.

- [ ] **Step 2: Run typechecks**

```bash
pnpm -r --if-present typecheck
```

Expected: PASS.

- [ ] **Step 3: Build web**

```bash
pnpm --filter @clue-forge/web build
```

Expected: Vite build completes.

- [ ] **Step 4: Run local Pages dev**

```bash
pnpm dev
```

Expected: local URL serves the UI, create/confirm requests reach `/api/novels`.

- [ ] **Step 5: Commit verification-only fixes**

Only commit if code changed:

```bash
git add -A
git commit -m "fix: pass mvp verification"
```

---

## Deferred Until After MVP

- Durable Object for per-novel write serialization.
- D1 tables for every clue, suspect, and timeline row.
- Vector search for style examples.
- Job queue for long chapter generation.
- Multi-novel series support.
- Rich clue matrix and suspect-curve visualization.

---

## Self-Review

- Spec coverage: the plan implements Cloudflare persistence, user confirmation, versioned state, minimal API, and minimal UI.
- Placeholder scan: no task depends on unspecified future work; LLM integration is isolated behind a small adapter.
- Type consistency: `NovelState`, `Confirmation`, `ChapterPlan`, `ChapterDraft`, `confirmStep`, and storage helper names match across tasks.
