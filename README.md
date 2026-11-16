# Vietix

**Vietix** is an online event ticketing platform that provides interactive seat selection, time-limited seat reservations, and online payment.

## Overview

Vietix is built as a full-stack application with a separate frontend and backend.

* **Frontend:** Next.js 16, React 19
* **Backend:** NestJS 11, TypeORM
* **Database:** PostgreSQL
* **Real-time:** Socket.IO
* **Queue:** Redis + BullMQ
* **Authentication:** JWT + Google OAuth
* **Payment:** VNPay, MoMo, VietQR

The frontend communicates with the backend through REST APIs and receives real-time seat availability updates through WebSocket.

## Architecture

```text
vietix/
├── backend/     NestJS 11 + TypeORM + PostgreSQL
└── frontend/    Next.js 16 + React 19
```

The frontend and backend are maintained as two independent applications within the same repository.

### Backend

* NestJS 11
* TypeORM
* PostgreSQL
* Redis + BullMQ
* Socket.IO
* Passport
* JWT
* Google OAuth
* Cloudinary
* Nodemailer

### Frontend

* Next.js 16 App Router
* React 19
* JavaScript / TypeScript
* Vanilla CSS
* CSS Custom Properties
* Custom i18n support (Vietnamese / English)
* Dark mode with `[data-theme]`

## Core Features

### Event Management

* Browse upcoming and featured events
* View event details
* Manage events through the admin dashboard
* Manage ticket types and pricing
* Manage venues and reusable seating layouts

### Seat Reservation

* Interactive seat selection
* Temporary seat reservation
* Five-minute reservation expiration
* Automatic release of expired reservations
* Real-time seat availability updates
* Transaction-based reservation with pessimistic locking

### Authentication & Authorization

* User registration and login
* JWT authentication
* Google OAuth
* Password reset
* Role-based access control
* Separate permissions for users and administrators

### Payment

* VNPay integration
* MoMo integration
* VietQR test payment flow
* Server-side transaction verification for VNPay
* Payment result handling

### Other Features

* Event reviews
* Cloudinary image upload
* Email notifications
* Contact form
* Health check endpoint
* Vietnamese / English interface
* Dark mode

## Technical Highlights

* **Concurrent seat reservation:** Uses database transactions and pessimistic locking to prevent multiple users from reserving the same seat.
* **Reservation expiration:** Seats are automatically released after the reservation period expires.
* **Asynchronous processing:** Redis and BullMQ handle background jobs for expired reservations.
* **Real-time communication:** Socket.IO broadcasts seat availability changes to connected clients.
* **Authentication:** JWT and Google OAuth provide secure user authentication.
* **Authorization:** Admin routes are protected using JWT authentication and role-based access control.
* **Payment verification:** VNPay transactions are verified on the server side.
* **Testing:** Backend includes unit tests and end-to-end tests using Jest.

## Backend Structure

```text
backend/src/
├── admin/          Admin management
├── auth/           Authentication and authorization
├── events/         Public event APIs
├── tickets/        Ticket and seat entities
├── reservations/   Seat reservation management
├── payments/       Payment integrations
├── websocket/      Real-time seat updates
├── queue/          BullMQ background jobs
├── reviews/        Event reviews
├── venues/         Venue and seating layouts
├── upload/         Cloudinary image uploads
├── mail/           Email services
├── contact/        Contact form
└── health/         Health check
```

All admin routes are protected by `JwtAuthGuard` and `AdminGuard`.

## Frontend Structure

```text
frontend/app/
├── events/                 Event listing and details
├── events/[id]/tickets/    Seat selection
├── checkout/bulk/          Checkout and payment
├── login/                  Authentication
├── register/               Registration
├── forgot-password/        Password recovery
├── auth/                   OAuth callbacks
├── profile/                User profile
├── my-tickets/             Purchased tickets
└── admin/                  Administration dashboard
```

## Requirements

Before running the project locally, make sure the following are installed:

* Node.js 22
* PostgreSQL and Redis — easiest with Docker:

```bash
docker compose up -d   # Postgres 18 + Redis 7, matching backend/.env.example
```

