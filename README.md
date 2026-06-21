# Awash Bus

A full-stack bus ticket booking system built for the Ethiopian market.

Awash Bus allows passengers to search available trips, select seats, and confirm bookings online. Bus operators can manage routes, buses, schedules, and view passenger bookings through a dedicated dashboard.

## Features

### Passenger features

- **Search trips** — find available trips by origin, destination, and travel date.
- **Seat selection** — view available trips and choose a preferred seat from the seat map.
- **Multi-passenger booking** — book multiple seats in a single transaction, with details captured per passenger.
- **Booking history** — review past and upcoming bookings, including status, seat, and trip details.

### Operator features

- **Manage routes** — create and view the routes served.
- **Manage buses** — register buses with plate numbers and seat capacity.
- **Manage trips** — schedule trips by assigning a route, bus, date, departure/arrival times, and price.
- **View bookings** — see all passenger bookings made against the operator's trips.

## Tech stack

| Layer          | Technology                           |
| -------------- | ------------------------------------ |
| Frontend       | Next.js 16, TypeScript, Tailwind CSS |
| Backend        | Next.js API Routes                   |
| Database       | PostgreSQL (Supabase)                |
| ORM            | Prisma                               |
| Authentication | NextAuth.js v5                       |
| Deployment     | Vercel                               |

## Getting started

### Prerequisites

- Node.js 18 or later
- A PostgreSQL database

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Nahom-Taye/awash-bus-booking.git
   cd awash-bus-booking
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the project root and populate the variables listed in the [table below](#environment-variables).

4. **Run database migrations**

   ```bash
   npx prisma migrate dev
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

   The application will be available at [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable          | Required | Description                                                        |
| ----------------- | -------- | ------------------------------------------------------------------ |
| `DATABASE_URL`    | Yes      | Pooled PostgreSQL connection string used by the application.       |
| `DIRECT_URL`      | Yes      | Direct PostgreSQL connection string used by Prisma for migrations. |
| `NEXTAUTH_SECRET` | Yes      | Secret used to sign and encrypt authentication tokens.             |
| `NEXTAUTH_URL`    | Yes      | Base URL of the application (e.g. `http://localhost:3000`).        |

## Project structure

```
awash-bus-booking/
├── app/
│   ├── (auth)/          # Login and registration pages
│   ├── (operator)/      # Operator dashboard and management pages
│   ├── (passenger)/     # Passenger dashboard, search, and booking pages
│   ├── api/             # API route handlers
│   └── page.tsx         # Public landing page
├── lib/                 # Shared utilities (e.g. Prisma client)
├── prisma/              # Prisma schema and migrations
├── types/               # Shared TypeScript type definitions
└── auth.ts              # NextAuth.js configuration
```

## API endpoints

| Method | Path                      | Auth      | Description                                               |
| ------ | ------------------------- | --------- | -------------------------------------------------------- |
| POST   | `/api/auth/register`      | Public    | Register a new passenger or operator account.            |
| `*`    | `/api/auth/[...nextauth]` | Public    | NextAuth.js authentication handler (sign in/out).        |
| GET    | `/api/trips/search`       | Public    | Search available trips by origin, destination, and date. |
| GET    | `/api/trips/[tripId]`     | Public    | Retrieve a single trip with seat availability.           |
| POST   | `/api/bookings`           | Passenger | Create a booking for one or more passengers.             |
| GET    | `/api/passenger/bookings` | Passenger | List the authenticated passenger's bookings.             |
| GET    | `/api/operator/routes`    | Operator  | List the operator's routes.                              |
| POST   | `/api/operator/routes`    | Operator  | Create a new route.                                      |
| GET    | `/api/operator/buses`     | Operator  | List the operator's buses.                               |
| POST   | `/api/operator/buses`     | Operator  | Register a new bus.                                      |
| GET    | `/api/operator/trips`     | Operator  | List the operator's scheduled trips.                     |
| POST   | `/api/operator/trips`     | Operator  | Schedule a new trip.                                     |
| GET    | `/api/operator/bookings`  | Operator  | List all bookings made against the operator's trips.     |

## Database schema

The data model is defined with Prisma. It consists of five models supported by enumerated status types:

- **User** — accounts for both passengers and operators, distinguished by a `role` field (`PASSENGER` or `OPERATOR`). A user owns their routes, buses, trips, and bookings.
- **Route** — an origin-to-destination pairing owned by an operator. Each route is unique per operator.
- **Bus** — a vehicle with a unique plate number and total seat capacity, owned by an operator.
- **Trip** — a scheduled journey linking a route and a bus, with date, departure and arrival times, price, and a status (`SCHEDULED`, `CANCELLED`, or `COMPLETED`).
- **Booking** — a seat reserved by a passenger on a specific trip, including passenger contact details and a status (`PENDING`, `CONFIRMED`, or `CANCELLED`). Each seat on a trip can be booked only once.

Status values are modelled as Prisma enums (`Role`, `TripStatus`, and `BookingStatus`) to keep state transitions consistent across the application.

## License

© 2026 Awash Bus. All rights reserved.
