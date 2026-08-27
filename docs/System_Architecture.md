# System Architecture — Fuel and Vehicle Dispatch Management System

**Company:** Local Government Unit of Quezon, Bukidnon
**Application Type:** Secure LGU internal web application
**Primary Stack:** Next.js + React + Tailwind CSS + shadcn/ui, Node.js/Next.js API, MySQL
**Architecture Style:** Domain-Driven Design (DDD) + Clean Architecture + SOLID + Repository Pattern + Service/Use-Case Layer + DTOs

---

## 1. Architecture Goals

1. Provide a reliable source of truth for fuel issuance, fuel balances, and vehicle dispatch.
2. Maintain strict separation between UI, application/business rules, domain models, and infrastructure/data access.
3. Keep MySQL schema normalized and migration-driven.
4. Make the system usable during temporary network loss where practical, while preventing unsafe synchronization conflicts.
5. Enforce least privilege, strong authentication, authorization, immutable audit logging, and secure handling of government operational data.
6. Support Excel reporting by office and period without coupling reporting logic to UI pages.
7. Make the system testable, maintainable, and extensible for future LGU workflows.

---

## 2. High-Level Logical Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│ Next.js App Router + React + Tailwind + shadcn/ui           │
│ Forms • Tables • Dashboards • Offline Queue • Error UI      │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS / JSON
┌──────────────────────────────▼───────────────────────────────┐
│                    API / Interface Layer                     │
│ Next.js Route Handlers / API Controllers                     │
│ Authentication • Authorization • DTO Validation • Mapping   │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                  Application / Service Layer                 │
│ Use Cases / Actions / Application Services                   │
│ Transaction orchestration • Policies • Idempotency          │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                        Domain Layer                          │
│ Aggregates • Entities • Value Objects • Domain Services     │
│ Invariants • Domain Events                                   │
└──────────────────────────────┬───────────────────────────────┘
                               │ interfaces
┌──────────────────────────────▼───────────────────────────────┐
│                 Infrastructure / Persistence                │
│ Repository implementations • MySQL • Transactions           │
│ Audit writer • Excel exporter • File/object storage          │
└──────────────────────────────────────────────────────────────┘
```

### Core Rule
Controllers and database models must not contain business rules. Controllers should only:

- authenticate/authorize;
- validate request shape;
- convert HTTP input into DTOs;
- call a use case/service;
- map results into API responses.

Repositories own persistence concerns. Domain objects own invariants. Application services coordinate business workflows.

---

## 3. Recommended Repository Structure

```text
src/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   │   ├── fuel/
│   │   ├── dispatch/
│   │   ├── vehicles/
│   │   ├── drivers/
│   │   ├── offices/
│   │   ├── budget-allocations/
│   │   ├── users/
│   │   ├── audit-trail/
│   │   └── reports/
│   └── api/
│       ├── auth/
│       ├── fuel/
│       ├── dispatch/
│       ├── vehicles/
│       ├── drivers/
│       ├── offices/
│       ├── budget-allocations/
│       ├── users/
│       ├── reports/
│       └── sync/
│
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── forms/
│   ├── data-table/
│   └── common/
│
├── domain/
│   ├── fuel/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── repositories/
│   │   ├── services/
│   │   └── events/
│   ├── dispatch/
│   ├── budget/
│   ├── vehicle/
│   ├── driver/
│   ├── office/
│   ├── user/
│   └── audit/
│
├── application/
│   ├── fuel/
│   │   ├── dto/
│   │   ├── use-cases/
│   │   └── services/
│   ├── dispatch/
│   ├── reports/
│   └── sync/
│
├── infrastructure/
│   ├── database/
│   │   ├── migrations/
│   │   ├── seeders/
│   │   ├── prisma-or-query-builder/
│   │   └── repositories/
│   ├── audit/
│   ├── exporters/
│   └── auth/
│
├── lib/
│   ├── auth/
│   ├── validation/
│   ├── logging/
│   └── security/
│
├── offline/
│   ├── queue/
│   ├── storage/
│   └── sync/
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 4. Domain Model

### 4.1 Fuel Recording Aggregate

**Aggregate Root:** `FuelIssuance`

Important fields:

- issuanceId
- issuanceNumber (RIS number)
- purchaseRequestNumber
- entryDate
- driverId
- destination
- purpose
- vehicleId
- requestedLiters
- issuedLiters
- unitPrice
- totalAmount
- budgetAllocationId
- fuelType
- status
- createdBy
- createdAt

### 4.2 Vehicle Dispatch Aggregate

**Aggregate Root:** `VehicleDispatch`

The aggregate also participates in schedule-conflict detection. A dispatch has a planning interval. The initial implementation may use travel-date granularity (`travel_date`) when exact travel time is unavailable; the schema should support optional `travel_start_at` and `travel_end_at` for future time-based scheduling without another transaction redesign.

Important fields:

