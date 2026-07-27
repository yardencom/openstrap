# OpenStrap Plugin System

Plugin system is the runtime extension layer for OpenStrap.

It follows the build-system shape used by Vite/Webpack: a user provides plugin objects, OpenStrap applies them in a deterministic order, and plugins register capabilities through an API instead of patching product modules.

## Current Runtime Contract

A plugin registers capabilities through `setup(api)`:

```text
api.registerFactsBackend(backend)
api.registerProvider(provider)
api.registerTransport(connector)
api.registerSecretStore(store)
```

A plugin is named after the tool it integrates, not after the slot it fills. One tool may fill several: Docker will register a provider and a transport at once, so a name like `provider-docker` would lie.

```ts
import { defineOpenStrapPlugin, type FactsBackend } from "openstrap/Plugin";

const backend: FactsBackend = {
  id: "company:osquery",
  displayName: "Company osquery backend",
  capabilities: {
    scopes: ["host"],
    sections: ["os", "cpu", "memory", "processes", "services", "paths"],
  },
  async collect(request) {
    // Collect raw data through the backend, normalize it, and return FactCollection.
  },
};

export default defineOpenStrapPlugin({
  name: "company:osquery-plugin",
  setup(api) {
    api.registerFactsBackend(backend);
  },
});
```

The backend returns OpenStrap normalized facts. It does not change facts YAML, requirements YAML, or the `FactSnapshot` shape.

A facts backend declares no transport capability. Collection varies by the operating system of the target, not by how the target is reached, so a backend is not bound to a channel. The remaining reason for a separate backend is a fundamentally different collection mechanism — osquery answering in one query instead of ten commands.

Every method of every contract is asynchronous. Plugins run in-process today and out of process later; a synchronous contract would close that door for good.

### Provider

A provider creates and drives the lifecycle of a machine through an external tool: `detect`, `resolveImage`, `create`, `start`, `stop`, `restart`, `delete`, `inspect`, `access`, `find`.

A provider never installs a hypervisor by itself. `detect` reports whether the tool is available and, when it is not, the command that would install it — the caller shows that command and asks the user.

openstrap stores the mapping to the provider's resource, not the machine's actual state. Actual state is read back through `inspect` when it is needed, so there is only one source of truth.

### Transport

A transport connector opens a channel to a target and hands back the filesystem, network and process operations available through it. Establishing the channel — a handshake, a key exchange, a wait while a machine finishes booting — is a responsibility of its own, separate from the operations the open channel offers.

A transport plugin registers only a transport. `@openstrap/ssh` is about SSH, not about facts.

### Secret store

The core owns secrets. A plugin receives a `SecretReference`, never a value; the value is revealed only inside the trusted execution boundary that owns the store. A transport plugin therefore does not own a keychain and does not hold the private key.

## Built-In Backend

OpenStrap registers `openstrap:core` by default. That plugin provides the default facts backend:

```text
openstrap:systeminformation
```

If runtime config and CLI flags do not select another backend, OpenStrap uses this backend.

## Runtime Config

`openstrap.config.mjs` is runtime configuration, not a blueprint and not a facts definition.

```js
import { defineOpenStrapConfig } from "openstrap/Plugin";
import osquery from "@company/openstrap-osquery-plugin";

export default defineOpenStrapConfig({
  plugins: [
    osquery(),
  ],
  facts: {
    backend: "company:osquery",
  },
});
```

## CLI Runtime

Both `openstrap run` and `openstrap facts collect` create an OpenStrap runtime before facts are collected.

Supported runtime options:

```text
--runtime-config path
--plugin specifier
--facts-backend id
```

Plugins register facts backends. CLI selects the backend from `--facts-backend`, then `openstrap.config.mjs`, then the built-in `openstrap:systeminformation` backend.

## Plugin Order

Plugins are applied in this order:

```text
plugins with enforce: "pre"
plugins without enforce
plugins with enforce: "post"
```

Inside each bucket, order is the order provided by runtime config.

## Boundary Rules

- `Facts` owns facts schema, domain names, and `FactCollection` invariants.
- `Requirements` reads normalized facts only.
- `Plugin` owns runtime extension and the registration of backends, providers, transports and secret stores.
- `Transport` owns the ports; `Plugin` owns only the contract for opening one.
- A facts backend may use any collector implementation internally, but it must return OpenStrap `FactCollection`.
- A plugin must not add profile, provenance, metadata, raw evidence, or artifacts to `FactSnapshot`.
- Backend-specific logs, raw evidence, and artifacts stay above facts payload.
