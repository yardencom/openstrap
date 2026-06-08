# OpenStrap: Local VM flow grill

Создано: 2026-05-24

Статус: closed

## Решения

1. **Первый reference flow.** Решение: provider-neutral abstraction проектируется сразу, но первый полностью рабочий green path - `macOS + UTM`.

2. **Если UTM не установлен.** Решение: guided auto-install. OpenStrap пытается провести установку нормальным способом; где нужны права/ручное подтверждение, показывает шаг и продолжает flow после установки.

3. **VM image/base OS selection.** Решение: пользователь может выбрать OS руками, но у OpenStrap есть opinionated default.

4. **OS/image catalog.** Решение: пользователь видит список `OS -> version -> concrete image` и может указать custom image/URL/file. Источник каталога - TBD research; нужно искать public metadata/API вместо ручного списка, где возможно.

5. **Image support tiers.** Решение: `verified` = full one-click/full automation; `public catalog` = available with capability/check limitations; `custom` = advanced/best-effort, требует metadata и может не пройти checks. One-click показывает verified/recommended, public/custom доступны в advanced.

6. **Minimum image metadata.** Решение: OS family, version, architecture, image format, boot mode, default user/cloud-init support, checksum/signature if available. Для custom image пользователь может заполнить недостающие metadata вручную.

7. **Bootstrap/access model.** Решение: разделять `bootstrap method` и `access transport`.

8. **Linux local VM v1 bootstrap/access.** Решение: основной supported safe path - `cloud-init/NoCloud seed + SSH`.

9. **VPS/cloud analogy.** Решение: local VM flow повторяет обычную VPS/cloud модель: provider creates VM -> attaches image -> metadata/cloud-init -> SSH -> provision/configure. Для local вместо provider metadata service используется `NoCloud seed/config drive`.

10. **Default network mode.** Решение: NAT by default, Bridged advanced. Если local provider API умеет сообщить guest IP / port forwarding / network status, OpenStrap использует provider API.

11. **NAT SSH connection.** Решение: provider-specific best available, но для NAT default - host-side port forwarding.

12. **Local NAT SSH port allocation.** Решение: OpenStrap-managed port allocation. Пользователь выбирает access policy/scope, например `SSH from this host`, а OpenStrap сам выделяет, резервирует и показывает endpoint.

13. **Local VM access scope.** Решение: по умолчанию доступ только с host machine. В advanced можно открыть доступ из LAN. Public internet exposure не входит в первый v1 local flow.

14. **Когда VM считается созданной.** Решение: provider создал VM; OS загрузилась; OpenStrap подключился по SSH; facts собраны; базовые checks прошли; VM видна как OpenStrap Environment со status.

15. **Free local VM lifecycle core.** Решение: create, start, stop, restart, delete, suspend/resume, recreate, resize where supported, view status/logs.

16. **Resize behavior.** Решение: capability-based. Provider adapter объявляет hot/cold CPU/RAM resize, disk grow, recreate required. OpenStrap строит безопасный plan по capabilities.

17. **Delete local VM.** Решение: destructive action требует confirmation и показывает, что будет удалено: VM, disks, generated seed/config, reserved ports, local keys/references, state. Retain disk - advanced option.

18. **Local VM state.** Решение: split state. Control-plane хранит desired state, environment metadata, runs/status. Local runner хранит provider mapping, local paths, port allocations, private key references и provider-specific local state.

19. **SSH private key.** Решение: по workspace policy, но default для local VM = local OS keychain/local secure store. В cloud хранится только reference/metadata, не raw private key. Web работает через local runner.

20. **Если local runner offline.** Решение: Web показывает last known status и предлагает reconnect/start runner через device flow/helper/protocol handler/fallback command. Actions, требующие local execution, disabled до reconnect.

21. **Existing local VMs.** Решение: OpenStrap через provider API обнаруживает их как unmanaged. Пользователь может observe/import/adopt явно. Auto-adopt не делаем.

22. **Import existing local VM.** Решение: staged model: observe/inventory; attach via access для facts/checks/status; full adopt только если provider mapping, access и safety proof достаточны.

23. **Post-create facts/checks.** Решение: default = bootstrap readiness: SSH, OS/arch, CPU/RAM/disk, IP/network, user/sudo, package manager, filesystem write, time sync, DNS/internet, basic security posture. Checks/facts customizable через Blueprint/component/profile.

