# Key inventory — delta

## ADDED Requirements

### Requirement: One population, every number
Every metric Keystrok renders SHALL count the same workspace-wide population. Operational counts (needs action, tracked, rotating) and hygiene metrics (SLA compliance, MTTR, open exposure days, trend) SHALL be computed instance-wide, never filtered to the signed-in user. Rotation urgency everywhere, including expiration alerts, SHALL anchor to the risk start (attested or git exposure date when earlier than discovery), never to discovery alone.

#### Scenario: Home's two bands agree
- **WHEN** a member opens Home in a workspace with several members' keys
- **THEN** the operational band and the hygiene band count the same keys, so the numbers are comparable

#### Scenario: exposure dates are honored everywhere
- **WHEN** a key has an attested exposure date earlier than discovery
- **THEN** every surface that states urgency, including alerts, uses it
