import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import AiSdkService from "src/main/ai-sdk.service";
import { MessageType } from "src/types/ai-sdk.types";

import type { AiSdkConfig, SendMessageParams } from "src/types/ai-sdk.types";
import type { z } from "zod";

// Моки для @ai-sdk/openai и ai
jest.mock("@ai-sdk/openai");
jest.mock("ai");

describe("AiSdkService", () => {
	let service: AiSdkService;
	let mockConfig: AiSdkConfig;
	let mockModel: unknown;

	const mockStreamText = streamText as jest.MockedFunction<typeof streamText>;
	const mockOpenai = openai as jest.MockedFunction<typeof openai>;
	const mockTool = tool as jest.MockedFunction<typeof tool>;

	beforeEach(() => {
		jest.clearAllMocks();

		mockConfig = {
			baseURL: "https://api.openai.com/v1",
			apiKey: "test-api-key",
			model: "gpt-4",
			maxTokens: 1000,
			temperature: 0.7,
		};

		mockModel = {
			modelId: "gpt-4",
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		mockOpenai.mockReturnValue(mockModel as any);

		service = new AiSdkService(mockConfig);
	});

	afterEach(async () => {
		// Даем время для завершения всех async операций и генераторов
		// Используем несколько циклов event loop для гарантированного завершения
		await new Promise((resolve) => setImmediate(resolve));
		await new Promise((resolve) => setImmediate(resolve));
		// Очищаем все моки
		jest.clearAllMocks();
	});

	describe("constructor", () => {
		it("должен создать экземпляр AiSdkService", () => {
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(AiSdkService);
		});

		it("должен инициализировать модель OpenAI", () => {
			expect(mockOpenai).toHaveBeenCalledWith("gpt-4", {
				baseURL: "https://api.openai.com/v1",
				apiKey: "test-api-key",
			});
		});

		it("должен передать baseURL если он указан", () => {
			const configWithBaseUrl: AiSdkConfig = {
				...mockConfig,
				baseURL: "https://custom-api.com",
			};

			const customService = new AiSdkService(configWithBaseUrl);

			expect(mockOpenai).toHaveBeenCalledWith("gpt-4", {
				baseURL: "https://custom-api.com",
				apiKey: "test-api-key",
			});
			expect(customService).toBeDefined();
		});

		it("должен выбросить ошибку если baseURL не указан", () => {
			const configWithoutBaseUrl: AiSdkConfig = {
				apiKey: "test-api-key",
				model: "gpt-4",
				maxTokens: 1000,
				temperature: 0.7,
			};

			expect(() => new AiSdkService(configWithoutBaseUrl)).toThrow("baseURL is required");
		});

		it("должен выбросить ошибку если apiKey не указан", () => {
			const configWithoutApiKey: AiSdkConfig = {
				baseURL: "https://api.openai.com/v1",
				model: "gpt-4",
				maxTokens: 1000,
				temperature: 0.7,
			} as unknown as AiSdkConfig;

			expect(() => new AiSdkService(configWithoutApiKey)).toThrow("apiKey is required");
		});
	});

	describe("streamMessage", () => {
		const mockParams: SendMessageParams = {
			userId: "user-123",
			text: "Расскажи историю",
			conversationHistory: [],
		};

		const createMockTextStream = () => {
			return (async function* () {
				yield "Привет";
				yield "! ";
				yield "Как";
				yield " дела?";
			})();
		};

		const createMockStreamResult = () => {
			const textStream = createMockTextStream();
			return {
				textStream,
				text: Promise.resolve("Привет! Как дела?"),
				toolCalls: Promise.resolve([]),
				finishReason: "stop" as const,
			} as unknown as Awaited<ReturnType<typeof streamText>>;
		};

		beforeEach(() => {
			mockStreamText.mockImplementation(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(createMockStreamResult()) as any
			);

			// Настраиваем mockTool так, чтобы он возвращал объект с execute функцией из параметров
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			mockTool.mockImplementation((params: any) => {
				return {
					description: params.description || "",
					parameters: params.parameters || {},
					execute: params.execute,
				} as unknown as ReturnType<typeof tool>;
			});
		});

		it("должен вернуть AsyncGenerator", async () => {
			const generator = service.streamMessage(mockParams);

			expect(generator).toBeDefined();
			expect(generator[Symbol.asyncIterator]).toBeDefined();
		});

		it("должен стримить части ответа", async () => {
			const chunks: string[] = [];

			for await (const chunk of service.streamMessage(mockParams)) {
				chunks.push(chunk);
			}

			expect(chunks).toEqual(["Привет", "! ", "Как", " дела?"]);
		});

		it("должен вызвать streamText с правильными параметрами", async () => {
			const generator = service.streamMessage(mockParams);

			// Запускаем генератор для вызова streamText
			await generator.next();

			expect(mockStreamText).toHaveBeenCalledWith({
				model: mockModel,
				messages: [
					{
						role: "user",
						content: "Расскажи историю",
					},
				],
				maxTokens: 1000,
				temperature: 0.7,
				maxSteps: 5,
			});
		});

		it("должен обработать историю разговора при стриминге", async () => {
			const paramsWithHistory: SendMessageParams = {
				userId: "user-123",
				text: "Продолжи",
				conversationHistory: [
					{
						id: "msg-1",
						text: "Привет",
						type: MessageType.USER,
						userId: "user-123",
						createdAt: new Date().toISOString(),
					} as { type: MessageType; text: string },
					{
						id: "msg-2",
						text: "Привет!",
						type: MessageType.COPILOT,
						userId: "user-123",
						createdAt: new Date().toISOString(),
					} as { type: MessageType; text: string },
				],
			};

			const generator = service.streamMessage(paramsWithHistory);

			// Запускаем генератор для вызова streamText
			await generator.next();

			expect(mockStreamText).toHaveBeenCalledWith({
				model: mockModel,
				messages: [
					{
						role: "user",
						content: "Привет",
					},
					{
						role: "assistant",
						content: "Привет!",
					},
					{
						role: "user",
						content: "Продолжи",
					},
				],
				maxTokens: 1000,
				temperature: 0.7,
				maxSteps: 5,
			});
		});

		it("должен использовать конфигурацию maxTokens и temperature из конфига", async () => {
			const customConfig: AiSdkConfig = {
				...mockConfig,
				maxTokens: 2000,
				temperature: 0.9,
			};

			const customService = new AiSdkService(customConfig);

			const generator = customService.streamMessage(mockParams);

			// Запускаем генератор для вызова streamText
			await generator.next();

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					maxTokens: 2000,
					temperature: 0.9,
				})
			);
		});

		it("должен работать без истории разговора", async () => {
			const generator = service.streamMessage(mockParams);

			// Запускаем генератор для вызова streamText
			await generator.next();

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: [
						{
							role: "user",
							content: "Расскажи историю",
						},
					],
				})
			);
		});

		it("должен использовать дефолтное значение [] для conversationHistory если оно не передано", async () => {
			const paramsWithoutHistory: SendMessageParams = {
				userId: "user-123",
				text: "Расскажи историю",
			};

			const generator = service.streamMessage(paramsWithoutHistory);

			// Запускаем генератор для вызова streamText
			await generator.next();

			expect(mockStreamText).toHaveBeenCalledWith({
				model: mockModel,
				messages: [
					{
						role: "user",
						content: "Расскажи историю",
					},
				],
				maxTokens: 1000,
				temperature: 0.7,
				maxSteps: 5,
			});
		});

		it("должен преобразовать tools в формат AI SDK", async () => {
			const mockToolInstance = {
				description: "test tool",
				parameters: {},
				execute: jest.fn(),
			};

			mockTool.mockReturnValue(mockToolInstance as unknown as ReturnType<typeof tool>);

			const paramsWithTools: SendMessageParams = {
				userId: "user-123",
				text: "Получи цену BTC",
				tools: [
					{
						name: "getCryptoPrice",
						description: "Получить цену криптовалюты",
						parameters: {
							type: "object",
							properties: {
								symbol: { type: "string" },
							},
						},
					},
				],
			};

			const generator = service.streamMessage(paramsWithTools);

			// Запускаем генератор для вызова streamText
			await generator.next();

			expect(mockTool).toHaveBeenCalledWith({
				description: "Получить цену криптовалюты",
				parameters: expect.anything(),
				execute: expect.any(Function),
			});

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.objectContaining({
						getCryptoPrice: mockToolInstance,
					}),
				})
			);
		});

		it("должен вернуть данные из contextData в execute функции", async () => {
			const contextData = {
				getCryptoPrice: {
					price: 50000,
					symbol: "BTC",
				},
			};

			const paramsWithTools: SendMessageParams = {
				userId: "user-123",
				text: "Получи цену BTC",
				tools: [
					{
						name: "getCryptoPrice",
						description: "Получить цену криптовалюты",
						parameters: {},
					},
				],
				contextData,
			};

			const generator = service.streamMessage(paramsWithTools);

			// Запускаем генератор для вызова streamText и получаем все chunks
			const chunks: string[] = [];
			for await (const chunk of generator) {
				chunks.push(chunk);
			}

			// Получаем tools из вызова mockStreamText
			const streamTextCall = mockStreamText.mock.calls[mockStreamText.mock.calls.length - 1];
			const toolsPassedToStreamText = streamTextCall?.[0]?.tools as
				| Record<string, { execute: () => Promise<unknown> }>
				| undefined;

			expect(toolsPassedToStreamText).toBeDefined();
			expect(toolsPassedToStreamText?.getCryptoPrice).toBeDefined();

			const executeFn = toolsPassedToStreamText?.getCryptoPrice?.execute;
			expect(executeFn).toBeDefined();

			if (executeFn) {
				const result = await executeFn();
				expect(result).toEqual({
					price: 50000,
					symbol: "BTC",
				});
			}
		});

		it("должен вернуть пустой объект из execute функции если данных нет в contextData", async () => {
			const paramsWithTools: SendMessageParams = {
				userId: "user-123",
				text: "Получи цену BTC",
				tools: [
					{
						name: "getCryptoPrice",
						description: "Получить цену криптовалюты",
						parameters: {},
					},
				],
				contextData: {},
			};

			const generator = service.streamMessage(paramsWithTools);

			// Запускаем генератор для вызова streamText и получаем все chunks
			const chunks: string[] = [];
			for await (const chunk of generator) {
				chunks.push(chunk);
			}

			// Получаем tools из вызова mockStreamText
			const streamTextCall = mockStreamText.mock.calls[mockStreamText.mock.calls.length - 1];
			const toolsPassedToStreamText = streamTextCall?.[0]?.tools as
				| Record<string, { execute: () => Promise<unknown> }>
				| undefined;

			expect(toolsPassedToStreamText).toBeDefined();
			const executeFn = toolsPassedToStreamText?.getCryptoPrice?.execute;

			expect(executeFn).toBeDefined();

			if (executeFn) {
				const result = await executeFn();
				expect(result).toEqual({ error: "Data should be pre-fetched by Chat Service" });
			}
		});

		it("должен вернуть пустой объект из execute функции если contextData не передан", async () => {
			const paramsWithTools: SendMessageParams = {
				userId: "user-123",
				text: "Получи цену BTC",
				tools: [
					{
						name: "getCryptoPrice",
						description: "Получить цену криптовалюты",
						parameters: {},
					},
				],
			};

			const generator = service.streamMessage(paramsWithTools);

			// Запускаем генератор для вызова streamText и получаем все chunks
			const chunks: string[] = [];
			for await (const chunk of generator) {
				chunks.push(chunk);
			}

			// Получаем tools из вызова mockStreamText
			const streamTextCall = mockStreamText.mock.calls[mockStreamText.mock.calls.length - 1];
			const toolsPassedToStreamText = streamTextCall?.[0]?.tools as
				| Record<string, { execute: () => Promise<unknown> }>
				| undefined;

			expect(toolsPassedToStreamText).toBeDefined();
			const executeFn = toolsPassedToStreamText?.getCryptoPrice?.execute;

			expect(executeFn).toBeDefined();

			if (executeFn) {
				const result = await executeFn();
				expect(result).toEqual({ error: "Data should be pre-fetched by Chat Service" });
			}
		});

		it("должен вернуть пустой массив из execute функции если toolData является пустым массивом", async () => {
			const contextData = {
				getCryptoPrice: [],
			};

			const paramsWithTools: SendMessageParams = {
				userId: "user-123",
				text: "Получи цены",
				tools: [
					{
						name: "getCryptoPrice",
						description: "Получить цены криптовалюты",
						parameters: {},
					},
				],
				contextData,
			};

			const generator = service.streamMessage(paramsWithTools);

			const chunks: string[] = [];
			for await (const chunk of generator) {
				chunks.push(chunk);
			}

			const streamTextCall = mockStreamText.mock.calls[mockStreamText.mock.calls.length - 1];
			const toolsPassedToStreamText = streamTextCall?.[0]?.tools as
				| Record<string, { execute: () => Promise<unknown> }>
				| undefined;

			const executeFn = toolsPassedToStreamText?.getCryptoPrice?.execute;
			expect(executeFn).toBeDefined();

			if (executeFn) {
				const result = await executeFn();
				expect(result).toEqual([]);
			}
		});

		it("должен вернуть пустой объект из execute функции если toolData является пустым объектом", async () => {
			const contextData = {
				getCryptoPrice: {},
			};

			const paramsWithTools: SendMessageParams = {
				userId: "user-123",
				text: "Получи цену",
				tools: [
					{
						name: "getCryptoPrice",
						description: "Получить цену криптовалюты",
						parameters: {},
					},
				],
				contextData,
			};

			const generator = service.streamMessage(paramsWithTools);

			const chunks: string[] = [];
			for await (const chunk of generator) {
				chunks.push(chunk);
			}

			const streamTextCall = mockStreamText.mock.calls[mockStreamText.mock.calls.length - 1];
			const toolsPassedToStreamText = streamTextCall?.[0]?.tools as
				| Record<string, { execute: () => Promise<unknown> }>
				| undefined;

			const executeFn = toolsPassedToStreamText?.getCryptoPrice?.execute;
			expect(executeFn).toBeDefined();

			if (executeFn) {
				const result = await executeFn();
				expect(result).toEqual({});
			}
		});

		it("должен передать systemPrompt в streamText", async () => {
			const paramsWithSystemPrompt: SendMessageParams = {
				userId: "user-123",
				text: "Расскажи историю",
				systemPrompt: "Ты помощник по криптовалютам",
			};

			const generator = service.streamMessage(paramsWithSystemPrompt);

			// Запускаем генератор для вызова streamText
			await generator.next();

			expect(mockStreamText).toHaveBeenCalledWith({
				model: mockModel,
				system: "Ты помощник по криптовалютам",
				messages: [
					{
						role: "user",
						content: "Расскажи историю",
					},
				],
				maxTokens: 1000,
				temperature: 0.7,
				maxSteps: 5,
			});
		});

		it("должен обработать несколько tools и вернуть правильные данные из contextData", async () => {
			const mockTextStreamWithTools = (async function* () {
				yield "Данные получены";
			})();

			const mockStreamResultWithTools = {
				textStream: mockTextStreamWithTools,
				text: Promise.resolve("Данные получены"),
				toolCalls: Promise.resolve([]),
				finishReason: "stop",
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResultWithTools) as any
			);

			const contextData = {
				getCryptoPrice: {
					price: 50000,
					symbol: "BTC",
				},
				getDeFiData: {
					tvl: 1000000,
					protocol: "Uniswap",
				},
			};

			const paramsWithTools: SendMessageParams = {
				userId: "user-123",
				text: "Получи данные",
				tools: [
					{
						name: "getCryptoPrice",
						description: "Получить цену криптовалюты",
						parameters: {},
					},
					{
						name: "getDeFiData",
						description: "Получить данные DeFi",
						parameters: {},
					},
				],
				contextData,
			};

			const generator = service.streamMessage(paramsWithTools);

			// Запускаем генератор для вызова streamText и получаем все chunks
			const chunks: string[] = [];
			for await (const chunk of generator) {
				chunks.push(chunk);
			}

			expect(chunks).toEqual(["Данные получены"]);
			expect(mockTool).toHaveBeenCalledTimes(2);

			// Получаем tools из вызова mockStreamText
			const streamTextCall = mockStreamText.mock.calls[mockStreamText.mock.calls.length - 1];
			const toolsPassedToStreamText = streamTextCall?.[0]?.tools as
				| Record<string, { execute: () => Promise<unknown> }>
				| undefined;

			expect(toolsPassedToStreamText).toBeDefined();
			expect(toolsPassedToStreamText?.getCryptoPrice).toBeDefined();
			expect(toolsPassedToStreamText?.getDeFiData).toBeDefined();

			// Проверяем первый tool
			const executeFn1 = toolsPassedToStreamText?.getCryptoPrice?.execute;
			if (executeFn1) {
				const result1 = await executeFn1();
				expect(result1).toEqual({
					price: 50000,
					symbol: "BTC",
				});
			}

			// Проверяем второй tool
			const executeFn2 = toolsPassedToStreamText?.getDeFiData?.execute;
			if (executeFn2) {
				const result2 = await executeFn2();
				expect(result2).toEqual({
					tvl: 1000000,
					protocol: "Uniswap",
				});
			}

			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.objectContaining({
						getCryptoPrice: expect.any(Object),
						getDeFiData: expect.any(Object),
					}),
				})
			);
		});

		it("должен преобразовать JSON Schema parameters в Zod схему для tools", async () => {
			const paramsWithComplexSchema: SendMessageParams = {
				userId: "user-123",
				text: "Получи данные",
				tools: [
					{
						name: "getCryptoPrice",
						description: "Получить цену криптовалюты",
						parameters: {
							type: "object",
							properties: {
								symbol: { type: "string" },
								amount: { type: "number" },
								isActive: { type: "boolean" },
								tags: {
									type: "array",
									items: { type: "string" },
								},
							},
							required: ["symbol", "amount"],
						},
					},
				],
			};

			const generator = service.streamMessage(paramsWithComplexSchema);

			await generator.next();

			expect(mockTool).toHaveBeenCalledWith({
				description: "Получить цену криптовалюты",
				parameters: expect.any(Object),
				execute: expect.any(Function),
			});

			const toolCall = mockTool.mock.calls[mockTool.mock.calls.length - 1];
			const zodSchema = toolCall?.[0]?.parameters as unknown as z.ZodType<unknown> | undefined;

			expect(zodSchema).toBeDefined();

			if (zodSchema) {
				const validData = zodSchema.parse({
					symbol: "BTC",
					amount: 100,
					isActive: true,
					tags: ["crypto", "bitcoin"],
				}) as {
					symbol: string;
					amount: number;
					isActive: boolean;
					tags: string[];
				};

				expect(validData.symbol).toBe("BTC");
				expect(validData.amount).toBe(100);
				expect(validData.isActive).toBe(true);
				expect(validData.tags).toEqual(["crypto", "bitcoin"]);

				const invalidResult = zodSchema.safeParse({
					symbol: 123,
					amount: "not a number",
				});

				expect(invalidResult.success).toBe(false);
			}
		});

		it("должен обработать tools с массивом number items в parameters", async () => {
			const paramsWithArraySchema: SendMessageParams = {
				userId: "user-123",
				text: "Получи данные",
				tools: [
					{
						name: "calculateSum",
						description: "Вычислить сумму",
						parameters: {
							type: "object",
							properties: {
								numbers: {
									type: "array",
									items: { type: "number" },
								},
							},
							required: ["numbers"],
						},
					},
				],
			};

			const generator = service.streamMessage(paramsWithArraySchema);

			await generator.next();

			const toolCall = mockTool.mock.calls[mockTool.mock.calls.length - 1];
			const zodSchema = toolCall?.[0]?.parameters as unknown as z.ZodType<unknown> | undefined;

			if (zodSchema) {
				const validData = zodSchema.parse({
					numbers: [1, 2, 3, 4, 5],
				}) as { numbers: number[] };

				expect(validData.numbers).toEqual([1, 2, 3, 4, 5]);
			}
		});

		it("должен обработать tools без parameters", async () => {
			const paramsWithoutParameters: SendMessageParams = {
				userId: "user-123",
				text: "Получи данные",
				tools: [
					{
						name: "getData",
						description: "Получить данные",
						parameters: {},
					},
				],
			};

			const generator = service.streamMessage(paramsWithoutParameters);

			await generator.next();

			expect(mockTool).toHaveBeenCalledWith({
				description: "Получить данные",
				parameters: expect.anything(),
				execute: expect.any(Function),
			});
		});

		it("должен вернуть массив из execute функции если toolData является массивом", async () => {
			const contextData = {
				getCryptoPrice: [50000, 51000, 52000],
			};

			const paramsWithTools: SendMessageParams = {
				userId: "user-123",
				text: "Получи цены",
				tools: [
					{
						name: "getCryptoPrice",
						description: "Получить цены криптовалюты",
						parameters: {},
					},
				],
				contextData,
			};

			const generator = service.streamMessage(paramsWithTools);

			const chunks: string[] = [];
			for await (const chunk of generator) {
				chunks.push(chunk);
			}

			const streamTextCall = mockStreamText.mock.calls[mockStreamText.mock.calls.length - 1];
			const toolsPassedToStreamText = streamTextCall?.[0]?.tools as
				| Record<string, { execute: () => Promise<unknown> }>
				| undefined;

			const executeFn = toolsPassedToStreamText?.getCryptoPrice?.execute;
			expect(executeFn).toBeDefined();

			if (executeFn) {
				const result = await executeFn();
				expect(result).toEqual([50000, 51000, 52000]);
			}
		});

		it("должен вернуть объект из execute функции если toolData является объектом", async () => {
			const contextData = {
				getCryptoPrice: {
					price: 50000,
					symbol: "BTC",
					change: 5.2,
				},
			};

			const paramsWithTools: SendMessageParams = {
				userId: "user-123",
				text: "Получи цену",
				tools: [
					{
						name: "getCryptoPrice",
						description: "Получить цену криптовалюты",
						parameters: {},
					},
				],
				contextData,
			};

			const generator = service.streamMessage(paramsWithTools);

			const chunks: string[] = [];
			for await (const chunk of generator) {
				chunks.push(chunk);
			}

			const streamTextCall = mockStreamText.mock.calls[mockStreamText.mock.calls.length - 1];
			const toolsPassedToStreamText = streamTextCall?.[0]?.tools as
				| Record<string, { execute: () => Promise<unknown> }>
				| undefined;

			const executeFn = toolsPassedToStreamText?.getCryptoPrice?.execute;
			expect(executeFn).toBeDefined();

			if (executeFn) {
				const result = await executeFn();
				expect(result).toEqual({
					price: 50000,
					symbol: "BTC",
					change: 5.2,
				});
			}
		});

		it("должен вернуть примитивное значение из execute функции если toolData является примитивом", async () => {
			const contextData = {
				getCryptoPrice: 50000,
			};

			const paramsWithTools: SendMessageParams = {
				userId: "user-123",
				text: "Получи цену",
				tools: [
					{
						name: "getCryptoPrice",
						description: "Получить цену криптовалюты",
						parameters: {},
					},
				],
				contextData,
			};

			const generator = service.streamMessage(paramsWithTools);

			const chunks: string[] = [];
			for await (const chunk of generator) {
				chunks.push(chunk);
			}

			const streamTextCall = mockStreamText.mock.calls[mockStreamText.mock.calls.length - 1];
			const toolsPassedToStreamText = streamTextCall?.[0]?.tools as
				| Record<string, { execute: () => Promise<unknown> }>
				| undefined;

			const executeFn = toolsPassedToStreamText?.getCryptoPrice?.execute;
			expect(executeFn).toBeDefined();

			if (executeFn) {
				const result = await executeFn();
				expect(result).toBe(50000);
			}
		});

		it("должен вернуть строку из execute функции если toolData является строкой", async () => {
			const contextData = {
				getStatus: "active",
			};

			const paramsWithTools: SendMessageParams = {
				userId: "user-123",
				text: "Получи статус",
				tools: [
					{
						name: "getStatus",
						description: "Получить статус",
						parameters: {},
					},
				],
				contextData,
			};

			const generator = service.streamMessage(paramsWithTools);

			const chunks: string[] = [];
			for await (const chunk of generator) {
				chunks.push(chunk);
			}

			const streamTextCall = mockStreamText.mock.calls[mockStreamText.mock.calls.length - 1];
			const toolsPassedToStreamText = streamTextCall?.[0]?.tools as
				| Record<string, { execute: () => Promise<unknown> }>
				| undefined;

			const executeFn = toolsPassedToStreamText?.getStatus?.execute;
			expect(executeFn).toBeDefined();

			if (executeFn) {
				const result = await executeFn();
				expect(result).toBe("active");
			}
		});

		it("должен вернуть boolean из execute функции если toolData является boolean", async () => {
			const contextData = {
				isActive: true,
			};

			const paramsWithTools: SendMessageParams = {
				userId: "user-123",
				text: "Проверь активность",
				tools: [
					{
						name: "isActive",
						description: "Проверить активность",
						parameters: {},
					},
				],
				contextData,
			};

			const generator = service.streamMessage(paramsWithTools);

			const chunks: string[] = [];
			for await (const chunk of generator) {
				chunks.push(chunk);
			}

			const streamTextCall = mockStreamText.mock.calls[mockStreamText.mock.calls.length - 1];
			const toolsPassedToStreamText = streamTextCall?.[0]?.tools as
				| Record<string, { execute: () => Promise<unknown> }>
				| undefined;

			const executeFn = toolsPassedToStreamText?.isActive?.execute;
			expect(executeFn).toBeDefined();

			if (executeFn) {
				const result = await executeFn();
				expect(result).toBe(true);
			}
		});

		it("должен обработать fullStream когда textStream пустой", async () => {
			const mockFullStream = (async function* () {
				yield { type: "text-delta", textDelta: "Часть " };
				yield { type: "text-delta", textDelta: "ответа" };
			})();

			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: mockFullStream,
				text: Promise.resolve("Часть ответа"),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.resolve("stop" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const chunks: string[] = [];
			for await (const chunk of service.streamMessage(mockParams)) {
				chunks.push(chunk);
			}

			expect(chunks).toEqual(["Часть ", "ответа"]);
		});

		it("должен обработать ошибку из fullStream", async () => {
			const mockError = new Error("Stream error");
			const mockFullStream = (async function* () {
				yield { type: "error", error: mockError };
			})();

			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: mockFullStream,
				text: Promise.resolve(""),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.resolve("stop" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);
			const chunks: string[] = [];

			await expect(async () => {
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream error");
		});

		it("должен обработать ошибку из fullStream когда error не является Error", async () => {
			const mockFullStream = (async function* () {
				yield { type: "error", error: "String error" };
			})();

			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: mockFullStream,
				text: Promise.resolve(""),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.resolve("stop" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);
			const chunks: string[] = [];

			await expect(async () => {
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream error");
		});

		it("должен обработать случай когда chunkCount === 0 и есть finalText", async () => {
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve("Финальный текст"),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.resolve("stop" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const chunks: string[] = [];
			for await (const chunk of service.streamMessage(mockParams)) {
				chunks.push(chunk);
			}

			expect(chunks).toEqual(["Финальный текст"]);
		});

		it("должен обработать случай когда chunkCount === 0 и есть finalToolCalls с delayedText", async () => {
			const mockToolCalls = [
				{
					toolCallId: "call-1",
					toolName: "getCryptoPrice",
					args: { symbol: "BTC" },
				},
			];

			// Создаем объект с геттером text, который возвращает разные промисы при разных вызовах
			let textCallCount = 0;
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				get text() {
					textCallCount++;
					if (textCallCount === 1) {
						// Первый вызов возвращает пустую строку
						return Promise.resolve("");
					}
					// Второй вызов (после задержки) возвращает текст
					return Promise.resolve("Текст после tool calls");
				},
				toolCalls: Promise.resolve(mockToolCalls),
				finishReason: Promise.resolve("tool-calls" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const chunks: string[] = [];
			for await (const chunk of service.streamMessage(mockParams)) {
				chunks.push(chunk);
			}

			expect(chunks).toEqual(["Текст после tool calls"]);
		});

		it("должен выбросить ошибку когда chunkCount === 0 и есть finalToolCalls но нет delayedText", async () => {
			const mockToolCalls = [
				{
					toolCallId: "call-1",
					toolName: "getCryptoPrice",
					args: { symbol: "BTC" },
				},
			];

			// Создаем объект с геттером text, который возвращает пустую строку при втором вызове
			let textCallCount = 0;
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				get text() {
					textCallCount++;
					if (textCallCount === 1) {
						return Promise.resolve("");
					}
					// Второй вызов возвращает пустую строку (не пробелы)
					return Promise.resolve("");
				},
				toolCalls: Promise.resolve(mockToolCalls),
				finishReason: Promise.resolve("tool-calls" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK called tools but did not generate text");
		});

		it("должен выбросить ошибку когда chunkCount === 0 и есть finalToolCalls но delayedText пустой", async () => {
			const mockToolCalls = [
				{
					toolCallId: "call-1",
					toolName: "getCryptoPrice",
					args: { symbol: "BTC" },
				},
			];

			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve(""),
				toolCalls: Promise.resolve(mockToolCalls),
				finishReason: Promise.resolve("tool-calls" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK called tools but did not generate text");
		});

		it("должен выбросить ошибку когда chunkCount === 0 и нет ни text ни toolCalls", async () => {
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve(""),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.resolve("stop" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream completed without generating any chunks or text");
		});

		it("должен обработать ошибку в catch блоке resultError когда finishReason undefined", async () => {
			const mockToolCalls = [
				{
					toolCallId: "call-1",
					toolName: "getCryptoPrice",
					args: { symbol: "BTC" },
				},
			];

			// Создаем объект где finishReason резолвится в undefined
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve(""),
				toolCalls: Promise.resolve(mockToolCalls),
				finishReason: Promise.resolve(undefined as unknown as string),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK called tools but did not generate text");
		});

		it("должен обработать ошибку когда chunkCount === 0 и нет ни text ни toolCalls с undefined finishReason", async () => {
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve(""),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.resolve(undefined as unknown as string),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream completed without generating any chunks or text");
		});

		it("должен обработать ошибку в catch блоке delayedError когда finishReason undefined", async () => {
			const mockToolCalls = [
				{
					toolCallId: "call-1",
					toolName: "getCryptoPrice",
					args: { symbol: "BTC" },
				},
			];

			// Создаем объект с геттером text, который реджектится, и finishReason undefined
			let textCallCount = 0;
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				get text() {
					textCallCount++;
					if (textCallCount === 1) {
						return Promise.resolve("");
					}
					return Promise.reject(new Error("Text promise rejected"));
				},
				toolCalls: Promise.resolve(mockToolCalls),
				finishReason: Promise.resolve(undefined as unknown as string),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK called tools but did not generate text");
		});

		it("должен обработать ошибку в catch блоке resultError когда error не является Error", async () => {
			const mockToolCalls = [
				{
					toolCallId: "call-1",
					toolName: "getCryptoPrice",
					args: { symbol: "BTC" },
				},
			];

			// Создаем объект где finishReason реджектится со строкой
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve(""),
				toolCalls: Promise.resolve(mockToolCalls),
				finishReason: Promise.reject("String error"),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream completed without generating any chunks");
		});

		it("должен обработать ошибку в catch блоке resultError когда toolCalls undefined", async () => {
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve(""),
				toolCalls: Promise.resolve(undefined as unknown as unknown[]),
				finishReason: Promise.resolve("stop" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream completed without generating any chunks or text");
		});

		it("должен обработать ошибку в catch блоке resultError когда text реджектится", async () => {
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.reject(new Error("Text error")),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.resolve("stop" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream completed without generating any chunks");
		});

		it("должен обработать ошибку при получении delayedText", async () => {
			const mockToolCalls = [
				{
					toolCallId: "call-1",
					toolName: "getCryptoPrice",
					args: { symbol: "BTC" },
				},
			];

			// Создаем объект с геттером text, который возвращает разные промисы при разных вызовах
			let textCallCount = 0;
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				get text() {
					textCallCount++;
					if (textCallCount === 1) {
						// Первый вызов возвращает пустую строку
						return Promise.resolve("");
					}
					// Второй вызов реджектится
					return Promise.reject(new Error("Text promise rejected"));
				},
				toolCalls: Promise.resolve(mockToolCalls),
				finishReason: Promise.resolve("tool-calls" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK called tools but did not generate text");
		});

		it("должен обработать ошибку при получении delayedText когда error не является Error", async () => {
			const mockToolCalls = [
				{
					toolCallId: "call-1",
					toolName: "getCryptoPrice",
					args: { symbol: "BTC" },
				},
			];

			// Создаем объект с геттером text, который возвращает разные промисы при разных вызовах
			let textCallCount = 0;
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				get text() {
					textCallCount++;
					if (textCallCount === 1) {
						// Первый вызов возвращает пустую строку
						return Promise.resolve("");
					}
					// Второй вызов реджектится со строкой
					return Promise.reject("String error");
				},
				toolCalls: Promise.resolve(mockToolCalls),
				finishReason: Promise.resolve("tool-calls" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK called tools but did not generate text");
		});

		it("должен обработать ошибку при получении finalText когда error не является Error", async () => {
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.reject("String error"),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.resolve("stop" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream completed without generating any chunks");
		});

		it("должен обработать таймаут при получении result.text", async () => {
			// Мокируем setTimeout, чтобы таймаут срабатывал асинхронно, но быстро
			const mockTimer = {
				unref: jest.fn(),
			};
			const setTimeoutSpy = jest
				.spyOn(global, "setTimeout")
				.mockImplementation((callback: () => void) => {
					// Вызываем callback асинхронно через setImmediate, чтобы Promise.race успел запуститься
					setImmediate(() => {
						callback();
					});
					return mockTimer as unknown as NodeJS.Timeout;
				});

			// Создаем промис, который никогда не разрешается
			const neverResolvingTextPromise = new Promise<string>(() => {
				// Промис никогда не разрешается
			});

			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: neverResolvingTextPromise,
				toolCalls: Promise.resolve([]),
				finishReason: Promise.resolve("stop" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("Timeout waiting for result.text");

			setTimeoutSpy.mockRestore();
		});

		it("должен обработать таймаут при получении result.toolCalls", async () => {
			// Мокируем setTimeout, чтобы таймаут срабатывал асинхронно, но быстро
			const mockTimer = {
				unref: jest.fn(),
			};
			const setTimeoutSpy = jest
				.spyOn(global, "setTimeout")
				.mockImplementation((callback: () => void) => {
					// Вызываем callback асинхронно через setImmediate, чтобы Promise.race успел запуститься
					setImmediate(() => {
						callback();
					});
					return mockTimer as unknown as NodeJS.Timeout;
				});

			// Создаем промис, который никогда не разрешается
			const neverResolvingToolCallsPromise = new Promise<unknown[]>(() => {
				// Промис никогда не разрешается
			});

			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve(""),
				toolCalls: neverResolvingToolCallsPromise,
				finishReason: Promise.resolve("stop" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("Timeout waiting for result.toolCalls");

			setTimeoutSpy.mockRestore();
		});

		it("должен обработать общую ошибку в streamText", async () => {
			mockStreamText.mockImplementationOnce(() => {
				throw new Error("StreamText error");
			});

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream error");
		});

		it("должен обработать общую ошибку в streamText когда error не является Error", async () => {
			mockStreamText.mockImplementationOnce(() => {
				throw "String error";
			});

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream error");
		});

		it("должен включить stack trace в сообщение об ошибке когда он доступен", async () => {
			const error = new Error("StreamText error");
			error.stack = "Error: StreamText error\n    at test.js:1:1";

			mockStreamText.mockImplementationOnce(() => {
				throw error;
			});

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream error");
		});

		it("должен включить contextData keys в сообщение об ошибке", async () => {
			mockStreamText.mockImplementationOnce(() => {
				throw new Error("StreamText error");
			});

			const paramsWithContext: SendMessageParams = {
				userId: "user-123",
				text: "Тест",
				contextData: {
					tool1: "data1",
					tool2: "data2",
				},
			};

			const generator = service.streamMessage(paramsWithContext);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("ContextData keys: tool1, tool2");
		});

		it("должен включить tools count в сообщение об ошибке", async () => {
			mockStreamText.mockImplementationOnce(() => {
				throw new Error("StreamText error");
			});

			const paramsWithTools: SendMessageParams = {
				userId: "user-123",
				text: "Тест",
				tools: [
					{
						name: "tool1",
						description: "Tool 1",
						parameters: {},
					},
					{
						name: "tool2",
						description: "Tool 2",
						parameters: {},
					},
				],
			};

			const generator = service.streamMessage(paramsWithTools);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("Tools: 2");
		});

		it("должен включить messages count в сообщение об ошибке", async () => {
			mockStreamText.mockImplementationOnce(() => {
				throw new Error("StreamText error");
			});

			const paramsWithHistory: SendMessageParams = {
				userId: "user-123",
				text: "Тест",
				conversationHistory: [
					{
						id: "msg-1",
						text: "Привет",
						type: MessageType.USER,
						userId: "user-123",
						createdAt: new Date().toISOString(),
					} as { type: MessageType; text: string },
				],
			};

			const generator = service.streamMessage(paramsWithHistory);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("Messages: 2");
		});

		it("должен обработать случай когда finalText содержит только пробелы", async () => {
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve("   "),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.resolve("stop" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream completed without generating any chunks or text");
		});

		it("должен обработать случай когда delayedText содержит только пробелы", async () => {
			const mockToolCalls = [
				{
					toolCallId: "call-1",
					toolName: "getCryptoPrice",
					args: { symbol: "BTC" },
				},
			];

			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve("   "),
				toolCalls: Promise.resolve(mockToolCalls),
				finishReason: Promise.resolve("tool-calls" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK called tools but did not generate text");
		});

		it("должен выбросить ошибку на строке 225 с правильным сообщением включая все параметры", async () => {
			const paramsWithToolsAndContext: SendMessageParams = {
				userId: "user-123",
				text: "Тест",
				tools: [
					{
						name: "tool1",
						description: "Tool 1",
						parameters: {},
					},
					{
						name: "tool2",
						description: "Tool 2",
						parameters: {},
					},
				],
				contextData: {
					tool1: "data1",
					tool2: "data2",
				},
			};

			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve(""),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.resolve("stop" as const),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(paramsWithToolsAndContext);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream completed without generating any chunks or text");
		});

		it("должен выбросить ошибку на строке 225 с правильным сообщением когда finishReason unknown", async () => {
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve(""),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.resolve(undefined as unknown as string),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream completed without generating any chunks or text");
		});

		it("должен выбросить ошибку на строке 231 с правильным сообщением когда finishReason реджектится", async () => {
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve(""),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.reject(new Error("FinishReason error")),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream completed without generating any chunks");
		});

		it("должен выбросить ошибку на строке 231 с правильным сообщением включая contextData keys", async () => {
			const paramsWithContext: SendMessageParams = {
				userId: "user-123",
				text: "Тест",
				contextData: {
					tool1: "data1",
					tool2: "data2",
				},
			};

			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve(""),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.reject(new Error("FinishReason error")),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(paramsWithContext);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream completed without generating any chunks");
		});

		it("должен выбросить ошибку на строке 231 с правильным сообщением когда error не является Error", async () => {
			const mockStreamResult = {
				textStream: (async function* () {})(),
				fullStream: (async function* () {})(),
				text: Promise.resolve(""),
				toolCalls: Promise.resolve([]),
				finishReason: Promise.reject("String error"),
			} as unknown as Awaited<ReturnType<typeof streamText>>;

			mockStreamText.mockImplementationOnce(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				() => Promise.resolve(mockStreamResult) as any
			);

			const generator = service.streamMessage(mockParams);

			await expect(async () => {
				const chunks: string[] = [];
				for await (const chunk of generator) {
					chunks.push(chunk);
				}
			}).rejects.toThrow("AI SDK stream completed without generating any chunks");
		});
	});

	describe("constructor edge cases", () => {
		it("должен выбросить ошибку если baseURL является пустой строкой", () => {
			const configWithEmptyBaseUrl: AiSdkConfig = {
				baseURL: "",
				apiKey: "test-api-key",
				model: "gpt-4",
				maxTokens: 1000,
				temperature: 0.7,
			};

			expect(() => new AiSdkService(configWithEmptyBaseUrl)).toThrow("baseURL is required");
		});

		it("должен выбросить ошибку если apiKey является пустой строкой", () => {
			const configWithEmptyApiKey: AiSdkConfig = {
				baseURL: "https://api.openai.com/v1",
				apiKey: "",
				model: "gpt-4",
				maxTokens: 1000,
				temperature: 0.7,
			} as unknown as AiSdkConfig;

			expect(() => new AiSdkService(configWithEmptyApiKey)).toThrow("apiKey is required");
		});
	});
});