- dispatchId
- driverId
- vehicleId
- dateEntry
- travelDate
- destination
- odoBefore
- odoAfter
- passengerCount
- requestingOfficeId
- purpose
- status
- createdBy
- createdAt

### 4.3 Reference Aggregates

- `Vehicle`
- `Driver`
- `Office`
- `BudgetAllocation`
- `User`
- `Role`
- `Permission`

### 4.4 Fuel Balance Model

Do not calculate authoritative balances from mutable UI state. Use a transaction ledger model.

```text
FuelType + Year/Period
        │
        ├── Opening Balance
        ├── Purchases / Receipts
        ├── Issuances
        ├── Adjustments
        └── Closing Balance = Opening + Receipts + Adjustments - Issuances
```

A `fuel_balance_snapshots` table can be used for reporting/performance, but the ledger remains authoritative.

---

## 5. Business Rules

### 5.1 RIS Number

Format:

```text
YYYY-MM-XXX
Example: 2026-08-001
```

Rules:

- Generated by the backend only.
- Sequential per year-month.
- Never generated by the client.
- Must remain unique under concurrent requests.
- Use a transaction plus a monthly sequence table, row lock, and unique database constraint.

### 5.2 Full Tank Issuance

The UI may allow `Full Tank` selection. The backend determines the actual issued quantity:

- requestedLiters may be null for full-tank requests;
- issuedLiters is mandatory before final posting;
- issuedLiters must be positive;
- issuedLiters must not exceed the vehicle/fuel station business limit if such a policy is configured.

### 5.3 Total Amount

```text
totalAmount = issuedLiters × unitPrice
```

Use decimal arithmetic. Do not use JavaScript floating point for financial persistence.

Recommended MySQL type:

```sql
DECIMAL(12,2)
```

### 5.4 Unit Price

Unit price is manually entered and may change without prior notice. Therefore:

- store the actual unit price on each fuel issuance;
- do not derive historical values from a current price table;
- optional future enhancement: maintain a fuel price history table for reference only.

### 5.5 ODO Meter Rules

- `odoBefore >= 0`
- `odoAfter >= 0` when provided
- `odoAfter >= odoBefore`
- if `odoAfter` exists, trip distance = `odoAfter - odoBefore`
- dispatch cannot be finalized with invalid odometer values.

### 5.6 Vehicle Status

Unserviceable vehicles must not be selectable for a new dispatch unless an authorized override workflow is explicitly enabled.

### 5.7 Driver Status

Inactive drivers must not be selectable for new operational transactions.

### 5.8 Office and Budget Allocation

Budget allocations are tied to an office, PPMP number, quarter, and year. Fiscal-year rules should be configurable if LGU policy changes.

---

## 6. MySQL Database Design

### 6.1 Core Tables

```text
users
roles
permissions
role_permissions
user_roles

user_sessions              # if server-side sessions are used

lots?                      # optional future asset/lots module

offices
budget_allocations

drivers
vehicles

fuel_sequence_monthly
fuel_issuances
fuel_ledger_entries
fuel_balance_snapshots

vehicle_dispatches
vehicle_dispatch_conflict_overrides

audit_logs
export_jobs                 # optional async reports
sync_operations             # offline sync/idempotency support
```

### 6.2 Normalized Relationship Overview

```text
offices 1 ──── * budget_allocations
offices 1 ──── * users (optional office assignment)
offices 1 ──── * vehicle_dispatches

drivers 1 ──── * fuel_issuances
drivers 1 ──── * vehicle_dispatches
drivers 1 ──── * vehicle_dispatch_conflict_overrides
vehicles 1 ──── * fuel_issuances
vehicles 1 ──── * vehicle_dispatches
vehicles 1 ──── * vehicle_dispatch_conflict_overrides

users * ──── * roles
roles * ──── * permissions

fuel_issuances 1 ──── * fuel_ledger_entries
users 1 ──── * audit_logs
```

### 6.3 Recommended Columns

#### `offices`

- id BIGINT UNSIGNED PK
- office_name VARCHAR(150) NOT NULL
- abbreviation VARCHAR(30) NOT NULL
- status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE'
- created_at DATETIME(6)
- updated_at DATETIME(6)
- deleted_at DATETIME(6) NULL
- deleted_by BIGINT UNSIGNED NULL FK -> users.id
- delete_reason VARCHAR(500) NULL

Unique index:

```text
(office_name)
(abbreviation)
```

#### `budget_allocations`

- id BIGINT UNSIGNED PK
- ppmp_number VARCHAR(80) NOT NULL
- office_id BIGINT UNSIGNED NOT NULL FK
- quarter TINYINT NOT NULL CHECK 1..4
- fiscal_year SMALLINT NOT NULL
- status ENUM('DRAFT','ACTIVE','CLOSED','CANCELLED')
- deleted_at DATETIME(6) NULL
- deleted_by BIGINT UNSIGNED NULL FK -> users.id
- delete_reason VARCHAR(500) NULL
- created_at / updated_at

