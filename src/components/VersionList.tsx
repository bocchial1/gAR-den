import Link from "next/link";

import { renderStatusLabel } from "@/components/ScanStatus";

export type VersionListEntry = {
  id: string;
  status: string;
  sourceFilename: string | null;
  createdAt: Date;
};

type VersionListProps = {
  scans: VersionListEntry[];
  selectedScanId: string | null;
  currentScanId: string | null;
};

const formatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function VersionList({
  scans,
  selectedScanId,
  currentScanId,
}: VersionListProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-700">
          Scan versions
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">History</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Compare versions and keep the latest ready map marked as current.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {scans.map((scan) => {
          const isSelected = scan.id === selectedScanId;
          const isCurrent = scan.id === currentScanId;

          return (
            <Link
              key={scan.id}
              href={{ pathname: "/garden", query: { scanId: scan.id } }}
              className={`block rounded-2xl border px-4 py-4 transition ${
                isSelected
                  ? "border-emerald-500 bg-emerald-50 shadow-sm"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {scan.sourceFilename ?? "Unnamed scan"}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                    {formatter.format(scan.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {isCurrent ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-800">
                      Current
                    </span>
                  ) : null}
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                    {scan.status}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-600">
                {renderStatusLabel(scan.status)}
              </p>

              <p className="mt-3 break-all text-xs text-slate-500">
                Scan ID: {scan.id}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
