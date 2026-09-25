---
description: >
  The App credential pair for a safe-output write, in one place per App.
  Two App identities exist (implementer, reviewer); the caller picks one.

  The substituted value sits inside a larger `${{ }}` expression, which the
  docs do not cover; verified by reading the compiled locks, which name the
  right vars and secrets. Re-check them after upgrading gh-aw.

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
