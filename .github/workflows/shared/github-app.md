---
description: >
  The App credential pair for a safe-output write, in one place per App.
  Two App identities exist (implementer, reviewer); the caller picks one.

  EXPERIMENTAL: relies on import-schema substitution happening as plain text
  before the file is parsed as YAML/GHA, so a substituted value can sit inside
  a larger `${{ }}` expression rather than being the whole expression (unlike
  every other import-schema use in this repo, e.g. shared/postconditions.md's
  whole-value `PI_ROLE: ${{ github.aw.import-inputs.role }}`). Verify the
  compiled lock names the right vars/secrets before trusting this; if it
  doesn't, this file is wrong and should be deleted rather than patched.

import-schema:
  app_prefix:
    type: choice
    options: [IMPLEMENTER, REVIEWER]
    required: true

safe-outputs:
  github-app:
    client-id: ${{ vars.${{ github.aw.import-inputs.app_prefix }}_CLIENT_ID }}
    private-key: ${{ secrets.${{ github.aw.import-inputs.app_prefix }}_APP_PRIVATE_KEY }}
---
