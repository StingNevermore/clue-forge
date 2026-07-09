<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
	type Brief,
	type CaseTruth,
	type CaseTruthOption,
	confirmBriefInput,
	confirmCaseStructure,
	confirmCaseTruth,
	createNovel,
	generateCaseStructure,
	generateCaseTruth,
	loadNovel,
	NeedsClarificationError,
	type NovelState,
} from "./api";
import {
	clearEditorDraft,
	clearNewNovelDraft,
	loadEditorDraft,
	loadNewNovelDraft,
	saveEditorDraft,
	saveNewNovelDraft,
} from "./drafts";

type WizardStep = "brief" | "generate" | "finalize" | "structure" | "result";

const route = useRoute();
const router = useRouter();
const routeNovelId = computed(() =>
	typeof route.params.id === "string" ? route.params.id : "",
);
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
const structureFeedback = ref("");
const structureDecision = ref("确认时间线、人物和线索设定，进入章节大纲。");
const novelId = ref("");
const state = ref<NovelState | null>(null);
const draftCase = ref<CaseTruth | null>(null);
const selectedOptionId = ref("");
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
const hasLockedBrief = computed(() => !!state.value);
// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const hasLockedCase = computed(
	() =>
		state.value?.stage === "case_truth_confirmed" ||
		state.value?.stage === "case_structure" ||
		state.value?.stage === "case_structure_confirmed",
);
const hasLockedStructure = computed(
	() => state.value?.stage === "case_structure_confirmed",
);
// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const hasGeneratedStructure = computed(
	() =>
		(state.value?.timeline.length ?? 0) > 0 ||
		(state.value?.characters.length ?? 0) > 0 ||
		(state.value?.clues.length ?? 0) > 0,
);
// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const caseOptions = computed(
	() => state.value?.caseTruthOptions.slice(0, 3) ?? [],
);
const currentStep = computed<WizardStep>(() => {
	if (hasLockedStructure.value) {
		return "result";
	}
	if (
		state.value?.stage === "case_truth_confirmed" ||
		state.value?.stage === "case_structure"
	) {
		return "structure";
	}
	if (draftCase.value) {
		return "finalize";
	}
	if (hasLockedBrief.value) {
		return "generate";
	}
	return "brief";
});

const steps: { key: WizardStep; title: string; summary: string }[] = [
	{ key: "brief", title: "题材输入", summary: "锁定关键词和限制" },
	{ key: "generate", title: "真相生成", summary: "比较 3 个方向" },
	{ key: "finalize", title: "方案定稿", summary: "改写后确认" },
	{ key: "structure", title: "结构设定", summary: "时间线、人物、线索" },
	{ key: "result", title: "结构锁定", summary: "衔接章节大纲" },
];

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const stepIndex = computed(() =>
	steps.findIndex((step) => step.key === currentStep.value),
);

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const primaryBriefAction = computed(() =>
	novelId.value && savedBriefJson.value === briefJson.value
		? "确认题材并继续"
		: "创建并确认题材",
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
};

const resetCaseDraft = () => {
	draftCase.value = null;
	selectedOptionId.value = "";
};

const restoreBrief = (next: NovelState) => {
	keywords.value = next.brief.keywords.join(",");
	style.value = next.brief.style;
	length.value = next.brief.length;
	limits.value = next.brief.limits.join(",");
	savedBriefJson.value = JSON.stringify(next.brief);
};

const restoreExistingNovel = async (id: string) => {
	novelId.value = id;
	const next = await loadNovel(id);
	setState(next);
	restoreBrief(next);
	const draft = loadEditorDraft(id);
	if (next.stage === "case_structure_confirmed") {
		clearEditorDraft(id);
		return;
	}
	if (draft) {
		caseFeedback.value = draft.caseFeedback;
		caseDecision.value = draft.caseDecision;
		selectedOptionId.value = draft.selectedOptionId;
		draftCase.value = draft.draftCase;
		structureFeedback.value = draft.structureFeedback ?? "";
		structureDecision.value =
			draft.structureDecision ?? structureDecision.value;
	}
};

