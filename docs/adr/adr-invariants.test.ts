import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  findAdrViolations,
  findIndexColumnViolations,
  findRelationViolations,
  findRelationWordingViolations,
  type AdrFile,
} from "./adr-checks";

const ADR_DIRECTORY = import.meta.dirname;
const ADR_FILE_PATTERN = /^(\d{4})-[\da-z-]+\.md$/;

function readAdrs(): AdrFile[] {
  return readdirSync(ADR_DIRECTORY)
    .filter((fileName) => ADR_FILE_PATTERN.test(fileName))
    .toSorted((left, right) => left.localeCompare(right))
    .map((fileName) => ({
      fileName,
      number: ADR_FILE_PATTERN.exec(fileName)?.[1] ?? "",
      content: readFileSync(path.join(ADR_DIRECTORY, fileName), "utf8"),
    }));
}

function fixtureRow(cell: string): string {
  return `| 0001 | [Fixture](0001-fixture.md) | Accepted | ${cell} |`;
}

function fixtureAdr(number: string, status = "Accepted"): AdrFile {
  return {
    fileName: `${number}-fixture.md`,
    number,
    content: `# ${number}: Fixture\n\n## Status\n\n${status}\n\nDate: 2026-10-17\n\n## Context\n\n## Decision\n\n## Consequences\n`,
  };
}

function withRevised(adr: AdrFile, line: string): AdrFile {
  return {
    ...adr,
    content: adr.content.replace("Date: 2026-10-17\n", () => `Date: 2026-10-17\n\n${line}\n`),
  };
}

describe("ADR invariants", () => {
  it("holds for the real ADRs", () => {
    const adrs = readAdrs();
    expect(adrs.length).toBeGreaterThan(0);
    const indexContent = readFileSync(path.join(ADR_DIRECTORY, "README.md"), "utf8");
    expect(findAdrViolations(adrs, indexContent)).toEqual([]);
  });
});

describe("findAdrViolations", () => {
  const index = "[a](0001-fixture.md) [b](0002-fixture.md)";

  it("accepts a valid set", () => {
    expect(findAdrViolations([fixtureAdr("0001"), fixtureAdr("0002")], index)).toEqual([]);
  });

  it("flags a duplicate number", () => {
    expect(findAdrViolations([fixtureAdr("0001"), fixtureAdr("0001")], index)).toContain(
      "duplicate ADR number",
    );
  });

  it("flags descending numbers", () => {
    expect(findAdrViolations([fixtureAdr("0002"), fixtureAdr("0001")], index)).toContain(
      "ADR numbers are not ascending",
    );
  });

  it("allows gaps in numbering", () => {
    expect(
      findAdrViolations(
        [fixtureAdr("0001"), fixtureAdr("0003")],
        "[a](0001-fixture.md) [b](0003-fixture.md)",
      ),
    ).toEqual([]);
  });

  it("flags an unknown status", () => {
    expect(findAdrViolations([fixtureAdr("0001", "Maybe")], index)).toContain(
      '0001-fixture.md: unknown status "Maybe"',
    );
  });

  it("flags a missing required section", () => {
    const adr: AdrFile = {
      ...fixtureAdr("0001"),
      content: fixtureAdr("0001").content.replace("## Consequences\n", ""),
    };
    expect(findAdrViolations([adr], index)).toContain(
      '0001-fixture.md: missing "## Consequences" section',
    );
  });

  it("flags a malformed Date line", () => {
    const malformed: AdrFile = {
      ...fixtureAdr("0001"),
      content: fixtureAdr("0001").content.replace("2026-10-17", "today"),
    };
    expect(findAdrViolations([malformed], index)).toContain(
      "0001-fixture.md: missing Date line in Status",
    );
  });

  it("flags a bad header", () => {
    const bad: AdrFile = { ...fixtureAdr("0003"), content: "# Oops\n" };
    expect(findAdrViolations([bad], index)).toContain("0003-fixture.md: bad header");
  });

  it("flags a malformed Revised line", () => {
    const adr = withRevised(fixtureAdr("0001"), "Revised: yesterday");
    expect(findAdrViolations([adr], "[a](0001-fixture.md)")).toContain(
      '0001-fixture.md: Revised line must be "Revised: YYYY-MM-DD, <text>"',
    );
  });

  it("accepts a well-formed Revised line", () => {
    const adr = withRevised(fixtureAdr("0001"), "Revised: 2026-10-19, fixed a fact.");
    expect(findAdrViolations([adr], "[a](0001-fixture.md)")).toEqual([]);
  });

  it("flags an unlisted ADR and an index entry with no file", () => {
    const unlisted = findAdrViolations(
      [fixtureAdr("0001"), fixtureAdr("0002")],
      "[a](0001-fixture.md)",
    );
    expect(unlisted).toContain("0002-fixture.md: not listed in README");
    expect(findAdrViolations([fixtureAdr("0001")], index)).toContain(
      "0002-fixture.md: listed in README but missing",
    );
  });
});

