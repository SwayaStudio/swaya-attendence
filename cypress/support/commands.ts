/**
 * Custom Cypress commands.
 */

declare global {
  namespace Cypress {
    interface Chainable {
      loginAs(role: "admin" | "manager" | "employee" | "super_admin", email?: string, password?: string): Chainable<void>;
      mockGeolocation(lat: number, lng: number, accuracy?: number, path?: string): Chainable<void>;
      setGeolocation(lat: number, lng: number, accuracy?: number, path?: string): Chainable<void>;
      logout(): Chainable<void>;
      clearDb(): Chainable<void>;
    }
  }
}

const CREDENTIALS: Record<string, { email: string; password: string }> = {
  admin: { email: "admin@demo.com", password: "password123" },
  manager: { email: "manager@demo.com", password: "password123" },
  employee: { email: "alice@demo.com", password: "password123" },
  super_admin: { email: "super@demo.com", password: "password123" },
};

type Coords = {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  toJSON?: () => unknown;
};

function buildPosition(lat: number, lng: number, accuracy: number) {
  const coords: Coords = {
    latitude: lat,
    longitude: lng,
    accuracy,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({}),
  };
  return {
    coords,
    timestamp: Date.now(),
  };
}

function stubGeolocation(win: Cypress.AUTWindow, lat: number, lng: number, accuracy: number) {
  cy.stub(win.navigator.geolocation, "getCurrentPosition").callsFake((success: PositionCallback) => {
    success(buildPosition(lat, lng, accuracy) as unknown as GeolocationPosition);
  });
  cy.stub(win.navigator.geolocation, "watchPosition").callsFake((success: PositionCallback) => {
    success(buildPosition(lat, lng, accuracy) as unknown as GeolocationPosition);
    return 1;
  });
}

Cypress.Commands.add("loginAs", (role, email, password) => {
  const cred = email && password ? { email, password } : CREDENTIALS[role];
  if (!cred) throw new Error("No credentials for role: " + role);
  return cy.visit("/login").then(() => {
    cy.get('input[type="email"]').clear().type(cred.email);
    cy.get('input[type="password"]').clear().type(cred.password);
    cy.get('button[type="submit"]').click();
    // Wait for NextAuth session cookie + middleware redirect to settle.
    cy.url({ timeout: 20000 }).should("not.include", "/login");
  });
});

Cypress.Commands.add("logout", () => {
  // NextAuth requires a server-issued CSRF token for signout. Hit /csrf first,
  // then POST to /api/auth/signout with that token. If signout is not strictly
  // required for a test, prefer clearing cookies directly to avoid 4xx noise.
  cy.clearCookies({ domain: null });
});

Cypress.Commands.add("clearDb", () => {
  cy.task("cleanup");
});

Cypress.Commands.add("mockGeolocation", (lat, lng, accuracy = 10, path = "/") => {
  return cy.visit(path, {
    onBeforeLoad(win) {
      stubGeolocation(win, lat, lng, accuracy);
    },
  });
});

Cypress.Commands.add("setGeolocation", (lat, lng, accuracy = 10, path = "/") => {
  return cy.visit(path, {
    onBeforeLoad(win) {
      stubGeolocation(win, lat, lng, accuracy);
    },
  });
});