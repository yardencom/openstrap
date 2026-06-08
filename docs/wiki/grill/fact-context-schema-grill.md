# OpenStrap: Fact/context schema grill

Создано: 2026-06-04

Статус: closed

## Already Decided

1. **Raw facts and normalized facts.** Raw facts/evidence нужны для debug/support. Normalized facts/context являются contract для checks, components, agents и reports.

2. **Normalized fact schema.** OpenStrap ведет маленькую версионируемую normalized fact schema, которая растет из official components/policies.

3. **Facts vs requirements.** Facts - observed state. Requirements/preflight gates - отдельные проверки по context/facts.

4. **FactSnapshot / FactCollection.** Source of truth для facts - immutable `FactSnapshot`. `FactCollection` - набор элементов `{ snapshot, run }`. Поиск последнего/последнего успешного запуска находится вне facts schema: это storage query или optional read model.

5. **Fact history.** `FactSnapshot` - immutable snapshot одного context. `FactCollection` группирует snapshots. История отдельного fact между запусками отдельно не моделируется.

6. **Freshness/TTL.** `ttl`/`validUntil` задается на `FactRun`, не на отдельных facts и не на `FactSnapshot` payload.

7. **Profiles.** Profiles находятся выше facts layer: workflow/collection step/request решает, что собирать. `FactSnapshot`, `FactRun` и `FactCollection` не хранят profile.

8. **Purpose.** Purpose не является частью FactCollection. Зачем собрали facts, выводится из run/workflow/check/report.

9. **Collector metadata and artifacts.** Collector metadata, artifact refs и raw evidence не являются полями FactCollection. Они относятся к execution/artifact/evidence model.

10. **Local VM host facts.** В Local VM flow host facts используются как execution context для run/provider execution; guest VM остается primary target.

11. **Local VM post-create facts/checks.** Для local VM default bootstrap readiness включает SSH, OS/arch, CPU/RAM/disk, IP/network, user/sudo, package manager, filesystem write, time sync, DNS/internet, basic security posture.

## Решения

1. **Context document shape.** Решение: superseded by decisions 99-101. FactCollection belongs to exactly one context and uses flat payload shape.

2. **V1 scope types.** Решение: v1 normalized context ограничивается scope types `host`, `guest`, `network`. Модель должна быть расширяемой, чтобы позже добавить новые/custom scope values.

3. **Provider facts with limited scopes.** Решение: provider не является отдельным v1 scope. Для local provider facts вроде UTM installed/version/capabilities относятся к `host`. Provider/resource identity and capability refs могут жить в context metadata/ref. Детальный provider SDK/capabilities - отдельная ветка.

4. **Context unit naming.** Решение: superseded by decisions 99-101. `Context` remains a conceptual term for `scope + target + data`, not a nested object/entity.

5. **Context shape.** Решение: superseded by decision 100. FactCollection payload is flat: `schemaVersion`, `scope`, `target`, `data`.

6. **Context target.** Решение: поле называется `target`, не `targetRef`. `target` is a typed reference to what this Context describes, with fields like `type`, `id`, optional `displayName`.

7. **Context data naming style.** Решение: inside `data`, field names should be flat and represent objects/sections, not composed phrases. Example: use `network`, `providers`, `cache`, not `networkConnectivity` or similar mixed names.

8. **Host context v1 sections.** Решение: superseded by decision 11. `host.data` uses shared `System`.

9. **Architecture section.** Решение: `arch` is a separate section, not nested under `os` or `cpu`, because image matching and compatibility use architecture directly.

10. **Shared host/guest data model name.** Решение: общий data model для `host` и `guest` называется `System`. Не использовать тяжелые имена вроде `MachineContextData`.

11. **System v1 sections.** Решение: superseded by decisions 22-31. `System` now uses `BaseSystem`, `HostSystem`, `GuestSystem`, `OtherSystem`.

12. **Network model.** Решение: `System.network` и `Context(scope=network).data` используют общий интерфейс `Network`. Они не конфликтуют: разница задается `scope/target`, а не разными схемами.

