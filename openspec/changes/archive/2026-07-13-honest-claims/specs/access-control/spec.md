# Access control — delta

## MODIFIED Requirements

### Requirement: Advisory, metadata-only assistant
The optional BYO-LLM assistant (local/Ollama, Anthropic, OpenAI, or OpenAI-compatible; API key encrypted at rest; base URLs SSRF-guarded) SHALL be advisory and metadata-only: it never sees, requests, or emits a secret value, never rotates or revokes, and points the user to guided rotation. It SHALL reason over the whole workspace's key metadata, open findings, and in-progress rotations, matching what the operator sees on screen; the provider configuration stays per-user. When the context exceeds its cap, the assistant SHALL disclose that it is seeing a subset rather than imply completeness.

#### Scenario: the assistant sees what the operator sees
- **WHEN** a member asks the assistant about the workspace in a team with several members' keys
- **THEN** it reasons over all of them, not only the keys the asking member happened to promote

#### Scenario: secret never leaves
- **WHEN** the assistant is asked about a key
- **THEN** it reasons over metadata only; it never sees, requests, or emits the secret value
