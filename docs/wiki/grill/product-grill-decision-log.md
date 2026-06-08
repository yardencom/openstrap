# OpenStrap: журнал продуктовых решений

Создано: 2026-05-22

Это сжатый журнал решений по продуктовой grill-me сессии. Это не дословная стенограмма: повторяющиеся, устаревшие и неясные ветки сведены к текущему пониманию продукта.

## Решения

1. **Кто первый покупатель?** Решение: описание продукта не должно начинаться с buyer-first рамки. Позже GTM сужается до первых прямых продаж AI-стартапам/product-командам и SMB, затем enterprise/retail.

2. **Инструмент для операторов или self-service платформа?** Решение: оба слоя. У OpenStrap есть operator layer и self-service layer.

3. **Какой первый конкретный результат?** Решение: окружение для бизнес-приложений: серверы, Kubernetes где нужен, агенты, базы данных и поддерживающие сервисы.

4. **Kubernetes-first или server-first?** Решение: вопрос заменен более точной моделью. Продукт environment-first; VM может быть самым простым environment.

5. **Какие первые две кнопки каталога?** Решение: `Create dedicated/shared VM` и `Create safe AI-agent environment`.

6. **VM ниже Environment или VM и есть Environment?** Решение: VM является Environment. Более сложные environments состоят из нескольких ресурсов/компонентов.

7. **Что делает environment managed?** Решение: core lifecycle бесплатный/базовый; access, observability, security, patching, compliance и support являются premium.

8. **Кто владеет аккаунтом у провайдера?** Решение: оба режима. BYOP для клиентов со своим provider account и managed/reseller cloud через OpenStrap.

9. **Какой минимальный provider contract?** Решение: не заставлять всех провайдеров соответствовать одному "минимальному" контракту. Использовать provider maturity tiers и поэтапные capabilities.

10. **Может ли v1 опираться на подготовленный provider workspace?** Решение: да для BYOP cloud. Для managed-клиентов OpenStrap/партнерам может понадобиться настроить account, project, network, security и т.д.

11. **Локальные VM сначала production target или dev/demo/lab?** Решение: локальные VM сначала dev/demo/lab; production local/on-prem/edge - roadmap.

12. **Какой первый пользовательский путь должен быть отполирован?** Решение: local lab плюс managed-service путь сначала; BYOP cloud self-service после market/provider discovery.

13. **Что такое Blueprint?** Решение: provider-independent описание желаемого environment, ресурсов, requirements, policies и компонентов OpenStrap.

14. **Пользователь редактирует Blueprint через UI или YAML?** Решение: UI сначала. YAML - advanced/export/import/GitOps режим для power users.

15. **Wizard или visual canvas?** Решение: wizard сначала, YAML advanced, visual canvas позже.

16. **Blueprint описывает только provisioning или еще operations?** Решение: модель должна поддерживать operations, но free core - это lifecycle; operational features монетизируются как premium.

17. **Lifecycle бесплатный навсегда?** Решение: BYOP lifecycle бесплатный навсегда. Managed/reseller cloud монетизируется через margin/commission.

18. **Какой первый платный апгрейд?** Решение: Managed Operations / Production-ready Pack.

19. **Есть ли поддержка в free BYOP?** Решение: premium support нет. Issues разбираются best-effort только при наличии ресурсов.

20. **Merchant of record или referral/partner layer?** Решение: hybrid. Enterprise может использовать direct provider contracts/BYOP; SMB/managed может платить OpenStrap; provider commissions желательны.

21. **SaaS, self-hosted или hybrid control plane?** Решение: hybrid. SaaS для SMB/startups; self-hosted/isolated для enterprise позже.

22. **Где выполняются действия?** Решение: SMB SaaS может выполнять действия через provider connection/service account. Runner/local execution нужен для local, on-prem, enterprise и strict BYOP.

23. **Как создаются service accounts/provider connections?** Решение: в v1 клиент создает по инструкции или OpenStrap/партнер помогает в managed mode. Идеал в будущем - provider-native automatic connection flow.

24. **Должны ли provider maturity tiers быть официальной моделью?** Решение: да. Tiers честно показывают глубину автоматизации.

25. **Provider-first или outcome-first UI?** Решение: оба. `Create Resource` - provider-first; `Create Solution` - outcome-first.

