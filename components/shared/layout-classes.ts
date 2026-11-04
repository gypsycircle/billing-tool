// components/shared/layout-classes.ts
// The classes a real layout and its loading screen (page-skeletons.tsx) must
// share, so the outline and the page line up and can't drift apart. A plain
// file, so server and client components can both import it.

// The page's spacing, one level inside the next: see "Spacing" in CLAUDE.md.
export const PAGE_HEADER = "rule-double mb-8 flex flex-col gap-5 pb-6 sm:flex-row sm:items-end sm:justify-between";
/** Under the header: tiles, lists, tables, sections, charts. */
export const PAGE_BODY = "space-y-10";
/** Pieces of one record that belong together: a notice, its card, the panel under it. */
export const PAGE_GROUP = "space-y-6";
/** A list: toolbar, table or cards, pager. A gap, not space-y: the table and the cards each hide on one screen size. */
export const LIST_STACK = "flex flex-col gap-4";
/** A section: its heading, then its content. */
export const SECTION_STACK = "space-y-4";
/** Phone cards, and what's inside each. */
export const CARD_STACK = "space-y-3";

/** The card every list, record and chart sits on. */
export const CARD = "rounded-xl border bg-card";

/** Joined tiles separated by hairlines (gap-px over the border colour). */
export const STAT_GRID = "grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border";
/** Tiles per row on wide screens (always two on phones). */
export const STAT_COLUMNS = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" } as const;
/** A tile's big figure, and any figure shown like one. */
export const STAT_FIGURE = "font-heading text-2xl leading-none font-medium tabular sm:text-[1.75rem]";


/** A saved record's grey band of facts, and its Bill to + Trip row. */
export const RECORD_BAND = "grid grid-cols-2 gap-4 bg-muted/60 px-6 py-4";
export const RECORD_PARTIES = "grid gap-6 px-6 py-6 sm:grid-cols-2";
/** A record's foot: its notes beside its figures. */
export const RECORD_FOOT = "grid gap-8 px-6 pt-4 pb-6 sm:grid-cols-[minmax(0,1fr)_18rem]";
/** The dashed panel of what's never printed. */
export const RECORD_PANEL = "grid gap-4 rounded-xl border border-dashed border-rule bg-card px-6 py-4 sm:grid-cols-[14rem_minmax(0,1fr)]";

/** A record's form page: the sections, and the sticky summary beside them. */
export const FORM_PAGE = "grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12";
export const FORM_SECTION = "grid gap-5 border-t pt-8 first:border-t-0 first:pt-0 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-8";
export const FORM_FIELDS = "grid gap-4 sm:grid-cols-2";
/** A form's main buttons: tall, and the full width of their column. */
export const FORM_BUTTON = "h-11 w-full";
