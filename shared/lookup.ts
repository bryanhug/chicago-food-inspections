export type LookupMode = "feed" | "text" | "zip";

export type LookupInput = {
  q: string;
  zip: string;
  result: string;
  facility: string;
  risk: string;
};

export type Lookup = LookupInput & { mode: LookupMode };

export function interpretLookup(input: LookupInput): Lookup {
  const q = input.q.trim();
  const zip = input.zip.trim();
  const filters = {
    result: input.result.trim(),
    facility: input.facility.trim(),
    risk: input.risk.trim(),
  };
  if (/^\d{5}$/.test(q) && !zip) {
    return { ...filters, q: "", zip: q, mode: "zip" };
  }
  if (q) return { ...filters, q, zip, mode: "text" };
  if (zip) return { ...filters, q: "", zip, mode: "zip" };
  return { ...filters, q: "", zip: "", mode: "feed" };
}