26. **Что входит в AI-agent environment v1?** Решение: конструктор с начальным opinionated stack, который постепенно раскрывается до конфигурируемого выбора компонентов.

27. **Кто автор компонентов/шаблонов?** Решение: v1 только official OpenStrap; v2 trusted partners с commission/revenue share.

28. **Что такое Component?** Решение: OpenStrap Component Spec поверх executors/tools, с inputs, outputs, requirements, lifecycle, permissions и implementation.

29. **Нужна ли компонентам permissions/trust model?** Решение: да, особенно до появления partner/private components.

30. **Что такое privileged component?** Решение: компонент, выполняющий внешние tools/code, например Ansible, Terraform, Helm, shell, vendor installers. Требует trust, permissions, plan где возможно, и audit.

31. **Откуда берется privileged playbook/script?** Решение: из signed/versioned component package, а не из произвольного локального пути. В v1 privileged components только official.

32. **Нужно ли выводить permissions сканированием YAML/playbooks?** Решение: нет. Permissions декларируют авторы компонентов; scanning/plan - best-effort lint, а не security boundary.

33. **Какие executors в v1?** Решение: native actions + Docker/Compose + ограниченное использование Ansible; Terraform/OpenTofu/Helm - roadmap.

34. **Что такое "Ansible-lite"?** Решение: не продуктовый термин. Значит Ansible как внутренний executor для official bootstrap/facts/config tasks, не AWX-like платформа.

35. **Почему Linux?** Решение: v1 official target OS - Linux, но архитектура OS-aware для Windows/macOS/custom roadmap.

36. **Где живут fact requirements?** Решение: компоненты объявляют потребности; blueprint агрегирует. Позже уточнено: requirements primary, facts optional.

37. **Raw facts или normalized facts?** Решение: оба. Raw facts для debug/support; normalized facts/context для component contracts и checks.

38. **Кто собирает facts?** Решение: hybrid collectors за нормализованной моделью OpenStrap: local probes, provider APIs, remote host tooling, runtime checks.

39. **Нужно ли вести свой список facts?** Решение: да, маленькую версионируемую normalized fact schema, которая растет только из official components/policies.

40. **Facts являются preflight gates?** Решение: нет. Facts - observed state. Requirements/preflight gates - отдельные проверки по context/facts.

41. **Храним desired state, actual state или оба?** Решение: оба, плюс drift/diff.

42. **Где хранится desired state?** Решение: в DB "по методу Git": immutable revisions/commits, diffs, rollback/revert history.

43. **Изменения применяются сразу или через plan/apply?** Решение: OpenStrap считает product-level plan; executor-level plans прикладываются, где доступны.

44. **Run model: linear jobs или reconcile loop?** Решение: v1 explicit runs/jobs; roadmap reconciler/drift/auto-remediation.

45. **MVP target set?** Решение: local provider точно; cloud adapter только после market/provider discovery.

46. **Какой сигнал оправдывает первую cloud-интеграцию?** Решение: 5-10 заинтересованных команд, 2-3 pilot commitments, ясная монетизация, automation API, ясный use case, partnership/channel potential.

47. **Какой local provider первый?** Решение: сначала LocalProvider abstraction; конкретный reference adapter позже.

48. **Fake/simulator provider?** Решение: нет product-level fake provider. Тестирование должно использовать реальные VM integration tests; unit mocks отдельно.

49. **Как тестировать providers?** Решение: generic provider contract tests плюс provider-specific integration tests.

50. **Должны ли provider adapters объявлять capabilities?** Решение: да. Capabilities управляют тестами, доступностью в UI и planning.

51. **Technical vs product capabilities?** Решение: technical capabilities - source of truth; product-facing availability выводится для UI.

52. **Скрывать unsupported options или показывать disabled с причиной?** Решение: v1 показывает доступные/рекомендованные варианты; advanced capability matrix с причинами - roadmap.

53. **Assisted/import mode для unsupported providers?** Решение: да как часть BYOP: import existing VM, assisted setup или paid custom integration.

54. **Главный moat?** Решение: порядок приоритета - Component/Blueprint catalog, Operations layer, Marketplace/partner ecosystem, затем Provider adapters.

55. **Первые official components и blueprints?** Решение: components: Linux VM, Docker runtime, PostgreSQL, reverse proxy/TLS endpoint, monitoring/basic health. Blueprints: dedicated/shared VM, AI-agent environment basic.

