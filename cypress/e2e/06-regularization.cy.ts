/**
 * Regularization end-to-end:
 *  1. Employee checks in.
 *  2. Employee submits a regularization request.
 *  3. Manager sees the pending request and approves it.
 *  4. Employee sees the request as approved.
 */
describe("Regularization end-to-end", () => {
  before(() => {
    cy.task("seed");
  });

  it("employee checks in, submits a request, and manager approves it", () => {
    // 1. Employee checks in
    cy.loginAs("employee");
    cy.mockGeolocation(12.971599, 77.594566, 10, "/employee");
    cy.contains("Check in", { timeout: 15000 }).click();
    // Wait for the badge to change to present/late
    cy.contains(/^(present|late)$/, { timeout: 20000 });
    // Then let the today's API call finish to get the day
    cy.reload();
    cy.url();

    // 2. Employee submits a regularization request
    cy.visit("/employee/regularization");
    cy.wait(500);
    // Pick a request type from the Radix Select
    cy.get('[role="combobox"]').click();
    cy.get('[role="option"]', { timeout: 5000 }).contains("Forgot check-out").click();
    // Fill the reason textarea
    cy.get("textarea").first().clear().type("Forgot to check out before leaving site");
    // Submit; the page first calls /api/attendance/today, then POST /api/regularization
    cy.contains("Submit request").click();
    // The success toast uses Radix Toast (region role) — match by visible text
    cy.contains(/Request submitted|Submitted|already submitted|Failed/i, { timeout: 10000 });

    // 3. Manager logs in and approves
    cy.clearCookies();
    cy.loginAs("manager");
    cy.visit("/manager/approvals");
    cy.contains("Pending regularization", { timeout: 15000 });
    cy.contains("Forgot to check out before leaving site", { timeout: 15000 });
    cy.contains("Approve").click();
    cy.contains("Marked approved", { timeout: 10000 });

    // 4. Employee sees status as approved
    cy.clearCookies();
    cy.loginAs("employee");
    cy.visit("/employee/regularization");
    cy.contains("approved", { timeout: 10000 });
  });
});
