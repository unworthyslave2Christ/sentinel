import { z } from "zod";

export const evidenceSchema = z.object({
  documentId: z.string().min(1), page: z.number().int().positive().optional(), section: z.string().optional(),
  text: z.string().min(1).max(4000), reason: z.string().min(1),
});

export const findingSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["LIABILITY","PRIVACY","REGULATORY","FINANCIAL","TERMINATION","INTELLECTUAL_PROPERTY","SECURITY","POLICY_CONFLICT","OTHER"]),
  severity: z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]), confidence: z.number().min(0).max(1),
  evidence: z.array(evidenceSchema).min(1), explanation: z.string().min(1), recommendation: z.string().min(1),
  controlIds: z.array(z.string()).default([]),
});

export const auditResultSchema = z.object({ summary: z.string(), findings: z.array(findingSchema) });

export const policySchema = z.object({
  name: z.string().min(2).max(160), description: z.string().max(2000).default(""),
  controls: z.array(z.object({ id: z.string().min(1).max(80), title: z.string().min(1).max(160), requirement: z.string().min(1).max(4000) })).default([]),
});

export const controlMappingSchema = z.object({
  mappings: z.array(z.object({ controlId: z.string(), relevance: z.number().min(0).max(1), rationale: z.string() })).default([]),
});

export const riskAssessmentSchema = z.object({
  overallSeverity: z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]), score: z.number().min(0).max(100), rationale: z.string(),
});

export const remediationSchema = z.object({
  actions: z.array(z.object({ title: z.string(), description: z.string(), priority: z.enum(["LOW","MEDIUM","HIGH","URGENT"]), dueInDays: z.number().int().min(1).max(365) })).default([]),
});
