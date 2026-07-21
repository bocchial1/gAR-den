export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
      <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-700">
        gAR-den v1
      </p>
      <h1 className="mt-4 text-4xl font-semibold text-slate-900">
        Garden scan processing scaffold
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">
        Next.js, Vitest, and Prisma are wired up at the repository root for
        the initial greenfield build.
      </p>
    </main>
  );
}