Unique:

```text
(ppmp_number, office_id, quarter, fiscal_year)
```

#### `drivers`

- id BIGINT UNSIGNED PK
- full_name VARCHAR(150) NOT NULL
- contact_no VARCHAR(50)
- status ENUM('ACTIVE','INACTIVE')
- deleted_at DATETIME(6) NULL
- deleted_by BIGINT UNSIGNED NULL FK -> users.id
- delete_reason VARCHAR(500) NULL
- created_at / updated_at

#### `vehicles`

- id BIGINT UNSIGNED PK
- model_brand VARCHAR(150) NOT NULL
- vehicle_type VARCHAR(100) NOT NULL
- plate_no VARCHAR(30) NOT NULL
- status ENUM('SERVICEABLE','UNSERVICEABLE')
- remarks TEXT NULL
- deleted_at DATETIME(6) NULL
- deleted_by BIGINT UNSIGNED NULL FK -> users.id
- delete_reason VARCHAR(500) NULL
- created_at / updated_at

Unique:

```text
(plate_no)
```

### Soft-Delete Columns for Users and Other Administrative Master Data

The `users` table shall also include `deleted_at`, `deleted_by`, and `delete_reason`. Deleted users cannot authenticate or receive new assignments, but their user ID remains resolvable from historical audit/transaction records.

Roles and permissions should normally be deactivated rather than deleted when they are referenced by historical authorization records.

#### `fuel_sequence_monthly`

- id BIGINT UNSIGNED PK
- year SMALLINT NOT NULL
- month TINYINT NOT NULL
- last_number INT UNSIGNED NOT NULL DEFAULT 0
- created_at / updated_at

Unique:

```text
(year, month)
```

#### `fuel_issuances`

- id BIGINT UNSIGNED PK
- ris_number VARCHAR(20) NOT NULL
- purchase_request_number VARCHAR(100) NOT NULL
- entry_date DATE NOT NULL
- driver_id BIGINT UNSIGNED NOT NULL FK
- destination VARCHAR(255) NOT NULL DEFAULT 'AOR'
- purpose VARCHAR(500) NOT NULL
- vehicle_id BIGINT UNSIGNED NOT NULL FK
- requested_liters DECIMAL(10,3) NULL
- is_full_tank BOOLEAN NOT NULL DEFAULT FALSE
- issued_liters DECIMAL(10,3) NOT NULL
- unit_price DECIMAL(12,2) NOT NULL
- total_amount DECIMAL(14,2) NOT NULL
- budget_allocation_id BIGINT UNSIGNED NOT NULL FK
- fuel_type ENUM('DIESEL','GASOLINE') NOT NULL
- status ENUM('DRAFT','POSTED','VOIDED') NOT NULL
- created_by BIGINT UNSIGNED NOT NULL FK
- posted_at DATETIME(6) NULL
- voided_at DATETIME(6) NULL
- created_at / updated_at

Indexes:

```text
(ris_number) UNIQUE
(entry_date)
(vehicle_id, entry_date)
(driver_id, entry_date)
(budget_allocation_id, entry_date)
(fuel_type, entry_date)
```

#### `fuel_ledger_entries`

- id BIGINT UNSIGNED PK
- fuel_issuance_id BIGINT UNSIGNED NULL FK
- transaction_type ENUM('OPENING','RECEIPT','ISSUANCE','ADJUSTMENT') NOT NULL
- fuel_type ENUM('DIESEL','GASOLINE') NOT NULL
- quantity DECIMAL(12,3) NOT NULL
- signed_quantity DECIMAL(12,3) NOT NULL
- reference_no VARCHAR(100) NULL
- occurred_at DATETIME(6) NOT NULL
- created_by BIGINT UNSIGNED NOT NULL FK
- immutable_hash CHAR(64) NULL
- created_at DATETIME(6)

Never update or delete ledger rows. Corrections are compensating entries.

#### `vehicle_dispatches`

- id BIGINT UNSIGNED PK
- driver_id BIGINT UNSIGNED NOT NULL FK
- vehicle_id BIGINT UNSIGNED NOT NULL FK
- entry_date DATE NOT NULL
- travel_date DATE NOT NULL
- travel_start_at DATETIME(6) NULL
- travel_end_at DATETIME(6) NULL
- destination VARCHAR(255) NOT NULL
- odo_before DECIMAL(12,1) NOT NULL
- odo_after DECIMAL(12,1) NULL
- passenger_count INT UNSIGNED NOT NULL DEFAULT 0
- requesting_office_id BIGINT UNSIGNED NOT NULL FK
- purpose VARCHAR(500) NOT NULL
- status ENUM('DRAFT','DISPATCHED','COMPLETED','CANCELLED') NOT NULL
- conflict_override_acknowledged BOOLEAN NOT NULL DEFAULT FALSE
- conflict_override_reason VARCHAR(500) NULL
- created_by BIGINT UNSIGNED NOT NULL FK
- created_at / updated_at

