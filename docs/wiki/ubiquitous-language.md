# Ubiquitous Language

Этот документ фиксирует общий язык проекта. Его задача - дать единые определения терминам, которые используются в коде, тестах, документации и архитектурных обсуждениях.

## Configuration Core

| Термин | Описание | Пример |
|------|------------|---------|
| **Config** | Одна пользовательская декларация для продукта; она может быть записана в YAML/JSON, разобрана программой и проверена схемой, но термин остается один - config. | `id`, `version`, `commands` в facts YAML |
| **Config File** | Файл, в котором записан config; формат файла является свойством файла. | `examples/facts/cross-platform.yaml` |
| **Config File Pattern** | Правило, по которому config module узнает подходящие config files. | `examples/facts/**/*.{yaml,yml}` |
| **Config Schema** | Декларативное описание структуры config, правил валидации, file patterns и внешней схемы для редакторов. | `FactsDefinitionSchema.build()` |

## ConfigCore Technical Terms

| Термин | Описание | Пример |
|------|------------|---------|
| **Schema Node** | Узел внутреннего DSL схемы: строка, число, объект, массив, enum, union и так далее. | `configSchema.string({ minLength: 1 })` |
| **Schema Definition** | Технический DTO, который соединяет метаданные, file patterns и корневой schema node для ConfigCore. | `ConfigSchemaDefinitionDto` |
| **Schema Metadata** | Технические сведения о конкретной схеме: имя, описание, версия и другие аннотации. | `{ name: "Facts Definition" }` |
| **Config Validation** | Проверка config по config schema. | `FactsDefinitionReader.parseYaml(yaml)` |
| **Config Issue** | Структурированная ошибка парсинга или валидации с путем и сообщением. | `{ path: ["commands", 0, "id"] }` |
| **JSON Schema** | Внешний формат схемы, который можно отдать редакторам и инструментам. | `schemas/facts-definition.schema.json` |
| **Config Loader** | Сервис ConfigCore, который проводит config через чтение, парсинг и валидацию. | `loader.load({ format: "yaml", content })` |
| **Config Parser** | Порт, который превращает содержимое config file в объект для дальнейшей проверки. | `YamlConfigDocumentParser` |
| **Config Validator** | Порт, который проверяет config по schema definition. | `ConfigSchemaValidator` |
| **JSON Schema Emitter** | Порт, который превращает schema definition во внешний JSON Schema. | `ConfigSchemaJsonSchemaEmitter` |
| **ConfigCore Adapter** | Конкретная реализация порта ConfigCore, например на базе Zod или YAML parser. | `ZodConfigValidator` |
| **ConfigCore Port** | Интерфейс ConfigCore, за которым прячется конкретная реализация. | `ConfigValidator` |

## Config Modules

| Термин | Описание | Пример |
|------|------------|---------|
| **Config Module** | Область продуктового модуля, которая описывает и обслуживает один вид конфигурации через ConfigCore. | `src/Facts/Definition` |
| **ConfigCore** | Общий слой для парсинга, описания схем, валидации, ошибок и генерации внешних схем. | `src/ConfigCore` |
| **Facts Definition Area** | Внутренняя область `Facts`, которая обслуживает конфигурацию facts definition. | `src/Facts/Definition` |
| **Facts** | Product module для facts language: definitions, normalized facts, collection, facts-specific artifacts/use cases. | `src/Facts` |
| **WorkflowConfig** | Будущий config module для конфигурации workflow. | `src/WorkflowConfig` |
| **StorageConfig** | Будущий config module для конфигурации storage. | `src/StorageConfig` |
| **Public Facade** | Основной публичный класс модуля, который представляет уже собранные facts. | `new Facts(items)` |
| **Module Barrel** | `index.ts`, который экспортирует только намеренные публичные entrypoints модуля. | `export { Facts } ...` |
| **Boundary Test** | Тест, который проверяет архитектурные границы: импорты, публичный API, расположение файлов. | `facts-boundaries.test.ts` |

