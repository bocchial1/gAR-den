import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=%2F");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
      <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-700">
        gAR-den v1
      </p>
      <h1 className="mt-4 text-4xl font-semibold text-slate-900">
        Garden scan processing
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">
        Upload a LiDAR mesh export from your phone, then review the baked
        height map and version history on desktop.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/upload"
          className="rounded-xl bg-emerald-600 px-5 py-3 text-center font-medium text-white"
        >
          Upload scan
        </Link>
        <Link
          href="/garden"
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center font-medium text-slate-800"
        >
          Open garden
        </Link>
      </div>
    </main>
  );
}
