# OpenStrap Plugin System

Plugin system is the runtime extension layer for OpenStrap.

It follows the build-system shape used by Vite/Webpack: a user provides plugin objects, OpenStrap applies them in a deterministic order, and plugins register capabilities through an API instead of patching product modules.

## Current Runtime Contract

The implemented extension point is `FactsBackend`.

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

CLI commands load `openstrap.config.mjs` automatically when it exists in the current workspace root.

An explicit runtime config can be passed with:

```bash
openstrap run examples/openstrap/local-run.yaml --runtime-config openstrap.config.mjs
```

## Direct Plugin Loading

A plugin can also be loaded directly from CLI:

```bash
openstrap run examples/openstrap/local-run.yaml \
  --plugin ./plugins/osquery.mjs \
  --facts-backend company:osquery
```

The same flags work for host facts collection:

```bash
openstrap facts collect host examples/facts/system-inventory.yaml \
  --plugin ./plugins/osquery.mjs \
  --facts-backend company:osquery
```

## Built-in Core Plugin

OpenStrap always applies the core plugin first:

```text
openstrap:core
```

It registers the current built-in facts backend:

```text
openstrap:systeminformation
```

This is the default backend when runtime config does not select another one.

## Plugin Order

Plugins are applied in this order:

```text
plugins with enforce: "pre"
plugins without enforce
plugins with enforce: "post"
```

The core plugin is inserted first and uses `enforce: "pre"`, so it is applied before user plugins. Inside each bucket, order is the order provided by runtime config and then CLI.

## Boundary Rules

- `Facts` owns facts schema, domain names, and `FactCollection` invariants.
- `Requirements` reads normalized facts only.
- `Plugin` owns runtime extension and backend registration.
- A facts backend may use any collector implementation internally, but it must return OpenStrap `FactCollection`.
- A plugin must not add profile, provenance, metadata, raw evidence, or artifacts to `FactSnapshot`.
- Backend-specific logs, raw evidence, and artifacts stay above facts payload.
