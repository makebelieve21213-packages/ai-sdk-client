// Пользовательская ошибка для AI SDK модуля
export default class AiSdkError extends Error {
	constructor(
		readonly message: string,
		protected readonly originalError?: Error | unknown,
		protected readonly context?: Record<string, unknown>
	) {
		super(message);
		this.name = "AiSdkError";

		// Сохраняем stack trace от оригинальной ошибки, если она есть
		if (originalError instanceof Error && originalError.stack) {
			this.stack = `${this.stack}\nOriginal error: ${originalError.stack}`;
		}

		// Исправляем прототип для корректной работы instanceof
		Object.setPrototypeOf(this, AiSdkError.prototype);
	}

	// Получает сообщение об ошибке из оригинальной ошибки
	getOriginalMessage(): string {
		if (this.originalError instanceof Error) {
			return this.originalError.message;
		}
		if (typeof this.originalError === "string") {
			return this.originalError;
		}
		return "Unknown error";
	}

	// Получает контекст ошибки
	getContext(): Record<string, unknown> | undefined {
		return this.context;
	}

	// Проверяет, является ли ошибка экземпляром AiSdkError
	static isAiSdkError(error: unknown): error is AiSdkError {
		return error instanceof AiSdkError;
	}

	// Создает AiSdkError из любой ошибки
	static fromError(error: Error | unknown, context?: Record<string, unknown>): AiSdkError {
		if (error instanceof AiSdkError) {
			return error;
		}

		const message = error instanceof Error ? error.message : String(error);

		return new AiSdkError(message, error, context);
	}
}
