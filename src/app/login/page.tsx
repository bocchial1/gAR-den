import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

function getQueryValue(value?: string | string[]): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const callbackUrl = getQueryValue(params.callbackUrl) ?? "/garden";
  const error = getQueryValue(params.error);

  async function authenticate(formData: FormData) {
    "use server";

    try {
      await signIn("credentials", formData);
    } catch (caughtError) {
      if (
        caughtError instanceof AuthError &&
        caughtError.type === "CredentialsSignin"
      ) {
        redirect(
          `/login?error=Invalid%20email%20or%20password&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        );
      }

      throw caughtError;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-24">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-700">
          gAR-den
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use the single garden owner account configured in the environment.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <form action={authenticate} className="mt-6 space-y-4">
          <input type="hidden" name="redirectTo" value={callbackUrl} />

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              required
              name="email"
              type="email"
              defaultValue={process.env.GARDEN_USER_EMAIL}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-emerald-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              required
              name="password"
              type="password"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-emerald-500"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-500"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
