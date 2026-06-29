// Contextual risk analysis for detected API keys and secrets

import { Finding, RiskAssessment, ContextAnalysis, KeyValidation } from './types'
import { calculateEntropy } from './utils'

// Risk assessment thresholds
const RISK_THRESHOLDS = {
  ENTROPY_HIGH: 4.5,
  ENTROPY_MEDIUM: 3.5,
  CONFIDENCE_HIGH: 0.8,
  CONFIDENCE_MEDIUM: 0.6,
  LENGTH_SUSPICIOUS: 20
}

// Context patterns for better analysis
const CONTEXT_PATTERNS = {
  TEST_INDICATORS: [
    /test/i, /example/i, /sample/i, /demo/i, /placeholder/i, /dummy/i,
    /fake/i, /mock/i, /stub/i, /temp/i, /temporary/i, /dev/i, /development/i
  ],
  COMMENT_PATTERNS: [
    /^\s*\/\//, /^\s*\/\*/, /^\s*\*/, /^\s*#/, /^\s*<!--/, /^\s*--/
  ],
  STRING_PATTERNS: [
    /['"`]/, /["'`].*["'`]/, /\$\{.*\}/, /\{\{.*\}\}/
  ],
  ASSIGNMENT_PATTERNS: [
    /(\w+)\s*[=:]\s*/, /const\s+(\w+)\s*=/, /var\s+(\w+)\s*=/, /let\s+(\w+)\s*=/
  ],
  ENV_VAR_PATTERNS: [
    /^([A-Z_][A-Z0-9_]*)\s*=/, /process\.env\.([A-Z_][A-Z0-9_]*)/
  ]
}

// File type classifications
const FILE_CLASSIFICATIONS = {
  ENV_FILES: ['.env', '.env.local', '.env.development', '.env.production', '.env.staging', '.env.test'],
  CONFIG_FILES: ['.json', '.yaml', '.yml', '.toml', '.ini', '.config', '.conf'],
  CODE_FILES: ['.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.php', '.go', '.java', '.cs'],
  DOCUMENTATION: ['.md', '.txt', '.rst', '.adoc'],
  TEST_FILES: ['test', 'spec', '__test__', '__tests__', 'tests']
}

export class RiskAnalyzer {
  /**
   * Analyze the risk level of a detected finding
   */
  public analyzeRisk(finding: Finding): RiskAssessment {
    const contextAnalysis = this.analyzeContext(finding)
    const validation = this.validateKeyFormat(finding)

    // Calculate base risk score
    let riskScore = this.calculateBaseRiskScore(finding)

    // Apply context modifiers
    riskScore = this.applyContextModifiers(riskScore, finding, contextAnalysis)

    // Apply validation modifiers
    riskScore = this.applyValidationModifiers(riskScore, validation)

    // Determine final risk level
    const riskLevel = this.determineRiskLevel(riskScore)

    // Generate risk factors
    const riskFactors = this.generateRiskFactors(finding, contextAnalysis, validation)

    // Generate recommendation
    const recommendation = this.generateRecommendation(riskLevel, finding, contextAnalysis)

    return {
      riskLevel,
      riskScore: Math.min(100, Math.max(0, Math.round(riskScore))),
      riskFactors,
      severity: finding.severity,
      confidence: finding.confidence,
      recommendation
    }
  }

  /**
   * Analyze the context around a finding
   */
  public analyzeContext(finding: Finding): ContextAnalysis {
    const lineContent = finding.lineContent.trim()

    // Check if in comment
    const isInComment = this.isInComment(lineContent)

    // Check if in string literal
    const isInString = this.isInString(lineContent, finding.keyPreview)

    // Check if in test file
    const isInTestFile = this.isTestFile(finding.filePath)

    // Check if in example/documentation
    const isInExampleCode = this.isExampleCode(finding.filePath, lineContent)

    // Extract variable name and assignment context
    const variableName = this.extractVariableName(lineContent)
    const assignmentContext = this.extractAssignmentContext(lineContent)

    // Detect code language
    const codeLanguage = this.detectCodeLanguage(finding.fileName)

    // Get surrounding code context
    const surroundingCode = this.getSurroundingCode(finding.beforeContext, finding.afterContext)

    return {
      isInComment,
      isInString,
      isInTestFile,
      isInExampleCode,
      surroundingCode,
      codeLanguage,
      variableName,
      assignmentContext
    }
  }

