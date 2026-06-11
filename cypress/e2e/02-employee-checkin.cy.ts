/**
 * Employee check-in: inside geofence, outside geofence rejection, check-out flow.
 * Site is at (12.971599, 77.594566) with 200m radius.
 */
describe("Employee check-in / check-out", () => {
  before(() => {
    cy.task("seed");
  });

  beforeEach(() => {
    cy.loginAs("employee");
  });

  it("checks in inside the geofence", () => {
    // Visit with stub BEFORE the page reads geolocation
    cy.mockGeolocation(12.971599, 77.594566, 10, "/employee");
    cy.contains("Check in", { timeout: 15000 }).click();
    // Status badge should switch to present or late
    cy.contains(/^(present|late)$/, { timeout: 20000 }).should("exist");
  });

  it("rejects check-in when outside the geofence", () => {
    // ~5km from the seed site
    cy.mockGeolocation(13.0, 77.6, 10, "/employee");
    cy.contains("Check in", { timeout: 15000 }).click();
    // App should surface an error toast
    cy.contains(/outside|geofence|too far/i, { timeout: 20000 }).should("exist");
  });

  it("checks out after checking in", () => {
    cy.mockGeolocation(12.971599, 77.594566, 10, "/employee");
    // First make sure we're checked in
    cy.contains(/Check in|Check out/, { timeout: 15000 }).then(($btn) => {
      if ($btn.text().includes("Check in")) {
        cy.wrap($btn).click();
        cy.contains(/^(present|late)$/, { timeout: 20000 });
      }
    });
    cy.contains("Check out", { timeout: 10000 }).click();
    // After checkout the button returns to "Check in"
    cy.contains("Check in", { timeout: 20000 });
  });
});
