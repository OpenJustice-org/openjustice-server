# OpenJustice — Security & Governance Implementation Plan

## Context

OpenJustice is a pan-African law enforcement platform built for the Sierra Leone Police Force and other African agencies. A devil's-advocate review from the perspective of the Inspector General identified 10 critical concerns spanning legal compliance, data integrity, access control, and operational governance. This plan provides concrete technical and process fixes for all 10 concerns before the system is considered production-ready.

---

## Concern 1: Chain of Custody — Legally Defensible

### Problem
Evidence chain of custody stored as a raw JSON field (`Evidence.chainOfCustody`) is not court-admissible in most jurisdictions and is not tamper-evident.

### Technical Fixes

**1a. New `CustodyEvent` Prisma Model**

Replace the JSON field with an immutable relational model:

```prisma
model CustodyEvent {
  id          String   @id @default(cuid())
  evidenceId  String
  evidence    Evidence @relation(fields: [evidenceId], references: [id])
  officerId   String
  officer     Officer  @relation(fields: [officerId], references: [id])
  action      CustodyAction  // COLLECTED | TRANSFERRED | EXAMINED | SEALED | SUBMITTED_TO_COURT
  fromLocation String?
  toLocation  String
  notes       String?
  signature   String   // SHA-256 hash of (evidenceId + officerId + timestamp + action)
  createdAt   DateTime @default(now())

  @@index([evidenceId])
}

enum CustodyAction {
  COLLECTED
  TRANSFERRED
  EXAMINED
  SEALED
  SUBMITTED_TO_COURT
  RETURNED
}
```

**Files to modify:**
- `openjustice-server/prisma/schema.prisma` — add `CustodyEvent` model, remove `chainOfCustody Json` from `Evidence`
- `openjustice-server/src/modules/evidence/evidence.service.ts` — replace JSON writes with `CustodyEvent` creates
- `openjustice-server/src/modules/evidence/dto/` — add `CreateCustodyEventDto`
- `openjustice-server/src/modules/evidence/evidence.controller.ts` — add `GET /evidence/:id/chain-of-custody` endpoint returning sorted events

**1b. PDF Certificate Generation**

Use the existing `@react-pdf/renderer` dependency to generate a printable chain of custody certificate.

**Files to create/modify:**
- `openjustice-server/src/modules/reports/templates/chain-of-custody.template.tsx` — React PDF template
- `openjustice-server/src/modules/reports/reports.service.ts` — add `generateCustodyCertificate(evidenceId)` method
- Add route: `GET /evidence/:id/custody-certificate` → returns PDF buffer

**1c. Cryptographic Signing**

Each `CustodyEvent.signature` = `SHA-256(evidenceId + officerId + action + createdAt)` computed server-side at insert time, never editable.

### Process Fix
- Engage the Sierra Leone Law Officers Department to validate the certificate format before go-live
- Add a legal review checkpoint to the deployment checklist in `docs/05-guides/`

---

## Concern 2: Biometric Data Without Legal Framework

### Problem
Fingerprint hashes collected from persons without a clear legal authority or consent record. No Sierra Leone data protection law yet enacted.

### Technical Fixes

**2a. Feature Flag in FrameworkConfig**

```prisma
// Add to FrameworkConfig model
biometricsEnabled     Boolean @default(false)
biometricLegalBasis   String? // Statutory reference once enacted
biometricConsentForm  String? // URL to approved consent form PDF
```

**Files to modify:**
- `openjustice-server/prisma/schema.prisma` — add fields to `FrameworkConfig`
- `openjustice-server/src/modules/persons/persons.service.ts` — check `config.biometricsEnabled` before accepting fingerprint hash; throw `403 ForbiddenException` if disabled
- `openjustice-client/` — hide biometric fields in the UI when flag is off

**2b. Consent Event Logging**

```prisma
model BiometricConsentLog {
  id           String   @id @default(cuid())
  personId     String
  officerId    String
  legalBasis   String   // e.g. "Police Act 1964 s.12" or "Warrant No. XYZ"
  consentType  String   // VOLUNTARY | COURT_ORDERED | ARREST
  witnessName  String?
  createdAt    DateTime @default(now())
}
```

