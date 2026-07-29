# @openstrap/plugin-contract

What an OpenStrap plugin implements, and nothing else: the shape of a plugin, and the
three things it may contribute — a `Provider`, a `TransportConnector`, a `SecretStore` —
together with the transport ports an open channel offers.

A plugin does not depend on OpenStrap. It cannot: a plugin is a package of its own,
released on its own, and a dependency on OpenStrap would put OpenStrap's code inside
the plugin and tie the plugin's version to OpenStrap's internals. Both sides depend on
this contract instead — OpenStrap because it loads plugins, the plugin because it is one.

There is no runtime code here. Declarations only, so every import of this package
disappears when the plugin is built, and a plugin ships with nothing of OpenStrap in it.
Nothing has to be called to declare a plugin either: a plugin is a plain object, and
OpenStrap checks its shape when it loads it.

```ts
import type { OpenStrapPlugin, Provider } from "@openstrap/plugin-contract";

const provider: Provider = { /* ... */ };

export default {
  name: "company:orbstack",
  setup(api) {
    api.registerProvider(provider);
  },
} satisfies OpenStrapPlugin;
```

Reading a machine is not here, and will not be: OpenStrap reads a machine through that
machine's own APIs, in a process running on it, and a second way of doing it would be a
second answer to the same question (ADR 0007).