56. **Default AI agent runtime?** Решение: TBD. Blueprint должен позволять plug-in runtime.

57. **AI environment: готовое решение или инфраструктурная база?** Решение: v1 ближе к working infrastructure base; roadmap движется к ready business solution.

58. **Security baseline в free/core?** Решение: TBD как отдельный workstream. Принцип: free product не должен создавать опасные environments.

59. **Что доказывает ядро продукта?** Решение: end-to-end vertical slice: UI/CLI -> provider setup -> local VM -> bootstrap -> facts -> component -> status -> lifecycle.

60. **Должна ли настройка local provider быть автоматизирована?** Решение: да. OpenStrap должен быть единой точкой входа; local provider prerequisites устанавливаются/проводятся автоматически, где возможно.

61. **Форма клиента в v1: CLI, web, desktop, mobile?** Решение: CLI + Web. Desktop/mobile - roadmap.

62. **Как Web говорит с local CLI?** Решение: authenticated runner polling/subscription плюс localhost bridge, не только copy-paste command.

63. **Как связывать Web и CLI?** Решение: GitHub CLI style device flow.

64. **CLI mode: command или runner?** Решение: оба. Web button должен запускать CLI/local companion при необходимости.

65. **Как Web button может запустить CLI?** Решение: future helper/protocol handler; v1 binary с design path и fallback command.

66. **Тип installer в v1?** Решение: начать с CLI binary; helper/protocol handler дальше.

67. **Каналы установки CLI?** Решение: несколько каналов: install script, Homebrew/macOS, binary download; Windows/winget/PowerShell - roadmap.

68. **Технология CLI/local runner?** Решение: Node/TypeScript.

69. **Технология backend/web?** Решение: TypeScript-first, потому что операции - это orchestration/state/integration, а не CPU-heavy workloads.

70. **Backend architecture: monolith или microservices?** Решение: microservices в monorepo.

71. **Service boundaries?** Решение: environment-service, run-service, provider-service, facts-service, catalog-service, плюс другие product services позже.

72. **Service communication?** Решение: точный split TBD, но Kafka обязательна.

73. **Kafka events: domain или logs?** Решение: отдельные domain events, execution logs и audit streams.

74. **Primary storage?** Решение: Postgres primary state + Kafka event backbone.

75. **Rollback model в v1?** Решение: snapshot/restore или destroy/recreate где возможно; best-effort только где неизбежно.

76. **Долгосрочный идеал rollback?** Решение: Flux-like desired state reconciliation.

77. **Форма reconciler?** Решение: иерархия: EnvironmentController -> ComponentControllers -> ProviderControllers.

78. **Rollback/revert semantics?** Решение: immutable history. Rollback/revert создает новую desired-state revision.

79. **Blueprint/component graph model?** Решение: DAG плюс reconciler.

80. **Edge-triggered или periodic reconcile?** Решение: не изобретать custom mode; использовать standard level-based reconciler semantics с events/resync как triggers.

81. **Выбор workflow/runtime engine?** Решение: не custom и пока не выбран. Candidate runtimes остаются TBD.

82. **Blueprint compiler?** Решение: да. Blueprint -> OpenStrap Plan -> runtime-specific execution artifact.

83. **Plan representation?** Решение: Plan должен иметь human-readable и machine-readable views. Точная структура TBD.

84. **One-click vs plan/apply UX?** Решение: primary action всегда доступна. Details/plan - progressive disclosure.

85. **Когда все равно требуется confirmation?** Решение: destructive actions, high cost, public exposure/firewall, secrets access, privileged components, enterprise policies.

86. **Как показывать premium в UI?** Решение: не блокировать Create. Premium - post-create upgrade path: "make production-ready".

87. **Первый paid pack?** Решение: monitoring/alerts, backups/snapshots, access/team permissions, security checks/hardening baseline, support/SLA.

88. **Billing unit?** Решение: hybrid: free BYOP lifecycle; managed/reseller cloud margin/commission; org plan + per environment/resource; enterprise custom.

89. **Первые GTM channels в Казахстане?** Решение: direct sales и developer-led/free BYOP. Cloud/data center partnerships важны, но медленные. AI/SI partners - TBD.

90. **Первый direct-sales segment?** Решение: AI startups/product teams и SMB сначала; telco/enterprise/retail позже.

