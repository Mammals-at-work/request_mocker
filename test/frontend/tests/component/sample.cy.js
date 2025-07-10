/// <reference types="cypress" />

describe('sample component test', () => {
  it('mounts App component', () => {
    cy.visit('index.html');
    cy.contains('Request Mocker');
  });
});
