// A file whose statements are all re-exports is a barrel: it hides where code
// lives and is where parallel changes collide (chain/structure.md, "Imports").
export const noBarrelFiles = {
  meta: {
    type: "problem",
    messages: {
      barrel:
        "This file only re-exports. Delete it and import each name from the file that defines it (chain/structure.md, Imports).",
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const body = node.body.filter((s) => s.type !== "EmptyStatement");
        const reexport = (s) =>
          s.type === "ExportAllDeclaration" || (s.type === "ExportNamedDeclaration" && s.source);
        if (body.length > 0 && body.every(reexport)) context.report({ node, messageId: "barrel" });
      },
    };
  },
};
