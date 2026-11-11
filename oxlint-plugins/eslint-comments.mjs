import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";

/**
 * Moves a negative column to the start of its line. `eslint-comments` reports
 * directive problems at `column: -1` so ESLint cannot suppress them, and
 * Oxlint rejects that column as out of range.
 * @param position A report position.
 * @returns The same position with its column clamped at 0.
 */
const clampColumn = (position) =>
  position && position.column < 0 ? { ...position, column: 0 } : position;

/**
 * Clamps the start and end columns of a report descriptor's `loc`.
 * @param descriptor What the rule passed to `context.report`.
 * @returns The descriptor, unchanged except for a negative column.
 */
function clampDescriptor(descriptor) {
  const { loc } = descriptor;
  if (!loc || !("start" in loc)) return descriptor;
  return {
    ...descriptor,
    loc: { start: clampColumn(loc.start), end: clampColumn(loc.end) },
  };
}

/**
 * Forwards to Oxlint's frozen rule context through a Proxy over `{}`,
 * replacing only `report`.
 * @param context The Oxlint rule context.
 * @returns The forwarding context.
 */
function withClampedReport(context) {
  const report = (descriptor) => {
    context.report(clampDescriptor(descriptor));
  };
  return new Proxy(
    {},
    {
      get(_, key) {
        if (key === "report") return report;
        const value = Reflect.get(context, key, context);
        return typeof value === "function" ? value.bind(context) : value;
      },
    },
  );
}

/**
 * `@eslint-community/eslint-plugin-eslint-comments` for Oxlint, with the same
 * rules and options. Only report columns change: the plugin's `column: -1`
 * crashes Oxlint, and a crash stops every JS plugin rule in that file.
 */
const eslintCommentsPlugin = {
  meta: { name: "@eslint-community/eslint-comments" },
  rules: Object.fromEntries(
    Object.entries(eslintComments.rules).map(([name, rule]) => [
      name,
      { ...rule, create: (context) => rule.create(withClampedReport(context)) },
    ]),
  ),
};

export default eslintCommentsPlugin;
