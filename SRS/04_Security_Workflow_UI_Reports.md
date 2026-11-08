# JAL ERP — SRS Part 4

## Security, Approval Matrix, UI/UX & Reports

---

## 4.1 Role-Based Access Control (RBAC)

### 4.1.1 Model

```
User ──< UserRole >── Role ──< RolePermission >── Permission (module.resource.action)
  │                                                     actions: view | create | edit | submit | approve | post | cancel | export | print | admin
  └──< UserScope >── Company / Factory / Warehouse / Department / Cost Centre
```

- Permissions are **additive**; a user's effective permission = union of roles, filtered by data scope.
- **Data scope** restricts records (e.g. storekeeper sees only their warehouses; line in-charge only their lines). Enforced in the API and by PostgreSQL row-level security as a second line of defence.
- **Field-level security** for sensitive fields: salary, cost price, margin, bank account numbers.
- **Segregation of duties (SoD)**: the same user cannot create and approve the same document; conflicting role pairs are flagged (e.g. *Supplier Master Maintainer* + *Payment Approver*).

| ID | Requirement | Pri |
|---|---|---|
| FR-SEC-001 | Role and permission administration UI with role templates; changes audited. | M |
| FR-SEC-002 | Data scope assignment per user. | M |
| FR-SEC-003 | Field-level masking for cost, salary and bank fields. | M |
| FR-SEC-004 | SoD rule set with violation report; hard block on create-and-approve by same user. | M |
| FR-SEC-005 | Quarterly user access review report (users × roles × last login). | S |

### 4.1.2 Standard Roles (initial)

| Role | Key permissions |
|---|---|
| System Administrator | Users, roles, configuration, number series; no business transaction approval |
| Board / Samuda Viewer | Read-only dashboards and financial/operational reports (all factories) |
| CEO / MD | View all; final approval above top thresholds |
| CFO | Finance full; approve payments, vouchers, budgets, costing runs, period close |
| Accounts Officer | Vouchers, AP/AR, bank reconciliation (create/submit) |
| Factory Head | Production, inventory, quality, maintenance — view all; approve production plans, adjustments |
| Production Manager | MPS, production orders, close orders |
| Line In-charge / Supervisor | Shift production entry, downtime, wastage, overtime approval for own lines |
| Procurement Manager | RFQ, CS, PO; approve PR |
| Purchase Officer | PR, RFQ, quotations, PO draft |
| Raw Jute Purchaser | Raw jute contracts, gate/weighbridge, receipt |
| Store Manager / Storekeeper | GRN, issues, transfers, stock counts (own warehouses) |
| QC Manager / Inspector | Inspection results, usage decisions, NCR/CAPA; QC Manager releases holds |
| Sales / Marketing Manager | Customers, quotations, contracts; price approval within limit |
| Commercial Manager / Officer | LC, export documents, EXP, realisation, import LC |
| Logistics Officer | Shipment, booking, stuffing, packing list |
| HR Manager / HR Officer | Employee master, attendance, leave, payroll preparation |
| Payroll Approver | Approve payroll run (cannot edit) |
| Maintenance Manager / Technician | PM plans, work orders, spare requests |
| Cost Accountant | Standard cost, allocation runs, cost reports |
| Auditor (internal/external) | Read-only all modules incl. audit log; time-bound access |
| Employee (self-service) | Own payslip, attendance, leave |

---

## 4.2 Approval Matrix (initial — to be validated in Phase 1)

Amounts in BDT (functional currency equivalent). "→" means sequential steps.

