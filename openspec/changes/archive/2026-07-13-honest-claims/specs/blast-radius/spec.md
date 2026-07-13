# Blast radius — delta

## ADDED Requirements

### Requirement: Counts and labels do not overstate
Exposure-site counts SHALL NOT be double-counted: pipeline sites are a subset of exposure sites, and any summary that shows both SHALL make the subset relationship explicit. The `observed` label SHALL be reserved for evidence of a consumer's identity; aggregate platform last-used evidence SHALL be labeled as what it is (platform usage), never as an observed consumer.

#### Scenario: the ledger cell does not inflate
- **WHEN** a key has three exposure sites, one of which is a pipeline file
- **THEN** the summary reads as three locations, not four
