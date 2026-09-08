export type TradeSide = "BUY" | "SELL";
export type AmountType = "QUOTE" | "BASE";
export type Liquidity = "HIGH" | "MEDIUM" | "LOW";
export type Strategy = "IMMEDIATE" | "SPLIT" | "WAIT" | "ABORT";
export type ExecutionMode = "LIVE" | "DEMO";

export interface ExecutionIntent {
  symbol: string;
  side: TradeSide;
  amount: number;
  amountType: AmountType;
  executionWindowMinutes: number;
  maxSlippagePercent: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface MarketSnapshot {
  symbol: string;
  timestamp: number;
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spreadAbsolute: number;
  spreadPercent: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  /** Where the book came from. Never fabricated. */
  source: string;
  /** True only when a demo control has perturbed the real book. */
  synthetic?: boolean;
}

export interface FillEstimate {
  /** False when the visible book cannot fill the request. */
  filled: boolean;
  totalQuote: number;
  totalBase: number;
  averagePrice: number;
  worstPrice: number;
  slippagePercent: number;
  /** Portion of the request the visible book could not absorb. */
  unfilled: number;
  levelsConsumed: number;
}

export type SliceStatus =
  | "PENDING"
  | "CHECKING"
  | "READY"
  | "EXECUTING"
  | "FILLED"
  | "PAUSED"
  | "FAILED"
  | "CANCELLED";

export interface ExecutionSlice {
  id: string;
  number: number;
  /** Denominated in intent.amountType. */
  amount: number;
  status: SliceStatus;
  expectedPrice?: number;
  averageFillPrice?: number;
  estimatedSlippagePercent?: number;
  filledBase?: number;
  filledQuote?: number;
  executedAt?: number;
  note?: string;
}

export type PlanStatus =
  | "PLANNED"
  | "APPROVED"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "ABORTED";

export type ActivityKind = "info" | "decision" | "fill" | "warn" | "error";

export interface ActivityEntry {
  t: number;
  kind: ActivityKind;
  message: string;
}

export interface ExecutionPlan {
  id: string;
  intent: ExecutionIntent;
  market: MarketSnapshot;
  strategy: Strategy;
  estimatedSlippagePercent: number;
  fullOrderEstimate: FillEstimate;
  liquidity: Liquidity;
  slices: ExecutionSlice[];
  reasoning: string[];
  status: PlanStatus;
  mode: ExecutionMode;
  createdAt: number;
  startedAt?: number;
  deadline?: number;
  activity: ActivityEntry[];
  /** Set by the demo shock control; expiry timestamp. */
  demoShockUntil?: number;
  lastDecision?: "CONTINUE" | "PAUSE" | "REPLAN" | "ABORT";
}

export interface ConstraintResult {
  valid: boolean;
  violations: string[];
  recommendedAction: "CONTINUE" | "PAUSE" | "REPLAN" | "ABORT";
}

export interface Capabilities {
  marketData: boolean;
  trading: boolean;
  detail: string;
}