Indexes:

```text
(travel_date)
(requesting_office_id, travel_date)
(vehicle_id, travel_date, status)
(driver_id, travel_date, status)
```

#### `vehicle_dispatch_conflict_overrides`

Stores the explicit acknowledgment of a detected scheduling conflict. This table is an operational record; the immutable audit log remains the authoritative audit trail.

- id BIGINT UNSIGNED PK
- dispatch_id BIGINT UNSIGNED NOT NULL FK -> vehicle_dispatches.id
- conflicting_dispatch_id BIGINT UNSIGNED NOT NULL FK -> vehicle_dispatches.id
- conflict_type ENUM('DRIVER','VEHICLE','DRIVER_AND_VEHICLE') NOT NULL
- policy ENUM('BLOCK','WARN_AND_ACK') NOT NULL
- acknowledged_by BIGINT UNSIGNED NOT NULL FK -> users.id
- acknowledgement_reason VARCHAR(500) NOT NULL
- acknowledged_at DATETIME(6) NOT NULL
- created_at DATETIME(6) NOT NULL

Indexes:

```text
(dispatch_id)
(conflicting_dispatch_id)
(acknowledged_by, acknowledged_at)
```


---

## 7. Audit Trail — Immutable Design

Audit logging is mandatory for all sensitive actions.

### 7.1 Events to Capture

- Login success/failure
- Logout
- Password reset
- Role/permission changes
- Create/update/void fuel issuance
- Create/update/cancel/complete dispatch
- Vehicle status changes
- Driver status changes
- Budget allocation changes
- Office changes
- User changes
- Report/export creation and download
- Failed authorization attempts
- Offline sync conflicts and retries

### 7.2 `audit_logs`

Recommended fields:

- id BIGINT UNSIGNED PK
- occurred_at DATETIME(6) NOT NULL
- actor_user_id BIGINT UNSIGNED NULL
- action VARCHAR(100) NOT NULL
- entity_type VARCHAR(100) NOT NULL
- entity_id VARCHAR(100) NULL
- request_id CHAR(36) NOT NULL
- ip_address VARBINARY(16) NULL
- user_agent VARCHAR(500) NULL
- before_json JSON NULL
- after_json JSON NULL
- metadata_json JSON NULL
- previous_hash CHAR(64) NULL
- record_hash CHAR(64) NOT NULL

### 7.3 Immutability Controls

Application controls:

- no normal `UPDATE` or `DELETE` use case exists;
- audit records are append-only;
- admin UI is read-only;
- audit events are captured synchronously into a durable local queue/outbox before the business request is acknowledged.

Database controls:

- dedicated database account for audit writes;
- revoke update/delete privileges for application-facing roles;
- optional MySQL triggers as a defense-in-depth control;
- interactive DB administrators must not have write access to the secondary audit sink.

Hash chain:


```text
record_hash = SHA-256(canonical_payload + previous_hash)
```

This provides tamper evidence. For stronger government-grade assurance, audit hash computation is performed by a background worker so the global chain does not serialize every sensitive write on the request path. A separate write-restricted append-only/WORM-style audit sink receives a near-real-time copy and a scheduled verification job compares the MySQL chain with the secondary sink. Periodically anchor checkpoints into protected storage.

---

## 8. Authentication and Authorization

### Authentication

Recommended:

- secure session-based authentication for browser users;
- HttpOnly + Secure + SameSite cookies;
- password hashing with Argon2id or another modern adaptive password hash;
- CSRF protection when cookie authentication is used;
- login throttling and account lockout/rate limiting;
- mandatory password reset flow for initial credentials;
- mandatory TOTP MFA for privileged roles before production release;
- idle timeout, absolute session lifetime, and privileged concurrent-session limits;
- audited admin-assisted password reset/recovery with no external email dependency;
- session revocation on password/role changes.

### Authorization

Use RBAC with permission-level checks.

Example roles:

- `SUPER_ADMIN`
- `SYSTEM_ADMIN`
- `PSMD_STAFF`
- `DISPATCH_OFFICER`
- `BUDGET_OFFICER`
- `VIEWER`
- `AUDITOR`

Example permissions:

```text
fuel.create
fuel.read
fuel.post
fuel.void
fuel.export

dispatch.create
dispatch.read
dispatch.update
dispatch.complete
dispatch.cancel

office.manage
vehicle.manage
driver.manage
budget.manage
user.manage
role.manage
audit.read
report.export
```

Authorization must be evaluated server-side. UI hiding is not security.

---

## 9. API Design

Use resource-oriented APIs with consistent responses.

Example endpoints:

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/me

GET    /api/fuel-issuances
POST   /api/fuel-issuances
GET    /api/fuel-issuances/:id
POST   /api/fuel-issuances/:id/post
POST   /api/fuel-issuances/:id/void