91. **Customer pain language?** Решение: нет DevOps/времени, желание AI/agents "как у продвинутых команд" без понимания инфраструктуры, усталость от ручной настройки cloud/server.

92. **Landing/message decisions?** Решение: низкий приоритет сейчас; ранний messaging предварительный и не должен управлять архитектурой.

93. **Provider adapters: core или plugins?** Решение: provider adapters являются plugins/packages с самого начала.

94. **Plugin execution isolation?** Решение: v1 trusted plugins могут выполняться in-process; third-party/partner plugins roadmap - isolated/out-of-process.

95. **Scope plugin system?** Решение: долгосрочно providers, components, executors, fact collectors. v1 фокусируется на providers и official components/spec.

96. **Plugin/component distribution?** Решение: npm packages primary в v1; Git/private repos, OCI, signing/provenance позже.

97. **Pin plugin/component versions?** Решение: да, environment revisions включают pinned versions/lockfile.

98. **Как обновлять existing environments?** Решение: v1 manual "upgrade available"; roadmap policy-based patch/minor/major behavior.

99. **Export lockfile?** Решение: да. Advanced/GitOps export должен включать `openstrap.yaml` и `openstrap.lock.yaml`.

100. **Secrets storage?** Решение: hybrid by workspace policy: OpenStrap encrypted secrets для SMB, customer Vault/provider/self-hosted для enterprise, OS keychain/local store для local.

101. **Получают ли plugins/components raw secrets?** Решение: нет. Они получают secret references; raw resolution происходит только внутри trusted execution boundary.

102. **Execution log redaction?** Решение: automatic redaction обязательна.

103. **Audit baseline?** Решение: audit - отдельный TBD workstream, но должен быть частью архитектуры с первого дня.

104. **Workspace roles?** Решение: owner, admin, operator, viewer. Developer role объединена с operator.

105. **Account hierarchy?** Решение: Organization -> Workspace -> Environment. Partner/reseller tenant layer позже.

106. **Environment ownership?** Решение: один environment принадлежит одному workspace.

107. **Workspace boundary?** Решение: workspace scopes provider connections, secrets, policies, budgets, environments, runs и facts.

108. **Provider connection scope?** Решение: v1 workspace-scoped.

109. **Secret scope?** Решение: v1 workspace-scoped.

110. **Multi-provider environment?** Решение: модель поддерживает; v1 UI может упростить до single-primary-provider.

111. **Cost estimate?** Решение: rough estimate в v1; detailed FinOps - roadmap.

112. **Источник cost data?** Решение: hybrid: provider pricing APIs где доступны, OpenStrap static catalog fallback, manual pricing для managed/reseller bundles.

113. **Local cost display?** Решение: monetary cost равен нулю, но resource impact CPU/RAM/disk показывается.

114. **Free BYOP limits?** Решение: soft fair-use limits плюс analytics.

115. **Product analytics?** Решение: TBD workstream, но usage/fair-use/conversion instrumentation должна быть с ранних версий.

116. **Failure UX?** Решение: diagnosis/remediation-oriented: failed step, probable cause, remediation, retry/rollback, raw logs expandable.

117. **Remediation execution?** Решение: known remediation actions как explicit buttons, но paid/premium для automated fixes.

118. **Support diagnostics sharing?** Решение: consent-based, как cookie/privacy settings: off, manual bundle или automatic для paid support. Secrets всегда redacted.

119. **Data residency?** Решение: Kazakhstan data residency обязательна для primary market, с дальнейшей экспансией в другие рынки силами OpenStrap.

120. **OpenStrap deploying OpenStrap?** Решение: стратегическая цель - OpenStrap deploys and operates OpenStrap.

121. **Первый production control plane hosting?** Решение: KZ-local/KZ-acceptable provider, candidates include Freedom, Yandex или более дешевый viable provider.

122. **Requirement/check standards и blocking behavior?** Решение: authoring использует YAML, parsed to JSON-compatible objects; requirements используют JSON Schema как standard; check results - SARIF-compatible direction TBD; failed requirements блокируют по severity: errors block, warnings allow, info shown.

123. **Зачем собирать facts?** Решение: facts собираются для validation, execution/agents и reporting/diagnostics.

124. **Нужны ли fact profiles?** Решение: fact profiles допускаются, точный дизайн TBD.

