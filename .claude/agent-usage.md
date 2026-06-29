# Keystrok Agent Usage Guide

## Quick Decision Matrix

| Deployment issues | `keystrok-deployment-engineer` | Vercel builds, env vars, production bugs |

| Task Type | Agent to Use | Example |
|-----------|-------------|---------|
| Database schema changes | `database-architect` | Adding tables, indexes, migrations |
| SQL query optimization | `database-architect` | Slow queries, performance issues |
| API endpoints | `keystrok-backend-engineer` | `/api/*` routes, authentication |
| Backend logic | `keystrok-backend-engineer` | Scanner logic, workflow steps |
| UI components | `keystrok-frontend-engineer` | React components, Tailwind styling |
| Frontend state | `keystrok-frontend-engineer` | React Query, client-side logic |
| Security audit | `keystrok-security-reviewer` | Pre-deploy checks, vulnerability scan |

## Standard Prompt Templates

### New Feature Implementation
```
Implement [FEATURE NAME]:
1. Use database-architect to create schema for [TABLES]
2. Use keystrok-backend-engineer to build API endpoints at /api/[ENDPOINT]
3. Use keystrok-frontend-engineer to create UI in /dashboard/[PAGE]
Requirements: [SPECIFIC REQUIREMENTS]
DELETE all old code and replace with new implementation.
```

### Bug Fix
```
Fix [BUG DESCRIPTION] in [COMPONENT/FILE]:
Use [SPECIFIC-AGENT].
Current behavior: [WHAT'S BROKEN]
Expected behavior: [WHAT IT SHOULD DO]
DELETE the entire [FILE/COMPONENT] and rewrite it.
```

### Performance Optimization
```
Optimize [WHAT'S SLOW]:
Use database-architect for query optimization OR
Use keystrok-backend-engineer for API performance.
Current performance: [METRICS]
Target: [GOAL]
DELETE and replace implementation.
```

## Agent Sequencing Patterns

### Pattern 1: Full Feature Build
```
database-architect → keystrok-backend-engineer → keystrok-frontend-engineer
```

### Pattern 2: UI-First Development
```
keystrok-frontend-engineer (mockup) → database-architect → keystrok-backend-engineer
```

### Pattern 3: Critical Fix
```
[specific-agent] → keystrok-security-reviewer
```

## Common Scenarios

### Adding New Platform Support
1. `database-architect`: Update platform enum, add config table if needed
2. `keystrok-backend-engineer`: Add platform detection patterns, rotation steps
3. `keystrok-frontend-engineer`: Add platform badge, update forms

### Implementing New Dashboard Widget
1. `keystrok-backend-engineer`: Create `/api/stats/[metric]` endpoint
2. `keystrok-frontend-engineer`: Build widget component with React Query

### Fixing Authentication Issues
1. `keystrok-backend-engineer`: Fix NextAuth configuration
2. `keystrok-security-reviewer`: Verify auth flow security

## Critical Rules for All Agents

1. **ALWAYS DELETE AND REPLACE** - Never patch or modify
2. **USE CONTEXT7 MCP** - Check latest best practices
3. **NO OPTIONS** - Single solution only
4. **REAL DATA** - No mocks or sandbox mode

## Platform Focus
- Grafana
- Datadog
- New Relic
- Dynatrace

*Other platforms are out of scope*

## Emergency Commands

### When Build Fails
```
Use keystrok-backend-engineer to fix build errors in [FILE].
Check package.json and next.config.js.
DELETE and replace problematic code.
```

### When Deploy Fails
```
Use keystrok-backend-engineer to check environment variables.
Verify all API routes return proper responses.
Check Vercel logs for specific errors.
```

## Agent Limitations

- **database-architect**: Cannot execute migrations, only designs them
- **keystrok-backend-engineer**: Focuses on Next.js patterns, not external services
- **keystrok-frontend-engineer**: Terminal aesthetic only, no fancy animations
- **keystrok-security-reviewer**: Advisory only, doesn't fix code

## Prompt Optimization Tips

1. **Be specific about files/paths** - "Fix /app/dashboard/inventory/page.tsx"
2. **Include error messages** - Copy exact error output
3. **Specify the outcome** - "Make it load in under 2 seconds"
4. **One task per prompt** - Don't combine multiple fixes
5. **Name the agent explicitly** - "Use database-architect to..."

---
*Last updated: [Current Date]*
*Keystrok version: Production (no sandbox)*