## Facts Domain

| Термин | Описание | Пример |
|------|------------|---------|
| **Facts Definition** | Корневой config, который описывает набор facts, доступных для сбора. | `examples/facts/minimal.yaml` |
| **Fact** | Один именованный элемент facts definition, который описывает, какую информацию нужно собрать или проверить. | `id: git` |
| **Fact Section** | Группа facts одного типа в facts definition, например `commands`, `env` или `files`. | `commands:` |
| **Fact Settings** | Общие настройки конкретного fact внутри любой section. | `importance: optional` |
| **Fact Input** | Описание внешнего входного значения, которое fact может получить от пользователя или контекста выполнения. | `inputs.workspace` |
| **Fact Id** | Уникальный идентификатор fact внутри всего facts definition. | `git` |
| **Facts Definition Id** | Идентификатор самого facts definition. | `core-environment-baseline` |
| **Facts Definition Version** | Версия формата facts definition. | `version: 1` |
| **Fact Importance** | Степень обязательности fact для результата сбора. | `required`, `optional`, `evidence` |
| **Fact Platform** | Платформа, на которой fact применим. | `linux`, `macos`, `windows` |
| **Command Fact** | Fact, который описывает CLI-команду и ее аргументы. | `name: git` |
| **Environment Fact** | Fact, который описывает переменную окружения. | `names: [PATH]` |
| **File Fact** | Fact, который описывает наличие, отсутствие или свойства файла. | `path: "{{ inputs.workspace }}"` |
| **Process Fact** | Fact, который описывает процесс операционной системы. | `name: ssh-agent` |
| **Package Fact** | Fact, который описывает установленный пакет, программу или CLI-утилиту как инвентарную сущность. | `names: [openssl]` |
| **User Fact** | Fact, который описывает учетную запись пользователя в целевой системе. | `name: root` |
| **Group Fact** | Fact, который описывает группу пользователей в целевой системе. | `name: admin` |
| **Service Fact** | Fact, который описывает системный сервис. | `name: docker` |
| **Session Fact** | Fact, который описывает активную или ожидаемую пользовательскую/системную сессию. | `kind: interactive` |
| **Artifact Fact** | Fact, который описывает файл или набор файлов, которые нужно захватить как результат. | `path: "{{ inputs.workspace }}/openstrap.log"` |
| **Artifact Capture** | Режим захвата artifact: содержимое, metadata или другой поддержанный способ. | `metadata`, `hash`, `content` |
| **Redaction** | Правило маскирования чувствительных данных в результате сбора. | `redaction: { strategy: hash }` |
| **File Requirement** | Условие для file fact: файл должен существовать, отсутствовать или соответствовать другому требованию. | `require: [exists, readable]` |

## Runtime Context

| Термин | Описание | Пример |
|------|------------|---------|
| **Runtime** | Среда, где запущена программа или collector. | локальный Node.js-процесс |
| **Execution User** | Реальная учетная запись ОС, от имени которой запущена программа. | пользователь из `process.getuid()` |
| **Target** | Система, хост, контейнер или окружение, относительно которого выполняется работа. | `localhost`, SSH-хост |
| **Target User** | Пользователь target, о котором нужно собрать fact, если он явно задан. | `name: root` |
| **Workspace** | Директория или дерево файлов, выбранное как файловый контекст работы. | `inputs.workspace: "."` |
| **Transport** | Канал доступа к target. | `local`, `ssh`, `container` |

## Machine Management

