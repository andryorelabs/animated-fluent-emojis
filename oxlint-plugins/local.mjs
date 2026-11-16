import localPlugin from "../eslint-rules/index.mjs";

const asyncMatcherModifiers = new Set(["rejects", "resolves"]);
const focusableTestFunctions = new Set(["test", "it", "describe"]);

/**
 * The property name of a member access, for both `.name` and `["name"]`.
 * @param node A `MemberExpression`.
 * @returns The accessed name, or undefined when it is not a static name.
 */
function memberName(node) {
  const property = node.property;
  if (node.computed !== true) {
    return property?.type === "Identifier" ? property.name : undefined;
  }
  return typeof property?.value === "string" ? property.value : undefined;
}

/**
 * Whether the member chain below `node` goes through `expect(...).rejects` or
 * `expect(...).resolves`.
 * @param node The callee of a call expression.
 * @returns True when the chain starts as an async matcher.
 */
function startsAsyncMatcherChain(node) {
  let current = node;
  while (current?.type === "MemberExpression") {
    if (asyncMatcherModifiers.has(memberName(current) ?? "")) {
      const expectCall = current.object;
      return (
        expectCall?.type === "CallExpression" &&
        expectCall.callee?.type === "Identifier" &&
        expectCall.callee.name === "expect"
      );
    }
    current = current.object;
  }
  return false;
}

/**
 * Whether a promise produced at `node` is awaited or handed back to the caller.
 * @param node A call expression.
 * @returns True when the parent awaits, returns or arrow-returns it.
 */
function isAwaitedOrReturned(node) {
  const parent = node.parent;
  return (
    parent?.type === "AwaitExpression" ||
    parent?.type === "ReturnStatement" ||
    (parent?.type === "ArrowFunctionExpression" && parent.body === node)
  );
}

/**
 * Requires `expect(...).rejects` and `.resolves` assertions to be awaited or
 * returned, so a failing assertion cannot be lost.
 */
const noUnawaitedAsyncMatcher = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `expect(...).rejects` and `.resolves` assertions to be awaited or returned.",
    },
    messages: {
      unawaited:
        "This async assertion is never awaited, so a failure is silently lost. `await` it or `return` it.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!startsAsyncMatcherChain(node.callee) || isAwaitedOrReturned(node)) return;
        context.report({ node, messageId: "unawaited" });
      },
    };
  },
};

/**
 * The name a specifier imports, for both `{ test }` and `{ "test" as run }`.
 * @param specifier An `ImportSpecifier`.
 * @returns The imported name, if any.
 */
function importedName(specifier) {
  const imported = specifier.imported;
  if (imported?.type === "Identifier") return imported.name;
  return typeof imported?.value === "string" ? imported.value : undefined;
}

/**
 * Collects the local bindings for the focusable functions and the namespace
 * imported from `bun:test` in one import declaration.
 * @param declaration An `ImportDeclaration`.
 * @param functionNames Receives local names of `test`, `it` and `describe`.
 * @param namespaceNames Receives local names of namespace imports.
 */
function collectBunTestBindings(declaration, functionNames, namespaceNames) {
  if (declaration.source?.value !== "bun:test") return;
  const specifiers = declaration.specifiers ?? [];
  for (const specifier of specifiers) {
    const localName = specifier.local?.name;
    if (localName === undefined) continue;
    if (specifier.type === "ImportNamespaceSpecifier") {
      namespaceNames.add(localName);
    } else if (focusableTestFunctions.has(importedName(specifier) ?? "")) {
      functionNames.add(localName);
    }
  }
}

/**
 * Whether `node` names a focusable function imported from `bun:test`, either
 * directly (`test`) or through a namespace import (`bun.test`).
 * @param node The object a `.only` access is made on.
 * @param functionNames Local names of imported focusable functions.
 * @param namespaceNames Local names of `bun:test` namespace imports.
 * @returns True when it is a `bun:test` focusable function.
 */
function isBunTestFunction(node, functionNames, namespaceNames) {
  return node?.type === "Identifier"
    ? functionNames.has(node.name)
    : node?.type === "MemberExpression" &&
        node.object?.type === "Identifier" &&
        namespaceNames.has(node.object.name) &&
        focusableTestFunctions.has(memberName(node) ?? "");
}

/**
 * Rejects `.only` on `test`, `it` and `describe` imported from `bun:test`,
 * which the Vitest and Jest focus rules do not see.
 */
const noBunTestOnly = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `.only` on `test`, `it` and `describe` imported from `bun:test`.",
    },
    messages: {
      focused:
        "A focused test skips every other test in the run. Remove `.only` before committing.",
    },
    schema: [],
  },
  create(context) {
    const functionNames = new Set();
    const namespaceNames = new Set();
    return {
      ImportDeclaration(node) {
        collectBunTestBindings(node, functionNames, namespaceNames);
      },
      MemberExpression(node) {
        if (
          memberName(node) === "only" &&
          isBunTestFunction(node.object, functionNames, namespaceNames)
        ) {
          context.report({ node, messageId: "focused" });
        }
      },
    };
  },
};

/**
 * The `local` jsPlugin for Oxlint: the repo's shared local rules plus the
 * aokit E10 baseline rules no built-in plugin provides.
 */
export default {
  meta: { name: "local" },
  rules: {
    ...localPlugin.rules,
    "no-unawaited-async-matcher": noUnawaitedAsyncMatcher,
    "no-bun-test-only": noBunTestOnly,
  },
};
