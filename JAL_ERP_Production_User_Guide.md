# JAL ERP — Production Process: Step-by-Step User Guide

Prototype version 0.1 · Applies to the web app in `jal-erp-web/` (run with `npm run dev`, open http://localhost:5173)

---

## 1. The big picture

Raw jute becomes a finished export product by passing through up to 12 stages. In the ERP, **each stage is its own production order**, and **every shift on that order is recorded as a shift entry**. Everything else — yield, wastage, downtime, order progress, dashboards — is calculated from those entries.

```
Sales contract ──► MRP ──► Planned orders (one per stage) ──► Release ──► Shift entries ──► Complete ──► Close
                                                                              │
                                                                   Daily board · Process view · Dashboard
```

| Stage | What happens | Unit |
|---|---|---|
| 1 Raw Material Preparation | Selection, batching, softening | kg |
| 2 Carding | Fibre opening → card sliver | kg |
| 3 Drawing | Sliver alignment → drawn sliver | kg |
| 4 Spinning | Sliver → yarn | kg |
| 5 Winding | Yarn → beams, rolls or cops | kg / pcs |
| 6 Weaving | Yarn → cloth | kg / yd |
| 7 Lamination *(laminated sand bags only)* | Cloth + PE film | kg |
| 8 Cutting | Cloth → cut pieces | pcs |
| 9 Sewing | Cut pieces → bags | pcs |
| 10 Inspection | Quality check, rejects | pcs / yd |
| 11 Packing | Bags/cloth → bales or rolls | bales / rolls |
| 12 Finished Goods | Transfer to FG warehouse | bales / rolls |

Not every product uses every stage. **Sliver** stops after stage 3; **yarn and cops** after stage 5; **hessian cloth and geo soil saver** skip cutting and sewing; **sacking bags** use all of 1–6 and 8–12; **laminated sand bags** add stage 7. The *Production process* page shows this as the "Product routes" matrix.

## 2. Who does what

| Role (demo login) | Can do |
|---|---|
| **Production Manager** (`prod.manager`) | Maintain BOMs and routings, run MRP, create / release / complete / close orders, enter and post shift entries |
| **Factory Head** (`factory.head`) | Same as Production Manager, plus the executive dashboard |
| **Line Supervisor** (`supervisor`) | Enter and post shift entries for released orders; view orders and the daily board |
| **CEO / Board** (`ceo`, `board`) | View everything; no data entry |

Passwords are listed in `jal-erp-web/README.md`. Buttons on the login page fill them in.

## 3. One-time setup (Production Manager)

You only touch these when a product, recipe or machine arrangement changes.

### 3.1 Check the item and BOM for the product — *Engineering & planning → Items & BOM*

1. In **BOM explorer**, choose the product (e.g. *Standard B' Twill Sacking Bag*).
2. The tree shows everything that goes into **one shipping pack** (one bale), level by level, down to raw jute by grade. Check the six figures at the top: units per pack, pack weight, raw jute per pack and per bag, overall yield, number of BOM levels.
3. To correct a quantity or waste %, click **Edit BOM** on that line:
   - *Net qty* = how much of the input goes into one unit of output.
   - *Scrap %* = extra consumed as process waste.
   - The modal warns if the inputs weigh less than the output.
   - **Save BOM.**

### 3.2 Check the routing — *Engineering & planning → Routings*

1. Choose the product. The table lists its operations in order with the item each produces.
2. Where a stage has more than one work centre, pick the right one (sacking vs hessian looms, beaming vs cop winders, etc.).
3. Set planning **days** per operation and tick **QC** where an inspection lot must be raised.
4. **Save routing.**

## 4. Planning: from contract to orders — *Engineering & planning → MRP explosion*

1. Select the **product**, enter the **quantity** in its base unit (bags, yards, kg or cops), the **ship-by date**, the **sales contract** number and customer. Leave the contract blank for make-to-stock.
2. Click **Run MRP**. The system walks the routing backwards from the shipping pack:
   - **Gross** = what the next stage needs.
   - **From stock** = covered by stock on hand of that item.
   - **To produce** = the quantity a production order is needed for.
   - Dates are scheduled backwards from the ship-by date using the routing days. If "Must start by" is in the past, the lead time does not fit.
3. Read the right-hand **Purchase requisitions** table: raw jute by grade, batching oil, thread, strapping, labels — anything no operation makes.
4. Click **Create N planned orders**. One **Planned** order per stage is created, each tagged with the contract number and the item it must produce.
5. Correct **Stock on hand** at the bottom of the page if the illustrative figures are wrong; MRP nets against these.

> Tip: run MRP with the real free stock. Bales already allocated to another contract should not be counted.

## 5. Managing production orders — *Manufacturing → Production orders*

Each order has a lifecycle:

```
Planned ──Release──► Released ──(first shift entry posted)──► In progress ──Complete──► Completed ──Close──► Closed
   └──────────────Cancel──────────┘
```

1. **Find the order** — filter by stage, status or search by order number / product / contract. Click a row to open it.
2. **Release** it (Production Manager / Factory Head) when materials are available and the floor can start. Only released or in-progress orders accept shift entries.
3. **Start** is automatic: posting the first shift entry moves the order to *In progress*.
4. During the run the order page shows planned vs produced, completion %, yield, wastage, availability, and all shift entries with their status.
5. **Complete** when the planned quantity is reached (or the run is stopped), then **Close** to freeze it. Closing is blocked while any shift entry is still a *draft* (business rule BR-MFG-003).
6. **Cancel** is only possible before any entry is posted.

To create an order by hand instead of through MRP: **New order** → stage → product (only products that use that stage are listed) → quantity → dates → make-to-order (contract, customer) or make-to-stock → optionally tick *Release immediately*. For bag products the form shows the packing calculation (bales, containers, net weight).

## 6. Recording a shift — *Manufacturing → Shift entry* (Line Supervisor)

Do this **once per shift, per order** (optionally per machine), at the end of the shift.

1. **Production order** — pick the released/in-progress order for your stage. The screen shows the work centre and what the stage produces.
2. **Date and shift** — defaults to the current shift (A 06:00–14:00, B 14:00–22:00, C 22:00–06:00). Shift C belongs to the date it starts.
3. **Machine** — leave as *Whole line* for a section total, or choose one machine to record per machine.
4. **Quantities** — units change with the product and stage:
   - **Input** — what was fed in (kg of sliver, pcs of cut pieces, yd of cloth…).
   - **Good output** — what came out good.
   - **Rejected** — only at sewing and inspection.
   - **Waste by type (kg)** — card waste, thread waste, cuttings, etc. Enter actual weighed waste.
5. **Downtime** — minutes the machine/line was stopped, with a reason (breakdown, no material, power failure, changeover, no operator, preventive maintenance). Run time = 480 − downtime.
6. Watch the **Live check** panel on the right:
   - **Yield %** = good output kg ÷ input kg.
   - **Wastage %** = waste kg ÷ input kg; amber/red when above the stage's alert level.
   - **Unaccounted %** = what is neither output, reject nor recorded waste; red above 3% — usually waste that was not weighed.
   - A red message means the entry **cannot be posted**: e.g. output + waste exceed input by more than 2%, a duplicate entry for the same order/date/shift/machine, missing downtime reason, or future date.
7. **Save draft** to come back later (drafts can be edited or deleted from the order page), or **Post entry** to make it final. Posted entries cannot be edited — corrections are made by a reversal (not yet built in the prototype).

Pieces are converted to kilograms with the product's bag weight (B' Twill 1,020 g, Binola 907 g…), cloth by its weight per yard, bales by bags per bale — the conversion used is shown under the live check.

## 7. Watching the floor

- **Manufacturing → Daily board** — one row per stage: shift A / B / C output, day total, attainment vs target, yield, wastage, downtime. Red/amber figures are below 90% / 98% of target. Below it, a machine map (running / idle / down) and a list of stoppages. Use the arrows to move between days.
- **Manufacturing → Production process** — the twelve stage cards for a chosen date with output vs target, yield, wastage and machines running; the *Material flow* table (kg in → good kg → waste → unaccounted) and the *Product routes* matrix. Click a stage card to list its orders.
- **Dashboard** (management roles) — yesterday's and month-to-date attainment, process wastage, machine availability, bales packed, alerts (stages below target, wastage above alert, breakdowns, late shipments), 14-day output chart, yield/wastage by stage, downtime by reason.

## 8. Worked example — one container of B' Twill

1. **MRP**: product *Standard B' Twill*, quantity 19,500 bags (= 65 bales), ship-by in 3 weeks, contract SC/JAL/2627/0023. Run → with the demo stock, 12 bales and 4,200 loose bags are taken from stock and **12 stage orders** are suggested, from 6,175 kg batched jute down to 53 bales to pack; raw jute requirement 6.4 t. Click *Create 12 planned orders*.
2. **Orders**: filter *Planned*, open the Batching order, **Release**. Do the same as each upstream stage is ready to start.
3. **Shift entry** (Batching, shift A): input 2,100 kg raw jute, good output 2,040 kg, waste root cuttings 35 kg / dust 15 kg, downtime 20 min (changeover). Live check: yield 97.1%, wastage 2.4%, unaccounted 0.5% → green. **Post.** The order is now *In progress*.
4. Repeat each shift. When the order reaches its planned quantity, **Complete** then **Close**. Downstream orders (Carding → … → Packing) follow the same pattern.
5. Check the **Daily board** at the end of each day and the **Dashboard** the next morning.

## 9. Reading the numbers

| Figure | Meaning |
|---|---|
| Attainment | Good output ÷ target for the shifts reported so far |
| Yield | Good output weight ÷ input weight |
| Wastage | Recorded waste weight ÷ input weight (alert level differs per stage: carding 4%, spinning 3.5%, weaving 2.5%, sewing 0.8%…) |
| Unaccounted loss | 100 − yield − wastage − rejects; above 3% means waste was not weighed or input was mis-recorded |
| Availability | Run minutes ÷ (run + downtime minutes) |
| Raw → bag yield (process page) | Kilograms of bags passing inspection ÷ kilograms of raw jute batched that day |

## 10. Limits of the prototype

- Data lives in the browser (no server); each PC has its own copy.
- No material issue or lot tracking yet — consumption is recorded as quantities, not against specific lots.
- No reversal entry for a wrong posted shift entry; delete and re-post is only possible for drafts.
- MRP runs one contract line at a time.
- Machine running status, export orders, FG stock, attendance figures and all BOM/waste percentages are illustrative, to be replaced with JAL's actual figures.
