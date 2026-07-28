# OpenStrap: Requirement/check model grill

Создано: 2026-06-06

Статус: closed for v1

## Решения

1. **Requirement and CheckResult are separate.** Решение: `Requirement` describes desired/expected state. `CheckResult` is the result of evaluating that requirement against collected facts.

2. **Expect belongs to Requirement.** Решение: `expect` is part of `Requirement`, not `CheckResult`. `expect` says what should be true; `CheckResult` says what actually happened during evaluation.

3. **Requirements use facts.** Решение: requirements do not store facts, but they refer to normalized fact fields that must be checked.

4. **No facts means no successful check.** Решение: if a requirement needs a fact and the matching `FactSnapshot`/field is missing, the requirement cannot pass.

5. **Requirement is product contract.** Решение: `Requirement` is an OpenStrap product-level contract. The user describes what must be checked, not which backend/tool should run it.

6. **Backend is abstract.** Решение: the check backend must be replaceable. Possible backends include built-in matcher, JSON Schema, CEL, goss, InSpec, osquery, provider API, or another future evaluator.

7. **Backend outside Requirement.** Решение: `backend`/`engine` is not stored in `Requirement`. Workflow/policy/runtime decides which evaluator to use.

8. **Base evaluation uses normalized facts only.** Решение: base `Requirement` evaluation reads normalized facts from `FactSnapshot`; it does not directly run goss/osquery/provider API/SSH commands.

9. **Missing fact is CheckResult error.** Решение: if evaluation cannot read the needed snapshot/path/field, `CheckResult.status = error`, not `failed`.

10. **CheckResult statuses.** Решение: v1 `CheckResult.status` values are `passed`, `failed`, `error`, `skipped`.

11. **Skipped is explicit.** Решение: `skipped` is only for explicit workflow/policy decisions. Missing data is `error`, not `skipped`.

12. **Optional flag.** Решение: requirements are required by default. Non-blocking requirements use `optional: true`; no separate `severity` field in v1.

13. **Optional does not change check status.** Решение: `optional: true` does not transform `failed`/`error` into `warning`. It affects workflow/gate decision above `CheckResult`.

14. **Flat expect with implicit AND.** Решение: superseded by decisions 17-20. v1 requirements are not raw flat fact paths.

15. **YAML-first requirements.** Решение: primary authoring для requirements - YAML. UI строится позже как редактор/генератор той же модели, а не как первичный источник истины.

16. **CEL/CUE as advanced syntax later.** Решение: CEL/CUE не входят в базовый v1 формат requirements. Later they may be added as advanced evaluator syntax, without replacing the base YAML model.

17. **Requirements cannot go outside facts model.** Решение: requirements cannot check anything that OpenStrap cannot represent in normalized facts. Requirement schema can have its own user-facing interface, but it must use/reference supported facts.

18. **Requirement blocks match facts.** Решение: top-level requirement blocks must correspond to fact model sections/types. Example: runtime requirements check runtime facts; service requirements check service facts; path requirements check path facts.

19. **Arbitrary command requirements skipped.** Решение: arbitrary shell command requirement is not fixed for v1 yet. It is skipped until command execution/result is modeled as a supported fact/result type.

20. **Requirement item can be a group.** Решение: one `requirements[]` item can be a logical group containing multiple checks/selectors under one `id`.

21. **One RequirementResult per requirement item.** Решение: superseded by decisions 86-90. A stored `RequirementResult` is one evaluation of a requirement on a concrete target name.

22. **checks include fact type and selector.** Решение: superseded by decision 41. Result checks mirror requirement/facts object structure instead of storing `factType`, `selector`, `field`, or dot-path strings.

23. **checks are per field/condition.** Решение: superseded by decision 41. A leaf node inside mirrored `checks` corresponds to a concrete checked field/condition.

24. **checks store expected and actual.** Решение: `checks[]` stores expected and actual data needed to explain the check result.

25. **Result links to facts.** Решение: superseded by decisions 86-90. `RequirementResult` stores the target name and fact links used for this concrete evaluation.

26. **One requirement item has one target in v1.** Решение: v1 keeps one target per `requirements[]` item. If host and guest are both checked, they should be separate requirement items.