| Document | Condition | Approval route |
|---|---|---|
| Purchase Requisition | Any | Department Head |
| Purchase Order (local) | ≤ 5 lakh | Procurement Manager |
| | > 5 lakh ≤ 50 lakh | Procurement Manager → Factory Head / CFO |
| | > 50 lakh | Procurement Manager → CFO → CEO |
| Raw jute PO / contract | ≤ 1 crore | Raw Jute Head → Factory Head |
| | > 1 crore | Raw Jute Head → CFO → CEO |
| Raw jute grade variance | Any | QC Manager → Raw Jute Head |
| CS — non-lowest supplier selected | Any | Additional approval: CFO |
| Supplier bill — 3-way match exception | Price/qty beyond tolerance | Procurement Manager → Accounts Manager |
| Payment voucher | ≤ 10 lakh | Accounts Manager → CFO |
| | > 10 lakh | Accounts Manager → CFO → CEO |
| Quotation / sales contract | Margin ≥ target | Sales Manager |
| | Margin < target | Sales Manager → CEO |
| Credit-term sale beyond limit | Any | CFO |
| Stock adjustment | ≤ 1 lakh | Store Manager → Factory Head |
| | > 1 lakh | Store Manager → Factory Head → CFO |
| Quality release of rejected lot | Any | QC Manager → Factory Head |
| Production order close with yield variance > threshold | Any | Production Manager → Factory Head |
| Import LC / B2B LC opening | Any | Commercial Manager → CFO |
| Overtime | Per employee per day | Line In-charge |
| Leave | ≤ 3 days | Line In-charge / Manager |
| | > 3 days | Manager → HR Manager |
| Payroll run | Any | HR Manager → Payroll Approver → CFO |
| Employee loan / advance | Any | HR Manager → CFO |
| Manual journal voucher | Any | Accounts Manager → CFO |
| Fixed asset disposal | Any | Factory Head → CFO → CEO |
| Price list change | Any | Sales Manager → CEO |

*(1 lakh = 100,000; 1 crore = 10,000,000.)*

All thresholds, routes and approvers are **configuration**, not code (FR-DMS-004).

---

## 4.3 UI/UX Principles

| ID | Principle |
|---|---|
| UX-01 | **Consistent layouts**: list view → detail/form view → document actions bar (Save, Submit, Approve, Post, Print, Attach, History). |
| UX-02 | **Keyboard-first data entry** for office users (tab order, shortcuts, grid entry for lines). |
| UX-03 | **Touch-first** shop-floor screens: large tap targets (≥ 48 px), minimal typing, pickers, barcode scan, offline queue. |
| UX-04 | Status badges and a timeline (created, submitted, approvals, posted) on every document. |
| UX-05 | Inline validation with clear messages stating what is wrong and how to fix it. |
| UX-06 | Global search (Ctrl+K) across documents, items, parties, bales, lots. |
| UX-07 | Drill-down from every report figure to source documents. |
| UX-08 | Responsive web (≥ 1366 px desktop, tablet 768 px+); light/dark themes; WCAG 2.1 AA contrast. |
| UX-09 | Bangla labels for worker self-service and shop-floor screens (Phase 5). |

---

## 4.4 Screen Inventory

Screens are grouped by module. **Type:** M = master, T = transaction, E = enquiry, R = report, D = dashboard, C = configuration. **Device:** W = web, T = tablet, H = handheld/mobile.

### 4.4.1 Common & Administration

| # | Screen | Type | Device |
|---|---|---|---|
| ADM-01 | Login / MFA / password reset | — | W/H |
| ADM-02 | Home dashboard (role-based) | D | W/H |
| ADM-03 | My approvals inbox | T | W/H |
| ADM-04 | Users, roles, permissions, data scopes | C | W |
| ADM-05 | Company, factory, department, cost centre | M | W |
| ADM-06 | Number series, fiscal years & periods, period lock | C | W |
| ADM-07 | Workflow designer (routes, conditions, approvers) | C | W |
| ADM-08 | Notification templates, print templates | C | W |
| ADM-09 | Audit log viewer | E | W |
| ADM-10 | Data import wizard | T | W |

### 4.4.2 Procurement