  /**
   * Validate the format of a detected key
   */
  public validateKeyFormat(finding: Finding): KeyValidation {
    const errors: string[] = []
    let isValid = true
    let formatValid = true
    let lengthValid = true
    let characterSetValid = true

    // Extract the actual key from preview (this is a limitation - we don't have the full key)
    // In a real implementation, this would be done during detection
    const keyLength = finding.estimatedLength

    // Basic length validation
    if (keyLength < 8) {
      lengthValid = false
      errors.push('Key too short to be valid')
    }

    // Platform-specific validation
    const platformSpecificValid = this.validatePlatformSpecific(finding)
    if (!platformSpecificValid.isValid) {
      formatValid = false
      errors.push(...platformSpecificValid.errors)
    }

    // Character set validation based on key type
    const charSetValid = this.validateCharacterSet(finding)
    if (!charSetValid) {
      characterSetValid = false
      errors.push('Invalid character set for key type')
    }

    isValid = formatValid && lengthValid && characterSetValid

    return {
      isValid,
      formatValid,
      lengthValid,
      characterSetValid,
      platformSpecificValid: platformSpecificValid.isValid,
      validationErrors: errors
    }
  }

  private calculateBaseRiskScore(finding: Finding): number {
    let score = 30 // Base score

    // Severity impact
    const severityMultiplier = {
      'critical': 40,
      'high': 30,
      'medium': 20,
      'low': 10
    }
    score += severityMultiplier[finding.severity] || 10

    // Confidence impact
    score += finding.confidence * 30

    // Entropy impact
    if (finding.entropy) {
      if (finding.entropy > RISK_THRESHOLDS.ENTROPY_HIGH) {
        score += 20
      } else if (finding.entropy > RISK_THRESHOLDS.ENTROPY_MEDIUM) {
        score += 10
      }
    }

    // Platform-specific scoring
    if (finding.platform !== 'Generic') {
      score += 15 // Known platform patterns are riskier
    }

    return score
  }

  private applyContextModifiers(score: number, finding: Finding, context: ContextAnalysis): number {
    // File type modifiers
    if (finding.isInEnvFile) {
      score += 25 // .env files are high risk
    } else if (this.isConfigFile(finding.fileName)) {
      score += 15 // Config files are medium-high risk
    }

    // Location modifiers
    if (context.isInComment) {
      score -= 20 // Comments are lower risk
    }

    if (context.isInTestFile) {
      score -= 15 // Test files are lower risk
    }

    if (context.isInExampleCode) {
      score -= 30 // Example code is much lower risk
    }

    // Active usage indicators
    if (finding.isLikelyActive) {
      score += 20
    }

    // Test key indicators
    if (finding.isTestKey) {
      score -= 25
    }

    if (finding.isExampleKey) {
      score -= 35
    }

    return score
  }

  private applyValidationModifiers(score: number, validation: KeyValidation): number {
    if (!validation.isValid) {
      score -= 20 // Invalid format reduces risk
    }

    if (!validation.formatValid) {
      score -= 15
    }

    if (!validation.lengthValid) {
      score -= 10
    }

    return score
  }

