import { getBranding } from "~/lib/branding.server";

import HomePage from "./components/HomePage";

export async function generateMetadata() {
  const branding = await getBranding();
  return {
    title: branding.appName,
    robots: {
      index: true,
      follow: true,
    },
    icons: [
      {
        rel: "icon",
        url: "/favicon.ico",
      },
    ],
  };
}

export default function AttendeePage() {
  return <HomePage />;
}
