import { existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * Parsed `tsconfig` files by absolute path, so each one is read once per
 * lint run. There is no invalidation: the cache lives as long as one CLI run.
 */
const parsedConfigs = new Map();

/** Type-checked programs by the absolute path of the `tsconfig` they come from. */
const programs = new Map();

/** The `tsconfig` that covers each linted file, by absolute file path. */
const configPathsByFile = new Map();

/** Parser services per TypeScript source file, shared by every wrapped rule. */
const servicesBySourceFile = new WeakMap();

/** Extensions ESLint lints without type information (`disableTypeChecked`). */
const UNTYPED_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".jsx"]);

/**
 * Reads and parses a `tsconfig`, throwing on a config TypeScript cannot read
 * instead of silently linting without types.
 * @param configPath Absolute path of the `tsconfig` file.
 * @returns The parsed command line for that config.
 */
function parseConfig(configPath) {
  const cached = parsedConfigs.get(configPath);
  if (cached) return cached;
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic(diagnostic) {
        throw new Error(
          `with-types: cannot read ${configPath}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
        );
      },
    },
  );
  if (!parsed) throw new Error(`with-types: cannot read ${configPath}`);
  parsedConfigs.set(configPath, parsed);
  return parsed;
}

/**
 * Finds the config that lists a file among its own files, starting at
 * `configPath` and descending through its project references, so a
 * solution-style `tsconfig.json` (`files: []` plus `references`) resolves to
 * the referenced project whose `include` holds the file.
 * @param configPath Absolute path of the `tsconfig` to start from.
 * @param fileName Absolute path of the linted file.
 * @param visited Config paths already searched, to stop reference cycles.
 * @returns The covering config path, or `undefined` when none covers it.
 */
function findCoveringConfig(configPath, fileName, visited) {
  if (visited.has(configPath)) return;
  visited.add(configPath);
  const parsed = parseConfig(configPath);
  if (parsed.fileNames.some((name) => path.resolve(name) === fileName)) {
    return configPath;
  }
  const references = parsed.projectReferences ?? [];
  for (const reference of references) {
    const referencePath = ts.resolveProjectReferencePath(reference);
    const covering = findCoveringConfig(referencePath, fileName, visited);
    if (covering) return covering;
  }
}

/**
 * Walks up from a file's directory and returns the first `tsconfig.json`
 * (or one of its references) that includes the file.
 * @param fileName Absolute path of the linted file.
 * @returns The covering config path, or `undefined` when no config covers it.
 */
function resolveConfigPath(fileName) {
  if (configPathsByFile.has(fileName)) return configPathsByFile.get(fileName);
  const visited = new Set();
  let covering;
  let directory = path.dirname(fileName);
  for (;;) {
    const candidate = path.join(directory, "tsconfig.json");
    if (existsSync(candidate)) {
      covering = findCoveringConfig(candidate, fileName, visited);
      if (covering) break;
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  configPathsByFile.set(fileName, covering);
  return covering;
}

/**
 * Builds, or reuses, the type-checked program for a config.
 * @param configPath Absolute path of the covering `tsconfig`.
 * @returns The program, with its type checker already created.
 */
function programFor(configPath) {
  const cached = programs.get(configPath);
  if (cached) return cached;
  const parsed = parseConfig(configPath);
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noEmit: true },
    projectReferences: parsed.projectReferences,
  });
  program.getTypeChecker();
  programs.set(configPath, program);
  return program;
}

/**
 * Indexes every TypeScript node of a file by its `start:end` span, keeping
 * the deepest node for spans shared by a parent and its child.
 * @param sourceFile File whose nodes get indexed.
 * @returns TypeScript nodes keyed by `start:end`.
 */
function indexNodesBySpan(sourceFile) {
  const nodesBySpan = new Map();
  const visit = (node) => {
    nodesBySpan.set(`${String(node.getStart(sourceFile))}:${String(node.getEnd())}`, node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return nodesBySpan;
}

/**
 * Builds the typescript-eslint style parser services for one source file.
 * @param program The program covering the file.
 * @param sourceFile The file's TypeScript source file.
 * @returns Parser services with the program, node map and type lookups.
 */
function createParserServices(program, sourceFile) {
  const cached = servicesBySourceFile.get(sourceFile);
  if (cached) return cached;
  const checker = program.getTypeChecker();
  let nodesBySpan;
  const lookup = (node) => {
    nodesBySpan ??= indexNodesBySpan(sourceFile);
    return nodesBySpan.get(`${String(node.range[0])}:${String(node.range[1])}`);
  };
  const esTreeNodeToTSNodeMap = {
    get(node) {
      const tsNode = lookup(node);
      if (!tsNode) {
        throw new Error(
          `with-types: no TypeScript node at ${String(node.range[0])}-${String(node.range[1])} in ${sourceFile.fileName}`,
        );
      }
      return tsNode;
    },
    has: (node) => lookup(node) !== undefined,
  };
  const services = {
    program,
    esTreeNodeToTSNodeMap,
    tsNodeToESTreeNodeMap: new WeakMap(),
    getTypeAtLocation: (node) => checker.getTypeAtLocation(esTreeNodeToTSNodeMap.get(node)),
    getSymbolAtLocation: (node) => checker.getSymbolAtLocation(esTreeNodeToTSNodeMap.get(node)),
    emitDecoratorMetadata: false,
    experimentalDecorators: false,
    isolatedDeclarations: false,
  };
  servicesBySourceFile.set(sourceFile, services);
  return services;
}

/**
 * Wraps a frozen object in a Proxy over `{}` that serves `overrides` first
 * and forwards everything else, binding methods to the original.
 * @param target The object to forward to.
 * @param overrides The keys to replace.
 * @returns The forwarding proxy.
 */
function forwardWith(target, overrides) {
  return new Proxy(
    {},
    {
      get(_, key) {
        if (Object.hasOwn(overrides, key)) return overrides[key];
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    },
  );
}

/**
 * Finds the parser services for the file being linted, or `undefined` when
 * the file is plain JavaScript (which ESLint lints without types) or no
 * `tsconfig` covers it.
 * @param context The Oxlint rule context.
 * @returns The parser services, or `undefined`.
 */
function servicesFor(context) {
  const fileName = path.resolve(context.physicalFilename ?? context.filename);
  if (UNTYPED_EXTENSIONS.has(path.extname(fileName))) return;
  const configPath = resolveConfigPath(fileName);
  if (!configPath) return;
  const program = programFor(configPath);
  const sourceFile = program.getSourceFile(fileName);
  return sourceFile ? createParserServices(program, sourceFile) : undefined;
}

/** Message reported when a file that needs types has no covering `tsconfig`. */
const UNCOVERED_FILE_MESSAGE =
  "No tsconfig covers {{fileName}}, so this file cannot be type-checked. Add it to a tsconfig `include`.";

/**
 * Runs an ESLint rule under Oxlint with the TypeScript parser services ESLint
 * would give it (`sourceCode.parserServices`), from a TypeScript program
 * cached per `tsconfig`. Oxlint's context is frozen, so the rule gets a
 * Proxy over `{}` that forwards to it. Requires `typescript`'s 6.x
 * JavaScript API.
 *
 * - `requireTypes: true` (rules that cannot run without types): a file with
 *   no covering `tsconfig` is reported as `uncoveredFile`, never skipped.
 * - `requireTypes: false` (rules that only use types when they exist, like
 *   unicorn's): JavaScript files and uncovered files run without types,
 *   exactly as under ESLint with `disableTypeChecked`.
 * @param rule The original ESLint rule.
 * @param options How to treat files without types.
 * @param options.requireTypes Whether a file without types is an error.
 * @returns The same rule, with types supplied.
 */
export function withTypes(rule, { requireTypes }) {
  return {
    meta: requireTypes
      ? {
          ...rule.meta,
          messages: {
            ...rule.meta?.messages,
            uncoveredFile: UNCOVERED_FILE_MESSAGE,
          },
        }
      : rule.meta,
    create(context) {
      const parserServices = servicesFor(context);
      if (!parserServices) {
        if (!requireTypes) return rule.create(context);
        const fileName = context.physicalFilename ?? context.filename;
        return {
          Program(node) {
            context.report({
              node,
              messageId: "uncoveredFile",
              data: { fileName },
            });
          },
        };
      }
      const sourceCode = forwardWith(context.sourceCode, { parserServices });
      return rule.create(
        forwardWith(context, {
          sourceCode,
          parserServices,
          getSourceCode: () => sourceCode,
        }),
      );
    },
  };
}

/**
 * Wraps every rule of an ESLint plugin with {@link withTypes}.
 * @param plugin The original ESLint plugin.
 * @param name The plugin name Oxlint registers it under.
 * @param options Passed to {@link withTypes} for each rule.
 * @param options.requireTypes Whether a file without types is an error.
 * @returns A plugin with the same rule names, run with types.
 */
export function withTypesPlugin(plugin, name, options) {
  return {
    meta: { name },
    rules: Object.fromEntries(
      Object.entries(plugin.rules).map(([ruleName, rule]) => [ruleName, withTypes(rule, options)]),
    ),
  };
}