Redis is required because the backend uses BullMQ for background job processing.
The compose file binds ports 5432 and 6379; if you already run Postgres or Redis
locally, change the host ports there and in `backend/.env`.

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Vdarealest/TicketPlatform.git
cd TicketPlatform
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env` from the template. It already matches the Docker
services; the only value you must fill in is `JWT_SECRET`. The rest
(Google, Cloudinary, email, VNPay, MoMo, VietQR) is optional and documented
in [`backend/.env.example`](backend/.env.example).

```bash
cp .env.example .env
```

Create the database schema (first run, or after pulling new migrations):

```bash
npm run migration:run
```

Start the backend:

```bash
npm run start:dev
```

The backend will run at:

```text
http://localhost:3000
```

#### Database migrations

The schema is managed by TypeORM migrations in `backend/src/migrations`.
`synchronize` is off in every environment, so changing an entity does not
change the database until you add a migration:

```bash
# after editing an entity — generates the SQL diff against your database
npm run migration:generate -- src/migrations/DescribeTheChange
npm run migration:run       # apply pending migrations
npm run migration:revert    # undo the last one
npm run migration:show      # list applied [X] / pending [ ]
```

Production: run `npm run migration:run:prod` (uses the built `dist/`) as part
of every deploy, before starting the server.

**Existing databases created before migrations were added** (by the old
`synchronize` setup) already have the tables, so `InitialSchema` must be
recorded as applied instead of run. Do this once per database:

```bash
npm run migration:baseline        # local (ts-node)
npm run migration:baseline:prod   # production (built dist/)
```

The baseline script only marks migrations when the live schema already matches
the entities exactly; otherwise it prints the differences and changes nothing.
`DB_SYNCHRONIZE` is no longer read.

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Create `.env.local` (both values point at the backend):

```bash
cp .env.example .env.local
```

Start the frontend:

```bash
npm run dev
```

The frontend will run at:

```text
http://localhost:3001
```

## Admin Access

There is no default admin account.

To create an administrator:

1. Register a new account through `/register`.
2. Open the PostgreSQL database.
3. Update the user's `role` from `USER` to `ADMIN`.
4. Log in again to access `/admin`.

## Testing

Backend tests are implemented using Jest.

### Unit Tests

No database needed. They cover seat holds (locking, stock, rollback), sale
status, reservation ownership, VNPay signing/verification, payment callbacks
(signature, amount, idempotency), the VietQR flag and the auth/OTP flows.

```bash
cd backend
npm test
```

### End-to-End Tests

E2E boots the whole app against a real Postgres and Redis and writes data, so
it refuses to run unless the database name contains `test`:

```bash
# docker compose creates vietix_test for you; otherwise create it by hand
DB_NAME=vietix_test npm run migration:run
DB_NAME=vietix_test npm run test:e2e
```

(PowerShell: `$env:DB_NAME="vietix_test"; npm run test:e2e`)

### Checks before pushing

There is no CI yet, so run these before pushing to `main` (Render and Vercel
deploy straight from it):

```bash
# backend
npm run lint:check
npm run build
npm test
DB_NAME=vietix_test npm run migration:check   # entities match migrations
DB_NAME=vietix_test npm run test:e2e

# frontend
npx eslint
npx tsc --noEmit
```

If `migration:check` reports differences, you changed an entity without
generating a migration (`npm run migration:generate -- src/migrations/Name`).

The frontend currently does not have an automated test suite.

## Operational Notes

### Time Zone

Event times and VNPay parameters are normalized to `Asia/Ho_Chi_Minh` regardless of the server's system time zone.

### Seat Reservation

Reservations are time-limited. Expired reservations are automatically processed through BullMQ and their seats are released.

### Seating Layout

Events support two types of seating layouts:

* Custom SVG seating layouts created through the admin designer
* Automatically generated flat-grid seating layouts

After modifying a custom seating layout, the **Create Seats** action must be executed to synchronize the seating configuration.

## Project Links

* **GitHub:** https://github.com/Vdarealest/TicketPlatform
* **Live Demo:** https://ticket-platform-psi.vercel.app/

## License

This project is developed for educational and portfolio purposes.
