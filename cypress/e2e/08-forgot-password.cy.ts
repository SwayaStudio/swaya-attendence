/**
 * Forgot-password flow: load the form, submit an email, get a success
 * message. (The email itself is logged to the console in dev because no
 * SMTP creds are set, so we don't actually click the link here.)
 */
describe("Forgot password flow", () => {
  before(() => {
    cy.task("seed");
  });

  it("loads the forgot-password page", () => {
    cy.visit("/forgot-password");
    cy.contains(/forgot|reset|password/i, { timeout: 10000 });
  });

  it("submits an email and shows a success message", () => {
    cy.visit("/forgot-password");
    cy.get('input[type="email"]').type("alice@demo.com");
    cy.get("form").submit();
    // Toast or page message — either is fine
    cy.contains(/sent|check your email|reset link|if an account exists/i, { timeout: 10000 });
  });
});
