import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { type BuiltPage, prepareSecurityHeaders } from "./security-headers";

const [distributionDirectory, templatePath, outputPath] = process.argv.slice(2);
if (!distributionDirectory || !templatePath || !outputPath) {
  throw new Error("Usage: render-security-headers <dist> <template> <output>");
}

const pageFiles = readdirSync(distributionDirectory, {
  recursive: true,
  encoding: "utf8",
}).filter((file) => file.endsWith(".html"));

function* readPages(): Generator<BuiltPage> {
  for (const file of pageFiles) {
    yield {
      file,
      html: readFileSync(path.join(distributionDirectory ?? "", file), "utf8"),
    };
  }
}

const snippet = prepareSecurityHeaders(
  readPages,
  readFileSync(templatePath, "utf8"),
  ({ file, html }) => {
    writeFileSync(path.join(distributionDirectory, file), html);
  },
);
writeFileSync(outputPath, snippet);
console.log(`CSP: header rendered from ${String(pageFiles.length)} pages`);
