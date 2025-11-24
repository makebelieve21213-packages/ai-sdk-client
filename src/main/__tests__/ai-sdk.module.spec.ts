import { ConfigModule, registerAs } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import AiSdkModule from "src/main/ai-sdk.module";
import AiSdkService from "src/main/ai-sdk.service";
import { AI_SDK_OPTIONS } from "src/utils/injection-keys";

import type { TestingModule } from "@nestjs/testing";
import type { AiSdkConfig } from "src/types/ai-sdk.types";

describe("AiSdkModule", () => {
	const mockConfig: AiSdkConfig = {
		baseURL: "https://api.openai.com/v1",
		apiKey: "test-api-key",
		model: "gpt-4",
		maxTokens: 1000,
		temperature: 0.7,
	};

	describe("forRootAsync", () => {
		let module: TestingModule;

		const testAiSdkConfig = registerAs("aiSdk", (): AiSdkConfig => mockConfig);

		beforeEach(async () => {
			module = await Test.createTestingModule({
				imports: [
					ConfigModule.forRoot({
						isGlobal: true,
						load: [testAiSdkConfig],
					}),
					AiSdkModule.forRootAsync<[AiSdkConfig]>({
						useFactory: (config: AiSdkConfig) => config,
						inject: [testAiSdkConfig.KEY],
					}),
				],
			}).compile();
		});

		afterEach(async () => {
			await module.close();
		});

		it("должен быть определен", () => {
			expect(module).toBeDefined();
		});

		it("должен предоставить AiSdkService через forRootAsync", async () => {
			const service = await module.resolve<AiSdkService>(AiSdkService);
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(AiSdkService);
		});

		it("должен использовать useFactory для создания опций", () => {
			const factory = jest.fn().mockReturnValue(mockConfig);
			const dynamicModule = AiSdkModule.forRootAsync({
				useFactory: factory,
			});

			const optionsProvider = dynamicModule.providers?.find(
				(p) => typeof p === "object" && "provide" in p && p.provide === AI_SDK_OPTIONS
			);

			expect(optionsProvider).toBeDefined();

			if (typeof optionsProvider === "object" && "useFactory" in optionsProvider) {
				expect(optionsProvider.useFactory).toBe(factory);
			}
		});

		it("должен поддерживать inject зависимости", () => {
			const MockConfigService = class {};
			const factory = jest.fn();
			const dynamicModule = AiSdkModule.forRootAsync({
				useFactory: factory,
				inject: [MockConfigService],
			});

			const optionsProvider = dynamicModule.providers?.find(
				(p) => typeof p === "object" && "provide" in p && p.provide === AI_SDK_OPTIONS
			);

			if (typeof optionsProvider === "object" && "inject" in optionsProvider) {
				expect(optionsProvider.inject).toEqual([MockConfigService]);
			}
		});

		it("должен использовать пустой массив inject если не указан", () => {
			const dynamicModule = AiSdkModule.forRootAsync({
				useFactory: () => mockConfig,
			});

			const optionsProvider = dynamicModule.providers?.find(
				(p) => typeof p === "object" && "provide" in p && p.provide === AI_SDK_OPTIONS
			);

			if (typeof optionsProvider === "object" && "inject" in optionsProvider) {
				expect(optionsProvider.inject).toEqual([]);
			}
		});

		it("должен поддерживать imports для модулей зависимостей", () => {
			const MockModule = class {};
			const dynamicModule = AiSdkModule.forRootAsync({
				useFactory: () => mockConfig,
				imports: [MockModule],
			});

			expect(dynamicModule.imports).toEqual([MockModule]);
		});

		it("должен использовать пустой массив imports если не указан", () => {
			const dynamicModule = AiSdkModule.forRootAsync({
				useFactory: () => mockConfig,
			});

			expect(dynamicModule.imports).toEqual([]);
		});

		it("должен зарегистрировать все провайдеры", () => {
			const dynamicModule = AiSdkModule.forRootAsync({
				useFactory: () => mockConfig,
			});

			expect(dynamicModule.providers).toHaveLength(2);

			const optionsProvider = dynamicModule.providers?.find(
				(p) => typeof p === "object" && "provide" in p && p.provide === AI_SDK_OPTIONS
			);
			expect(optionsProvider).toBeDefined();

			const serviceProvider = dynamicModule.providers?.find(
				(p) => typeof p === "object" && "provide" in p && p.provide === AiSdkService
			);
			expect(serviceProvider).toBeDefined();
		});

		it("должен экспортировать AiSdkService", () => {
			const dynamicModule = AiSdkModule.forRootAsync({
				useFactory: () => mockConfig,
			});

			expect(dynamicModule.exports).toContain(AiSdkService);
		});

		it("должен поддерживать асинхронную фабрику", async () => {
			const factory = jest.fn().mockResolvedValue(mockConfig);
			const dynamicModule = AiSdkModule.forRootAsync({
				useFactory: factory,
			});

			const optionsProvider = dynamicModule.providers?.find(
				(p) => typeof p === "object" && "provide" in p && p.provide === AI_SDK_OPTIONS
			);

			if (
				typeof optionsProvider === "object" &&
				"useFactory" in optionsProvider &&
				typeof optionsProvider.useFactory === "function"
			) {
				const result = await optionsProvider.useFactory();
				expect(result).toEqual(mockConfig);
			}
		});
	});
});