27. **Target is YAML alias.** Решение: `target` in YAML is a human-readable alias such as `host`, `guest`, or `vm.main`, not an internal resource id. Build/run resolves it to a domain entity/resource.

28. **snapshotId/runId live on RequirementResult in v1.** Решение: superseded by decisions 88-89. Stored `RequirementResult` contains `facts.snapshotId` and `facts.factRunId`, not top-level `snapshotId`/`runId`.

29. **actual is normalized fact fragment.** Решение: superseded by decision 42. `actual` stores only the checked actual value/fragment, not the whole nearest fact object.

30. **expected shape.** Решение: superseded by decision 43. `expected` contains `passed` boolean plus `value`, where `value` is the expected value/condition from requirement YAML.

31. **details is separate.** Решение: check explanation/diagnostics live in separate `details` object, not mixed into `expected` or `actual`.

32. **Requirement keys match facts keys.** Решение: requirement block names match normalized facts section names exactly. No singular aliases in v1. Example: use `runtimes`, `services`, `paths`, not `runtime`, `service`, `path`.

33. **Version checks use SemVer range.** Решение: version requirement can be a SemVer range string, e.g. `version: ">=24.0.0"`. OpenStrap uses an existing SemVer library. No custom version comparator and no `versionScheme` in v1. If actual version is not SemVer-compatible, check status is `error`.

34. **Number checks use JSON Schema keywords.** Решение: for numeric fields use standard JSON Schema-style keywords, e.g. `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`.

35. **String checks use JSON Schema keywords.** Решение: for string fields use standard JSON Schema-style keywords, e.g. exact shorthand/`const`, `minLength`, `maxLength`, `pattern`.

36. **Enum/status checks use const/enum.** Решение: enum/status fields use exact shorthand/`const` or JSON Schema-style `enum`.

37. **Boolean checks use exact value.** Решение: boolean fields use exact shorthand/`const` only. Example: `ready: true`.

38. **Named collections are maps by selector.** Решение: if a user should check an entity by name, facts should model it as a map keyed by selector, not as a list. Example: `packages.managers.apt.status`, not `managers: ["apt"]` with a generic list `contains`.

39. **Human YAML can normalize to standard assertions.** Решение: user-facing requirements remain human-readable, but OpenStrap may normalize them to internal JSON Schema assertions/matchers where possible. Example: an expected address list can become internal JSON Schema `contains`.

40. **Dynamic selector keys use JSON Schema maps.** Решение: dynamic selector keys are represented in schema with object maps via `additionalProperties`. Example: `interfaces` is an object whose arbitrary keys are interface names and whose values must match `NetworkInterface`.

41. **RequirementResult checks mirror object structure.** Решение: `RequirementResult.checks` mirrors the requirement/facts object structure. Do not store separate `factPath`, `factSubtype`, `factType`, `selector`, `field`, or dot-path strings in the result shape.

42. **actual stores checked value only.** Решение: `actual` in a leaf check stores only the checked actual value/fragment, not the whole nearest fact object. Full facts remain available through `facts.snapshotId`/`facts.factRunId` on `RequirementResult`.

43. **expected uses value.** Решение: `expected.condition` is removed. Use `expected.value` for the expected value/condition from requirement YAML, plus `expected.passed` boolean.

44. **failed vs error.** Решение: `failed` means the check ran and the fact does not satisfy the requirement. `error` means OpenStrap could not correctly perform the check.

45. **Missing selector is failed.** Решение: superseded by decisions 50 and 54. Requirement-driven collection should return an observed selector entry. If the observed entry has `status: absent`, requirement check can fail. A silently missing requested selector is a collection/schema bug.

46. **Requirements drive fact collection.** Решение: requirements define what facts must be collected. If collection cannot collect a required fact, the issue must be reflected in `FactSnapshot` as observed `error`/`unknown`/`unsupported`, not as a silently missing field. A missing field after requirement-driven collection is a bug/schema mismatch, not a normal user case.

47. **Missing target snapshot is error.** Решение: if no `FactSnapshot` was created for the requirement target, `RequirementResult.status = error`.

