const RESULT_CLASS: Record<string, string> = {
  Pass: "pill pass",
  "Pass w/ Conditions": "pill conditions",
  Fail: "pill fail",
  "Out of Business": "pill closed",
  "No Entry": "pill muted",
  "Not Ready": "pill muted",
  "Business Not Located": "pill muted",
};

export function ResultPill({ result }: { result: string }) {
  return <span className={RESULT_CLASS[result] ?? "pill"}>{result}</span>;
}
