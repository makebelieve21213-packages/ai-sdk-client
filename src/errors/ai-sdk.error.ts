/**
 * Пользовательская ошибка для AI SDK сервиса
 * Наследуется от стандартного Error и позволяет сохранять исходную причину ошибки
 */
export default class AiSdkError extends Error {
	constructor(
		readonly message: string,
		readonly cause?: Error | unknown
	) {
		super(message);
		this.name = "AiSdkError";

		// Сохраняем правильный стек трейс
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, AiSdkError);
		}
	}

	// Создает экземпляр AiSdkError из произвольной ошибки
	static fromError(error: Error | unknown, additionalMessage?: string): AiSdkError {
		let message: string = additionalMessage
			? `${additionalMessage}: ${String(error)}`
			: String(error);

		if (error instanceof Error) {
			message = additionalMessage ? `${additionalMessage}: ${error.message}` : error.message;
		}

		return new AiSdkError(message, error);
	}
}
