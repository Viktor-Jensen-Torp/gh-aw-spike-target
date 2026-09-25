---
description: >
  Installs the role-postconditions Pi extension for the agent run. Imported with
  a role name rather than copied: the step was duplicated in all seven roles and
  had already drifted — unblock's copy logged a different line from everyone
  else's.

import-schema:
  role:
    type: string
    required: true
    description: The PI_ROLE the extension checks postconditions for.

pre-agent-steps:
  # Not via engine.args: those also reach the evals job, which has no checkout,
  # and Pi exits 1 on a missing --extension file (dist/main.js). Pi auto-loads
  # *.js from $PI_CODING_AGENT_DIR/extensions, which gh-aw sets to
  # /tmp/gh-aw/pi-agent-dir and never clears (pi_models_json.cjs only mkdirs).
  # The source is the base branch's copy: .github/ is restored from base before
  # these steps run (restore_base_github_folders.sh).
  - name: Install role postconditions extension
    run: |
      set -euo pipefail
      mkdir -p /tmp/gh-aw/pi-agent-dir/extensions /tmp/gh-aw/pi-agent-dir/verify
      cp .github/pi/postconditions.cjs /tmp/gh-aw/pi-agent-dir/extensions/postconditions.js
      # The pre-push check's scripts, also from the base branch: the agent's own
      # edits to them must not decide whether its work passes.
      cp .github/scripts/verify.sh .github/scripts/check-conventions.sh /tmp/gh-aw/pi-agent-dir/verify/
      echo "installed: $(wc -c < /tmp/gh-aw/pi-agent-dir/extensions/postconditions.js) bytes, role=$PI_ROLE, verify=$(ls /tmp/gh-aw/pi-agent-dir/verify | tr '\n' ' ')"
    env:
      PI_ROLE: ${{ github.aw.import-inputs.role }}
---
