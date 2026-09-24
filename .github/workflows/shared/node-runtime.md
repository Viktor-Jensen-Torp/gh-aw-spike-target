---
description: >
  Node access and version, for the three roles that run `npm test`
  (implement, rework, unblock). Byte-identical in all three before this
  import existed, so no `import-schema` parameter is needed.

network:
  allowed:
    - defaults
    - node

runtimes:
  node:
    version: "24"
---