13. **Network v1 sections.** Решение: superseded by decision 68. Final `Network` v1 sections: `interfaces`, `dns`, `ports`, `firewall`, `reachability`.

14. **Security/access-related facts.** Решение: в `System` v1 добавляем конкретные наблюдаемые секции `transports` и `privileges`. `firewall` живет внутри `Network`. Не добавляем top-level `ssh` и не добавляем абстрактный `security`. `transports` can contain `ssh`, `winrm`, `agent`, etc. Оценка безопасности относится к `Security baseline` / `Requirement/check model`.

15. **No abstract access section in System.** Решение: `access` убираем из `System` v1. Наблюдаемые факты доступа лежат в `transports` and `privileges`; product `AccessProfile` остается отдельной моделью, не facts.

16. **Runtimes section.** Решение: `runtime` заменяем на `runtimes`. `runtimes` хранит observed runtime/capability facts: docker, containerd, k8s, openstrapAgent, etc. Docker может также быть service, но component checks читают `runtimes.docker`.

17. **Providers section.** Решение: `providers` remains optional and is host-specific in the refined inheritance model.

18. **System inheritance model.** Решение: есть базовый общий `BaseSystem` и конкретные типы `HostSystem extends BaseSystem`, `GuestSystem extends BaseSystem`, `OtherSystem extends BaseSystem`. Host-specific sections не тащим в Guest.

19. **Caches section.** Решение: `caches` содержит только cache facts: `images`, `downloads`, `packages`, etc. Provider data не хранится внутри `caches`.

20. **HostSystem providers section.** Решение: `providers` остается отдельной секцией `HostSystem` и хранит только observed local provider availability summary: installed, version, available, reason, capability summary. Полный Provider SDK/model сюда не входит.

21. **Virtualization section.** Решение: `virtualization` lives as optional section in `BaseSystem`, because guest can also have nested virtualization/constraints. It is more important/expected for `HostSystem` profiles.

22. **Final System v1 structure.** Решение: актуальная структура:

```text
BaseSystem:
  os
  arch
  cpu
  memory
  storage
  virtualization?
  network
  users
  packages
  processes
  services
  transports
  privileges
  runtimes
  paths?
  tools?
  env?

HostSystem:
  ...BaseSystem
  providers
  caches

GuestSystem:
  ...BaseSystem

OtherSystem:
  ...BaseSystem
  extensions?
```

23. **Firewall location.** Решение: `firewall` живет только внутри `Network`. Убираем отдельный `BaseSystem.firewall`, чтобы не было дубля.

24. **Transports location.** Решение: `transports` живет в `BaseSystem`, не в `Network`. `Network` хранит связность/порты; `transports` хранит протоколы управления системой: ssh, winrm, agent, etc.

25. **Privileges location.** Решение: `privileges` - отдельная секция `BaseSystem`, не внутри `transports`. Transport отвечает за подключение, privileges - за elevation/admin capabilities внутри системы.

26. **Services/processes/runtimes separation.** Решение: `processes` = фактически запущенные процессы ОС. `services` = управляемые сервисы/systemd/launchd/Windows services, их enabled/running state. `runtimes` = capability layer для components: docker, containerd, k8s, openstrapAgent, etc.

27. **Processes section.** Решение: добавить `processes` как отдельную optional/profile-based секцию `BaseSystem`. Полный process inventory может быть тяжелым, поэтому не каждый profile обязан ее собирать.

28. **Packages section.** Решение: `packages` includes package managers and installed packages: `packages.managers` and `packages.installed`.

29. **Storage section.** Решение: `disk` переименовываем в `storage`, потому что нужны disks, filesystems, mounts, free space, volumes.

30. **Memory section.** Решение: оставить `memory`, не `ram`, потому что секция может включать RAM, swap, available memory, pressure.

31. **CPU and architecture separation.** Решение: `cpu` and `arch` remain separate. `arch` is used for compatibility/image matching; `cpu` is used for cores/model/features/load.

32. **Network type name.** Решение: тип называется просто `Network`. `System.network: Network` and `Context(scope=network).data: Network`. Не используем `NetworkContext`.

