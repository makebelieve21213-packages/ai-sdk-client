import { AI_SDK_OPTIONS } from "src/utils/injection-keys";

describe("injection-keys", () => {
	it("должен экспортировать AI_SDK_OPTIONS как Symbol", () => {
		expect(AI_SDK_OPTIONS).toBeDefined();
		expect(typeof AI_SDK_OPTIONS).toBe("symbol");
	});

	it("AI_SDK_OPTIONS должен быть уникальным Symbol", () => {
		const otherSymbol = Symbol("AI_SDK_OPTIONS");
		expect(AI_SDK_OPTIONS).not.toBe(otherSymbol);
		expect(AI_SDK_OPTIONS.toString()).toBe("Symbol(AI_SDK_OPTIONS)");
	});
});