GET    /api/fuel-balances

GET    /api/dispatches
POST   /api/dispatches
GET    /api/dispatches/:id
PATCH  /api/dispatches/:id
POST   /api/dispatches/:id/complete
POST   /api/dispatches/:id/cancel
GET    /api/dispatches/schedule
GET    /api/dispatches/conflicts
GET    /api/drivers/:id/schedule
GET    /api/vehicles/:id/schedule

GET    /api/vehicles
POST   /api/vehicles
PATCH  /api/vehicles/:id
POST   /api/vehicles/:id/soft-delete
POST   /api/vehicles/:id/restore

GET    /api/drivers
POST   /api/drivers
PATCH  /api/drivers/:id
POST   /api/drivers/:id/soft-delete
POST   /api/drivers/:id/restore

GET    /api/offices
POST   /api/offices
PATCH  /api/offices/:id
POST   /api/offices/:id/soft-delete
POST   /api/offices/:id/restore

GET    /api/budget-allocations
POST   /api/budget-allocations
PATCH  /api/budget-allocations/:id
POST   /api/budget-allocations/:id/soft-delete
POST   /api/budget-allocations/:id/restore

GET    /api/reports/fuel
GET    /api/reports/dispatch
POST   /api/reports/export

POST   /api/sync/operations
```

### Dispatch Scheduling Use Cases

Keep scheduling logic in application/domain services, for example:

```text
CheckDispatchScheduleAvailability
CreateDispatch
UpdateDispatchSchedule
AcknowledgeDispatchConflict
GetDriverSchedule
GetVehicleSchedule
GetDispatchCalendar
SoftDeleteReferenceEntity
RestoreReferenceEntity
```

`CreateDispatch` and `UpdateDispatchSchedule` must call `CheckDispatchScheduleAvailability` before commit. If conflicts exist, the use case returns a typed conflict result. A second command containing the explicit acknowledgement/override reason may continue only when the server-side policy permits it.

### Soft Delete Repository Contract

Avoid a generic destructive repository method such as `delete()`. Prefer explicit contracts:

```ts
softDelete(id: bigint, actorId: bigint, reason: string): Promise<void>;
restore(id: bigint, actorId: bigint): Promise<void>;
findActiveById(id: bigint): Promise<Entity | null>;
findByIdIncludingDeleted(id: bigint): Promise<Entity | null>;
```

### API Error Envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "details": [
      {
        "field": "issuedLiters",
        "reason": "Must be greater than zero."
      }
    ]
  },
  "requestId": "..."
}
```

Do not expose database error messages, stack traces, SQL statements, or secret values to clients.

---

## 10. DTO Strategy

Examples:

```text
CreateFuelIssuanceCommand
PostFuelIssuanceCommand
VoidFuelIssuanceCommand

CreateDispatchCommand
UpdateDispatchCommand
CompleteDispatchCommand

CreateVehicleCommand
UpdateVehicleCommand

FuelIssuanceResponseDto
FuelBalanceResponseDto
DispatchResponseDto
```

Validate DTOs at the application boundary with a schema-validation library. DTOs should not be ORM/database entities.

---

## 11. Repository Pattern

Example interface:

```ts
export interface FuelIssuanceRepository {
  findById(id: bigint): Promise<FuelIssuance | null>;
  findByRisNumber(risNumber: string): Promise<FuelIssuance | null>;
  save(entity: FuelIssuance): Promise<void>;
  update(entity: FuelIssuance): Promise<void>;
}
```

Implementation belongs to `infrastructure/database/repositories`.

The domain/application layer depends on interfaces, never on MySQL client details.

---

## 12. Transaction Boundaries

### Posting Fuel Issuance

One database transaction should atomically:

1. verify authorization;
2. load and lock fuel sequence row;
3. generate RIS number;
4. validate driver/vehicle/budget state;
5. calculate total amount;
6. persist issuance;
7. persist fuel ledger issuance entry;
8. write immutable audit record;
9. commit.

If any step fails, rollback everything.

### Completing Dispatch

One transaction should:

1. verify dispatch state;
2. lock vehicle if necessary;
3. validate odometer;
4. update completion fields;
5. write audit event;
6. commit.

---

## 13. Offline-Capable Frontend

Offline capability should be designed as **offline-tolerant**, not as blind offline authorization.

### Static Assets

- Self-host UI fonts where licensing permits.
- Bundle JavaScript/CSS assets with the application.
- Avoid runtime dependency on third-party CDNs.
- Cache the application shell using a service worker.
- Cache only non-sensitive reference data.
- Never put passwords, session tokens, or complete sensitive transaction datasets into public Cache Storage.

### Local Storage

Use IndexedDB for:

- draft fuel records;
- draft dispatch records;
- small reference dictionaries;
- encrypted/signed sync envelopes where appropriate.

Do not use `localStorage` for operational secrets.

