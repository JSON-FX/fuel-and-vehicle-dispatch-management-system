# Product Requirements Document (PRD)
# Fuel and Vehicle Dispatch Management System

**Organization:** Local Government Unit of Quezon, Bukidnon
**Product:** Fuel and Vehicle Dispatch Management System
**Primary Users:** PSMD staff, dispatch personnel, budget personnel, system administrators, authorized LGU users, auditors/viewers

---

## 1. Product Summary

The Fuel and Vehicle Dispatch Management System is a secure internal LGU application for recording fuel issuance, maintaining fuel balances, managing vehicle dispatches, and producing operational reports.

The system replaces fragmented/manual record keeping with a centralized transactional system that provides:

- controlled fuel recording;
- accurate fuel balances;
- vehicle and driver eligibility controls;
- dispatch tracking;
- budget/PPMP linkage;
- role-based access;
- immutable audit trail;
- Excel reporting;
- offline-tolerant operation for temporary connectivity disruptions.

The system is designed for maintainability using Next.js/React, Tailwind CSS, shadcn/ui, Node.js/Next.js API, and MySQL with DDD and Clean Architecture.

### Deployment Environment

The system shall be deployed on an **Ubuntu Server with CLI-only administration**, running the application stack in **Docker containers managed by Docker Compose**. The application is intended for LGU local-network access only and shall not require a graphical desktop or public cloud runtime.

The initial deployment may use a single hardened Ubuntu server sized for expected LGU concurrency. High-availability features such as MySQL standby replication and a separate write-restricted audit sink should use a second Ubuntu server/VM when available; placing both on the same physical host does not provide host-failure redundancy.

---

## 2. Problem Statement

LGU fuel and vehicle operations require traceable records for fuel issuance and official travel. Manual processes or loosely connected spreadsheets can create risks such as:

- inconsistent fuel balances;
- duplicate or missing records;
- weak authorization controls;
- difficulty reconciling vehicle movement with fuel issuance;
- slow report preparation;
- limited historical traceability;
- accidental changes to historical data;
- poor visibility of office-level utilization.

The proposed system creates a controlled, auditable operational record from transaction creation through reporting.

---

## 3. Objectives

### Primary Objectives

1. Centralize fuel and dispatch records.
2. Ensure accurate fuel issuance and balance accounting.
3. Generate unique RIS numbers automatically.
4. Link fuel transactions to vehicle, driver, destination, purpose, and budget allocation.
5. Track vehicle dispatch and odometer information.
6. Provide Excel exports by office and date period.
7. Enforce RBAC and immutable audit logging.
8. Support temporary offline operation without bypassing server authority.
9. Preserve master/reference records through soft deletion rather than destructive deletion.
10. Detect driver and vehicle schedule conflicts, provide availability views, and require explicit acknowledgment for permitted overrides.

### Success Indicators

- 100% of finalized fuel issuances have a unique RIS number.
- 100% of posted fuel issuances have corresponding ledger entries.
- 100% of sensitive create/update/post/void actions have audit entries.
- 0 duplicate vehicle plate numbers in active master data.
- 0 unauthorized successful access to protected endpoints in security testing.
- Report generation can reproduce historical transactions using stored transaction prices and quantities.

---

## 4. Scope

### In Scope

- Fuel Recording + Balances
- Vehicle Dispatch
- Budget Allocation / PPMP
- Office Management
- Vehicle Management
- Driver Management
- User and Permission Management
- Immutable Audit Trail
- Excel Reports
- Offline-capable frontend shell and transaction queue
- Authentication and RBAC
- Operational dashboards

### Out of Scope for Initial Release

- Full procurement lifecycle
- Payroll
- HR management
- General accounting
- Supplier payment processing
- GPS/live vehicle tracking
- Public-facing portal
- Mobile-native application

These can be future modules.

---

## 5. Personas and Roles

### PSMD Staff

Records fuel issuance, verifies liters issued, manages operational fuel records, and monitors balances.

### Dispatch Officer

Creates and completes vehicle dispatch records and monitors vehicle availability.

### Budget Officer

Maintains PPMP/budget allocation records and reviews utilization reports.

### System Administrator

Maintains users, roles, permissions, and reference data.

### Auditor / Viewer

Reads operational records and audit information but cannot modify transactions.

### Super Administrator

Performs controlled high-privilege administration subject to strict audit controls.

---

## 6. Functional Requirements

