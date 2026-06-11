/**
 * Manager dashboard: team overview with seeded employees, approvals page.
 */
describe("Manager dashboard", () => {
  before(() => {
    cy.task("seed");
  });

  beforeEach(() => {
    cy.loginAs("manager");
  });

  it("shows the team overview with team members", () => {
    cy.url().should("include", "/manager");
    cy.contains("Team", { timeout: 10000 });
    cy.contains("Alice Employee", { timeout: 10000 });
    cy.contains("Bob Employee");
  });

  it("shows the approvals page with empty state", () => {
    cy.visit("/manager/approvals");
    cy.contains("Approvals", { timeout: 10000 });
    cy.contains("Pending regularization", { timeout: 5000 });
  });

  it("shows the manager reports page", () => {
    cy.visit("/manager/reports");
    cy.contains(/Reports|Filter/i, { timeout: 10000 });
  });
});
