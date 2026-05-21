# filepath: /Users/carlosledesma/projects/request_mocker/mcp-tests/test.feature

Feature: Navigation on Request Mocker Page

    As a user
    I want to navigate through the Request Mocker interface
    So that I can manage datasources, configure settings, handle API endpoints, and view logs

    Background:
        Given the Request Mocker page is loaded

    Scenario: Navigate to Datasources section
        When I click on the "Datasources" summary button
        Then the datasources details should expand
        And I should see the file input and save button

    Scenario: Navigate to Configuration section
        When I click on the "Configuration" summary button
        Then the configuration details should expand
        And I should see the port input and language select options

    Scenario: Navigate to API Management section
        When I view the API Management section
        Then I should see the OpenAPI file input, browse button, throttle slider, and start switch
        And the status should show "🔴 Stopped"

    Scenario: Navigate to Endpoints details
        When I click on the "Endpoints" summary button
        Then the endpoints details should expand
        And I should see the routes table with method, path, status, and actions

    Scenario: Navigate to Logs details
        When I click on the "Logs" summary button
        Then the logs details should expand
        And I should see the logs container and refresh/clear buttons

    Scenario: Open endpoint configuration modal
        Given the endpoints are displayed
        When I click on the config icon for an endpoint
        Then the modal should open
        And I should see the endpoint configuration form

    Scenario: Close endpoint configuration modal
        Given the modal is open
        When I click the Cancel or Confirm button or outside the modal
        Then the modal should close

    Scenario: Start the server
        Given an OpenAPI file is selected
        When I toggle the start switch to on
        Then the status should change to "🟢 🏃‍➡️ on http://localhost:8000"
        And logs should start refreshing automatically

    Scenario: Stop the server
        Given the server is running
        When I toggle the start switch to off
        Then the status should change to "🔴 Stopped"
        And logs should be cleared

    Scenario: Refresh logs
        Given the logs section is open
        When I click the "Refresh" button
        Then the logs should update with the latest entries

    Scenario: Clear logs
        Given there are logs displayed
        When I click the "Clear" button
        Then the logs container should be empty