### Sync

Each offline mutation should receive:

```text
clientOperationId: UUID
createdOfflineAt
entityType
payload
schemaVersion
```

The server must enforce idempotency using `clientOperationId`.

Conflicts must be explicit. Do not silently overwrite authoritative government records.

Recommended sync states:

```text
QUEUED → SYNCING → SYNCED
                 ↘ CONFLICT
                 ↘ FAILED
```

---

## 14. Reporting and Excel Export

Export service should be independent of UI.

Inputs:

- officeId optional
- startDate
- endDate
- period type: weekly/monthly/quarterly/annual
- report type

Recommended outputs:

- Fuel Issuance Report
- Fuel Consumption by Vehicle
- Fuel Consumption by Office
- Fuel Type Summary
- Vehicle Dispatch Report
- ODO/Distance Report
- Budget Allocation Utilization

For large exports, create an `export_jobs` record and process generation in a background worker. Prefer the reporting replica or scheduled snapshot/materialized tables for heavy queries. Store the generated file privately and issue a short-lived signed download link after re-authorizing the requesting user. Small exports may remain synchronous below a configured size/time threshold.

Every user-controlled XLSX text value must be protected against spreadsheet formula injection. Values beginning with `=`, `+`, `-`, or `@` must be emitted as safe text, never executable formulas.

---

## 15. Error Handling and Observability

Use consistent categories:

```text
ValidationError
AuthenticationError
AuthorizationError
NotFoundError
ConflictError
BusinessRuleError
PersistenceError
ExternalDependencyError
```

Every request gets a `requestId`.

Structured logs should include:

- timestamp;
- requestId;
- userId where safe;
- route;
- operation;
- duration;
- outcome;
- error code.

Never log:

- passwords;
- session cookies;
- authentication tokens;
- full sensitive personal data;
- database credentials.

---

## 16. Security Best Practices

1. HTTPS/TLS only in production, including LAN traffic, using an LGU-managed internal CA.
2. TLS termination at a trusted reverse proxy.
3. Database server should not be publicly exposed and should accept traffic only from the application/reporting tiers.
4. Separate application and migration database credentials.
5. Use least-privilege DB accounts.
6. Encrypt backups at rest.
7. Encrypt sensitive configuration/secrets using environment secret management.
8. Apply server-side input validation and output encoding.
9. Use parameterized queries / ORM safely; never concatenate SQL from user input.
10. Implement rate limiting for login and privileged endpoints.
11. Add security headers and a restrictive Content Security Policy where compatible with the app.
12. Review file uploads/exports for malware and content risks; avatar uploads require a strict MIME/type allow-list, size limit, content inspection/re-encoding, opaque names, private storage, and non-executable handling.
13. Keep dependencies patched and run automated vulnerability scanning; define a vulnerability-triage SLA.
14. Maintain database backup, restore, and disaster-recovery procedures.
15. Use separate dev/staging/production environments.
16. Protect production migrations with change control and backups.
17. Enforce secure admin access and mandatory MFA for privileged accounts.
18. Enforce explicit CSRF protection on every state-changing cookie-authenticated route.
19. Use opaque public IDs plus object-level authorization on every protected resource endpoint.
20. Apply RA 10173-aligned personal-data classification, access, retention, redaction, and disposal controls.
21. Rotate application/database secrets on a defined quarterly cadence.

---

## 17. Frontend Design and Accessibility

Use the requested design skill workflow before implementation:

```bash
npx claude-code-templates@latest --skill creative-design/frontend-design
```

Design principles:

- professional LGU administrative UI;
- restrained government-style visual language;
- clear status colors with non-color indicators;
- keyboard accessible forms;
- WCAG-conscious contrast and focus states;
- responsive layout for desktop/tablet;
- dense data tables with sticky headers and useful filtering;
- destructive actions require explicit confirmation;
- display RIS number and transaction status prominently;
- show draft/synced/offline status clearly.

Use shadcn/ui primitives for dialogs, forms, command search, tables, tabs, alerts, dropdowns, pagination, and tooltips.

---

## 18. Testing Strategy

### Unit Tests

- domain invariants;
- RIS sequence generation logic;
- total calculation;
- odometer validation;
- budget allocation validation;
- permission policies.

### Integration Tests

- repository behavior;
- MySQL transactions;
- unique constraints;
- audit insertion;
- idempotent sync;
- report queries.

### E2E Tests

- login/logout;
- create/post fuel issuance;
- full-tank workflow;
- dispatch creation/completion;
- vehicle/driver status restrictions;
- reports and Excel download;
- offline queue then synchronization.

### Security Tests

- authorization bypass attempts;
- CSRF/XSS/injection checks;
- rate limiting;
- session invalidation;
- privilege escalation;
- immutable audit verification;
- soft-delete/restore authorization;
- schedule conflict detection for driver and vehicle;
- explicit conflict acknowledgment/override;
- driver and vehicle availability calendar queries.