| Термин | Описание | Пример |
|------|------------|---------|
| **Host** | Машина, на которой запущен openstrap. Managed target не является. | ноутбук разработчика |
| **Guest** | Управляемая машина: VM, контейнер, удаленный сервер. | `ubuntu-vm` |
| **Scope** | Значение, которое выбирает схему собираемых facts. Допустимо `host`, `guest`, `network`. | `scope: guest` |
| **Target Type** | Тип доменного объекта target; со `scope` совпадать не обязан. Допустимо `vm`, `container`, `host`. | `type: vm` |
| **Provider** | Внешний инструмент, который создает и ведет жизненный цикл машины. | UTM, VirtualBox |
| **Secret Store** | Порт ядра для хранения секретов; плагин получает ссылку на секрет, не значение. | keychain, GPG |
| **State Store** | Хранилище желаемого состояния, истории прогонов и машинно-локальных данных: портов, id ресурсов провайдера, снимков facts. | SQLite |
| **Lock File** | Сгенерированный файл с вычисленными значениями, одинаковыми у всех, кто склонирует репозиторий. | `openstrap.lock.yaml` |

## Fact Collection

| Термин | Описание | Пример |
|------|------------|---------|
| **Collector** | Исполнитель, который по facts definition собирает фактические данные из target. | раннер facts |
| **Discovery** | Автоматическое обнаружение доступных команд, флагов, пакетов, сервисов или других возможностей target. | сканирование `--help` |
| **Collection Limits** | Ограничения выполнения сбора. | `timeoutMs: 5000` |
| **Provenance** | Сведения о происхождении собранного fact. | `source: "git --version"` |

## Workflow Orchestration

| Термин | Описание | Пример |
|------|------------|---------|
| **Workflow** | Последовательность шагов продукта, которая использует configs и результаты выполнения. | загрузить config -> собрать facts |
| **Workflow Step** | Одна атомарная операция workflow. | `collectFacts` |
| **Scheduler** | Механизм запуска workflow по времени или событию. | ежедневный запуск |

## Storage And Retention

| Термин | Описание | Пример |
|------|------------|---------|
| **Storage** | Слой сохранения configs, результатов, artifacts и истории запусков. | SQLite, S3 |
| **Retention** | Политика хранения и удаления сохраненных данных. | хранить 30 дней |

## Output And Reporting

| Термин | Описание | Пример |
|------|------------|---------|
| **Artifact** | Захваченный результат выполнения, обычно файл, metadata или содержимое. | `openstrap.log.hash` |
| **Export** | Преобразование внутренних данных во внешний формат. | JSON-отчет |
| **Report** | Человеко-читаемый результат анализа или сбора. | сводка facts |

## Architecture Terms

| Термин | Описание | Пример |
|------|------------|---------|
| **Domain** | Предметная модель модуля: имена, типы и инварианты, которые не меняются при замене YAML, Zod, storage или transport. Если термин нужен только конкретной библиотеке, он не domain. | `src/Facts/Domain` |
| **Entity** | Доменный объект, который система различает по identity. Поля могут измениться, но объект с тем же id остается тем же объектом. | fact с `id: git` |
| **Value Object** | Доменное значение без identity и lifecycle. Его не ищут по id и не обновляют как объект; его заменяют целиком, а равенство определяется значением. | `FactImportance.Optional` |
| **DTO** | Форма данных на границе слоя, порта или внешнего формата. DTO описывает контракт обмена, не решает доменные правила и не получает identity только потому, что в нем есть поле `id`. | `ConfigIssueDto` |
| **Application Layer** | Слой use cases. Здесь происходит последовательность действий: принять вход, вызвать core/domain services, перевести ошибки, вернуть результат. Если код только описывает поля config, это не application. | `CollectFactsFromDefinition.collect()` |
| **Schema Layer** | Контракт допустимого config. Здесь находятся поля, типы, required/default/unique rules; здесь не должно быть IO, запуска команд, workflow или transport. | `src/Facts/Definition/Schema` |
| **Adapter** | Внешняя техническая реализация port. Adapter может импортировать Zod, YAML parser, filesystem или network library; domain и config module не должны зависеть от него. | `ZodConfigValidator` |
| **Port** | Интерфейс потребности системы, названный по capability, а не по технологии. Port существует, когда потребителю важно "что сделать", а реализацию можно заменить. | `JsonSchemaEmitter` |
| **Composition Root** | Единственное место, где concrete adapters соединяются с ports для создания готового объекта. Если файл только прячет один `new`, это не composition root. | bootstrap приложения |

