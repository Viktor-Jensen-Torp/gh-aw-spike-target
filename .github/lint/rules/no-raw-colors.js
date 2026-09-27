// Colours come from the theme tokens mapped from the design's variables, never
// as raw values (web.md, "Styling").
const RAW = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

export const noRawColors = {
  meta: {
    type: "problem",
    messages: {
      raw: "Raw colour '{{value}}'. Use the theme token for the design variable instead, e.g. bg-surface or text-muted (web.md, Styling).",
    },
    schema: [],
  },
  create(context) {
    const check = (node, text) => {
      const match = typeof text === "string" && text.match(RAW);
      if (match) context.report({ node, messageId: "raw", data: { value: match[0] } });
    };
    return {
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value.cooked),
    };
  },
};