const restoreNewNovel = () => {
	const draft = loadNewNovelDraft();
	if (!draft) {
		return;
	}
	title.value = draft.title;
	keywords.value = draft.keywords;
	style.value = draft.style;
	length.value = draft.length;
	limits.value = draft.limits;
	decision.value = draft.decision;
	savedBriefJson.value = draft.savedBriefJson ?? "";
};

onMounted(() => {
	const id = routeNovelId.value;
	if (id) {
		void run(() => restoreExistingNovel(id));
		return;
	}
	restoreNewNovel();
});

watch(
	[title, keywords, style, length, limits, decision, savedBriefJson],
	() => {
		if (routeNovelId.value || novelId.value) {
			return;
		}
		saveNewNovelDraft({
			title: title.value,
			keywords: keywords.value,
			style: style.value,
			length: length.value,
			limits: limits.value,
			decision: decision.value,
			savedBriefJson: savedBriefJson.value,
		});
	},
);

watch(
	[
		caseFeedback,
		caseDecision,
		selectedOptionId,
		draftCase,
		structureFeedback,
		structureDecision,
	],
	() => {
		if (!novelId.value || hasLockedStructure.value) {
			return;
		}
		saveEditorDraft(novelId.value, {
			caseFeedback: caseFeedback.value,
			caseDecision: caseDecision.value,
			selectedOptionId: selectedOptionId.value,
			draftCase: draftCase.value,
			structureFeedback: structureFeedback.value,
			structureDecision: structureDecision.value,
		});
	},
	{ deep: true },
);

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const confirmBrief = () =>
	run(async () => {
		if (!novelId.value || savedBriefJson.value !== briefJson.value) {
			const novel = await createNovel(title.value, brief.value);
			novelId.value = novel.id;
			savedBriefJson.value = briefJson.value;
			clearNewNovelDraft();
			resetCaseDraft();
			await router.replace(`/novels/${novel.id}`);
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
		resetCaseDraft();
		setState(result.state);
	});

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const selectCaseTruth = (option: CaseTruthOption) => {
	selectedOptionId.value = option.id;
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
		clearEditorDraft(novelId.value);
		setState(result.state);
	});

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const generateStructure = () =>
	run(async () => {
		const result = await generateCaseStructure(novelId.value, {
			feedback: structureFeedback.value,
		});
		setState(result.state);
	});

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const confirmStructure = () =>
	run(async () => {
		const result = await confirmCaseStructure(
			novelId.value,
			structureDecision.value,
		);
		clearEditorDraft(novelId.value);
		setState(result.state);
	});

// biome-ignore lint/correctness/noUnusedVariables: used by Vue template
const confirmationStageName = (stage: string) =>
	stage === "brief_input"
		? "题材"
		: stage === "case_truth"
			? "案件真相"
			: stage === "case_structure"
				? "结构设定"
				: stage;
</script>

