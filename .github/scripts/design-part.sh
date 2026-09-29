#!/usr/bin/env bash
# One part of a pen design file, with every component instance inside it
# resolved, as JSON.
#
#   design-part.sh <path/to/design.pen> <id>
#
# A screen built from components holds `{"type": "ref", "ref": "<component id>"}`
# where the component is used, not the component itself; an agent reading the
# part alone would not see what it looks like. This puts each component in place.
# The rules are pen.dev's (pen-schema.md in the pen CLI, `interface Ref`):
#   - a ref reuses the object whose id it names; its other keys override that
#     object's properties;
#   - `descendants` changes parts inside it, keyed by an ID path (ids never
#     contain `/`): without `type` the listed properties are merged into that
#     part, with `type` the part is replaced by the given node.
# Each resolved instance keeps its own id and name and gains
# `"component": {"id", "name"}`, so a reader knows to use that shared component
# rather than build it again. Prints nothing and fails when the id is absent.
set -euo pipefail
[ $# -eq 2 ] || { sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
PEN="$1"; ID="$2"

jq -e --arg id "$ID" '
  ([.. | objects | select(has("id") and (.id | type) == "string")] | INDEX(.id)) as $all
  # Apply one override at an ID path inside an already resolved tree. Each
  # segment is looked for at any depth below the previous one: a path crosses
  # instance boundaries, not every level.
  | def at($p; $v):
      if ($p | length) == 0 then
        (if ($v | has("type")) then $v else . + $v end)
      elif has("children") then
        .children |= map(if .id == $p[0] then at($p[1:]; $v) else at($p; $v) end)
      else . end;
    def resolve:
      if type != "object" then .
      elif .type == "ref" and ($all[.ref] != null) then
        . as $i | $all[$i.ref] as $k
        | ($k | resolve | del(.reusable, .x, .y))
          + ($i | del(.type, .ref, .descendants))
          + {component: {id: $k.id, name: $k.name}}
        | reduce (($i.descendants // {}) | to_entries[]) as $d (.;
            at($d.key | split("/"); $d.value | if has("type") then resolve else . end))
      elif has("children") then .children |= map(resolve)
      else . end;
    $all[$id] // empty | resolve
' "$PEN"