**Files to modify:**
- `openjustice-server/prisma/schema.prisma` — add `BiometricConsentLog`
- `openjustice-server/src/modules/persons/persons.service.ts` — require `consentLog` payload when creating person with biometrics

### Process Fix
- Commission a Data Protection Impact Assessment (DPIA) — document in `docs/07-appendices/dpia.md`
- Biometrics remain disabled (`biometricsEnabled: false`) in all deployments until AG's office sign-off

---

## Concern 3: SuperAdmin Is a Single Point of Failure

### Problem
One role with unrestricted national access; no separation of duties; no oversight of the overseer.

### Technical Fixes

**3a. Dual Authorization for Sensitive Operations**

Create a `PendingApproval` model for high-risk actions:

```prisma
model PendingApproval {
  id           String         @id @default(cuid())
  requestedBy  String
  approvedBy   String?
  action       String
  payload      Json
  status       ApprovalStatus @default(PENDING)
  expiresAt    DateTime
  createdAt    DateTime       @default(now())
  resolvedAt   DateTime?
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}
```

**Sensitive operations requiring dual auth:**
- Bulk delete of persons/cases
- PIN reset for any officer at Commander level or above
- Granting/revoking interagency API access
- Exporting the national database
- Modifying `FrameworkConfig`

**Files to modify:**
- `openjustice-server/prisma/schema.prisma` — add `PendingApproval` model
- `openjustice-server/src/common/guards/dual-auth.guard.ts` — new guard checking for approved `PendingApproval` entry
- Apply `@UseDualAuth()` decorator on sensitive endpoints

**3b. Real-Time SuperAdmin Action Notifications**

- Every SuperAdmin action triggers an `AuditLog` entry AND sends an SMS/email notification to a configured oversight contact (`FrameworkConfig.oversightContactEmail`, `FrameworkConfig.oversightContactPhone`)
- Use existing BullMQ queue for notification delivery

**Files to modify:**
- `openjustice-server/src/modules/audit/audit.service.ts` — add notification dispatch for `roleLevel === 1` actions
- `openjustice-server/src/modules/framework-config/` — add oversight contact fields

**3c. Break-Glass Account**
- A sealed SuperAdmin account exists but requires a two-person physical ceremony to unseal (rotate a long random secret)
- Any use of the break-glass account triggers immediate SMS to all registered SuperAdmins

---

## Concern 4: No Whistleblower / Misconduct Reporting Path

### Problem
Officers who witness system abuse have no safe, anonymous internal reporting channel.

### Technical Fixes

**4a. New `IntegrityReport` Module**

```prisma
model IntegrityReport {
  id             String         @id @default(cuid())
  anonymousToken String         @unique
  category       ReportCategory
  description    String
  evidenceLog    String?
  status         ReportStatus   @default(OPEN)
  assignedTo     String?
  createdAt      DateTime       @default(now())
}

enum ReportCategory {
  UNAUTHORIZED_ACCESS
  DATA_ALTERATION
  EXCESSIVE_QUERIES
  IMPERSONATION
  OTHER
}

enum ReportStatus {
  OPEN
  UNDER_REVIEW
  CLOSED_ACTIONED
  CLOSED_UNFOUNDED
}
```

- Reports are submitted via a separate endpoint that does NOT log the submitting officer's identity in the report itself
- Only officers with a new `PROFESSIONAL_STANDARDS` role can view and manage reports

**Files to create:**
- `openjustice-server/src/modules/integrity/` — full NestJS module
- `openjustice-client/app/dashboard/integrity/` — reporting form and case management UI (Professional Standards only)

**4b. Automated Anomaly Detection**

Add a scheduled BullMQ job that flags suspicious patterns daily:

| Pattern | Threshold | Alert |
|---------|-----------|-------|
| Background checks by one officer | > 20/day | Flag for review |
| Records accessed outside assigned station | Any | Immediate flag |
| Audit log queries by non-admin | Any | Immediate flag |
| Off-hours access (midnight–5am) | > 3 sessions/week | Flag |
| Same NIN queried by multiple officers same day | > 3 | Flag |

