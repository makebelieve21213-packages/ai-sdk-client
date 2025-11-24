# @packages/ai-sdk-client

NestJS модуль для интеграции с AI SDK (Vercel AI SDK) для работы с OpenAI и другими провайдерами AI моделей.

## 📋 Содержание

- [Возможности](#-возможности)
- [Требования](#-требования)
- [Установка](#-установка)
- [Развертывание в Docker](#-развертывание-в-docker)
- [Структура пакета](#-структура-пакета)
- [Быстрый старт](#-быстрый-старт)
- [Использование модулей и сервисов](#-использование-модулей-и-сервисов)
- [API Reference](#-api-reference)
- [Конфигурация](#-конфигурация)
- [Примеры использования](#-примеры-использования)
- [Как работает streaming](#-как-работает-streaming)
- [Тестирование](#-тестирование)
- [Troubleshooting](#-troubleshooting)

## 🚀 Возможности

- ✅ **Интеграция с OpenAI** - поддержка GPT-4 и других моделей через Vercel AI SDK
- ✅ **Streaming ответов** - генерация ответов в реальном времени через AsyncGenerator
- ✅ **Управление контекстом** - поддержка истории разговора для контекстных ответов
- ✅ **Поддержка Tools** - автоматическое преобразование JSON Schema в Zod схемы для валидации tools
- ✅ **Context Data** - передача данных в tools через contextData
- ✅ **NestJS модуль** - готовый модуль для простой интеграции
- ✅ **Гибкая конфигурация** - поддержка переменных окружения через ConfigModule
- ✅ **TypeScript типизация** - полная типобезопасность
- ✅ **100% покрытие тестами** - надежность и качество кода

## 📋 Требования

- **Node.js**: >= 22.11.0
- **NestJS**: >= 11.0.0
- **AI SDK**: >= 4.2.0 (Vercel AI SDK)

## 📦 Установка

```bash
npm install @packages/ai-sdk-client
```

### Зависимости

Пакет требует следующие peer dependencies:

```json
{
  "@nestjs/common": "^11.0.0",
  "reflect-metadata": "^0.1.13 || ^0.2.0",
  "rxjs": "^7.0.0"
}
```

## 🐳 Развертывание в Docker

### Dockerfile

Пакет включает готовый Dockerfile для сборки образа:

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:22-alpine AS production
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate && \
    pnpm install --frozen-lockfile --prod
COPY --from=base /app/dist ./dist
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs
CMD ["node", "dist/index.js"]
```

### Сборка образа

```bash
docker build -t ai-sdk-client:latest .
```

## 📁 Структура пакета

```
src/
├── main/
│   ├── ai-sdk.module.ts        # NestJS модуль
│   ├── ai-sdk.service.ts       # Основной сервис
│   └── __tests__/              # Тесты
├── types/
│   └── ai-sdk.types.ts         # TypeScript типы
├── utils/
│   ├── json-schema-to-zod.ts   # Утилита преобразования JSON Schema в Zod схему
│   ├── injection-keys.ts       # Injection tokens для DI
│   └── __tests__/              # Тесты утилит
├── errors/
│   └── ai-sdk.error.ts         # Кастомные ошибки
└── index.ts                    # Точка входа (экспорты)
```

**Примечание:** Конфигурация должна создаваться в сервисе, который использует пакет, а не в самом пакете.

## 🏗️ Архитектура

Пакет предоставляет NestJS модуль `AiSdkModule` для работы с AI моделями через Vercel AI SDK.

**Основные компоненты:**
- `AiSdkModule` - NestJS модуль для регистрации сервиса
- `AiSdkService` - сервис для работы с AI SDK
- `AiSdkConfig` - конфигурация для настройки провайдера и модели
- `jsonSchemaToZod` - утилита для преобразования JSON Schema в Zod схемы

## 🔧 Быстрый старт

### Шаг 1: Настройка переменных окружения

Добавьте в `.env`:

```env
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-4
OPENAI_BASE_URL=https://api.openai.com/v1  # Опционально
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7
```

### Шаг 2: Создание конфигурации в сервисе

Создайте файл конфигурации в вашем сервисе (например, `services/chat-service/src/configs/ai-sdk.config.ts`):

```typescript
// ai-sdk.config.ts
import { registerAs } from "@nestjs/config";
import type { AiSdkConfig } from "@packages/ai-sdk-client";
import { EnvVariable } from "src/types/enums";

export type AiSdkConfiguration = AiSdkConfig;

const aiSdkConfig = registerAs<AiSdkConfiguration>(
  "aiSdk",
  (): AiSdkConfiguration => {
    const apiKey = process.env[EnvVariable.OPENAI_API_KEY];
    
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }
    
    return {
      baseURL: process.env[EnvVariable.OPENAI_BASE_URL] || "https://api.openai.com/v1",
      apiKey,
      model: (process.env[EnvVariable.OPENAI_MODEL] || "gpt-4") as AiSdkConfig["model"],
      maxTokens: Number(process.env[EnvVariable.OPENAI_MAX_TOKENS]) || 1000,
      temperature: Number(process.env[EnvVariable.OPENAI_TEMPERATURE]) || 0.7,
    };
  },
);

export default aiSdkConfig;
```

### Шаг 3: Регистрация модуля в AppModule

**Способ 1: Использование ConfigModule (РЕКОМЕНДУЕТСЯ)**

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiSdkModule } from '@packages/ai-sdk-client';
import aiSdkConfig from 'src/configs/ai-sdk.config';
import type { AiSdkConfiguration } from 'src/configs/ai-sdk.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [aiSdkConfig],
    }),
    AiSdkModule.forRootAsync<[AiSdkConfiguration]>({
      useFactory: (config: AiSdkConfiguration) => config,
      inject: [aiSdkConfig.KEY],
      imports: [ConfigModule],
    }),
  ],
})
export class AppModule {}
```

**Способ 2: Простая конфигурация без ConfigModule**

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { AiSdkModule } from '@packages/ai-sdk-client';

@Module({
  imports: [
    AiSdkModule.forRootAsync({
      useFactory: () => ({
        baseURL: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'gpt-4',
        maxTokens: 1000,
        temperature: 0.7,
      }),
    }),
  ],
})
export class AppModule {}
```

### Шаг 4: Использование AiSdkService

```typescript
// chat.service.ts
import { Injectable } from '@nestjs/common';
import { AiSdkService, MessageType } from '@packages/ai-sdk-client';

// Определите типы для вашего приложения
type ChatMessage = { type: MessageType; text: string; id?: string; userId?: string; createdAt?: string };
type ToolDefinition = { name: string; description: string; parameters: Record<string, unknown> };

@Injectable()
export class ChatService {
  constructor(private readonly aiSdkService: AiSdkService) {}

  async *streamMessage(
    userId: string, 
    text: string, 
    history: ChatMessage[] = [],
    tools?: ToolDefinition[],
    contextData?: Record<string, unknown>
  ) {
    // Стриминг ответа в реальном времени
    for await (const chunk of this.aiSdkService.streamMessage({
      userId,
      text,
      conversationHistory: history,
      systemPrompt: "Ты помощник по криптовалютам",
      tools,
      contextData,
    })) {
      yield chunk;
    }
  }
}
```

**Готово!** Модуль автоматически:
- Инициализируется при старте приложения
- Валидирует конфигурацию
- Предоставляет `AiSdkService` для использования в других сервисах

## 📚 Использование модулей и сервисов

### AiSdkModule

**Назначение:** NestJS модуль для регистрации AiSdkService.

**Метод инициализации:**

#### `forRootAsync(options)`

```typescript
AiSdkModule.forRootAsync<[AiSdkConfiguration]>({
  useFactory: (config: AiSdkConfiguration) => config,
  inject: [aiSdkConfig.KEY],
  imports: [ConfigModule],
})
```

**Параметры:**
- `useFactory: (deps) => AiSdkConfig | Promise<AiSdkConfig>` - фабрика для создания конфигурации
- `inject?: InjectionToken[]` - зависимости для инжекции в useFactory
- `imports?: Module[]` - дополнительные модули для DI

**Экспортирует:** `AiSdkService`

### AiSdkService

**Назначение:** Сервис для работы с AI SDK через Vercel AI SDK.

**Конструктор:**

При создании экземпляра сервиса валидирует обязательные поля конфигурации:
- `baseURL` - должен быть указан (или используется значение по умолчанию)
- `apiKey` - обязательное поле, выбрасывает ошибку при отсутствии

**Методы:**

#### `streamMessage(params)`

Отправляет сообщение и получает ответ в виде стрима (для real-time обновлений).

**Параметры:**
- `params: SendMessageParams` - параметры для отправки сообщения

**Возвращает:** `AsyncGenerator<string, void, unknown>`

**Пример:**
```typescript
for await (const chunk of this.aiSdkService.streamMessage({
  userId: 'user-123',
  text: 'Привет!',
  conversationHistory: history,
  systemPrompt: 'Ты помощник',
  tools,
  contextData,
})) {
  console.log(chunk); // Каждый chunk ответа
}
```

## 📖 API Reference

### SendMessageParams

```typescript
interface SendMessageParams<
  TChatMessage extends { type: MessageType; text: string } = { type: MessageType; text: string },
  TToolDefinition extends {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  } = {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  },
> {
  userId: string;                              // Идентификатор пользователя (обязательно)
  text: string;                                // Текст сообщения пользователя (обязательно)
  conversationHistory?: TChatMessage[];        // История разговора (опционально)
  systemPrompt?: string;                       // Системный промпт (опционально)
  tools?: TToolDefinition[];                   // Определения tools (опционально)
  contextData?: Record<string, unknown>;       // Данные для tools (опционально)
}
```

### AiSdkConfig

```typescript
interface AiSdkConfig {
  baseURL?: string;        // Базовый URL API (опционально, по умолчанию: https://api.openai.com/v1)
  apiKey: string;          // API ключ провайдера (обязательно)
  model: OpenAIModel;      // Модель для использования
  maxTokens?: number;      // Максимальное количество токенов (опционально)
  temperature?: number;    // Температура для генерации 0.0-2.0 (опционально)
}

type OpenAIModel = 
  | "gpt-4"
  | "gpt-4-turbo"
  | "gpt-4o"
  | "gpt-3.5-turbo"
  | "gpt-3.5-turbo-16k";
```

## 🔧 Конфигурация

### Переменные окружения

**Валидация `.env` переменных:**

```env
# API ключ провайдера (обязательно)
OPENAI_API_KEY=your-api-key-here

# Модель для использования (по умолчанию: gpt-4)
OPENAI_MODEL=gpt-4

# Базовый URL API (опционально, по умолчанию: https://api.openai.com/v1)
OPENAI_BASE_URL=https://api.openai.com/v1

# Максимальное количество токенов (по умолчанию: 1000)
OPENAI_MAX_TOKENS=1000

# Температура для генерации 0.0-2.0 (по умолчанию: 0.7)
OPENAI_TEMPERATURE=0.7
```

## 🧪 Примеры использования

### Пример 1: Стриминг ответа в Controller

```typescript
// NestJS Controller
@Get('chat/stream')
async streamChat(@Query('text') text: string) {
  return new Observable((observer) => {
    (async () => {
      for await (const chunk of this.aiSdkService.streamMessage({
        userId: 'user-123',
        text,
      })) {
        observer.next({ data: chunk });
      }
      observer.complete();
    })();
  });
}
```

### Пример 2: Стриминг с историей разговора

```typescript
import { MessageType } from '@packages/ai-sdk-client';

const history = [
  {
    id: 'msg-1',
    text: 'Привет!',
    type: MessageType.USER,
    userId: 'user-123',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'msg-2',
    text: 'Привет! Чем могу помочь?',
    type: MessageType.COPILOT,
    userId: 'user-123',
    createdAt: new Date().toISOString(),
  },
] as const;

for await (const chunk of this.aiSdkService.streamMessage({
  userId: 'user-123',
  text: 'Расскажи о криптовалютах',
  conversationHistory: history,
  systemPrompt: 'Ты эксперт по криптовалютам',
})) {
  console.log(chunk); // Каждый chunk ответа
}
```

### Пример 3: Использование tools с JSON Schema

```typescript
const tools = [
  {
    name: 'getCryptoPrice',
    description: 'Получить цену криптовалюты',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        amount: { type: 'number' },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['symbol'],
    },
  },
] as const;

const contextData = {
  getCryptoPrice: {
    price: 50000,
    symbol: 'BTC',
    name: 'Bitcoin',
  },
};

for await (const chunk of this.aiSdkService.streamMessage({
  userId: 'user-123',
  text: 'Получи цену BTC',
  tools,
  contextData,
})) {
  console.log(chunk);
}
```

**Примечание:** Пакет автоматически преобразует JSON Schema из `parameters` в Zod схему для валидации через утилиту `jsonSchemaToZod`. Tools выполняются на стороне Chat Service, а не в самом пакете. Пакет только возвращает данные из `contextData` при вызове tool.

### Пример 4: Tool с массивом данных

```typescript
const tools = [
  {
    name: 'getDeFiPools',
    description: 'Получить список DeFi пулов',
    parameters: {
      type: 'object',
      properties: {
        chain: { type: 'string' },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
] as const;

const contextData = {
  getDeFiPools: [
    { pool: 'pool-1', chain: 'Ethereum', apy: 5.2, tvlUsd: 1000000 },
    { pool: 'pool-2', chain: 'Base', apy: 15.8, tvlUsd: 500000 },
  ],
};

for await (const chunk of this.aiSdkService.streamMessage({
  userId: 'user-123',
  text: 'Покажи топ DeFi пулы',
  tools,
  contextData,
})) {
  console.log(chunk);
}
```

## 🧪 Как работает streaming

1. **Формирование сообщений**: Преобразует `conversationHistory` в формат AI SDK (role: "user" | "assistant")
2. **Преобразование tools**: Каждый `ToolDefinition` преобразуется в AI SDK tool:
   - `parameters` (JSON Schema) → Zod схема через `jsonSchemaToZod`
   - `execute` функция возвращает данные из `contextData[toolDef.name]`
   - Валидация наличия данных (проверка null, undefined, пустых массивов/объектов)
3. **Streaming**: Использует `streamText` из AI SDK с параметрами:
   - `maxSteps: 5` - автоматическое продолжение после tool calls
   - `maxTokens`, `temperature` из конфигурации
4. **Обработка потоков**: 
   - Сначала пытается читать `textStream` (быстрый путь)
   - Если `textStream` пустой, читает `fullStream` для отслеживания tool calls
   - Если все еще нет данных, проверяет финальный `result` с таймаутами
5. **Обработка ошибок**: Детальные сообщения об ошибках с контекстом (количество сообщений, tools, contextData keys)

**Автоматически:**
- Преобразование истории разговора в формат AI SDK
- Преобразование JSON Schema в Zod схемы
- Валидация параметров tools через Zod
- Обработка tool calls с возвратом данных из `contextData`
- Многоуровневая стратегия чтения потоков с таймаутами
- Детальная обработка ошибок с контекстом

## 🧪 Тестирование

Пакет имеет **100% покрытие тестами**.

```bash
# Запустить тесты
npm test

# Запустить тесты с покрытием
npm run test:coverage

# Watch режим
npm run test:watch
```

## 🚨 Troubleshooting

### Ошибка: API key не найден

**Проблема:** `OPENAI_API_KEY is required` или `apiKey is required`

**Решение:**
1. Проверить, что переменная окружения `OPENAI_API_KEY` установлена в `.env` файле
2. Убедиться, что ConfigModule загружает локальный конфиг из `src/configs/ai-sdk.config.ts`
3. Проверить, что `aiSdkConfig.KEY` используется в `inject` при инициализации модуля
4. Убедиться, что в конфигурации `apiKey` передается в объект `AiSdkConfig` (обязательное поле)
5. Проверить, что конфигурация валидирует наличие `apiKey` и выбрасывает ошибку при его отсутствии

### Ошибка: Timeout запроса

**Проблема:** Запрос к AI API превышает таймаут

**Решение:**
1. Увеличить `maxTokens` в конфигурации (но это может увеличить время ответа)
2. Проверить скорость интернет-соединения
3. Уменьшить `maxTokens` для более быстрых ответов
4. Проверить, что `baseURL` указывает на доступный endpoint

### Ошибка: Invalid model

**Проблема:** Указанная модель недоступна

**Решение:**
1. Проверить, что модель поддерживается провайдером
2. Для OpenAI: убедиться, что модель доступна в вашем аккаунте
3. Проверить правильность написания названия модели

### Ошибка: Tool не возвращает данные

**Проблема:** AI SDK вызывает tool, но получает ошибку "No data available for this tool"

**Решение:**
1. Убедиться, что `contextData` содержит ключ с именем tool (например, `contextData.getCryptoPrice`)
2. Проверить, что данные не пустые (не null, не undefined, не пустой массив/объект)
3. Убедиться, что tool определен в массиве `tools` с правильным `name`
4. Проверить, что `contextData` передается в `streamMessage`

### Ошибка: Stream completed without generating chunks

**Проблема:** AI SDK завершил стрим без генерации текста

**Решение:**
1. Проверить, что `conversationHistory` корректно сформирована
2. Убедиться, что `text` не пустой
3. Проверить логи для детальной информации об ошибке (количество сообщений, tools, contextData keys)
4. Убедиться, что `systemPrompt` не конфликтует с поведением AI
5. Проверить, что `maxSteps` достаточно для обработки всех tool calls (по умолчанию: 5)

## 🔌 Интеграция с другими пакетами

### @nestjs/config

Интеграция с ConfigModule для загрузки конфигурации из переменных окружения.

### Типы сообщений и tools

Пакет использует дженерики для типов `ChatMessage` и `ToolDefinition` в `SendMessageParams`:
- `ChatMessage` - должен иметь структуру: `{ type: MessageType; text: string }`
- `MessageType` - enum типов сообщений (USER, COPILOT), экспортируется из пакета
- `ToolDefinition` - должен иметь структуру: `{ name: string; description: string; parameters: Record<string, unknown> }`

## 📦 Зависимости

- `@nestjs/common` - NestJS core
- `@nestjs/config` - NestJS config
- `ai` - Vercel AI SDK (v4.2.0+)
- `@ai-sdk/openai` - OpenAI provider для AI SDK
- `zod` - Schema validation
- `reflect-metadata` - TypeScript decorators
- `rxjs` - Reactive extensions

## 📄 Лицензия

MIT

## 👥 Автор

Skryabin Aleksey
