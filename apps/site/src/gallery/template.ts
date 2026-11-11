/**
 * Fills a `{name}` placeholder in a UI string. The value is inserted as is,
 * so a visitor's text containing `$` or braces is never interpreted.
 * @param template - The UI string.
 * @param name - The placeholder name, without braces.
 * @param value - The text to insert.
 * @returns The filled string.
 */
export function fillTemplate(template: string, name: string, value: string): string {
  return template.split(`{${name}}`).join(value);
}