# A. Fuel Recording + Balances

## FR-FUEL-001 — Create Fuel Record

The system shall allow authorized users to create a fuel issuance record containing:

- Date Entry
- Purchase Request Number (manual)
- Driver Name
- Destination
- Purpose of Travel
- Vehicle Type
- Plate No.
- Request No. of Liters
- Unit Price per Liter
- Total Amount
- Budget Allocation (PPMP)
- Fuel Type

### Acceptance Criteria

- Required fields are validated server-side.
- Destination defaults to `AOR`.
- Vehicle and driver are selected from managed master data.
- Vehicle type can be displayed from vehicle master data rather than duplicated as an authoritative field.

---

## FR-FUEL-002 — RIS Number Generation

The system shall generate an RIS Number in the format:

```text
YYYY-MM-XXX
```

Example:

```text
2026-08-001
```

### Acceptance Criteria

- Client cannot choose the RIS number.
- Number is generated inside the server transaction.
- Concurrent submissions cannot produce duplicates.
- Database uniqueness prevents duplicate RIS numbers.
- Sequence resets by month.

---

## FR-FUEL-003 — Full Tank

The system shall support a full-tank request.

### Acceptance Criteria

- User can select `Full Tank`.
- Actual liters issued are entered by authorized PSMD personnel.
- Actual issued quantity becomes the basis for amount calculation and ledger posting.
- A full-tank transaction cannot be posted without actual issued liters.

---

## FR-FUEL-004 — Fuel Price

The system shall allow manual entry of unit price because fuel price may change without prior notice.

### Acceptance Criteria

- Unit price is stored on each transaction.
- Historical transaction totals do not change when a future price changes.
- Total amount is calculated from the transaction's issued liters and unit price.

---

## FR-FUEL-005 — Fuel Total

```text
Total Amount = Issued Liters × Unit Price
```

The backend is authoritative for financial calculation.

---

## FR-FUEL-006 — Fuel Types

Supported fuel types for initial release:

- Diesel
- Gasoline

The design must allow future fuel types without large schema changes.

---

## FR-FUEL-007 — Fuel Balance

The system shall maintain fuel balances using a transaction ledger.

### Acceptance Criteria

Balance must reconcile as:

```text
Opening Balance + Receipts + Adjustments - Issuances = Closing Balance
```

Historical ledger transactions cannot be directly edited or deleted.

---

## FR-FUEL-008 — Void Transaction

Authorized users may void a posted fuel issuance.

### Acceptance Criteria

- Requires explicit permission.
- Reason is mandatory.
- Original transaction remains visible.
- Ledger correction uses compensating entries where required.
- Audit trail captures who, when, why, and what changed.

---

# B. Vehicle Dispatch

## FR-DISPATCH-001 — Create Dispatch

The system shall capture:

- Driver Name
- Vehicle
- Date Entry
- Date Inclusion / Travel Date
- Destination
- Current ODO Meter
- ODO Meter After
- Passengers
- Office
- Purpose

---

## FR-DISPATCH-002 — Vehicle Eligibility

Only serviceable vehicles should be selectable for a standard dispatch.

---

## FR-DISPATCH-003 — Driver Eligibility

Only active drivers should be selectable for a standard dispatch.

---

## FR-DISPATCH-004 — Odometer Validation

### Acceptance Criteria

- Current ODO cannot be negative.
- ODO After cannot be lower than Current ODO.
- Completed dispatches must have a valid final ODO.
- Distance traveled is derived from ODO After minus ODO Before.

---

## FR-DISPATCH-005 — Dispatch Status

Initial states:

```text
DRAFT → DISPATCHED → COMPLETED
                  ↘ CANCELLED
DRAFT → CANCELLED
```

Illegal status transitions must be rejected by the application layer.

---

# C. Management Modules

## FR-MGMT-001 — Budget Allocation

Fields:

- PPMP Number
- Office Name
- Quarter
- Year
- Status

Quarter must be 1–4.

---

## FR-MGMT-002 — Office

Fields:

- Office Name
- Office Abbreviation
- Status

Office name and abbreviation must be unique.

---

## FR-MGMT-003 — Vehicle

Fields:

- Model/Brand
- Vehicle Type
- Plate No.
- Status
- Remarks

Plate number must be unique.

---

## FR-MGMT-004 — Driver

Fields:

- Name
- Contact No.
- Status

---

## FR-MGMT-005 — User Management

