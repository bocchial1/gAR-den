"use client";

import { useEffect, useRef, useState } from "react";

import { ScanStatus, type ScanRecord } from "@/components/ScanStatus";

const ACCEPTED_TYPES = ".glb,.gltf,.obj,.zip";
const POLL_INTERVAL_MS = 2_000;

type UploadResponse = {
  scanId: string;
  status: "processing";
};

type ScanResponse = {
  id: string;
  status: string;
  failureReason: string | null;
  sourceFilename: string | null;
  widthMeters: number | null;
  heightMeters: number | null;
  hasPreview: boolean;
};

function toScanRecord(scan: ScanResponse | UploadResponse): ScanRecord {
  if ("scanId" in scan) {
    return {
      id: scan.scanId,
      status: scan.status,
      failureReason: null,
      sourceFilename: null,
      widthMeters: null,
      heightMeters: null,
      hasPreview: false,
    };
  }

  return {
    id: scan.id,
    status: scan.status,
    failureReason: scan.failureReason,
    sourceFilename: scan.sourceFilename,
    widthMeters: scan.widthMeters,
    heightMeters: scan.heightMeters,
    hasPreview: scan.hasPreview,
  };
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return fallback;
}

export function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scan, setScan] = useState<ScanRecord | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    if (!scan || scan.status !== "processing") {
      return;
    }

    let cancelled = false;

    const loadScan = async () => {
      try {
        const response = await fetch(`/api/scans/${scan.id}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          throw new Error(getErrorMessage(payload, "Unable to refresh scan status"));
        }

        if (!cancelled) {
          setScan(toScanRecord(payload as ScanResponse));
          setPollError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setPollError(
            error instanceof Error
              ? error.message
              : "Unable to refresh scan status",
          );
        }
      }
    };

    void loadScan();

    const intervalId = window.setInterval(() => {
      void loadScan();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [scan?.id, scan?.status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setFormError("Choose a model file to upload.");
      return;
    }

    setIsUploading(true);
    setFormError(null);
    setPollError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Upload failed"));
      }

      setScan(toScanRecord(payload as UploadResponse));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  function handleReset() {
    setSelectedFile(null);
    setScan(null);
    setFormError(null);
    setPollError(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Model file</span>
          <input
            ref={inputRef}
            required
            type="file"
            accept={ACCEPTED_TYPES}
            disabled={isUploading}
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setFormError(null);
            }}
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-4 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:font-medium file:text-white"
          />
        </label>

        <p className="mt-3 text-sm text-slate-500">
          Upload `.glb`, `.gltf`, `.obj`, or `.zip` files up to 50 MB.
        </p>

        {selectedFile ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Ready to upload: {selectedFile.name}
          </p>
        ) : null}

        {formError ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isUploading}
          className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          {isUploading ? "Uploading..." : "Upload and process"}
        </button>
      </form>

      {scan ? (
        <div className="space-y-4">
          <ScanStatus scan={scan} />

          {scan.status === "processing" ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Polling every 2 seconds until the scan is ready.
            </p>
          ) : null}

          {pollError ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {pollError}
            </p>
          ) : null}

          {scan.status === "failed" ? (
            <button
              type="button"
              onClick={handleReset}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800"
            >
              Upload another
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
