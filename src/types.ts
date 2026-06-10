/**
 * Core types for kimi-harness — a planner harness for Kimi Code.
 *
 * Purpose: Turn vague user ideas into concrete, actionable plans
 * through interviews, research, and iterative refinement.
 */

// ───────────────────────────────────────────────
// Seed: raw user input
// ───────────────────────────────────────────────

export interface Seed {
  /** One-sentence mission. Immutable during evolution. */
  goal: string;
  /** Hard constraints every plan must respect. */
  constraints: string[];
  /** Explicitly out-of-scope items. */
  nonGoals?: string[];
  /** Max evolutionary generations before giving up. */
  maxGenerations?: number;
  /** Additional context the user provided. */
  context?: string;
}

// ───────────────────────────────────────────────
// Interview: clarify vague requirements
// ───────────────────────────────────────────────

export interface InterviewQA {
  id: string;
  /** The question to ask the user. */
  question: string;
  /** User's answer (undefined until answered). */
  answer?: string;
  /** Why this question is necessary. */
  reason: string;
}

// ───────────────────────────────────────────────
// Research: external investigation
// ───────────────────────────────────────────────

export interface ResearchItem {
  id: string;
  /** Search query or research topic. */
  query: string;
  /** Summary of findings. */
  summary: string;
  /** Optional source URL or reference. */
  source?: string;
}

// ───────────────────────────────────────────────
// Plan: concrete execution plan
// ───────────────────────────────────────────────

export interface PlanStep {
  id: string;
  description: string;
  /** Step IDs that must complete before this one. */
  dependsOn?: string[];
  /** Rough effort estimate (e.g. "2h", "1 day"). */
  estimatedEffort?: string;
  /** How to verify this step is complete. */
  verificationMethod?: string;
}

export interface Plan {
  id: string;
  version: number;
  goal: string;
  steps: PlanStep[];
  /** Assumptions the plan relies on. */
  assumptions: string[];
  /** Identified risks and mitigations. */
  risks: string[];
  /** Interviews conducted so far. */
  interviews: InterviewQA[];
  /** Research conducted so far. */
  research: ResearchItem[];
}

// ───────────────────────────────────────────────
// Verdict: evaluate plan quality
// ───────────────────────────────────────────────

export interface PlanVerdict {
  passed: boolean;
  /** 0.0–1.0 composite score. */
  score: number;
  /** 0 = crystal clear, 1 = completely vague. */
  ambiguity: number;
  /** 0 = missing critical pieces, 1 = fully specified. */
  completeness: number;
  /** 0 = impossible, 1 = trivially executable. */
  feasibility: number;
  /** 0 = off-track, 1 = perfectly aligned with seed.goal. */
  goalAlignment: number;
  /** Actionable feedback for the next iteration. */
  feedback: string;
  /** Additional questions to ask the user. */
  missingQuestions: string[];
  /** Additional research topics to investigate. */
  missingResearch: string[];
}

// ───────────────────────────────────────────────
// Evolution: refine plan based on verdict
// ───────────────────────────────────────────────

export interface PlanEvolution {
  /** Refined plan. */
  updatedPlan: Plan;
  /** New interview questions to ask. */
  interviewQuestions: string[];
  /** New research queries to run. */
  researchQueries: string[];
}

// ───────────────────────────────────────────────
// Loop options
// ───────────────────────────────────────────────

export interface LoopOptions {
  cwd: string;
  maxGenerations?: number;
  /** If true, stop immediately on first passing plan. */
  stopOnPass?: boolean;
}

// ───────────────────────────────────────────────
// Multi-Persona Evaluation (Phase 1)
// ───────────────────────────────────────────────

export type PersonaId = 'developer' | 'pm' | 'security' | 'ux';

export interface PersonaVerdict {
  persona: PersonaId;
  passed: boolean;
  /** 0.0–1.0 composite score (persona-weighted). */
  score: number;
  ambiguity: number;
  completeness: number;
  feasibility: number;
  goalAlignment: number;
  feedback: string;
  /** Issues that this persona considers blockers. */
  blockingIssues: string[];
}

export interface ConsensusVerdict extends PlanVerdict {
  personaVerdicts: PersonaVerdict[];
  /** Synthesized feedback explaining how consensus was reached. */
  consensusFeedback: string;
  /** List of dimension/persona disagreements that need resolution. */
  disagreements: string[];
}

// ───────────────────────────────────────────────
// Generational Memory (Phase 2)
// ───────────────────────────────────────────────

export interface GenerationMemory {
  generation: number;
  planSnapshot: Plan;
  verdict: ConsensusVerdict;
  strategiesAttempted: string[];
  failures: string[];
  improvements: string[];
  discardedIdeas: string[];
}

export interface MemoryArchive {
  seed: Seed;
  memories: GenerationMemory[];
  summary: string;
}
