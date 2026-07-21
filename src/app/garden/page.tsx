import Link from "next/link";
import { redirect } from "next/navigation";

import { HeightMapViewer } from "@/components/HeightMapViewer";
import { VersionList } from "@/components/VersionList";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { getOrCreateGarden, latestReadyScan } from "@/lib/garden";

type GardenPageProps = {
  searchParams?: Promise<{
    scanId?: string | string[];
  }>;
};

function getQueryValue(value?: string | string[]) {
  return typeof value === "string" ? value : undefined;
}

export default async function GardenPage({ searchParams }: GardenPageProps) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=%2Fgarden");
  }

  const garden = await getOrCreateGarden(userId);
  const [currentReadyScan, scans, params] = await Promise.all([
    latestReadyScan(garden.id),
    getPrisma().scanVersion.findMany({
      where: { gardenId: garden.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        sourceFilename: true,
        createdAt: true,
        minZ: true,
        maxZ: true,
        widthMeters: true,
        heightMeters: true,
        heightmapPath: true,
        boundaryPath: true,
      },
    }),
    searchParams,
  ]);

  if (scans.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-700">
          gAR-den
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-slate-900">
          Garden view
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Upload a scan to get started with the desktop garden viewer.
        </p>
        <div className="mt-8">
          <Link
            href="/upload"
            className="inline-flex rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white"
          >
            Upload a scan to get started
          </Link>
        </div>
      </main>
    );
  }

  const requestedScanId = getQueryValue((await params)?.scanId);
  const selectedScan =
    scans.find((scan) => scan.id === requestedScanId) ??
    scans.find((scan) => scan.id === currentReadyScan?.id) ??
    scans[0];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-700">
            gAR-den
          </p>
          <h1 className="mt-2 text-4xl font-semibold text-slate-900">
            Desktop garden viewer
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Review processed scans on a larger screen, inspect elevation, and switch between historical versions.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Home
          </Link>
          <Link
            href="/upload"
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            Upload scan
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <VersionList
          scans={scans}
          selectedScanId={selectedScan.id}
          currentScanId={currentReadyScan?.id ?? null}
        />

        <HeightMapViewer
          scanId={selectedScan.id}
          status={selectedScan.status}
          sourceFilename={selectedScan.sourceFilename}
          minZ={selectedScan.minZ}
          maxZ={selectedScan.maxZ}
          widthMeters={selectedScan.widthMeters}
          heightMeters={selectedScan.heightMeters}
          hasHeightmap={Boolean(selectedScan.heightmapPath)}
          hasBoundary={Boolean(selectedScan.boundaryPath)}
        />
      </div>
    </main>
  );
}