33. **Context data type mapping.** Решение: `scope` определяет тип `data`: `scope=host -> data=HostSystem`; `scope=guest -> data=GuestSystem`; `scope=network -> data=Network`. Future/custom scopes can define custom data schema later. Updated by decisions 99-100: this mapping applies to flat `FactCollection.scope` and `FactCollection.data`.

34. **Custom scope in v1.** Решение: в v1 разрешенные scopes только `host`, `guest`, `network`. Custom scopes не включаем в v1 runtime/schema, но design should allow adding them later.

35. **Schema versioning.** Решение: superseded by decisions 96 and 103. `schemaVersion` lives on `FactSnapshot` payload.

36. **Collection timing.** Решение: superseded by decisions 117-118. Timing fields live on `FactRun` as `startedAt` and `finishedAt`.

37. **Collection TTL.** Решение: superseded by decision 116. `ttl`/`validUntil` lives on `FactRun`.

38. **Collection profile.** Решение: superseded by decisions 90 and 122. Profiles are above facts layer and are not stored in `FactSnapshot`, `FactRun`, or `FactCollection`.

39. **Context identity.** Решение: superseded by decisions 103 and 108. `Context` is conceptual; `FactSnapshot` has `id`; `FactCollection` is an array of `{ snapshot, run }`.

40. **Context target required.** Решение: `target` обязателен в `FactCollection` payload. Без target непонятно, про что facts.

41. **Context scope vs target type.** Решение: `target.type` не обязан совпадать со `scope`. `scope` выбирает schema/data type; `target.type` указывает domain entity, например `scope=guest`, `target.type=vm`.

42. **Context target must not be check/probe/run.** Решение: `Context.target` должен ссылаться на real/modeled target, про который собраны наблюдаемые данные. `target` не должен быть check/probe/run вроде "проверка сети между host и VM". Check results относятся к `Requirement/check model`.

43. **Network scope usage.** Решение: `scope=network` оставляем, но используем только для modeled network target/entity/resource. Если сеть между host и guest/cloud можно и нужно настраивать, она может быть `network` target. Если это просто сетевые facts конкретной системы, они лежат в `System.network`.

44. **Local VM network target boundary.** Решение: Local VM NAT/port-forwarding network by default is part of VM resource config/artifacts, not separate network target. If provider exposes a manageable network object, such as VirtualBox host-only network or cloud subnet, it can be represented as `scope=network`.

45. **No sources in facts payload v1.** Решение: `FactSnapshot` не содержит `sources` в v1. Source/provenance/debug details живут в related evidence/run artifacts, collector metadata и logs.

46. **No confidence in facts payload v1.** Решение: `FactSnapshot` не содержит `confidence`/trust level в v1. Trust/provenance/debug идут через evidence/artifacts/logs.

47. **Status-bearing facts source.** Решение: status-bearing facts появляются из declared collectors/probes + normalizer, а не как произвольное поле пользователя. Raw evidence хранится отдельно, normalized status попадает в `FactSnapshot.data`.

48. **Observed type.** Решение: вводим базовый тип `Observed` для optional/checkable objects: `status: present | absent | unknown | unsupported | error`, `reason?: string`. Concrete types can extend/use it, e.g. DockerRuntime, Service, Firewall, ProviderAvailability. Базовые характеристики типа `os`, `cpu`, `memory` не используют `Observed`.

49. **Observed error fields.** Решение: for `Observed.status = error`, store `reason` machine-readable and optional `message` human-readable. Full error details stay in evidence/logs.

50. **Unknown vs missing.** Решение: missing field = profile/collector did not collect it. `Observed.status = unknown` = collector ran, but could not determine state.

51. **Unsupported vs absent.** Решение: `absent` = collector checked and object/capability is not present. `unsupported` = collector/target does not support this check.

52. **OS fields v1.** Решение: `os` v1 fields: `family`, `name`, `version`, `codename?`, `kernel?`, `edition?`.

53. **Arch v1.** Решение: `arch` is a normalized string, not an object. Example values: `arm64`, `x64`. Raw variants like `aarch64`, `x86_64`, `amd64` are normalized by collector/normalizer.

