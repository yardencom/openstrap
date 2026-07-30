# Architecture Boundaries

Этот документ описывает архитектурные границы проекта: какие слои существуют, зачем они нужны, через что они общаются и где проходит линия между domain, schema, application, ports и adapters.

Это не список импортов. Импорты являются следствием границ, а не самой архитектурой.

## Architecture Shape

Проект строится как набор product modules вокруг общего config platform.

```text
Consumer
  -> Product Module Facade
      -> Product Application
      -> Product Schema
      -> Product Domain
      -> ConfigCore
          -> ConfigCore Application
          -> ConfigCore Domain
          -> ConfigCore Ports
          -> ConfigCore Adapters
```

Текущий реализованный product module - `Facts`.

`Plugin` является отдельным runtime extension module: providers, transports, secret stores. CLI использует его как composition/runtime layer, но `Plugin` не является публичным API модуля `Facts`, не умеет читать машину и не владеет facts schema, requirements schema или blueprint schema. Единственный вход в факты - `new Facts(...)` (ADR 0007).

Будущие product modules, например `WorkflowConfig` и `StorageConfig`, должны повторять эту форму: свой domain, своя schema, свой facade, общий `ConfigCore`.

## ConfigCore As Platform

`ConfigCore` является config platform, а не strict ports-only core.

Это значит:

- `ConfigCore` может предоставлять default infrastructure внутри своего public API;
- `ConfigCore/Application` может собирать default parser/validator/emitter, если это не протекает в product modules;
- Zod является backend engine внутри `ConfigCore`, а не API для product modules;
- custom validator или JSON Schema emitter не должны дублировать возможности Zod без отдельной причины;
- product modules описывают schemas через `ConfigCore` contract, а не через прямой import Zod;
- concrete libraries, кроме явно принятой platform dependency, остаются деталями `ConfigCore` или его adapters;
- product modules используют `ConfigCore` как capability и не импортируют deps/libraries напрямую.

Например, default YAML parser внутри `ConfigLoader` допустим, если `Facts` не знает про YAML library и не импортирует `ConfigCore/Adapters`.

## Boundary Types

| Граница | Владеет | Общается через | Не владеет |
|----------|------|----------------------|--------------|
| **Public Facade** | Внешний API модуля и перевод ошибок наружу | Методы класса, публичный domain result или DTO | Внутренние schema classes, adapters, широкие helper APIs |
| **Product Domain** | Предметные entities, value objects, errors и инварианты модуля | Domain types | YAML, Zod, JSON Schema, IO, runtime execution |
| **Product Schema** | Правила записи domain concepts в config file | ConfigCore schema contract | Workflow execution, collection, transport, storage |
| **Product Application** | Use cases модуля и orchestration | Facade methods, application services | Чистые schema declarations без use case |
| **ConfigCore Domain** | Generic config DTO, schema nodes, metadata, issues, errors | ConfigCore DTO | Facts/workflow/storage concepts |
| **ConfigCore Application** | Generic config use cases: load, validate, emit schema | Ports and ConfigCore DTO | Product-specific rules |
| **ConfigCore Ports** | Capabilities, которые core требует от технологий | Interfaces | Concrete libraries |
| **ConfigCore Adapters** | Реализации ports через конкретные библиотеки | Port implementations | Product domain |

## Layer Communication

### Consumer To Product Module

Внешний код общается с product module через public facade.

```ts
const facts = new Facts(collectedFactItems);
const jsonSchema = new FactsDefinitionJsonSchema().emit();
```

Facade скрывает implementation details своего bounded context. Если внешний код вынужден импортировать `Facts/Reading` или `Facts/Domain`, значит public boundary не закрывает нужный use case или consumer лезет внутрь модуля.

### Product Module To ConfigCore

Product module использует `ConfigCore` как platform capability:

- описать config schema;
- загрузить config;
- проверить config;
- получить JSON Schema artifact.

Product module не импортирует external deps/libraries напрямую, если они являются инфраструктурной реализацией. YAML parser, JSON Schema engine и Zod являются backend-деталями `ConfigCore`.

