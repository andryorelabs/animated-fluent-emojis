/**
 * ESLint rule banning `<style>` elements in `.astro` files, so component
 * styling stays in Tailwind classes and in `@theme` / `@utility` rules of the
 * site stylesheets under `apps/site/src/styles`. Registered as
 * `local/no-astro-style-blocks` in `eslint.config.mjs`.
 */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow <style> blocks in .astro files in favor of Tailwind classes and the site stylesheets.",
    },
    schema: [],
    messages: {
      noStyleBlock:
        "Move this <style> block into a Tailwind class or an @theme/@utility rule in apps/site/src/styles.",
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        const name = node.openingElement.name;
        if (name.type === "JSXIdentifier" && name.name === "style") {
          context.report({ node, messageId: "noStyleBlock" });
        }
      },
    };
  },
};

export default rule;
