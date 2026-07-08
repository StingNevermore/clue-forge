<script setup lang="ts">
import { computed, ref } from "vue";
import {
	type Brief,
	type CaseTruth,
	type CaseTruthOption,
	confirmBriefInput,
	confirmCaseTruth,
	createNovel,
	generateCaseTruth,
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
const caseFeedback = ref("");
const caseDecision = ref(
	"确认此案件真相，锁定真凶、动机、作案方式和最终反转。",
);
const novelId = ref("");
const state = ref<NovelState | null>(null);
const draftCase = ref<CaseTruth | null>(null);
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
// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const canGenerateCaseTruth = computed(
	() => state.value?.stage === "case_truth",
);
// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const isCaseTruthConfirmed = computed(
	() => state.value?.stage === "case_truth_confirmed",
);

const run = async <T>(fn: () => Promise<T>) => {
	loading.value = true;
	error.value = "";
	questions.value = [];
	try {
		return await fn();
	} catch (err) {
		if (err instanceof NeedsClarificationError) {
			questions.value = err.questions;
			error.value = "需要先补充或修正信息";
			return;
		}
		error.value = err instanceof Error ? err.message : "请求失败";
	} finally {
		loading.value = false;
	}
};

const setState = (next: NovelState) => {
	state.value = next;
	const firstOption = next.caseTruthOptions[0];
	if (firstOption && !draftCase.value) {
		selectCaseTruth(firstOption);
	}
};

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const create = () =>
	run(async () => {
		const novel = await createNovel(title.value, brief.value);
		novelId.value = novel.id;
		savedBriefJson.value = briefJson.value;
		draftCase.value = null;
		setState(await loadNovel(novel.id));
	});

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const confirmBrief = () =>
	run(async () => {
		if (!novelId.value || savedBriefJson.value !== briefJson.value) {
			const novel = await createNovel(title.value, brief.value);
			novelId.value = novel.id;
			savedBriefJson.value = briefJson.value;
			draftCase.value = null;
		}
		const result = await confirmBriefInput(novelId.value, decision.value);
		setState(result.state);
	});

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const generateCaseTruthOptions = () =>
	run(async () => {
		const result = await generateCaseTruth(novelId.value, {
			feedback: caseFeedback.value,
		});
		draftCase.value = null;
		setState(result.state);
	});

const selectCaseTruth = (option: CaseTruthOption) => {
	draftCase.value = {
		victim: option.victim,
		surfaceMystery: option.surfaceMystery,
		truth: option.truth,
		culprit: option.culprit,
		motive: option.motive,
		method: option.method,
		coverUp: option.coverUp,
		finalTwist: option.finalTwist,
		reasoningHook: option.reasoningHook,
		status: "draft",
	};
};

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const confirmCase = () =>
	run(async () => {
		if (!draftCase.value) {
			error.value = "请先选择或填写案件真相。";
			return;
		}
		const result = await confirmCaseTruth(novelId.value, caseDecision.value, {
			...draftCase.value,
			truth:
				draftCase.value.truth.trim() ||
				`${draftCase.value.method}；${draftCase.value.finalTwist}`,
		});
		setState(result.state);
	});
</script>

<template>
	<main class="workspace">
		<section class="panel">
			<h2>关键词</h2>
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
			<a-textarea v-model="decision" :auto-size="{ minRows: 4, maxRows: 6 }" />
			<a-button :disabled="!novelId" :loading="loading" @click="confirmBrief">
				确认关键词并继续
			</a-button>
		</section>

		<section class="panel">
			<h2>案件真相</h2>
			<a-textarea
				v-model="caseFeedback"
				:auto-size="{ minRows: 3, maxRows: 5 }"
				placeholder="修改要求或重生成偏好"
			/>
			<a-button
				type="primary"
				:disabled="!canGenerateCaseTruth"
				:loading="loading"
				@click="generateCaseTruthOptions"
			>
				生成案件真相
			</a-button>

			<a-list
				v-if="state?.caseTruthOptions.length"
				:data="state.caseTruthOptions"
				class="option-list"
			>
				<template #item="{ item }">
					<a-list-item>
						<div class="option">
							<strong>{{ item.id }}. {{ item.title }}</strong>
							<span>{{ item.surfaceMystery }}</span>
							<span>真凶：{{ item.culprit }}</span>
							<a-button size="small" @click="selectCaseTruth(item)">
								选择
							</a-button>
						</div>
					</a-list-item>
				</template>
			</a-list>

			<div v-if="draftCase" class="case-editor">
				<a-input v-model="draftCase.victim" placeholder="被害人" />
				<a-textarea
					v-model="draftCase.surfaceMystery"
					:auto-size="{ minRows: 2, maxRows: 4 }"
					placeholder="表层谜面"
				/>
				<a-input v-model="draftCase.culprit" placeholder="真凶" />
				<a-textarea
					v-model="draftCase.motive"
					:auto-size="{ minRows: 2, maxRows: 4 }"
					placeholder="真凶动机"
				/>
				<a-textarea
					v-model="draftCase.method"
					:auto-size="{ minRows: 3, maxRows: 6 }"
					placeholder="真实作案过程"
				/>
				<a-textarea
					v-model="draftCase.coverUp"
					:auto-size="{ minRows: 2, maxRows: 4 }"
					placeholder="凶手如何掩盖真相"
				/>
				<a-textarea
					v-model="draftCase.finalTwist"
					:auto-size="{ minRows: 2, maxRows: 4 }"
					placeholder="最终反转"
				/>
				<a-textarea
					v-model="draftCase.reasoningHook"
					:auto-size="{ minRows: 2, maxRows: 4 }"
					placeholder="推理卖点"
				/>
				<a-textarea
					v-model="caseDecision"
					:auto-size="{ minRows: 3, maxRows: 5 }"
				/>
				<a-button
					type="primary"
					:disabled="!canGenerateCaseTruth"
					:loading="loading"
					@click="confirmCase"
				>
					确认案件真相
				</a-button>
			</div>
		</section>

		<section class="panel">
			<h2>状态</h2>
			<a-alert v-if="error" type="error" show-icon :title="error" />
			<a-list v-if="questions.length" :data="questions">
				<template #item="{ item }">
					<a-list-item>{{ item }}</a-list-item>
				</template>
			</a-list>
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
				<a-descriptions-item v-if="isCaseTruthConfirmed" label="真凶">
					{{ state.case.culprit }}
				</a-descriptions-item>
				<a-descriptions-item v-if="isCaseTruthConfirmed" label="最终反转">
					{{ state.case.finalTwist }}
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
