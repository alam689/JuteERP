# JAL ERP — Web Prototype

Front-end prototype of the Jute Alliance Limited manufacturing ERP, built from
[JAL_ERP_Overview.md](../JAL_ERP_Overview.md) and the [SRS](../SRS/00_Introduction.md).

**Scope of this prototype:** login, executive dashboard, and the production process module
(process flow, production orders, shift production entry, daily board). There is no backend —
data lives in the browser (`localStorage`) and is seeded with 14 days of demo history.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
```

## Demo accounts

| Role | Username | Password | MFA code |
|---|---|---|---|
| Board / Samuda viewer | `board` | `Board@2026` | `246810` |
| CEO | `ceo` | `Ceo@2026` | `246810` |
| Factory Head | `factory.head` | `Factory@2026` | — |
| Production Manager | `prod.manager` | `Prod@2026` | — |
| Line Supervisor | `supervisor` | `Super@2026` | — |

The login page has buttons that fill these in. Board/CEO see dashboards read-only; Factory Head and
Production Manager can create, release and close orders and post shift entries; the Line Supervisor
can only enter and post shift entries (no dashboard). Five failed attempts lock an account for
15 minutes; sessions time out after 30 minutes idle (SRS NFR-SEC-001/002).

## What is real vs. illustrative

- **Production figures** (output, yield, wastage, downtime, order progress) are computed from posted
  shift entries — the seeded history plus anything you post. Business rules BR-MFG-001/002/003 and the
  UOM/packing rules from the SRS are implemented in `src/lib/calc.ts`.
- **Machine running status**, **export order book**, **FG stock**, **export proceeds** and
  **attendance** are placeholders for modules not yet built. They are not company figures.
- **Daily targets** per stage (~50 t/day raw jute → ~42,000 bags) are planning assumptions,
  to be replaced by JAL's actual capacity (SRS Q-13).
- **Product masters** (`src/data/masters.ts`) carry JAL's listed specifications (size, weight,
  porter × shots, stripes, packing, container loading) and a **route** — the subset of the 12 stages
  the product passes through (sliver 5, yarn/cops 7, hessian/geo 9, sacking bags 11, laminated sand
  bags 12). Values not in JAL's list (sand-bag weight, yarn roll weight, cops per bale) are marked as
  assumptions on screen.

- **Items, BOMs, routings and MRP** (`src/data/bom.ts`, `src/lib/mrp.ts`): ~90 items (raw jute grades,
  batch recipes, sliver, yarn by count, cloth by construction, cut pieces, packs, packaging), a multi-level
  BOM per item with scrap %, a routing per product with the work centre at each operation, and an MRP that
  explodes one contract line backwards along the routing, nets each level against stock on hand, and
  creates the stage-wise planned orders plus purchase requisitions. BOM quantities and waste percentages
  are planning estimates pending the mill's figures.

To reset the demo data, clear the site's local storage (keys `jal.production.v3`, `jal.bom.v3`), or use
"Reset BOMs, routings & stock" on the MRP page.

## Structure

```
src/
  auth/        AuthContext (login, MFA, lockout, idle timeout), route guards
  data/        masters (stages, machines, products), demo users, seed history, management placeholders
  lib/         calc (yield/waste/packing rules), metrics, formatting, theme, storage
  store/       ProductionStore — orders and shift entries, lifecycle rules
  pages/       Login, Dashboard, production/{ProcessFlow, Orders, OrderDetail, ShiftEntry, DailyBoard}
  components/  Layout, shared UI, icons
```

Stack: React 18, TypeScript, Vite, react-router, Recharts. Plain CSS with light/dark theming.
