"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api, type Page } from "@/lib/api";

/**
 * Landing target after sign-in. Pages are chosen from the sidebar now, so this
 * just forwards to the home page's editor rather than showing a second list.
 */
export default function PagesIndex() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pages = await api.get<Page[]>("/api/cms/pages");
        if (cancelled) return;
        const landing = pages.find((p) => p.route === "/") ?? pages[0];
        if (landing) router.replace(`/pages/${landing.id}`);
        else setError("No pages have been set up yet — run the CMS seeder.");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load pages");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="content">
        <div className="notice notice-error">{error}</div>
      </div>
    );
  }
  return <div className="empty">Opening…</div>;
}
