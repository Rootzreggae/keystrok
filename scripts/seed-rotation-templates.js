#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const rotationTemplates = [
  {
    name: "GitHub Token Rotation",
    platform: "github",
    keyType: "github_token",
    description: "Complete workflow for rotating GitHub Personal Access Tokens (PAT) and API keys",
    difficulty: "medium",
    estimatedTime: 15,
    securityLevel: "high",
    complianceReqs: ["SOC2", "PCI"],
    steps: [
      {
        stepNumber: 1,
        name: "Backup Current Configuration",
        description: "Document current token usage and permissions",
        stepType: "backup",
        isRequired: true,
        isAutomated: false,
        instructions: "Document all repositories, workflows, and applications using this token"
      },
      {
        stepNumber: 2,
        name: "Generate New Token",
        description: "Create new GitHub Personal Access Token with identical permissions",
        stepType: "rotation",
        isRequired: true,
        isAutomated: true,
        instructions: "Go to GitHub Settings > Developer settings > Personal access tokens"
      },
      {
        stepNumber: 3,
        name: "Update Applications",
        description: "Update all applications and CI/CD systems with new token",
        stepType: "rotation",
        isRequired: true,
        isAutomated: false,
        instructions: "Update environment variables in all deployment environments"
      },
      {
        stepNumber: 4,
        name: "Test Integration",
        description: "Verify new token works in all applications",
        stepType: "testing",
        isRequired: true,
        isAutomated: true,
        instructions: "Test API calls and repository access with new token"
      },
      {
        stepNumber: 5,
        name: "Revoke Old Token",
        description: "Delete the old token from GitHub",
        stepType: "cleanup",
        isRequired: true,
        isAutomated: true,
        instructions: "Remove old token from GitHub settings after verification"
      }
    ],
    requirements: {
      access: ["GitHub admin access"],
      tools: ["GitHub CLI", "Environment management"],
      time: "15-20 minutes"
    },
    automation: {
      level: "semi_automated",
      tools: ["GitHub API", "gh CLI"],
      testable: true
    },
    instructions: "This template guides you through rotating GitHub tokens safely with minimal downtime.",
    docsUrl: "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token"
  },
  {
    name: "Google Cloud API Key Rotation",
    platform: "google",
    keyType: "google_api_key",
    description: "Secure rotation workflow for Google Cloud Platform API keys and service account keys",
    difficulty: "hard",
    estimatedTime: 25,
    securityLevel: "high",
    complianceReqs: ["SOC2", "PCI", "HIPAA"],
    steps: [
      {
        stepNumber: 1,
        name: "Inventory Key Usage",
        description: "Document all services using this API key",
        stepType: "verification",
        isRequired: true,
        isAutomated: false,
        instructions: "Review GCP audit logs to identify all applications using this key"
      },
      {
        stepNumber: 2,
        name: "Create New Service Account Key",
        description: "Generate new service account key with identical permissions",
        stepType: "rotation",
        isRequired: true,
        isAutomated: true,
        instructions: "Use GCP Console or gcloud CLI to generate new key"
      },
      {
        stepNumber: 3,
        name: "Update Application Configurations",
        description: "Deploy new key to all applications",
        stepType: "rotation",
        isRequired: true,
        isAutomated: false,
        instructions: "Update Kubernetes secrets, environment variables, and configuration files"
      },
      {
        stepNumber: 4,
        name: "Verify API Access",
        description: "Test all API endpoints with new key",
        stepType: "testing",
        isRequired: true,
        isAutomated: true,
        instructions: "Run integration tests to verify API connectivity"
      },
      {
        stepNumber: 5,
        name: "Monitor for Issues",
        description: "Monitor applications for authentication errors",
        stepType: "verification",
        isRequired: true,
        isAutomated: false,
        instructions: "Check logs and monitoring dashboards for 15 minutes"
      },
      {
        stepNumber: 6,
        name: "Revoke Old Key",
        description: "Delete old service account key from GCP",
        stepType: "cleanup",
        isRequired: true,
        isAutomated: true,
        instructions: "Remove old key from Google Cloud Console"
      }
    ],
    requirements: {
      access: ["GCP IAM admin", "Application deployment access"],
      tools: ["gcloud CLI", "kubectl"],
      time: "25-30 minutes"
    },
    automation: {
      level: "semi_automated",
      tools: ["Google Cloud API", "gcloud CLI"],
      testable: true
    },
    instructions: "Complex rotation requiring coordination with multiple GCP services and applications."
  },
  {
    name: "Grafana API Token Rotation",
    platform: "grafana",
    keyType: "grafana_api_key",
    description: "Rotation workflow for Grafana API tokens and service account tokens",
    difficulty: "medium",
    estimatedTime: 20,
    securityLevel: "standard",
    complianceReqs: ["SOC2"],
    steps: [
      {
        stepNumber: 1,
        name: "Document Token Usage",
        description: "Identify all applications and scripts using this token",
        stepType: "verification",
        isRequired: true,
        isAutomated: false,
        instructions: "Check monitoring scripts, alerting systems, and dashboard automation"
      },
      {
        stepNumber: 2,
        name: "Create New API Token",
        description: "Generate new Grafana API token with same permissions",
        stepType: "rotation",
        isRequired: true,
        isAutomated: true,
        instructions: "Use Grafana Admin panel > API Keys or Service Accounts"
      },
      {
        stepNumber: 3,
        name: "Update Monitoring Scripts",
        description: "Replace token in all monitoring and alerting scripts",
        stepType: "rotation",
        isRequired: true,
        isAutomated: false,
        instructions: "Update scripts that query Grafana API for metrics and alerts"
      },
      {
        stepNumber: 4,
        name: "Test Dashboard Access",
        description: "Verify API queries work with new token",
        stepType: "testing",
        isRequired: true,
        isAutomated: true,
        instructions: "Test API endpoints for dashboard queries and data source access"
      },
      {
        stepNumber: 5,
        name: "Revoke Old Token",
        description: "Delete old API token from Grafana",
        stepType: "cleanup",
        isRequired: true,
        isAutomated: true,
        instructions: "Remove old token from Grafana admin panel"
      }
    ],
    requirements: {
      access: ["Grafana admin access"],
      tools: ["Grafana API", "curl/http clients"],
      time: "15-25 minutes"
    },
    automation: {
      level: "semi_automated",
      tools: ["Grafana HTTP API"],
      testable: true
    },
    instructions: "Standard rotation for Grafana tokens used in monitoring and alerting systems."
  },
  {
    name: "Datadog API Key Rotation",
    platform: "datadog",
    keyType: "datadog_api_key",
    description: "Complete rotation workflow for Datadog API keys and application keys",
    difficulty: "medium",
    estimatedTime: 18,
    securityLevel: "standard",
    complianceReqs: ["SOC2", "PCI"],
    steps: [
      {
        stepNumber: 1,
        name: "Audit Key Usage",
        description: "Identify all agents and applications using this key",
        stepType: "verification",
        isRequired: true,
        isAutomated: false,
        instructions: "Check Datadog agents, log forwarders, and monitoring integrations"
      },
      {
        stepNumber: 2,
        name: "Generate New API Key",
        description: "Create new Datadog API key with appropriate permissions",
        stepType: "rotation",
        isRequired: true,
        isAutomated: true,
        instructions: "Use Datadog console > Organization Settings > API Keys"
      },
      {
        stepNumber: 3,
        name: "Update Agent Configurations",
        description: "Deploy new key to all Datadog agents",
        stepType: "rotation",
        isRequired: true,
        isAutomated: false,
        instructions: "Update datadog.yaml config files and restart agents"
      },
      {
        stepNumber: 4,
        name: "Verify Data Flow",
        description: "Confirm metrics and logs are flowing to Datadog",
        stepType: "testing",
        isRequired: true,
        isAutomated: true,
        instructions: "Check Datadog dashboard for recent metrics and log entries"
      },
      {
        stepNumber: 5,
        name: "Disable Old Key",
        description: "Revoke old API key from Datadog console",
        stepType: "cleanup",
        isRequired: true,
        isAutomated: true,
        instructions: "Mark old key as revoked in Datadog settings"
      }
    ],
    requirements: {
      access: ["Datadog admin access", "Server/container access"],
      tools: ["Datadog API", "Configuration management"],
      time: "15-20 minutes"
    },
    automation: {
      level: "semi_automated",
      tools: ["Datadog API", "Ansible/Chef"],
      testable: true
    },
    instructions: "Rotation for Datadog keys requires coordinated agent updates across infrastructure."
  },
  {
    name: "New Relic API Key Rotation",
    platform: "newrelic",
    keyType: "newrelic_api_key",
    description: "Secure rotation workflow for New Relic API keys and license keys",
    difficulty: "medium",
    estimatedTime: 22,
    securityLevel: "standard",
    complianceReqs: ["SOC2"],
    steps: [
      {
        stepNumber: 1,
        name: "Map Key Dependencies",
        description: "Identify all New Relic agents and integrations",
        stepType: "verification",
        isRequired: true,
        isAutomated: false,
        instructions: "Check APM agents, infrastructure agents, and custom integrations"
      },
      {
        stepNumber: 2,
        name: "Generate New License Key",
        description: "Create new license key in New Relic account",
        stepType: "rotation",
        isRequired: true,
        isAutomated: true,
        instructions: "Use New Relic One > Account settings > API keys"
      },
      {
        stepNumber: 3,
        name: "Update Agent Configurations",
        description: "Deploy new license key to all agents",
        stepType: "rotation",
        isRequired: true,
        isAutomated: false,
        instructions: "Update newrelic.ini, environment variables, and config files"
      },
      {
        stepNumber: 4,
        name: "Restart Application Services",
        description: "Restart services to pick up new key",
        stepType: "rotation",
        isRequired: true,
        isAutomated: false,
        instructions: "Gracefully restart applications and infrastructure agents"
      },
      {
        stepNumber: 5,
        name: "Verify Data Collection",
        description: "Confirm telemetry data is flowing to New Relic",
        stepType: "testing",
        isRequired: true,
        isAutomated: true,
        instructions: "Check New Relic dashboards for recent data points"
      },
      {
        stepNumber: 6,
        name: "Revoke Old Key",
        description: "Disable old license key in New Relic console",
        stepType: "cleanup",
        isRequired: true,
        isAutomated: true,
        instructions: "Mark old key as inactive in New Relic settings"
      }
    ],
    requirements: {
      access: ["New Relic admin access", "Application deployment"],
      tools: ["New Relic API", "Application restart capability"],
      time: "20-25 minutes"
    },
    automation: {
      level: "semi_automated",
      tools: ["New Relic API", "Deployment scripts"],
      testable: true
    },
    instructions: "New Relic rotation requires service restarts and careful monitoring of data flow."
  },
  {
    name: "Dynatrace API Token Rotation",
    platform: "dynatrace",
    keyType: "dynatrace_api_token",
    description: "Professional rotation workflow for Dynatrace API tokens and access keys",
    difficulty: "medium",
    estimatedTime: 20,
    securityLevel: "high",
    complianceReqs: ["SOC2", "PCI"],
    steps: [
      {
        stepNumber: 1,
        name: "Inventory Token Scope",
        description: "Document token permissions and usage patterns",
        stepType: "verification",
        isRequired: true,
        isAutomated: false,
        instructions: "Review token scopes and identify all consuming applications"
      },
      {
        stepNumber: 2,
        name: "Create Replacement Token",
        description: "Generate new API token with identical scopes",
        stepType: "rotation",
        isRequired: true,
        isAutomated: true,
        instructions: "Use Dynatrace console > Access tokens > Generate token"
      },
      {
        stepNumber: 3,
        name: "Update Integration Configs",
        description: "Replace token in all monitoring integrations",
        stepType: "rotation",
        isRequired: true,
        isAutomated: false,
        instructions: "Update CI/CD pipelines, alerting systems, and dashboards"
      },
      {
        stepNumber: 4,
        name: "Test API Connectivity",
        description: "Verify new token works with all API endpoints",
        stepType: "testing",
        isRequired: true,
        isAutomated: true,
        instructions: "Test metrics queries, alert configurations, and dashboard access"
      },
      {
        stepNumber: 5,
        name: "Monitor Integration Health",
        description: "Watch for authentication errors for 10 minutes",
        stepType: "verification",
        isRequired: true,
        isAutomated: false,
        instructions: "Monitor Dynatrace and application logs for auth failures"
      },
      {
        stepNumber: 6,
        name: "Revoke Legacy Token",
        description: "Delete old API token from Dynatrace console",
        stepType: "cleanup",
        isRequired: true,
        isAutomated: true,
        instructions: "Remove old token from Access tokens management"
      }
    ],
    requirements: {
      access: ["Dynatrace admin privileges", "Integration management"],
      tools: ["Dynatrace API", "HTTP testing tools"],
      time: "18-25 minutes"
    },
    automation: {
      level: "semi_automated",
      tools: ["Dynatrace REST API", "curl/Postman"],
      testable: true
    },
    instructions: "Dynatrace rotation focuses on maintaining continuous monitoring during key transition."
  }
];

async function seedRotationTemplates() {
  try {
    console.log('🚀 Starting rotation templates seed...');

    // Clear existing templates (idempotent operation)
    await prisma.rotationTemplate.deleteMany({
      where: {
        isSystemTemplate: true
      }
    });
    console.log('✅ Cleared existing system templates');

    // Insert new templates
    for (const template of rotationTemplates) {
      const created = await prisma.rotationTemplate.create({
        data: template
      });
      console.log(`✅ Created template: ${created.name} (${created.platform})`);
    }

    // Verify templates were created
    const count = await prisma.rotationTemplate.count();
    console.log(`\n🎉 Successfully seeded ${count} rotation templates`);

    // Display summary
    const templates = await prisma.rotationTemplate.findMany({
      select: {
        platform: true,
        name: true,
        difficulty: true,
        estimatedTime: true,
        isActive: true
      },
      orderBy: { platform: 'asc' }
    });

    console.log('\n📋 Template Summary:');
    console.table(templates);

  } catch (error) {
    console.error('❌ Error seeding rotation templates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  seedRotationTemplates()
    .then(() => {
      console.log('🔄 Rotation templates seed completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seed failed:', error);
      process.exit(1);
    });
}

module.exports = { seedRotationTemplates, rotationTemplates };