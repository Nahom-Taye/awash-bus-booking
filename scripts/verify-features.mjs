import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3104";
const stamp = Date.now().toString();
const passengerEmail = `passenger-${stamp}@example.com`;
const otherPassengerEmail = `passenger-other-${stamp}@example.com`;
const operatorEmail = `operator-${stamp}@example.com`;
const otherOperatorEmail = `operator-other-${stamp}@example.com`;
const rejectedRoleEmail = `rejected-${stamp}@example.com`;
const contactEmail = `contact-${stamp}@example.com`;
const password = "Verification123!";
const origin = "addis-ababa";
const destination = "nekemte";
const plateNumber = `TST-${stamp.slice(-8)}`;
const deletablePlateNumber = `DEL-${stamp.slice(-8)}`;
const telebirrReference = `TB${stamp}`;
const cbeReference = `CBE${stamp}`;
const operatorTelebirrSettings = {
  recipientName: `Verification Telebirr ${stamp.slice(-6)}`,
  merchantNumber: `TB-${stamp}`,
};
const operatorCbeSettings = {
  accountHolderName: `Verification CBE ${stamp.slice(-6)}`,
  accountNumber: `CBE-${stamp}`,
};
const otherOperatorTelebirrSettings = {
  recipientName: `Other Telebirr ${stamp.slice(-6)}`,
  merchantNumber: `OTHER-TB-${stamp}`,
};
let currentStage = "initialization";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.TEST_DATABASE_URL ??
        process.env.DATABASE_URL ??
        process.env.DIRECT_URL,
    },
  },
});

function createJar() {
  const values = new Map();
  return {
    absorb(headers) {
      const cookies =
        typeof headers.getSetCookie === "function"
          ? headers.getSetCookie()
          : [headers.get("set-cookie")].filter(Boolean);
      for (const cookie of cookies) {
        const pair = cookie.split(";", 1)[0];
        const separator = pair.indexOf("=");
        if (separator > 0) {
          const name = pair.slice(0, separator);
          const value = pair.slice(separator + 1);
          if (value) values.set(name, value);
          else values.delete(name);
        }
      }
    },
    header() {
      return [...values.entries()]
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    },
  };
}

async function request(path, options = {}, jar) {
  const headers = new Headers(options.headers);
  if (jar?.header()) headers.set("cookie", jar.header());
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    redirect: options.redirect ?? "manual",
  });
  jar?.absorb(response.headers);
  return response;
}

async function json(response) {
  return response.json().catch(() => ({}));
}

async function expectStatus(response, expected, label) {
  if (response.status !== expected) {
    const body = await response.text();
    throw new Error(`${label}: expected ${expected}, received ${response.status} ${body}`);
  }
}