Fields:

- Full Name
- Username
- Email
- Password (write-only handling)
- Role
- User Permission
- Avatar

### Security Requirements

- Never store plaintext passwords.
- Password fields are never returned in API responses.
- Role and permission changes require authorization and audit events.

---

# D. Audit Trail

## FR-AUDIT-001 — Immutable Audit Logging

The system shall record an immutable audit event for sensitive actions.

Minimum event information:

- timestamp;
- actor;
- action;
- entity type;
- entity ID;
- request ID;
- before state where appropriate;
- after state where appropriate;
- reason/metadata where appropriate.

Audit events must be append-only.

# C. Soft Delete and Historical Preservation

## FR-ADMIN-010 — Soft Delete

Authorized users shall be able to soft-delete applicable master/reference records instead of physically deleting them.

Applicable records include, at minimum:

- offices;
- budget allocations;
- drivers;
- vehicles;
- users.

### Acceptance Criteria

- Soft-deleted records are excluded from default active selectors and lists.
- Historical fuel and dispatch records continue to display the referenced soft-deleted driver/vehicle/office.
- Deletion requires a reason and authenticated actor.
- Deletion creates an immutable audit event.
- Restore is available only to authorized users and creates an immutable audit event.
- Audit logs and fuel ledger records cannot be deleted, including through soft delete.
- Posted fuel issuances are voided instead of deleted.
- Completed/cancelled dispatches remain historical records instead of being deleted.

# D. Dispatch Schedule Conflict and Availability

## FR-DISPATCH-005 — Schedule Conflict Detection

Before creating or changing a dispatch schedule, the system shall check whether the selected driver or vehicle is already committed to another active dispatch during the requested travel period.

At minimum, the initial implementation must detect same-day conflicts using `travel_date`. The schema should also support optional travel start/end timestamps for future time-level scheduling.

The conflict response shall identify:

- conflicting dispatch reference;
- conflict type (`DRIVER`, `VEHICLE`, or both);
- driver;
- vehicle;
- travel date/time;
- dispatch status;
- destination/purpose sufficient for the user to identify the conflict.

### Conflict Policies

The system shall support two configurable policies:

- `BLOCK` — conflict prevents continuation;
- `WARN_AND_ACK` — conflict is displayed as a warning and the authorized user may acknowledge and continue.

Default initial behavior: `WARN_AND_ACK`.

### Acceptance Criteria

- Conflict detection is performed server-side before persistence.
- Client-side checks are advisory only.
- When a conflict exists under `WARN_AND_ACK`, the user sees an explicit acknowledgment dialog.
- The user must confirm that they have reviewed the conflict.
- The user must enter an acknowledgement/override reason.
- The server re-checks the conflict during the final transaction.
- Concurrent requests for the same driver/vehicle are serialized or otherwise protected so both cannot create an unacknowledged double booking.
- Only users with the schedule-conflict override permission may continue.
- `BLOCK` policy rejects the transaction even if the user attempts to acknowledge.
- The system stores the conflict acknowledgment record and immutable audit event.
- The user cannot bypass the workflow by editing a client payload.

## FR-DISPATCH-006 — Driver Schedule / Availability

Authorized dispatch personnel shall be able to view a driver's schedule and availability.

Required views:

- day;
- week;
- month.

The user shall be able to select a driver and see:

- scheduled dispatches;
- occupied dates/periods;
- available dates/periods;
- conflict indicators;
- links to dispatch details, subject to authorization.

## FR-DISPATCH-007 — Vehicle Schedule / Availability

Authorized users shall be able to view the same availability information for vehicles.

The schedule view shall support filtering by office, vehicle, driver, and dispatch status.

## FR-DISPATCH-008 — Availability Before Dispatch

The dispatch creation workflow shall display current availability information beside the driver and vehicle selectors.

When a selected driver or vehicle is already scheduled, the form shall warn the user before save and provide the conflicting records for review.

---

# E. Reports

## FR-REPORT-001 — Office Filter

Reports shall support filtering by office.

## FR-REPORT-002 — Period Filters

Supported periods:

- weekly;
- monthly;
- quarterly;
- annual.

Date ranges should also be supported for flexible reporting.

## FR-REPORT-003 — Excel Export

Authorized users shall be able to export reports in XLSX format.

Exports should contain clear headings, totals, filters, reporting period, and generation timestamp.

Export generation and download must be audited.

---

