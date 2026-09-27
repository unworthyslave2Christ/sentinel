import { signIn } from "@/server/auth";
import SentinelBrand from "@/components/sentinel-brand";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="flex justify-center">
          <SentinelBrand href="/" iconSize={56} textClassName="text-xl font-bold tracking-[0.2em]" />
        </div>
        <div className="mt-8 text-center">
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Continue with Google to access your organizational compliance workforce.
          </p>
        </div>
        <form action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/dashboard" });
        }} className="mt-6">
          <button className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white">
            Continue with Google
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-slate-400">
          New users are provisioned into their own Sentinel organization after authentication.
        </p>
      </div>
    </main>
  );
}