48. **Unknown/unsupported/error facts produce check error.** Решение: if the needed observed fact has status `unknown`, `unsupported`, or `error` and the requirement cannot be verified from it, the check status is `error`. `optional` affects only gate/workflow decision, not the check status.

49. **Absent fact can fail a requirement.** Решение: if facts successfully report `status: absent` and requirement expects presence/readiness/existence, the check is `failed`, not `error`.

50. **Requested selector must be represented.** Решение: if a requirement requests a selector, `FactSnapshot` must contain that selector with observed status. Example: requirement asks for `services.ssh.running`; snapshot should contain `services.ssh.status = absent/present/unknown/error/unsupported`, not only `services: {}`.

51. **Absent selector actual is null for missing field.** Решение: if selector exists with `status: absent` and checked field is not present, leaf `actual = null` and check status is `failed`.

52. **Unknown/unsupported/error selector actual is null.** Решение: if selector exists with `status: unknown`, `unsupported`, or `error` and checked field is not present, leaf `actual = null` and check status is `error`.

53. **Existing actual mismatch is failed.** Решение: if checked actual field exists but does not match expected value/condition, leaf check status is `failed`.

54. **Existing actual match is passed.** Решение: if checked actual field exists and matches expected value/condition, leaf check status is `passed` and `expected.passed = true`.

55. **RequirementResult status aggregation.** Решение: `RequirementResult.status` is aggregated from leaf checks: if any leaf is `error` then result is `error`; otherwise if any leaf is `failed` then result is `failed`; otherwise if all leaves are `passed`/`skipped` then result is `passed`.

56. **Optional affects gate only.** Решение: `optional: true` does not change `RequirementResult.status`. Optional failed/error results remain failed/error, but workflow/gate can continue and show warning.

57. **Skipped stays in RequirementResult.** Решение: `skipped` remains a valid `RequirementResult.status` only when workflow/policy explicitly skipped the requirement. Policy syntax is not fixed here.

58. **Skipped checks mirror structure.** Решение: if requirement is skipped, `checks` still mirrors requirement structure and leaf checks receive `status: skipped`; do not replace checks with empty `{}`.

59. **Skipped expected is null.** Решение: for skipped leaf check, `expected = null` and `actual = null` because condition was not evaluated.

60. **Error expected passed is null.** Решение: for error leaf check, `expected.passed = null` while `expected.value` remains the expected value/condition from YAML if known.

61. **Expected passed by status.** Решение: for passed leaf check, `expected.passed = true`; for failed leaf check, `expected.passed = false`; for error, `expected.passed = null`; for skipped, `expected = null`.

62. **Error actual is kept if available.** Решение: for error leaf check, store `actual` if actual value was obtained but could not be evaluated. If actual was not obtained, `actual = null`.

63. **Summary counts are derived.** Решение: summary counts by status are useful for API DTO/index/read model, but are not part of source-of-truth `RequirementResult`.

64. **Original requirement snapshot lives above result.** Решение: original requirement/blueprint snapshot must not be stored inside `RequirementResult`. Concrete storage field/place is not fixed in this branch.

65. **No requirementVersion in result.** Решение: do not store `requirementVersion` or `blueprintVersion` inside `RequirementResult`. Concrete version/snapshot metadata storage is not fixed in this branch.

66. **No resolvedTargetId in RequirementResult.** Решение: stored `RequirementResult` does not contain internal `resolvedTargetId`. It stores the user/product target name, while target alias to resource id mapping can live above results in run metadata.

67. **No snapshotId/runId in RequirementResult.** Решение: superseded by decisions 88-89. Stored `RequirementResult` contains fact links under `facts`.

68. **No target in RequirementResult.** Решение: superseded by decision 87. Stored `RequirementResult` contains `target`.

69. **Stored RequirementResult is minimal.** Решение: superseded by decisions 87-89. Source-of-truth `RequirementResult` stores `requirementId`, `target`, `facts`, `status`, and mirrored `checks`.

70. **RequirementResult has no own id.** Решение: `RequirementResult` has no separate `id` in v1. It is stored inside parent run collection and identified by `requirementId` there.

