"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Award,
  BookOpen,
  Calendar,
  Camera,
  ClipboardList,
  FileText,
  Folder,
  GraduationCap,
  HardHat,
  Home,
  Info,
  Mail,
  Newspaper,
  PanelBottom,
  UserPlus,
  Users,
} from "@/components/icons";
import { api, type Page } from "@/lib/api";

/**
 * How the page list is grouped, following the site's own navigation rather
 * than the alphabet. Headings name a *kind* of page, so none of them repeats
 * the name of a page inside it. Anything not listed falls into the last group,
 * so a newly generated page still appears.
 */
const GROUPS: { label: string; routes: string[] }[] = [
  { label: "Site", routes: ["/", "/_global"] },
  {
    label: "Programs",
    routes: [
      "/applicants",
      "/apprentices",
      "/electrician-trainees",
      "/continuing-education",
    ],
  },
  { label: "About", routes: ["/about/about-eti", "/about/committees", "/about/photos"] },
  {
    label: "News & events",
    routes: ["/news", "/all-news", "/news-events", "/apprentice-of-the-month"],
  },
  { label: "Other pages", routes: ["/contact", "/resources", "/sign-up"] },
];

const GROUP_OF = new Map<string, number>();
GROUPS.forEach((g, i) => g.routes.forEach((r) => GROUP_OF.set(r, i)));

/**
 * An icon per top-level page, so the list is scannable by shape rather than by
 * reading every label. Child pages fall through to the generic document icon —
 * they are read in the context of the parent they sit under.
 */
type IconComponent = (props: { size?: number; className?: string }) => React.ReactElement;

const PAGE_ICONS: Record<string, IconComponent> = {
  "/": Home,
  "/_global": PanelBottom,
  "/applicants": ClipboardList,
  "/apprentices": GraduationCap,
  "/electrician-trainees": HardHat,
  "/continuing-education": BookOpen,
  "/about/about-eti": Info,
  "/about/committees": Users,
  "/about/photos": Camera,
  "/news": Newspaper,
  "/all-news": Newspaper,
  "/news-events": Calendar,
  "/apprentice-of-the-month": Award,
  "/contact": Mail,
  "/resources": Folder,
  "/sign-up": UserPlus,
};

type Node = { page: Page; children: Node[]; label: string };

const SITE_SUFFIX = "Electrical Training Institute";
const SEPARATORS = ["-", "–"];

/**
 * Drop the site name every page title ends with.
 *
 * String operations rather than a regular expression: the pattern this
 * replaced had an optional-whitespace group either side of a literal, which
 * backtracks badly on a title made mostly of spaces.
 */
function withoutSiteName(title: string): string {
  const name = title.trim();
  if (!name.toLowerCase().endsWith(SITE_SUFFIX.toLowerCase())) return name;
  const head = name.slice(0, -SITE_SUFFIX.length).trimEnd();
  // only strip it when a separator is actually there, so a page genuinely
  // called "Electrical Training Institute" survives
  return SEPARATORS.some((s) => head.endsWith(s))
    ? head.slice(0, -1).trimEnd()
    : name;
}

function titleOf(page: Page): string {
  return withoutSiteName(page.title);
}

