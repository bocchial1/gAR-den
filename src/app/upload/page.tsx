import Link from "next/link";

import { UploadForm } from "@/components/UploadForm";

export default function UploadPage() {
  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-700">
            gAR-den
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Upload a garden scan
          </h1>
        </div>
        <Link
          href="/"
          className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          Home
        </Link>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">
        Send one model file from your phone, then stay on this page while the
        scan is processed into preview assets for the garden viewer.
      </p>

      <div className="mt-6">
        <UploadForm />
      </div>
    </main>
  );
}