24. **Failure diagnosis.** Решение: строится из facts + run events + provider errors + logs. Raw details сохраняются, пользователю показывается normalized diagnosis category и remediation.

25. **Local VM remediation.** Решение: free/default = показать причину, logs/details и что нужно сделать. Paid/ops = safe explicit remediation actions. Auto-remediation не входит в v1 default.

26. **Local VM logs/status.** Решение: CLI + Web mirrored. CLI показывает live progress, Web показывает тот же run status/logs через control-plane. Local raw details доступны через runner.

27. **Offline mode.** Решение: partial offline CLI. CLI может создать/управлять local VM локально, а sync с Web/control-plane происходит позже. Full offline product - self-hosted/roadmap.

28. **Offline local VM sync.** Решение: import/sync later. После login/device flow CLI отправляет desired metadata, environment summary, run history/status и references. Sensitive local secrets остаются локально.

29. **Source of truth после sync.** Решение: control-plane хранит desired state/revisions/status, но execution authority остается у local runner. Runner владеет provider mapping, local paths, port allocations, private key references и local secrets.

30. **Web actions for local VM.** Решение: Web создает Run в control-plane, local runner забирает и исполняет локально, стримит status/logs. Fallback - CLI command copy/paste.

31. **Local runner mode.** Решение: hybrid. CLI commands работают on-demand. Для Web actions/live status нужен runner/companion, который может запускаться вручную/автоматически.

32. **Local runner autostart.** Решение: optional setup. OpenStrap предлагает включить автозапуск companion, но не требует.

33. **Local runner updates.** Решение: managed updater через выбранный install channel. Forced/blocking updates только для incompatible или security-critical случаев.

34. **CLI/local runner install channels.** Решение: OS-native channels. Для первого `macOS + UTM` green path: Homebrew, binary download, install script. Windows winget/PowerShell и Linux packages/install script - дальше. App-like installer/helper для protocol handler/daemon setup - optional/roadmap.

35. **UTM install/check on macOS.** Решение: guided install через Homebrew cask, если Homebrew доступен. Если Homebrew нет - fallback на official download/instruction. OpenStrap не бандлит UTM.

36. **Homebrew install.** Решение: guided optional install. OpenStrap показывает, что будет выполнено, и требует подтверждение. Без согласия - fallback manual instruction/download. Автоматически без подтверждения не ставим.

37. **Other local providers on macOS.** Решение: detect + show unsupported/roadmap. Full automation first = UTM. VMware/VirtualBox/Parallels можно показывать как detected providers; import/observe where possible. Full support for all installed providers - roadmap.

38. **VM/environment name.** Решение: auto-name + editable.

39. **VM size.** Решение: presets Small/Medium/Large с recommended default. Advanced custom CPU/RAM/disk разрешен.

40. **Default VM preset.** Решение: host-aware recommendation. OpenStrap собирает host facts: CPU/RAM/disk/free space/virtualization support и рекомендует Small/Medium/Large. Пользователь может изменить.

41. **Host resource checks.** Решение: errors/warnings показываются, но создание не блокируется автоматически. User может продолжить, видя риск. Hard block только если действие технически невозможно выполнить вообще.

42. **Host facts.** Решение: host facts - часть обычной facts model с target/context для host. Preflight/resource checks используют эти facts.

43. **Target для local VM flow.** Решение: primary target = guest VM. Environment = VM. Host вторичен: нужен для provider execution и preflight, но не является managed target/environment.

44. **Host facts в local VM flow.** Решение: host не managed target/environment. Host facts хранятся/используются как execution context для run/provider execution. Guest VM остается primary target.

45. **Local VM Environment resource model.** Решение: один primary Resource = VM. Disk, network mode, port forwarding, seed/config disk, image, provider config - это VM resource config/artifacts, не отдельные product resources.

46. **Seed/config disk.** Решение: ephemeral generated artifact. После успешного bootstrap detach/delete. Desired state хранит VM/bootstrap config, а не отдельный seed artifact. Raw seed можно временно держать только для failed run/debug по retention policy.

47. **Image cache.** Решение: OpenStrap-managed local cache с checksum/version metadata, cleanup policy и user settings. Пользователь может настроить size/retention/cleanup.

48. **Image cache scope.** Решение: hybrid. Control-plane хранит image refs/versions/metadata. Physical cache находится на local runner machine.

49. **Image catalog updates.** Решение: existing environment остается pinned на image/version. OpenStrap может показать `update available`, но не обновляет и не пересоздает VM автоматически.