/** "all-news" -> "All News", used when two pages share a title. */
function labelFromRoute(route: string): string {
  const tail = route.split("/").filter(Boolean).pop() ?? route;
  return tail
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Build the page tree.
 *
 * Nesting is by route, so a child page reads in the context of its parent —
 * that is what tells the five "FAQ" pages apart. Section headings are
 * deliberately absent: most of them only repeated the name of the page heading
 * the section ("APPLICANTS" above "Applicants"), and a heading above some rows
 * but not others made the un-headed ones look like they belonged to the group
 * above.
 */
function buildTree(pages: Page[]): Node[] {
  const byRoute = new Map(
    pages.map(
      (p) => [p.route, { page: p, children: [], label: titleOf(p) || labelFromRoute(p.route) } as Node],
    ),
  );

  const parentOf = (route: string): Node | undefined => {
    const parts = route.split("/").filter(Boolean);
    for (let i = parts.length - 1; i > 0; i--) {
      const node = byRoute.get("/" + parts.slice(0, i).join("/"));
      if (node) return node;
    }
    return undefined;
  };

  const roots: Node[] = [];
  for (const node of byRoute.values()) {
    const parent = parentOf(node.page.route);
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }

  const sortNodes = (nodes: Node[]) => {
    nodes.sort((a, b) => a.label.localeCompare(b.label));
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);

  /**
   * Titles repeat across the site — five pages are called "FAQ". Nesting
   * usually resolves that, since each sits under a different parent. Only when
   * two *siblings* share a title is the label genuinely ambiguous, and then the
   * route is what tells them apart ("News" vs "All News").
   */
  const disambiguate = (nodes: Node[]) => {
    const counts = new Map<string, number>();
    nodes.forEach((n) => counts.set(n.label, (counts.get(n.label) ?? 0) + 1));
    nodes.forEach((n) => {
      if ((counts.get(n.label) ?? 0) > 1) n.label = labelFromRoute(n.page.route);
      disambiguate(n.children);
    });
  };
  disambiguate(roots);

  return roots;
}

/** Ids of a node and everything under it. */
function idsUnder(node: Node, into: Set<number> = new Set()): Set<number> {
  into.add(node.page.id);
  node.children.forEach((c) => idsUnder(c, into));
  return into;
}

export default function PagesNav() {
  const pathname = usePathname();
  const [pages, setPages] = useState<Page[] | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // refetch on navigation so newly edited titles show up
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<Page[]>("/api/cms/pages");
        if (!cancelled) setPages(data);
      } catch {
        /* the page itself will surface the error */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const currentId = pathname.startsWith("/pages/")
    ? Number(pathname.split("/")[2])
    : null;

  const grouped = useMemo(() => {
    if (!pages) return [];
    const roots = buildTree(pages);
    const buckets: Node[][] = GROUPS.map(() => []);

    for (const node of roots) {
      const idx = GROUP_OF.get(node.page.route);
      buckets[idx ?? GROUPS.length - 1].push(node);
    }

    // inside a group, follow the curated order; anything unlisted goes last
    buckets.forEach((bucket, i) => {
      const order = GROUPS[i].routes;
      bucket.sort((a, b) => {
        const ia = order.indexOf(a.page.route);
        const ib = order.indexOf(b.page.route);
        if (ia === -1 && ib === -1) return a.label.localeCompare(b.label);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    });

    return GROUPS.map((g, i) => ({ label: g.label, nodes: buckets[i] })).filter(
      (g) => g.nodes.length > 0,
    );
  }, [pages]);

  const renderNode = (node: Node, depth: number): React.ReactNode => {
    const { page, children, label } = node;
    const hasKids = children.length > 0;
    const holdsCurrent = currentId != null && idsUnder(node).has(currentId);
    // the branch holding the open page starts expanded; a click overrides it
    const expanded = open[page.route] ?? holdsCurrent;
    const active = page.id === currentId;
    const Icon = PAGE_ICONS[page.route] ?? FileText;

    return (
      <div key={page.id} className={hasKids ? "nav-branch" : undefined}>
        <div className="nav-row">
          {hasKids ? (
            <button
              type="button"
              className="nav-twisty"
              aria-label={expanded ? "Collapse" : "Expand"}
              aria-expanded={expanded}
              onClick={() => setOpen((prev) => ({ ...prev, [page.route]: !expanded }))}
            >
              <span className={`caret${expanded ? " open" : ""}`}>›</span>
            </button>
          ) : (
            <span className="nav-twisty nav-twisty-empty" />
          )}
          <Link
            href={`/pages/${page.id}`}
            className={`nav-item${active ? " active" : ""}`}
            title={page.route}
          >
            <span className="nav-rail" aria-hidden="true" />
            <Icon size={17} className="nav-icon" />
            <span className="nav-label">{label}</span>
          </Link>
        </div>
        {hasKids && expanded ? (
          <div className="nav-children">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  if (!pages) return <div className="nav-loading">Loading pages…</div>;

  return (
    <>
      {grouped.map((group) => (
        <div className="nav-group" key={group.label}>
          <div className="nav-heading">{group.label}</div>
          {group.nodes.map((node) => renderNode(node, 0))}
        </div>
      ))}
    </>
  );
}
