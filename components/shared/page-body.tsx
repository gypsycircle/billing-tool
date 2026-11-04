// components/shared/page-body.tsx
// The levels of a page's spacing (see "Spacing" in CLAUDE.md). A page is its
// PageHeader, which keeps its own space below it, then:
//   PageBody   tiles, lists, tables, sections, charts
//   PageGroup  pieces of one record that belong together (a notice, its card, the panel under it)

import { PAGE_BODY, PAGE_GROUP } from "./layout-classes";

export const PageBody = ({ children }: { children: React.ReactNode }) => <div className={PAGE_BODY}>{children}</div>;

export const PageGroup = ({ children }: { children: React.ReactNode }) => <div className={PAGE_GROUP}>{children}</div>;
