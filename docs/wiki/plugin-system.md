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
    transports: ["ssh"],
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
- `Plugin` owns runtime extension and backend registration.
- A facts backend may use any collector implementation internally, but it must return OpenStrap `FactCollection`.
- A plugin must not add profile, provenance, metadata, raw evidence, or artifacts to `FactSnapshot`.
- Backend-specific logs, raw evidence, and artifacts stay above facts payload.
