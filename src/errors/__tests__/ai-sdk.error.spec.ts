import AiSdkError from "src/errors/ai-sdk.error";

describe("AiSdkError", () => {
	it("должен быть определен", () => {
		expect(AiSdkError).toBeDefined();
	});

	it("должен создавать экземпляр ошибки с сообщением", () => {
		const error = new AiSdkError("Test error message");
		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(AiSdkError);
		expect(error.message).toBe("Test error message");
		expect(error.name).toBe("AiSdkError");
	});

	it("должен сохранять оригинальную ошибку", () => {
		const originalError = new Error("Original error");
		const error = new AiSdkError("Wrapper error", originalError);
		expect(error.getOriginalMessage()).toBe("Original error");
	});

	it("должен сохранять контекст", () => {
		const context = { userId: "123", operation: "test" };
		const error = new AiSdkError("Test error", undefined, context);
		expect(error.getContext()).toBe(context);
	});

	it("должен сохранять stack trace оригинальной ошибки", () => {
		const originalError = new Error("Original error");
		const error = new AiSdkError("Wrapper error", originalError);
		expect(error.stack).toContain("Original error");
		expect(error.stack).toContain("Wrapper error");
	});

	it("должен обработать строковую ошибку", () => {
		const error = AiSdkError.fromError("String error");
		expect(error).toBeInstanceOf(AiSdkError);
		expect(error.message).toBe("String error");
		expect(error.getOriginalMessage()).toBe("String error");
	});

	it("должен обработать Error объект", () => {
		const originalError = new Error("Test error");
		const error = AiSdkError.fromError(originalError);
		expect(error).toBeInstanceOf(AiSdkError);
		expect(error.message).toBe("Test error");
		expect(error.getOriginalMessage()).toBe("Test error");
	});

	it("должен обработать unknown ошибку", () => {
		const unknownError = { someProperty: "value" };
		const error = AiSdkError.fromError(unknownError);
		expect(error).toBeInstanceOf(AiSdkError);
		expect(error.message).toBe("[object Object]");
		expect(error.getOriginalMessage()).toBe("Unknown error");
	});

	it("должен обработать null ошибку", () => {
		const error = AiSdkError.fromError(null);
		expect(error).toBeInstanceOf(AiSdkError);
		expect(error.message).toBe("null");
		expect(error.getOriginalMessage()).toBe("Unknown error");
	});

	it("должен обработать undefined ошибку", () => {
		const error = AiSdkError.fromError(undefined);
		expect(error).toBeInstanceOf(AiSdkError);
		expect(error.message).toBe("undefined");
		expect(error.getOriginalMessage()).toBe("Unknown error");
	});

	it("должен создать ошибку с контекстом через fromError", () => {
		const context = { userId: "123", source: "ai-sdk" };
		const originalError = new Error("Test error");
		const error = AiSdkError.fromError(originalError, context);
		expect(error.getContext()).toBe(context);
		expect(error.message).toBe("Test error");
	});

	it("должен вернуть тот же экземпляр если передан AiSdkError", () => {
		const originalError = new AiSdkError("Original");
		const error = AiSdkError.fromError(originalError);
		expect(error).toBe(originalError);
	});

	it("должен проверить является ли ошибка AiSdkError через isAiSdkError", () => {
		const error = new AiSdkError("Test");
		const regularError = new Error("Regular");
		expect(AiSdkError.isAiSdkError(error)).toBe(true);
		expect(AiSdkError.isAiSdkError(regularError)).toBe(false);
		expect(AiSdkError.isAiSdkError("string")).toBe(false);
		expect(AiSdkError.isAiSdkError(null)).toBe(false);
	});

	it("должен получить оригинальное сообщение из строки", () => {
		const error = new AiSdkError("Wrapper", "String error");
		expect(error.getOriginalMessage()).toBe("String error");
	});

	it("должен получить Unknown error для неизвестного типа", () => {
		const error = new AiSdkError("Wrapper", { some: "object" });
		expect(error.getOriginalMessage()).toBe("Unknown error");
	});

	it("должен правильно установить прототип", () => {
		const error = new AiSdkError("Test");
		expect(Object.getPrototypeOf(error)).toBe(AiSdkError.prototype);
	});
});