54. **CPU fields v1.** Решение: `cpu` v1 fields: `cores`, `threads?`, `model?`, `vendor?`, `features?`, `load?`.

55. **Memory fields v1.** Решение: `memory` v1 fields: `totalBytes`, `availableBytes?`, `swapTotalBytes?`, `swapUsedBytes?`, `pressure?`.

56. **Storage fields v1.** Решение: `storage` v1 fields: `disks?`, `filesystems?`, `mounts`, `totalBytes?`, `availableBytes?`.

57. **Virtualization fields v1.** Решение: `virtualization` v1 fields: `supported`, `enabled?`, `type?`, `nested?`, `reason?`.

58. **Users fields v1.** Решение: `users` v1 fields: `current?`, `managed?`, `entries?`. `entries` optional/profile-based.

59. **Packages fields v1.** Решение: `packages` v1 fields: `managers`, `installed?`. `installed` optional/profile-based.

60. **Processes fields v1.** Решение: `processes` is a map of process key/name to observed process fact: `Record<ProcessKey, Process>`. `Process extends Observed` with optional fields like `pid`, `pids`, `name`, `user`, `command`, `startedAt`, `uptimeSeconds`. Whether collector checked specific processes or full inventory is defined by profile/collector request, not by Context shape.

61. **Services fields v1.** Решение: `services` is a map of service key/name to observed service fact: `Record<ServiceKey, Service>`. `Service extends Observed` with optional fields like `manager`, `name`, `enabled`, `running`, `state`, `version`. Whether collector checked specific services or full inventory is defined by profile/collector request, not by Context shape.

62. **Transports fields v1.** Решение: `transports` is a map: `Record<TransportKey, Transport>`. `Transport extends Observed` with fields: `type`, `endpoint?`, `authMethods?`, `ready?`, `version?`.

63. **Privileges fields v1.** Решение: `privileges` v1 fields: `mode?`, `sudo?`, `become?`, `admin?`. `mode?` can describe observed/applied privilege mode such as `managed` or `restricted`; it is not a fact collection profile. `sudo`, `become`, `admin` are `Observed`. For Linux local VM, sudo can include `passwordless?`.

64. **Runtime facts source.** Решение: `runtimes` заполняются functional/capability probes, not by process/service presence alone. Example: Docker runtime checks Docker API/access/readiness/capabilities, not only `dockerd` process or `docker.service`.

65. **Runtimes fields v1.** Решение: `runtimes` is a map: `Record<RuntimeKey, Runtime>`. `Runtime extends Observed` with fields: `type`, `version?`, `ready?`, `endpoint?`, `capabilities?`, `reason?`.

66. **HostSystem providers fields v1.** Решение: `providers` is a map: `Record<ProviderKey, ProviderAvailability>`. `ProviderAvailability extends Observed` with fields: `type`, `version?`, `available?`, `capabilities?`, `reason?`.

67. **HostSystem caches fields v1.** Решение: `caches` v1 fields: `images?`, `downloads?`, `packages?`. Each cache can include `path?`, `sizeBytes?`, `limitBytes?`, `entries?`.

68. **Network v1 refined sections.** Решение: `Network` v1 sections: `interfaces`, `dns`, `ports`, `firewall`, `reachability`. `addresses` убираем как отдельную секцию; addresses/MAC живут внутри `interfaces`. `connectivity` переименовано в `reachability`.

69. **Network interfaces fields v1.** Решение: `interfaces` is a map: `Record<InterfaceKey, NetworkInterface>`. `NetworkInterface` fields: `name`, `type?`, `mac?`, `state?`, `mtu?`, `addresses?`. Interface address fields: `ip`, `family`, `prefix?`, `scope?`.

70. **Network DNS fields v1.** Решение: `dns` v1 fields: `resolvers?`, `search?`, `domain?`. DNS works/reachable checks go to `reachability.dns`, not `dns`.