50. **OS updates/patching.** Решение: не часть free lifecycle. В free пользователь сам обновляет OS. Explicit package update action и managed patching/schedules/reports - paid ops.

51. **Local VM snapshots/backups.** Решение: не входят в free lifecycle. Это paid operations pack. Возможный limited/manual snapshot - roadmap/TBD, но не v1 free core.

52. **Local VM monitoring.** Решение: free core = basic status, last run, last checks. Metrics history, alerts, SLO/monitoring pack - paid.

53. **Recreate local VM.** Решение: default = delete + create from current desired state using pinned image/config. Advanced can retain/preserve disk where supported.

54. **Post-action facts/checks.** Решение: после restart/recreate OpenStrap по умолчанию ждет access и обновляет facts/checks/status. Advanced/profile может отключить expensive checks.

55. **Create-only local VM.** Решение: advanced/limited mode. Обычный flow = managed: create VM, bootstrap/access, facts/checks/status. Create-only создает VM без OS-level management и имеет limited/unmanaged status.

56. **Create-only -> managed path.** Решение: attach via access. Пользователь добавляет SSH/access, OpenStrap собирает facts/checks и переводит VM в attached/managed where possible.

57. **Custom ISO.** Решение: default = create-only/manual install. Full automation только через verified automated install profiles, например autoinstall/preseed/kickstart where supported.

58. **Windows local VM v1.** Решение: create-only support, без full managed bootstrap. Full Windows support через unattend + WinRM + drivers/activation - roadmap.

59. **Local VM mode.** Решение: поддержать server/headless и desktop/headful modes. Desktop mode означает GUI console/display и другие defaults. Server/headless остается основной automation path.

60. **Desktop/headful management.** Решение: depends on OS/image/profile. Linux desktop verified image can be managed via cloud-init + SSH. Custom/Windows desktop can be create-only/limited.

61. **Desktop VM console/display access.** Решение: basic open console/provider display action входит в free lifecycle/access. Full remote desktop/VNC/RDP through OpenStrap - paid/roadmap.

62. **Где фиксировать Local VM flow decisions.** Решение: только отдельный файл `docs/wiki/grill/local-vm-flow-grill.md`.

63. **UI/CLI steps for managed local VM create.** Решение: basic flow = один экран/команда с defaults и review. Advanced flow = wizard/settings: provider, OS/image, size, network/access, review. CLI может иметь `openstrap vm create --local` без YAML.

64. **Review/plan before create local VM.** Решение: короткий review показывается всегда: provider, image, size, disk, network/access, estimated download/cache, что будет создано. Full plan/details доступны в advanced.

65. **Hard blocks on local VM create review.** Решение: create блокируется только если действие технически невозможно: provider отсутствует и пользователь отказался установить, image недоступен, нет места для disk, нет virtualization support, невозможно выделить endpoint. Остальные errors/warnings показываются как риск и могут быть overridden.

66. **Successful create screen.** Решение: показывать working environment summary: status, name, provider, OS, size, IP/SSH endpoint, access actions, last checks, next actions.

67. **Post-create next actions.** Решение: показывать lifecycle + access + attach component actions: open terminal/SSH, open console, copy endpoint, install Docker, add component, run checks. Paid ops показывать secondary, не как главный следующий шаг.

68. **Docker after VM create.** Решение: Docker не является обязательной частью чистого VM create. Basic VM создается clean; templates вроде `Docker VM` или `AI Agent Environment` могут включать Docker component. Детализация components out of scope для текущего Local VM flow.

69. **CLI create command naming.** Решение: использовать product-style create commands: `create:local`, `create:remote`, `create:ip`. Для текущего Local VM flow основная команда - `openstrap create:local`. `create:ip` означает создать/подготовить окружение на заданном IP, а не discover/attach.

70. **`create:local` default CLI behavior.** Решение: без аргументов `openstrap create:local` запускает interactive review: defaults -> review -> confirm -> create. Для automation/CI поддержать flags и `--yes`.

71. **Partial failure cleanup.** Решение: если `create:local` падает посередине, OpenStrap показывает failed run и что успело создаться. Default - safe cleanup only for artifacts OpenStrap точно создал и может безопасно удалить. Пользователь может выбрать retain failed VM/artifacts for debug.

72. **Failed retained VM visibility.** Решение: если failed create retained for debug, OpenStrap показывает limited Environment/VM со status `failed`/`not ready`. Доступные actions: open console, retry bootstrap, cleanup/delete. Такая VM не считается successful managed create.

