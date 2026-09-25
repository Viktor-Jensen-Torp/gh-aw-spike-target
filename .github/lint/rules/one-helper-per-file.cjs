// @ts-check
"use strict";

/**
 * One helper, one file (.github/conventions/javascript.md), as a lint rule.
 *
 * Applies to src/*.js except src/index.js (the legacy barrel, which is guarded
 * by check-conventions.sh instead: its rule is "do not grow", a diff question).
 * A helper file must define exactly one top-level function, named after the
 * file, and export exactly that: `module.exports = { <name> };`.
 *
 * Messages are written for the agent that will read them in a refused push:
 * each says what to change, not just what is wrong.
 */

const path = require("node:path");

/** @param {any} node */
function topLevelFunctionName(node) {
  if (node.type === "FunctionDeclaration" && node.id) return node.id.name;
  if (node.type === "VariableDeclaration") {
    for (const d of node.declarations) {
      const init = d.init;
      if (d.id.type === "Identifier" && init && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")) {
        return d.id.name;
      }
    }
  }
  return null;
}

/** @param {any} node @returns {any} the object literal assigned to module.exports, or null */
function moduleExportsValue(node) {
  if (node.type !== "ExpressionStatement") return null;
  const e = node.expression;
  if (e.type !== "AssignmentExpression" || e.left.type !== "MemberExpression") return null;
  const { object, property } = e.left;
  if (object.type === "Identifier" && object.name === "module" && property.type === "Identifier" && property.name === "exports") {
    return e.right;
  }
  return null;
}

module.exports = {
  meta: {
    type: "problem",
    docs: { description: "Each src/ helper file defines and exports exactly one function, named after the file." },
    schema: [],
    messages: {
      noFunction: "src/{{file}}.js defines no function. A helper file holds exactly one helper, `{{file}}` — see .github/conventions/javascript.md.",
      tooMany: "src/{{file}}.js defines {{count}} functions ({{names}}). One helper, one file: keep `{{file}}` here and move each other one to its own src/<name>.js, with its tests in test/<name>.test.js.",
      wrongName: "src/{{file}}.js defines `{{name}}`. Name the file after the helper (src/{{name}}.js, tests in test/{{name}}.test.js) or the helper after the file.",
      exports: "src/{{file}}.js must end with exactly `module.exports = { {{file}} };` — export the one helper this file defines, and nothing else.",
    },
  },
  create(context) {
    const file = path.basename(context.filename, ".js");
    return {
      Program(program) {
        const fns = [];
        let exportsNode = null;
        for (const stmt of program.body) {
          const name = topLevelFunctionName(stmt);
          if (name) fns.push({ name, node: stmt });
          const value = moduleExportsValue(stmt);
          if (value) exportsNode = { stmt, value };
        }

        if (fns.length === 0) {
          context.report({ node: program, messageId: "noFunction", data: { file } });
          return;
        }
        if (fns.length > 1) {
          context.report({
            node: fns[1].node,
            messageId: "tooMany",
            data: { file, count: String(fns.length), names: fns.map(f => f.name).join(", ") },
          });
          return;
        }
        if (fns[0].name !== file) {
          context.report({ node: fns[0].node, messageId: "wrongName", data: { file, name: fns[0].name } });
          return;
        }

        const v = exportsNode && exportsNode.value;
        const exact =
          v &&
          v.type === "ObjectExpression" &&
          v.properties.length === 1 &&
          v.properties[0].type === "Property" &&
          v.properties[0].key.type === "Identifier" &&
          v.properties[0].key.name === file;
        if (!exact) {
          context.report({ node: exportsNode ? exportsNode.stmt : program, messageId: "exports", data: { file } });
        }
      },
    };
  },
};