---

## 19. Deployment Topology — Ubuntu CLI Server + Docker

The authoritative production deployment is a **self-hosted Ubuntu Server accessed through the LGU local network**. The Ubuntu host is administered through the CLI/SSH by authorized system administrators; the application stack runs as Docker containers and is managed with Docker Compose. There is **no public internet ingress** to the application or database.

### 19.1 Baseline Single-Server Deployment

For the initial LGU installation, the recommended baseline is one properly hardened Ubuntu Server with Docker Engine and Docker Compose. This is appropriate for the expected tens of simultaneous LGU users and keeps operations and cost manageable.

```text
LGU Managed Workstations
        │
        │ HTTPS / Internal-CA TLS
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Ubuntu Server (CLI-managed)                                │
│ Host firewall (UFW/nftables) • SSH key auth • OS hardening │
│                                                             │
│  Docker Engine                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Docker Compose stack                                  │  │
│  │                                                       │  │
│  │  Nginx / Reverse Proxy + WAF                          │  │
│  │          │                                            │  │
│  │  Next.js Web/API                                      │  │
│  │      │        │         │                             │  │
│  │    Redis    Worker    Private File Volume             │  │
│  │      │      /Queue    avatars/export files            │  │
│  │      └────────┬───────────────┘                        │  │
│  │               │                                        │  │
│  │          MySQL 8.x                                     │  │
│  │       persistent named volume                           │  │
│  │               │                                        │  │
│  │        reporting snapshot                              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        │
        ├── Encrypted local backup → NAS / backup server
        └── Periodic encrypted rotated copy → approved offsite storage
```

### 19.2 Optional High-Availability Extension

The security/scalability evaluation recommends a MySQL primary + standby and a separate write-restricted audit sink. Those components should **not be placed on the same Ubuntu host** if they are expected to protect against host failure or privileged-host compromise. The preferred extension is a second hardened Ubuntu server/VM on the LGU network:

```text
Ubuntu Server A                         Ubuntu Server B
Application Host                        Data/DR Host
----------------                        ----------------
Docker Compose                          MySQL Standby
Nginx                                   Reporting replica/snapshot
Next.js                                 Audit sink / WORM-style storage
Worker                                  Backup staging
Redis                                   Monitoring (optional)
     │                                         ▲
     └──────────── encrypted LAN ─────────────┘
```

If only one physical server is available, the system may launch in single-server mode, but the documentation must explicitly record that this provides **application/database availability only at the host's availability level** and does not provide server-level failover. A second Ubuntu host/VM should be added before the system is treated as fully redundant.

### 19.3 Docker Deployment Standards

- Use Docker Compose for the production stack; do not introduce Kubernetes for the initial LGU deployment.
- Pin container image versions; avoid `latest` tags in production.
- Run application containers as non-root users wherever practical.
- Keep MySQL, Redis, and application services on private Docker networks; only the reverse proxy is exposed to the LAN.
- Persist MySQL data, application-upload data, and required job/audit state on controlled Docker volumes or bind mounts with explicit ownership and backup policy.
- Never store secrets directly in the Git repository or Docker image.
- Prefer Docker secrets or protected environment files with root-only filesystem permissions for deployment secrets.
- Configure container health checks and restart policies.
- Set CPU/memory limits so runaway exports or workers cannot starve the database.
- Send container logs to centralized host logging with rotation and PII/secret redaction.
- Keep the Docker socket inaccessible to application containers.
- Do not mount the host filesystem broadly into application containers.
- Apply regular host OS security updates and controlled Docker/image updates during maintenance windows.

### 19.4 Ubuntu CLI Administration

The production server should be manageable without a graphical desktop. Administrative procedures shall include:

- SSH key-based administration; password SSH login disabled where operationally feasible.
- Dedicated administrative accounts with sudo rather than direct root login.
- UFW/nftables rules permitting only required LAN ports.
- Automatic security updates or a documented patch cadence.
- NTP/time synchronization so audit timestamps and RIS sequencing remain reliable.
- Disk/volume monitoring for MySQL, logs, exports, and backups.
- Docker daemon hardening and controlled access to the Docker group because Docker access is equivalent to high host privilege.
- A CLI runbook for `docker compose` deployment, rollback, backup, restore, migration, and health checks.

### 19.5 Network Placement

The Ubuntu server should be placed on the protected LGU server/data network. Workstations access only the reverse-proxy port over internal TLS. MySQL and Redis ports must never be exposed directly to client workstations. If VLAN segmentation is available, keep client, application, data, and security/operations traffic separated; if the LGU has only one LAN segment, enforce the same principle with the Ubuntu host firewall and Docker private networks.

### 19.6 Firewall / Exposure Rules