**Files to create:**
- `openjustice-server/src/modules/integrity/anomaly-detection.job.ts` — BullMQ scheduled job
- `openjustice-server/src/modules/integrity/anomaly.service.ts` — detection logic

---

## Concern 5: Inter-Agency API Is a Trust Wildcard

### Problem
External agencies can query persons, issue warrants, and flag travel bans with minimal oversight.

### Technical Fixes

**5a. Agency Approval Workflow**

Add lifecycle states to the `Agency` model:

```prisma
// Extend existing Agency model
model Agency {
  // ... existing fields
  status           AgencyStatus @default(PENDING_APPROVAL)
  approvedBy       String?
  approvedAt       DateTime?
  scopePermissions Json
  accessExpiresAt  DateTime?
  lastActivityAt   DateTime?
}

enum AgencyStatus {
  PENDING_APPROVAL
  ACTIVE
  SUSPENDED
  REVOKED
}
```

**Files to modify:**
- `openjustice-server/prisma/schema.prisma`
- `openjustice-server/src/modules/interagency/interagency.service.ts` — reject requests from non-`ACTIVE` agencies; check `scopePermissions` per action
- Add admin UI for agency management with approval workflow

**5b. Warrant Confirmation Step**

Warrants issued via the interagency API should NOT take immediate effect:

1. API call creates a warrant in `PENDING_STATION_CONFIRMATION` status
2. A notification is sent to the relevant station commander
3. Commander has 24 hours to confirm or reject
4. Auto-rejection if no response (fail-safe default)

**Files to modify:**
- `openjustice-server/src/modules/interagency/interagency.controller.ts` — change warrant issuance flow
- Add `PENDING_STATION_CONFIRMATION` to warrant status enum

**5c. Granular Interagency Audit Log**

Log not just *that* a query happened, but *which specific fields* were returned:

```typescript
// In interagency response interceptor
auditLog.create({
  action: 'INTERAGENCY_QUERY',
  metadata: {
    agencyId,
    endpoint,
    queryParams,
    fieldsReturned: Object.keys(responseData),  // NOT the values
    recordCount: Array.isArray(responseData) ? responseData.length : 1,
  }
})
```

---

## Concern 6: WhatsApp Data Exposure

### Problem
Sensitive case data flows through Meta's (WhatsApp) servers.

### Technical Fixes

**6a. Data Classification Enforcement**

Define data tiers in `FrameworkConfig`:

```typescript
// whatsapp-allowed data categories (configured, not hardcoded)
WHATSAPP_ALLOWED_FIELDS = [
  'caseNumber', 'caseStatus', 'alertType', 'alertStatus'
  // Never: name, NIN, DOB, address, biometrics, fingerprint, coordinates
]
```

**Files to modify:**
- `openjustice-server/src/modules/whatsapp/whatsapp.service.ts` — add a `sanitizeForWhatsApp(data)` method that strips all non-whitelisted fields before sending
- `openjustice-server/src/modules/framework-config/` — add `whatsappAllowedFields` config

**6b. Reference Numbers Only**

WhatsApp responses return only: a short reference number + status code. Officers must log into the full dashboard to see details.

Example response: `"Case SL-2024-001847: OPEN. Log in to OpenJustice dashboard for details."`

**6c. Document the Risk**

- Add a prominent notice in the WhatsApp registration flow: "Queries are processed via WhatsApp/Meta infrastructure. Do not send classified information."
- Log acceptance of this notice in `WhatsAppSession`

---

## Concern 7: No Civil Oversight / Independent Auditor Access

### Problem
The force audits itself; no independent body can verify the audit log's integrity.

### Technical Fixes

**7a. New `AUDITOR` Role**

Add to the role hierarchy:

```
Level 0: ExternalAuditor (read-only, all audit logs, no operational data)
Level 1: SuperAdmin
...
```

- `ExternalAuditor` can query `AuditLog` only — no case data, no person records
- Separate login portal for auditors (no dashboard access)
- Session tokens for auditors are short-lived (2 hours max) and non-renewable

**Files to modify:**
- `openjustice-server/prisma/schema.prisma` — add role level 0
- `openjustice-server/src/modules/audit/audit.controller.ts` — add `@RequirePermissions('audit', 'read', 'national')` guard
- Seed data — create default ExternalAuditor role

