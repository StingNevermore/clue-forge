import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

type LlmProviderConfig = {
	baseURL: string;
	apiKey: string;
	model: string;
};

type LlmProviderMap = Record<string, Partial<LlmProviderConfig> | undefined>;

export type LlmEnv = {
	LLM_PROVIDERS_JSON?: string | undefined;
	LLM_DEFAULT_PROVIDER?: string | undefined;
};

export type GenerateLlmTextInput = {
	provider?: string | undefined;
	messages: ChatCompletionMessageParam[];
};

const parseProviders = (env: LlmEnv): LlmProviderMap => {
	if (!env.LLM_PROVIDERS_JSON) {
		throw new Error("LLM_PROVIDERS_JSON is required");
	}

	try {
		const providers = JSON.parse(env.LLM_PROVIDERS_JSON) as unknown;
		if (
			!providers ||
			typeof providers !== "object" ||
			Array.isArray(providers)
		) {
			throw new Error("LLM_PROVIDERS_JSON must be an object");
		}
		return providers as LlmProviderMap;
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error("LLM_PROVIDERS_JSON must be valid JSON");
		}
		throw error;
	}
};

const resolveProvider = (
	env: LlmEnv,
	providerName: string | undefined,
): LlmProviderConfig => {
	const providers = parseProviders(env);
	const name = providerName ?? env.LLM_DEFAULT_PROVIDER;
	if (!name) {
		throw new Error("LLM provider is required");
	}

	const provider = providers[name];
	if (!provider) {
		throw new Error(`LLM provider "${name}" is not configured`);
	}

	if (!provider.baseURL || !provider.apiKey || !provider.model) {
		throw new Error(
			`LLM provider "${name}" requires baseURL, apiKey, and model`,
		);
	}

	return {
		baseURL: provider.baseURL,
		apiKey: provider.apiKey,
		model: provider.model,
	};
};

export const generateLlmText = async (
	env: LlmEnv,
	input: GenerateLlmTextInput,
): Promise<string> => {
	const provider = resolveProvider(env, input.provider);
	const client = new OpenAI({
		apiKey: provider.apiKey,
		baseURL: provider.baseURL,
	});
	const completion = await client.chat.completions.create({
		model: provider.model,
		messages: input.messages,
	});
	const text = completion.choices[0]?.message.content?.trim();
	if (!text) {
		throw new Error("LLM returned empty content");
	}
	return text;
};
