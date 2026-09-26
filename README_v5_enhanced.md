# SENTINEL

SENTINEL is a compliance and audit workflow application for taking
uploaded source documents through auditing, findings, human review,
remediation, evidence analysis, monitoring, analytics, and governance
workflows.


## V5 — Production-Grade Compliance Platform

Sentinel is an organizational compliance operating system/workforce. V5 hardens the V1–V4 product around a governed, traceable audit record rather than adding another layer of chatbot features.

### V5 capabilities

- Formalized Firestore data-model/path helpers.
- Versioned audit schema (`schemaVersion: v5`).
- First-class `AnalysisRun` records for every AI workforce agent.
- AI provenance: agent, model, model version, prompt version, input documents, input evidence, lifecycle status, and output/error.
- Authoritative audit evidence records stored under each audit.
- Findings carry explicit evidence IDs, source document IDs, control IDs, and analysis-run traceability.
- Evidence graph IDs are deterministic and idempotent instead of index-only edge IDs.
- Retrieval provider abstraction with a deterministic hybrid/lexical fallback.
- Server-authoritative audit workspace API; the browser no longer depends on Firebase client authentication for live audit data.
- Audit workspace shows findings, authoritative evidence, controls, AI runs, and workforce activity in one trace.
- V4 server-side RBAC remains the authorization boundary.
- SHA-256 document baselines and continuous monitoring remain intact.

### Authoritative compliance chain

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

A Sentinel finding is no longer only an AI output. It is a governed record that can point back to the source evidence, organizational control, analysis run, risk assessment, and remediation task that produced the decision trail.

### Data model

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

### AI provenance

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

The current workforce orchestrator pins prompt versions explicitly to:

- `control-mapping-v5.1`
- `compliance-v5.1`
- `risk-v5.1`
- `remediation-v5.1`

### Retrieval

The retrieval layer depends on a `Retriever` interface. V5 ships with a deterministic `HybridRetriever` backed by lexical scoring, so the system remains operational without an embedding vendor. An embedding/vector implementation can be added behind the same interface without changing the audit workflow.

### Audit workspace

`/dashboard/audits/[auditId]` is the V5 product centerpiece. It presents:

- compliance status and risk posture;
- finding lifecycle and confidence;
- authoritative source evidence;
- mapped controls;
- analysis-run provenance;
- workforce activity;
- the executive audit summary.

The browser polls a server-authorized workspace endpoint rather than querying Firestore directly. This keeps Auth.js organization membership and V4 RBAC as the application security boundary.

### Existing product layers retained

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

### Runtime

```bash
npm install
npm run dev
```

For local Inngest development, run the Inngest Dev Server and configure the environment for the installed SDK/runtime.

### V5 verification status

The V5 package was statically reviewed and hardened, including organization scoping, server-side permissions, data paths, traceability, and deterministic graph IDs. Dependency installation/build verification depends on the environment being able to complete `npm install`; no successful production build is claimed unless that command completes and `npm run build` passes.

### Next boundary

V5 deliberately stops at production-grade evidence/provenance foundations. Regulatory intelligence, external regulatory connectors, SSO/SAML, SCIM, enterprise key management, integrations, and production-scale warehousing remain subsequent platform increments.

## Live Application

**https://sentinel-sable-nine.vercel.app**

## Current File Support

SENTINEL currently supports **`.txt` files**.

Sample files are included directly in the project root:

``` text
northstar_community_service_sample_documents/
```

Use the `.txt` files in this directory to test the application's
document ingestion and audit workflow.

## Getting Started

### 1. Open the live application

Visit:

https://sentinel-sable-nine.vercel.app

Sign in and open the dashboard.

### 2. Upload documents

From the dashboard, select **Documents**:

https://sentinel-sable-nine.vercel.app/dashboard/documents

Upload one or more `.txt` files from:

``` text
northstar_community_service_sample_documents/
```

These uploaded documents become available to the audit workflow.

### 3. Create and run an audit

After the documents have been uploaded, open **Audits**:

https://sentinel-sable-nine.vercel.app/dashboard/audits

Create an audit and select the uploaded documents as the source
material. Start the audit and open the resulting audit workspace to
follow its processing.

The audit workspace provides information such as audit progress, risk
information, findings, evidence, analysis runs, and workforce activity.

### 4. Inspect findings

After findings have been generated, open **Findings**:

https://sentinel-sable-nine.vercel.app/dashboard/findings

Use this section to inspect findings produced by the audit workflow,
including their severity, explanations, evidence, and associated audit
information.

### 5. Perform human review

Next, open **Human Review**:

https://sentinel-sable-nine.vercel.app/dashboard/review

