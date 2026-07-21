export type ScanRecord = {
  id: string;
  status: string;
  failureReason: string | null;
  sourceFilename?: string | null;
  widthMeters?: number | null;
  heightMeters?: number | null;
  hasPreview?: boolean;
};

export function renderStatusLabel(status: string) {
  switch (status) {
    case "processing":
      return "Processing upload";
    case "ready":
      return "Scan ready";
    case "failed":
      return "Scan failed";
    default:
      return "Status unavailable";
  }
}

function formatMeters(value: number | null | undefined) {
  if (typeof value !== "number") {
    return null;
  }

  return `${value.toFixed(1)} m`;
}

type ScanStatusProps = {
  scan: ScanRecord;
};

export function ScanStatus({ scan }: ScanStatusProps) {
  const label = renderStatusLabel(scan.status);
  const width = formatMeters(scan.widthMeters);
  const height = formatMeters(scan.heightMeters);
  const previewUrl =
    scan.hasPreview && scan.status === "ready"
      ? `/api/scans/${scan.id}/assets/preview`
      : null;

  return (
    <section
      aria-live="polite"
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">
            Scan status
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{label}</h2>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
          {scan.status}
        </span>
      </div>

      <dl className="mt-4 space-y-2 text-sm text-slate-600">
        <div className="flex items-start justify-between gap-3">
          <dt className="font-medium text-slate-700">Scan ID</dt>
          <dd className="break-all text-right">{scan.id}</dd>
        </div>
        {scan.sourceFilename ? (
          <div className="flex items-start justify-between gap-3">
            <dt className="font-medium text-slate-700">File</dt>
            <dd className="break-all text-right">{scan.sourceFilename}</dd>
          </div>
        ) : null}
        {width && height ? (
          <div className="flex items-start justify-between gap-3">
            <dt className="font-medium text-slate-700">Footprint</dt>
            <dd className="text-right">
              {width} x {height}
            </dd>
          </div>
        ) : null}
      </dl>

      {scan.status === "failed" && scan.failureReason ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {scan.failureReason}
        </p>
      ) : null}

      {previewUrl ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <img
            src={previewUrl}
            alt={`Preview for scan ${scan.id}`}
            className="block h-auto w-full"
          />
        </div>
      ) : null}
    </section>
  );
}
