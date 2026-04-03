# OpenJustice Server

NestJS backend for OpenJustice -- an offline-first criminal justice information system.

## Tech Stack

- **Framework:** NestJS 11, TypeScript
- **Database:** PostgreSQL 15+ via Prisma ORM
- **Queue/Cache:** Redis with BullMQ
- **Storage:** S3-compatible (AWS S3 / MinIO)
- **Auth:** JWT with Argon2id PIN hashing, RBAC

## Quick Start

```bash
cp .env.example .env       # Configure environment
npm install                 # Install dependencies
npx prisma generate         # Generate Prisma client
npx prisma db push          # Apply schema to database
npx prisma db seed          # Seed with test data
npm run start:dev           # Start development server
```

The server runs at `http://localhost:3000`. Swagger API docs are available at `/api/docs`.

## Modules

The server contains 26 feature modules:

| Module | Description |
|--------|-------------|
| Auth | Badge + PIN login, JWT tokens, MFA |
| Officers | Officer management, USSD registration |
| Roles | Role definitions and permissions |
| Stations | Police station management |
| Cases | Criminal case lifecycle management |
| Persons | Person records with encrypted PII |
| Evidence | Evidence collection and chain of custody |
| Vehicles | Vehicle registration and theft tracking |
| Alerts | Amber alerts and wanted persons |
| Background Checks | Criminal record verification |
| Audit | Hash-chain tamper-evident audit trail |
| Analytics | Case statistics and reporting |
| Reports | PDF report generation |
| Sync | Offline data synchronization queue |
| Upload | File upload with S3 integration |
| USSD | Feature phone gateway |
| WhatsApp | WhatsApp messaging integration |
| GeoCrime | Geographic crime analysis |
| InterAgency | Inter-agency data sharing |
| BulkImport | CSV bulk import with job tracking |
| Approvals | Dual-authorization workflow |
| Integrity | Corruption/abuse reporting |
| Notifications | Notification delivery |

## Testing

```bash
npm test              # Run unit tests
npm run test:cov      # Run with coverage
npm run test:e2e      # Run end-to-end tests
```

## Environment Variables

See `.env.example` for all configuration options. Key variables:

- `DATABASE_URL` -- PostgreSQL connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` -- Token signing keys
- `ENCRYPTION_KEY` -- 64 hex chars for AES-256-GCM PII encryption
- `S3_*` -- Object storage credentials

## License

MIT -- see [LICENSE](LICENSE) for details.
