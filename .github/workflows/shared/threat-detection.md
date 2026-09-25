---
description: >
  Strict threat detection, shared by every agent role. Imported, not copied, so
  the gate cannot drift between roles — seven copies of a security setting is
  six chances to weaken one by accident.

safe-outputs:
  threat-detection:
    engine:
      id: claude
      model: claude-haiku-4-5-20251001
    # Strict mode. The default (true) lets safe outputs run when the detector
    # cannot return a verdict: the WTD policy in the safe-outputs spec is keyed
    # on conclusion == "warning", but an engine failure yields "failure", so
    # nothing gates the write (spike 2, run 35540609579).
    continue-on-error: false
    # threat-detect's own default is 0, so one clean exit without a verdict is
    # terminal. Two retries absorb a flaky detector without weakening the gate.
    retries: 2
    # Detection is the larger half of this factory's bill: it reads the agent's
    # output AND the full git patch, so its cost scales with patch size — one
    # unblock run with a merge patch cost 4.8x its own agent. Measured spend is
    # under 25 AIC; the default cap is 400, which is $4 a run. This bounds the
    # tail without changing what the detector inspects or how it fails.
    max-ai-credits: 150
---
