/**
 * Employee dashboard: landing, history, regularization, sites pages.
 */
describe("Employee dashboard", () => {
  before(() => {
    cy.task("seed");
  });

  beforeEach(() => {
    cy.loginAs("employee");
  });

  it("renders the dashboard for an employee", () => {
    cy.url().should("include", "/employee");
    cy.contains("Today", { timeout: 10000 });
    cy.contains("Attendance");
  });

  it("shows the history page", () => {
    cy.visit("/employee/history");
    cy.contains("Attendance History", { timeout: 10000 });
  });

  it("shows the regularization page", () => {
    cy.visit("/employee/regularization");
    cy.contains("Regularization", { timeout: 10000 });
    cy.contains("Request correction");
    cy.contains("My requests");
  });

  it("shows the sites page", () => {
    cy.visit("/employee/sites");
    cy.contains(/sites|assigned/i, { timeout: 10000 });
  });
});