### Product Schema To Product Domain

Schema layer использует domain names and values, чтобы описать допустимую запись config.

```ts
configSchema.enum(FactImportance)
```

Это направление нормально: schema знает, какие domain values допустимы в config.

Обратное направление запрещено архитектурно: domain не должен знать, как его записывают в YAML, JSON Schema или DSL.

### ConfigCore To Adapters

`ConfigCore` общается с технологиями через ports.

```text
ConfigDocumentParser -> YamlConfigDocumentParser
ConfigValidator -> ZodConfigValidator
JsonSchemaEmitter -> ZodJsonSchemaEmitter
```

Port описывает capability. Adapter реализует capability конкретной технологией.

## Domain Modeling Boundary

Domain model не является схемой файла.

| Форма | Когда использовать | Пример |
|-------|-------------|---------|
| **Entity** | Есть domain identity, по которой система отличает один объект от другого в рамках lifecycle | `FactsDefinition`, fact с `id` |
| **Value Object** | Важен сам value, нет identity и lifecycle | `FactImportance`, `FactPlatform` |
| **DTO** | Данные пересекают границу слоя, порта или внешнего формата | `ConfigIssueDto` |
| **Schema Class** | Класс строит schema nodes для ConfigCore DSL | `FactsDefinitionSchema` |
| **Facade** | Класс выражает публичный use case модуля | `Facts` |

### Identity Is Not Just An `id` Field

Поле `id` само по себе не делает объект entity. `id` может быть просто частью payload, ссылкой, ключом в config file или значением для корреляции.

Объект становится **Entity**, когда выполняется хотя бы большая часть этих условий:

- система должна отличать этот объект от других объектов того же типа по stable identity;
- объект можно найти, сравнить, обновить или сослаться на него через identity;
- identity участвует в domain invariant, например uniqueness внутри `Facts Definition`;
- у объекта есть смысл "тот же самый объект, но с изменившимися полями";
- consumer или другой слой работает с ним как с самостоятельной domain thing, а не просто как с payload.

DTO может содержать `id`, но остаться DTO, если `id` нужен только для передачи данных через boundary.

Пример:

```ts
type ConfigIssueDto = {
  path: string[];
  message: string;
  code: string;
};
```

Если в такой DTO добавить `schemaId`, он не станет entity. `schemaId` помогает понять, к какой schema относится ошибка, но сама ошибка не получает lifecycle и domain identity.

Value object тоже может быть связан с `id`, но не быть entity.

Пример:

```ts
type FactId = string;
```

`FactId` - значение identity, но не entity. Entity - это fact, который этим `FactId` идентифицируется внутри `Facts Definition`.

Короткая проверка:

| Вопрос | Если да | Если нет |
|--------|---------|----------|
| Объект нужно различать как "тот же самый" после изменения полей? | Entity | DTO или Value Object |
| Объект существует только как форма передачи через boundary? | DTO | Entity или Value Object |
| Равенство полностью определяется значением? | Value Object | Entity или DTO |
| `id` нужен только для ссылки, ошибки, schema или внешнего payload? | DTO/value inside DTO | Не Entity автоматически |

## Config Schema Boundary

Config schema отвечает только на вопрос: "какой config валиден?"

Schema layer может содержать:

- поля config;
- типы полей;
- enum values из domain;
- required/default/optional rules;
- uniqueness rules;
- generic ConfigCore DSL rules.

Schema layer не должен содержать:

- запуск команд;
- чтение файлов как runtime operation;
- SSH/container/local transport;
- workflow orchestration;
- persistence;
- Zod-specific code.

Если правило может пригодиться `WorkflowConfig`, `StorageConfig` или другому product module, оно должно стать возможностью `ConfigCore`, а не частной логикой `Facts`.

## Product Module Boundary

Product module отвечает за один bounded context.

Продуктовые модули лежат в `src/Modules`: `Blueprint`, `Requirements`, `Facts`.

`Facts` - один product module. Внутри него есть разные области, но это не отдельные top-level bounded contexts.