  private determineRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
    if (score >= 80) return 'critical'
    if (score >= 60) return 'high'
    if (score >= 40) return 'medium'
    return 'low'
  }

  private generateRiskFactors(
    finding: Finding,
    context: ContextAnalysis,
    validation: KeyValidation
  ): string[] {
    const factors: string[] = []

    // Positive risk factors
    if (finding.isInEnvFile) {
      factors.push('Found in environment configuration file')
    }

    if (finding.confidence > RISK_THRESHOLDS.CONFIDENCE_HIGH) {
      factors.push('High confidence detection pattern')
    }

    if (finding.entropy && finding.entropy > RISK_THRESHOLDS.ENTROPY_HIGH) {
      factors.push('High entropy suggests genuine secret')
    }

    if (finding.platform !== 'Generic') {
      factors.push(`Matches known ${finding.platform} key pattern`)
    }

    if (finding.isLikelyActive) {
      factors.push('Appears to be actively used in code')
    }

    // Negative risk factors
    if (context.isInComment) {
      factors.push('Found in code comment (lower risk)')
    }

    if (context.isInTestFile) {
      factors.push('Found in test file (potentially test data)')
    }

    if (context.isInExampleCode) {
      factors.push('Found in documentation/example code')
    }

    if (finding.isTestKey) {
      factors.push('Appears to be a test/development key')
    }

    if (!validation.isValid) {
      factors.push('Invalid key format detected')
    }

    return factors
  }

  private generateRecommendation(
    riskLevel: string,
    finding: Finding,
    context: ContextAnalysis
  ): string {
    const platform = finding.platform

    switch (riskLevel) {
      case 'critical':
        if (finding.isInEnvFile) {
          return `Immediately rotate this ${platform} key and remove from version control. Review commit history for exposure.`
        }
        return `Immediately rotate this ${platform} key and update all systems using it. Investigate potential exposure.`

      case 'high':
        return `Review and rotate this ${platform} key if it's production data. Ensure proper secret management practices.`

      case 'medium':
        if (context.isInTestFile) {
          return `Verify this is test data. If production, move to secure secret management. If test data, consider using obviously fake values.`
        }
        return `Review this potential ${platform} key. Move to secure storage if genuine, or clearly mark as example if fake.`

      case 'low':
        return `Low-risk detection. Verify this isn't a real ${platform} key. Consider removing if it's example data.`

      default:
        return 'Review this detection and take appropriate action based on your security policies.'
    }
  }

  // Helper methods for context analysis
  private isInComment(line: string): boolean {
    return CONTEXT_PATTERNS.COMMENT_PATTERNS.some(pattern => pattern.test(line))
  }

  private isInString(line: string, keyPreview: string): boolean {
    // This is simplified - would need more sophisticated parsing
    return CONTEXT_PATTERNS.STRING_PATTERNS.some(pattern => pattern.test(line))
  }

  private isTestFile(filePath: string): boolean {
    const lowerPath = filePath.toLowerCase()
    return FILE_CLASSIFICATIONS.TEST_FILES.some(indicator =>
      lowerPath.includes(indicator) || lowerPath.includes(`/${indicator}/`)
    )
  }

  private isExampleCode(filePath: string, lineContent: string): boolean {
    const lowerPath = filePath.toLowerCase()
    const lowerContent = lineContent.toLowerCase()

    const exampleIndicators = ['example', 'sample', 'demo', 'readme', 'doc', 'docs']
    const contentIndicators = ['example', 'sample', 'demo', 'placeholder', 'your_key_here']

    return exampleIndicators.some(indicator => lowerPath.includes(indicator)) ||
           contentIndicators.some(indicator => lowerContent.includes(indicator))
  }

  private isConfigFile(fileName: string): boolean {
    const extension = fileName.split('.').pop()?.toLowerCase()
    return FILE_CLASSIFICATIONS.CONFIG_FILES.includes(`.${extension}`) || false
  }

  private extractVariableName(line: string): string | undefined {
    for (const pattern of CONTEXT_PATTERNS.ASSIGNMENT_PATTERNS) {
      const match = line.match(pattern)
      if (match) {
        return match[1]
      }
    }
    return undefined
  }

  private extractAssignmentContext(line: string): string | undefined {
    // Extract the assignment operation context
    const assignmentMatch = line.match(/(.+)[=:]\s*/)
    return assignmentMatch ? assignmentMatch[1].trim() : undefined
  }

  private detectCodeLanguage(fileName: string): string | undefined {
    const extension = fileName.split('.').pop()?.toLowerCase()

    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'php': 'php',
      'go': 'go',
      'java': 'java',
      'cs': 'csharp',
      'sh': 'shell',
      'bash': 'shell'
    }

    return extension ? languageMap[extension] : undefined
  }

  private getSurroundingCode(beforeContext: string[], afterContext: string[]): string {
    return [...beforeContext, ...afterContext].join('\n').trim()
  }

  private validatePlatformSpecific(finding: Finding): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    let isValid = true

    // Platform-specific validation logic
    switch (finding.keyType) {
      case 'aws_access_key':
        if (!finding.keyPreview.startsWith('AKIA')) {
          isValid = false
          errors.push('AWS Access Key must start with AKIA')
        }
        break

      case 'github_pat':
        if (!finding.keyPreview.startsWith('ghp_')) {
          isValid = false
          errors.push('GitHub PAT must start with ghp_')
        }
        break

      case 'stripe_secret_live':
        if (!finding.keyPreview.startsWith('sk_live_')) {
          isValid = false
          errors.push('Stripe live secret key must start with sk_live_')
        }
        break

      // Add more platform-specific validations
    }

    return { isValid, errors }
  }

  private validateCharacterSet(finding: Finding): boolean {
    // Basic character set validation based on key type
    // This would be more sophisticated in a real implementation

    const keyPreview = finding.keyPreview

    // Remove the masked portion for basic validation
    const visiblePart = keyPreview.replace(/\*+/g, '')

    switch (finding.keyType) {
      case 'aws_access_key':
        return /^[A-Z0-9]+$/.test(visiblePart.replace('AKIA', ''))

      case 'github_pat':
        return /^[a-zA-Z0-9]+$/.test(visiblePart.replace('ghp_', ''))

      default:
        return true // Default to valid for unknown types
    }
  }
}