## Architecture Term Distinctions

| Пара | Различие | Пример |
|------|------------|---------|
| **Entity vs Value Object** | Entity нужен, когда identity важнее полного набора полей. Value object нужен, когда значение само и есть вся сущность. | `id: git` идентифицирует fact; `optional` - значение. |
| **Value Object vs DTO** | Value object принадлежит domain language. DTO принадлежит boundary contract. | `FactPlatform.Linux` vs `{ path, message, code }`. |
| **DTO vs Entity** | Entity нельзя пересобрать произвольно без риска сломать смысл identity. DTO можно собрать заново как ответ parser/validator/port. | entity facts definition vs DTO ошибки валидации |
| **Port vs Adapter** | Port находится на стороне потребителя и не знает технологию. Adapter находится на стороне технологии и реализует port. | `ConfigValidator` vs `ZodConfigValidator`. |
| **Schema Layer vs Application Layer** | Schema отвечает "какой config валиден?". Application отвечает "что сделать с этим config?". | `FactsDefinitionSchema.build()` vs `CollectFactsFromDefinition.collect()`. |
| **Domain vs Schema Layer** | Domain называет предметные понятия. Schema решает, как эти понятия допустимо записать в config file. | `FactImportance` vs `configSchema.enum(FactImportance)` |

## Risky Terms

| Термин | Описание | Пример |
|------|------------|---------|
| **Declaration** | Размытый термин, который смешивает fact, поле schema и config file. | `FactDeclarationEntity` |
| **Selector** | Размытый термин, который не говорит, что именно выбирается и где выполняется выбор. | `selector: current` |
| **Current User** | Размытый термин, который может означать пользователя ОС, пользователя target или пользователя продукта. | `currentUser` |
| **Options** | Слишком общий термин для настроек fact; в facts domain используется **Fact Settings**. | `FactDeclarationOptions` |
| **Provider** | Термин допустим только для класса, который действительно предоставляет внешний ресурс через четкий port. | `FactsProvider` |
| **Factory** | Термин допустим только когда создание объекта само является отдельной ответственностью. | `createConfigLoader()` |
| **Composition** | Термин допустим только для composition root, где реально собираются зависимости. | `FactsComposition` |
| **Definition Definition** | Повторяющийся термин, который прячет различие между **Config Schema** и **Facts Definition**. | `FactsDefinitionConfigDefinition` |

## Relationships

### Config Module Chain

- **Config Module** использует **ConfigCore** для чтения, проверки и экспорта config.
- `src/Facts/Definition` является **Config Module** для **Facts Definition** внутри product module `Facts`.
- **FactsDefinitionReader** является внутренним reader внутри `Facts/Definition`; внешний сбор по definition идет через **CollectFactsFromDefinition**.
- **Facts** является public result object: принимает собранные **FactCollectionItem** и представляет **FactCollection** как instance.
- `src/Facts/SchemaArtifacts` возвращает facts-specific JSON Schema artifacts.

### ConfigCore Chain

- **ConfigCore** владеет техническим pipeline config: чтение -> парсинг -> валидация -> экспорт.
- **Config Schema** описывается через DSL **ConfigCore**.
- **Schema Definition** собирает метаданные, file patterns и корневой schema node для этого pipeline.
- **ConfigCore Adapter** реализует конкретную технологию внутри pipeline.
- **ConfigCore Adapter** может знать про Zod, YAML parser или другую библиотеку; **Facts** не может.

### Layer Chain

- **Domain** называет предметные понятия и инварианты.
- **Schema Layer** описывает, как domain concepts допустимо записать в config file.
- **Application Layer** использует schema/core/domain для выполнения use case.
- **Domain** не импортирует **Schema Layer**, **Application Layer**, Zod, YAML или JSON Schema.