**7b. Hash-Chained Audit Log**

Make the audit log tamper-evident:

```prisma
model AuditLog {
  // ... existing fields
  previousHash  String?
  entryHash     String   // SHA-256(id + action + actorId + timestamp + previousHash)
}
```

Any deletion or modification of an audit log entry breaks the chain, detectable by a verification job.

**Files to modify:**
- `openjustice-server/prisma/schema.prisma`
- `openjustice-server/src/modules/audit/audit.service.ts` — compute and store hashes on every insert

**7c. Automated Monthly Export to Oversight Body**

- BullMQ scheduled job exports the previous month's audit log to an encrypted S3 prefix accessible only to the external auditor's credentials
- Notification sent to oversight contact when export is ready

---

## Concern 8: Bulk Import = Mass False Records

### Problem
CSV bulk import allows thousands of unverified records to be created in one action.

### Technical Fixes

**8a. Import Staging Table**

```prisma
model BulkImportStagingRecord {
  id               String        @id @default(cuid())
  jobId            String
  job              BulkImportJob @relation(fields: [jobId], references: [id])
  rawData          Json
  validationErrors Json?
  status           StagingStatus @default(PENDING_REVIEW)
  reviewedBy       String?
  reviewedAt       DateTime?
  promotedAt       DateTime?
}

enum StagingStatus {
  PENDING_REVIEW
  APPROVED
  REJECTED
  PROMOTED
}
```

**Import flow:**
1. Upload CSV → records land in `BulkImportStagingRecord` with `PENDING_REVIEW`
2. Validation runs; errors flagged per-row
3. Station commander reviews and approves/rejects in the UI
4. Only after approval does `PROMOTED` records insert into live tables
5. Rejection reason is logged per record

**Files to modify:**
- `openjustice-server/prisma/schema.prisma`
- `openjustice-server/src/modules/bulk-import/bulk-import.service.ts` — implement staging pipeline
- `openjustice-client/app/dashboard/bulk-import/` — add review UI for commanders

**8b. Dual Authorization + Import Caps**

- Imports > 50 records require a second officer approval (same dual-auth mechanism as Concern 3)
- Hard cap: 500 records per job (configurable in `FrameworkConfig`)
- Mandatory `justification` text field required on every bulk import

**8c. Duplicate Detection**

Before staging, flag records that match existing:
- Same NIN → hard block
- Same name + DOB + gender → soft warning requiring manual override

---

## Concern 9: Offline Sync = Manipulation Risk

### Problem
Records created offline and synced later could be backdated or altered before hitting the server.

### Technical Fixes

**9a. Server-Side Timestamp Validation**

```typescript
// In sync.service.ts
const MAX_OFFLINE_DURATION_HOURS = 72; // configurable

if (record.createdAt < Date.now() - (MAX_OFFLINE_DURATION_HOURS * 3600 * 1000)) {
  throw new ConflictException('Record timestamp exceeds allowed offline window');
}
```

**Files to modify:**
- `openjustice-server/src/modules/sync/sync.service.ts`
- `openjustice-server/src/modules/framework-config/` — add `maxOfflineDurationHours` config

**9b. Device Binding & Registration**

```prisma
model RegisteredDevice {
  id                String    @id @default(cuid())
  officerId         String
  deviceFingerprint String
  approvedBy        String
  approvedAt        DateTime
  revokedAt         DateTime?
  lastSyncAt        DateTime?
}
```

- Offline sync only accepted from registered devices
- Device registration requires station commander approval
- Devices auto-expire after 90 days without re-registration

**9c. Offline Record Locking**

- Once a record syncs to the server successfully, the local IndexedDB entry is marked `synced: true` and the client prevents further edits
- All post-sync edits must go through the server API (online)
- Conflict resolution always favors server state; client-side changes on synced records are discarded with a visible warning

**9d. Sync Conflict Review Queue**

Any sync conflict (timestamp mismatch, duplicate record, schema mismatch) creates a `SyncConflict` entry visible to the station commander, not silently resolved.

---

## Concern 10: No Exit Strategy / Data Portability

### Problem
No documented export format, data retention policy, or migration path to a future system.