73. **Retry bootstrap behavior.** Решение: retry bootstrap is plan-based. OpenStrap выбирает safe retry по состоянию: retry SSH wait, regenerate seed + reboot, restart VM, или recreate if state unknown.

74. **Local VM run steps visibility.** Решение: UI/CLI показывают compact stepper для create flow: check host, check/install provider, resolve image, download/cache image, create VM, attach seed/network, boot VM, wait SSH, collect facts, run checks, mark ready. Каждый step имеет success/fail и expandable details/logs.

75. **Stepper abstraction level.** Решение: основной stepper domain-level, например download image/create VM/boot/wait SSH. Provider-specific commands/details/logs раскрываются внутри соответствующего шага.

76. **Local run logs/artifacts retention.** Решение: хранить по retention policy. Local raw logs/artifacts - по local retention settings; control-plane хранит summary/status по workspace policy. Paid/support может держать diagnostics дольше при consent.

77. **Local provider state source.** Решение: desired state хранится в OpenStrap, actual state читается из local provider API/CLI. Если UTM/provider state расходится с OpenStrap desired, OpenStrap показывает drift.

78. **Local VM drift scope.** Решение: drift includes both provider/config drift and guest/runtime OS state drift. Provider/config drift: CPU/RAM/disk/network/image/access/port forwarding/VM missing/manual delete/manual rename. Guest/runtime drift: OS/runtime state differs from desired checks/components/policies. Guest/runtime drift вычисляется через facts/checks/component status.

79. **Local VM drift detection triggers.** Решение: free/core запускает drift detection on environment open, after actions, and manual refresh/check. Scheduled background drift detection - paid/optional ops behavior.

80. **Local VM drift actions.** Решение: при manual/provider drift OpenStrap предлагает adopt change as new desired revision или reapply OpenStrap desired. Auto-rollback без explicit action не делаем.

81. **Manually deleted local VM.** Решение: если VM удалили вручную в provider, OpenStrap показывает missing drift и actions: recreate from desired, detach/remove from OpenStrap, view last known state/logs. Auto-recreate не делаем.

82. **Detach/delete/remove missing semantics.** Решение: `Detach` = OpenStrap перестает управлять, VM остается в provider. `Delete` = удалить VM/provider artifacts. `Remove missing record` = убрать запись OpenStrap, если VM уже нет.

83. **Detached local VM behavior.** Решение: после detach VM не имеет lifecycle actions в OpenStrap. Если provider discovery видит VM, она показывается как unmanaged/observe-only и может быть imported/adopted again.

84. **UTM reference adapter capabilities.** Решение: UTM reference adapter должен стремиться покрыть full local VM capabilities, включая provider detection, list VMs, create VM, attach image, attach seed/config, configure network/port forwarding where supported, start/stop/restart/delete, read status, open console, read provider metadata, snapshots and guest tools where available. Adapter capability does not mean feature is free/product-exposed by default.

85. **Capability vs product access.** Решение: adapter честно объявляет technical capabilities. Product UI/business logic решает доступность action по policy/entitlement. Все элементы могут быть видны, но gated/disabled с причиной, если недоступны текущему пользователю/plan/policy.

86. **Local host permission review.** Решение: перед run показывать permission/action review для local runner: download image, create VM in provider, reserve local port, store SSH key locally, delete VM/artifacts where applicable. Install Homebrew/UTM requires separate explicit confirm.

87. **Local provider adapter trust.** Решение: v1 local provider adapters are official/trusted by default, starting with UTM. Third-party adapters are roadmap and require signing/trust/permissions gating.

88. **UTM adapter integration tests.** Решение: использовать macOS CI runner where possible плюс manual/local integration suite against real VMs. Unit mocks alone are not enough.

89. **Generic local provider contract tests.** Решение: core contract test covers detect, image resolve/cache, create, boot, access, facts/checks, restart, stop/start, resize capability check, drift check, delete cleanup. Paid ops/capabilities have separate capability tests.

90. **Local VM flow closure artifacts.** Решение: для закрытия ветки нужны decisions document + concrete CLI/Web scenarios. Минимальный набор сценариев: successful create, failed create/diagnostics, import/adopt existing VM. Minimal schema sketch не требуется в этой ветке; schema относится к отдельным веткам.

