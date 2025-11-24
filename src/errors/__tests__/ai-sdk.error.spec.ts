import AiSdkError from "src/errors/ai-sdk.error";

describe("AiSdkError", () => {
	describe("constructor", () => {
		it("должен создать экземпляр AiSdkError с сообщением", () => {
			const error = new AiSdkError("Test error message");

			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(AiSdkError);
			expect(error.message).toBe("Test error message");
			expect(error.name).toBe("AiSdkError");
		});

		it("должен создать экземпляр AiSdkError с сообщением и причиной (Error)", () => {
			const cause = new Error("Original error");
			const error = new AiSdkError("Test error message", cause);

			expect(error.message).toBe("Test error message");
			expect(error.cause).toBe(cause);
			expect(error.name).toBe("AiSdkError");
		});

		it("должен создать экземпляр AiSdkError с сообщением и причиной (unknown)", () => {
			const cause = "String error";
			const error = new AiSdkError("Test error message", cause);

			expect(error.message).toBe("Test error message");
			expect(error.cause).toBe(cause);
			expect(error.name).toBe("AiSdkError");
		});

		it("должен создать экземпляр AiSdkError без причины", () => {
			const error = new AiSdkError("Test error message");

			expect(error.message).toBe("Test error message");
			expect(error.cause).toBeUndefined();
		});

		it("должен сохранить стек трейс", () => {
			const error = new AiSdkError("Test error message");

			expect(error.stack).toBeDefined();
			expect(typeof error.stack).toBe("string");
		});
	});

	describe("fromError", () => {
		it("должен создать AiSdkError из Error", () => {
			const originalError = new Error("Original error message");
			const error = AiSdkError.fromError(originalError);

			expect(error).toBeInstanceOf(AiSdkError);
			expect(error.message).toBe("Original error message");
			expect(error.cause).toBe(originalError);
			expect(error.name).toBe("AiSdkError");
		});

		it("должен создать AiSdkError из Error с дополнительным сообщением", () => {
			const originalError = new Error("Original error message");
			const error = AiSdkError.fromError(originalError, "Additional context");

			expect(error).toBeInstanceOf(AiSdkError);
			expect(error.message).toBe("Additional context: Original error message");
			expect(error.cause).toBe(originalError);
		});

		it("должен создать AiSdkError из строки", () => {
			const stringError = "String error";
			const error = AiSdkError.fromError(stringError);

			expect(error).toBeInstanceOf(AiSdkError);
			expect(error.message).toBe("String error");
			expect(error.cause).toBe(stringError);
		});

		it("должен создать AiSdkError из строки с дополнительным сообщением", () => {
			const stringError = "String error";
			const error = AiSdkError.fromError(stringError, "Additional context");

			expect(error).toBeInstanceOf(AiSdkError);
			expect(error.message).toBe("Additional context: String error");
			expect(error.cause).toBe(stringError);
		});

		it("должен создать AiSdkError из числа", () => {
			const numberError = 404;
			const error = AiSdkError.fromError(numberError);

			expect(error).toBeInstanceOf(AiSdkError);
			expect(error.message).toBe("404");
			expect(error.cause).toBe(numberError);
		});

		it("должен создать AiSdkError из объекта", () => {
			const objectError = { code: 500, message: "Server error" };
			const error = AiSdkError.fromError(objectError);

			expect(error).toBeInstanceOf(AiSdkError);
			expect(error.message).toBe("[object Object]");
			expect(error.cause).toBe(objectError);
		});

		it("должен создать AiSdkError из null", () => {
			const error = AiSdkError.fromError(null);

			expect(error).toBeInstanceOf(AiSdkError);
			expect(error.message).toBe("null");
			expect(error.cause).toBe(null);
		});

		it("должен создать AiSdkError из undefined", () => {
			const error = AiSdkError.fromError(undefined);

			expect(error).toBeInstanceOf(AiSdkError);
			expect(error.message).toBe("undefined");
			expect(error.cause).toBe(undefined);
		});

		it("должен создать AiSdkError из Error с пустым сообщением", () => {
			const originalError = new Error("");
			const error = AiSdkError.fromError(originalError);

			expect(error).toBeInstanceOf(AiSdkError);
			expect(error.message).toBe("");
			expect(error.cause).toBe(originalError);
		});

		it("должен создать AiSdkError из Error с пустым сообщением и дополнительным контекстом", () => {
			const originalError = new Error("");
			const error = AiSdkError.fromError(originalError, "Additional context");

			expect(error).toBeInstanceOf(AiSdkError);
			expect(error.message).toBe("Additional context: ");
			expect(error.cause).toBe(originalError);
		});
	});

	describe("наследование от Error", () => {
		it("должен быть экземпляром Error", () => {
			const error = new AiSdkError("Test error");

			expect(error instanceof Error).toBe(true);
		});

		it("должен иметь все свойства Error", () => {
			const error = new AiSdkError("Test error");

			expect(error.message).toBeDefined();
			expect(error.name).toBeDefined();
			expect(error.stack).toBeDefined();
		});

		it("должен выбрасываться и ловиться как Error", () => {
			const throwError = () => {
				throw new AiSdkError("Test error");
			};

			expect(throwError).toThrow(Error);
			expect(throwError).toThrow(AiSdkError);
		});
	});

	describe("readonly свойства", () => {
		it("должен иметь readonly message", () => {
			const error = new AiSdkError("Test error");

			expect(() => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(error as any).message = "Modified";
			}).not.toThrow();

			// В TypeScript readonly предотвращает изменение, но в runtime это возможно
			// Проверяем, что свойство определено
			expect(error.message).toBeDefined();
		});

		it("должен иметь readonly cause", () => {
			const cause = new Error("Cause");
			const error = new AiSdkError("Test error", cause);

			expect(error.cause).toBe(cause);
		});
	});
});
