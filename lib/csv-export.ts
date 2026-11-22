/** Quote CSV cells and neutralize spreadsheet formulas without altering stored records. */
export function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  // Whitespace/control prefixes can conceal a formula from a simple first-character check.
  const unsafe = /^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text);
  const literal = unsafe ? `'${text}` : text;
  return `"${literal.replaceAll('"', '""')}"`;
}

export function csvDocument(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}