125. **Как обновлять decision log?** Решение: обновлять документ пачками, а не после каждого вопроса.

126. **Fact collection явная или on-demand?** Решение: по умолчанию fact collection запускается автоматически on-demand; workflow может явно закрепить fact collection step/profile, когда это нужно.

127. **Facts latest или snapshots?** Решение: source of truth для facts - immutable FactCollection snapshots; latest state - derived/materialized view из последней коллекции.

128. **Как моделировать историю facts?** Решение: FactCollection - один запуск сбора facts. История отдельного fact между запусками специально не моделируется.

129. **Scope FactCollection?** Решение: FactCollection имеет typed scope/refs; конкретная taxonomy target refs TBD.

130. **Typed refs?** Решение: все domain references должны быть typed; конкретные target ref types сейчас out of scope/TBD.

131. **Normalized facts и raw evidence?** Решение: FactCollection хранит normalized facts/context. Raw evidence/debug payload живет отдельно.

132. **Immutable FactCollection?** Решение: FactCollection immutable. Новый сбор facts создает новую коллекцию; старую можно пометить expired/superseded, но не редактировать.

133. **Freshness/TTL?** Решение: FactCollection имеет freshness metadata: collectedAt и validUntil/ttl.

134. **TTL на fact или collection?** Решение: TTL задается только на FactCollection, не на отдельных facts. Planner не должен создавать бессмысленно смешанные collections.

135. **Profile на FactCollection?** Решение: FactCollection может быть связана с profile, например `basic-network`, `host-inventory`, `preflight-*`, `diagnostic-*`. Конкретные profile names TBD.

136. **Purpose в FactCollection?** Решение: purpose не является частью FactCollection. Если нужно понять зачем собрали facts, это выводится из связанного run/workflow/check/report.

137. **Collector metadata в FactCollection?** Решение: collector metadata не хранится на уровне FactCollection; это относится к execution/collection step/artifact/run metadata.

138. **Artifact refs в FactCollection?** Решение: artifact references не являются полями FactCollection. Они живут в отдельной artifact/evidence model, связанной с facts/fact collection.

139. **Достаточно ли текущей FactCollection model?** Решение: текущей модели FactCollection достаточно; Artifact/Evidence model разбирается отдельно позже.

140. **Что считается успехом после создания environment?** Решение: success criterion - usable environment handoff. OpenStrap не заканчивает на "resource created"; он должен довести до "можно пользоваться".

141. **Handoff contract?** Решение: каждый Blueprint должен иметь handoff contract: что показать пользователю после успешного создания и какие checks означают "можно пользоваться".

142. **Handoff на Blueprint или Component?** Решение: components declare outputs/health/access artifacts; Blueprint aggregates user-facing handoff.

143. **Secrets в handoff?** Решение: handoff показывает secret refs/actions, не raw secrets. Reveal/copy только явным действием и по правам.

144. **Версионировать handoff?** Решение: handoff contract версионируется вместе с Blueprint revision.

145. **Handoff через CLI/API?** Решение: handoff доступен не только в Web UI, но и через CLI/API.

146. **Monitoring/alerts built-in или integrations?** Решение: Operations Pack monitoring/alerts поддерживает built-in OpenStrap monitoring для SMB/managed и integrations с customer monitoring для enterprise/BYOP.

147. **Глубина built-in monitoring?** Решение: v1 lightweight health/status/basic metrics/agent status. Full metrics/logs/traces/dashboards/alert routing - roadmap/enterprise.

148. **Backups provider-native или OpenStrap-managed?** Решение: v1 использует provider-native/local snapshots where available. Roadmap/premium - OpenStrap-managed backup agent/component для imported/on-prem/local/provider-limited targets.

149. **Restore как часть backup?** Решение: любая backup capability обязана включать restore path. В v1 restore может быть ограничен возможностями provider/local snapshot.

150. **Security checks разовые или continuous?** Решение: v1 one-time/on-change checks; continuous/scheduled checks - premium roadmap.

151. **Security checks built-in или scanners?** Решение: v1 super-minimal built-in baseline. External scanners/integrations later.

152. **Access/team в UI или target?** Решение: UI всегда доступен и через него настраивается access/team. Core - org/workspace roles; premium/roadmap - managed access into environments.

153. **Transport до target?** Решение: transport to target - core и должен быть полноценно спроектирован, потому что без него невозможны bootstrap, facts, components, logs/status, diagnostics, access и remediation.

