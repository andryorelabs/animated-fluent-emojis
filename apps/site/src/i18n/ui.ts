import type { Locale } from "./locales";
import { de } from "./ui/de";
import { en, type UiStrings } from "./ui/en";
import { es } from "./ui/es";
import { fr } from "./ui/fr";
import { it } from "./ui/it";
import { ja } from "./ui/ja";
import { ko } from "./ui/ko";
import { pt_BR } from "./ui/pt-br";
import { ru } from "./ui/ru";
import { zh_CN } from "./ui/zh-cn";

export type { UiStrings } from "./ui/en";

/**
 * UI strings for every locale. The `Record<Locale, ...>` type makes a missing
 * locale a type error; `ui.test.ts` checks every locale has every key.
 */
export const UI_STRINGS: Record<Locale, UiStrings> = {
  en,
  es,
  de,
  fr,
  it,
  ja,
  ko,
  "pt-BR": pt_BR,
  ru,
  "zh-CN": zh_CN,
};

/**
 * Returns the UI strings for a locale.
 * @param locale - A supported locale.
 * @returns The locale's strings.
 */
export function getUi(locale: Locale): UiStrings {
  return UI_STRINGS[locale];
}

/**
 * Flattens a nested string tree to sorted dotted key paths.
 * @param tree - UI strings for one locale.
 * @param prefix - Dotted path of the parent node.
 * @returns Sorted dotted key paths.
 */
export function flattenKeys(tree: object, prefix = ""): string[] {
  return Object.entries(tree)
    .flatMap(([key, value]: [string, unknown]) => {
      const path = prefix === "" ? key : `${prefix}.${key}`;
      return typeof value === "string" ? path : flattenKeys(value as object, path);
    })
    .toSorted((a, b) => a.localeCompare(b));
}
