# Key Inventory — Delta for Manual Registration

## MODIFIED Requirements

### Requirement: Rotation windows anchored to risk start
The system SHALL compute one rotation window per key: `riskStart + ROTATION_DAYS[severity]` where `ROTATION_DAYS = {critical: 7, high: 30, medium: 60, low: 90}` (unknown severity reads as high). `riskStart` is `foundAt` — which records discovery time for scanned keys and registration time for source-`manual` keys, so the policy needs no source branch — unless an attested exposure date exists that is earlier and not in the future, in which case the earlier date wins. An exposure date can only make rotation more urgent, never later. `rotation-policy.ts` is the single source of these numbers.

#### Scenario: attested exposure
- **WHEN** a member sets an exposure date earlier than discovery
- **THEN** the window re-anchors to it, the source records `user` (human beats git), and a future date is rejected

#### Scenario: manually registered key
- **WHEN** a key enters the ledger via manual registration
- **THEN** its risk start is the registration timestamp, and later exposure evidence (attested or hash-linked finding) can only pull the anchor earlier

### Requirement: Key timeline
The per-key timeline SHALL compose only stored evidence: registered (for manual-source keys) or exposed (git or attested) and discovered, last-used (flagged "used while exposed" when inside the window), liveness checks, and one receipt line per rotation run ("N of M steps receipted", flagging an unverified revoke step). A manual-source key's timeline begins at "registered" and implies no exposure until evidence exists. The exposure window runs from riskStart to rotatedAt and stays open on a failed rotation. Terminal open states: "Awaiting rotation" (no rotation yet) or "Still exposed" (rotated but never revoked).

#### Scenario: used while exposed
- **WHEN** the platform reports the key was used inside the exposure window
- **THEN** the timeline flags that use in crit, the forensic point of the screen

#### Scenario: registered key later found in source
- **WHEN** a Discovery finding hash-links to a manual-source key
- **THEN** the timeline gains an exposure event with the finding's provenance (file, and git blame date when available), and the drawer's narrative shifts from tracked-since-birth to exposed