154. **Transport как отдельный interface/plugin boundary?** Решение: да. Transport layer - отдельный typed interface/plugin boundary. Initial transports: SSH + local process; roadmap: WinRM, Kubernetes exec, agent channel, bastion/proxy, provider console.

155. **Кто выбирает transport?** Решение: provider/resource reports available transports/access hints, step/component reports required transport capabilities, planner chooses matching transport implementation.

156. **Provider - единственный источник transport/access?** Решение: нет. Нужен отдельный AccessProfile. Provider access hints optional; explicit AccessProfile can override/supplement provider output.

157. **Где задается AccessProfile?** Решение: AccessProfile может быть задан на уровнях workspace default, provider connection default, blueprint recommendation, environment/resource override; provider hints - fallback. Precedence: resource/env override > blueprint-specific access > provider connection default > workspace default > provider hints.

158. **AccessProfile reusable или inline?** Решение: оба режима: named reusable profiles и inline overrides on environment/resource.

159. **Secrets в AccessProfile?** Решение: AccessProfile содержит только secret refs, never raw secrets.

160. **Hop chains?** Решение: AccessProfile поддерживает hop chains. v1 может поддержать только simple SSH/bastion one-hop.

161. **AccessProfile core или premium?** Решение: AccessProfile core for basic transport. Advanced access governance is premium.

162. **Что делать, если target access отсутствует или не работает?** Решение: если required access data отсутствует там, где он обязателен, это planning/preflight error и run не стартует. Если access data есть, но подключение не работает, run fails на Connect/Bootstrap step с диагностикой. Bounded retry нужен только для transient состояний вроде boot/cloud-init/SSH startup; persistent auth/network errors fail with diagnosis.

163. **AccessProfile в handoff?** Решение: AccessProfile участвует в handoff. Handoff показывает поддерживаемый способ доступа, например `openstrap connect <environment>`, а не только raw IP/SSH details.

164. **Универсальная команда доступа?** Решение: `openstrap connect` - универсальная команда доступа. Она скрывает transport details и резолвит доступ через handoff/AccessProfile.

165. **`openstrap connect` core или premium?** Решение: basic connect к owned environments входит в core; governance, temporary access, session audit, managed bastion/proxy и approvals - premium.

166. **Режимы `openstrap connect`?** Решение: `openstrap connect` поддерживает разные modes. Фокус v1: shell + port-forward/open service. Logs/exec/file transfer могут появиться позже или отдельными командами.

167. **Что показывать в handoff первым?** Решение: handoff в первую очередь показывает OpenStrap-mediated access, например `openstrap connect <environment>`. Raw provider/SSH details уходят в Advanced/Details и доступны по правам.

168. **Audit для `openstrap connect`?** Решение: `openstrap connect` emits audit event: who, where, when, access profile, mode. Premium: session recording, command audit, approval trail.

169. **Local connect без SaaS?** Решение: `openstrap connect` должен работать для local environments без обязательной доступности SaaS/control plane во время подключения.

170. **`connect` и transport layer?** Решение: `openstrap connect` - user-facing UX/command; transport layer - internal implementation.

171. **Куда подключается `connect`?** Решение: `openstrap connect` может подключаться к default target environment или к конкретному resource/service внутри environment.

172. **Default connect target?** Решение: каждый Blueprint должен объявлять default connect target для `openstrap connect <environment>`, чтобы команда не была неоднозначной.

173. **Web UI Connect?** Решение: Web UI Connect использует browser handoff/protocol handler к CLI/helper, когда доступно. Fallback может показывать CLI command.

174. **Кто задает connect behavior?** Решение: default connect behavior задается handoff access action для конкретного service/resource/Blueprint, а не глобальным правилом CLI. Например Postgres может default to port-forward, VM - shell, desktop/headful VM - desktop mode.

175. **Extensible connect modes?** Решение: connect modes extensible. Initial modes: shell/port-forward/open-url. Roadmap modes: desktop, database-client, browser, kube-shell и другие.

176. **Нужна ли отдельная connect policy?** Решение: отдельную connect policy не вводим. Connect behavior = typed handoff access action + AccessProfile + transport.

177. **Typed handoff access actions?** Решение: handoff access actions должны быть typed, чтобы UI/CLI понимали, как их отображать и выполнять.