91. **Web first-run local runner flow.** Решение: если пользователь в Web жмет `Create Local VM`, а runner/CLI не установлен или не привязан, Web запускает guided pairing flow: install CLI -> login/device code -> runner connected -> continue create. Если helper/protocol handler есть, Web пытается открыть его. Copy/paste install command остается fallback.

92. **Offline-created VM sync policy mismatch.** Решение: если offline-created VM после sync конфликтует с workspace policy, sync allowed as non-compliant/limited. Environment получает status `policy violation`/`needs review`; actions ограничены до исправления/adopt policy. Policy не переписывает VM автоматически.

93. **Image checksum/signature policy.** Решение: verified images require checksum/signature where available. Custom/public images without checksum/signature are allowed only in advanced mode with explicit warning.

94. **Local VM SSH key rotation/revoke.** Решение: manual rotate/revoke action is free/core access behavior: OpenStrap can generate a new key, update `authorized_keys`, and remove old key where access works. Scheduled rotation is paid/ops.

95. **Lost/broken SSH access recovery.** Решение: OpenStrap показывает recovery plan: open provider console, mount/regenerate seed if possible, reset `authorized_keys` if safe, иначе recreate. Автоматический guest-tools recovery не является default.

96. **Team actions on local VM.** Решение: другой пользователь workspace может инициировать action из Web, если permissions/policy allow, но исполнение идет через local runner на host machine. Direct cloud-to-VM access невозможен; audit/permissions применяются на control-plane and runner boundary.

97. **Local approval policy for remote-initiated runs.** Решение: local runner/host owner can set approval policy: auto-accept allowed workspace actions or require local approval for destructive/privileged actions. Это защищает личную host machine без полного запрета team workflows.

98. **Default environment class for local VM.** Решение: local VM default environment class = `dev/lab` or similar non-production class. Advanced/user can change class, but UI should not imply production readiness by default.

99. **Production local/on-prem boundary.** Решение: `create:local` v1 covers dev/lab local VM flow. Production local/on-prem/edge is a separate roadmap flow, not part of this closed Local VM flow.

100. **Local VM image architecture policy.** Решение: supported path uses native host architecture: Apple Silicon -> arm64/aarch64 images, Intel Mac -> x86_64 images. Cross-architecture emulation is advanced/best-effort with warning, not first green path.

101. **Images without cloud-init support.** Решение: managed Linux create requires cloud-init/NoCloud support. If image does not support cloud-init, managed create is blocked, but advanced create-only mode is allowed with limited status.

102. **Default Linux VM user.** Решение: default managed user is `openstrap`, created via cloud-init with controlled sudo policy. Advanced can change username. Image default user is not the primary access contract.

103. **Managed Linux VM security baseline.** Решение: безопасность включена по умолчанию, а не как premium/later option. Managed Linux local VM bootstrap uses cloud-init/NoCloud, key-only SSH transport, no password-based transport, dedicated managed user, disabled/avoided root SSH login, controlled privileges, and explicit security review in create flow.

104. **Managed Linux VM privilege model.** Решение: OpenStrap v1 uses standard cloud/datacenter privilege model: cloud-init + key-only SSH + managed user + sudo/Ansible become for declared privileged actions + run/audit. No custom maintained wrappers/scripts for granular root in v1.

105. **Managed vs restricted local VM privilege profile.** Решение: two explicit modes. `Managed VM` = sudo/become enabled for declared privileged actions and shown in review; this is default for normal `create:local`. `Restricted VM` = no sudo/become, only user-level actions, limited automation.

106. **Managed VM permission summary.** Решение: create review shows permission/security summary with expandable details: SSH key-only, root SSH off, password login off, managed user, sudo/become enabled, audit enabled, and classes of actions requiring privileges.

107. **Restricted VM status.** Решение: `Restricted VM` is limited managed: SSH/facts/checks can work, but privileged actions/components are disabled with reason. It is not create-only.

108. **SSH hardening baseline.** Решение: for managed/restricted Linux local VM, cloud-init configures key-only SSH, password SSH disabled, and root SSH disabled/avoided by default. Advanced override is explicit warning/non-compliant.

109. **Local VM privileged action audit storage.** Решение: split audit. Local runner writes local audit/run log; when online it syncs audit summary/events to control-plane. Sensitive raw details remain local according to policy.

110. **Application secrets during base local VM create.** Решение: base `create:local` does not pass application secrets into guest via cloud-init/seed. Secrets are introduced later by component/app deployment stage through secret references. Advanced insecure secret injection is out of scope for clean local VM flow.

