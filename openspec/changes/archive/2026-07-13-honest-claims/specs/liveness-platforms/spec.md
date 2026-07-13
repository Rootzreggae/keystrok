# Liveness & platforms — delta

## ADDED Requirements

### Requirement: Platforms disclose what they can verify
The platforms surface SHALL state, per provider, whether connecting it enables liveness verification. Providers whose API exposes a matchable fingerprint (currently AWS and Datadog) SHALL be named as such; providers that cannot verify key liveness SHALL say so at connect time and in the empty state, rather than being listed as if they could.

#### Scenario: a provider that cannot verify says so
- **WHEN** a member connects a provider with no listable keys API
- **THEN** the UI states that the connection cannot verify key liveness, and the key drawer's "cannot report usage" copy is corroborated rather than contradicted
