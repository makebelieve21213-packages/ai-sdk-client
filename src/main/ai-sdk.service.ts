import { openai } from "@ai-sdk/openai";
import { Injectable } from "@nestjs/common";
import { type CoreMessage, jsonSchema, type LanguageModelV1, streamText, tool } from "ai";
import AiSdkError from "src/errors/ai-sdk.error";
import { MessageType } from "src/types/message-type";

import type { AiSdkConfig, SendMessageParams } from "src/types/ai-sdk.types";

// Сервис для работы с AI SDK
@Injectable()
export default class AiSdkService {
	private readonly model: LanguageModelV1;

	constructor(private readonly config: AiSdkConfig) {
		if (!this.config.baseURL) {
			throw new AiSdkError("baseURL is required", undefined, { config: { model: this.config.model } });
		}

		if (!this.config.apiKey) {
			throw new AiSdkError("apiKey is required", undefined, {
				config: { model: this.config.model, baseURL: this.config.baseURL },
			});
		}

		this.model = openai(this.config.model, {
			baseURL: this.config.baseURL,
			apiKey: this.config.apiKey,
		} as Record<string, string | undefined>);
	}

	// Стриминг ответа от AI (для real-time обновлений)
	async *streamMessage<
		TChatMessage extends { type: string; text: string } = { type: string; text: string },
		TToolDefinition extends {
			name: string;
			description: string;
			parameters?: Record<string, unknown>;
		} = {
			name: string;
			description: string;
			parameters?: Record<string, unknown>;
		},
	>(
		params: SendMessageParams<TChatMessage, TToolDefinition>
	): AsyncGenerator<string, void, unknown> {
		const { text, conversationHistory = [], systemPrompt, tools, contextData } = params;

		// Формируем историю разговора с правильной типизацией CoreMessage[]
		const messages: CoreMessage[] = conversationHistory.map((msg) => ({
			role: msg.type === MessageType.USER ? ("user" as const) : ("assistant" as const),
			content: msg.text,
		}));

		messages.push({
			role: "user" as const,
			content: text,
		});

		/**
		 * Если данные уже получены на Chat Service (есть в contextData), добавляем их как результат tool call
		 * Это позволяет модели сразу использовать данные без необходимости "вызывать" тул
		 */
		if (contextData && Object.keys(contextData).length > 0) {
			// Добавляем ассистент сообщение с tool calls
			const toolCalls = Object.entries(contextData).map(([toolName]) => ({
				type: "tool-call" as const,
				toolCallId: `pre-fetched-${toolName}`,
				toolName,
				args: {}, // Данные уже получены, аргументы не нужны
			}));

			messages.push({
				role: "assistant" as const,
				content: toolCalls,
			});

			// Добавляем tool results
			Object.entries(contextData).forEach(([toolName, toolData]) => {
				messages.push({
					role: "tool" as const,
					content: [
						{
							type: "tool-result" as const,
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
						/**
						 * Используем jsonSchema() helper для передачи JSON Schema напрямую без конвертации через Zod
						 * Это сохраняет оригинальную структуру схемы и избегает потери информации при конвертациях
						 */
						const inputSchema = toolDef.parameters
							? jsonSchema(toolDef.parameters)
							: jsonSchema({ type: "object", properties: {} });

						return [
							toolDef.name,
							tool({
								description: toolDef.description,
								parameters: inputSchema, // AI SDK использует 'parameters' но принимает Schema объект
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
			if (chunkCount === 0) {
				let streamError: AiSdkError | null = null;

				for await (const part of result.fullStream) {
					if (part.type === "error") {
						streamError = AiSdkError.fromError(part.error, {
							messagesCount: messages.length,
							toolsCount: tools?.length || 0,
							contextDataKeys: contextData ? Object.keys(contextData) : [],
						});
						break; // Прерываем чтение при ошибке
					}

					if (part.type === "text-delta") {
						chunkCount++;
						yield part.textDelta;
					}
				}

				if (streamError) {
					throw streamError;
				}
			}

			// Если все еще нет чанков после чтения fullStream, проверяем финальный результат
			if (chunkCount === 0) {
				// Получаем финальный результат - result уже является объектом, но text и toolCalls могут быть промисами
				try {
					const finishReason = await Promise.race([
						result.finishReason,
						new Promise<string>((_, reject) => {
							const timer = setTimeout(
								() =>
									reject(
										new AiSdkError("Timeout waiting for result.finishReason", undefined, { timeout: 5000 })
									),
								5000
							);
							timer.unref();
						}),
					]);

					const finalText = await Promise.race([
						result.text,
						new Promise<string>((_, reject) => {
							const timer = setTimeout(
								() =>
									reject(new AiSdkError("Timeout waiting for result.text", undefined, { timeout: 30000 })),
								30000
							);
							timer.unref();
						}),
					]);

					const finalToolCalls = (await Promise.race([
						result.toolCalls,
						new Promise<unknown[]>((_, reject) => {
							const timer = setTimeout(
								() =>
									reject(
										new AiSdkError("Timeout waiting for result.toolCalls", undefined, { timeout: 30000 })
									),
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
								throw new AiSdkError(errorMessage, undefined, {
									toolCallsCount: finalToolCalls.length,
									finishReason: finishReason || "unknown",
									messagesCount: messages.length,
									toolsCount: tools?.length || 0,
									contextDataKeys: contextData ? Object.keys(contextData) : [],
								});
							}
						} catch (delayedError: Error | unknown) {
							const errorMessage = `AI SDK called tools but did not generate text. ToolCalls: ${finalToolCalls.length}, FinishReason: ${finishReason || "unknown"}, Error: ${delayedError instanceof Error ? delayedError.message : "Unknown"}`;
							throw AiSdkError.fromError(delayedError, {
								errorMessage,
								toolCallsCount: finalToolCalls.length,
								finishReason: finishReason || "unknown",
								messagesCount: messages.length,
								toolsCount: tools?.length || 0,
								contextDataKeys: contextData ? Object.keys(contextData) : [],
							});
						}
					} else {
						const errorMessage = `AI SDK stream completed without generating any chunks or text. Messages: ${messages.length}, Tools: ${tools?.length || 0}, ContextData keys: ${contextData ? Object.keys(contextData).join(", ") : "none"}, FinishReason: ${finishReason || "unknown"}, ToolCalls: ${finalToolCalls?.length || 0}`;
						throw new AiSdkError(errorMessage, undefined, {
							messagesCount: messages.length,
							toolsCount: tools?.length || 0,
							contextDataKeys: contextData ? Object.keys(contextData).join(", ") : "none",
							finishReason: finishReason || "unknown",
							toolCallsCount: finalToolCalls?.length || 0,
						});
					}
				} catch (resultError: Error | unknown) {
					const errorMessage = `AI SDK stream completed without generating any chunks. Messages: ${messages.length}, Tools: ${tools?.length || 0}, ContextData keys: ${contextData ? Object.keys(contextData).join(", ") : "none"}. Error getting final result: ${resultError instanceof Error ? resultError.message : "Unknown error"}`;
					throw AiSdkError.fromError(resultError, {
						errorMessage,
						messagesCount: messages.length,
						toolsCount: tools?.length || 0,
						contextDataKeys: contextData ? Object.keys(contextData).join(", ") : "none",
					});
				}
			}
		} catch (error: Error | unknown) {
			const errorMessage = `AI SDK stream error: ${error instanceof Error ? error.message : "Unknown error"}. Messages: ${messages.length}, Tools: ${tools?.length || 0}, ContextData keys: ${contextData ? Object.keys(contextData).join(", ") : "none"}`;
			throw AiSdkError.fromError(error, {
				errorMessage,
				messagesCount: messages.length,
				toolsCount: tools?.length || 0,
				contextDataKeys: contextData ? Object.keys(contextData).join(", ") : "none",
			});
		}
	}
}
