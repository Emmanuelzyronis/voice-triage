export interface CallSummary {
  id: string
  tenant_id: string
  status: 'active' | 'pending_approval' | 'approved' | 'rejected' | 'executed'
  category: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  created_at: string
  caller_snippet: string
  draft_summary: string
  elapsed_seconds: number
}

export type PipelineStage =
  | "parse"
  | "classify"
  | "research"
  | "draft"
  | "evaluate"
  | "approve"
  | "execute";

export type StageStatus = "idle" | "running" | "complete" | "error";

export type AppPhase =
  | "idle"          // mic not started
  | "recording"     // mic active, AI greeting delivered, user speaks first time
  | "conversation"  // multi-turn voice dialogue in progress
  | "pipeline"      // LangGraph stages running post-conversation
  | "approval"      // waiting at human gate
  | "executing"     // approved, execute node running
  | "complete"      // pipeline_complete received
  | "error";

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
  partial?: boolean;
}

export interface Evidence {
  observed: string[];
  inferred: string[];
  unknown: string[];
}

export interface ParsedIntent {
  raw_text: string;
  intent: string;
  entities: Record<string, string>;
  urgency: "low" | "normal" | "high" | "critical";
  evidence: Evidence;
}

export interface DraftSlots {
  greeting: string;
  body: string;
  action_items: string[];
  closing: string;
  caveats: string[];
}

export interface EvaluationVerdict {
  addresses_intent: boolean;
  factually_grounded: boolean;
  tone_appropriate: boolean;
  issues_found: string[];
  overall: "PASS" | "FAIL" | "NEEDS_EDIT";
}

export interface ApprovalPayload {
  state_id: string;
  category: string; // 'action_required' | 'escalate' | 'ambiguous' | 'defer' | 'info_request'
  classify_reason: string;
  parsed: ParsedIntent | null;
  draft: DraftSlots | null;
  evaluation: EvaluationVerdict | null;
}

export interface ExecuteResult {
  work_order_ref: string;
  action_items_taken: string[];
  executed_at: string;
  notes: string;
}

export interface PipelineCompletePayload {
  state_id: string;
  executed: boolean;
  approval_status: string;
  executed_result: ExecuteResult | null;
}
