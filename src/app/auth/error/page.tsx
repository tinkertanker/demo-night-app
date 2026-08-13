import { LinkButton } from "~/components/Button";
import { LogoConfetti } from "~/components/Confetti";
import Sticker from "~/components/Sticker";

const ERRORS: Record<
  string,
  { title: string; message: string; sticker: string; href: string; cta: string }
> = {
  AccessDenied: {
    title: "Access denied 😬",
    message: "You're not on the admin list for this app",
    sticker: "wrong",
    href: "/api/auth/signin",
    cta: "Try another account",
  },
  Configuration: {
    title: "Server error 🥲",
    message: "(hang with us!)",
    sticker: "crashed",
    href: "/",
    cta: "Back to home",
  },
  Verification: {
    title: "Link expired 😬",
    message: "That sign-in link is no longer valid",
    sticker: "facepalm",
    href: "/api/auth/signin",
    cta: "Sign in again",
  },
};

const DEFAULT_ERROR = {
  title: "Something went wrong 🥲",
  message: "(hang with us!)",
  sticker: "crashed",
  href: "/",
  cta: "Back to home",
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const { title, message, sticker, href, cta } =
    ERRORS[searchParams?.error ?? ""] ?? DEFAULT_ERROR;

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center px-4 pb-16 text-center text-black">
      <Sticker name={sticker} />
      <h1 className="pt-4 text-center text-2xl font-bold">{title}</h1>
      <p className="text-lg font-semibold italic text-gray-500">{message}</p>
      <LinkButton href={href}>{cta}</LinkButton>
      <div className="z-3 pointer-events-none fixed inset-0">
        <LogoConfetti />
      </div>
    </main>
  );
}
