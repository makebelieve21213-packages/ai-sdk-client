import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency } from "@nestjs/common";

// Тип сообщения в чате
export enum MessageType {
	USER = "user",
	COPILOT = "copilot",
}

// Поддерживаемые модели OpenAI
export type OpenAIModel =
	| "gpt-4"
	| "gpt-4-turbo"
	| "gpt-4o"
	| "gpt-3.5-turbo"
	| "gpt-3.5-turbo-16k";

// Типы для асинхронной регистрации модуля
export interface AiSdkModuleAsyncOptions<T extends unknown[]>
	extends Pick<ModuleMetadata, "imports"> {
	useFactory: (...args: T) => AiSdkConfig | Promise<AiSdkConfig>;
	inject?: (InjectionToken | OptionalFactoryDependency)[];
}

// Конфигурация для AI SDK клиента
export interface AiSdkConfig {
	// Базовый URL API (опционально, для совместимых API)
	baseURL?: string;
	// API ключ провайдера (обязательно)
	apiKey: string;
	// Модель для использования
	model: OpenAIModel;
	// Максимальное количество токенов в ответе
	maxTokens?: number;
	// Температура для генерации (0.0 - 2.0)
	temperature?: number;
}

// Параметры для отправки сообщения
export interface SendMessageParams<
	TChatMessage extends { type: MessageType; text: string } = { type: MessageType; text: string },
	TToolDefinition extends {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	} = {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	},
> {
	userId: string;
	text: string;
	conversationHistory?: TChatMessage[];
	systemPrompt?: string;
	tools?: TToolDefinition[];
	contextData?: Record<string, unknown>;
}
