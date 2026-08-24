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

* Node.js
* PostgreSQL
* Redis

Redis is required because the backend uses BullMQ for background job processing.

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

Create a `.env` file inside the `backend` directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=vietix

# DATABASE_URL=postgres://user:pass@host:5432/db
# DB_SSL=true

REDIS_HOST=localhost
REDIS_PORT=6379

# REDIS_URL=redis://...

JWT_SECRET=

FRONTEND_URL=http://localhost:3001
PORT=3000

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=
MAIL_PASS=
MAIL_FROM=
ADMIN_EMAIL=

# VNPay
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3001/checkout/vnpay-return

# MoMo
MOMO_PARTNER_CODE=
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
MOMO_ENDPOINT=
MOMO_REDIRECT_URL=
MOMO_IPN_URL=

# VietQR
VIETQR_BANK_ID=
VIETQR_ACCOUNT_NO=
VIETQR_ACCOUNT_NAME=
```

Start the backend:

```bash
npm run start:dev
```

The backend will run at:

```text
http://localhost:3000
```

### 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=http://localhost:3000
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

```bash
cd backend
npm test
```

### End-to-End Tests

```bash
npm run test:e2e
```

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
