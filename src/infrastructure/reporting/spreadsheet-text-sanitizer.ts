const controls = /[\u0000-\u001f\u007f-\u009f]/g;
const dangerousPrefixes = new Set(['=', '+', '-', '@', '＝', '＋', '－', '＠']);

export function sanitizeSpreadsheetText(value: string): string {
  const normalized = value.replaceAll(controls, ' ').replaceAll(/\s+/g, ' ').trimEnd();
  const content = normalized.trimStart();
  if (content.length > 0 && dangerousPrefixes.has(content[0]!)) return `'${content}`;
  return normalized;
}
