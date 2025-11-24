import { openai } from "@ai-sdk/openai";
import { Injectable } from "@nestjs/common";
import { type CoreMessage, type LanguageModelV1, type ToolCallPart, streamText, tool } from "ai";
import AiSdkError from "src/errors/ai-sdk.error";
import { MessageType } from "src/types/ai-sdk.types";
import jsonSchemaToZod from "src/utils/json-schema-to-zod";

import type { AiSdkConfig, SendMessageParams } from "src/types/ai-sdk.types";

// Сервис для работы с AI SDK
@Injectable()
export default class AiSdkService {
	private readonly model: LanguageModelV1;

	constructor(private readonly config: AiSdkConfig) {
		if (!this.config.baseURL) {
			throw new AiSdkError("baseURL is required");
		}

		if (!this.config.apiKey) {
			throw new AiSdkError("apiKey is required");
		}

		this.model = openai(this.config.model, {
			baseURL: this.config.baseURL,
			apiKey: this.config.apiKey,
		} as Record<string, string | undefined>);
	}

	// Стриминг ответа от AI (для real-time обновлений)
	async *streamMessage(params: SendMessageParams): AsyncGenerator<string, void, unknown> {
		const { text, conversationHistory = [], systemPrompt, tools, contextData } = params;

		// Формируем историю разговора с правильной типизацией CoreMessage[]
		const messages: CoreMessage[] = conversationHistory.map((msg) => ({
			role: msg.type === MessageType.USER ? "user" : "assistant",
			content: msg.text,
		}));

		messages.push({
			role: "user",
			content: text,
		});

		/**
		 * Если данные уже получены на Chat Service (есть в contextData), добавляем их как результат tool call
		 * Это позволяет модели сразу использовать данные без необходимости "вызывать" тулу
		 */
		if (contextData && Object.keys(contextData).length > 0) {
			// Добавляем ассистент сообщение с tool calls
			const toolCalls = Object.entries(contextData).map(
				([toolName]): ToolCallPart => ({
					type: "tool-call",
					toolCallId: `pre-fetched-${toolName}`,
					toolName,
					args: {}, // Данные уже получены, аргументы не нужны
				})
			);

			messages.push({
				role: "assistant",
				content: toolCalls,
			});

			// Добавляем tool results
			Object.entries(contextData).forEach(([toolName, toolData]) => {
				messages.push({
					role: "tool",
					content: [
						{
							type: "tool-result",
							toolCallId: `pre-fetched-${toolName}`,
							toolName,
							result: toolData,
						},
					],
				});
			});
		}

		/**
		 * Преобразуем ToolDefinition в формат AI SDK tools
		 * Регистрируем ВСЕ тулы из analysis.tools, чтобы модель могла их вызывать
		 * Для тул с данными в contextData execute не будет вызван (данные уже в истории как tool result)
		 * Для тул без данных execute вернет заглушку (Chat Service должен был получить данные заранее)
		 */
		const aiSdkTools = tools
			? Object.fromEntries(
					tools.map((toolDef) => {
						const zodSchema = jsonSchemaToZod(toolDef.parameters);

						return [
							toolDef.name,
							tool({
								description: toolDef.description,
								parameters: zodSchema as unknown as Parameters<typeof tool>[0]["parameters"],
								execute: async () => {
									// Проверяем, есть ли данные в contextData
									const toolData = contextData?.[toolDef.name];

									if (toolData !== null && toolData !== undefined) {
										// Данные есть, возвращаем их (на случай повторного вызова)
										return toolData;
									}

									// Данных нет - возвращаем ошибку
									return { error: "Data should be pre-fetched by Chat Service" };
								},
							}),
						];
					})
				)
			: undefined;

		try {
			/**
			 * Стримим ответ от AI
			 * Используем maxSteps для автоматического продолжения генерации после tool calls
			 */
			const result = await streamText({
				model: this.model,
				system: systemPrompt,
				messages,
				tools: aiSdkTools,
				maxTokens: this.config.maxTokens,
				temperature: this.config.temperature,
				maxSteps: 5,
			});

			let chunkCount = 0;

			// Сначала пробуем читать textStream (быстрый путь для обычных ответов)
			for await (const chunk of result.textStream) {
				chunkCount++;
				yield chunk;
			}

			// Если textStream пустой, читаем fullStream для отслеживания tool calls и текста после них
			if (!chunkCount) {
				let streamError: Error | null = null;

				for await (const part of result.fullStream) {
					if (part.type === "error") {
						streamError = AiSdkError.fromError(part.error);
						break; // Прерываем чтение при ошибке
					}

					if (part.type === "text-delta") {
						chunkCount++;
						yield part.textDelta;
					}
				}

				if (streamError) {
					throw AiSdkError.fromError(streamError);
				}
			}

			// Если все еще нет чанков после чтения fullStream, проверяем финальный результат
			if (!chunkCount) {
				// Получаем финальный результат - result уже является объектом, но text и toolCalls могут быть промисами
				try {
					const finishReason = await Promise.race([
						result.finishReason,
						new Promise<string>((_, reject) => {
							const timer = setTimeout(
								() => reject(new AiSdkError("Timeout waiting for result.finishReason")),
								5000
							);
							timer.unref();
						}),
					]);

					const finalText = await Promise.race([
						result.text,
						new Promise<string>((_, reject) => {
							const timer = setTimeout(
								() => reject(new AiSdkError("Timeout waiting for result.text")),
								30000
							);
							timer.unref();
						}),
					]);

					const finalToolCalls = (await Promise.race([
						result.toolCalls,
						new Promise<unknown[]>((_, reject) => {
							const timer = setTimeout(
								() => reject(new AiSdkError("Timeout waiting for result.toolCalls")),
								30000
							);
							timer.unref();
						}),
					])) as unknown[];

					// Если есть text в результате - используем его
					if (finalText && finalText.trim().length) {
						yield finalText;
						chunkCount = 1;
					} else if (finalToolCalls && finalToolCalls.length) {
						// Попробуем получить текст еще раз после небольшой задержки
						// Иногда AI SDK может генерировать текст асинхронно после tool calls
						await new Promise((resolve) => {
							const timer = setTimeout(resolve, 1000);
							timer.unref();
						});

						try {
							const delayedText = await result.text;

							if (delayedText && delayedText.trim().length) {
								yield delayedText;
								chunkCount = 1;
							} else {
								const errorMessage = `AI SDK called tools but did not generate text. ToolCalls: ${finalToolCalls.length}, FinishReason: ${finishReason || "unknown"}`;
								throw new AiSdkError(errorMessage);
							}
						} catch (delayedError: Error | unknown) {
							const errorMessage = `AI SDK called tools but did not generate text. ToolCalls: ${finalToolCalls.length}, FinishReason: ${finishReason || "unknown"}, Error: ${delayedError instanceof Error ? delayedError.message : "Unknown"}`;
							throw new AiSdkError(errorMessage, delayedError);
						}
					} else {
						const errorMessage = `AI SDK stream completed without generating any chunks or text. Messages: ${messages.length}, Tools: ${tools?.length || 0}, ContextData keys: ${contextData ? Object.keys(contextData).join(", ") : "none"}, FinishReason: ${finishReason || "unknown"}, ToolCalls: ${finalToolCalls?.length || 0}`;
						throw new AiSdkError(errorMessage);
					}
				} catch (resultError: Error | unknown) {
					const errorMessage = resultError instanceof Error ? resultError.message : "Unknown error";
					throw new AiSdkError(
						`AI SDK stream completed without generating any chunks. Messages: ${messages.length}, Tools: ${tools?.length || 0}, ContextData keys: ${contextData ? Object.keys(contextData).join(", ") : "none"}. Error getting final result: ${errorMessage}`,
						resultError
					);
				}
			}
		} catch (error: Error | unknown) {
			const contextInfo = `Messages: ${messages.length}, Tools: ${tools?.length || 0}, ContextData keys: ${contextData ? Object.keys(contextData).join(", ") : "none"}`;
			const errorStack = error instanceof Error ? error.stack : undefined;
			const fullMessage = `AI SDK stream error. ${contextInfo}. ${errorStack || ""}`;

			throw AiSdkError.fromError(error, fullMessage);
		}
	}
}