111. **Private key in seed/config.** Решение: seed/config never contains private key. It contains public key and bootstrap config only. Private key remains in local secure store/keychain.

112. **Public key in desired state.** Решение: public key and fingerprint can be stored in desired state/control-plane metadata for drift/recovery/rotation. Private key is never stored there.

113. **SSH hardening verification.** Решение: post-create checks verify SSH/security baseline where possible: key login works, password login disabled, root SSH disabled/avoided, managed user exists, selected privilege profile is applied.

114. **SSH/security baseline failure severity.** Решение: explicit baseline violation, such as password login enabled or root SSH enabled against policy, makes managed/restricted create failed/not ready. Checks that cannot be determined are warning/unknown.

## Сценарии

### 1. Successful `create:local`

1. Пользователь запускает `openstrap create:local` или жмет `Create Local VM` в Web.
2. OpenStrap проверяет local runner. Если runner есть - продолжает. Если нет - предлагает запустить/install CLI.
3. OpenStrap собирает host execution context: OS/arch, CPU/RAM/free disk, virtualization support, installed local providers, image cache state.
4. OpenStrap выбирает defaults: provider UTM, recommended verified Linux image, host-aware size preset, NAT network, SSH access from this host, `Managed VM` privilege profile.
5. Пользователь видит короткий review: что будет создано, что будет скачано, какой provider используется, какие local actions нужны, какие warnings есть, и security/permission summary: key-only SSH, password SSH off, root SSH off, managed user, sudo/become for declared privileged actions, audit.
6. Пользователь подтверждает.
7. OpenStrap скачивает pinned image или берет его из cache.
8. OpenStrap генерирует keypair и cloud-init/NoCloud seed with SSH hardening, managed user and selected privilege profile.
9. OpenStrap создает VM в UTM: disk/image, CPU/RAM, NAT, managed SSH port, seed/config.
10. OpenStrap запускает VM.
11. OpenStrap ждет SSH.
12. OpenStrap подключается по SSH.
13. OpenStrap собирает facts/checks bootstrap readiness and verifies SSH/security baseline where possible.
14. OpenStrap detach/delete ephemeral seed после успешного bootstrap.
15. OpenStrap сохраняет desired state/control-plane metadata, local runner state and local audit/run log.
16. OpenStrap показывает successful environment summary: status ready, OS/image, size, provider, SSH endpoint, open console, lifecycle actions, last checks, next actions.

### 2. Failed `create:local` / diagnostics

1. Пользователь запускает `openstrap create:local`.
2. OpenStrap проходит review/confirm.
3. Run падает на одном из этапов: provider install/check, image download/cache, VM create, boot timeout, SSH timeout, cloud-init failed, facts/checks failed, security baseline failed.
4. OpenStrap показывает failed run stepper: какой шаг упал, normalized diagnosis, raw details/logs expandable.
5. OpenStrap показывает, что уже создано: downloaded image, VM, disk, port reservation, seed/config, key reference.
6. OpenStrap предлагает free/default actions: посмотреть причину, открыть logs/details, открыть provider console/app, cleanup/delete created artifacts, retain failed VM/artifacts for debug.
7. Если пользователь выбирает retain, VM появляется как limited Environment со status `failed/not ready`.
8. Для limited VM доступны: open console, retry bootstrap, cleanup/delete.
9. `retry bootstrap` строит plan: retry SSH wait, regenerate seed + reboot, restart VM или recreate if state unknown.
10. Paid/ops может дать дополнительные remediation buttons, но default/free не чинит автоматически.

### 3. Import/adopt existing local VM

1. OpenStrap/runner обнаруживает existing VMs через provider API/CLI.
2. В UI/CLI они показаны как `unmanaged`.
3. Пользователь выбирает VM и action: `observe`, `attach via access`, `adopt`.
4. `Observe`: OpenStrap показывает provider metadata/status; lifecycle недоступен; VM остается unmanaged/observe-only.
5. `Attach via access`: пользователь дает SSH/access данные; OpenStrap подключается; собирает facts/checks/status; VM получает attached/limited management level.
6. `Adopt`: OpenStrap проверяет provider mapping, access, capabilities, safety proof. Если доказать безопасное управление нельзя, full lifecycle запрещен и показывается причина. Если можно, создается desired revision, VM становится managed.
7. После import/adopt UI показывает management level и доступные actions.
8. Detach позже убирает управление OpenStrap, но VM остается в provider.