## 7. Deployment and Infrastructure Requirements

### FR-DEPLOY-001 — Ubuntu CLI Server
The production application shall run on a supported Ubuntu Server release with no graphical desktop dependency. Authorized LGU administrators shall be able to perform deployment, migration, backup, restore, rollback, and health checks through CLI/SSH procedures.

### FR-DEPLOY-002 — Docker Compose Runtime
The production stack shall run in Docker containers managed by Docker Compose. Production images shall use pinned versions, health checks, restart policies, private Docker networks, persistent volumes, resource limits, and controlled secret injection.

### FR-DEPLOY-003 — LAN-Only Exposure
The application shall have no public Internet ingress. Only the reverse proxy shall be reachable from approved LGU client networks. MySQL and Redis ports shall not be directly exposed to client workstations.

### FR-DEPLOY-004 — Host Security
The Ubuntu host shall use firewall controls, SSH key-based administration, limited sudo access, regular security updates, time synchronization, disk monitoring, Docker daemon access controls, and documented recovery procedures.

### FR-DEPLOY-005 — Single-Server Limitation
If the LGU initially has only one physical server, the deployment shall explicitly record that the host is a single point of failure. MySQL standby replication, a separate audit sink, and other host-independent redundancy controls shall be deployed on separate hardware/VMs when available.

## 7. Non-Functional Requirements

### NFR-001 Security

The system shall enforce secure authentication, authorization, input validation, least privilege, secure cookies, encryption in transit, and protected secrets.

### NFR-002 Auditability

Operationally sensitive changes shall be traceable to an authenticated actor and request.

### NFR-003 Reliability

Critical transactions shall be atomic and recoverable. A failed fuel posting must not leave a partial fuel ledger update.

### NFR-004 Performance

Interactive CRUD operations should generally return promptly under normal LGU load. Heavy report generation shall not block ordinary transactions; large exports run as background jobs and use a reporting replica or snapshot path. Collection endpoints enforce a hard page-size ceiling of 100–200 records.

### NFR-005 Availability

Application assets should remain usable during brief network interruptions. Offline mode must never silently bypass server-side authorization. Offline mutation queues shall have a hard capacity limit, user-visible warning/backpressure, and deterministic idempotency keys.

### NFR-006 Accessibility

The UI should support keyboard navigation, visible focus indicators, readable labels, sufficient contrast, and accessible error messaging.

### NFR-007 Maintainability

The codebase shall follow DDD, Clean Architecture, OOP, SOLID, DTO, repository, and service/use-case patterns.

### NFR-008 Data Integrity

Foreign keys, unique constraints, check constraints where supported, application validation, and transactional boundaries shall be used together.

### NFR-009 Backup and Recovery

Production database backups shall be encrypted, retained under policy, monitored, and periodically restored in a test environment. Use fast local/NAS backups for routine recovery plus a periodic encrypted rotated offsite copy where approved. Continuous public-cloud replication is not required for the initial local-network-only deployment.

### NFR-010A Ubuntu/Docker Deployment
The production runtime shall use a CLI-managed Ubuntu Server and Docker Compose. Containers shall run with least privilege, pinned versions, health checks, restart policies, private networks, persistent storage, resource limits, and controlled secret injection. The server shall not require a desktop GUI.

### NFR-010 Local-Network Security
The application shall have no public internet ingress. All browser-to-proxy and inter-tier traffic shall use TLS through an LGU-managed internal CA. VLAN/firewall segmentation shall isolate client, application, database, and security/operations tiers.

### NFR-011 Privileged Authentication
MFA shall be mandatory at production launch for privileged roles. TOTP authenticator applications are the preferred low-cost method.

### NFR-012 Session Security
The system shall enforce idle timeout, absolute session lifetime, session revocation/logout, and limits on concurrent privileged sessions.

### NFR-013 Object-Level Authorization
Every protected resource endpoint shall enforce object-level authorization. Sequential persistence IDs shall not be an authorization boundary; APIs shall use opaque public IDs such as UUID/ULID.

### NFR-014 Upload Security
Avatar uploads shall have a strict MIME/type allow-list, size limit, content inspection/re-encoding where practical, opaque filenames, private storage, and non-executable handling.

### NFR-015 CSRF Protection
For cookie-based sessions, every state-changing route shall enforce a concrete CSRF mechanism such as synchronizer or double-submit token.