async function authenticate(email, provider) {
  const jar = createJar();
  const csrfResponse = await request("/api/auth/csrf", {}, jar);
  await expectStatus(csrfResponse, 200, "CSRF request");
  const { csrfToken } = await json(csrfResponse);
  const response = await request(
    `/api/auth/callback/${provider}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-auth-return-redirect": "1",
      },
      body: new URLSearchParams({
        csrfToken,
        email,
        password,
        callbackUrl: `${baseUrl}/`,
      }),
    },
    jar,
  );
  if (![200, 302].includes(response.status)) {
    throw new Error(`Sign in failed with status ${response.status}`);
  }
  const signInResult = await json(response.clone());
  const sessionResponse = await request("/api/auth/session", {}, jar);
  await expectStatus(sessionResponse, 200, "Session request");
  const session = await json(sessionResponse);
  return { jar, session, signInResult };
}

async function signIn(email, provider) {
  const result = await authenticate(email, provider);
  const { jar, session, signInResult } = result;
  if (!session?.user) {
    throw new Error(
      `Sign in did not create a session: ${JSON.stringify(signInResult)}`,
    );
  }
  return { jar, session };
}

async function expectSignInRejected(email, provider, label) {
  const { session } = await authenticate(email, provider);
  if (session?.user) {
    throw new Error(`${label}: wrong-role credentials created a session`);
  }
}

async function signOut(jar) {
  const csrfResponse = await request("/api/auth/csrf", {}, jar);
  const { csrfToken } = await json(csrfResponse);
  const response = await request(
    "/api/auth/signout",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-auth-return-redirect": "1",
      },
      body: new URLSearchParams({
        csrfToken,
        callbackUrl: `${baseUrl}/`,
      }),
    },
    jar,
  );
  if (![200, 302].includes(response.status)) {
    throw new Error(`Sign out failed with status ${response.status}`);
  }
}

async function savePaymentMethod(jar, body, label) {
  const response = await request(
    "/api/operator/payment-settings",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    jar,
  );
  await expectStatus(response, 200, label);
  return json(response);
}

async function cleanup() {
  const operator = await prisma.user.findUnique({
    where: { email: operatorEmail },
    select: { id: true },
  });
  const passenger = await prisma.user.findUnique({
    where: { email: passengerEmail },
    select: { id: true },
  });
  const otherOperator = await prisma.user.findUnique({
    where: { email: otherOperatorEmail },
    select: { id: true },
  });

  await prisma.payment.deleteMany({
    where: {
      OR: [
        ...(passenger ? [{ passengerId: passenger.id }] : []),
        ...(operator ? [{ booking: { trip: { operatorId: operator.id } } }] : []),
        ...(otherOperator
          ? [{ booking: { trip: { operatorId: otherOperator.id } } }]
          : []),
      ],
    },
  });
  await prisma.booking.deleteMany({
    where: {
      OR: [
        ...(passenger ? [{ passengerId: passenger.id }] : []),
        ...(operator ? [{ trip: { operatorId: operator.id } }] : []),
      ],
    },
  });
  if (operator) {
    await prisma.operatorPaymentSettings.deleteMany({
      where: { operatorId: operator.id },
    });
    await prisma.trip.deleteMany({ where: { operatorId: operator.id } });
    await prisma.route.deleteMany({ where: { operatorId: operator.id } });
    await prisma.bus.deleteMany({ where: { operatorId: operator.id } });
  }
  if (otherOperator) {
    await prisma.operatorPaymentSettings.deleteMany({
      where: { operatorId: otherOperator.id },
    });
    await prisma.booking.deleteMany({
      where: { trip: { operatorId: otherOperator.id } },
    });
    await prisma.trip.deleteMany({
      where: { operatorId: otherOperator.id },
    });
    await prisma.route.deleteMany({
      where: { operatorId: otherOperator.id },
    });
    await prisma.bus.deleteMany({
      where: { operatorId: otherOperator.id },
    });
  }
  await prisma.contactMessage.deleteMany({ where: { email: contactEmail } });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          passengerEmail,
          otherPassengerEmail,
          operatorEmail,
          otherOperatorEmail,
          rejectedRoleEmail,
        ],
      },
    },
  });
}

async function main() {
  currentStage = "initial cleanup";
  await cleanup();

  currentStage = "passive login page";
  const passiveLoginJar = createJar();
  const passiveLoginPage = await request("/en/login", {}, passiveLoginJar);
  await expectStatus(passiveLoginPage, 200, "Passive login page");
  const passiveLoginSession = await request(
    "/api/auth/session",
    {},
    passiveLoginJar,
  );
  await expectStatus(passiveLoginSession, 200, "Passive login session");
  const passiveLoginData = await json(passiveLoginSession);
  if (passiveLoginData?.user) {
    throw new Error("Opening the login page created a session");
  }

  currentStage = "localized journey login callback";
  const journeyPath =
    "/en/passenger/dashboard?origin=addis-ababa&destination=hawassa&date=2099-01-01";
  const journeyRedirect = await request(journeyPath);
  if (![302, 307, 308].includes(journeyRedirect.status)) {
    throw new Error("Unauthenticated journey did not redirect to login");
  }
  const journeyLoginLocation = new URL(
    journeyRedirect.headers.get("location") ?? "",
    baseUrl,
  );
  if (
    journeyLoginLocation.pathname !== "/en/login" ||
    journeyLoginLocation.searchParams.get("callbackUrl") !== journeyPath
  ) {
    throw new Error("Localized login did not preserve the journey callback");
  }
  await expectStatus(
    await request(
      `/am/login?${new URLSearchParams({ callbackUrl: journeyPath })}`,
    ),
    200,
    "Amharic journey login",
  );
  await expectStatus(
    await request(
      `/am/register?${new URLSearchParams({ callbackUrl: journeyPath })}`,
    ),
    200,
    "Amharic journey registration",
  );

  currentStage = "public navbar links";
  const homeResponse = await request("/en");
  await expectStatus(homeResponse, 200, "Public home page");
  const homeHtml = await homeResponse.text();
  if (
    !homeHtml.includes('href="/en/login"') ||
    !homeHtml.includes('href="/en/register"')
  ) {
    throw new Error("Public Login or Sign Up link is missing");
  }

  currentStage = "unauthenticated API checks";
  const unauthenticatedPassenger = await request("/api/passenger/bookings");
  await expectStatus(unauthenticatedPassenger, 401, "Unauthenticated passenger API");
  const unauthenticatedOperator = await request("/api/operator/routes");
  await expectStatus(unauthenticatedOperator, 401, "Unauthenticated operator API");
  await expectStatus(
    await request("/api/operator/messages"),
    401,
    "Unauthenticated operator messages API",
  );
  for (const [path, label] of [
    ["/api/operator/routes/missing", "Unauthenticated route delete"],
    ["/api/operator/buses/missing", "Unauthenticated bus delete"],
    ["/api/operator/trips/missing", "Unauthenticated trip delete"],
  ]) {
    await expectStatus(
      await request(path, { method: "DELETE" }),
      401,
      label,
    );
  }
  await expectStatus(
    await request("/api/operator/bookings/missing"),
    401,
    "Unauthenticated booking details",
  );
  await expectStatus(
    await request("/api/passenger/payments"),
    401,
    "Unauthenticated passenger payments",
  );
  await expectStatus(
    await request("/api/passenger/bookings/missing/checkout"),
    401,
    "Unauthenticated checkout",
  );
  await expectStatus(
    await request("/api/operator/payments"),
    401,
    "Unauthenticated operator payments",
  );
  await expectStatus(
    await request("/api/operator/payments/missing"),
    401,
    "Unauthenticated operator payment details",
  );
  await expectStatus(
    await request("/api/operator/payment-settings"),
    401,
    "Unauthenticated payment settings",
  );

  currentStage = "passenger registration";
  const registrationJar = createJar();
  const registration = await request(
    "/api/auth/register",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Verification Passenger",
        email: `  ${passengerEmail.toUpperCase()}  `,
        phone: "+251900000001",
        password,
      }),
    },
    registrationJar,
  );
  await expectStatus(registration, 201, "Passenger registration");
  const registrationSession = await request(
    "/api/auth/session",
    {},
    registrationJar,
  );
  await expectStatus(registrationSession, 200, "Registration session check");
  const registrationSessionData = await json(registrationSession);
  if (registrationSessionData?.user) {
    throw new Error("Registration created a session");
  }
  const registeredPassenger = await prisma.user.findUnique({
    where: { email: passengerEmail },
    select: { role: true },
  });
  if (registeredPassenger?.role !== "PASSENGER") {
    throw new Error("Public registration did not create a passenger");
  }

  currentStage = "duplicate registration";
  const duplicate = await request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "Duplicate Passenger",
      email: passengerEmail.toUpperCase(),
      phone: "+251900000002",
      password,
    }),
  });
  await expectStatus(duplicate, 409, "Case-insensitive duplicate registration");

  currentStage = "role injection";
  const roleInjection = await request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: "Rejected Operator",
      email: rejectedRoleEmail,
      phone: "+251900000003",
      password,
      role: "OPERATOR",
    }),
  });
  await expectStatus(roleInjection, 400, "Public role injection");

  currentStage = "operator setup";
  const operatorPasswordHash = await bcrypt.hash(password, 10);
  await prisma.user.createMany({
    data: [
      {
        fullName: "Verification Operator",
        email: operatorEmail,
        phone: "+251900000004",
        password: operatorPasswordHash,
        role: "OPERATOR",
      },
      {
        fullName: "Other Verification Operator",
        email: otherOperatorEmail,
        phone: "+251900000007",
        password: operatorPasswordHash,
        role: "OPERATOR",
      },
      {
        fullName: "Other Verification Passenger",
        email: otherPassengerEmail,
        phone: "+251900000009",
        password: operatorPasswordHash,
        role: "PASSENGER",
      },
    ],
  });

  currentStage = "wrong-provider sign in checks";
  await expectSignInRejected(
    passengerEmail,
    "operator-credentials",
    "Passenger operator-login denial",
  );
  await expectSignInRejected(
    operatorEmail,
    "passenger-credentials",
    "Operator passenger-login denial",
  );

  currentStage = "passenger sign in";
  const passengerAuth = await signIn(
    ` ${passengerEmail.toUpperCase()} `,
    "passenger-credentials",
  );
  const otherPassengerAuth = await signIn(
    otherPassengerEmail,
    "passenger-credentials",
  );
  currentStage = "operator sign in";
  const operatorAuth = await signIn(operatorEmail, "operator-credentials");
  const otherOperatorAuth = await signIn(
    otherOperatorEmail,
    "operator-credentials",
  );

  currentStage = "session role checks";
  if (passengerAuth.session.user?.role !== "PASSENGER") {
    throw new Error("Passenger session role was not loaded from the database");
  }
  if (operatorAuth.session.user?.role !== "OPERATOR") {
    throw new Error("Operator session role was not loaded from the database");
  }

  currentStage = "authenticated journey role handling";
  const authenticatedJourney = await request(
    "/en/login?callbackUrl=%2Fen%2Fpassenger%2Fdashboard%3Forigin%3Daddis-ababa%26destination%3Dhawassa%26date%3D2099-01-01",
    {},
    passengerAuth.jar,
  );
  if (
    ![302, 307, 308].includes(authenticatedJourney.status) ||
    !authenticatedJourney.headers
      .get("location")
      ?.includes(
        "/en/passenger/dashboard?origin=addis-ababa&destination=hawassa&date=2099-01-01",
      )
  ) {
    throw new Error("Authenticated passenger did not return to the journey");
  }
  const deniedOperatorJourney = await request(
    "/en/login?callbackUrl=%2Fen%2Fpassenger%2Fdashboard%3Forigin%3Daddis-ababa%26destination%3Dhawassa%26date%3D2099-01-01",
    {},
    operatorAuth.jar,
  );
  await expectStatus(
    deniedOperatorJourney,
    200,
    "Authenticated operator journey denial",
  );
  if (
    !(await deniedOperatorJourney.text()).includes(
      "Operator accounts cannot create passenger bookings",
    )
  ) {
    throw new Error("Operator journey denial did not explain the restriction");
  }

  currentStage = "cross-role API checks";
  await expectStatus(
    await request("/api/operator/routes", {}, passengerAuth.jar),
    403,
    "Passenger operator API denial",
  );
  await expectStatus(
    await request("/api/passenger/bookings", {}, operatorAuth.jar),
    403,
    "Operator passenger API denial",
  );
  await expectStatus(
    await request("/api/passenger/trips", {}, operatorAuth.jar),
    403,
    "Operator passenger-trip API denial",
  );
  await expectStatus(
    await request(
      "/api/trips/search?origin=awash&destination=adama&date=2099-01-01",
      {},
      operatorAuth.jar,
    ),
    403,
    "Operator legacy passenger-trip API denial",
  );
  await expectStatus(
    await request(
      "/api/trips/search?origin=awash&destination=adama&date=2099-01-01",
    ),
    401,
    "Unauthenticated passenger-trip API denial",
  );
  await expectStatus(
    await request("/api/operator/messages", {}, passengerAuth.jar),
    403,
    "Passenger operator messages API denial",
  );
  await expectStatus(
    await request("/api/operator/payments", {}, passengerAuth.jar),
    403,
    "Passenger operator payments denial",
  );
  await expectStatus(
    await request("/api/passenger/payments", {}, operatorAuth.jar),
    403,
    "Operator passenger payments denial",
  );
  await expectStatus(
    await request("/api/operator/payment-settings", {}, passengerAuth.jar),
    403,
    "Passenger payment-settings read denial",
  );
  await expectStatus(
    await request(
      "/api/operator/payment-settings",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method: "TELEBIRR",
          enabled: true,
          telebirrRecipientName: "Denied",
          telebirrMerchantNumber: "Denied",
        }),
      },
      passengerAuth.jar,
    ),
    403,
    "Passenger payment-settings update denial",
  );
  for (const [path, label] of [
    ["/api/operator/routes/missing", "Passenger route delete denial"],
    ["/api/operator/buses/missing", "Passenger bus delete denial"],
    ["/api/operator/trips/missing", "Passenger trip delete denial"],
  ]) {
    await expectStatus(
      await request(path, { method: "DELETE" }, passengerAuth.jar),
      403,
      label,
    );
  }
  await expectStatus(
    await request("/api/operator/bookings/missing", {}, passengerAuth.jar),
    403,
    "Passenger booking-details denial",
  );
  await expectStatus(
    await request(
      "/api/bookings",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
      operatorAuth.jar,
    ),
    403,
    "Operator booking denial",
  );

  currentStage = "wrong-role page redirects";
  const passengerPage = await request(
    "/en/operator/dashboard",
    {},
    passengerAuth.jar,
  );
  if (
    ![302, 307, 308].includes(passengerPage.status) ||
    !passengerPage.headers.get("location")?.endsWith("/en/passenger/dashboard")
  ) {
    throw new Error("Passenger wrong-role page redirect failed");
  }

  const operatorPage = await request(
    "/en/passenger/dashboard",
    {},
    operatorAuth.jar,
  );
  if (
    ![302, 307, 308].includes(operatorPage.status) ||
    !operatorPage.headers.get("location")?.endsWith("/en/operator/dashboard")
  ) {
    throw new Error("Operator wrong-role page redirect failed");
  }

  currentStage = "operator payment settings";
  const initialSettingsResponse = await request(
    "/api/operator/payment-settings",
    {},
    operatorAuth.jar,
  );
  await expectStatus(
    initialSettingsResponse,
    200,
    "Operator payment-settings read",
  );
  const initialSettings = await json(initialSettingsResponse);
  if (
    "operatorId" in initialSettings ||
    "id" in initialSettings
  ) {
    throw new Error("Payment settings exposed internal ownership fields");
  }

  const incompleteTelebirrResponse = await request(
    "/api/operator/payment-settings",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        method: "TELEBIRR",
        enabled: true,
        telebirrRecipientName: "",
        telebirrMerchantNumber: "",
      }),
    },
    operatorAuth.jar,
  );
  await expectStatus(
    incompleteTelebirrResponse,
    400,
    "Incomplete Telebirr settings denial",
  );
  const incompleteTelebirr = await json(incompleteTelebirrResponse);
  if (
    incompleteTelebirr.error !== "INVALID_PAYMENT_SETTINGS" ||
    !incompleteTelebirr.fieldErrors?.telebirrRecipientName ||
    !incompleteTelebirr.fieldErrors?.telebirrMerchantNumber
  ) {
    throw new Error("Incomplete Telebirr settings lacked field errors");
  }

  const savedTelebirr = await savePaymentMethod(
    operatorAuth.jar,
    {
      method: "TELEBIRR",
      enabled: true,
      telebirrRecipientName: operatorTelebirrSettings.recipientName,
      telebirrMerchantNumber: operatorTelebirrSettings.merchantNumber,
    },
    "Save Telebirr settings",
  );
  if (
    !savedTelebirr.telebirrEnabled ||
    !savedTelebirr.hasSavedSettings
  ) {
    throw new Error("Telebirr settings were not enabled and persisted");
  }

  const incompleteCbeResponse = await request(
    "/api/operator/payment-settings",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        method: "CBE",
        enabled: true,
        cbeAccountHolderName: "",
        cbeAccountNumber: "",
      }),
    },
    operatorAuth.jar,
  );
  await expectStatus(
    incompleteCbeResponse,
    400,
    "Incomplete CBE settings denial",
  );
  const incompleteCbe = await json(incompleteCbeResponse);
  if (
    incompleteCbe.error !== "INVALID_PAYMENT_SETTINGS" ||
    !incompleteCbe.fieldErrors?.cbeAccountHolderName ||
    !incompleteCbe.fieldErrors?.cbeAccountNumber
  ) {
    throw new Error("Incomplete CBE settings lacked field errors");
  }

  const savedCbe = await savePaymentMethod(
    operatorAuth.jar,
    {
      method: "CBE",
      enabled: true,
      cbeAccountHolderName: operatorCbeSettings.accountHolderName,
      cbeAccountNumber: operatorCbeSettings.accountNumber,
    },
    "Save CBE settings",
  );
  if (!savedCbe.cbeEnabled || !savedCbe.hasSavedSettings) {
    throw new Error("CBE settings were not enabled and persisted");
  }

  await savePaymentMethod(
    otherOperatorAuth.jar,
    {
      method: "TELEBIRR",
      enabled: true,
      telebirrRecipientName:
        otherOperatorTelebirrSettings.recipientName,
      telebirrMerchantNumber:
        otherOperatorTelebirrSettings.merchantNumber,
      operatorId: operatorAuth.session.user.id,
    },
    "Save other-operator Telebirr settings",
  );
  const [storedOperatorSettings, storedOtherOperatorSettings] =
    await Promise.all([
      prisma.operatorPaymentSettings.findUnique({
        where: { operatorId: operatorAuth.session.user.id },
      }),
      prisma.operatorPaymentSettings.findUnique({
        where: { operatorId: otherOperatorAuth.session.user.id },
      }),
    ]);
  if (
    storedOperatorSettings?.telebirrRecipientName !==
      operatorTelebirrSettings.recipientName ||
    storedOtherOperatorSettings?.telebirrRecipientName !==
      otherOperatorTelebirrSettings.recipientName ||
    storedOtherOperatorSettings.operatorId ===
      operatorAuth.session.user.id
  ) {
    throw new Error("Operator payment settings were not isolated by session");
  }

  currentStage = "operator route creation";
  const routeResponse = await request(
    "/api/operator/routes",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ origin, destination }),
    },
    operatorAuth.jar,
  );
  await expectStatus(routeResponse, 201, "Route creation");
  const route = await json(routeResponse);

  currentStage = "normalized duplicate route rejection";
  await expectStatus(
    await request(
      "/api/operator/routes",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origin: "  Addis Ababa  ",
          destination: "NEKEMTE",
        }),
      },
      operatorAuth.jar,
    ),
    409,
    "Normalized duplicate route rejection",
  );
  await expectStatus(
    await request(
      "/api/operator/routes",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origin: "adiss-ababa",
          destination: "nekemte",
        }),
      },
      operatorAuth.jar,
    ),
    409,
    "Misspelled Addis Ababa duplicate route rejection",
  );

  currentStage = "unscheduled route exclusion";
  const unscheduledServedRoutes = await json(
    await request("/api/routes/served"),
  );
  if (
    unscheduledServedRoutes.routes?.some(
      (item) =>
        item.origin?.value === origin &&
        item.destination?.value === destination,
    )
  ) {
    throw new Error("Route without a future trip appeared in served routes");
  }

  currentStage = "operator bus creation";
  const busResponse = await request(
    "/api/operator/buses",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plateNumber, totalSeats: 12 }),
    },
    operatorAuth.jar,
  );
  await expectStatus(busResponse, 201, "Bus creation");
  const bus = await json(busResponse);

  currentStage = "operator trip creation";
  const tripDate = new Date();
  tripDate.setUTCDate(tripDate.getUTCDate() + 30);
  const date = tripDate.toISOString().slice(0, 10);
  const tripResponse = await request(
    "/api/operator/trips",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        routeId: route.id,
        busId: bus.id,
        date,
        departureTime: "08:00",
        arrivalTime: "12:00",
        price: 750,
      }),
    },
    operatorAuth.jar,
  );
  await expectStatus(tripResponse, 201, "Trip creation");
  const trip = await json(tripResponse);

  currentStage = "authenticated trip search";
  const searchParams = new URLSearchParams({
    origin: origin.toLowerCase(),
    destination: destination.toLowerCase(),
    date,
  });
  const searchResponse = await request(
    `/api/trips/search?${searchParams}`,
    {},
    passengerAuth.jar,
  );
  await expectStatus(searchResponse, 200, "Trip search");
  const searchResults = await json(searchResponse);
  if (!Array.isArray(searchResults) || !searchResults.some((item) => item.id === trip.id)) {
    throw new Error("Created trip was not returned by case-insensitive search");
  }

  currentStage = "served route options";
  const servedRoutesResponse = await request("/api/routes/served");
  await expectStatus(servedRoutesResponse, 200, "Served route options");
  const servedRoutes = await json(servedRoutesResponse);
  if (
    !servedRoutes.routes?.some(
      (item) =>
        item.origin?.value === origin &&
        item.destination?.value === destination,
    )
  ) {
    throw new Error("Created route was not returned as a served route option");
  }

  currentStage = "inactive bus exclusion";
  await prisma.bus.update({
    where: { id: bus.id },
    data: { isActive: false, archivedAt: new Date() },
  });
  const servedWithInactiveBus = await json(
    await request("/api/routes/served"),
  );
  if (
    servedWithInactiveBus.routes?.some(
      (item) =>
        item.origin?.value === origin &&
        item.destination?.value === destination,
    )
  ) {
    throw new Error("Route with only an inactive bus appeared in served routes");
  }
  const passengerTripsWithInactiveBus = await json(
    await request(
      `/api/passenger/trips?${searchParams}`,
      {},
      passengerAuth.jar,
    ),
  );
  if (
    passengerTripsWithInactiveBus.trips?.some((item) => item.id === trip.id)
  ) {
    throw new Error("Inactive bus trip appeared in passenger departures");
  }
  await prisma.bus.update({
    where: { id: bus.id },
    data: { isActive: true, archivedAt: null },
  });

  currentStage = "configured payment-method visibility";
  const disabledCbe = await savePaymentMethod(
    operatorAuth.jar,
    {
      method: "CBE",
      enabled: false,
      cbeAccountHolderName: operatorCbeSettings.accountHolderName,
      cbeAccountNumber: operatorCbeSettings.accountNumber,
    },
    "Disable CBE settings",
  );
  if (disabledCbe.cbeEnabled) {
    throw new Error("CBE settings could not be disabled");
  }

  const temporaryBookingResponse = await request(
    "/api/bookings",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tripId: trip.id,
        passengers: [
          {
            seatNumber: 4,
            fullName: "Configuration Hold Passenger",
            phone: "+251900000001",
            email: passengerEmail,
          },
        ],
      }),
    },
    passengerAuth.jar,
  );
  await expectStatus(
    temporaryBookingResponse,
    201,
    "Configured-method booking hold",
  );
  const temporaryBooking = (await json(temporaryBookingResponse))[0];
  const telebirrOnlyCheckoutResponse = await request(
    `/api/passenger/bookings/${temporaryBooking.id}/checkout`,
    {},
    passengerAuth.jar,
  );
  await expectStatus(
    telebirrOnlyCheckoutResponse,
    200,
    "Telebirr-only checkout",
  );
  const telebirrOnlyCheckout = await json(
    telebirrOnlyCheckoutResponse,
  );
  if (
    !telebirrOnlyCheckout.paymentConfiguration?.telebirr?.available ||
    telebirrOnlyCheckout.paymentConfiguration?.cbe?.available ||
    telebirrOnlyCheckout.paymentConfiguration?.cbe?.accountHolderName !==
      null ||
    telebirrOnlyCheckout.paymentConfiguration?.cbe?.accountNumber !==
      null ||
    "missingFields" in
      (telebirrOnlyCheckout.paymentConfiguration?.telebirr ?? {}) ||
    "missingFields" in
      (telebirrOnlyCheckout.paymentConfiguration?.cbe ?? {})
  ) {
    throw new Error(
      "Checkout did not expose only the configured payment method",
    );
  }

  const disabledTelebirr = await savePaymentMethod(
    operatorAuth.jar,
    {
      method: "TELEBIRR",
      enabled: false,
      telebirrRecipientName: operatorTelebirrSettings.recipientName,
      telebirrMerchantNumber: operatorTelebirrSettings.merchantNumber,
    },
    "Disable Telebirr settings",
  );
  if (disabledTelebirr.telebirrEnabled) {
    throw new Error("Telebirr settings could not be disabled");
  }
  const releasedConfigurationHold = await prisma.booking.findUnique({
    where: { id: temporaryBooking.id },
    select: { status: true, seatKey: true, holdExpiresAt: true },
  });
  if (
    releasedConfigurationHold?.status !== "EXPIRED" ||
    releasedConfigurationHold.seatKey !== null ||
    releasedConfigurationHold.holdExpiresAt !== null
  ) {
    throw new Error(
      "Disabling all payment methods did not release an unpaid seat hold",
    );
  }

  const unavailableBookingResponse = await request(
    "/api/bookings",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tripId: trip.id,
        passengers: [
          {
            seatNumber: 5,
            fullName: "Unavailable Payment Passenger",
            phone: "+251900000001",
            email: passengerEmail,
          },
        ],
      }),
    },
    passengerAuth.jar,
  );
  await expectStatus(
    unavailableBookingResponse,
    503,
    "No-payment-method booking denial",
  );
  if (
    (await json(unavailableBookingResponse)).error !==
      "ONLINE_PAYMENT_UNAVAILABLE" ||
    (await prisma.booking.count({
      where: { tripId: trip.id, seatNumber: 5 },
    })) !== 0
  ) {
    throw new Error(
      "A booking or seat hold was retained without a payment method",
    );
  }

  await savePaymentMethod(
    operatorAuth.jar,
    {
      method: "TELEBIRR",
      enabled: true,
      telebirrRecipientName: operatorTelebirrSettings.recipientName,
      telebirrMerchantNumber: operatorTelebirrSettings.merchantNumber,
    },
    "Re-enable Telebirr settings",
  );
  await savePaymentMethod(
    operatorAuth.jar,
    {
      method: "CBE",
      enabled: true,
      cbeAccountHolderName: operatorCbeSettings.accountHolderName,
      cbeAccountNumber: operatorCbeSettings.accountNumber,
    },
    "Re-enable CBE settings",
  );

  currentStage = "passenger booking";
  const bookingResponse = await request(
    "/api/bookings",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tripId: trip.id,
        passengers: [
          {
            seatNumber: 1,
            fullName: "Verification Passenger",
            phone: "+251900000001",
            email: passengerEmail,
          },
        ],
      }),
    },
    passengerAuth.jar,
  );
  await expectStatus(bookingResponse, 201, "Booking creation");
  const createdBookings = await json(bookingResponse);
  const booking = Array.isArray(createdBookings)
    ? createdBookings[0]
    : createdBookings;
  if (!booking?.id) {
    throw new Error("Booking creation did not return a booking ID");
  }
  if (
    booking.status !== "PENDING" ||
    !booking.holdExpiresAt ||
    new Date(booking.holdExpiresAt).getTime() <= Date.now()
  ) {
    throw new Error("New booking did not create an active pending seat hold");
  }

  currentStage = "double booking";
  const duplicateBooking = await request(
    "/api/bookings",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tripId: trip.id,
        passengers: [
          {
            seatNumber: 1,
            fullName: "Second Passenger",
            phone: "+251900000005",
          },
        ],
      }),
    },
    passengerAuth.jar,
  );
  await expectStatus(duplicateBooking, 409, "Double-booking prevention");

  currentStage = "checkout ownership and configuration";
  const checkoutResponse = await request(
    `/api/passenger/bookings/${booking.id}/checkout`,
    {},
    passengerAuth.jar,
  );
  await expectStatus(checkoutResponse, 200, "Passenger checkout");
  const checkout = await json(checkoutResponse);
  if (
    checkout.booking?.id !== booking.id ||
    checkout.booking?.seatNumber !== 1 ||
    Number(checkout.booking?.trip?.price) !== 750 ||
    checkout.paymentWindowMinutes !== 15 ||
    !checkout.paymentConfiguration?.telebirr?.available ||
    !checkout.paymentConfiguration?.cbe?.available ||
    checkout.paymentConfiguration.telebirr.recipientName !==
      operatorTelebirrSettings.recipientName ||
    checkout.paymentConfiguration.telebirr.merchantNumber !==
      operatorTelebirrSettings.merchantNumber ||
    checkout.paymentConfiguration.cbe.accountHolderName !==
      operatorCbeSettings.accountHolderName ||
    checkout.paymentConfiguration.cbe.accountNumber !==
      operatorCbeSettings.accountNumber ||
    "missingFields" in checkout.paymentConfiguration.telebirr ||
    "missingFields" in checkout.paymentConfiguration.cbe ||
    "operatorId" in checkout
  ) {
    throw new Error("Checkout summary or payment configuration was incomplete");
  }
  await expectStatus(
    await request(
      `/api/passenger/bookings/${booking.id}/checkout`,
      {},
      otherPassengerAuth.jar,
    ),
    403,
    "Other passenger checkout denial",
  );
  await expectStatus(
    await request(
      "/api/passenger/payments",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          method: "TELEBIRR",
          transactionReference: `${telebirrReference}-OTHER`,
          senderName: "Other Passenger",
          senderIdentifier: "+251900000009",
        }),
      },
      otherPassengerAuth.jar,
    ),
    403,
    "Other passenger payment-submission denial",
  );

  currentStage = "incorrect payment amount protection";
  const incorrectAmountResponse = await request(
    "/api/passenger/payments",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookingId: booking.id,
        method: "TELEBIRR",
        amount: 1,
        transactionReference: `${telebirrReference}-BAD`,
        senderName: "Verification Passenger",
        senderIdentifier: "+251900000001",
      }),
    },
    passengerAuth.jar,
  );
  await expectStatus(
    incorrectAmountResponse,
    400,
    "Incorrect payment amount denial",
  );
  if (
    (await json(incorrectAmountResponse)).error !==
    "PAYMENT_AMOUNT_MISMATCH"
  ) {
    throw new Error("Incorrect browser-supplied amount was not rejected");
  }

  currentStage = "Telebirr payment submission";
  const telebirrPaymentResponse = await request(
    "/api/passenger/payments",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookingId: booking.id,
        method: "TELEBIRR",
        transactionReference: telebirrReference,
        senderName: "Verification Passenger",
        senderIdentifier: "+251900000001",
      }),
    },
    passengerAuth.jar,
  );
  await expectStatus(
    telebirrPaymentResponse,
    201,
    "Telebirr payment submission",
  );
  const telebirrPayment = await json(telebirrPaymentResponse);
  if (
    telebirrPayment.status !== "PENDING" ||
    telebirrPayment.method !== "TELEBIRR" ||
    Number(telebirrPayment.amount) !== 750
  ) {
    throw new Error("Telebirr payment was not stored as pending at trip price");
  }
  const pendingBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: { status: true, holdExpiresAt: true, seatKey: true },
  });
  if (
    pendingBooking?.status !== "PENDING" ||
    pendingBooking.holdExpiresAt !== null ||
    !pendingBooking.seatKey
  ) {
    throw new Error("Payment submission incorrectly confirmed or released the booking");
  }

  currentStage = "duplicate transaction reference";
  const secondBookingResponse = await request(
    "/api/bookings",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tripId: trip.id,
        passengers: [
          {
            seatNumber: 2,
            fullName: "CBE Verification Traveler",
            phone: "+251900000002",
            email: passengerEmail,
          },
        ],
      }),
    },
    passengerAuth.jar,
  );
  await expectStatus(secondBookingResponse, 201, "Second booking hold");
  const secondBooking = (await json(secondBookingResponse))[0];
  const duplicateReferenceResponse = await request(
    "/api/passenger/payments",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookingId: secondBooking.id,
        method: "CBE",
        transactionReference: ` ${telebirrReference.toLowerCase()} `,
        senderName: "CBE Sender",
        senderIdentifier: "1000000000000",
      }),
    },
    passengerAuth.jar,
  );
  await expectStatus(
    duplicateReferenceResponse,
    409,
    "Duplicate transaction reference rejection",
  );
  if (
    (await json(duplicateReferenceResponse)).error !==
    "TRANSACTION_REFERENCE_EXISTS"
  ) {
    throw new Error("Normalized duplicate transaction reference was accepted");
  }

  currentStage = "payment access isolation";
  const passengerPaymentHistory = await request(
    `/api/passenger/payments?bookingId=${booking.id}`,
    {},
    passengerAuth.jar,
  );
  await expectStatus(
    passengerPaymentHistory,
    200,
    "Passenger payment history",
  );
  if (
    !(await json(passengerPaymentHistory)).payments?.some(
      (payment) => payment.id === telebirrPayment.id,
    )
  ) {
    throw new Error("Passenger could not access their payment history");
  }
  await expectStatus(
    await request(
      `/api/passenger/payments?bookingId=${booking.id}`,
      {},
      otherPassengerAuth.jar,
    ),
    403,
    "Other passenger payment-history denial",
  );
  await expectStatus(
    await request(
      `/api/operator/payments/${telebirrPayment.id}`,
      {},
      passengerAuth.jar,
    ),
    403,
    "Passenger operator-payment denial",
  );
  await expectStatus(
    await request(
      `/api/operator/payments/${telebirrPayment.id}`,
      {},
      otherOperatorAuth.jar,
    ),
    403,
    "Other operator payment-details denial",
  );
  await expectStatus(
    await request(
      `/api/operator/payments/${telebirrPayment.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      },
      passengerAuth.jar,
    ),
    403,
    "Passenger payment-verification denial",
  );

  currentStage = "operator payment management";
  const operatorPaymentsResponse = await request(
    `/api/operator/payments?q=${encodeURIComponent(telebirrReference)}&status=PENDING&method=TELEBIRR`,
    {},
    operatorAuth.jar,
  );
  await expectStatus(
    operatorPaymentsResponse,
    200,
    "Operator payment list",
  );
  if (
    !(await json(operatorPaymentsResponse)).payments?.some(
      (payment) => payment.id === telebirrPayment.id,
    )
  ) {
    throw new Error("Operator payment search did not return the submission");
  }
  const operatorPaymentDetailsResponse = await request(
    `/api/operator/payments/${telebirrPayment.id}`,
    {},
    operatorAuth.jar,
  );
  await expectStatus(
    operatorPaymentDetailsResponse,
    200,
    "Operator payment details",
  );
  const operatorPaymentDetails = await json(operatorPaymentDetailsResponse);
  if (
    operatorPaymentDetails.booking?.id !== booking.id ||
    operatorPaymentDetails.passenger?.email !== passengerEmail ||
    operatorPaymentDetails.booking?.trip?.bus?.plateNumber !== plateNumber ||
    "operatorId" in (operatorPaymentDetails.booking?.trip ?? {})
  ) {
    throw new Error("Operator payment details were incomplete or exposed ownership");
  }

  const verifyPaymentResponse = await request(
    `/api/operator/payments/${telebirrPayment.id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "verify" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(verifyPaymentResponse, 200, "Payment verification");
  const verifiedPayment = await json(verifyPaymentResponse);
  const verifiedBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: { status: true },
  });
  if (
    verifiedPayment.status !== "VERIFIED" ||
    !verifiedPayment.verifiedAt ||
    verifiedPayment.verifiedBy?.email !== operatorEmail ||
    verifiedBooking?.status !== "CONFIRMED"
  ) {
    throw new Error("Payment verification did not confirm and audit the booking");
  }
  await expectStatus(
    await request(
      `/api/operator/payments/${telebirrPayment.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      },
      operatorAuth.jar,
    ),
    409,
    "Repeat payment verification denial",
  );

  currentStage = "passenger booking history";
  const passengerBookings = await request(
    "/api/passenger/bookings",
    {},
    passengerAuth.jar,
  );
  await expectStatus(passengerBookings, 200, "Passenger booking history");
  const passengerBookingData = await json(passengerBookings);
  if (!passengerBookingData.some((booking) => booking.trip?.id === trip.id)) {
    const persisted = await prisma.booking.count({ where: { tripId: trip.id } });
    if (persisted !== 1) {
      throw new Error("Passenger booking did not persist");
    }
  }

  currentStage = "operator booking list";
  const operatorBookings = await request(
    "/api/operator/bookings",
    {},
    operatorAuth.jar,
  );
  await expectStatus(operatorBookings, 200, "Operator booking list");
  const operatorBookingData = await json(operatorBookings);
  if (
    !operatorBookingData.bookings?.some(
      (item) => item.id === booking.id && item.trip?.route?.origin === origin,
    )
  ) {
    throw new Error("Operator could not see the booking for their trip");
  }

  currentStage = "operator booking filters";
  const filteredBookings = await request(
    `/api/operator/bookings?q=${encodeURIComponent(plateNumber)}&view=confirmed&date=${date}&sort=oldest`,
    {},
    operatorAuth.jar,
  );
  await expectStatus(filteredBookings, 200, "Filtered operator booking list");
  const filteredBookingData = await json(filteredBookings);
  if (
    filteredBookingData.total !== 1 ||
    filteredBookingData.bookings?.[0]?.id !== booking.id
  ) {
    throw new Error("Operator booking search and filters did not find the booking");
  }

  currentStage = "operator booking details";
  const bookingDetailsResponse = await request(
    `/api/operator/bookings/${booking.id}`,
    {},
    operatorAuth.jar,
  );
  await expectStatus(bookingDetailsResponse, 200, "Operator booking details");
  const bookingDetails = await json(bookingDetailsResponse);
  if (
    bookingDetails.id !== booking.id ||
    bookingDetails.passenger?.email !== passengerEmail ||
    bookingDetails.fullName !== "Verification Passenger" ||
    bookingDetails.trip?.bus?.plateNumber !== plateNumber ||
    bookingDetails.trip?.remainingSeats !== 10 ||
    "operatorId" in (bookingDetails.trip ?? {})
  ) {
    throw new Error("Booking details were incomplete or exposed internal ownership");
  }
  await expectStatus(
    await request(
      `/api/operator/bookings/${booking.id}`,
      {},
      otherOperatorAuth.jar,
    ),
    403,
    "Other operator booking-details denial",
  );
  await expectStatus(
    await request(
      `/api/operator/bookings/${booking.id}`,
      {},
      passengerAuth.jar,
    ),
    403,
    "Passenger booking-details denial",
  );
  await expectStatus(
    await request("/api/operator/bookings/missing", {}, operatorAuth.jar),
    404,
    "Missing booking details",
  );

  currentStage = "CBE payment submission";
  const cbePaymentResponse = await request(
    "/api/passenger/payments",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookingId: secondBooking.id,
        method: "CBE",
        transactionReference: cbeReference,
        senderName: "CBE Verification Sender",
        senderIdentifier: "1000000000000",
      }),
    },
    passengerAuth.jar,
  );
  await expectStatus(cbePaymentResponse, 201, "CBE payment submission");
  const cbePayment = await json(cbePaymentResponse);
  if (
    cbePayment.method !== "CBE" ||
    cbePayment.status !== "PENDING" ||
    Number(cbePayment.amount) !== 750
  ) {
    throw new Error("CBE payment was not stored as pending at trip price");
  }

  currentStage = "payment rejection validation";
  await expectStatus(
    await request(
      `/api/operator/payments/${cbePayment.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reject", rejectionReason: "" }),
      },
      operatorAuth.jar,
    ),
    400,
    "Missing rejection reason denial",
  );
  await expectStatus(
    await request(
      `/api/operator/payments/${cbePayment.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          rejectionReason: "Wrong sender account",
        }),
      },
      otherOperatorAuth.jar,
    ),
    403,
    "Other operator payment rejection denial",
  );

  const rejectionReason = "The sender account could not be matched.";
  const rejectPaymentResponse = await request(
    `/api/operator/payments/${cbePayment.id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "reject",
        rejectionReason,
      }),
    },
    operatorAuth.jar,
  );
  await expectStatus(rejectPaymentResponse, 200, "Payment rejection");
  const rejectedPayment = await json(rejectPaymentResponse);
  const rejectedBooking = await prisma.booking.findUnique({
    where: { id: secondBooking.id },
    select: { status: true, holdExpiresAt: true, seatKey: true },
  });
  if (
    rejectedPayment.status !== "REJECTED" ||
    rejectedPayment.rejectionReason !== rejectionReason ||
    rejectedBooking?.status !== "PENDING" ||
    !rejectedBooking.holdExpiresAt ||
    !rejectedBooking.seatKey
  ) {
    throw new Error("Payment rejection did not preserve history and renew the hold");
  }

  const historyAfterRejectionResponse = await request(
    "/api/passenger/bookings",
    {},
    passengerAuth.jar,
  );
  await expectStatus(
    historyAfterRejectionResponse,
    200,
    "Passenger rejection history",
  );
  const historyAfterRejection = await json(historyAfterRejectionResponse);
  if (
    !historyAfterRejection
      .find((item) => item.id === secondBooking.id)
      ?.payments?.some(
        (payment) =>
          payment.id === cbePayment.id &&
          payment.status === "REJECTED" &&
          payment.rejectionReason === rejectionReason,
      )
  ) {
    throw new Error("Passenger could not see the payment rejection reason");
  }

  currentStage = "valid payment resubmission";
  const retryPaymentResponse = await request(
    "/api/passenger/payments",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookingId: secondBooking.id,
        method: "CBE",
        transactionReference: `${cbeReference}R`,
        senderName: "CBE Verification Sender",
        senderIdentifier: "1000000000000",
      }),
    },
    passengerAuth.jar,
  );
  await expectStatus(
    retryPaymentResponse,
    201,
    "Payment resubmission after rejection",
  );
  if ((await json(retryPaymentResponse)).status !== "PENDING") {
    throw new Error("Valid payment resubmission was not kept pending");
  }

  currentStage = "seat-hold expiry";
  const expiringBookingResponse = await request(
    "/api/bookings",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tripId: trip.id,
        passengers: [
          {
            seatNumber: 3,
            fullName: "Expiring Hold Passenger",
            phone: "+251900000009",
            email: otherPassengerEmail,
          },
        ],
      }),
    },
    otherPassengerAuth.jar,
  );
  await expectStatus(
    expiringBookingResponse,
    201,
    "Expiring booking hold creation",
  );
  const expiringBooking = (await json(expiringBookingResponse))[0];
  await prisma.booking.update({
    where: { id: expiringBooking.id },
    data: { holdExpiresAt: new Date(Date.now() - 1_000) },
  });
  const expiredCheckoutResponse = await request(
    `/api/passenger/bookings/${expiringBooking.id}/checkout`,
    {},
    otherPassengerAuth.jar,
  );
  await expectStatus(
    expiredCheckoutResponse,
    200,
    "Expired checkout status",
  );
  const expiredCheckout = await json(expiredCheckoutResponse);
  const expiredBooking = await prisma.booking.findUnique({
    where: { id: expiringBooking.id },
    select: { status: true, seatKey: true },
  });
  if (
    expiredCheckout.booking?.status !== "EXPIRED" ||
    expiredBooking?.status !== "EXPIRED" ||
    expiredBooking.seatKey !== null
  ) {
    throw new Error("Expired payment window did not release its seat key");
  }

  const rebookReleasedSeatResponse = await request(
    "/api/bookings",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tripId: trip.id,
        passengers: [
          {
            seatNumber: 3,
            fullName: "Released Seat Passenger",
            phone: "+251900000001",
            email: passengerEmail,
          },
        ],
      }),
    },
    passengerAuth.jar,
  );
  await expectStatus(
    rebookReleasedSeatResponse,
    201,
    "Released seat rebooking",
  );

  currentStage = "individual expired booking deletion";
  const expiredDeleteResponse = await request(
    `/api/operator/bookings/${expiringBooking.id}`,
    { method: "DELETE" },
    operatorAuth.jar,
  );
  await expectStatus(expiredDeleteResponse, 200, "Expired booking deletion");
  if (await prisma.booking.findUnique({ where: { id: expiringBooking.id } })) {
    throw new Error("Eligible expired booking was not permanently deleted");
  }

  currentStage = "paid expired booking deletion protection";
  const paidExpiredBooking = await prisma.booking.create({
    data: {
      tripId: trip.id,
      passengerId: passengerAuth.session.user.id,
      seatNumber: 10,
      fullName: "Paid Expired History",
      phone: "+251900000010",
      status: "EXPIRED",
      expiredAt: new Date(),
    },
  });
  const paidExpiredPayment = await prisma.payment.create({
    data: {
      bookingId: paidExpiredBooking.id,
      passengerId: passengerAuth.session.user.id,
      method: "TELEBIRR",
      amount: Number(trip.price),
      currency: "ETB",
      transactionReference: `LIFE${stamp}`,
      transactionReferenceKey: `LIFE${stamp}`,
      senderName: "Lifecycle Payment History",
      senderIdentifier: `LIFE-${stamp}`,
      status: "PENDING",
    },
  });
  const paidExpiredDelete = await request(
    `/api/operator/bookings/${paidExpiredBooking.id}`,
    { method: "DELETE" },
    operatorAuth.jar,
  );
  await expectStatus(paidExpiredDelete, 409, "Paid expired booking delete conflict");
  if (
    !(await prisma.booking.findUnique({ where: { id: paidExpiredBooking.id } })) ||
    !(await prisma.payment.findUnique({ where: { id: paidExpiredPayment.id } }))
  ) {
    throw new Error("Payment-linked expired history was deleted");
  }

  currentStage = "bulk expired booking cleanup";
  const bulkExpired = await Promise.all(
    [20, 21].map((seatNumber) =>
      prisma.booking.create({
        data: {
          tripId: trip.id,
          passengerId: passengerAuth.session.user.id,
          seatNumber,
          fullName: `Bulk Expired ${seatNumber}`,
          phone: `+2519000000${seatNumber}`,
          status: "EXPIRED",
          expiredAt: new Date(),
        },
      }),
    ),
  );
  const bulkDeleteResponse = await request(
    "/api/operator/bookings",
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "clear-eligible-expired" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(bulkDeleteResponse, 200, "Bulk expired booking cleanup");
  if (
    (await prisma.booking.count({
      where: { id: { in: bulkExpired.map((item) => item.id) } },
    })) !== 0 ||
    !(await prisma.booking.findUnique({ where: { id: paidExpiredBooking.id } }))
  ) {
    throw new Error("Bulk cleanup did not preserve payment history correctly");
  }

  currentStage = "safe deletion of trip with expired unpaid holds";
  const expiredOnlyTrip = await prisma.trip.create({
    data: {
      routeId: route.id,
      busId: bus.id,
      operatorId: operatorAuth.session.user.id,
      date: new Date(`${date}T00:00:00.000Z`),
      departureTime: new Date(`${date}T13:00:00.000Z`),
      arrivalTime: new Date(`${date}T16:00:00.000Z`),
      price: 500,
    },
  });
  await prisma.booking.createMany({
    data: [30, 31].map((seatNumber) => ({
      tripId: expiredOnlyTrip.id,
      passengerId: passengerAuth.session.user.id,
      seatNumber,
      fullName: `Expired Trip Hold ${seatNumber}`,
      phone: `+2519110000${seatNumber}`,
      status: "EXPIRED",
      expiredAt: new Date(),
    })),
  });
  const expiredOnlyTripDelete = await request(
    `/api/operator/trips/${expiredOnlyTrip.id}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(
    expiredOnlyTripDelete,
    200,
    "Expired-only trip permanent deletion",
  );
  if (
    (await prisma.trip.findUnique({ where: { id: expiredOnlyTrip.id } })) ||
    (await prisma.booking.count({ where: { tripId: expiredOnlyTrip.id } }))
  ) {
    throw new Error("Expired-only trip was not deleted atomically");
  }

  currentStage = "past trip completion and history";
  const pastDate = new Date();
  pastDate.setUTCDate(pastDate.getUTCDate() - 2);
  const pastDay = pastDate.toISOString().slice(0, 10);
  const emptyPastTrip = await prisma.trip.create({
    data: {
      routeId: route.id,
      busId: bus.id,
      operatorId: operatorAuth.session.user.id,
      date: new Date(`${pastDay}T00:00:00.000Z`),
      departureTime: new Date(`${pastDay}T08:00:00.000Z`),
      arrivalTime: new Date(`${pastDay}T12:00:00.000Z`),
      price: 400,
    },
  });
  const bookedPastTrip = await prisma.trip.create({
    data: {
      routeId: route.id,
      busId: bus.id,
      operatorId: operatorAuth.session.user.id,
      date: new Date(`${pastDay}T00:00:00.000Z`),
      departureTime: new Date(`${pastDay}T13:00:00.000Z`),
      arrivalTime: new Date(`${pastDay}T17:00:00.000Z`),
      price: 450,
    },
  });
  const completedHistoryBooking = await prisma.booking.create({
    data: {
      tripId: bookedPastTrip.id,
      passengerId: passengerAuth.session.user.id,
      seatNumber: 1,
      seatKey: `${bookedPastTrip.id}:1`,
      fullName: "Completed Trip Passenger",
      phone: "+251922000001",
      status: "CONFIRMED",
    },
  });
  const completedTripsResponse = await request(
    "/api/operator/trips?view=completed",
    {},
    operatorAuth.jar,
  );
  await expectStatus(completedTripsResponse, 200, "Completed trip reconciliation");
  const completedTrips = await json(completedTripsResponse);
  if (
    !completedTrips.some((item) => item.id === emptyPastTrip.id) ||
    !completedTrips.some((item) => item.id === bookedPastTrip.id)
  ) {
    throw new Error("Past trips did not move to completed history");
  }
  const emptyPastDelete = await request(
    `/api/operator/trips/${emptyPastTrip.id}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(emptyPastDelete, 200, "Empty completed trip deletion");
  const bookedPastDelete = await request(
    `/api/operator/trips/${bookedPastTrip.id}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(bookedPastDelete, 409, "Completed history deletion conflict");
  const passengerActiveAfterCompletion = await json(
    await request("/api/passenger/bookings", {}, passengerAuth.jar),
  );
  const passengerHistoryAfterCompletion = await json(
    await request("/api/passenger/bookings?view=history", {}, passengerAuth.jar),
  );
  if (
    passengerActiveAfterCompletion.some(
      (item) => item.id === completedHistoryBooking.id,
    ) ||
    !passengerHistoryAfterCompletion.some(
      (item) =>
        item.id === completedHistoryBooking.id &&
        item.trip?.status === "COMPLETED",
    )
  ) {
    throw new Error("Completed booking did not move from active view to history");
  }

  currentStage = "contact persistence";
  const contactResponse = await request(
    "/api/contact/messages",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Contact Verification",
        email: contactEmail,
        phone: "+251900000006",
        subject: "Verification enquiry",
        message: "This verifies that contact messages persist successfully.",
        website: "",
      }),
    },
    passengerAuth.jar,
  );
  await expectStatus(contactResponse, 201, "Contact form persistence");
  const contactResult = await json(contactResponse);
  const storedContact = await prisma.contactMessage.findUnique({
    where: { id: contactResult.id },
    select: { passengerId: true },
  });
  if (storedContact?.passengerId !== passengerAuth.session.user.id) {
    throw new Error("Authenticated contact message was not associated with its passenger");
  }

  currentStage = "operator message inbox";
  const inboxResponse = await request(
    `/api/operator/messages?q=${encodeURIComponent(contactEmail)}`,
    {},
    operatorAuth.jar,
  );
  await expectStatus(inboxResponse, 200, "Operator message inbox");
  const inbox = await json(inboxResponse);
  if (!inbox.messages?.some((message) => message.id === contactResult.id)) {
    throw new Error("Persisted contact message was not visible in the operator inbox");
  }

  currentStage = "operator message status";
  const resolvedResponse = await request(
    `/api/operator/messages/${contactResult.id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(resolvedResponse, 200, "Resolve operator message");
  const resolvedMessage = await json(resolvedResponse);
  if (resolvedMessage.status !== "RESOLVED" || !resolvedMessage.resolvedAt) {
    throw new Error("Resolved message did not record its status and timestamp");
  }
  await expectStatus(
    await request(
      `/api/operator/messages/${contactResult.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "NEW" }),
      },
      passengerAuth.jar,
    ),
    403,
    "Passenger message update denial",
  );
  await expectStatus(
    await request(
      "/api/operator/messages/00000000-0000-0000-0000-000000000000",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "READ" }),
      },
      operatorAuth.jar,
    ),
    404,
    "Missing message response",
  );

  currentStage = "delete ownership and missing-record checks";
  for (const [path, label] of [
    [`/api/operator/routes/${route.id}`, "Other operator route delete denial"],
    [`/api/operator/buses/${bus.id}`, "Other operator bus delete denial"],
    [`/api/operator/trips/${trip.id}`, "Other operator trip delete denial"],
  ]) {
    await expectStatus(
      await request(
        path,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "delete" }),
        },
        otherOperatorAuth.jar,
      ),
      403,
      label,
    );
  }
  for (const [path, label] of [
    ["/api/operator/routes/missing", "Missing route delete"],
    ["/api/operator/buses/missing", "Missing bus delete"],
    ["/api/operator/trips/missing", "Missing trip delete"],
  ]) {
    await expectStatus(
      await request(
        path,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "delete" }),
        },
        operatorAuth.jar,
      ),
      404,
      label,
    );
  }

  currentStage = "permanent deletion of unused route";
  const unusedRouteResponse = await request(
    "/api/operator/routes",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        origin: destination,
        destination: origin,
      }),
    },
    operatorAuth.jar,
  );
  await expectStatus(unusedRouteResponse, 201, "Unused route creation");
  const unusedRoute = await json(unusedRouteResponse);
  const unusedRouteDelete = await request(
    `/api/operator/routes/${unusedRoute.id}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(unusedRouteDelete, 200, "Unused route deletion");
  if ((await json(unusedRouteDelete)).outcome !== "deleted") {
    throw new Error("Unused route was not permanently deleted");
  }

  currentStage = "permanent deletion of unused bus";
  const unusedBusResponse = await request(
    "/api/operator/buses",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        plateNumber: deletablePlateNumber,
        totalSeats: 8,
      }),
    },
    operatorAuth.jar,
  );
  await expectStatus(unusedBusResponse, 201, "Unused bus creation");
  const unusedBus = await json(unusedBusResponse);
  const unusedBusDelete = await request(
    `/api/operator/buses/${unusedBus.id}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(unusedBusDelete, 200, "Unused bus deletion");
  if ((await json(unusedBusDelete)).outcome !== "deleted") {
    throw new Error("Unused bus was not permanently deleted");
  }

  currentStage = "dependent-record delete conflicts";
  const busConflictResponse = await request(
    `/api/operator/buses/${bus.id}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(busConflictResponse, 409, "Upcoming-trip bus delete conflict");
  const busConflict = await json(busConflictResponse);
  if (
    busConflict.error !== "BUS_HAS_UPCOMING_TRIPS" ||
    !busConflict.upcomingTrips?.some((item) => item.id === trip.id)
  ) {
    throw new Error("Bus conflict did not identify its upcoming trip");
  }

  const routeConflictResponse = await request(
    `/api/operator/routes/${route.id}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(routeConflictResponse, 409, "Trip-history route delete conflict");
  if ((await json(routeConflictResponse)).error !== "ROUTE_HAS_TRIPS") {
    throw new Error("Route deletion did not protect trip history");
  }

  const tripConflictResponse = await request(
    `/api/operator/trips/${trip.id}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(tripConflictResponse, 409, "Booked trip delete conflict");
  if ((await json(tripConflictResponse)).error !== "TRIP_DELETE_UNSAFE") {
    throw new Error("Trip deletion did not protect passenger bookings");
  }

  currentStage = "booked trip cancellation";
  const cancelTripResponse = await request(
    `/api/operator/trips/${trip.id}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(cancelTripResponse, 200, "Booked trip cancellation");
  if ((await json(cancelTripResponse)).outcome !== "cancelled") {
    throw new Error("Booked trip was not cancelled");
  }
  const protectedBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: { id: true, status: true, trip: { select: { status: true } } },
  });
  if (
    !protectedBooking ||
    protectedBooking.status !== "CANCELLED" ||
    protectedBooking.trip.status !== "CANCELLED"
  ) {
    throw new Error("Trip cancellation did not move its booking to history");
  }
  const passengerActiveAfterCancellation = await json(
    await request("/api/passenger/bookings", {}, passengerAuth.jar),
  );
  const operatorActiveAfterCancellation = await json(
    await request("/api/operator/bookings", {}, operatorAuth.jar),
  );
  if (
    passengerActiveAfterCancellation.some((item) => item.id === booking.id) ||
    operatorActiveAfterCancellation.bookings?.some(
      (item) => item.id === booking.id,
    )
  ) {
    throw new Error("Cancelled bookings remained in an active booking list");
  }

  const servedAfterCancellation = await json(
    await request("/api/routes/served"),
  );
  if (
    servedAfterCancellation.routes?.some(
      (item) =>
        item.origin?.value === origin &&
        item.destination?.value === destination,
    )
  ) {
    throw new Error("Cancelled trip remained in homepage route options");
  }

  const cancelledPassengerHistory = await request(
    "/api/passenger/bookings?view=history",
    {},
    passengerAuth.jar,
  );
  await expectStatus(
    cancelledPassengerHistory,
    200,
    "Cancelled trip passenger history",
  );
  const cancelledPassengerBookings = await json(cancelledPassengerHistory);
  if (
    !cancelledPassengerBookings.some(
      (item) =>
        item.id === booking.id &&
        item.trip?.id === trip.id &&
        item.trip?.status === "CANCELLED",
    )
  ) {
    throw new Error("Passenger booking history did not display cancelled trip status");
  }

  await expectStatus(
    await request(
      "/api/bookings",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tripId: trip.id,
          passengers: [
            {
              seatNumber: 2,
              fullName: "Blocked Passenger",
              phone: "+251900000008",
            },
          ],
        }),
      },
      passengerAuth.jar,
    ),
    409,
    "Cancelled trip further-booking denial",
  );

  currentStage = "bus history archive";
  const busHistoryConflictResponse = await request(
    `/api/operator/buses/${bus.id}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(busHistoryConflictResponse, 409, "Historical bus delete conflict");
  if ((await json(busHistoryConflictResponse)).error !== "BUS_HAS_TRIP_HISTORY") {
    throw new Error("Bus deletion did not preserve trip history");
  }
  const archiveBusResponse = await request(
    `/api/operator/buses/${bus.id}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(archiveBusResponse, 200, "Historical bus archive");
  if ((await json(archiveBusResponse)).outcome !== "archived") {
    throw new Error("Historical bus was not archived");
  }

  currentStage = "route history archive";
  const archiveRouteResponse = await request(
    `/api/operator/routes/${route.id}`,
    {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    },
    operatorAuth.jar,
  );
  await expectStatus(archiveRouteResponse, 200, "Historical route archive");
  if ((await json(archiveRouteResponse)).outcome !== "archived") {
    throw new Error("Historical route was not archived");
  }

  currentStage = "archived route visibility";
  const servedAfterArchiveResponse = await request("/api/routes/served");
  await expectStatus(
    servedAfterArchiveResponse,
    200,
    "Served routes after archive",
  );
  const servedAfterArchive = await json(servedAfterArchiveResponse);
  if (
    servedAfterArchive.routes?.some(
      (item) =>
        item.origin?.value === origin &&
        item.destination?.value === destination,
    )
  ) {
    throw new Error("Archived route remained in passenger search options");
  }
  const searchAfterArchiveResponse = await request(
    `/api/trips/search?${searchParams}`,
    {},
    passengerAuth.jar,
  );
  await expectStatus(
    searchAfterArchiveResponse,
    200,
    "Trip search after route archive",
  );
  if (
    (await json(searchAfterArchiveResponse)).some(
      (item) => item.id === trip.id,
    )
  ) {
    throw new Error("Archived route trip remained in passenger search results");
  }

  currentStage = "archived scheduling denial";
  await expectStatus(
    await request(
      "/api/operator/trips",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          routeId: route.id,
          busId: bus.id,
          date,
          departureTime: "13:00",
          arrivalTime: "17:00",
          price: 800,
        }),
      },
      operatorAuth.jar,
    ),
    409,
    "Archived route scheduling denial",
  );
  const activeRouteResponse = await request(
    "/api/operator/routes",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ origin: "adama", destination }),
    },
    operatorAuth.jar,
  );
  await expectStatus(activeRouteResponse, 201, "Active validation route");
  const activeRoute = await json(activeRouteResponse);
  await expectStatus(
    await request(
      "/api/operator/trips",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          routeId: activeRoute.id,
          busId: bus.id,
          date,
          departureTime: "13:00",
          arrivalTime: "17:00",
          price: 800,
        }),
      },
      operatorAuth.jar,
    ),
    409,
    "Archived bus scheduling denial",
  );

  currentStage = "logout";
  await signOut(passengerAuth.jar);
  const loggedOutSession = await request(
    "/api/auth/session",
    {},
    passengerAuth.jar,
  );
  const loggedOutData = await json(loggedOutSession);
  if (loggedOutData?.user) {
    throw new Error("Passenger logout did not clear the session");
  }

  console.log(
    JSON.stringify({
      passiveLoginDidNotAuthenticate: true,
      localizedJourneyCallbacksVerified: true,
      operatorJourneyDenied: true,
      publicNavbarLinksVerified: true,
      registration: true,
      registrationDidNotAuthenticate: true,
      normalizedEmail: true,
      roleInjectionRejected: true,
      providerRolesSeparated: true,
      databaseRolesLoaded: true,
      crossRoleApisDenied: true,
      wrongRolePagesRedirected: true,
      operatorPaymentSettingsPersisted: true,
      incompletePaymentSettingsRejected: true,
      paymentSettingsTogglesVerified: true,
      paymentSettingsIsolationVerified: true,
      unavailableMethodsHiddenFromCheckout: true,
      unavailablePaymentHoldPrevented: true,
      routePersisted: true,
      normalizedRouteDuplicatePrevented: true,
      servedRouteOptionsVerified: true,
      unscheduledRoutesExcluded: true,
      inactiveBusTripsExcluded: true,
      busPersisted: true,
      tripPersisted: true,
      bookingPersisted: true,
      doubleBookingPrevented: true,
      seatHoldAndExpiryVerified: true,
      individualExpiredBookingDeletionVerified: true,
      bulkExpiredBookingCleanupVerified: true,
      paidExpiredHistoryPreserved: true,
      expiredOnlyTripDeletionVerified: true,
      completedTripLifecycleVerified: true,
      TelebirrSubmissionVerified: true,
      cbeSubmissionVerified: true,
      duplicateTransactionReferenceRejected: true,
      serverPriceProtected: true,
      paymentVerificationVerified: true,
      paymentRejectionVerified: true,
      paymentResubmissionVerified: true,
      passengerPaymentHistoryVerified: true,
      operatorPaymentManagementVerified: true,
      paymentAccessIsolationVerified: true,
      bookingSearchAndFiltersVerified: true,
      bookingDetailsVerified: true,
      bookingOwnershipVerified: true,
      unusedRecordsDeleted: true,
      dependentRecordsProtected: true,
      bookedTripCancelled: true,
      cancelledTripsExcludedFromSearch: true,
      cancelledTripDisplayedToPassenger: true,
      cancelledBookingsRemovedFromActiveViews: true,
      archivedResourcesExcluded: true,
      contactPersisted: true,
      contactPassengerAssociated: true,
      operatorInboxVerified: true,
      messageStatusVerified: true,
      logoutVerified: true,
    }),
  );
}

main()
  .finally(() => {
    currentStage = `${currentStage} cleanup`;
    return cleanup();
  })
  .catch((error) => {
    console.error(`${currentStage}: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
