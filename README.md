# Sentinel V5 — Production-Grade Compliance Platform

Sentinel is an organizational compliance operating system/workforce. V5 hardens the V1–V4 product around a governed, traceable audit record rather than adding another layer of chatbot features.

## V5 capabilities

- Formalized Firestore data-model/path helpers.
- Versioned audit schema (`schemaVersion: v5`).
- First-class `AnalysisRun` records for every AI workforce agent.
- AI provenance: agent, model, model version, prompt version, input documents, input evidence, lifecycle status and output/error.
- Authoritative audit evidence records stored under each audit.
- Findings carry explicit evidence IDs, source document IDs, control IDs and analysis-run traceability.
- Evidence graph IDs are deterministic and idempotent instead of index-only edge IDs.
- Retrieval provider abstraction with a deterministic hybrid/lexical fallback.
- Server-authoritative audit workspace API; the browser no longer depends on Firebase client authentication for live audit data.
- Audit workspace shows findings, authoritative evidence, controls, AI runs and workforce activity in one trace.
- V4 server-side RBAC remains the authorization boundary.
- SHA-256 document baselines and continuous monitoring remain intact.

## Authoritative compliance chain

```text
Regulation / Policy
        ↓
      Control
        ↓
     Document
        ↓
      Evidence
        ↓
     Finding
        ↓
       Risk
        ↓
  Remediation
        ↓
Resolution Evidence
        ↓
    Audit Trail
```

A Sentinel finding is no longer only an AI output. It is a governed record that can point back to the source evidence, organizational control, analysis run, risk assessment and remediation task that produced the decision trail.

## Data model

```text
Organization
 ├── Members
 ├── Documents
 ├── Policies
 ├── Controls (embedded in policies in V1–V5)
 ├── Audits
 │    ├── Findings
 │    ├── Evidence
 │    └── Events
 ├── AnalysisRuns
 ├── RemediationTasks
 ├── MonitoringSchedules
 ├── Alerts
 ├── EvidenceGraph
 └── SecurityAuditLogs
```

## AI provenance

Each workforce AI stage creates an `AnalysisRun`:

```text
AnalysisRun
├── auditId
├── agent
├── model
├── modelVersion
├── promptVersion
├── inputDocuments
├── inputEvidence
├── startedAt
├── completedAt
├── status
└── output / error
```

Current prompt versions are explicitly pinned in the workforce orchestrator (`control-mapping-v5.0`, `compliance-v5.0`, `risk-v5.0`, `remediation-v5.0`).

## Retrieval

The retrieval layer now depends on a `Retriever` interface. V5 ships with a deterministic `HybridRetriever` backed by lexical scoring, so the system remains operational without an embedding vendor. An embedding/vector implementation can be added behind the same interface without changing the audit workflow.

## Audit workspace

`/dashboard/audits/[auditId]` is the V5 product centerpiece. It presents:

- compliance status and risk posture;
- finding lifecycle and confidence;
- authoritative source evidence;
- mapped controls;
- analysis-run provenance;
- workforce activity;
- the executive audit summary.

The browser polls a server-authorized workspace endpoint rather than querying Firestore directly. This keeps Auth.js organization membership and V4 RBAC as the application security boundary.

## Existing product layers retained

```text
Auth.js
  ↓
Organization membership + RBAC
  ↓
Document ingestion
  ↓
Continuous monitoring
  ↓
Inngest workforce
  ↓
Ingestion → Controls → Compliance → Risk → Remediation
  ↓
Evidence + Findings + AnalysisRuns
  ↓
Human Review
  ↓
Governance + Analytics + Audit Trail
```

## Runtime

```bash
npm install
npm run dev
```

For local Inngest development, run the Inngest Dev Server and configure the environment for the installed SDK/runtime.

## V5 verification status

The V5 package was statically reviewed and hardened, including organization scoping, server-side permissions, data paths, traceability, and deterministic graph IDs. Dependency installation/build verification depends on the environment being able to complete `npm install`; no successful production build is claimed unless that command completes and `npm run build` passes.

## Next boundary

V5 deliberately stops at production-grade evidence/provenance foundations. Regulatory intelligence, external regulatory connectors, SSO/SAML, SCIM, enterprise key management, integrations, and production-scale warehousing remain subsequent platform increments.