### Facts Definition Chain

- **Facts Definition** содержит набор **Fact Sections**.
- **Fact Section** содержит facts одного типа.
- **Fact** имеет **Fact Id**.
- **Fact Id** должен быть уникальным внутри всего **Facts Definition**.
- **Fact Settings** применяются к fact в любой section.

### Fact Type Boundaries

- **Package Fact** описывает установленную программу как инвентарную сущность.
- **Command Fact** описывает выполнение команды.
- **File Fact** описывает состояние файла или пути.
- **Artifact Fact** описывает захват результата.

### Runtime Chain

- **Runtime** определяет **Execution User**.
- **Target** определяет, относительно какой системы собираются facts.
- **Transport** определяет канал доступа к target и выполняет на нем операции: чтение файла, выполнение команды, сетевой вызов.
- **Transport** не включает вывод прогресса и окружение процесса openstrap и не отдает производных данных вроде определения ОС.
- **Collector** меняется по операционной системе target, а не по **Transport**; **Host** собирается через локальный transport.
- **Target User** должен быть явно задан в config или найден через collector/discovery.
- **Provenance** связывает собранный fact с command, file, transport, timestamp и target.

## Flagged Ambiguities

| Неоднозначность | Конкретный пример | Различие |
|-----------|------------------|------------|
| **Facts** vs **Facts Definition** | `new Facts(items)` vs `id: core-environment-baseline` в YAML | **Facts** представляет collected normalized facts; **Facts Definition** описывает reusable декларацию того, что нужно собрать. |
| **Facts Definition** vs **Facts Definition JSON Schema** | `CollectFactsFromDefinition` внутри CLI/Facts application vs `FactsDefinitionJsonSchema` | **Facts Definition** - доменный config; JSON Schema - внешний artifact для редакторов/инструментов. Оба принадлежат product module `Facts`. |
| **Config Schema** vs **JSON Schema** vs Zod | `FactsDefinitionSchema.build()` vs `schemas/facts-definition.schema.json` vs `ZodConfigValidator` | **Config Schema** - внутренний контракт; **JSON Schema** - artifact для редактора; Zod - деталь реализации adapter. |
| **Package Fact** vs **Command Fact** | `packages: [{ names: [openssl] }]` vs `commands: [{ name: git }]` | **Package Fact** проверяет инвентарь установленного ПО; **Command Fact** проверяет поведение executable или вывод команды. |
| **File Fact** vs **Workspace** | `files: [{ path: "{{ inputs.workspace }}" }]` vs `inputs.workspace: "."` | **Workspace** задает файловый контекст; **File Fact** проверяет путь внутри этого контекста. |
| **Artifact Fact** vs **File Fact** | `artifacts: [{ path: "openstrap.log", capture: hash }]` vs `files: [{ path: "openstrap.log", require: [exists] }]` | **Artifact Fact** сохраняет evidence; **File Fact** проверяет состояние файла. |
| **Execution User** vs **Target User** | Программа запущена как `openstrap`; config проверяет `users: [{ name: root }]` | **Execution User** запускает процесс; **Target User** является объектом описания или проверки. |
| **Provider** vs **Port** vs **Adapter** vs **Facade** | `FactsProvider` vs `ConfigValidator` vs `ZodConfigValidator` vs `Facts` | **Port** - интерфейс; **Adapter** реализует port; **Facade** - публичный API модуля; **Provider** допустим только для реального внешнего ресурса. |
| **Scope** vs **Target Type** | `scope: guest`, `type: container` | **Scope** выбирает схему данных facts; **Target Type** говорит, чем объект является. Совпадать не обязаны. |
| **Lock File** vs **State Store** | `openstrap.lock.yaml` с sha образа vs выделенный порт и id машины в UTM | **Lock File** хранит переносимое между людьми и коммитится; **State Store** хранит машинно-локальное. Lock file не является отчетом из state store. |
