import { z } from "zod";

// Преобразование JSON Schema в Zod схему
export default function jsonSchemaToZod(
	schema: Record<string, unknown> | undefined
): z.ZodType<unknown> {
	if (!schema || typeof schema !== "object") {
		// Если схемы нет, возвращаем схему, принимающую любые параметры
		return z.object({}).passthrough();
	}

	if (schema.type === "object" && schema.properties) {
		const properties = schema.properties as Record<string, Record<string, unknown>>;
		const required = (schema.required as string[] | undefined) || [];

		const zodShape: Record<string, z.ZodType<unknown>> = {};

		for (const [key, propSchema] of Object.entries(properties)) {
			let zodType: z.ZodType<unknown>;

			switch (propSchema.type) {
				case "string":
					zodType = z.string();
					break;
				case "number":
					zodType = z.number();
					break;
				case "boolean":
					zodType = z.boolean();
					break;
				case "array": {
					const itemsSchema = propSchema.items as Record<string, unknown> | undefined;
					switch (itemsSchema?.type) {
						case "string":
							zodType = z.array(z.string());
							break;
						case "number":
							zodType = z.array(z.number());
							break;
						default:
							zodType = z.array(z.unknown());
							break;
					}
					break;
				}
				default:
					zodType = z.unknown();
					break;
			}

			// Если поле не в required, делаем его опциональным
			if (!required.includes(key)) {
				zodType = zodType.optional();
			}

			zodShape[key] = zodType;
		}

		return z.object(zodShape).passthrough();
	}

	// Fallback: возвращаем схему, принимающую любые параметры
	return z.object({}).passthrough();
}
