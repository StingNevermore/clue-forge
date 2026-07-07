<script setup lang="ts">
import { ref } from "vue";

type Health = {
	ok: boolean;
	service: string;
	time: string;
};

const isHealth = (value: unknown): value is Health => {
	if (!value || typeof value !== "object") {
		return false;
	}

	const health = value as Record<string, unknown>;
	return (
		typeof health.ok === "boolean" &&
		typeof health.service === "string" &&
		typeof health.time === "string"
	);
};

const loading = ref(true);
const health = ref<Health | null>(null);
const error = ref("");

fetch("/api/health")
	.then(async (response) => {
		if (!response.ok) {
			throw new Error(`API returned ${response.status}`);
		}
		const body: unknown = await response.json().catch(() => {
			throw new Error("API returned invalid health data");
		});

		if (!isHealth(body)) {
			throw new Error("API returned invalid health data");
		}

		health.value = body;
	})
	.catch((err: unknown) => {
		error.value = err instanceof Error ? err.message : "API request failed";
	})
	.finally(() => {
		loading.value = false;
	});
</script>

<template>
	<main>
		<a-card class="panel" :bordered="false">
			<a-space direction="vertical" size="large" fill>
				<a-space align="center" wrap>
					<a-tag color="arcoblue">Arco Design Vue</a-tag>
					<a-tag>Cloudflare Pages + Worker</a-tag>
				</a-space>

				<div>
					<h1>Clue Forge</h1>
					<p class="subtitle">Frontend UI framework smoke page</p>
				</div>

				<div v-if="loading" class="loading">
					<a-spin tip="Checking backend..." />
				</div>

				<a-alert
					v-else-if="error"
					type="error"
					show-icon
					title="Backend check failed"
				>
					{{ error }}
				</a-alert>

				<a-space v-else-if="health" direction="vertical" size="medium" fill>
					<a-alert type="success" show-icon title="Backend online">
						Health endpoint returned valid data.
					</a-alert>

					<a-descriptions :column="1" bordered>
						<a-descriptions-item label="Service">
							{{ health.service }}
						</a-descriptions-item>
						<a-descriptions-item label="Time">
							<time>{{ health.time }}</time>
						</a-descriptions-item>
					</a-descriptions>
				</a-space>
			</a-space>
		</a-card>
	</main>
</template>