178. **Чем владеет OpenStrap?** Решение: OpenStrap владеет domain model и contracts between domains, но не переписывает mature tools внутри доменов.

179. **Архитектурный принцип?** Решение: зафиксировать принцип `Domain Contracts, Not Domain Reimplementation`: OpenStrap задает контракты между доменами, но не переписывает сами домены.

180. **Adapter boundary для доменов?** Решение: каждый зрелый внешний домен подключается через adapter boundary. Public SDK не обязателен для всех доменов в v1, но границы должны быть.

181. **Как использовать внешние tools/contracts?** Решение: external tools используются через product-adapted contracts. OpenStrap exposes subset/shape needed by product/user and maps it to mature external standards/tools behind adapters.

182. **Blueprint/Component YAML - чей формат?** Решение: Blueprint/Component YAML - OpenStrap product-facing format. Он может embed/reference standards/tools, но не является просто raw JSON Schema/Terraform/Ansible glued together.

183. **Как не превратить YAML в язык программирования?** Решение: OpenStrap YAML должен оставаться declarative: no loops/conditions/functions as product language; composition through blueprints/components; dynamic behavior delegated to runtimes/adapters; validation through standards like JSON Schema.

184. **Где допускается dynamic behavior?** Решение: dynamic behavior живет во external runtimes/tools, adapters, UI presets и later policy engines, но не в OpenStrap YAML как user-facing programming language.

185. **Как проверять compatibility?** Решение: compatibility опирается на существующие механизмы: npm/package manager resolution, semver, peerDependencies/optional peerDependencies, lockfile и JSON Schema. OpenStrap добавляет только domain-level capability/requirement checks, которые package managers не могут знать.

186. **Package resolution сейчас проектируем?** Решение: package resolution - TBD implementation detail. CLI package/install commands сейчас не проектируем. Принцип остается: не писать custom resolver, использовать npm-compatible mechanisms/tooling, когда понадобится.

187. **Что делать с drift?** Решение: v1/free detects/shows drift where possible, allows adopt as new desired revision, allows manual re-apply desired. Premium/roadmap: scheduled drift detection, alerts, policy-based auto-remediation.

188. **На каком уровне есть drift?** Решение: drift существует на provider/resource, component/runtime и handoff/operations уровнях. v1 starts with provider/resource drift + basic component status.

189. **Drift и failure - разные concepts?** Решение: да. Drift = actual differs from desired while resource may still work. Failure = system cannot reach desired or component is unhealthy.

190. **Severity у drift?** Решение: drift has severity: info/warning/error/critical, exact taxonomy TBD.

191. **Формат drift findings?** Решение: drift findings используют тот же SARIF-compatible/check-result direction, что preflight/security checks.

192. **Можно ли игнорировать drift?** Решение: drift ignore is policy-controlled. Можно allow ignore once/by rule/resource depending on workspace/environment policy. Critical/security drift may be non-ignorable.

193. **Adopt drift меняет desired state?** Решение: adopt drift creates a new desired-state revision. History remains immutable.

194. **Reapply desired как выполняется?** Решение: reapply desired uses normal plan/run pipeline. No separate drift-specific execution path.

195. **Когда запускается drift detection?** Решение: v1 on-demand + after runs. Premium/ops scheduled. Later/where available provider events.

196. **Что делать с unmanaged provider resources?** Решение: показывать как discovered unmanaged resources. Import/adopt только явным действием пользователя. OpenStrap не управляет и не удаляет их автоматически.

197. **Попадают ли unmanaged resources в cost visibility?** Решение: могут попадать во внешний/unmanaged spend, если provider API это позволяет, но отдельно от OpenStrap-managed cost.

198. **Влияют ли unmanaged resources на preflight/plan?** Решение: да, если создают constraints/conflicts: quota, names, subnet/IP/port conflicts и похожие ограничения.

199. **Нужен ли provider inventory view?** Решение: да, но не как core v1 screen. Может начаться как advanced/provider details для managed vs unmanaged resources, import/adopt, spend/quota и conflict diagnosis.

200. **Какой management level получает imported/adopted resource?** Решение: policy-based management level: observe only; attach/bootstrap/facts/monitor/connect; full lifecycle management where supported/allowed.

201. **Нужно ли показывать management level?** Решение: да. Management level должен быть виден в UI/handoff, чтобы пользователь понимал, что OpenStrap может и не может делать с resource/environment.