| # | Screen | Type | Device |
|---|---|---|---|
| PRC-01 | Supplier list / supplier form (tabs: general, contacts, bank, documents, items, rating) | M | W |
| PRC-02 | Purchase requisition | T | W/H |
| PRC-03 | RFQ & supplier quotations | T | W |
| PRC-04 | Comparative statement (side-by-side grid) | T | W |
| PRC-05 | Purchase order / amendment | T | W |
| PRC-06 | Raw jute contract | T | W |
| PRC-07 | Gate entry & weighbridge | T | W/T |
| PRC-08 | Raw jute receipt (moisture, grade, deductions calculator) | T | T |
| PRC-09 | GRN | T | W/H |
| PRC-10 | Supplier bill & 3-way match | T | W |
| PRC-11 | Purchase return | T | W |
| PRC-12 | Open PO / pending GRN enquiry | E | W |

### 4.4.3 Product Master

| # | Screen | Type | Device |
|---|---|---|---|
| PRD-01 | Item category & attribute template designer | C | W |
| PRD-02 | Item list / item form | M | W |
| PRD-03 | Product revision editor (attributes, tolerances, packing spec, BOM, routing, QC plan links; revision compare) | M | W |
| PRD-04 | UOM & conversions | M | W |
| PRD-05 | Packing calculator | E | W/H |

### 4.4.4 Inventory

| # | Screen | Type | Device |
|---|---|---|---|
| INV-01 | Warehouse / location / bin setup | M | W |
| INV-02 | Material requisition & issue | T | W/H |
| INV-03 | Stock transfer (send / receive) | T | W/H |
| INV-04 | Stock adjustment | T | W |
| INV-05 | Physical count (create, count via scanner, variance, post) | T | W/H |
| INV-06 | Gate pass | T | W |
| INV-07 | Stock enquiry (item × lot × location × status) | E | W/H |
| INV-08 | Lot / bale traceability explorer (forward/backward tree) | E | W |
| INV-09 | Bale label printing | T | W |

### 4.4.5 Production

| # | Screen | Type | Device |
|---|---|---|---|
| MFG-01 | Work centre & machine setup | M | W |
| MFG-02 | BOM editor (multi-level, waste %, by-products) | M | W |
| MFG-03 | Routing editor | M | W |
| MFG-04 | Batch recipe | M | W |
| MFG-05 | MPS & MRP run / suggestions | T | W |
| MFG-06 | Capacity load view | E | W |
| MFG-07 | Production order | T | W |
| MFG-08 | **Shift production entry** (per line/machine: output, consumption, waste, downtime) | T | T |
| MFG-09 | Production order close & variance | T | W |
| MFG-10 | Daily production board (live, by stage) | D | W/T |

### 4.4.6 Quality

| # | Screen | Type | Device |
|---|---|---|---|
| QMS-01 | QC parameter & inspection plan setup | M | W |
| QMS-02 | Inspection lot worklist | E | W/T |
| QMS-03 | Inspection result entry & usage decision | T | T |
| QMS-04 | Hold / release console | T | W |
| QMS-05 | NCR & CAPA | T | W |
| QMS-06 | Customer complaint | T | W |

### 4.4.7 Sales, Commercial & Logistics

| # | Screen | Type | Device |
|---|---|---|---|
| SAL-01 | Customer list / form | M | W |
| SAL-02 | Inquiry & quotation (with margin preview) | T | W |
| SAL-03 | Sales contract (lines, spec overrides, shipment schedule) | T | W |
| SAL-04 | Proforma invoice | T | W |
| SAL-05 | FG allocation (select bales) | T | W |
| SAL-06 | Order book enquiry | E | W |
| LC-01 | Export LC register / amendment | T | W |
| LC-02 | Import LC / B2B LC | T | W |
| LC-03 | Export document checklist & bank submission | T | W |
| LC-04 | EXP register & realisation entry | T | W |
| LC-05 | LC position dashboard | D | W |
| LOG-01 | Shipment plan & booking | T | W |
| LOG-02 | **Container stuffing** (scan bales) | T | H |
| LOG-03 | Packing list & commercial invoice | T | W |
| LOG-04 | Delivery challan / truck gate-out | T | W/H |
| LOG-05 | Shipment tracker | E | W |