71. **Parent collection is RequirementRun.** Решение: parent collection containing `RequirementResult[]` and links to blueprint/facts/targets is called `RequirementRun`.

72. **RequirementRun has aggregate status.** Решение: `RequirementRun` stores aggregate status computed from contained `RequirementResult.status` values.

73. **RequirementRun status is not gate decision.** Решение: `RequirementRun.status` is an honest aggregate of `RequirementResult.status` values, not workflow/gate decision. Optional requirements can be handled by workflow/gate above `RequirementRun`.

74. **No gateStatus in RequirementRun.** Решение: do not store `gateStatus` inside `RequirementRun`. Gate/workflow decision lives above `RequirementRun`.

75. **RequirementRun aggregation rule.** Решение: aggregate `RequirementRun.status` from results as: any `error` -> `error`; else any `failed` -> `failed`; else all `passed`/`skipped` -> `passed`.

76. **All skipped run is skipped.** Решение: if all `RequirementResult.status` values are `skipped`, `RequirementRun.status = skipped`. Mixed `passed` + `skipped` gives `passed`.

77. **No RequirementRun warning status.** Решение: `RequirementRun.status = warning` is not used. Optional failed/error requirements remain failed/error in `RequirementRun`; warning/non-blocking meaning belongs to workflow/gate above it.

78. **RequirementRun timing fields.** Решение: superseded. `RequirementRun` stores one moment, `evaluatedAt`. Оценка требований ничего не читает и никого не ждёт — снимки уже сняты, — поэтому начало и конец были одним и тем же мгновением, записанным дважды.

79. **RequirementRun duration.** Решение: superseded by decision 78. `durationMs` не хранится: он вычислялся из двух копий одного мгновения и всегда был 0.

80. **RequirementRun attempt.** Решение: `RequirementRun` stores `attempt`.

81. **RequirementRun trigger.** Решение: `RequirementRun` stores `trigger`.

82. **RequirementRun profile.** Решение: `RequirementRun` stores `profile`.

83. **RequirementRun purpose.** Решение: `RequirementRun` stores `purpose`.

84. **RequirementRun details.** Решение: `RequirementRun` stores optional `details` for run-level errors/explanations that do not belong to a concrete leaf check.

85. **RequirementRun ignores unrelated FactRun warning.** Решение: if the linked `FactRun` has `warning` because optional/extra facts had issues, but all facts required by requirements evaluated successfully, `RequirementRun.status = passed`. `RequirementRun.status` is computed from `RequirementResult.status`, not from raw `FactRun.status`.

86. **Requirement target is a configured target name.** Решение: `Requirement.target` is the target name from user/product configuration. It can be `host`, `guest`, `vm-1`, `db`, `worker-a`, or any other configured name. It is not necessarily an internal resource id.

87. **RequirementResult stores target.** Решение: stored `RequirementResult` contains `target`, because a result must show which target name this concrete check was executed against.

88. **RequirementResult stores fact links.** Решение: stored `RequirementResult` contains `facts` with exactly the fact links used by this evaluation: `{ "snapshotId": "...", "factRunId": "..." }`.

89. **No factsByTarget in RequirementRun.** Решение: `factsByTarget` is removed from `RequirementRun`. Fact links live in each `RequirementResult.facts`, because the result should be self-contained for UI/API/logs.

90. **RequirementResult is per requirement-target evaluation.** Решение: a stored `RequirementResult` represents one requirement evaluated on one target name using one linked fact snapshot/run.

91. **Requirement target is required.** Решение: if a requirement does not specify `target`, this is a blueprint validation error. UI/templates may prefill a default target, but the requirement engine does not guess one.

92. **Unknown requirement target is validation error.** Решение: if `Requirement.target` is not declared in the blueprint/environment target configuration, this is a blueprint validation error before facts/requirements run.

93. **Inaccessible target stops before requirements.** Решение: if target is declared but cannot be reached through its transport/access layer, `RequirementRun` is not created. This is a preflight/access failure above facts and requirements.

94. **Collector failure becomes requirement error.** Решение: if target access works but a required collector/fact cannot be collected, `FactSnapshot` records the fact as `error`/`unknown`/`unsupported`, `RequirementRun` is created, and matching `RequirementResult`/leaf check status is `error`.

