#!/usr/bin/env bash
# What changed between two versions of a pen design file, element by element.
#
#   design-diff.sh <old.pen> <new.pen>
#
# Every element in a pen file has a stable `id`, so a change is found by id, not
# by position: an element whose own properties differ is `changed`, one only in
# the new file is `added`, one only in the old file is `removed`. Moving or
# re-ordering children does not count as a change to the parent.
#
# Prints a JSON array, one entry per change:
#   {"change": "changed", "id": "MJtCe", "name": "State — Delete Confirmation",
#    "path": ["Todo App — Today", "..."], "within": ["a7cSYm", "...", "MJtCe"]}
# `within` is the element and every element it sits inside, outermost first: an
# issue that claims any of those ids is affected by the change.
set -euo pipefail
[ $# -eq 2 ] || { sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

flat() { # pen file -> {id: {name, props, within, path}}
  jq -c '
    def nodes($within; $path):
      (.children // [])[] | select(type == "object" and has("id")) | . as $c
      | {id: $c.id, name: ($c.name // $c.type), props: ($c | del(.children)),
         within: ($within + [$c.id]), path: $path},
        ($c | nodes($within + [$c.id]; $path + [($c.name // $c.type)]));
    [nodes([]; [])] | map({key: .id, value: del(.id)}) | from_entries' "$1"
}

jq -n --slurpfile o <(flat "$1") --slurpfile n <(flat "$2") '
  $o[0] as $o | $n[0] as $n
  | [ ($n | keys[]) as $k | select($o[$k] == null)
        | {change: "added", id: $k, name: $n[$k].name, path: $n[$k].path, within: $n[$k].within} ]
  + [ ($o | keys[]) as $k | select($n[$k] == null)
        | {change: "removed", id: $k, name: $o[$k].name, path: $o[$k].path, within: $o[$k].within} ]
  + [ ($n | keys[]) as $k | select($o[$k] != null and $o[$k].props != $n[$k].props)
        | {change: "changed", id: $k, name: $n[$k].name, path: $n[$k].path, within: $n[$k].within} ]'