71. **Network ports fields v1.** Решение: `ports` is a map: `Record<PortKey, Port>`. `Port extends Observed` with fields: `protocol`, `port`, `state?`, `bind?`, `process?`, `service?`, `forward?`. `forward` is used for NAT/port-forward mappings and can include `from` and `to`.

72. **Network firewall fields v1.** Решение: `firewall` is `Firewall extends Observed` with fields: `enabled?`, `backend?`, `defaultPolicy?`, `rules?`. `rules` optional/profile-based.

73. **Network reachability fields v1.** Решение: `reachability` is a map: `Record<ReachabilityKey, Reachability>`. `Reachability extends Observed` with fields: `target`, `endpoint?`, `latencyMs?`, `protocol?`, `reason?`.

74. **Paths section.** Решение: add optional/profile-based `paths` to `BaseSystem`: `Record<PathKey, PathFact>`. For files/directories: exists/status, type, permissions, owner, writable/readable where collected.

75. **Paths fields v1.** Решение: `PathFact extends Observed` with fields: `path`, `type?`, `exists?`, `owner?`, `group?`, `mode?`, `readable?`, `writable?`, `executable?`, `sizeBytes?`.

76. **Tools section.** Решение: add optional/profile-based `tools` to `BaseSystem`: `Record<ToolKey, ToolFact>`. `tools` = executable/CLI availability, version and capabilities. Not every tool is a package/runtime/provider.

77. **Tools fields v1.** Решение: `ToolFact extends Observed` with fields: `name`, `path?`, `version?`, `executable?`, `capabilities?`.

78. **Env section.** Решение: add optional/profile-based `env` to `BaseSystem`: `Record<EnvKey, EnvVarFact>`. Collection is allowlist/profile-based and redacted; do not collect all variables blindly.

79. **Env fields v1.** Решение: `EnvVarFact extends Observed` with fields: `name`, `value?`, `redacted?`, `sensitive?`. For sensitive variables, `value` is absent and `redacted` is true.

80. **BaseSystem structure update.** Решение: add optional/profile-based `paths`, `tools`, `env` to `BaseSystem`.

81. **No free-form metadata in facts payload v1.** Решение: `FactSnapshot` does not include free-form `metadata` in v1. `schemaVersion` stays in payload; profile/evidence/logs/provenance live outside facts payload.

82. **FactCollection top-level refs.** Решение: superseded by decisions 93-108. `FactCollection` does not store top-level refs/metadata; it is an array of `{ snapshot, run }`.

83. **Partial collection result.** Решение: if collectors partially fail, OpenStrap still creates `FactCollection` with expected snapshots where possible. Failed status-bearing facts use `Observed.status = error` with `reason` and optional `message`. Per-snapshot collection status lives in `FactRun.status`.

84. **Fact units.** Решение: facts may store both machine-readable value and optional display value. Source of truth for logic is machine-readable fields: `*Bytes`, `*Seconds`, `*Ms`, ISO timestamps, boolean true/false.

85. **Machine-readable field suffixes.** Решение: machine-readable units use explicit suffixes/names: `sizeBytes`, `totalBytes`, `availableBytes`, `latencyMs`, `uptimeSeconds`, `durationSeconds`, `createdAt`, `startedAt`.

86. **Display values location.** Решение: optional human-readable display values live in a `display` object inside the relevant section/object, not next to every machine field.

87. **Display values producer.** Решение: `display` optional. UI must be able to format machine values itself, but collector/normalizer may populate `display` when preserving useful source/human representation.

88. **Display values are not for checks.** Решение: requirements/checks use only machine-readable fields. `display` is only for UI/debug/source readability.

89. **No FactCollection status in v1.** Решение: `FactCollection` does not store aggregate `status` in v1. Per-snapshot collection status lives in `FactRun.status`; broader execution status lives in workflow/collection step.

90. **Profiles are above facts layer.** Решение: profiles are above facts layer. `FactSnapshot`, `FactRun` and `FactCollection` do not store profile; profile/request belongs to workflow/collection step.

91. **FactCollection refs without profile.** Решение: superseded by decisions 93-100. Facts payload no longer stores ownership/provenance metadata or `contexts[]`.

