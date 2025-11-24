import { Module, DynamicModule, Provider } from "@nestjs/common";
import AiSdkService from "src/main/ai-sdk.service";
import { AI_SDK_OPTIONS } from "src/utils/injection-keys";

import type { AiSdkConfig, AiSdkModuleAsyncOptions } from "src/types/ai-sdk.types";

// Модуль для работы с AI SDK
@Module({})
export default class AiSdkModule {
	// Регистрация модуля с динамическими опциями через useFactory
	static forRootAsync<T extends unknown[]>(options: AiSdkModuleAsyncOptions<T>): DynamicModule {
		const providers: Provider[] = [
			{
				provide: AI_SDK_OPTIONS,
				useFactory: options.useFactory,
				inject: options.inject || [],
			},
			{
				provide: AiSdkService,
				useFactory: (config: AiSdkConfig): AiSdkService => {
					return new AiSdkService(config);
				},
				inject: [AI_SDK_OPTIONS],
			},
		];

		return {
			module: AiSdkModule,
			imports: options.imports || [],
			providers,
			exports: [AiSdkService],
		};
	}
}
