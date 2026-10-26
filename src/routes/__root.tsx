import { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import "@fontsource/fraunces/600.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import type { ReactNode } from "react";
import appCss from "../styles/app.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "Chicago food inspections" },
      {
        name: "description",
        content:
          "City of Chicago restaurant inspection results, pass rates, and violation history.",
      },
      { name: "theme-color", content: "#f3efe4" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="mast">
          <div className="wrap mast-inner">
            <Link
              to="/"
              search={{ q: "", result: "", facility: "", risk: "", zip: "" }}
              className="brand"
            >
              <span className="stamp">CDPH</span>
              <span>
                <strong>Chicago food inspections</strong>
                <small>City results since 2010</small>
              </span>
            </Link>
          </div>
        </header>
        {children}
        <footer className="wrap site-footer">
          <p>
            Source: City of Chicago Food Inspections. Inspection dates are the
            calendar date recorded by CDPH. Sync times are Pacific Time.
          </p>
        </footer>
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main className="wrap">
      <h1>Page not found</h1>
      <p>
        <Link
          to="/"
          search={{ q: "", result: "", facility: "", risk: "", zip: "" }}
        >
          Back to recent inspections
        </Link>
      </p>
    </main>
  );
}

function RouteError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <main className="wrap">
      <h1>Something went wrong</h1>
      <p>{message}</p>
      <p>
        <Link
          to="/"
          search={{ q: "", result: "", facility: "", risk: "", zip: "" }}
        >
          Back to recent inspections
        </Link>
      </p>
    </main>
  );
}
