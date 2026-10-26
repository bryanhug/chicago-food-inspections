export type ParsedViolation = {
  number: number;
  title: string;
  comment: string | null;
};

const SEPARATOR = " | ";

// Severity is intentionally not derived.
// The City of Chicago data portal says violation definitions changed on
// 2018-07-01 (Food Inspections dataset 4ijn-s7e5, "Note about 7/1/2018").
// CDPH describes Priority and Priority Foundation violations without a number
// map: https://www.chicago.gov/city/en/depts/cdph/provdrs/food_safety/svcs/understand_healthcoderequirementsforfoodestablishments.html
// An older portal dictionary mapped 1–14 as critical and 15–29 as serious,
// which does not match post-2018 numbers (47, 51, 55, and others on 2026 rows).
// Items stay { number, title, comment } until CDPH publishes one scheme for both eras.
const ITEM_PATTERN = /^(\d+)\.\s*(.*?)(?:\s+-\s+Comments:\s*([\s\S]*))?$/;

function parseItem(part: string): ParsedViolation | null {
  const trimmed = part.trim();
  if (!trimmed) return null;
  const match = ITEM_PATTERN.exec(trimmed);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isInteger(number)) return null;
  const comment = match[3];
  return {
    number,
    title: (match[2] ?? "").trim(),
    comment: comment == null ? null : comment.trim(),
  };
}

export function parseViolations(
  raw: string | null | undefined,
): ParsedViolation[] {
  if (raw == null) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parsed: ParsedViolation[] = [];
  for (const part of trimmed.split(SEPARATOR)) {
    const item = parseItem(part);
    if (item) parsed.push(item);
  }
  return parsed;
}