### NFR-016 Data Privacy
Driver contact numbers, IP addresses, and applicable audit snapshots shall be handled under a documented data-classification, retention, access, redaction and disposal policy aligned with Philippine Data Privacy Act of 2012 (RA 10173).

### NFR-017 Reporting Isolation
Large or long-running exports shall execute through background jobs and shall read from a reporting replica or scheduled snapshot/materialized table.

### NFR-018 Queue and Pagination Limits
The server shall enforce hard list page sizes of 100–200 records, sync rate limits, maximum sync batch/body sizes, and a maximum offline queue size with warning/backpressure.

### NFR-019 Secrets and Dependency Hygiene
Secrets shall not be committed to source control. Database/application secrets shall rotate on a quarterly cadence and dependency/security findings shall have a documented triage/remediation SLA.

---

## 8. UI/UX Requirements

### General Layout

- LGU administrative dashboard layout.
- Responsive desktop/tablet-first design.
- Sidebar navigation by module.
- Breadcrumbs for deep pages.
- Search/filterable tables.
- Confirmation dialogs for destructive actions.
- Toast/inline error feedback that never hides critical validation detail.

### Fuel Form UX

Suggested sections:

1. Transaction Information
2. Driver/Vehicle
3. Travel Details
4. Fuel Details
5. Budget Allocation
6. Review and Post

### Dispatch Form UX

Suggested sections:

1. Dispatch Information
2. Vehicle and Driver
3. Travel Details
4. Odometer and Passengers
5. Review and Complete

### Offline Indicator

Persistent status should show:

```text
Online
Offline — drafts saved locally
Syncing…
Sync conflict — action required
```

---

## 9. Data Model Requirements

The schema shall be normalized around master data and transaction data.

### Master Data

- offices
- drivers
- vehicles
- users
- roles
- permissions
- budget allocations

### Soft Delete Metadata

Soft-deletable master tables shall include:

- `deleted_at`
- `deleted_by`
- `delete_reason`

### Transaction Data

- fuel issuances
- fuel ledger entries
- dispatches
- vehicle dispatch conflict overrides
- audit logs
- sync operations

Use foreign keys rather than repeating office names, driver names, vehicle plate numbers, and other authoritative master values inside every transaction.

Historical transaction facts such as unit price and issued quantity remain stored on the transaction itself so reports remain historically accurate.

---

## 10. API Requirements

All protected endpoints shall require authentication and server-side authorization.

### API Security Baseline

The API shall also:
- use opaque public identifiers (UUID/ULID or equivalent) for resource addressing;
- enforce object-level authorization on every protected resource endpoint;
- never treat a sequential database ID as proof of authorization;
- apply explicit CSRF protection on every state-changing cookie-authenticated route;
- enforce hard list page-size limits of 100–200 records;
- enforce sync rate limits, maximum request/batch sizes, and offline queue caps.

The API shall:

- validate request DTOs;
- generate request IDs;
- use consistent error codes;
- avoid leaking internal exceptions;
- return paginated lists for large collections;
- enforce optimistic/concurrency controls where applicable;
- support idempotent offline operations;
- re-check dispatch schedule conflicts during synchronization;
- never treat an offline conflict acknowledgment as authoritative until the server accepts it.

---

## 11. Offline Requirements

Offline capability is limited to functions that can safely be queued.

### Safe candidates

- draft fuel record;
- draft dispatch record;
- cached reference lists;
- queued non-finalizing updates.

### Server-required actions

The final authoritative posting of fuel issuance, sensitive administration actions, and privileged changes should require synchronization with the server before they are considered committed.

The client must never claim a transaction is officially posted while the server has not accepted it.

---

## 12. Reporting Requirements

### Export Processing

- Small exports may execute synchronously below a configured threshold.
- Large/annual exports shall create an `export_jobs` record and run in a background worker.
- Heavy report queries shall prefer the reporting replica or scheduled snapshot/materialized tables.
- Completed files shall be stored privately and downloaded through short-lived authorized signed links.
- Export generation and download shall both be audited.
- All user-controlled spreadsheet text shall be sanitized to prevent Excel formula injection.


### Fuel Report

Columns should include at minimum:

- RIS Number
- Purchase Request Number
- Date
- Driver
- Vehicle
- Plate No.
- Destination
- Purpose
- Fuel Type
- Issued Liters
- Unit Price
- Total Amount
- Office / Budget Allocation

### Dispatch Report

