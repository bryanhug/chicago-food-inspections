import { useNavigate } from "@tanstack/react-router";
import { KNOWN_RESULTS } from "../../shared/summary";

export type HomeSearch = {
  q: string;
  result: string;
  facility: string;
  risk: string;
  zip: string;
};

export function SearchForm({
  search,
  facilityTypes,
  risks,
}: {
  search: HomeSearch;
  facilityTypes: string[];
  risks: string[];
}) {
  const navigate = useNavigate();
  return (
    <form
      className="filters"
      key={`${search.q}|${search.zip}|${search.result}|${search.facility}|${search.risk}`}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void navigate({
          to: "/",
          search: {
            q: String(data.get("q") ?? ""),
            result: String(data.get("result") ?? ""),
            facility: String(data.get("facility") ?? ""),
            risk: String(data.get("risk") ?? ""),
            zip: String(data.get("zip") ?? ""),
          },
        });
      }}
    >
      <label className="q">
        Name or address
        <input
          name="q"
          defaultValue={search.q}
          placeholder="Name, street, or zip"
          autoComplete="off"
        />
      </label>
      <label>
        Result
        <select name="result" defaultValue={search.result}>
          <option value="">Any result</option>
          {withCurrent(KNOWN_RESULTS, search.result).map((result) => (
            <option key={result} value={result}>
              {result}
            </option>
          ))}
        </select>
      </label>
      <label>
        Facility
        <select name="facility" defaultValue={search.facility}>
          <option value="">Any facility</option>
          {withCurrent(facilityTypes, search.facility).map((facility) => (
            <option key={facility} value={facility}>
              {facility}
            </option>
          ))}
        </select>
      </label>
      <label>
        Risk
        <select name="risk" defaultValue={search.risk}>
          <option value="">Any risk</option>
          {withCurrent(risks, search.risk).map((risk) => (
            <option key={risk} value={risk}>
              {risk}
            </option>
          ))}
        </select>
      </label>
      <label>
        Zip
        <input
          name="zip"
          inputMode="numeric"
          defaultValue={search.zip}
          placeholder="60601"
          autoComplete="postal-code"
        />
      </label>
      <button type="submit">Search</button>
    </form>
  );
}

function withCurrent(values: readonly string[], current: string): string[] {
  if (!current || values.includes(current)) return [...values];
  return [current, ...values];
}
