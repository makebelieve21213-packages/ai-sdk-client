import jsonSchemaToZod from "src/utils/json-schema-to-zod";

describe("jsonSchemaToZod", () => {
	describe("валидация входных данных", () => {
		it("должен вернуть passthrough схему для undefined", () => {
			const schema = jsonSchemaToZod(undefined);
			expect(schema).toBeDefined();

			const result = schema.safeParse({ anyField: "value" });
			expect(result.success).toBe(true);
		});

		it("должен вернуть passthrough схему для null", () => {
			const schema = jsonSchemaToZod(null as unknown as Record<string, unknown>);
			expect(schema).toBeDefined();

			const result = schema.safeParse({ anyField: "value" });
			expect(result.success).toBe(true);
		});

		it("должен вернуть passthrough схему для не объекта", () => {
			const schema = jsonSchemaToZod("not an object" as unknown as Record<string, unknown>);
			expect(schema).toBeDefined();

			const result = schema.safeParse({ anyField: "value" });
			expect(result.success).toBe(true);
		});

		it("должен вернуть passthrough схему для схемы без type object", () => {
			const schema = jsonSchemaToZod({
				type: "string",
			});
			expect(schema).toBeDefined();

			const result = schema.safeParse({ anyField: "value" });
			expect(result.success).toBe(true);
		});
	});

	describe("преобразование типов", () => {
		it("должен преобразовать string тип", () => {
			const jsonSchema = {
				type: "object",
				properties: {
					name: { type: "string" },
				},
				required: ["name"],
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);
			const result = zodSchema.safeParse({ name: "test" });

			expect(result.success).toBe(true);
			if (result.success) {
				const data = result.data as { name: string };
				expect(data.name).toBe("test");
			}

			const invalidResult = zodSchema.safeParse({ name: 123 });
			expect(invalidResult.success).toBe(false);
		});

		it("должен преобразовать number тип", () => {
			const jsonSchema = {
				type: "object",
				properties: {
					age: { type: "number" },
				},
				required: ["age"],
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);
			const result = zodSchema.safeParse({ age: 25 });

			expect(result.success).toBe(true);
			if (result.success) {
				const data = result.data as { age: number };
				expect(data.age).toBe(25);
			}

			const invalidResult = zodSchema.safeParse({ age: "not a number" });
			expect(invalidResult.success).toBe(false);
		});

		it("должен преобразовать boolean тип", () => {
			const jsonSchema = {
				type: "object",
				properties: {
					isActive: { type: "boolean" },
				},
				required: ["isActive"],
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);
			const result = zodSchema.safeParse({ isActive: true });

			expect(result.success).toBe(true);
			if (result.success) {
				const data = result.data as { isActive: boolean };
				expect(data.isActive).toBe(true);
			}

			const invalidResult = zodSchema.safeParse({ isActive: "not a boolean" });
			expect(invalidResult.success).toBe(false);
		});

		it("должен преобразовать array тип с string items", () => {
			const jsonSchema = {
				type: "object",
				properties: {
					tags: {
						type: "array",
						items: { type: "string" },
					},
				},
				required: ["tags"],
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);
			const result = zodSchema.safeParse({ tags: ["tag1", "tag2"] });

			expect(result.success).toBe(true);
			if (result.success) {
				const data = result.data as { tags: string[] };
				expect(data.tags).toEqual(["tag1", "tag2"]);
			}

			const invalidResult = zodSchema.safeParse({ tags: [1, 2] });
			expect(invalidResult.success).toBe(false);
		});

		it("должен преобразовать array тип с number items", () => {
			const jsonSchema = {
				type: "object",
				properties: {
					numbers: {
						type: "array",
						items: { type: "number" },
					},
				},
				required: ["numbers"],
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);
			const result = zodSchema.safeParse({ numbers: [1, 2, 3] });

			expect(result.success).toBe(true);
			if (result.success) {
				const data = result.data as { numbers: number[] };
				expect(data.numbers).toEqual([1, 2, 3]);
			}

			const invalidResult = zodSchema.safeParse({ numbers: ["not", "numbers"] });
			expect(invalidResult.success).toBe(false);
		});

		it("должен преобразовать array тип с unknown items если тип items не указан", () => {
			const jsonSchema = {
				type: "object",
				properties: {
					items: {
						type: "array",
						items: { type: "object" },
					},
				},
				required: ["items"],
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);
			const result = zodSchema.safeParse({ items: [1, "string", true, { key: "value" }] });

			expect(result.success).toBe(true);
			if (result.success) {
				const data = result.data as { items: unknown[] };
				expect(data.items).toEqual([1, "string", true, { key: "value" }]);
			}
		});

		it("должен преобразовать unknown тип для неизвестных типов", () => {
			const jsonSchema = {
				type: "object",
				properties: {
					unknownField: { type: "unknown" as unknown as "string" },
				},
				required: ["unknownField"],
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);
			const result = zodSchema.safeParse({ unknownField: "any value" });

			expect(result.success).toBe(true);
		});
	});

	describe("опциональные поля", () => {
		it("должен сделать поле опциональным если оно не в required", () => {
			const jsonSchema = {
				type: "object",
				properties: {
					requiredField: { type: "string" },
					optionalField: { type: "string" },
				},
				required: ["requiredField"],
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);

			const resultWithOptional = zodSchema.safeParse({ requiredField: "test" });
			expect(resultWithOptional.success).toBe(true);

			const resultWithoutOptional = zodSchema.safeParse({
				requiredField: "test",
				optionalField: "optional",
			});
			expect(resultWithoutOptional.success).toBe(true);
		});

		it("должен требовать поле если оно в required", () => {
			const jsonSchema = {
				type: "object",
				properties: {
					requiredField: { type: "string" },
				},
				required: ["requiredField"],
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);

			const resultWithField = zodSchema.safeParse({ requiredField: "test" });
			expect(resultWithField.success).toBe(true);

			const resultWithoutField = zodSchema.safeParse({});
			expect(resultWithoutField.success).toBe(false);
		});
	});

	describe("комплексные схемы", () => {
		it("должен обработать схему с несколькими полями разных типов", () => {
			const jsonSchema = {
				type: "object",
				properties: {
					name: { type: "string" },
					age: { type: "number" },
					isActive: { type: "boolean" },
					tags: {
						type: "array",
						items: { type: "string" },
					},
					optionalField: { type: "string" },
				},
				required: ["name", "age", "isActive", "tags"],
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);
			const result = zodSchema.safeParse({
				name: "John",
				age: 30,
				isActive: true,
				tags: ["tag1", "tag2"],
			});

			expect(result.success).toBe(true);
			if (result.success) {
				const data = result.data as {
					name: string;
					age: number;
					isActive: boolean;
					tags: string[];
				};
				expect(data.name).toBe("John");
				expect(data.age).toBe(30);
				expect(data.isActive).toBe(true);
				expect(data.tags).toEqual(["tag1", "tag2"]);
			}
		});

		it("должен поддерживать passthrough для дополнительных полей", () => {
			const jsonSchema = {
				type: "object",
				properties: {
					name: { type: "string" },
				},
				required: ["name"],
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);
			const result = zodSchema.safeParse({
				name: "John",
				extraField: "extra value",
			});

			expect(result.success).toBe(true);
			if (result.success) {
				const data = result.data as Record<string, unknown>;
				expect(data.name).toBe("John");
				expect(data.extraField).toBe("extra value");
			}
		});
	});

	describe("граничные случаи", () => {
		it("должен обработать пустой объект", () => {
			const jsonSchema = {
				type: "object",
				properties: {},
				required: [],
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);
			const result = zodSchema.safeParse({});

			expect(result.success).toBe(true);
		});

		it("должен обработать массив без items", () => {
			const jsonSchema = {
				type: "object",
				properties: {
					items: {
						type: "array",
					},
				},
				required: ["items"],
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);
			const result = zodSchema.safeParse({ items: [1, 2, 3] });

			expect(result.success).toBe(true);
		});

		it("должен обработать required как undefined", () => {
			const jsonSchema = {
				type: "object",
				properties: {
					field: { type: "string" },
				},
			};

			const zodSchema = jsonSchemaToZod(jsonSchema);
			const result = zodSchema.safeParse({});

			expect(result.success).toBe(true);
		});
	});
});