Columns should include at minimum:

- Dispatch ID/reference
- Entry Date
- Travel Date
- Driver
- Vehicle
- Plate No.
- Office
- Destination
- ODO Before
- ODO After
- Distance
- Passenger Count
- Purpose
- Status

### Summary Reports

- Fuel consumption by office
- Fuel consumption by vehicle
- Fuel type totals
- Total fuel amount by period
- Dispatch count by office
- Vehicle utilization
- Budget allocation utilization

---

## 13. Audit and Compliance Requirements

The system must maintain defensible records of administrative and operational changes.

### Audit Rules

1. Audit events cannot be edited through normal application workflows.
2. Original transaction history must be preserved.
3. Corrections use compensating transactions where financial/ledger data is involved.
4. Administrative access is itself audited.
5. Audit log viewing does not allow alteration.
6. Audit records should be included in backup strategy.
7. Hash-chain verification should be available to authorized auditors/system administrators.

---

## 14. Security Threat Considerations

### Threat: Unauthorized role escalation

Mitigation:

- permission checks at API/application layer;
- audit role changes;
- restrict role management to privileged users.

### Threat: Duplicate RIS number

Mitigation:

- database unique constraint;
- transactional monthly sequence;
- row-level locking;
- retry only at transaction boundary.

### Threat: Fuel balance manipulation

Mitigation:

- immutable ledger;
- compensating entries;
- strict posting permissions;
- audit trail.

### Threat: Driver/vehicle double booking

Mitigation:

- server-side schedule conflict queries;
- final-transaction revalidation;
- configurable `BLOCK` or `WARN_AND_ACK` policy;
- explicit acknowledgment with reason;
- permission-controlled override;
- immutable audit record.

### Threat: Stale/offline record overwriting newer data

Mitigation:

- client operation IDs;
- server version checking;
- explicit conflicts;
- no silent overwrite.

### Threat: SQL injection

Mitigation:

- parameterized queries/ORM;
- DTO validation;
- no string concatenation for query filters.

### Threat: Credential theft

Mitigation:

- Argon2id/password hashing;
- secure cookies;
- TLS;
- rate limits;
- mandatory MFA for privileged roles;
- idle/absolute session limits and privileged concurrent-session controls.

### Threat: Sensitive data leakage in logs

Mitigation:

- structured logging policy;
- RA 10173-aligned data classification;
- redaction of contact numbers, IPs, tokens and unnecessary before/after fields;
- log review tests;
- restricted log access;
- protected backups and controlled audit exports.

---

## 15. Acceptance Criteria for Initial Release

The product is acceptable for initial production use when:

- authenticated users can log in and are restricted by role/permission;
- PSMD users can create, validate, post, and report fuel issuances;
- RIS numbers are unique and generated automatically in the required format;
- full-tank issuance supports actual liters issued;
- fuel ledger balances reconcile;
- dispatch users can create and complete dispatch records;
- vehicle and driver status restrictions work;
- soft delete/restore works for authorized master-data users;
- historical transactions remain readable after master-data soft deletion;
- driver and vehicle schedule/availability views work;
- schedule conflicts are detected before dispatch creation/update;
- permitted conflicts require explicit acknowledgment and reason;
- blocked conflicts cannot be overridden.
- ODO rules are enforced;
- offices, vehicles, drivers, users, and PPMP allocations are manageable;
- reports can be filtered by office and period;
- large/annual Excel exports use background jobs and authorized short-lived download links;
- exported user-controlled text is sanitized against formula injection;
- reports read from the reporting replica or snapshot path where the workload is large;
- audit events exist for sensitive operations and are append-only;
- offline drafts can be retained and synchronized safely;
- failed operations return safe errors and do not leave partial transactions;
- backup/restore has been tested;
- security and UAT sign-off are complete.

---

## 16. Initial Release Security and Architecture Gates

Before production release:
- P0 SEC-01, SEC-02, SEC-04 and SEC-09 controls are closed.
- Ubuntu CLI + Docker deployment checklist is complete, including firewall rules, Compose health checks, persistent volumes, backup/restore, and no-public-ingress verification.
- Audit cross-verification, formula-injection tests, mandatory privileged MFA, and internal-CA TLS are operational.

Before UAT sign-off:
- P1 SEC-03 through SEC-12 and SCALE-04 through SCALE-06 controls are closed.
- Primary/standby failover, backup restore, and audit-integrity drills are passed.