202. **Management level влияет на actions?** Решение: да. Observe-only, attached и full-managed resources показывают разные доступные действия.

203. **Что выбирает пользователь при import existing resource?** Решение: пользователь явно выбирает, что OpenStrap allowed делать: observe only; configure/connect/monitor; full lifecycle management where possible.

204. **Что по умолчанию для resources, созданных OpenStrap?** Решение: resources, created by OpenStrap, default to full lifecycle management, constrained by policy/permissions.

205. **Можно ли использовать observe-only resources как dependencies?** Решение: да. Observe-only resources могут быть dependencies/inputs в Blueprints, но OpenStrap не делает lifecycle/change actions над ними.

206. **Можно ли проверять health observe-only dependency?** Решение: да, если access/credentials/check config provided.

207. **Как observe-only dependency влияет на status?** Решение: зависит от Blueprint/component requirement. Required unavailable dependency = failure. Optional unavailable dependency = degraded/warning.

208. **Можно ли downgradе management level?** Решение: да, через explicit detach/retain action. Это создает new desired revision и audit event, subject to policy.

209. **Можно ли promote imported resource?** Решение: да, через explicit adopt action, если provider/access/capabilities позволяют. Это создает new desired revision и audit event.

210. **Когда full lifecycle management запрещен для imported resource?** Решение: если OpenStrap cannot prove resource can be safely full-managed. UI показывает missing proof/capability и оставляет attached/observe-only.

211. **Management level resource-level или environment-level?** Решение: per-resource. Environment показывает derived summary from its resources.

212. **Что происходит при delete environment?** Решение: по умолчанию удаляются только full-managed resources. Observe-only/attached/shared resources detach/retain. UI/CLI перед delete показывает summary: will delete / will detach or retain.

213. **Является ли workspace resource inventory?** Решение: нет. External/observe-only resources referenced by environments. Deleting environment removes reference, but does not touch external resource.

214. **Статус общей продуктовой прожарки?** Решение: общая product framing прожарка закрыта достаточно. Не нужно заново спрашивать, что это за продукт, для кого, зачем, какая ценность, какие первые сценарии, почему BYOP, почему CLI + Web, что бесплатно/платно и каков общий direction.

215. **Дают ли текущие вопросы и ответы полное продуктовое понимание?** Решение: да. Текущая продуктовая прожарка дает полное понимание, что такое OpenStrap, кто пользователь, какие у него потребности, какую ценность дает продукт, как он должен работать на уровне пользовательских сценариев и как он монетизируется.

216. **Что должен понять следующий агент из текущей продуктовой прожарки?** Решение: OpenStrap - единая точка входа для создания, запуска, поддержки и наблюдения инфраструктурных окружений на разных провайдерах, начиная с VM и safe AI-agent environments, с ростом в сторону component catalog, managed cloud, marketplace и operations packs.

217. **Как отвечать на проверку "есть ли еще слепые зоны по текущей продуктовой прожарке"?** Решение: если проверка ограничена именно общей продуктовой рамкой и не включает незакрытые технические/domain ветки, корректный ответ: крупных продуктовых слепых зон нет; рамка достаточна для понимания продукта, пользователя, ценности, рынка, монетизации, базовых сценариев и направления развития.

218. **Что делать, если следующий агент начинает общую продуктовую прожарку заново?** Решение: считать это ошибкой агента. Продолжать нужно только по конкретным незакрытым веткам, а не снова проходить общую product framing прожарку.

## Текущий порядок разработки

1. Facts
2. CLI
3. Workflow
4. Status
5. UI

## Текущая граница v1

### Входит в v1

- TypeScript-first monorepo
- Web + CLI
- Microservices boundaries
- Kafka event backbone
- Postgres primary state
- Blueprint/component model
- Provider plugin contract
- Local provider reference path
- VM lifecycle
- Requirements/facts/preflight foundation
- Runs/status/logs
- Official components
- Free BYOP lifecycle
- Paid operations pack foundation

### Не входит в v1

- Public partner marketplace
- Full self-hosted enterprise distribution
- Windows target support
- Mobile app
- Visual canvas
- Automatic provider service-account creation
- Full cloud provider automation before discovery
- Advanced compliance reports
- Auto-remediation
- Multi-region active-active control plane