This section is used to review findings that require human attention and
to take the appropriate review action.

### 6. Continue through the remaining workflow

After reviewing findings, the dashboard provides additional workflow
areas:

-   **Remediation** --- track remediation work associated with findings.
-   **Evidence Graph** --- explore relationships between evidence and
    audit data.
-   **Monitoring** --- configure and inspect ongoing monitoring
    schedules.
-   **Analytics** --- inspect audit and compliance analytics.
-   **Governance** --- inspect governance-related information and
    controls.
-   **Policies & Controls** --- inspect policies and associated
    controls.
-   **Workforce** --- inspect compliance workforce and analysis
    activity.

## Dashboard Navigation

The current dashboard exposes the following navigation sections:

  -------------------------------------------------------------------------
  Section                 Route                     Purpose
  ----------------------- ------------------------- -----------------------
  **SENTINEL**            `/dashboard`              Main dashboard

  **Overview**            `/dashboard`              High-level system
                                                    overview

  **Documents**           `/dashboard/documents`    Upload and manage
                                                    source documents

  **Audits**              `/dashboard/audits`       Create, run, and
                                                    inspect audits

  **Findings**            `/dashboard/findings`     Inspect audit findings

  **Policies & Controls** `/dashboard/policies`     Inspect policies and
                                                    controls

  **Workforce**           `/dashboard/workforce`    Inspect workforce and
                                                    analysis activity

  **Remediation**         `/dashboard/tasks`        Track remediation tasks

  **Evidence Graph**      `/dashboard/graph`        Explore evidence
                                                    relationships

  **Monitoring**          `/dashboard/monitoring`   Configure and inspect
                                                    monitoring

  **Human Review**        `/dashboard/review`       Review findings
                                                    requiring human
                                                    attention

  **Analytics**           `/dashboard/analytics`    Inspect analytics

  **Governance**          `/dashboard/governance`   Inspect governance
                                                    information
  -------------------------------------------------------------------------

The dashboard navigation is currently presented as a compact, underlined
line of text, as shown in the provided dashboard reference image.

## End-to-End Test Flow

``` text
Live Application
      ↓
Sign in
      ↓
Documents
      ↓
Upload .txt sample documents
      ↓
Audits
      ↓
Create / run an audit
      ↓
Open the audit workspace
      ↓
Findings
      ↓
Inspect generated findings
      ↓
Human Review
      ↓
Review findings and take human review actions
      ↓
Remediation
      ↓
Track remediation tasks
      ↓
Evidence Graph
      ↓
Explore evidence relationships
      ↓
Monitoring
      ↓
Configure ongoing monitoring
      ↓
Analytics
      ↓
Review audit/compliance analytics
      ↓
Governance
      ↓
Review governance information
```

## Direct Links

-   [SENTINEL /
    Dashboard](https://sentinel-sable-nine.vercel.app/dashboard)
-   [Documents](https://sentinel-sable-nine.vercel.app/dashboard/documents)
-   [Audits](https://sentinel-sable-nine.vercel.app/dashboard/audits)
-   [Findings](https://sentinel-sable-nine.vercel.app/dashboard/findings)
-   [Policies &
    Controls](https://sentinel-sable-nine.vercel.app/dashboard/policies)
-   [Workforce](https://sentinel-sable-nine.vercel.app/dashboard/workforce)
-   [Remediation](https://sentinel-sable-nine.vercel.app/dashboard/tasks)
-   [Evidence
    Graph](https://sentinel-sable-nine.vercel.app/dashboard/graph)
-   [Monitoring](https://sentinel-sable-nine.vercel.app/dashboard/monitoring)
-   [Human
    Review](https://sentinel-sable-nine.vercel.app/dashboard/review)
-   [Analytics](https://sentinel-sable-nine.vercel.app/dashboard/analytics)
-   [Governance](https://sentinel-sable-nine.vercel.app/dashboard/governance)

## Sample Documents

Sample documents for testing are located at:

``` text
northstar_community_service_sample_documents/
```

The directory is located directly in the repository root.

At the moment, upload the `.txt` files from this directory when testing
the application.

## Recommended Demonstration

For a complete walkthrough:

1.  Open the live application.
2.  Sign in.
3.  Go to **Documents**.
4.  Upload the sample `.txt` files from
    `northstar_community_service_sample_documents/`.
5.  Go to **Audits**.
6.  Create and run an audit using the uploaded documents.
7.  Open the audit workspace.
8.  Go to **Findings** and inspect the generated findings.
9.  Go to **Human Review** and review the findings requiring human
    attention.
10. Continue to **Remediation**, **Evidence Graph**, **Monitoring**,
    **Analytics**, and **Governance** as needed.
