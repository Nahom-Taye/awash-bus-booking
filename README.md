# Awash Bus Booking System

A full-stack bus ticket booking platform built for the Ethiopian market.

Awash Bus lets passengers search scheduled trips, select seats, and create
bookings online. Operators have a dedicated dashboard for managing routes,
buses, trips, and passenger bookings.

## Features

### Public experience

- Awash Bus brand design with orange, gold, blue, and dark neutral colors.
- Responsive landing page with trip search, service highlights, FAQs, and
  contact information.
- Search-before-login flow that preserves a visitor's trip details while they
  sign in.
- Passenger-only self-registration. Operator accounts are created separately
  by an administrator.

### Passenger experience

- Search trips by origin, destination, and travel date.
- Automatically continue a search started on the public home page after login.
- View route, schedule, price, bus, and remaining-seat information.
- Select seats from a visual seat map.
- Book up to six passengers in one transaction, with individual contact details
  for every selected seat.
- Review booking history with trip, seat, price, and status details.
- Receive an inactivity warning after two minutes and automatic logout after a
  five-minute total idle period.

### Operator experience

- Create and view routes.
- Register buses by unique plate number with a maximum capacity of 48 seats.
- Schedule trips with a route, bus, date, departure and arrival times, and
  price.
- View passenger names, phone numbers, seats, and booking statuses.
- Receive the same five-minute dashboard inactivity protection as passengers.

### Booking integrity

- Authenticated passenger and operator API authorization.
- Passwords hashed with `bcryptjs`.
- Transactional multi-passenger booking creation.
- Database-level unique constraint on trip and seat number to prevent double
  booking.

## Screenshots

Production screenshots will be added after the first live deployment. The
recommended files are:

| View | Suggested file |
| --- | --- |
| Home page | `docs/screenshots/home.png` |
| Passenger dashboard | `docs/screenshots/passenger-dashboard.png` |
| Seat selection | `docs/screenshots/booking.png` |
| Operator dashboard | `docs/screenshots/operator-dashboard.png` |

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Backend | Next.js Route Handlers |
| Database | PostgreSQL on Supabase |
| ORM | Prisma 5 |
| Authentication | NextAuth v5, JWT sessions, Credentials provider |
| Password hashing | bcryptjs |
| Deployment | Vercel |

## Getting started

### Prerequisites

- Node.js 20.9 or later
- npm
- A PostgreSQL database

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Nahom-Taye/awash-bus-booking.git
   cd awash-bus-booking
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root and configure the variables listed
   below.

4. Apply the database migrations:

   ```bash
   npx prisma migrate deploy
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

The application will be available at
[http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled PostgreSQL connection used by the application. |
| `DIRECT_URL` | Yes | Direct PostgreSQL connection used by Prisma migrations. |
| `NEXTAUTH_SECRET` | Yes | Secret used to sign and encrypt authentication tokens. |
| `NEXTAUTH_URL` | Yes | Application base URL, such as `http://localhost:3000`. |

Never commit `.env` files or production credentials.

## Project structure

```text
awash-bus-booking/
├── app/
│   ├── (auth)/          # Login and passenger registration
│   ├── (operator)/      # Operator dashboard
│   ├── (passenger)/     # Passenger dashboard and booking flow
│   ├── api/             # API route handlers
│   ├── components/      # Shared UI components
│   ├── hooks/           # Shared React hooks
│   └── page.tsx         # Public landing page
├── lib/                 # Shared server utilities
├── prisma/              # Prisma 5 schema and migrations
├── public/              # Static assets
├── types/               # Shared TypeScript declarations
├── auth.ts              # NextAuth configuration
└── proxy.ts             # Role-protected route middleware
```

## API endpoints

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Register a passenger account. |
| `*` | `/api/auth/[...nextauth]` | Public | Handle sign in, session, and sign out. |
| GET | `/api/trips/search` | Public | Search trips by route and UTC travel date. |
| GET | `/api/trips/[tripId]` | Public | Retrieve a trip and its booked seats. |
| POST | `/api/bookings` | Passenger | Book one or more seats transactionally. |
| GET | `/api/passenger/bookings` | Passenger | List the passenger's bookings. |
| GET/POST | `/api/operator/routes` | Operator | List or create routes. |
| GET/POST | `/api/operator/buses` | Operator | List or register buses. |
| GET/POST | `/api/operator/trips` | Operator | List or schedule trips. |
| GET | `/api/operator/bookings` | Operator | List bookings for the operator's trips. |

## Data model

The Prisma 5 schema contains five primary models:

- **User** — passenger or operator account, distinguished by the `role` field.
- **Route** — origin and destination pair unique to an operator.
- **Bus** — vehicle identified by its unique plate number and seat capacity.
- **Trip** — route, bus, UTC date, schedule, price, and trip status.
- **Booking** — passenger details, seat number, and booking status.

The `Role`, `TripStatus`, and `BookingStatus` enums keep authorization and
status values consistent.

## Production deployment

Production URL: **Not published yet**

To deploy on Vercel:

1. Import `Nahom-Taye/awash-bus-booking` from GitHub.
2. Keep the detected Next.js framework settings.
3. Add `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` to the
   Production environment.
4. Deploy the project.
5. Set `NEXTAUTH_URL` to the final HTTPS production URL and redeploy so the
   updated authentication environment is active.

The `postinstall` script generates the Prisma 5 client during a clean Vercel
installation.

## License

© 2026 Awash Bus. All rights reserved.
