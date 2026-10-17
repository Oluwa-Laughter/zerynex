# Responsive Zerynex product layouts

Zerynex uses a shared layout system across the homepage, SDKs, agents,
documentation, single-PCZT workbench, stage comparator, and handoff tools.
Design and navigation are part of developer adoption: engineers must be
able to run a synthetic policy test or read a guide on phones, tablets,
and workstations without horizontal page scrolling.

## Shared width and spacing

The central CSS variables live in apps/web/app/rebrand.css:

    --zn-container: 1600px;
    --zn-gutter: clamp(18px, 4.25vw, 76px);

Content containers use width: 100%, max-width: var(--zn-container),
and centered horizontal margins. Headings use responsive clamp sizing
and text-wrap: pretty, rather than prematurely balancing every line.
Paragraphs stay at comfortable reading lengths while tables,
workbenches, and integration grids use the available canvas.

The fixed product navigation uses a smaller 1500px maximum width for
visual balance. Avoid unrelated site-wide widths on individual pages.

## Mobile navigation

At 980px and below, the shared navigation becomes a hamburger menu.
It covers Overview, SDKs, Agents, Docs, and Open workbench on all routes.

The navigation:
- focuses the first menu item when opened;
- loops keyboard focus through the menu and toggle;
- closes with Escape and restores focus;
- closes on outside click, navigation or switch to desktop width;
- locks background document scrolling while open;
- exposes aria-expanded and aria-controls.

Documentation has its own mobile section browser with Escape,
outside-click and route-change dismissal. Long code examples scroll
within their own code blocks rather than the page.

At narrow widths, the eleven Developer Tools integration choices
are all visible in a two-column grid, not a clipped horizontal strip.

## Motion, color, and accessibility

GSAP reveal animations must never remove unvisited tools from the
accessibility tree. Motion and CSS respect prefers-reduced-motion.
Touch targets should remain large enough for mobile use; interactions
must have meaningful accessible labels.

Use React Icons instead of emoji. Validate light, dark, and system
themes when updating typography or surfaces.

## Regression checks

Run lint, type checking, production build and desktop/mobile browser tests:

    cd apps/web
    pnpm lint
    pnpm typecheck
    pnpm build
    pnpm test:e2e

To audit viewport widths from 320px to 1920px and nine core routes,
start a local dev server in one terminal:

    pnpm exec next dev --hostname 127.0.0.1 --port 3100

Then, in another:

    pnpm audit:responsive

Decorative hero artwork deliberately extending beyond its clip is not
a failure. Unreachable controls, clipped text, global page scrolling,
and offscreen navigation are failures.

The real Rust/WASM scanner, stage comparison, handoff regression
examples, and MCP docs should remain functional after UI changes.