92. **No runId in FactCollection.** Решение: `runId` убираем из `FactCollection`. Связь хранится снаружи: `run/collection step -> factCollectionId`. Facts layer остается snapshot, а не provenance/run model.

93. **No ownership/provenance metadata in FactCollection.** Решение: `FactCollection` не хранит ownership/provenance metadata: no `workspaceId`, `environmentId`, `runId`, `profile`, `purpose`, collector metadata, artifact refs. Все связи живут во внешней модели: storage/index/ownership, run/collection step, workflow/check/report, evidence/artifacts.

94. **FactCollection freshness metadata.** Решение: superseded by decision 95. Freshness metadata belongs to external metadata entity, not pure facts payload.

95. **Pure facts payload.** Решение: superseded by decisions 103 and 108. Pure facts payload is `FactSnapshot`; `FactCollection` is an array of `{ snapshot, run }` items.

96. **Schema version stays in payload.** Решение: `schemaVersion` остается внутри `FactSnapshot` payload, потому что без него невозможно интерпретировать facts payload. Остальная metadata живет вне facts payload.

97. **External metadata entity naming.** Решение: в этой ветке не вводим и не называем новую сущность типа `FactCollectionRecord`. Фиксируем только границу: metadata/ownership/provenance/storage/run/evidence живут вне `FactCollection`. Конкретное имя внешней сущности закрывается в другой ветке.

98. **Context target belongs to payload.** Решение: `target` is part of facts payload, not external metadata. Without `target`, facts have no meaning because it is unclear what they describe.

99. **One snapshot per context.** Решение: superseded/refined by decisions 103 and 108. `FactSnapshot` belongs to exactly one context; `FactCollection` can contain multiple snapshots.

100. **Flat FactSnapshot payload.** Решение: since one `FactSnapshot` belongs to exactly one context, do not nest a separate `context` object. Payload shape: `id`, `schemaVersion`, `scope`, `target`, `data`. `Context` remains a conceptual term for `scope + target + data`, not a nested object/entity.

101. **Supersede old Context array model.** Решение: старые решения про `contexts[]`, `Context.id`, `Context.schemaVersion`, `contexts.target` superseded. Final v1 facts payload shape is flat single-context `FactSnapshot`; `FactCollection` is an array of `{ snapshot, run }`.

102. **Keep scope in flat payload.** Решение: `scope` остается в `FactSnapshot` payload even though `target` has `type`. `target.type` describes domain object; `scope` selects fact/data schema.

103. **FactSnapshot and FactCollection naming.** Решение: `FactSnapshot` = immutable facts payload for one context: `id`, `schemaVersion`, `scope`, `target`, `data`. `FactCollection` = array/set of items containing `snapshot: FactSnapshot` and `run: FactRun`. Metadata/ownership/provenance remains outside.

104. **FactCollection non-empty.** Решение: `FactCollection` must contain at least one item/snapshot. Empty collection is not valid facts payload. If nothing was collected, that is represented in run/collection step/evidence, not as empty FactCollection.

105. **Expected snapshot on collection failure.** Решение: if collection request expected a snapshot for scope/target, FactCollection should include that FactSnapshot even if collection failed, with available/error-bearing observed facts.

106. **Error refs live above snapshots.** Решение: detailed error/log/evidence refs live in external run/collection step/metadata entity, linked to relevant snapshot/scope/target. FactSnapshot stores normalized error facts only.

107. **No top-level errors in FactSnapshot data.** Решение: `FactSnapshot.data` does not have generic top-level `errors`. Errors live in concrete observed sections, e.g. `transports.ssh.status=error`, `runtimes.docker.status=error`, `network.firewall.status=error`. Detailed refs live above snapshot.

108. **Форма FactCollection.** Решение: `FactCollection` - это массив объектов. Каждый элемент хранит `snapshot` - нормализованные факты, и `run` - метаинформацию о сборе именно этого snapshot. Shape: `Array<{ snapshot: FactSnapshot, run: FactRun }>`.