95. **RequirementResult target invariant.** Решение: `RequirementResult.target` must match `Requirement.target` for this evaluation. Mismatch is a bug/invariant violation, not an override.

96. **One requirement target in v1.** Решение: v1 requirement checks exactly one target. No `target: []`, no `targetGroups`, and no implicit fan-out in this model.

97. **Multi-target requirements branch.** Решение: multi-target requirements are moved to a separate open branch in `docs/wiki/grill/product-grill-open-branches.md`.

98. **No collectionId in RequirementResult facts.** Решение: `RequirementResult.facts` stores only `snapshotId` and `factRunId`. Do not store `collectionId` there; collection lookup belongs to the facts model/storage layer.

99. **RequirementRun does not mix fact runs for one target.** Решение: in v1, one `RequirementRun` must not evaluate results for the same target against different `FactRun` ids. Otherwise the run becomes a mixture of different moments in time.

100. **Same target uses same factRunId inside RequirementRun.** Решение: all `RequirementResult` entries for the same `target` inside one `RequirementRun` must reference the same `facts.factRunId`.

101. **Requirement id is unique across source.** Решение: `requirements[].id` must be unique in the whole requirements source, regardless of `target`. Duplicate ids are a blueprint validation error.

## Текущая модель

Example requirement:

```yaml
requirements:
  - id: docker-runtime
    target: guest
    runtimes:
      docker:
        ready: true
        version: ">=24.0.0"
```

Example facts fragment:

```json
{
  "runtimes": {
    "docker": {
      "status": "present",
      "ready": false,
      "version": "23.0.0"
    }
  }
}
```

Example result:

```json
{
  "requirementId": "docker-runtime",
  "target": "guest",
  "facts": {
    "snapshotId": "snap_guest_7",
    "factRunId": "fact_run_9"
  },
  "status": "failed",
  "checks": {
    "runtimes": {
      "docker": {
        "ready": {
          "status": "failed",
          "expected": {
            "passed": false,
            "value": true
          },
          "actual": false,
          "details": {
            "message": "runtime docker ready expected true, got false"
          }
        },
        "version": {
          "status": "failed",
          "expected": {
            "passed": false,
            "value": ">=24.0.0"
          },
          "actual": "23.0.0",
          "details": {
            "message": "runtime docker version expected >=24.0.0, got 23.0.0"
          }
        }
      }
    }
  }
}
```

Example validation error:

```yaml
requirements:
  - id: docker-runtime
    runtimes:
      docker:
        ready: true
```

This is invalid because `target` is missing. The engine does not guess whether this should run on `host`, `guest`, or another target.

Example RequirementRun:

```json
{
  "id": "req_run_1",
  "status": "failed",
  "startedAt": "2026-06-08T10:00:00Z",
  "finishedAt": "2026-06-08T10:00:05Z",
  "durationMs": 5000,
  "attempt": 1,
  "trigger": "manual",
  "profile": "local-vm-preflight",
  "purpose": "preflight",
  "targets": {
    "guest": "vm_123"
  },
  "results": [
    {
      "requirementId": "docker-runtime",
      "target": "guest",
      "facts": {
        "snapshotId": "snap_guest_7",
        "factRunId": "fact_run_9"
      },
      "status": "failed",
      "checks": {
        "runtimes": {
          "docker": {
            "ready": {
              "status": "failed",
              "expected": {
                "passed": false,
                "value": true
              },
              "actual": false
            }
          }
        }
      }
    }
  ],
  "details": {
    "message": "docker-runtime failed"
  }
}
```

## Закрытие ветки

Requirement/check model is closed for v1. The model defines:

- YAML-first `Requirement` items using fact-shaped blocks.
- Required `target` on each requirement.
- `RequirementResult` as one requirement evaluation on one target, with `requirementId`, `target`, `facts`, `status`, and mirrored `checks`.
- `RequirementRun` as the parent run with aggregate status, timing, attempt, trigger, profile, purpose, targets mapping, results, and optional run-level details.
- Requirement evaluation based on normalized facts, not direct command execution.
- Multi-target requirements are not part of this v1 model and remain a separate open branch.
