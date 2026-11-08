export type Role = 'BOARD' | 'CEO' | 'FACTORY_HEAD' | 'PRODUCTION_MANAGER' | 'LINE_SUPERVISOR';

export type Permission =
  | 'dashboard.view'
  | 'production.view'
  | 'production.order.create'
  | 'production.order.release'
  | 'production.order.close'
  | 'production.entry.create'
  | 'production.entry.post';

export interface User {
  id: string;
  username: string;
  name: string;
  designation: string;
  role: Role;
  mfa: boolean;
}

export type StageCode =
  | 'BATCHING'
  | 'CARDING'
  | 'DRAWING'
  | 'SPINNING'
  | 'WINDING'
  | 'WEAVING'
  | 'LAMINATION'
  | 'CUTTING'
  | 'SEWING'
  | 'INSPECTION'
  | 'PACKING'
  | 'FG_TRANSFER';

export type Uom = 'KG' | 'PCS' | 'YD' | 'ROLL' | 'BALE';

/** Route family: which stages a product passes through (SRS FR-MFG-004 routing per product). */
export type RouteCode = 'SLIVER' | 'YARN' | 'COPS' | 'CLOTH' | 'GEO' | 'SACKING' | 'SAND_BAG' | 'SAND_BAG_LAM';

export interface Stage {
  code: StageCode;
  seq: number;
  name: string;
  activities: string;
  workCenter: string;
  /** Default units (sacking-bag route); other routes override via stageUoms(). */
  inputUom: Uom;
  outputUom: Uom;
  outputItem: string;
  /** Planned good output per day for the whole line, in outputUom. */
  dailyTarget: number;
  wasteTypes: string[];
  /** Wastage % above which an alert is raised. */
  wasteAlertPct: number;
  /** Whether rejected units are recorded separately from waste. */
  hasRejects: boolean;
  /** Set when the stage applies only to some products. */
  optionalFor?: string;
}

export interface Machine {
  id: string;
  code: string;
  name: string;
  stage: StageCode;
}

export type MachineState = 'RUNNING' | 'IDLE' | 'DOWN';

export interface ProductSpec {
  size?: string;
  weight?: string;
  porterShots?: string;
  stitching?: string;
  stripes?: string;
  count?: string;
  packing?: string;
  other?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  route: RouteCode;
  /** Unit in which the product is counted and stocked. */
  baseUom: Uom;
  /** Kilograms per one base unit (bag, yard, cop, kg). */
  kgPerBase: number;
  /** Shipping pack and how many base units it holds (300 bags per bale, 2,000 yd per bale, 75 yd per roll…). */
  packUom: 'BALE' | 'ROLL';
  unitsPerPack: number;
  packsPerCtr20?: number;
  spec: ProductSpec;
  /** Values not given in the customer spec and assumed for the prototype. */
  assumptions?: string;
  specConfirmed: boolean;
}

// ---------- Items, BOM, routing (SRS FR-MFG-003/004/005) ----------

export type ItemType = 'RAW' | 'SEMI' | 'FG' | 'PACK' | 'CONSUMABLE';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  uom: Uom;
  /** Kilograms per unit (1 for kg items). */
  kgPerUnit: number;
  /** Spec hint shown in lists (count, construction, grade). */
  spec?: string;
}

export interface BomLine {
  itemId: string;
  /** Net quantity of the input per ONE unit of output, in the input item's UOM. */
  qty: number;
  /** Extra consumption for process waste, % of qty. */
  scrapPct: number;
}

export interface Bom {
  id: string;
  outputItemId: string;
  stage: StageCode;
  lines: BomLine[];
  byproducts?: { itemId: string; qty: number }[];
  note?: string;
}

export interface WorkCenter {
  id: string;
  stage: StageCode;
  name: string;
}

export interface RoutingOp {
  seq: number;
  stage: StageCode;
  workCenterId: string;
  /** Item this operation produces. For pass-through operations it is the same item as the previous op. */
  outputItemId: string;
  /** No BOM: the item passes through with a loss allowance (inspection, FG transfer). */
  passThrough?: boolean;
  lossPct?: number;
  qcPoint: boolean;
  /** Planning lead time in days. */
  days: number;
}

export interface Routing {
  productId: string;
  ops: RoutingOp[];
}

export type OrderStatus = 'PLANNED' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'CANCELLED';

export interface HistoryItem {
  at: string;
  by: string;
  action: string;
}

export interface ProductionOrder {
  id: string;
  docNo: string;
  productId: string;
  stage: StageCode;
  plannedQty: number;
  plannedStart: string;
  plannedEnd: string;
  status: OrderStatus;
  contractRef?: string;
  customer?: string;
  remarks?: string;
  createdAt: string;
  createdBy: string;
  history: HistoryItem[];
}

export type ShiftCode = 'A' | 'B' | 'C';

export interface WasteLine {
  type: string;
  kg: number;
}

export interface ShiftEntry {
  id: string;
  docNo: string;
  orderId: string;
  stage: StageCode;
  date: string;
  shift: ShiftCode;
  /** Empty = whole line / work centre total. */
  machineId?: string;
  supervisor: string;
  inputQty: number;
  goodQty: number;
  rejectQty: number;
  waste: WasteLine[];
  inputKg: number;
  goodKg: number;
  rejectKg: number;
  runMinutes: number;
  downtimeMinutes: number;
  downtimeReason?: string;
  remarks?: string;
  status: 'DRAFT' | 'POSTED';
  createdAt: string;
  createdBy: string;
  postedAt?: string;
}
