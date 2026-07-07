import { createApp, ref } from "vue";
import "./style.css";

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

const App = {
	setup() {
		const loading = ref(true);
		const health = ref<Health | null>(null);
		const error = ref("");

		fetch("/api/health")
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`API returned ${response.status}`);
				}
				const body: unknown = await response.json();

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

		return { loading, health, error };
	},
	template: `
    <main>
      <section class="panel">
        <p class="eyebrow">Cloudflare Pages + Worker</p>
        <h1>Clue Forge</h1>

        <div v-if="loading" class="status">Checking backend...</div>
        <div v-else-if="error" class="status error">{{ error }}</div>
        <div v-else-if="health" class="status ok">
          <span>Backend online</span>
          <strong>{{ health.service }}</strong>
          <time>{{ health.time }}</time>
        </div>
      </section>
    </main>
  `,
};

createApp(App).mount("#app");
