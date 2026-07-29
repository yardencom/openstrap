# OpenStrap Plugin System

Plugin system is the runtime extension layer for OpenStrap.

It follows the build-system shape used by Vite/Webpack: a user provides plugin objects, OpenStrap applies them in a deterministic order, and plugins register capabilities through an API instead of patching product modules.

## Current Runtime Contract

A plugin depends on `@openstrap/plugin-contract` and never on openstrap itself (ADR 0008). The
contract is declarations only, so nothing of openstrap ends up inside a built plugin, and a plugin
is a plain object — there is nothing to call to declare one. openstrap checks the shape when it
loads it, which is the only place the check can be trusted: a plugin is built separately.

A plugin registers capabilities through `setup(api)`:

```text
api.registerProvider(provider)
api.registerTransport(connector)
api.registerSecretStore(store)
```

There is no slot for reading a machine. Facts are not pluggable: openstrap reads a
machine through the machine's own APIs, in a process running on that machine, and
a second way of doing it would be a second answer to the same question. See
ADR 0007.

A plugin is named after the tool it integrates, not after the slot it fills. One tool may fill several: Docker will register a provider and a transport at once, so a name like `provider-docker` would lie.

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

## Runtime Config

`openstrap.config.mjs` is runtime configuration, not a blueprint and not a facts definition.

```js
import utm from "@openstrap/utm";
import ssh from "@openstrap/ssh";

export default {
  plugins: [
    utm(),
    ssh(),
  ],
};
```

## CLI Runtime

`openstrap create` and `openstrap connect` create an OpenStrap runtime, because both need a provider or a transport from a plugin. `openstrap run` and `openstrap facts collect` do not: they read the machine openstrap is running on, and nothing about that is pluggable.

A runtime is built with `loadOpenStrapRuntime({ cwd, configPath, specifiers })`, which
loads the config, then the plugins named on the command line, and applies them in that
order. `createOpenStrapRuntime` takes already-loaded objects instead, for callers that
have them and for tests.

Supported runtime options:

```text
--runtime-config path
--plugin specifier
```

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
- `Plugin` owns runtime extension and the registration of providers, transports and secret stores.
- `Transport` owns the ports; `Plugin` owns only the contract for opening one.
- A plugin cannot read a machine and cannot reach `FactSnapshot`. It provides the channel; `Facts` decides what a fact is.
- A plugin must not add profile, provenance, metadata, raw evidence, or artifacts to `FactSnapshot`.
