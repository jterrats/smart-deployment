Feature: Start Command
  As a developer
  I want to deploy metadata using the start command
  So that I can deploy changes to Salesforce

  Scenario: Deploy single component
    Given I have a valid Salesforce project
    When I run the start command
    Then waves should be generated
    And deployment should start

  Scenario: Deploy multiple components
    Given I have 5 components to deploy
    When I run the start command
    Then waves should be generated
    And deployment should complete successfully

  Scenario: Dry-run deployment
    Given I have a valid Salesforce project
    When I run the start command with "--dry-run" flag
    Then waves should be generated
    And the operation should succeed

  Scenario: Deploy with dependencies
    Given I have 2 components
    And component Component1 depends on Component0
    When I build the dependency graph
    And I generate deployment waves
    Then I should have 2 waves
    And wave 1 should contain 1 components
    And wave 2 should contain 1 components