### Technical Fixes

**10a. Standard Export Endpoint**

```
GET /admin/export?format=json|csv&entities=persons,cases,evidence&dateRange=...
```

- Exports all core entities in a documented open schema
- Export format documented in `docs/07-appendices/export-schema.md`
- Export action requires dual SuperAdmin authorization (Concern 3 mechanism)
- Export is logged in audit trail with record counts

**Files to create/modify:**
- `openjustice-server/src/modules/admin/export.service.ts`
- `openjustice-server/src/modules/admin/admin.controller.ts`
- `docs/07-appendices/export-schema.md`

**10b. Data Retention Config**

Add retention periods to `FrameworkConfig`:

```prisma
// FrameworkConfig additions
caseRetentionYears         Int @default(10)
personRetentionYears       Int @default(7)
auditLogRetentionYears     Int @default(20)
evidenceRetentionYears     Int @default(15)
closedCaseArchiveAfterDays Int @default(365)
```

BullMQ scheduled job runs nightly to archive or soft-delete records past their retention period.

**10c. Schema Versioning Document**

- `docs/07-appendices/schema-changelog.md` — human-readable record of every schema change, reason, and migration
- Enforced: every Prisma migration must include an entry in this file (add to PR checklist)

---

## Implementation Priority Order

| Phase | Concerns | Rationale |
|-------|----------|-----------|
| **Phase 1 — Before Any Pilot** | 2 (biometrics flag), 6 (WhatsApp data), 10 (retention config) | Low-complexity; legal/privacy risk if not done |
| **Phase 2 — Before Station Rollout** | 1 (chain of custody), 3 (SuperAdmin controls), 8 (bulk import staging) | Medium complexity; directly affects data integrity |
| **Phase 3 — Before National Rollout** | 4 (whistleblower), 5 (interagency controls), 7 (auditor role + hash chain) | Higher complexity; governance and oversight infrastructure |
| **Phase 4 — Ongoing** | 9 (offline sync hardening) | High complexity; requires field testing to calibrate thresholds |

---

## Verification Checklist

For each concern, the following tests must pass before the fix is considered complete:

- [ ] **C1:** Court-printable PDF chain of custody generated for a test evidence item; custody events are immutable in DB
- [ ] **C2:** Fingerprint field rejected when `biometricsEnabled = false`; consent log created when enabled
- [ ] **C3:** A single SuperAdmin cannot complete a sensitive action without a second SuperAdmin approval; break-glass account triggers alerts
- [ ] **C4:** Integrity report submitted with no officer identity visible in DB; anomaly detection job flags test patterns
- [ ] **C5:** `PENDING` agency API key rejected; warrant requires station commander confirmation before status change
- [ ] **C6:** WhatsApp response for a person query contains no NIN, name, or biometric data
- [ ] **C7:** ExternalAuditor token can query audit logs but receives 403 on case/person endpoints; hash chain verification job passes
- [ ] **C8:** Bulk import of 100 records lands in staging, not live tables; requires commander approval to promote
- [ ] **C9:** Synced record cannot be edited offline; record with timestamp > 72hrs old is rejected on sync
- [ ] **C10:** Full export endpoint produces valid JSON with all entities; retention job correctly archives old records

---

## Critical Files Reference

| File | Concerns |
|------|----------|
| `openjustice-server/prisma/schema.prisma` | 1, 2, 3, 4, 5, 7, 8, 9, 10 |
| `openjustice-server/src/modules/evidence/evidence.service.ts` | 1 |
| `openjustice-server/src/modules/persons/persons.service.ts` | 2 |
| `openjustice-server/src/modules/audit/audit.service.ts` | 3, 7 |
| `openjustice-server/src/modules/bulk-import/bulk-import.service.ts` | 8 |
| `openjustice-server/src/modules/sync/sync.service.ts` | 9 |
| `openjustice-server/src/modules/interagency/interagency.service.ts` | 5 |
| `openjustice-server/src/modules/whatsapp/whatsapp.service.ts` | 6 |
| `openjustice-server/src/modules/framework-config/` | 2, 9, 10 |
| `openjustice-server/src/common/guards/` | 3, 5, 7 |
