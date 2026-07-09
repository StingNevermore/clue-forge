<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { listNovels, type NovelSummary } from "./api";

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const router = useRouter();
const novels = ref<NovelSummary[]>([]);
const loading = ref(false);
const error = ref("");

const load = async () => {
	loading.value = true;
	error.value = "";
	try {
		novels.value = await listNovels();
	} catch (err) {
		error.value = err instanceof Error ? err.message : "加载失败";
	} finally {
		loading.value = false;
	}
};

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const formatTime = (value: string) => new Date(value).toLocaleString();

onMounted(load);
</script>

<template>
	<main class="workspace">
		<header class="hero">
			<div>
				<p class="eyebrow">Clue Forge</p>
				<h1>小说项目</h1>
			</div>
			<a-button type="primary" @click="router.push('/novels/new')">
				新建小说
			</a-button>
		</header>

		<section class="panel list-panel">
			<a-alert v-if="error" type="error" show-icon :title="error" />
			<a-spin :loading="loading" class="list-spin">
				<a-empty v-if="!loading && novels.length === 0" description="暂无小说项目">
					<template #extra>
						<a-button type="primary" @click="router.push('/novels/new')">
							新建小说
						</a-button>
					</template>
				</a-empty>
				<div v-else class="novel-list">
					<button
						v-for="novel in novels"
						:key="novel.id"
						type="button"
						class="novel-row"
						@click="router.push(`/novels/${novel.id}`)"
					>
						<span>
							<strong>{{ novel.title }}</strong>
							<small>更新于 {{ formatTime(novel.updatedAt) }}</small>
						</span>
						<a-button type="text" @click.stop="router.push(`/novels/${novel.id}`)">
							打开
						</a-button>
					</button>
				</div>
			</a-spin>
		</section>
	</main>
</template>
