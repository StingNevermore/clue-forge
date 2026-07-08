import { afterEach, describe, expect, it, vi } from "vitest";
import { generateLlmText, type LlmEnv } from "./llm";

type FetchCall = [RequestInfo | URL, RequestInit?];

const env = (providers?: unknown, defaultProvider?: string): LlmEnv => ({
	...(providers === undefined
		? {}
		: { LLM_PROVIDERS_JSON: JSON.stringify(providers) }),
	...(defaultProvider === undefined
		? {}
		: { LLM_DEFAULT_PROVIDER: defaultProvider }),
});

const mockChatCompletion = (content: string | null) => {
	const fetch = vi.fn<(...args: FetchCall) => Promise<Response>>(async () =>
		Response.json({
			id: "chatcmpl_test",
			object: "chat.completion",
			created: 0,
			model: "test-model",
			choices: [{ index: 0, message: { role: "assistant", content } }],
		}),
	);
	vi.stubGlobal("fetch", fetch);
	return fetch;
};

describe("generateLlmText", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("uses the default provider config to call chat completions", async () => {
		const fetch = mockChatCompletion("案发于雨夜。");

		const text = await generateLlmText(
			env(
				{
					openai: {
						baseURL: "https://api.example.test/v1",
						apiKey: "secret",
						model: "story-model",
					},
				},
				"openai",
			),
			{ messages: [{ role: "user", content: "写一段正文" }] },
		);

		expect(text).toBe("案发于雨夜。");
		const [url, init] = fetch.mock.calls[0] as FetchCall;
		expect(String(url)).toBe("https://api.example.test/v1/chat/completions");
		expect(JSON.parse(String(init?.body))).toMatchObject({
			model: "story-model",
			messages: [{ role: "user", content: "写一段正文" }],
		});
	});

	it("prefers the explicit provider over the default provider", async () => {
		const fetch = mockChatCompletion("来自 DeepSeek。");

		await generateLlmText(
			env(
				{
					openai: {
						baseURL: "https://openai.example.test/v1",
						apiKey: "openai-key",
						model: "openai-model",
					},
					deepseek: {
						baseURL: "https://deepseek.example.test/v1",
						apiKey: "deepseek-key",
						model: "deepseek-model",
					},
				},
				"openai",
			),
			{
				provider: "deepseek",
				messages: [{ role: "user", content: "写一段正文" }],
			},
		);

		const [url, init] = fetch.mock.calls[0] as FetchCall;
		expect(String(url)).toBe(
			"https://deepseek.example.test/v1/chat/completions",
		);
		expect(JSON.parse(String(init?.body))).toMatchObject({
			model: "deepseek-model",
		});
	});

	it("fails when provider config is missing", async () => {
		await expect(
			generateLlmText(env(), {
				messages: [{ role: "user", content: "写一段正文" }],
			}),
		).rejects.toThrow("LLM_PROVIDERS_JSON is required");
	});

	it("fails when the provider is unknown", async () => {
		await expect(
			generateLlmText(
				env({
					openai: {
						baseURL: "https://api.example.test/v1",
						apiKey: "secret",
						model: "story-model",
					},
				}),
				{
					provider: "missing",
					messages: [{ role: "user", content: "写一段正文" }],
				},
			),
		).rejects.toThrow('LLM provider "missing" is not configured');
	});

	it("fails when provider fields are incomplete", async () => {
		await expect(
			generateLlmText(
				env({
					openai: {
						baseURL: "https://api.example.test/v1",
						apiKey: "secret",
					},
				}),
				{
					provider: "openai",
					messages: [{ role: "user", content: "写一段正文" }],
				},
			),
		).rejects.toThrow(
			'LLM provider "openai" requires baseURL, apiKey, and model',
		);
	});

	it("fails when the model returns empty text", async () => {
		mockChatCompletion(" ");

		await expect(
			generateLlmText(
				env({
					openai: {
						baseURL: "https://api.example.test/v1",
						apiKey: "secret",
						model: "story-model",
					},
				}),
				{
					provider: "openai",
					messages: [{ role: "user", content: "写一段正文" }],
				},
			),
		).rejects.toThrow("LLM returned empty content");
	});
});