<template>
	<main class="workspace">
		<header class="hero">
			<div>
				<p class="eyebrow">Clue Forge</p>
				<h1>案件创作向导</h1>
			</div>
			<p class="hero-copy">
				按顺序锁定题材、生成真相、定稿案件核心。未到阶段不显示入口。
			</p>
		</header>

		<nav class="steps" aria-label="创作步骤">
			<div
				v-for="(step, index) in steps"
				:key="step.key"
				class="step"
				:class="{
					active: currentStep === step.key,
					done: index < stepIndex || currentStep === 'result',
				}"
			>
				<span class="step-number">{{ index + 1 }}</span>
				<span>
					<strong>{{ step.title }}</strong>
					<small>{{ step.summary }}</small>
				</span>
			</div>
		</nav>

		<div class="content">
			<section class="panel task-panel">
				<a-alert v-if="error" type="error" show-icon :title="error">
					<template v-if="questions.length" #content>
						<ul class="question-list">
							<li v-for="item in questions" :key="item">{{ item }}</li>
						</ul>
					</template>
				</a-alert>

				<div v-if="currentStep === 'brief'" class="task-stack">
					<div class="section-head">
						<p class="eyebrow">Step 1</p>
						<h2>先锁定题材边界</h2>
						<p>
							这些内容会作为案件真相生成的约束。确认后进入下一步。
						</p>
					</div>

					<div class="field-grid">
						<label>
							<span>标题</span>
							<a-input v-model="title" placeholder="标题" />
						</label>
						<label>
							<span>篇幅</span>
							<a-input v-model="length" placeholder="篇幅，例如 30章左右" />
						</label>
					</div>
					<label>
						<span>关键词</span>
						<a-textarea
							v-model="keywords"
							:auto-size="{ minRows: 3, maxRows: 5 }"
							placeholder="关键词，用逗号或换行分隔"
						/>
					</label>
					<label>
						<span>风格</span>
						<a-input v-model="style" placeholder="风格" />
					</label>
					<label>
						<span>限制</span>
						<a-textarea
							v-model="limits"
							:auto-size="{ minRows: 2, maxRows: 4 }"
							placeholder="限制，用逗号或换行分隔"
						/>
					</label>
					<label>
						<span>确认说明</span>
						<a-textarea
							v-model="decision"
							:auto-size="{ minRows: 3, maxRows: 5 }"
						/>
					</label>
					<a-button type="primary" :loading="loading" @click="confirmBrief">
						{{ primaryBriefAction }}
					</a-button>
				</div>

				<div v-else-if="currentStep === 'generate'" class="task-stack">
					<div class="section-head">
						<p class="eyebrow">Step 2</p>
						<h2>生成并比较案件真相</h2>
						<p>
							先看方向是否成立，再选择一个方案进入完整定稿。
						</p>
					</div>
					<label>
						<span>生成偏好</span>
						<a-textarea
							v-model="caseFeedback"
							:auto-size="{ minRows: 3, maxRows: 5 }"
							placeholder="例如：更社会派、更本格、反转更克制"
						/>
					</label>
					<a-button
						type="primary"
						:loading="loading"
						@click="generateCaseTruthOptions"
					>
						{{ caseOptions.length ? "重新生成 3 个方案" : "生成 3 个真相方案" }}
					</a-button>

					<div v-if="caseOptions.length" class="option-grid">
						<button
							v-for="item in caseOptions"
							:key="item.id"
							type="button"
							class="option-card"
							:class="{ selected: selectedOptionId === item.id }"
							@click="selectCaseTruth(item)"
						>
							<strong>{{ item.id }}. {{ item.title }}</strong>
							<span>{{ item.surfaceMystery }}</span>
							<span>真凶：{{ item.culprit }}</span>
							<span>反转：{{ item.finalTwist }}</span>
						</button>
					</div>
				</div>

				<div v-else-if="currentStep === 'finalize' && draftCase" class="task-stack">
					<div class="section-head">
						<p class="eyebrow">Step 3</p>
						<h2>改写后锁定案件真相</h2>
						<p>
							这里是案件的核心事实。确认后进入时间线、人物和线索设定。
						</p>
					</div>

					<div class="field-grid">
						<label>
							<span>被害人</span>
							<a-input v-model="draftCase.victim" placeholder="被害人" />
						</label>
						<label>
							<span>真凶</span>
							<a-input v-model="draftCase.culprit" placeholder="真凶" />
						</label>
					</div>
					<label>
						<span>表层谜面</span>
						<a-textarea
							v-model="draftCase.surfaceMystery"
							:auto-size="{ minRows: 2, maxRows: 4 }"
							placeholder="表层谜面"
						/>
					</label>
					<label>
						<span>真凶动机</span>
						<a-textarea
							v-model="draftCase.motive"
							:auto-size="{ minRows: 2, maxRows: 4 }"
							placeholder="真凶动机"
						/>
					</label>
					<label>
						<span>真实作案过程</span>
						<a-textarea
							v-model="draftCase.method"
							:auto-size="{ minRows: 3, maxRows: 6 }"
							placeholder="真实作案过程"
						/>
					</label>
					<label>
						<span>掩盖方式</span>
						<a-textarea
							v-model="draftCase.coverUp"
							:auto-size="{ minRows: 2, maxRows: 4 }"
							placeholder="凶手如何掩盖真相"
						/>
					</label>
					<label>
						<span>最终反转</span>
						<a-textarea
							v-model="draftCase.finalTwist"
							:auto-size="{ minRows: 2, maxRows: 4 }"
							placeholder="最终反转"
						/>
					</label>
					<label>
						<span>推理卖点</span>
						<a-textarea
							v-model="draftCase.reasoningHook"
							:auto-size="{ minRows: 2, maxRows: 4 }"
							placeholder="推理卖点"
						/>
					</label>
					<label>
						<span>确认说明</span>
						<a-textarea
							v-model="caseDecision"
							:auto-size="{ minRows: 3, maxRows: 5 }"
						/>
					</label>
					<a-button type="primary" :loading="loading" @click="confirmCase">
						确认并锁定案件真相
					</a-button>
				</div>

				<div v-else-if="currentStep === 'structure'" class="task-stack">
					<div class="section-head">
						<p class="eyebrow">Step 4</p>
						<h2>案件真相已锁定</h2>
						<p>
							基于已确认真相生成支撑设定。确认后进入章节大纲。
						</p>
					</div>
					<a-descriptions v-if="state" :column="1" bordered>
						<a-descriptions-item label="真凶">
							{{ state.case.culprit }}
						</a-descriptions-item>
						<a-descriptions-item label="动机">
							{{ state.case.motive }}
						</a-descriptions-item>
						<a-descriptions-item label="作案方式">
							{{ state.case.method }}
						</a-descriptions-item>
						<a-descriptions-item label="最终反转">
							{{ state.case.finalTwist }}
						</a-descriptions-item>
						<a-descriptions-item label="推理卖点">
							{{ state.case.reasoningHook }}
						</a-descriptions-item>
					</a-descriptions>

					<label>
						<span>结构生成偏好</span>
						<a-textarea
							v-model="structureFeedback"
							:auto-size="{ minRows: 3, maxRows: 5 }"
							placeholder="例如：线索更公平、红鲱鱼更克制、时间线更紧凑"
						/>
					</label>
					<a-button type="primary" :loading="loading" @click="generateStructure">
						{{ hasGeneratedStructure ? "重新生成结构设定" : "生成结构设定" }}
					</a-button>

					<template v-if="state && hasGeneratedStructure">
						<a-divider />
						<div class="section-head">
							<h2>真实时间线</h2>
						</div>
						<div class="structure-list">
							<article
								v-for="item in state.timeline"
								:key="`${item.time}-${item.location}-${item.actualEvent}`"
								class="structure-item"
							>
								<strong>{{ item.time }} · {{ item.location }}</strong>
								<p>真实：{{ item.actualEvent }}</p>
								<p>声称：{{ item.claimedEvent }}</p>
								<p>人物：{{ item.people.join(" / ") }}</p>
								<p>
									读者知道：{{ item.readerKnowsAt }}；侦探知道：{{
										item.detectiveKnowsAt
									}}
								</p>
							</article>
						</div>

						<div class="section-head">
							<h2>人物与动机</h2>
						</div>
						<div class="structure-list">
							<article
								v-for="item in state.characters"
								:key="`${item.name}-${item.truthStatus}`"
								class="structure-item"
							>
								<strong>{{ item.name }} · {{ item.role }}</strong>
								<p>关系：{{ item.relationship }}</p>
								<p>动机：{{ item.motive }}</p>
								<p>秘密：{{ item.secret }}</p>
								<p>谎言：{{ item.lie }}</p>
								<p>真相状态：{{ item.truthStatus }}</p>
							</article>
						</div>

						<div class="section-head">
							<h2>关键线索</h2>
						</div>
						<div class="structure-list">
							<article
								v-for="item in state.clues"
								:key="item.id"
								class="structure-item"
							>
								<strong>{{ item.id }} · {{ item.description }}</strong>
								<p>首次出现：{{ item.firstSeen }}；回收：{{ item.payoff }}</p>
								<p>表层含义：{{ item.surfaceMeaning }}</p>
								<p>真实含义：{{ item.realMeaning }}</p>
								<p>公平线索：{{ item.fair ? "是" : "否" }}</p>
							</article>
						</div>

						<a-alert
							v-for="(report, index) in state.qualityReports"
							:key="index"
							:type="report.pass ? 'success' : 'warning'"
							show-icon
							:title="report.pass ? '结构检查通过' : '结构检查需要关注'"
						>
							<template #content>
								<ul class="question-list">
									<li v-for="item in report.questions" :key="item">
										问题：{{ item }}
									</li>
									<li v-for="item in report.problems" :key="item">
										风险：{{ item }}
									</li>
								</ul>
							</template>
						</a-alert>

						<label>
							<span>确认说明</span>
							<a-textarea
								v-model="structureDecision"
								:auto-size="{ minRows: 3, maxRows: 5 }"
							/>
						</label>
						<a-button type="primary" :loading="loading" @click="confirmStructure">
							确认结构设定并继续
						</a-button>
					</template>
				</div>

				<div v-else class="task-stack">
					<div class="section-head">
						<p class="eyebrow">Step 5</p>
						<h2>结构设定已锁定</h2>
						<p>
							时间线、人物和线索已确认。下一阶段将基于这些内容生成章节大纲。
						</p>
					</div>
					<a-descriptions v-if="state" :column="1" bordered>
						<a-descriptions-item label="时间线">
							{{ state.timeline.length }} 条
						</a-descriptions-item>
						<a-descriptions-item label="人物">
							{{ state.characters.length }} 个
						</a-descriptions-item>
						<a-descriptions-item label="线索">
							{{ state.clues.length }} 条
						</a-descriptions-item>
						<a-descriptions-item label="下一阶段">
							章节大纲
						</a-descriptions-item>
					</a-descriptions>
				</div>
			</section>

			<aside class="panel summary-panel">
				<h2>已锁定摘要</h2>
				<div class="summary-block">
					<strong>{{ hasLockedBrief ? "题材已锁定" : "题材待确认" }}</strong>
					<p>{{ title }}</p>
					<p>{{ keywordList.join(" / ") || "暂无关键词" }}</p>
					<p>{{ style || "未填写风格" }}</p>
					<p>{{ length || "未填写篇幅" }}</p>
					<p>{{ limitList.join(" / ") || "无限制" }}</p>
				</div>

				<div class="summary-block">
					<strong>{{ hasLockedCase ? "真相已锁定" : "真相待定稿" }}</strong>
					<template v-if="hasLockedCase && state">
						<p>真凶：{{ state.case.culprit }}</p>
						<p>反转：{{ state.case.finalTwist }}</p>
					</template>
					<p v-else>选择一个生成方案并确认后显示。</p>
				</div>

				<div class="summary-block">
					<strong>{{
						hasLockedStructure
							? "结构已锁定"
							: hasGeneratedStructure
								? "结构待确认"
								: "结构待生成"
					}}</strong>
					<template v-if="state && hasGeneratedStructure">
						<p>时间线：{{ state.timeline.length }} 条</p>
						<p>人物：{{ state.characters.length }} 个</p>
						<p>线索：{{ state.clues.length }} 条</p>
					</template>
					<p v-else>案件真相确认后生成。</p>
				</div>

				<div v-if="state?.confirmations.length" class="summary-block">
					<strong>确认记录</strong>
					<ul class="history-list">
						<li v-for="item in state.confirmations" :key="item.createdAt">
							<span>{{ confirmationStageName(item.stage) }}</span>
							<small>{{ item.summary }}</small>
						</li>
					</ul>
				</div>
			</aside>
		</div>
	</main>
</template>
