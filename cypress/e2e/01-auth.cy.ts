/**
 * Auth flow: unauth redirect, role-based login, wrong-password rejection,
 * and route-prefix protection.
 */
describe("Authentication", () => {
  before(() => {
    cy.task("seed");
  });

  it("redirects unauthenticated users from / to /login", () => {
    cy.clearCookies();
    cy.visit("/");
    cy.url().should("include", "/login");
  });

  it("logs in as employee and lands on /employee", () => {
    cy.loginAs("employee");
    cy.url().should("include", "/employee");
    cy.contains("Today", { timeout: 10000 });
  });

  it("logs in as admin and lands on /admin", () => {
    cy.loginAs("admin");
    cy.url().should("include", "/admin");
    cy.contains("Overview", { timeout: 10000 });
  });

  it("logs in as manager and lands on /manager", () => {
    cy.loginAs("manager");
    cy.url().should("include", "/manager");
    cy.contains("Team", { timeout: 10000 });
  });

  it("rejects wrong password and stays on /login", () => {
    cy.visit("/login");
    cy.get('input[type="email"]').type("alice@demo.com");
    cy.get('input[type="password"]').type("definitely-wrong-password");
    cy.get('button[type="submit"]').click();
    // Toast appears; we look for the URL and the toast text
    cy.contains("Invalid email or password", { timeout: 10000 }).should("be.visible");
    cy.url().should("include", "/login");
  });

  it("blocks employee from /admin (middleware role guard)", () => {
    cy.loginAs("employee");
    cy.visit("/admin", { failOnStatusCode: false });
    cy.url({ timeout: 10000 }).should("include", "/employee");
  });

  it("blocks employee from /manager (middleware role guard)", () => {
    cy.loginAs("employee");
    cy.visit("/manager", { failOnStatusCode: false });
    cy.url({ timeout: 10000 }).should("include", "/employee");
  });

  it("blocks manager from /admin (middleware role guard)", () => {
    cy.loginAs("manager");
    cy.visit("/admin", { failOnStatusCode: false });
    cy.url({ timeout: 10000 }).should("include", "/manager");
  });
});
