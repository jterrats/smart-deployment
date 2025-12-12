Feature: Wave Generation
  As a developer
  I want to generate deployment waves
  So that components are deployed in the correct order

  Scenario: Generate waves for independent components
    Given I have 3 components
    When I build the dependency graph
    And I generate deployment waves
    Then I should have 1 waves
    And wave 1 should contain 3 components
    And the operation should succeed

  Scenario: Generate waves with dependencies
    Given I have 2 components
    And component Component1 depends on Component0
    When I build the dependency graph
    And I generate deployment waves
    Then I should have 2 waves
    And wave 1 should contain 1 components
    And wave 2 should contain 1 components
    And the operation should succeed

