/**
 * Workflow Templates for API Key Rotation
 *
 * This module provides platform-specific templates for guided API key rotation workflows.
 * Each template contains step-by-step instructions optimized for observability platforms.
 */

export interface WorkflowStep {
  name: string
  description: string
  stepType: 'verification' | 'backup' | 'rotation' | 'testing' | 'cleanup' | 'notification'
  instructions: string
  isRequired: boolean
  isAutomated: boolean
  estimatedDuration?: number // in minutes
  validationRules?: Record<string, any>
  dependsOnSteps?: number[]
  blocksSteps?: number[]
}

export interface WorkflowTemplate {
  name: string
  description: string
  platform: string
  estimatedDuration: number // total in minutes
  steps: WorkflowStep[]
}

/**
 * Grafana API Key Rotation Template
 */
const grafanaTemplate: WorkflowTemplate = {
  name: 'Grafana API Key Rotation',
  description: 'Complete rotation workflow for Grafana API keys with zero downtime',
  platform: 'grafana',
  estimatedDuration: 25,
  steps: [
    {
      name: 'Access Grafana Admin',
      description: 'Log into Grafana administration panel',
      stepType: 'verification',
      instructions: `
1. Open your Grafana instance in a web browser
2. Navigate to Administration → API Keys (Configuration → API Keys in older versions)
3. Verify you have admin privileges to create and delete API keys
4. Take note of the current API key name and permissions

**Required Permissions:**
- Admin access to Grafana instance
- Ability to create and revoke API keys

**Important:** Do not revoke the old key until all services are updated!
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 3,
    },
    {
      name: 'Generate New API Key',
      description: 'Create a new API key with identical permissions',
      stepType: 'rotation',
      instructions: `
1. Click "New API Key" or "Add API Key"
2. Set the key name (suggest adding current date: "MyService-$(date +%Y%m%d)")
3. Select the same role as the old key (Viewer, Editor, or Admin)
4. Set expiration date (recommended: 90 days from now)
5. Click "Add" to generate the key

**Copy the API key immediately - you won't see it again!**

Store the new key in your password manager or secure note-taking app temporarily.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 5,
      dependsOnSteps: [1],
    },
    {
      name: 'Update Services Configuration',
      description: 'Update all services and applications using this API key',
      stepType: 'rotation',
      instructions: `
Update the API key in all locations where it's used:

**Common Locations:**
- Environment variables (.env files)
- Kubernetes secrets
- Docker Compose files
- CI/CD pipeline configurations
- Monitoring dashboards
- Alerting integrations
- Infrastructure as Code (Terraform, etc.)

**Update Process:**
1. Identify all services using the old key
2. Update configuration files with the new key
3. Restart services that don't auto-reload configuration
4. Verify services are not using cached values

**Note:** Keep both keys active during this step for zero downtime.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 10,
      dependsOnSteps: [2],
    },
    {
      name: 'Verify New Key Functionality',
      description: 'Test that the new API key works correctly',
      stepType: 'testing',
      instructions: `
Test the new API key across all integrated services:

**Manual Testing:**
1. Use curl or Postman to test API endpoints:
   \`curl -H "Authorization: Bearer NEW_API_KEY" https://your-grafana.com/api/dashboards/home\`
2. Check that dashboards load correctly
3. Verify alerts are being triggered properly
4. Test any custom integrations

**Automated Testing:**
- Run your test suite if available
- Check monitoring dashboards for error rates
- Verify metrics are flowing correctly

**Expected Result:** All services should work identically to before.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 5,
      dependsOnSteps: [3],
    },
    {
      name: 'Monitor for Issues',
      description: 'Watch for any problems with the new key',
      stepType: 'verification',
      instructions: `
Monitor your systems for 15-30 minutes:

**What to Watch:**
- API error rates in Grafana logs
- Failed authentication attempts
- Service health status
- Dashboard loading times
- Alert delivery

**Check These Logs:**
- Grafana server logs
- Application logs for API calls
- Load balancer/proxy logs
- Monitoring system alerts

If everything looks normal, proceed to revoke the old key.
If you see issues, immediately revert to the old key and investigate.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 2,
      dependsOnSteps: [4],
    },
    {
      name: 'Revoke Old API Key',
      description: 'Safely remove the old API key',
      stepType: 'cleanup',
      instructions: `
Now that the new key is working, revoke the old one:

1. In Grafana Admin → API Keys, find the old key
2. Click the red "Revoke" or "Delete" button next to it
3. Confirm the deletion

**Security Note:** This step is critical for security. Old keys should not remain active.

**Backup Consideration:** Some teams keep the old key for 24-48 hours before revoking, but this increases security risk.

The old key is now permanently disabled and cannot be restored.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 1,
      dependsOnSteps: [5],
    },
    {
      name: 'Document and Complete',
      description: 'Update documentation and notify team',
      stepType: 'notification',
      instructions: `
Complete the rotation process:

**Documentation Updates:**
- Update internal documentation with new key details
- Record the rotation date in your security log
- Update any runbooks that reference the old key
- Note the new key's expiration date for future rotations

**Team Notification:**
- Notify relevant team members of successful rotation
- Update password managers or secret stores
- Schedule next rotation reminder (recommend 90 days)

**Cleanup:**
- Securely delete the old key from temporary storage
- Remove any cached or backup copies
- Update monitoring for key expiration alerts

Rotation completed successfully! 🎉
      `.trim(),
      isRequired: false,
      isAutomated: false,
      estimatedDuration: 3,
      dependsOnSteps: [6],
    },
  ],
}

/**
 * Datadog API Key Rotation Template
 */
const datadogTemplate: WorkflowTemplate = {
  name: 'Datadog API Key Rotation',
  description: 'Complete rotation workflow for Datadog API and Application keys',
  platform: 'datadog',
  estimatedDuration: 30,
  steps: [
    {
      name: 'Access Datadog Admin',
      description: 'Navigate to Datadog API key management',
      stepType: 'verification',
      instructions: `
1. Log into your Datadog account (app.datadoghq.com)
2. Navigate to Organization Settings → API Keys
3. Also check Organization Settings → Application Keys if needed
4. Verify admin permissions to create and revoke keys
5. Note which services use API keys vs Application keys

**Key Types:**
- **API Keys:** For sending metrics, traces, logs to Datadog
- **Application Keys:** For querying Datadog API programmatically

Identify which type of key you're rotating before proceeding.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 3,
    },
    {
      name: 'Create New API Key',
      description: 'Generate new API and/or Application keys',
      stepType: 'rotation',
      instructions: `
**For API Keys:**
1. Click "New API Key"
2. Enter a descriptive name (e.g., "Production-Monitoring-20240315")
3. Click "Create API Key"
4. Copy the key value immediately

**For Application Keys:**
1. Go to Application Keys section
2. Click "New Application Key"
3. Enter name and select appropriate scopes/permissions
4. Click "Create Application Key"
5. Copy both the Key ID and Key Secret

**Important:**
- Store keys securely before continuing
- Both API and App keys may be needed depending on your setup
- Datadog allows multiple active keys, so no downtime is required
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 5,
      dependsOnSteps: [1],
    },
    {
      name: 'Update Agent Configurations',
      description: 'Update Datadog agents with new API keys',
      stepType: 'rotation',
      instructions: `
Update API keys in all Datadog agents:

**Common Locations:**
- \`/etc/datadog-agent/datadog.yaml\` (Linux)
- \`C:\\ProgramData\\Datadog\\datadog.yaml\` (Windows)
- Environment variable \`DD_API_KEY\`
- Kubernetes secrets
- Docker environment variables
- Helm chart values

**Update Process:**
1. For each agent/host, update the configuration
2. Restart the Datadog agent: \`sudo systemctl restart datadog-agent\`
3. Verify agent status: \`sudo datadog-agent status\`

**Kubernetes:**
\`kubectl patch secret datadog-secret -p='{"data":{"api-key":"<base64-encoded-new-key>"}}\`
\`kubectl rollout restart daemonset/datadog-agent\`
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 12,
      dependsOnSteps: [2],
    },
    {
      name: 'Update Integrations',
      description: 'Update application keys in integrations and dashboards',
      stepType: 'rotation',
      instructions: `
Update Application Keys in all integrations:

**Common Integration Points:**
- Custom dashboard applications
- CI/CD pipelines querying Datadog API
- External monitoring tools
- Terraform Datadog provider
- Custom scripts and automation

**Update Process:**
1. Update environment variables or config files
2. Restart applications using the Application Key
3. Test API connectivity:
   \`curl -X GET "https://api.datadoghq.com/api/v1/dashboard" -H "DD-API-KEY: NEW_KEY" -H "DD-APPLICATION-KEY: NEW_APP_KEY"\`

**Note:** Keep old keys active during this process to avoid service disruption.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 8,
      dependsOnSteps: [2],
    },
    {
      name: 'Verify Metrics Flow',
      description: 'Confirm data is flowing correctly to Datadog',
      stepType: 'testing',
      instructions: `
Verify all data streams are working:

**Check These Data Types:**
1. **Metrics:** Host metrics, custom metrics, APM metrics
2. **Logs:** Application logs, infrastructure logs
3. **Traces:** APM traces from instrumented applications
4. **Synthetics:** If using synthetic monitoring

**Verification Steps:**
1. Check Datadog Infrastructure List for all hosts
2. Verify recent metrics in dashboards (last 5-10 minutes)
3. Check APM → Services for application traces
4. Verify logs are appearing in Log Explorer
5. Test custom metrics if applicable

**Expected Timeline:** Data should appear within 2-5 minutes of agent restart.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 5,
      dependsOnSteps: [3, 4],
    },
    {
      name: 'Disable Old Keys',
      description: 'Revoke the old API and Application keys',
      stepType: 'cleanup',
      instructions: `
Remove the old keys from Datadog:

**For API Keys:**
1. Go to Organization Settings → API Keys
2. Find the old key in the list
3. Click "Revoke" next to it
4. Confirm revocation

**For Application Keys:**
1. Go to Organization Settings → Application Keys
2. Find the old key in the list
3. Click "Revoke" next to it
4. Confirm revocation

**Verification:**
- Check that no error spikes appear in your monitoring
- Verify all agents continue reporting normally
- Confirm no authentication errors in Datadog agent logs

The old keys are now permanently disabled.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 2,
      dependsOnSteps: [5],
    },
    {
      name: 'Complete Documentation',
      description: 'Update records and notify team',
      stepType: 'notification',
      instructions: `
Finalize the rotation:

**Documentation:**
- Update internal security documentation
- Record new key creation dates
- Update any scripts or runbooks referencing keys
- Set reminder for next rotation (90-180 days recommended)

**Team Communication:**
- Notify DevOps team of successful rotation
- Update shared password managers
- Inform on-call team about the changes

**Cleanup:**
- Securely delete old keys from temporary storage
- Update key rotation schedule
- Verify backup/DR systems use new keys

**Monitoring Setup:**
- Set alerts for key expiration (if Datadog provides this)
- Monitor for any delayed issues over next 24 hours

Datadog key rotation completed successfully! 🚀
      `.trim(),
      isRequired: false,
      isAutomated: false,
      estimatedDuration: 3,
      dependsOnSteps: [6],
    },
  ],
}

/**
 * New Relic License Key Rotation Template
 */
const newRelicTemplate: WorkflowTemplate = {
  name: 'New Relic License Key Rotation',
  description: 'Complete rotation workflow for New Relic license and API keys',
  platform: 'newrelic',
  estimatedDuration: 20,
  steps: [
    {
      name: 'Access New Relic Admin',
      description: 'Navigate to New Relic key management',
      stepType: 'verification',
      instructions: `
1. Log into New Relic (one.newrelic.com)
2. Click on your account name → Administration → API keys
3. Also check Administration → License key if rotating the license key
4. Verify admin access to create and manage keys
5. Identify which key type you need to rotate:
   - **License Key:** For agent data ingestion
   - **User API Key:** For querying NerdGraph API
   - **Ingest API Key:** For custom data ingestion

**Note:** License keys are account-specific and used by all agents.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 2,
    },
    {
      name: 'Generate New License Key',
      description: 'Create new license key with proper configuration',
      stepType: 'rotation',
      instructions: `
**For License Keys:**
1. Go to Administration → License key
2. Click "Create license key"
3. Add descriptive name and notes
4. Copy the license key immediately
5. Note: Old license key remains active

**For API Keys:**
1. Go to Administration → API keys
2. Click "Create a key"
3. Select key type (User key for most use cases)
4. Set name and description
5. Copy the key value

**Important:** New Relic allows multiple active keys, enabling zero-downtime rotation.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 3,
      dependsOnSteps: [1],
    },
    {
      name: 'Update Agent Configurations',
      description: 'Update New Relic agents with new license key',
      stepType: 'rotation',
      instructions: `
Update license key in all New Relic agents:

**Common Configuration Files:**
- \`/etc/newrelic/newrelic.cfg\` (Infrastructure agent)
- \`newrelic.yml\` (Java agent)
- \`newrelic.ini\` (Python agent)
- Environment variable \`NEW_RELIC_LICENSE_KEY\`

**Container Environments:**
- Update Docker environment variables
- Update Kubernetes secrets: \`kubectl patch secret newrelic-license -p='{"data":{"license-key":"<base64-new-key>"}}\`
- Update Helm chart values

**Agent Restart:**
Most agents auto-detect license key changes, but restart to be sure:
- Infrastructure: \`sudo systemctl restart newrelic-infra\`
- APM agents typically require application restart
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 10,
      dependsOnSteps: [2],
    },
    {
      name: 'Update Integrations',
      description: 'Update API keys in external integrations',
      stepType: 'rotation',
      instructions: `
Update API keys in all New Relic integrations:

**Common Integration Points:**
- CI/CD pipelines querying New Relic API
- Custom dashboards and applications
- Terraform New Relic provider
- External monitoring tools
- Alert notification webhooks

**Testing API Connectivity:**
\`curl -H "Api-Key: NEW_API_KEY" "https://api.newrelic.com/v2/applications.json"\`

**Update Process:**
1. Update configuration files and environment variables
2. Restart applications using the API key
3. Test integrations individually
4. Verify custom queries and dashboards work

Keep old API keys active during this process.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 6,
      dependsOnSteps: [2],
    },
    {
      name: 'Verify Data Flow',
      description: 'Confirm all data is reaching New Relic',
      stepType: 'testing',
      instructions: `
Verify data collection across all sources:

**Check These Data Types:**
1. **APM Data:** Application performance metrics
2. **Infrastructure:** Host and container metrics
3. **Browser:** Real user monitoring data
4. **Mobile:** Mobile app performance
5. **Logs:** Application and infrastructure logs
6. **Custom Events:** Any custom data ingestion

**Verification Steps:**
1. Check New Relic Explorer for all entities
2. Verify recent data in dashboards (last 5-10 minutes)
3. Check APM → Applications for transaction data
4. Verify infrastructure hosts are reporting
5. Test custom queries in Query Builder

**Timeline:** Data typically appears within 1-2 minutes of agent restart.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 4,
      dependsOnSteps: [3, 4],
    },
    {
      name: 'Remove Old Keys',
      description: 'Deactivate old license and API keys',
      stepType: 'cleanup',
      instructions: `
Remove old keys from New Relic:

**For License Keys:**
1. Go to Administration → License key
2. Find the old key in the list
3. Click "Delete" next to it
4. Confirm deletion

**For API Keys:**
1. Go to Administration → API keys
2. Find the old key in the list
3. Click "Delete" next to it
4. Confirm deletion

**Post-Deletion Verification:**
- Monitor for any error spikes in applications
- Check agent status in New Relic Infrastructure
- Verify no authentication errors in agent logs
- Confirm all entities continue reporting data

Old keys are now permanently disabled.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 2,
      dependsOnSteps: [5],
    },
    {
      name: 'Finalize and Document',
      description: 'Complete documentation and team notification',
      stepType: 'notification',
      instructions: `
Complete the rotation process:

**Documentation Updates:**
- Update internal documentation with new key details
- Record rotation date in security log
- Update disaster recovery procedures
- Set calendar reminder for next rotation (6-12 months)

**Team Notification:**
- Notify development and operations teams
- Update shared credential stores
- Inform on-call rotation of changes

**Monitoring Setup:**
- Verify alerting continues to work correctly
- Test notification channels
- Update monitoring runbooks if needed

**Security Cleanup:**
- Securely delete old keys from temporary storage
- Clear browser saved passwords if applicable
- Verify backup systems use new keys

New Relic key rotation completed successfully! ✅
      `.trim(),
      isRequired: false,
      isAutomated: false,
      estimatedDuration: 3,
      dependsOnSteps: [6],
    },
  ],
}

/**
 * Dynatrace API Token Rotation Template
 */
const dynatraceTemplate: WorkflowTemplate = {
  name: 'Dynatrace API Token Rotation',
  description: 'Complete rotation workflow for Dynatrace API tokens with proper scoping',
  platform: 'dynatrace',
  estimatedDuration: 25,
  steps: [
    {
      name: 'Access Dynatrace Settings',
      description: 'Navigate to Dynatrace token management',
      stepType: 'verification',
      instructions: `
1. Log into your Dynatrace environment (https://[environment-id].live.dynatrace.com)
2. Navigate to Settings → Integration → Dynatrace API
3. Check "Access tokens" tab for API tokens
4. Verify admin permissions to create and revoke tokens
5. Note the current token's name and scopes

**Token Types:**
- **API Tokens:** For querying Dynatrace API
- **Data Ingest Tokens:** For sending custom metrics/logs
- **Platform Tokens:** For Dynatrace Platform (if applicable)

Document which scopes the current token has before proceeding.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 3,
    },
    {
      name: 'Generate API Token',
      description: 'Create new API token with identical scopes',
      stepType: 'rotation',
      instructions: `
Create a new API token:

1. Click "Generate token"
2. Enter token name (suggest: "ServiceName-YYYYMMDD")
3. **Critical:** Select identical scopes as the old token

**Common Required Scopes:**
- \`DataExport\` - Export monitoring data
- \`ReadConfig\` - Read configuration
- \`WriteConfig\` - Modify configuration
- \`CaptureRequestData\` - Capture request data
- \`davis-read\` - DAVIS AI access
- \`entities.read\` - Read entities
- \`metrics.read\` - Read metrics
- \`problems.read\` - Read problems

4. Set expiration date (recommended: 90 days)
5. Click "Generate"
6. **Copy the token immediately** - you won't see it again!

Store securely before proceeding.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 5,
      dependsOnSteps: [1],
    },
    {
      name: 'Update Integrations',
      description: 'Update all services with the new API token',
      stepType: 'rotation',
      instructions: `
Update the API token in all integration points:

**Common Locations:**
- CI/CD pipeline configurations
- Custom monitoring scripts
- Terraform Dynatrace provider
- External dashboard applications
- Alert notification integrations
- Data export tools

**Update Process:**
1. Update environment variables (\`DT_API_TOKEN\`)
2. Update configuration files
3. Update secret management systems
4. Restart services that don't auto-reload config

**Test Token Immediately:**
\`curl -X GET "https://[environment-id].live.dynatrace.com/api/v1/config/clusterversion" -H "Authorization: Api-Token NEW_TOKEN"\`

Keep both tokens active during this phase.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 10,
      dependsOnSteps: [2],
    },
    {
      name: 'Test Connectivity',
      description: 'Verify new token works across all integrations',
      stepType: 'testing',
      instructions: `
Test the new API token thoroughly:

**API Endpoint Testing:**
1. Test basic connectivity:
   \`curl -H "Authorization: Api-Token NEW_TOKEN" "https://[env].live.dynatrace.com/api/v1/config/clusterversion"\`

2. Test specific scopes you use:
   - Metrics: \`/api/v2/metrics\`
   - Problems: \`/api/v2/problems\`
   - Entities: \`/api/v2/entities\`
   - Events: \`/api/v2/events\`

**Integration Testing:**
- Run your monitoring scripts
- Test dashboard data refresh
- Verify CI/CD pipeline queries work
- Check custom alert integrations

**Expected Results:** All API calls should return 200 OK with valid data.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 5,
      dependsOnSteps: [3],
    },
    {
      name: 'Monitor for Issues',
      description: 'Watch for authentication errors or service disruptions',
      stepType: 'verification',
      instructions: `
Monitor systems for 10-15 minutes:

**Watch For:**
- 401 Unauthorized errors in application logs
- Failed API calls in Dynatrace audit logs
- Missing data in custom dashboards
- CI/CD pipeline failures
- Alert notification failures

**Check These Logs:**
- Application logs making Dynatrace API calls
- Dynatrace audit log (Settings → Preferences → Audit log)
- CI/CD system logs
- External monitoring tool logs

**Verification Points:**
- Custom dashboards refresh successfully
- Scheduled reports generate properly
- Alert notifications continue working

If everything looks good, proceed to revoke the old token.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 3,
      dependsOnSteps: [4],
    },
    {
      name: 'Revoke Old Token',
      description: 'Safely disable the old API token',
      stepType: 'cleanup',
      instructions: `
Remove the old API token:

1. Go back to Settings → Integration → Dynatrace API
2. Find the old token in the "Access tokens" list
3. Click "Revoke" next to the old token
4. Confirm revocation in the dialog

**Post-Revocation Check:**
- Monitor for immediate error spikes
- Check that no services report authentication issues
- Verify all integrations continue working normally

**Security Note:**
Revoking is immediate and irreversible. The old token becomes invalid instantly.

**If Issues Arise:**
Quickly generate a replacement token with the same scopes and update affected services immediately.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 2,
      dependsOnSteps: [5],
    },
    {
      name: 'Complete and Document',
      description: 'Finalize rotation with documentation and notifications',
      stepType: 'notification',
      instructions: `
Complete the token rotation:

**Documentation:**
- Update internal security documentation
- Record new token creation date and expiration
- Update any API integration documentation
- Note scopes used for future reference

**Team Notification:**
- Notify relevant team members of successful rotation
- Update shared credential management systems
- Inform on-call team about the change

**Future Planning:**
- Set calendar reminder for next rotation (60-90 days recommended)
- Update token expiration monitoring if available
- Document any lessons learned

**Cleanup:**
- Securely delete old token from temporary storage
- Clear any cached copies
- Update backup/DR procedures with new token

**Final Verification:**
- Run end-to-end integration tests
- Verify all scheduled jobs continue working
- Check that alerting pipelines function normally

Dynatrace API token rotation completed successfully! 🎯
      `.trim(),
      isRequired: false,
      isAutomated: false,
      estimatedDuration: 4,
      dependsOnSteps: [6],
    },
  ],
}

/**
 * Default/Generic API Key Rotation Template
 */
const genericTemplate: WorkflowTemplate = {
  name: 'Generic API Key Rotation',
  description: 'Standard rotation workflow for any API key or token',
  platform: 'generic',
  estimatedDuration: 15,
  steps: [
    {
      name: 'Prepare for Rotation',
      description: 'Gather information and plan the rotation',
      stepType: 'verification',
      instructions: `
Before starting the rotation:

1. **Document Current State:**
   - Note the current key/token name and format
   - List all services using this key
   - Identify configuration locations
   - Check if multiple keys can be active simultaneously

2. **Plan Downtime:**
   - Determine if zero-downtime rotation is possible
   - Schedule maintenance window if needed
   - Notify stakeholders of planned changes

3. **Backup Configurations:**
   - Save current configuration files
   - Document current settings
   - Prepare rollback plan

4. **Verify Permissions:**
   - Confirm you have admin access to generate new keys
   - Verify you can update all affected services
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 5,
    },
    {
      name: 'Generate New Key',
      description: 'Create the new API key or token',
      stepType: 'rotation',
      instructions: `
Create the new API key:

1. **Access the Platform:**
   - Log into the service provider's admin panel
   - Navigate to API key management section
   - Verify you have key creation permissions

2. **Generate New Key:**
   - Click to create new API key/token
   - Use descriptive name (include date: "Service-20240315")
   - Set appropriate permissions/scopes (match existing key)
   - Set expiration date if supported
   - Copy the new key immediately

3. **Security:**
   - Store the new key securely (password manager)
   - Do not share via unsecured channels
   - Keep the old key active during transition

**Critical:** Save the new key before proceeding!
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 3,
      dependsOnSteps: [1],
    },
    {
      name: 'Update Services',
      description: 'Replace the old key in all services and configurations',
      stepType: 'rotation',
      instructions: `
Update all services with the new key:

1. **Configuration Files:**
   - Update .env files
   - Modify configuration files
   - Update infrastructure code (Terraform, etc.)

2. **Environment Variables:**
   - Update system environment variables
   - Modify Docker/container configurations
   - Update Kubernetes secrets

3. **Applications:**
   - Update hardcoded keys (if any - not recommended)
   - Update application configuration
   - Restart services that don't auto-reload

4. **External Integrations:**
   - Update CI/CD pipeline configurations
   - Modify monitoring tools
   - Update backup systems

**Important:** Test each service after updating its configuration.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 8,
      dependsOnSteps: [2],
    },
    {
      name: 'Test and Verify',
      description: 'Ensure the new key works correctly',
      stepType: 'testing',
      instructions: `
Verify the new key functionality:

1. **Basic Connectivity Test:**
   - Test API endpoints with new key
   - Verify authentication succeeds
   - Check returned data is correct

2. **Service Testing:**
   - Test each updated service individually
   - Verify end-to-end workflows
   - Check for any error messages

3. **Integration Testing:**
   - Test cross-service communication
   - Verify monitoring continues working
   - Check that alerts are functioning

4. **Performance Check:**
   - Monitor response times
   - Check for any degradation
   - Verify rate limits are working

**Success Criteria:** All services work identically to before the rotation.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 5,
      dependsOnSteps: [3],
    },
    {
      name: 'Revoke Old Key',
      description: 'Safely disable the old API key',
      stepType: 'cleanup',
      instructions: `
Remove the old API key:

1. **Final Verification:**
   - Confirm all services are using the new key
   - Check there are no remaining dependencies
   - Verify backup systems have been updated

2. **Revoke the Key:**
   - Return to the platform's admin panel
   - Find the old key in the list
   - Click "Revoke", "Delete", or "Disable"
   - Confirm the action

3. **Immediate Monitoring:**
   - Watch for error spikes in the next few minutes
   - Monitor service health dashboards
   - Check application logs for auth errors

**Security Note:** This action is typically irreversible. Ensure all services are updated first.
      `.trim(),
      isRequired: true,
      isAutomated: false,
      estimatedDuration: 2,
      dependsOnSteps: [4],
    },
    {
      name: 'Document and Notify',
      description: 'Complete the rotation process',
      stepType: 'notification',
      instructions: `
Finalize the rotation:

1. **Documentation:**
   - Update internal documentation
   - Record the rotation date
   - Note the new key's expiration date
   - Update disaster recovery procedures

2. **Team Communication:**
   - Notify relevant team members
   - Update shared password managers
   - Inform stakeholders of completion

3. **Cleanup:**
   - Securely delete the old key from temporary storage
   - Remove old configurations from backups
   - Clear any cached or saved copies

4. **Future Planning:**
   - Schedule next rotation reminder
   - Update key expiration monitoring
   - Document any lessons learned

**Rotation completed successfully!** 🎉
      `.trim(),
      isRequired: false,
      isAutomated: false,
      estimatedDuration: 3,
      dependsOnSteps: [5],
    },
  ],
}

/**
 * Template registry mapping platform types to templates
 */
const WORKFLOW_TEMPLATES: Record<string, WorkflowTemplate> = {
  grafana: grafanaTemplate,
  datadog: datadogTemplate,
  newrelic: newRelicTemplate,
  dynatrace: dynatraceTemplate,
  generic: genericTemplate,
  // Aliases for common variations
  'new-relic': newRelicTemplate,
  'new_relic': newRelicTemplate,
  default: genericTemplate,
}

/**
 * Get all available workflow templates
 */
export function getWorkflowTemplates(): Record<string, WorkflowTemplate> {
  return { ...WORKFLOW_TEMPLATES }
}

/**
 * Get a specific workflow template by platform type
 */
export function getWorkflowTemplate(platform: string): WorkflowTemplate {
  const normalizedPlatform = platform.toLowerCase().trim()
  return WORKFLOW_TEMPLATES[normalizedPlatform] || WORKFLOW_TEMPLATES.generic
}

/**
 * Create workflow steps from a template
 */
export function createWorkflowFromTemplate(
  platform: string,
  templateType: string = 'default'
): Promise<WorkflowStep[]> {
  return Promise.resolve(getWorkflowTemplate(platform).steps)
}

/**
 * Get estimated duration for a platform's workflow
 */
export function getEstimatedDuration(platform: string): number {
  return getWorkflowTemplate(platform).estimatedDuration
}

/**
 * Validate if a platform has a dedicated template
 */
export function hasTemplate(platform: string): boolean {
  const normalizedPlatform = platform.toLowerCase().trim()
  return normalizedPlatform in WORKFLOW_TEMPLATES && normalizedPlatform !== 'default'
}

/**
 * Get list of platforms with dedicated templates
 */
export function getSupportedPlatforms(): string[] {
  return Object.keys(WORKFLOW_TEMPLATES).filter(key =>
    !['generic', 'default'].includes(key)
  )
}