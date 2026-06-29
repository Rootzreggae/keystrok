// API key patterns and detection rules for various platforms

import { KeyPattern } from './types'

// Enhanced API key patterns with better validation and reduced false positives
export const KEY_PATTERNS: KeyPattern[] = [
  // AWS Keys
  {
    name: 'AWS Access Key ID',
    platform: 'AWS',
    keyType: 'aws_access_key',
    pattern: /\b(AKIA[0-9A-Z]{16})\b/gi,
    confidence: 0.98,
    severity: 'critical',
    description: 'AWS Access Key ID for programmatic access',
    examples: ['EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('AKIA') && key.length === 20 && /^[A-Z0-9]+$/.test(key.substring(4))
    }
  },
  {
    name: 'AWS Secret Access Key',
    platform: 'AWS',
    keyType: 'aws_secret_key',
    pattern: /(?:aws.{0,20}secret.{0,20}|secret.{0,20}access.{0,20}key.{0,20})[=:\s]*["']?([A-Za-z0-9/+=]{40})["']?/gi,
    confidence: 0.85,
    severity: 'critical',
    description: 'AWS Secret Access Key for authentication',
    examples: ['EXAMPLE'],
    validationFn: (key: string) => {
      return key.length === 40 && /^[A-Za-z0-9/+=]+$/.test(key)
    }
  },
  {
    name: 'AWS Session Token',
    platform: 'AWS',
    keyType: 'aws_session_token',
    pattern: /(?:aws.{0,20}session.{0,20}token.{0,20})[=:\s]*["']?([A-Za-z0-9/+=]{100,})["']?/gi,
    confidence: 0.90,
    severity: 'high',
    description: 'AWS temporary session token',
    validationFn: (key: string) => {
      return key.length >= 100 && /^[A-Za-z0-9/+=]+$/.test(key)
    }
  },

  // Stripe Keys
  {
    name: 'Stripe Secret Key (Live)',
    platform: 'Stripe',
    keyType: 'stripe_secret_live',
    pattern: /\b(sk_live_[a-zA-Z0-9]{24,})\b/gi,
    confidence: 0.99,
    severity: 'critical',
    description: 'Stripe live secret key - provides full access to Stripe account',
    examples: ['sk_live_EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('sk_live_') && key.length >= 32
    }
  },
  {
    name: 'Stripe Secret Key (Test)',
    platform: 'Stripe',
    keyType: 'stripe_secret_test',
    pattern: /\b(sk_test_[a-zA-Z0-9]{24,})\b/gi,
    confidence: 0.95,
    severity: 'medium',
    description: 'Stripe test secret key',
    examples: ['sk_test_EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('sk_test_') && key.length >= 32
    }
  },
  {
    name: 'Stripe Publishable Key (Live)',
    platform: 'Stripe',
    keyType: 'stripe_publishable_live',
    pattern: /\b(pk_live_[a-zA-Z0-9]{24,})\b/gi,
    confidence: 0.95,
    severity: 'medium',
    description: 'Stripe live publishable key',
    examples: ['pk_live_EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('pk_live_') && key.length >= 32
    }
  },
  {
    name: 'Stripe Publishable Key (Test)',
    platform: 'Stripe',
    keyType: 'stripe_publishable_test',
    pattern: /\b(pk_test_[a-zA-Z0-9]{24,})\b/gi,
    confidence: 0.90,
    severity: 'low',
    description: 'Stripe test publishable key',
    examples: ['pk_test_EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('pk_test_') && key.length >= 32
    }
  },
  {
    name: 'Stripe Restricted Key',
    platform: 'Stripe',
    keyType: 'stripe_restricted',
    pattern: /\b(rk_(test|live)_[a-zA-Z0-9]{24,})\b/gi,
    confidence: 0.95,
    severity: 'high',
    description: 'Stripe restricted API key',
    validationFn: (key: string) => {
      return (key.startsWith('rk_test_') || key.startsWith('rk_live_')) && key.length >= 32
    }
  },

  // GitHub Tokens
  {
    name: 'GitHub Personal Access Token',
    platform: 'GitHub',
    keyType: 'github_pat',
    pattern: /\b(ghp_[a-zA-Z0-9]{36})\b/gi,
    confidence: 0.99,
    severity: 'critical',
    description: 'GitHub Personal Access Token',
    examples: ['ghp_EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('ghp_') && key.length === 40
    }
  },
  {
    name: 'GitHub OAuth Token',
    platform: 'GitHub',
    keyType: 'github_oauth',
    pattern: /\b(gho_[a-zA-Z0-9]{36})\b/gi,
    confidence: 0.99,
    severity: 'critical',
    description: 'GitHub OAuth access token',
    examples: ['gho_EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('gho_') && key.length === 40
    }
  },
  {
    name: 'GitHub App Token',
    platform: 'GitHub',
    keyType: 'github_app',
    pattern: /\b(ghs_[a-zA-Z0-9]{36})\b/gi,
    confidence: 0.99,
    severity: 'critical',
    description: 'GitHub App installation access token',
    examples: ['ghs_EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('ghs_') && key.length === 40
    }
  },
  {
    name: 'GitHub User Access Token',
    platform: 'GitHub',
    keyType: 'github_user',
    pattern: /\b(ghu_[a-zA-Z0-9]{36})\b/gi,
    confidence: 0.99,
    severity: 'critical',
    description: 'GitHub user-to-server token',
    examples: ['ghu_EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('ghu_') && key.length === 40
    }
  },
  {
    name: 'GitHub Refresh Token',
    platform: 'GitHub',
    keyType: 'github_refresh',
    pattern: /\b(ghr_[a-zA-Z0-9]{36})\b/gi,
    confidence: 0.99,
    severity: 'high',
    description: 'GitHub refresh token',
    examples: ['ghr_EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('ghr_') && key.length === 40
    }
  },

  // Grafana Service Account Tokens
  {
    name: 'Grafana Service Account Token',
    platform: 'Grafana',
    keyType: 'grafana_service_account',
    pattern: /\b(glsa_[a-zA-Z0-9]{32}_[a-zA-Z0-9]{8})\b/gi,
    confidence: 0.98,
    severity: 'critical',
    description: 'Grafana Service Account Token for API access',
    examples: ['glsa_EXAMPLE_EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('glsa_') && key.length === 46 && key.split('_').length === 3
    }
  },
  {
    name: 'Grafana API Key (Legacy)',
    platform: 'Grafana',
    keyType: 'grafana_api_key',
    pattern: /(?:grafana.{0,20}api.{0,20}key.{0,20})[=:\s]*["']?([a-zA-Z0-9]{32,})["']?/gi,
    confidence: 0.80,
    severity: 'high',
    description: 'Legacy Grafana API key',
    validationFn: (key: string) => {
      return key.length >= 32 && /^[a-zA-Z0-9]+$/.test(key)
    }
  },

  // Datadog Keys
  {
    name: 'Datadog API Key',
    platform: 'Datadog',
    keyType: 'datadog_api',
    pattern: /(?:dd_api_key|datadog.{0,20}api.{0,20}key)[=:\s]*["']?([a-z0-9]{32})["']?/gi,
    confidence: 0.90,
    severity: 'high',
    description: 'Datadog API key for metrics and logs',
    examples: ['EXAMPLE'],
    validationFn: (key: string) => {
      return key.length === 32 && /^[a-z0-9]+$/.test(key)
    }
  },
  {
    name: 'Datadog Application Key',
    platform: 'Datadog',
    keyType: 'datadog_app',
    pattern: /(?:dd_app_key|datadog.{0,20}app.{0,20}key)[=:\s]*["']?([a-z0-9]{40})["']?/gi,
    confidence: 0.90,
    severity: 'high',
    description: 'Datadog Application key for full API access',
    examples: ['EXAMPLE'],
    validationFn: (key: string) => {
      return key.length === 40 && /^[a-z0-9]+$/.test(key)
    }
  },

  // New Relic
  {
    name: 'New Relic API Key',
    platform: 'New Relic',
    keyType: 'newrelic_api',
    pattern: /\b(NRIQ-[a-zA-Z0-9]{43})\b/gi,
    confidence: 0.95,
    severity: 'high',
    description: 'New Relic Insights Query API key',
    examples: ['NRIQ-EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('NRIQ-') && key.length === 48
    }
  },
  {
    name: 'New Relic License Key',
    platform: 'New Relic',
    keyType: 'newrelic_license',
    pattern: /(?:new.{0,10}relic.{0,20}license.{0,20}key)[=:\s]*["']?([a-z0-9]{40})["']?/gi,
    confidence: 0.85,
    severity: 'high',
    description: 'New Relic License key for agent data ingestion',
    validationFn: (key: string) => {
      return key.length === 40 && /^[a-z0-9]+$/.test(key)
    }
  },

  // Slack Tokens
  {
    name: 'Slack Bot Token',
    platform: 'Slack',
    keyType: 'slack_bot',
    pattern: /\b(xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24})\b/gi,
    confidence: 0.98,
    severity: 'high',
    description: 'Slack Bot User OAuth token',
    examples: ['xoxb-EXAMPLE-EXAMPLE-EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('xoxb-') && key.split('-').length === 4
    }
  },
  {
    name: 'Slack User Token',
    platform: 'Slack',
    keyType: 'slack_user',
    pattern: /\b(xoxp-[0-9]{11,13}-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{32})\b/gi,
    confidence: 0.98,
    severity: 'critical',
    description: 'Slack User OAuth token',
    examples: ['xoxp-EXAMPLE-EXAMPLE-EXAMPLE-EXAMPLE'],
    validationFn: (key: string) => {
      return key.startsWith('xoxp-') && key.split('-').length === 5
    }
  },

  // Generic High-Entropy Patterns (Lower confidence, require context)
  {
    name: 'Generic API Key Pattern',
    platform: 'Generic',
    keyType: 'generic_api_key',
    pattern: /(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token|secret)[_-]?[=:]\s*["']?([a-zA-Z0-9_\-\.]{20,})["']?/gi,
    confidence: 0.65,
    severity: 'medium',
    description: 'Generic API key pattern based on common naming conventions',
    validationFn: (key: string) => {
      return key.length >= 20 && !/^(test|example|sample|demo|placeholder|dummy|null|undefined)$/i.test(key)
    }
  },
  {
    name: 'Generic Secret Pattern',
    platform: 'Generic',
    keyType: 'generic_secret',
    pattern: /(?:secret|password|passwd|pwd)[_-]?[=:]\s*["']?([a-zA-Z0-9_\-\.!@#$%^&*]{12,})["']?/gi,
    confidence: 0.60,
    severity: 'medium',
    description: 'Generic secret pattern',
    validationFn: (key: string) => {
      return key.length >= 12 && !/^(test|example|sample|demo|placeholder|dummy|password|123456)$/i.test(key)
    }
  },
  {
    name: 'High Entropy Base64 String',
    platform: 'Generic',
    keyType: 'high_entropy_base64',
    pattern: /(?:^|[^a-zA-Z0-9])([A-Za-z0-9+/]{32,}={0,2})(?:[^a-zA-Z0-9]|$)/gi,
    confidence: 0.45,
    severity: 'low',
    description: 'High entropy string that could be a base64-encoded secret',
    validationFn: (key: string) => {
      // Check if it's valid base64 and has high entropy
      try {
        atob(key)
        return key.length >= 32 && calculateEntropy(key) > 4.0
      } catch {
        return false
      }
    }
  },
  {
    name: 'Hexadecimal Secret',
    platform: 'Generic',
    keyType: 'hex_secret',
    pattern: /(?:^|[^a-fA-F0-9])([a-fA-F0-9]{40,})(?:[^a-fA-F0-9]|$)/gi,
    confidence: 0.40,
    severity: 'low',
    description: 'Long hexadecimal string that could be a secret',
    validationFn: (key: string) => {
      return key.length >= 40 && /^[a-fA-F0-9]+$/.test(key)
    }
  }
]

// Additional patterns for specific observability platforms
export const OBSERVABILITY_PATTERNS: KeyPattern[] = [
  // Prometheus/AlertManager
  {
    name: 'Prometheus Bearer Token',
    platform: 'Prometheus',
    keyType: 'prometheus_bearer',
    pattern: /(?:prometheus.{0,20}bearer.{0,20}token)[=:\s]*["']?([a-zA-Z0-9_\-\.]{32,})["']?/gi,
    confidence: 0.80,
    severity: 'high',
    description: 'Prometheus Bearer token for authentication'
  },

  // Elastic/Kibana
  {
    name: 'Elasticsearch API Key',
    platform: 'Elasticsearch',
    keyType: 'elasticsearch_api',
    pattern: /(?:elastic.{0,20}api.{0,20}key)[=:\s]*["']?([a-zA-Z0-9_\-\.]{20,})["']?/gi,
    confidence: 0.75,
    severity: 'high',
    description: 'Elasticsearch API key'
  },

  // Splunk
  {
    name: 'Splunk Token',
    platform: 'Splunk',
    keyType: 'splunk_token',
    pattern: /\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/gi,
    confidence: 0.70,
    severity: 'high',
    description: 'Splunk authentication token (UUID format)'
  },

  // PagerDuty
  {
    name: 'PagerDuty Integration Key',
    platform: 'PagerDuty',
    keyType: 'pagerduty_integration',
    pattern: /\b([a-f0-9]{32})\b/gi,
    confidence: 0.60,
    severity: 'medium',
    description: 'PagerDuty integration key (requires context validation)'
  }
]

// File-specific patterns that require additional context
export const CONTEXT_DEPENDENT_PATTERNS: KeyPattern[] = [
  {
    name: 'Environment Variable Secret',
    platform: 'Environment',
    keyType: 'env_secret',
    pattern: /^([A-Z_][A-Z0-9_]*)\s*=\s*["']?([a-zA-Z0-9_\-\.!@#$%^&*]{16,})["']?$/gmi,
    confidence: 0.70,
    severity: 'medium',
    description: 'Environment variable that might contain a secret'
  },
  {
    name: 'JSON Web Token',
    platform: 'JWT',
    keyType: 'jwt_token',
    pattern: /\b(eyJ[a-zA-Z0-9_\-]*\.eyJ[a-zA-Z0-9_\-]*\.[a-zA-Z0-9_\-]*)\b/gi,
    confidence: 0.95,
    severity: 'high',
    description: 'JSON Web Token (JWT)'
  }
]

// Combine all patterns
export const ALL_PATTERNS = [
  ...KEY_PATTERNS,
  ...OBSERVABILITY_PATTERNS,
  ...CONTEXT_DEPENDENT_PATTERNS
]

// Helper function to calculate string entropy
export function calculateEntropy(str: string): number {
  const frequency: Record<string, number> = {}

  for (const char of str) {
    frequency[char] = (frequency[char] || 0) + 1
  }

  let entropy = 0
  const length = str.length

  for (const count of Object.values(frequency)) {
    const probability = count / length
    entropy -= probability * Math.log2(probability)
  }

  return entropy
}

// Get patterns by platform
export function getPatternsByPlatform(platform: string): KeyPattern[] {
  return ALL_PATTERNS.filter(p => p.platform.toLowerCase() === platform.toLowerCase())
}

// Get patterns by key type
export function getPatternsByType(keyType: string): KeyPattern[] {
  return ALL_PATTERNS.filter(p => p.keyType === keyType)
}

// Get high-confidence patterns only
export function getHighConfidencePatterns(minConfidence: number = 0.8): KeyPattern[] {
  return ALL_PATTERNS.filter(p => p.confidence >= minConfidence)
}