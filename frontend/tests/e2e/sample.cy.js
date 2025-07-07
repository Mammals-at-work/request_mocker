/// <reference types="cypress" />

describe('sample e2e test', () => {
  it('loads the page', () => {
    cy.visit('index.html');
    cy.contains('Start Server');
  });
});