### 4.4.8 Finance & Costing

| # | Screen | Type | Device |
|---|---|---|---|
| FIN-01 | Chart of accounts | M | W |
| FIN-02 | Voucher entry (JV/PV/RV/CV) | T | W |
| FIN-03 | AP: bills, payment proposal, payments | T | W |
| FIN-04 | AR: invoices, receipts, allocation | T | W |
| FIN-05 | Bank reconciliation | T | W |
| FIN-06 | Fixed asset register & depreciation run | T | W |
| FIN-07 | FX rates & revaluation | T | W |
| FIN-08 | VAT / tax registers | R | W |
| FIN-09 | Period close checklist | T | W |
| FIN-10 | Financial statements with drill-down | R | W |
| FIN-11 | Budget entry & budget vs. actual | T/R | W |
| CST-01 | Cost elements, pools, allocation rules | C | W |
| CST-02 | Standard cost roll-up | T | W |
| CST-03 | Monthly allocation & order settlement run | T | W |
| CST-04 | Production order cost sheet | E | W |
| CST-05 | Contract / shipment profitability | R | W |
| CST-06 | Quotation cost estimator | E | W |

### 4.4.9 HR & Payroll

| # | Screen | Type | Device |
|---|---|---|---|
| HR-01 | Employee list / profile (tabs: personal, job, pay, documents, history) | M | W |
| HR-02 | Organisation chart | E | W |
| HR-03 | Shift & roster planner | T | W |
| HR-04 | Attendance processing & correction | T | W |
| HR-05 | Overtime approval | T | W/H |
| HR-06 | Leave application & approval | T | W/H |
| HR-07 | Pay structure & piece rates | M | W |
| HR-08 | Payroll run (preview, variance, approve, post, bank file) | T | W |
| HR-09 | Loans & advances | T | W |
| HR-10 | Final settlement | T | W |
| HR-11 | Employee self-service (payslip, attendance, leave) | E | H/kiosk |

### 4.4.10 Maintenance

| # | Screen | Type | Device |
|---|---|---|---|
| MNT-01 | Equipment register | M | W |
| MNT-02 | PM plan & schedule calendar | M | W |
| MNT-03 | Breakdown request | T | H |
| MNT-04 | Work order (assign, labour, spares, close) | T | W/H |
| MNT-05 | Maintenance KPI dashboard | D | W |

---

## 4.5 MIS Report Catalogue

All reports support filters by date range, company, factory and relevant dimensions; output to screen, Excel and PDF; and scheduling by email.

### 4.5.1 Procurement

| ID | Report |
|---|---|
| RPT-PRC-01 | Purchase register (by supplier, item, period) |
| RPT-PRC-02 | Raw jute purchase analysis — grade × centre × month: qty, avg rate, moisture deduction % |
| RPT-PRC-03 | Purchase price variance (actual vs. last/standard) |
| RPT-PRC-04 | Open PR / PO / pending GRN |
| RPT-PRC-05 | Supplier performance scorecard |

### 4.5.2 Inventory

| ID | Report |
|---|---|
| RPT-INV-01 | Stock ledger (item card) with running balance and value |
| RPT-INV-02 | Stock summary by warehouse / category with valuation |
| RPT-INV-03 | Stock aging by lot |
| RPT-INV-04 | Slow-moving / non-moving stock |
| RPT-INV-05 | Batch / bale traceability report |
| RPT-INV-06 | Physical count variance |
| RPT-INV-07 | Reorder alert list |

### 4.5.3 Production

| ID | Report |
|---|---|
| RPT-MFG-01 | Daily production report (stage × shift × machine): target, actual, % |
| RPT-MFG-02 | Yield & wastage analysis by stage, product, period |
| RPT-MFG-03 | Material consumption vs. standard (usage variance) |
| RPT-MFG-04 | Machine utilisation / loom efficiency |
| RPT-MFG-05 | Downtime analysis by reason |
| RPT-MFG-06 | Production order status & WIP |
| RPT-MFG-07 | Power consumption per tonne / per unit |

