import type { Metadata } from "next";
import { Inter, Playfair_Display, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import MachineViewToggle from "@/components/MachineViewToggle";
import { SITE_URL, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description:
    "How brands are adapting to AI-first discovery. Case studies, experiments, and tactical intelligence on AI brand visibility. Independent research from Para Labs.",
  keywords: [
    "AI brand visibility",
    "AI citations",
    "brand AI strategy",
    "AI discovery",
    "LLM brand mentions",
    "AI recommendations",
    "brand visibility",
    "AI marketing",
    "generative engine optimization",
    "AI search marketing",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      "How brands are adapting to AI-first discovery. Case studies, experiments, and tactical intelligence on AI brand visibility.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      "How brands are adapting to AI-first discovery. Case studies, experiments, and tactical intelligence.",
  },
  icons: {
    icon: ["/favicon.svg"],
    shortcut: ["/favicon.svg"],
    apple: ["/favicon.svg"],
  },
  alternates: { canonical: SITE_URL },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  category: "technology",
};

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": SITE_URL + "/#organization",
      name: SITE_NAME,
      description:
        "Independent AI brand visibility research lab. Case studies, experiments, and intelligence on how brands adapt to AI-first discovery.",
      url: SITE_URL,
      mainEntityOfPage: { "@type": "WebPage", "@id": SITE_URL },
      knowsAbout: [
        "AI Brand Visibility",
        "AI Citations",
        "Generative Engine Optimization",
        "AI Marketing Strategy",
        "Brand Discovery",
      ],
    },
    {
      "@type": "WebSite",
      "@id": SITE_URL + "/#website",
      url: SITE_URL,
      name: SITE_NAME,
      description: "AI brand visibility intelligence — how brands adapt to AI-first discovery.",
      publisher: { "@type": "Organization", "@id": SITE_URL + "/#organization" },
      potentialAction: [{ "@type": "ReadAction", target: SITE_URL + "/blog" }],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="paralabs-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("paralabs-theme");var r=document.documentElement;r.classList.remove("light","dark");if(t==="light")r.classList.add("light");else if(t==="dark")r.classList.add("dark")}catch(e){}})();`,
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        <link rel="alternate" type="application/rss+xml" title={SITE_NAME} href={SITE_URL + "/feed.xml"} />
        <meta name="theme-color" content="#fafaf9" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0c0a09" media="(prefers-color-scheme: dark)" />
      </head>
      <body className="min-h-screen bg-transparent font-sans text-nothing-primary antialiased">
        <Nav />
        <main data-human-content>{children}</main>
        <Footer />
        <MachineViewToggle />
      </body>
    </html>
  );
}
