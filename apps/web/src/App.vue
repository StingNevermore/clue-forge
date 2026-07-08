<script setup lang="ts">
import { computed, ref } from "vue";
import {
	type Brief,
	confirmBriefInput,
	createNovel,
	loadNovel,
	NeedsClarificationError,
	type NovelState,
} from "./api";

const title = ref("仪式杀人");
const keywords = ref("现代,刑警,连环杀人,宗教仪式,反转");
const style = ref("冷峻、社会派、本格结合");
const length = ref("30章左右");
const limits = ref("不写超自然真相");
const decision = ref("确认以上关键词和限制，进入案件真相设计。");
const novelId = ref("");
const state = ref<NovelState | null>(null);
const error = ref("");
const questions = ref<string[]>([]);
const loading = ref(false);
const savedBriefJson = ref("");

const keywordList = computed(() =>
	keywords.value
		.split(/[,，\n]/)
		.map((item) => item.trim())
		.filter(Boolean),
);

const limitList = computed(() =>
	limits.value
		.split(/[,，\n]/)
		.map((item) => item.trim())
		.filter(Boolean),
);

const brief = computed(
	(): Brief => ({
		keywords: keywordList.value,
		style: style.value,
		length: length.value,
		limits: limitList.value,
	}),
);

const briefJson = computed(() => JSON.stringify(brief.value));

const run = async <T>(fn: () => Promise<T>) => {
	loading.value = true;
	error.value = "";
	questions.value = [];
	try {
		return await fn();
	} catch (err) {
		if (err instanceof NeedsClarificationError) {
			questions.value = err.questions;
			error.value = "需要先补充或修正关键词信息";
			return;
		}
		error.value = err instanceof Error ? err.message : "请求失败";
	} finally {
		loading.value = false;
	}
};

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const create = () =>
	run(async () => {
		const novel = await createNovel(title.value, brief.value);
		novelId.value = novel.id;
		savedBriefJson.value = briefJson.value;
		state.value = await loadNovel(novel.id);
	});

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const confirm = () =>
	run(async () => {
		if (!novelId.value || savedBriefJson.value !== briefJson.value) {
			const novel = await createNovel(title.value, brief.value);
			novelId.value = novel.id;
			savedBriefJson.value = briefJson.value;
		}
		const result = await confirmBriefInput(novelId.value, decision.value);
		state.value = result.state;
	});
</script>

<template>
	<main class="workspace">
		<section class="panel">
			<h2>输入</h2>
			<a-input v-model="title" placeholder="标题" />
			<a-textarea
				v-model="keywords"
				:auto-size="{ minRows: 3, maxRows: 5 }"
				placeholder="关键词，用逗号或换行分隔"
			/>
			<a-input v-model="style" placeholder="风格" />
			<a-input v-model="length" placeholder="篇幅，例如 30章左右" />
			<a-textarea
				v-model="limits"
				:auto-size="{ minRows: 2, maxRows: 4 }"
				placeholder="限制，用逗号或换行分隔"
			/>
			<a-button type="primary" :loading="loading" @click="create">
				创建项目
			</a-button>
		</section>

		<section class="panel">
			<h2>确认</h2>
			<a-textarea v-model="decision" :auto-size="{ minRows: 5, maxRows: 8 }" />
			<a-button :disabled="!novelId" :loading="loading" @click="confirm">
				确认关键词并继续
			</a-button>
			<a-alert v-if="error" type="error" show-icon :title="error" />
			<a-list v-if="questions.length" :data="questions">
				<template #item="{ item }">
					<a-list-item>{{ item }}</a-list-item>
				</template>
			</a-list>
		</section>

		<section class="panel">
			<h2>状态</h2>
			<a-descriptions v-if="state" :column="1" bordered>
				<a-descriptions-item label="阶段">
					{{ state.stage }}
				</a-descriptions-item>
				<a-descriptions-item label="关键词">
					{{ state.brief.keywords.join(" / ") }}
				</a-descriptions-item>
				<a-descriptions-item label="风格">
					{{ state.brief.style || "未填写" }}
				</a-descriptions-item>
				<a-descriptions-item label="篇幅">
					{{ state.brief.length }}
				</a-descriptions-item>
				<a-descriptions-item label="限制">
					{{ state.brief.limits.join(" / ") || "无" }}
				</a-descriptions-item>
				<a-descriptions-item label="确认次数">
					{{ state.confirmations.length }}
				</a-descriptions-item>
			</a-descriptions>
			<a-empty v-else />
			<a-list v-if="state" :data="state.confirmations">
				<template #item="{ item }">
					<a-list-item>{{ item.stage }}: {{ item.summary }}</a-list-item>
				</template>
			</a-list>
		</section>
	</main>
</template>
