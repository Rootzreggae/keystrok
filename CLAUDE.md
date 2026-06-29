# CLAUDE.md

This file provides guidance to Claude when working with the Keystrok codebase.

## Project Overview
Keystrok is a security platform for API key management, focusing on observability platforms. Built with Next.js 15, it helps developers discover exposed API keys, manage platform configurations, and automate key rotation workflows.

## Core Architecture Principles
- **Clean separation**: User mode (authenticated, real data) is completely isolated from any future sandbox mode
- **Authentication first**: All features require working authentication via NextAuth.js
- **Progressive enhancement**: Build and test each feature completely before adding the next
- **Database-driven**: PostgreSQL via Prisma for all persistent data

## Development Commands
- `npm run dev -- -p 3001` - Development server on port 3001
- `npm run build` - Production build
- `npx prisma db push` - Update database schema
- `npx prisma studio` - Visual database editor
- `npx prisma generate` - Generate Prisma client

## Project Structure
- `app/` - Next.js App Router
  - `api/auth/[...nextauth]/` - Authentication endpoints
  - `(authenticated)/` - Protected routes requiring sign-in
    - `dashboard/` - Main dashboard with security metrics
    - `platform-settings/` - API platform configuration
    - `discovery-scanner/` - Exposed key detection
    - `rotation-workflows/` - Key rotation guidance
  - `auth/` - Authentication pages (signin, verify)
- `components/` - Reusable React components
- `lib/` - Utility functions and configurations
- `prisma/` - Database schema and migrations
- `.claude/agents/` - Specialized AI agents for development

## Key Technologies
- **Next.js 15** with App Router
- **NextAuth.js** for magic link authentication
- **Prisma** ORM with PostgreSQL
- **TypeScript** with strict mode
- **Tailwind CSS** for styling
- **Resend** for email delivery

## Security Focus Areas
- API key detection patterns (AWS, Stripe, GitHub, observability platforms)
- Secure key storage and rotation
- Platform-specific authentication (Grafana service accounts, Datadog API keys)
- Zero-knowledge key management

## Development Phases
1. ✅ Authentication system (magic link → dashboard)
2. 🚧 Dashboard with real metrics
3. 📋 Platform management CRUD
4. 📋 Discovery scanner implementation
5. 📋 Rotation workflow automation
6. 📋 Sandbox mode (future, completely isolated)

## Critical Rules
- Never mix user mode with sandbox mode
- All API keys must be encrypted at rest
- Use server-side validation for all operations
- Test authentication flow after every major change
- Commit working features immediately

## Current Focus
Building clean, working authentication and core features in user mode. Sandbox mode will be added months later as a completely separate system.