109. **Связь FactRun со snapshot.** Решение: `run.snapshotId` нужен, даже если `run` лежит рядом со своим `snapshot` в элементе `FactCollection`. `FactRun` может быть сохранен/передан отдельно, поэтому связь должна быть явной.

110. **Минимальные поля FactRun.** Решение: superseded by decision 118. Final `FactRun` fields: `id`, `snapshotId`, `startedAt`, `finishedAt`, `status`, `validUntil?/ttl?`, `attempt?`.

111. **FactRun status values.** Решение: `FactRun.status` values: `success`, `warning`, `error`. `warning` replaces `partial`.

112. **Observed status stays separate.** Решение: `Observed.status` remains `present | absent | unknown | unsupported | error`. `warning` exists only as aggregate `FactRun.status`, not as concrete observed object status.

113. **FactRun warning semantics.** Решение: `FactRun.status = warning`, если snapshot создан, но есть non-fatal проблемы: часть `Observed = unknown`, `unsupported`, optional `error`, или collector не смог собрать optional секцию. Если required transport/access полностью не сработал и snapshot почти только ошибка - `error`.

114. **Required/optional severity is above facts.** Решение: whether a failed/unknown/unsupported observed fact makes `FactRun` warning or error is determined by collection request/profile/workflow/requirement/component above facts layer. FactSnapshot stores only observed result.

115. **FactRun owns collection status.** Решение: `FactRun.status` remains in `FactRun`, because it is the result/status of collecting its paired `FactSnapshot`.

116. **FactRun freshness.** Решение: `validUntil`/`ttl` lives in `FactRun`, because freshness belongs to the collected snapshot/run metadata. Different snapshots in one FactCollection may have different freshness.

117. **FactRun timing fields.** Решение: `FactRun` uses `startedAt` and `finishedAt`; no separate `collectedAt` in v1. `finishedAt` is the effective collection time for freshness.

118. **FactRun minimum fields updated.** Решение: update decision 110. Final minimum `FactRun` fields: `id`, `snapshotId`, `startedAt`, `finishedAt`, `status`, `validUntil?/ttl?`, `attempt?`. No `collectedAt`.

119. **No FactRun duration field.** Решение: `durationMs` не хранится в `FactRun`; duration вычисляется из `startedAt` and `finishedAt`.

120. **FactRun attempt.** Решение: `FactRun` хранит `attempt` / retry number, чтобы было видно, какой попыткой был собран snapshot.

121. **FactRun trigger.** Решение: superseded by decision 123. `trigger` belongs to workflow/collection step, not to `FactRun`.

122. **No profile in FactRun.** Решение: `profile` не хранится в `FactRun`. Profiles are above facts layer and belong to workflow/collection step/request. `FactRun` остается metadata конкретной попытки сбора snapshot.

123. **No trigger in FactRun.** Решение: `trigger` не хранится в `FactRun`. Trigger относится к workflow/collection step, потому что один запуск может создать несколько FactRuns/snapshots.

124. **Keep attempt in FactRun.** Решение: `attempt` остается в `FactRun`, потому что retries can differ per snapshot/target. Example: host collected on first attempt, guest collected on second attempt.

125. **No FactRuns entity in facts schema.** Решение: не вводим отдельную сущность `FactRuns` в Fact/context schema. Последние запуски находятся query по сохраненным `FactRun`/`FactSnapshot` через storage indexes. Optional materialized read model допустим только как storage optimization, не как часть schema.

126. **Cancel FactRuns latest model.** Решение: не фиксируем модель `FactRuns.latest`, `latest.id`, `latest.successfulId` и похожие отдельные latest-сущности. Last run / last successful run - это storage query или optional storage optimization вне Fact/context schema.

## Текущая модель

```text
FactSnapshot:
  id
  schemaVersion
  scope
  target
  data

FactRun:
  id
  snapshotId
  startedAt
  finishedAt
  status
  validUntil?/ttl?
  attempt?

FactCollection:
  Array<{
    snapshot: FactSnapshot
    run: FactRun
  }>
```

`Context` остается концептуальным термином для `scope + target + data`; отдельной сущности или вложенного объекта `context` в payload нет.
