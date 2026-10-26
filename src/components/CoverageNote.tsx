import { COVERAGE } from "../../shared/chicagoSource";

export function CoverageNote() {
  return (
    <ul className="coverage">
      {COVERAGE.map((source) => (
        <li key={source.id}>
          <strong>{source.label}</strong>
          <span>
            {source.availability === "available"
              ? "Available"
              : "Not available"}
          </span>
          <p>{source.detail}</p>
        </li>
      ))}
    </ul>
  );
}