| Область внутри `src/Modules/Facts` | Ответственность |
|--------|-----------------|
| `Domain` | normalized observed facts, `FactCollection`, `FactRun`, target/order contracts |
| `Reading` | чтение машины: `LocalReading` через API машины, `RemoteReading` через доставку агента |
| `Reading/Local` | секции снимка: system, entities, accounts, paths, commands |
| `Reading/Remote` | определение платформы цели и доставка агента |
| `Reading/Agent` | точка входа агента и его сборка |

`Facts` не отвечает за:

- CLI rendering;
- формат конфигурации - его не существует, что читать говорит вызывающий;
- построение заказа из требований - это `Requirements`.

## Public API Boundary

Public API должен быть маленьким и намеренным.

Для `Facts` текущая public boundary:

```ts
new Facts(items: readonly FactCollectionItem[])
```

`Facts` instance is the collected facts result. Collection use cases stay internal to the module or to CLI orchestration.

Новый public method появляется только если есть внешний use case, который нельзя выразить существующим facade API.

## Adapter Boundary

Adapter - место, где разрешены concrete libraries и прямые imports external deps.

Примеры concrete details:

- Zod;
- YAML parser;
- filesystem;
- network client;
- JSON Schema emitter implementation.

Product module не импортирует deps/libraries напрямую для parsing, validation, emitting, IO, network или transport. Он работает через `ConfigCore`, ports, adapters или отдельный runtime/storage layer.

Product domain and schema do not import adapters. Если concrete library появилась в product module, граница нарушена.

## Future System Boundaries

Эти слои еще могут быть не реализованы полностью, но границы уже нужно держать в языке и дизайне.

| Слой | Ответственность | Вход | Выход |
|-------|----------------|-------|--------|
| **Runtime** | Описывает среду выполнения | process, environment, target | execution context |
| **Collector** | Собирает normalized facts на target | fact collection request, runtime context | `FactCollection` |
| **Workflow** | Оркестрирует шаги продукта | configs, triggers | результат workflow run |
| **Storage** | Хранит configs, results, artifacts | records, artifacts | сохраненное состояние |
| **Reporting** | Превращает результаты во внешний вид | stored или collected data | report/export |
| **Plugin** | Отдельный extension mechanism, не обычный facts collection path | plugin objects | runtime registry |

Заказ для чтения готовит `RequiredFacts` в `Requirements` - из требований, форму которых знают требования. Отдельный top-level module не должен появляться только ради того, чтобы вызвать два других по очереди: `OpenStrapRun` был именно таким и удалён.

## Transport Boundary

**Transport** - канал доступа к target и операции через него: прочитать файл, выполнить команду, сходить по сети. Порты живут в контракте плагинов (`contract/ports/`), реализации - в плагинах: `@openstrap/ssh` реализует их поверх ssh. Своей реализации у openstrap нет: канал нужен, чтобы дотянуться до машины, на которой openstrap не запущен, а на своей машине он читает напрямую (ADR 0007, ADR 0008).

| Внутри порта | Снаружи порта |
|---|---|
| файловые операции на target | печать прогресса в терминал |
| выполнение команды на target | окружение процесса openstrap: `stateHome`, `PATH`, `home` |
| сетевой вызов с target | производные данные: определение ОС, дистрибутива, архитектуры |

Определение ОС - работа **Collector**, а не transport: иначе знание про ОС уезжает в adapter и facts-модуль перестает собирать. Единица изменчивости в сборе фактов - операционная система target, а не канал доступа. Host не исключение: это локальный transport, реализованный системными вызовами.

`Transport` не знает про blueprint, target, provider и openstrap. Модуль обязан оставаться публикуемым отдельным пакетом без правок.

## Boundary Verification

Архитектурные границы должны проверяться тестами там, где нарушение легко внести случайно.

Минимальные проверки:

- product barrel экспортирует только public facade;
- product module не импортирует `ConfigCore/Adapters`;
- product module не импортирует deps/libraries напрямую;
- domain не импортирует schema/application/adapters;
- tests лежат внутри module, который они проверяют.

Такие проверки не заменяют архитектуру. Они только защищают уже принятую границу.
