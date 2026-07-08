import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { Toaster } from "sonner";

import { TRPCReactProvider } from "~/trpc/react";

import { ModalProvider } from "~/components/modal/provider";

import "~/styles/globals.css";
import { getBranding } from "~/lib/branding.server";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  const appName = branding.appName;
  const orgName = branding.orgName;

  const title = `${appName} App | ${orgName}`;
  const description = `The premier platform for showcasing innovative ${appName.toLowerCase()}s, connecting builders, and discovering the next big ideas in technology.`;

  return {
    title: {
      default: title,
      template: `%s | ${appName} App`,
    },
    description,
    keywords: [
      appName.toLowerCase(),
      "technology showcase",
      "innovation",
      "startup demos",
      "product demos",
      "tech presentations",
      "developer showcase",
      "innovation platform",
      "startup pitch",
      "technology demos",
      "demo platform",
      "innovation showcase",
      "tech community",
      "product launch",
      "startup events",
      "demo competition",
      "technology exhibition",
      "innovation events",
      "demo presentations",
      "tech innovation",
    ],
    authors: [{ name: orgName }],
    creator: orgName,
    publisher: orgName,
    openGraph: {
      type: "website",
      locale: "en_US",
      title,
      description,
      siteName: `${appName} App`,
      images: [
        {
          url: "/opengraph-image.jpeg",
          width: 1200,
          height: 630,
          alt: `${appName} App - ${orgName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image.jpeg"],
    },
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    category: "Technology",
    classification: "Demo Platform",
    icons: [
      {
        rel: "icon",
        url: branding.isPitchNight ? "/favicon-pitch.ico" : "/favicon.ico",
      },
    ],
  };
}

export const viewport: Viewport = {
  themeColor: "#fff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${rubik.variable} font-sans`}>
      <body>
        <TRPCReactProvider>
          <Toaster position="top-center" />
          <ModalProvider>{children}</ModalProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}

const rubik = Rubik({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-rubik",
});
