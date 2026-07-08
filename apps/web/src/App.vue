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

const run = async <T>(fn: () => Promise<T>) => {
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

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const create = () =>
	run(async () => {
		const novel = await createNovel(title.value, keywordList.value);
		novelId.value = novel.id;
		state.value = await loadNovel(novel.id);
	});

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
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
			<a-button type="primary" :loading="loading" @click="create">
				创建项目
			</a-button>
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
			<a-empty v-else />
			<a-list v-if="state" :data="state.confirmations">
				<template #item="{ item }">
					<a-list-item>{{ item.step }}: {{ item.summary }}</a-list-item>
				</template>
			</a-list>
		</section>
	</main>
</template>