### 4.5.4 Quality

| ID | Report |
|---|---|
| RPT-QMS-01 | Inspection summary (accept/reject by point, product) |
| RPT-QMS-02 | Defect Pareto |
| RPT-QMS-03 | NCR / CAPA status |
| RPT-QMS-04 | Supplier quality rating |
| RPT-QMS-05 | Customer complaints & claims |

### 4.5.5 Sales, Export & Commercial

| ID | Report |
|---|---|
| RPT-SAL-01 | Order book: ordered / produced / shipped / balance by contract |
| RPT-SAL-02 | Sales by customer, country, product, month (qty & value) |
| RPT-SAL-03 | Pending shipments vs. contract dates |
| RPT-SAL-04 | Export receivables aging |
| RPT-LC-01 | LC status: value, utilised, balance, expiry |
| RPT-LC-02 | Export document submission & acceptance status |
| RPT-LC-03 | EXP realisation status & overdue |
| RPT-LC-04 | B2B / import LC liability & maturity schedule |
| RPT-LOG-01 | Shipment register & container utilisation |
| RPT-SAL-05 | Cash incentive claims |

### 4.5.6 Finance & Costing

| ID | Report |
|---|---|
| RPT-FIN-01 | Trial balance (with dimensions) |
| RPT-FIN-02 | Profit & loss (actual vs. budget vs. last year) |
| RPT-FIN-03 | Balance sheet |
| RPT-FIN-04 | Cash flow statement |
| RPT-FIN-05 | General ledger / account statement |
| RPT-FIN-06 | AP / AR aging |
| RPT-FIN-07 | Bank book & reconciliation statement |
| RPT-FIN-08 | Fixed asset register & depreciation schedule |
| RPT-FIN-09 | VAT registers & withholding certificates |
| RPT-FIN-10 | Working capital & cash position |
| RPT-CST-01 | Product cost sheet (per kg/bag/bale/yard/roll/container) |
| RPT-CST-02 | Standard vs. actual cost variance |
| RPT-CST-03 | Contract / customer / country profitability |
| RPT-CST-04 | Product-wise gross profit trend |
| RPT-CST-05 | Cost of quality |

### 4.5.7 HR & Maintenance

| ID | Report |
|---|---|
| RPT-HR-01 | Daily attendance summary (by department/line/shift) |
| RPT-HR-02 | Overtime register & OT cost |
| RPT-HR-03 | Leave register & balances |
| RPT-HR-04 | Payroll register / salary sheet / bank advice |
| RPT-HR-05 | Manpower strength & turnover |
| RPT-HR-06 | Wage cost per unit of production |
| RPT-MNT-01 | Breakdown register |
| RPT-MNT-02 | Downtime, MTBF, MTTR by machine |
| RPT-MNT-03 | PM compliance |
| RPT-MNT-04 | Maintenance cost per machine / per unit output |

### 4.5.8 Executive KPIs

| KPI | Formula / source | Frequency |
|---|---|---|
| Production vs. target | Σ good output / Σ planned (by stage, product) | Daily |
| Production efficiency | Actual output / (run time × rated capacity) | Daily |
| Wastage % | Waste kg / input kg | Daily |
| Raw jute stock cover (days) | Raw jute stock / avg daily consumption | Daily |
| Machine downtime hrs | Σ downtime events | Daily |
| FG stock (bales, value) | Stock balance FG | Real-time |
| Export order fulfilment % | On-time shipped qty / due qty | Weekly |
| Container utilisation % | Actual bales / planned bales | Per shipment |
| Export proceeds | Realised amount (USD, BDT) | Monthly |
| Overdue EXP | Count & value past due date | Daily |
| Product-wise gross margin | CST profitability | Monthly |
| Attendance % | Present / rostered | Daily |
| Cash & bank position | Bank balances | Daily |
| Working capital | Current assets − current liabilities | Monthly |