- No public Internet port forwarding.
- Reverse proxy: accessible only from approved LGU client networks.
- MySQL: accessible only from the application/reporting container network and approved standby/reporting host.
- Redis: accessible only from application/worker containers.
- SSH: accessible only from the authorized LGU administration network.
- Audit sink: write access only from the dedicated audit-writer process/account.

### 19.7 Backups and Recovery

Docker volumes are not backups. MySQL logical/physical backups must be generated to backup storage outside the application container lifecycle. The minimum operational pattern is fast local/NAS recovery plus a periodic encrypted rotated copy to approved offsite storage. Restore drills must validate both the database and the Dockerized application configuration.

This topology deliberately avoids Kubernetes, microservices, and internet-scale infrastructure because the expected deployment is one LGU with tens of simultaneous users.

---

## 20. Recommended Additional Features

- approval workflow for fuel issuance and dispatch;
- configurable schedule conflict policy by LGU office/workflow;
- vehicle maintenance schedule and service history;
- fuel supplier/purchase receiving module;
- fuel tank inventory receiving;
- configurable fuel limits by vehicle type;
- dashboard KPIs;
- printable RIS/dispatch forms;
- QR/barcode for vehicle identification;
- configurable fiscal-year/quarter rules;
- attachment support for supporting documents;
- automated backup verification;
- MFA for privileged roles;
- anomaly detection for unusually high fuel consumption or impossible odometer sequences.

---

## 21. Architecture Decision Summary

| Concern | Decision |
|---|---|
| Server platform | Ubuntu Server, CLI-managed, Docker Engine + Docker Compose; no GUI dependency. |
| HA extension | Separate Ubuntu server/VM for MySQL standby and independent audit sink when HA is enabled. |
| UI | Next.js + React + Tailwind CSS + shadcn/ui |
| Backend | Next.js API / Node.js |
| Database | MySQL |
| Style | DDD + Clean Architecture |
| Business logic | Domain + Application Services/Use Cases |
| Persistence | Repository Pattern |
| Data transfer | DTOs |
| Financial numbers | MySQL DECIMAL |
| RIS generation | Transactional monthly sequence |
| Audit | Append-only + hash chain |
| Offline | Service worker + IndexedDB + idempotent sync |
| Reporting | Server-side XLSX export |
| Auth | Secure session + RBAC |
| Testing | Unit + integration + E2E + security |
```

## 22. Evaluation Report Integration — August 24, 2026

The external evaluation report identified twelve security findings, nine scalability bottlenecks, and eight cost-optimization opportunities. The architecture is revised without changing the DDD/Clean Architecture monolith.

### P0 Release Blockers

- **SEC-01 Audit-log integrity:** synchronous durable capture, asynchronous hash chaining, separate write-restricted WORM-style sink, periodic cross-verification.
- **SEC-02 Report/export injection:** sanitize user-controlled spreadsheet cells beginning with `=`, `+`, `-`, or `@`.
- **SEC-04 Privileged authentication:** mandatory privileged MFA at production release using TOTP.
- **SEC-09 LAN transport:** TLS everywhere using an LGU internal CA.

### P1 Before UAT Sign-Off

- **SEC-03 IDOR:** opaque API/public resource identifiers and object-level authorization on every endpoint.
- **SEC-05 Recovery:** audited admin-assisted password reset; no dependency on external email.
- **SEC-06 Upload:** strict avatar upload validation, content inspection/re-encoding, private storage.
- **SEC-07 CSRF:** concrete CSRF mechanism for every state-changing cookie-authenticated route.
- **SEC-08 PII:** RA 10173-aligned classification, retention, access, redaction and protected backups.
- **SEC-10 Sessions:** idle and absolute timeout plus privileged concurrent-session limits.
- **SEC-11 Offline abuse:** sync rate limits, request/batch limits, queue caps and backpressure.
- **SEC-12 Hygiene:** quarterly secret rotation and defined dependency-vulnerability triage SLA.
- **SCALE-04:** large exports use required background `export_jobs`.
- **SCALE-05:** dashboards/reports use replica or snapshot path.
- **SCALE-06:** primary + standby MySQL with tested failover runbook.

### P2 Incremental Optimization

- Keep the RIS sequence lock critical section to `lock → increment → release`; monitor lock waits before sharding.
- Use Redis/in-memory caching for offices, drivers, vehicles and budget allocations with short TTL and invalidate-on-write.
- Partition audit logs by month/year and archive compressed historical partitions according to retention policy.
- Enforce a hard server-side page-size ceiling of 100–200 records.
- Cap offline queues and provide warnings/backpressure; prioritize financial postings when syncing.
- Right-size on-prem/VM hardware for tens of simultaneous users and use open-source observability/security tooling.
- Maintain local fast-restore backups plus encrypted rotated offsite copies; defer multi-region infrastructure until usage requires it.

### Data Retention

Before production sign-off, define retention and archival periods for audit logs, fuel ledger/history, dispatch history, report exports, application logs, and offline sync records. Archival must preserve the ability to independently verify audit integrity.