## 16. Future Roadmap

### Release 2

- fuel receiving/purchase module;
- supplier management;
- configurable vehicle fuel limits;
- maintenance history;
- printable official forms;
- dashboard analytics.

### Release 3

- QR/barcode scanning;
- anomaly detection;
- advanced privileged authentication enhancements beyond the mandatory TOTP baseline;
- mobile-responsive field workflows;
- advanced archival/search;
- data warehouse/analytics integration.

---

## 17. Architecture and Engineering Constraints

The implementation must follow these non-negotiable rules:

- No business logic in React components.
- No business logic in controllers/route handlers.
- No domain rules inside ORM model classes.
- No direct database calls from UI components.
- No plaintext passwords.
- No client-authoritative financial calculations.
- No editable historical ledger transactions.
- No physical deletion of audit or ledger records.
- No hard-delete workflow for historical dispatch/fuel transactions.
- No silent driver/vehicle schedule double booking.
- No client-generated RIS numbers.
- No sensitive credentials in source control.
- No direct SQL string concatenation from user-provided input.
- No silent offline conflict resolution for authoritative records.
- No public internet ingress.
- No privileged production account without MFA.
- No state-changing cookie-authenticated endpoint without CSRF protection.
- No direct authorization based solely on sequential record IDs.
- No unvalidated/uninspected user file upload.
- No unbounded XLSX export query on the OLTP path.
- No unbounded offline sync queue or list page size.

---

## 18. Recommended Technology Responsibilities

| Layer | Responsibility | Example Technology |
|---|---|---|
| Presentation | Screens, forms, tables | Next.js, React, Tailwind, shadcn/ui |
| API | HTTP boundary | Next.js Route Handlers |
| Application | Use cases, transactions, orchestration | TypeScript services/actions |
| Domain | Rules and invariants | Plain TypeScript classes/value objects |
| Persistence | Data access | MySQL + repository implementation |
| Offline | Queue/cache | Service Worker + IndexedDB |
| Reporting | XLSX generation | Server-side exporter library |
| Security | Auth/RBAC/headers | Secure sessions + server guards |
| Observability | Logs/metrics | Structured logging + monitoring |

---

## 19. Product Principle

The system should treat every posted fuel issuance and completed dispatch as an accountable government record: uniquely identifiable, authorized, transactionally consistent, historically traceable, and auditable.

## 20. Evaluation Report Integration — August 24, 2026

The attached evaluation report reviewed PRD.md, System_Architecture.md, and Tasks.md against security, scalability, cost, and local-network-only deployment fit. The revised PRD incorporates those recommendations while preserving the original DDD/Clean Architecture, RBAC, immutable ledger, soft-delete, and offline-safe foundations.

### P0 Production Release Blockers

- SEC-01: audit chain must be supplemented by a separate write-restricted WORM-style audit sink with periodic cross-verification.
- SEC-02: XLSX formula-injection sanitization is mandatory.
- SEC-04: privileged MFA is mandatory at launch.
- SEC-09: TLS is mandatory across the LAN using an internal CA.

### P1 UAT / Go-Live Blockers

- SEC-03: object-level authorization and opaque resource identifiers.
- SEC-05: admin-assisted password recovery.
- SEC-06: avatar/file upload hardening.
- SEC-07: concrete CSRF protection.
- SEC-08: RA 10173-aligned PII controls.
- SEC-10: session timeout/concurrency policy.
- SEC-11: sync rate/body/queue limits and backpressure.
- SEC-12: quarterly secret rotation and dependency triage SLA.
- SCALE-04: required background export jobs.
- SCALE-05: replica/snapshot reporting isolation.
- SCALE-06: primary + standby MySQL with tested failover.

### P2 Incremental

- minimize RIS sequence lock critical sections and monitor contention;
- use Redis reference-data caching;
- async audit hashing and verification;
- partition/archive audit logs;
- enforce page-size ceilings;
- cap offline queues and prioritize financial sync;
- right-size on-prem hardware and use open-source observability/security tooling;
- retain local fast-restore backups plus encrypted rotated offsite copies;
- defer Kubernetes, microservices, multi-region, and other horizontal scale until measured demand justifies them.

### Data Retention

Production sign-off must define retention and archival periods for audit logs, fuel ledger/history, dispatch history, generated exports, application/security logs, and offline synchronization records. Archival must preserve historical traceability and audit-chain verification.
