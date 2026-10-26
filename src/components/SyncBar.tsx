import { formatInspectionDay, formatPacific } from "../../shared/time";

export type SyncStatus = {
  dataAsOf: string | null;
  lastSyncAt: number | null;
  lastSyncStatus: string | null;
  lastSyncMode: string | null;
  rowsUpserted: number;
  error: string | null;
  facilityTypes: string[];
  risks: string[];
};

export function SyncBar({ status }: { status: SyncStatus }) {
  const when =
    status.lastSyncAt == null ? null : formatPacific(status.lastSyncAt);
  const asOf = status.dataAsOf ? formatInspectionDay(status.dataAsOf) : null;
  let line = "No sync yet.";
  if (status.lastSyncStatus === "running" && when) {
    line = `Sync in progress since ${when}.`;
  } else if (status.lastSyncStatus === "error" && when) {
    line = `Last sync failed ${when}.`;
  } else if (when) {
    line = `Last sync ${when}.`;
  }
  return (
    <p className="syncbar">
      <span>{line}</span>
      <span>
        {asOf ? `Data as of ${asOf}.` : "No inspection dates stored yet."}
      </span>
      {status.rowsUpserted > 0 ? (
        <span>
          {status.rowsUpserted.toLocaleString("en-US")} rows in that run.
        </span>
      ) : null}
      {status.error ? <span className="sync-error">{status.error}</span> : null}
    </p>
  );
}
