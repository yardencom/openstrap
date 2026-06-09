# Architecture Protocol

Этот документ описывает процесс работы с архитектурными изменениями. Архитектурная модель описана в `architecture-boundaries.md`; здесь описано, как применять ее перед кодом, во время реализации и на review.

## When To Use

Используй этот protocol, если изменение:

- добавляет новый module, layer, port, adapter, facade или DTO;
- меняет public API;
- переносит ответственность между modules;
- добавляет generic config behavior;
- вводит concrete dependency;
- меняет domain language.

Обычная локальная правка внутри существующей границы не требует полного protocol.

## Decision Flow

### 1. Name The Capability

Сначала назови, какая capability появляется или меняется.

Good:

- "Проверить config через ConfigCore schema contract."
- "Экспортировать facts definition schema в JSON Schema."
- "Собрать facts на target через transport."

Bad:

- "Сделать provider."
- "Вынести helper."
- "Добавить composition."

Если capability нельзя назвать без технического wrapper-name, граница еще не ясна.

### 2. Choose The Owning Boundary

Определи, где живет ответственность.

| Изменение | Граница-владелец |
|--------|-----------------|
| Общее config validation/schema поведение | `ConfigCore` |
| Конкретная библиотека parsing/validation/emitting | `ConfigCore Adapter` |
| Facts term, entity, value object, invariant | `Facts Domain` |
| YAML/JSON форма facts config | `Facts Schema` |
| Публичное действие facts config module | `Facts Facade` |
| Command execution, SSH, local process, target access | Runtime/Collector |
| Workflow run order | Workflow |
| Persistence, retention, artifacts history | Storage |

Если правило может понадобиться нескольким config modules, первый product module не становится владельцем этого правила.

### 3. Define The Communication Contract

Перед кодом выбери, через что слои будут общаться.

| Переход через границу | Контракт |
|-------------------|----------|
| Consumer -> Product Module | Метод public facade |
| Product Module -> ConfigCore | Public API ConfigCore / schema contract |
| ConfigCore -> Concrete Library | Port + adapter |
| Schema -> Domain | Domain values and types |
| Application -> Consumer | Domain result или DTO |
| Error crossing module boundary | Product-specific error |

Если коммуникация не укладывается в contract, сначала меняется архитектура, потом код.

### 4. Keep The Public API Small

Public API появляется только от consumer use case.

Проверка:

- кто вызывает этот method/class вне модуля?
- что consumer получит в результате?
- можно ли это сделать существующим facade?
- не раскрывает ли method internal schema/core/adapters?

Если ответ неясен, API остается internal.

### 5. Model The Data Shape

Выбери форму данных до реализации.

| Потребность | Форма |
|------|-------|
| Identity and lifecycle | Entity |
| Именованное domain value | Value Object |
| Payload на границе | DTO |
| Контракт config file | Schema Class |
| Реализация технологии | Adapter |
| Заменяемая capability | Port |

Не называй объект `Entity`, `DTO`, `Provider`, `Factory` или `Service`, пока не понятна его ответственность.

### 6. Add The Smallest Abstraction

Новая abstraction допустима, если она делает хотя бы одно:

- закрывает concrete dependency за port;
- выражает stable public use case;
- защищает domain invariant;
- переводит ошибку через boundary;
- убирает реальную повторяемую orchestration.

Не добавляй abstraction, если она только:

- вызывает `new`;
- возвращает константу;
- переименовывает уже понятный method;
- существует "на будущее";
- делает barrel удобнее ценой раскрытия internals.

### 7. Verify The Boundary

Каждое архитектурное изменение должно иметь проверку, соответствующую риску.

| Риск | Проверка |
|------|--------------|
| Public API случайно расширился | public API test |
| Concrete adapter протек в product module | boundary import test |
| Domain начал зависеть от schema/application | boundary import test |
| Schema rule изменил поведение | schema validation test |
| JSON Schema изменился | JSON Schema emission test |
| Domain value изменился | value object/domain test |

Тест лежит внутри module, который он защищает.

## Review Checklist

На review проверяем:

- capability названа как действие системы, а не как wrapper;
- owning boundary выбран по ответственности;
- communication contract явный;
- public API минимален;
- domain не знает concrete technologies;
- generic config behavior живет в ConfigCore;
- product-specific behavior живет в product module;
- schema не выполняет runtime work;
- abstraction имеет настоящую ответственность;
- boundary test может поймать будущую поломку.

## Documentation Updates

Обнови `ubiquitous-language.md`, если появился новый термин или изменился смысл существующего.

Обнови `architecture-boundaries.md`, если появился новый layer, boundary или communication contract.

Напиши ADR, если решение дорого откатить:

- смена validation engine;
- новый config module family;
- изменение public facade style;
- новая runtime/collector architecture;
- новая storage/retention strategy;
- новый способ публикации schemas для пользователей.