describe("findRelationWordingViolations", () => {
  it("flags relation wording without a linked ADR number", () => {
    expect(
      findRelationWordingViolations([fixtureAdr("0001", "Accepted. Amended by a later decision.")]),
    ).toEqual(["0001-fixture.md: relation wording must link the ADR number"]);
  });

  it("accepts linked wording wrapped across lines", () => {
    expect(
      findRelationWordingViolations([
        fixtureAdr("0001", "Accepted. Amended by\n[0002](0002-fixture.md)."),
      ]),
    ).toEqual([]);
  });
});

describe("findRelationViolations", () => {
  it("accepts relations recorded on both sides", () => {
    const adrs = [
      fixtureAdr("0001", "Accepted. Partly superseded by [0002](0002-fixture.md)."),
      fixtureAdr("0002", "Accepted. Partly supersedes [0001](0001-fixture.md)."),
    ];
    expect(findRelationViolations(adrs)).toEqual([]);
  });

  it("flags a one-sided forward relation", () => {
    const adrs = [
      fixtureAdr("0001"),
      fixtureAdr("0002", "Accepted. Extends [0001](0001-fixture.md)."),
    ];
    expect(findRelationViolations(adrs)).toContain(
      '0002-fixture.md: "Extends" 0001 is not recorded on 0001-fixture.md',
    );
  });

  it('flags a one-sided "by" relation', () => {
    const adrs = [
      fixtureAdr("0001", "Accepted. Superseded by [0002](0002-fixture.md)."),
      fixtureAdr("0002"),
    ];
    expect(findRelationViolations(adrs)).toContain(
      '0001-fixture.md: "Superseded by" 0002 is not recorded on 0002-fixture.md',
    );
  });

  it("flags a relation that links a missing ADR", () => {
    expect(
      findRelationViolations([fixtureAdr("0001", "Accepted. Amends [0009](0009-fixture.md).")]),
    ).toContain('0001-fixture.md: "Amends" links missing ADR 0009-fixture.md');
  });
});

describe("findIndexColumnViolations", () => {
  it("accepts a matching row", () => {
    expect(findIndexColumnViolations([fixtureAdr("0001")], fixtureRow("-"))).toEqual([]);
  });

  it("flags a title mismatch in a Prettier-padded row", () => {
    const paddedRow =
      "| 0001   | [Other](0001-fixture.md)                  | Accepted | -             |";
    expect(findIndexColumnViolations([fixtureAdr("0001")], paddedRow)).toContain(
      '0001-fixture.md: README title "Other" differs from "Fixture"',
    );
  });

  it("flags a Superseded or amended by mismatch", () => {
    const adrs = [fixtureAdr("0001", "Accepted. Partly superseded by [0002](0002-fixture.md).")];
    expect(findIndexColumnViolations(adrs, fixtureRow("-"))).toContain(
      '0001-fixture.md: README "Superseded or amended by" is "-", expected "0002 (partly)"',
    );
  });

  it("flags a claimed relation the files do not record", () => {
    expect(findIndexColumnViolations([fixtureAdr("0001")], fixtureRow("0002"))).toContain(
      '0001-fixture.md: README "Superseded or amended by" is "0002", expected "-"',
    );
  });
});
