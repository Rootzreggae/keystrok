# Keystrok Design System

A comprehensive terminal-inspired design system for the Keystrok security platform, optimized for developer tools and dashboard interfaces.

## Design Principles

### Core Philosophy
- **Security-First UX**: Critical information is immediately visible and unambiguous
- **Terminal Aesthetic**: Familiar, keyboard-driven experience for developers
- **Progressive Disclosure**: Complex security information is layered appropriately
- **Safe Operations**: Dangerous actions require deliberate confirmation
- **Accessibility**: Works for all users, including screen readers and high contrast needs

### Visual Hierarchy
1. **Critical Alerts**: Red/orange for immediate threats
2. **Status Information**: Green for healthy, amber for warnings
3. **Primary Actions**: Accessible and obvious
4. **Secondary Data**: Visible but not distracting
5. **Context**: Available when needed

---

## Color Palette

### Background Colors
```css
/* Core Backgrounds - Dark terminal theme */
--keystrok-bg-primary: #1a1b1b;           /* Main dashboard background */
--keystrok-bg-secondary: #262829;         /* Panel backgrounds */  
--keystrok-bg-elevated: #2d2f30;          /* Modal overlays, elevated content */
--keystrok-bg-inner: #1f2021;             /* Inner element backgrounds */

/* Terminal Window Backgrounds */
--keystrok-terminal-main: rgba(30, 30, 30, 0.95);
--keystrok-terminal-light: rgba(45, 45, 48, 0.9);
--keystrok-terminal-header: rgba(35, 35, 38, 0.95);
```

### Border Colors
```css
--keystrok-border-primary: #3a3b3c;       /* Main borders, dividers */
--keystrok-border-secondary: #363738;     /* Subtle borders, inner elements */
--keystrok-border-accent: rgba(74, 222, 128, 0.3); /* Focus states, active elements */
```

### Text Colors
```css
--keystrok-text-primary: #e4e4e7;         /* Primary text, headings */
--keystrok-text-secondary: #d4d4d4;       /* Body text, labels */  
--keystrok-text-muted: #9ca3af;           /* Secondary information */
--keystrok-text-dimmed: #71717a;          /* Disabled, placeholder text */
--keystrok-text-bright: #ffffff;          /* High emphasis text */
```

### Status & Alert Colors
```css
/* Security Status Colors */
--keystrok-status-secure: #22c55e;        /* No issues, secure state */
--keystrok-status-warning: #fb923c;       /* Attention needed, non-critical */
--keystrok-status-warning-alt: #f59e0b;   /* Alternative warning shade */
--keystrok-status-critical: #f87171;      /* High severity issues */
--keystrok-status-error: #ef4444;         /* System errors, failures */
--keystrok-status-info: #0066ff;          /* Informational messages */

/* Terminal Accent Colors */
--keystrok-accent-primary: #4ade80;       /* Primary interactive elements */
--keystrok-accent-dim: rgba(74, 222, 128, 0.1);
--keystrok-accent-bright: rgba(74, 222, 128, 0.5);
```

### Window Control Colors (macOS Style)
```css
--keystrok-window-close: #ff5f56;         /* Red close button */
--keystrok-window-minimize: #ffbd2e;      /* Yellow minimize button */
--keystrok-window-maximize: #27c93f;      /* Green maximize button */
```

---

## Typography

### Font Families
```css
/* Monospace for terminal elements, code, data */
--keystrok-font-mono: 'JetBrains Mono', 'SF Mono', Monaco, Consolas, 'Courier New', monospace;

/* Sans-serif for UI elements, forms */
--keystrok-font-sans: system-ui, -apple-system, 'SF Pro Display', sans-serif;
```

### Font Sizes
```css
/* Terminal-specific sizing (13px base) */
--keystrok-font-xs: 10px;    /* 0.625rem - Small labels, metadata */
--keystrok-font-sm: 11px;    /* 0.6875rem - Secondary text */
--keystrok-font-base: 13px;  /* 0.8125rem - Body text, terminal content */
--keystrok-font-md: 14px;    /* 0.875rem - Headings, emphasis */
--keystrok-font-lg: 16px;    /* 1rem - Large headings */
--keystrok-font-xl: 20px;    /* 1.25rem - Page titles */
```

### Typography Classes
```css
.keystrok-heading-xl {
  font-family: var(--keystrok-font-mono);
  font-size: var(--keystrok-font-xl);
  font-weight: 700;
  color: var(--keystrok-text-primary);
  line-height: 1.2;
}

.keystrok-heading-lg {
  font-family: var(--keystrok-font-mono);
  font-size: var(--keystrok-font-lg);
  font-weight: 600;
  color: var(--keystrok-text-primary);
  line-height: 1.3;
}

.keystrok-body {
  font-family: var(--keystrok-font-mono);
  font-size: var(--keystrok-font-base);
  font-weight: 400;
  color: var(--keystrok-text-secondary);
  line-height: 1.5;
}

.keystrok-label {
  font-family: var(--keystrok-font-mono);
  font-size: var(--keystrok-font-sm);
  font-weight: 500;
  color: var(--keystrok-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.keystrok-code {
  font-family: var(--keystrok-font-mono);
  font-size: var(--keystrok-font-sm);
  color: var(--keystrok-accent-primary);
  background: var(--keystrok-bg-inner);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  border: 1px solid var(--keystrok-border-secondary);
}
```

---

## Layout & Spacing

### Grid System
```css
/* Dashboard grid spacing */
--keystrok-grid-gap: 12px;               /* Standard gap between cards/panels */
--keystrok-grid-gap-lg: 20px;            /* Large gap for major sections */

/* Panel spacing */
--keystrok-panel-padding: 16px;          /* Standard panel padding */
--keystrok-panel-padding-sm: 12px;       /* Compact panel padding */
--keystrok-panel-padding-lg: 24px;       /* Generous panel padding */

/* Component spacing */
--keystrok-component-gap: 8px;           /* Gap between related elements */
--keystrok-component-gap-lg: 12px;       /* Gap between component groups */
```

### Border Radius
```css
--keystrok-radius-sm: 4px;               /* Inner elements, badges */
--keystrok-radius: 8px;                  /* Standard panels, cards */
--keystrok-radius-lg: 12px;              /* Large panels, modals */
```

---

## Components

### Terminal Window
The core visual metaphor for Keystrok's interface.

#### Structure
```css
.keystrok-terminal-window {
  background: var(--keystrok-terminal-main);
  border: 1px solid var(--keystrok-border-primary);
  border-radius: var(--keystrok-radius);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(15px);
  overflow: hidden;
  font-family: var(--keystrok-font-mono);
}

.keystrok-terminal-header {
  height: 32px;
  background: var(--keystrok-terminal-header);
  border-bottom: 1px solid var(--keystrok-border-primary);
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.keystrok-terminal-content {
  padding: 16px;
  min-height: 200px;
  background: var(--keystrok-terminal-main);
}
```

#### Window Controls
```css
.keystrok-window-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.keystrok-window-control {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.keystrok-window-control:hover {
  transform: scale(1.1);
}

.keystrok-control-close { background: var(--keystrok-window-close); }
.keystrok-control-minimize { background: var(--keystrok-window-minimize); }
.keystrok-control-maximize { background: var(--keystrok-window-maximize); }
```

### Dashboard Panels
Standard containers for dashboard content.

#### Panel Structure
```css
.keystrok-panel {
  background: var(--keystrok-bg-secondary);
  border: 1px solid var(--keystrok-border-primary);
  border-radius: var(--keystrok-radius);
  overflow: hidden;
}

.keystrok-panel-header {
  background: linear-gradient(to bottom, var(--keystrok-bg-elevated), var(--keystrok-bg-secondary));
  padding: 12px 16px;
  border-bottom: 1px solid var(--keystrok-border-secondary);
}

.keystrok-panel-title {
  font-family: var(--keystrok-font-mono);
  font-size: var(--keystrok-font-md);
  font-weight: 600;
  color: var(--keystrok-text-primary);
  margin: 0;
}

.keystrok-panel-content {
  padding: var(--keystrok-panel-padding);
  background: var(--keystrok-bg-secondary);
}
```

### Status Indicators
Critical for security information display.

#### Security Status Badges
```css
.keystrok-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: var(--keystrok-radius-sm);
  font-family: var(--keystrok-font-mono);
  font-size: var(--keystrok-font-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid;
  gap: 4px;
}

.keystrok-status-secure {
  background: rgba(34, 197, 94, 0.1);
  border-color: var(--keystrok-status-secure);
  color: var(--keystrok-status-secure);
}

.keystrok-status-warning {
  background: rgba(251, 146, 60, 0.1);
  border-color: var(--keystrok-status-warning);
  color: var(--keystrok-status-warning);
}

.keystrok-status-critical {
  background: rgba(248, 113, 113, 0.1);
  border-color: var(--keystrok-status-critical);
  color: var(--keystrok-status-critical);
}
```

### Interactive Elements
Buttons, inputs, and interactive components.

#### Buttons
```css
.keystrok-button {
  font-family: var(--keystrok-font-mono);
  font-size: var(--keystrok-font-sm);
  font-weight: 500;
  padding: 8px 16px;
  border-radius: var(--keystrok-radius-sm);
  border: 1px solid var(--keystrok-border-primary);
  background: var(--keystrok-bg-inner);
  color: var(--keystrok-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.keystrok-button:hover {
  border-color: var(--keystrok-accent-primary);
  background: var(--keystrok-accent-dim);
  color: var(--keystrok-accent-primary);
  transform: translateY(-1px);
}

.keystrok-button:focus {
  outline: 2px solid var(--keystrok-accent-bright);
  outline-offset: 2px;
}

.keystrok-button-primary {
  background: var(--keystrok-accent-dim);
  border-color: var(--keystrok-accent-primary);
  color: var(--keystrok-accent-primary);
}

.keystrok-button-danger {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--keystrok-status-error);
  color: var(--keystrok-status-error);
}
```

#### Input Fields
```css
.keystrok-input {
  font-family: var(--keystrok-font-mono);
  font-size: var(--keystrok-font-base);
  padding: 8px 12px;
  border-radius: var(--keystrok-radius-sm);
  border: 1px solid var(--keystrok-border-primary);
  background: var(--keystrok-bg-inner);
  color: var(--keystrok-text-secondary);
  width: 100%;
  transition: all 0.15s ease;
}

.keystrok-input::placeholder {
  color: var(--keystrok-text-dimmed);
  font-style: italic;
}

.keystrok-input:focus {
  border-color: var(--keystrok-accent-primary);
  outline: 2px solid var(--keystrok-accent-bright);
  outline-offset: -1px;
  background: var(--keystrok-bg-secondary);
}

.keystrok-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--keystrok-bg-primary);
}
```

### Data Tables
For displaying security metrics and logs.

```css
.keystrok-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--keystrok-font-mono);
  font-size: var(--keystrok-font-sm);
}

.keystrok-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 500;
  color: var(--keystrok-text-muted);
  background: var(--keystrok-bg-elevated);
  border-bottom: 1px solid var(--keystrok-border-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: var(--keystrok-font-xs);
}

.keystrok-table td {
  padding: 12px 16px;
  color: var(--keystrok-text-secondary);
  border-bottom: 1px solid var(--keystrok-border-secondary);
  vertical-align: top;
}

.keystrok-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.keystrok-table tbody tr:last-child td {
  border-bottom: none;
}
```

---

## Animations & Effects

### Transitions
```css
/* Standard transition timing */
--keystrok-transition-fast: 0.15s ease;
--keystrok-transition-normal: 0.25s ease;
--keystrok-transition-slow: 0.4s ease;

/* Interactive element transitions */
.keystrok-interactive {
  transition: all var(--keystrok-transition-fast);
}

.keystrok-interactive:hover {
  transform: translateY(-1px);
}
```

### Loading States
```css
@keyframes keystrok-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.keystrok-loading {
  animation: keystrok-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes keystrok-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.keystrok-shimmer {
  position: relative;
  overflow: hidden;
}

.keystrok-shimmer::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, 
    transparent, 
    rgba(255, 255, 255, 0.1), 
    transparent);
  animation: keystrok-shimmer 2s infinite;
}
```

---

## Responsive Design

### Breakpoints
```css
/* Mobile-first approach */
--keystrok-mobile: 640px;    /* sm */
--keystrok-tablet: 768px;    /* md */
--keystrok-desktop: 1024px;  /* lg */
--keystrok-wide: 1280px;     /* xl */
```

### Mobile Adaptations
```css
@media (max-width: 768px) {
  .keystrok-terminal-window {
    margin: 8px;
    border-radius: var(--keystrok-radius-sm);
  }
  
  .keystrok-terminal-content {
    padding: 12px;
    font-size: var(--keystrok-font-base);
  }
  
  .keystrok-panel-content {
    padding: 12px;
  }
  
  .keystrok-button {
    padding: 12px 16px;
    min-height: 44px; /* Touch target size */
  }
  
  .keystrok-input {
    font-size: 16px; /* Prevent iOS zoom */
    padding: 12px;
    min-height: 44px;
  }
}
```

---

## Accessibility

### Focus Management
```css
/* Focus rings for keyboard navigation */
.keystrok-focus-ring:focus {
  outline: 2px solid var(--keystrok-accent-primary);
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  :root {
    --keystrok-bg-primary: rgba(0, 0, 0, 0.95);
    --keystrok-text-primary: #ffffff;
    --keystrok-border-primary: rgba(255, 255, 255, 0.4);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .keystrok-interactive {
    transition: none;
  }
  
  .keystrok-loading,
  .keystrok-shimmer {
    animation: none;
  }
}
```

### Screen Reader Support
```css
.keystrok-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## Implementation Guidelines

### CSS Custom Properties Integration
Add these custom properties to your root CSS or Tailwind config:

```css
:root {
  /* Copy all --keystrok-* variables from above */
}
```

### Tailwind CSS Extension
Update your `tailwind.config.ts`:

```typescript
export default {
  theme: {
    extend: {
      colors: {
        keystrok: {
          bg: {
            primary: '#1a1b1b',
            secondary: '#262829',
            elevated: '#2d2f30',
            inner: '#1f2021',
          },
          border: {
            primary: '#3a3b3c',
            secondary: '#363738',
          },
          text: {
            primary: '#e4e4e7',
            secondary: '#d4d4d4',
            muted: '#9ca3af',
            dimmed: '#71717a',
          },
          status: {
            secure: '#22c55e',
            warning: '#fb923c',
            critical: '#f87171',
            error: '#ef4444',
          },
          accent: {
            primary: '#4ade80',
          }
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        'keystrok-xs': '10px',
        'keystrok-sm': '11px',
        'keystrok-base': '13px',
        'keystrok-md': '14px',
        'keystrok-lg': '16px',
        'keystrok-xl': '20px',
      },
      spacing: {
        'keystrok-grid': '12px',
        'keystrok-panel': '16px',
        'keystrok-component': '8px',
      }
    }
  }
}
```

### Component Usage Examples

#### Dashboard Panel
```tsx
<div className="keystrok-panel">
  <div className="keystrok-panel-header">
    <h2 className="keystrok-panel-title">API Key Status</h2>
  </div>
  <div className="keystrok-panel-content">
    <div className="keystrok-status-badge keystrok-status-secure">
      SECURE
    </div>
  </div>
</div>
```

#### Terminal Window
```tsx
<div className="keystrok-terminal-window">
  <div className="keystrok-terminal-header">
    <div className="keystrok-window-controls">
      <button className="keystrok-window-control keystrok-control-close" />
      <button className="keystrok-window-control keystrok-control-minimize" />
      <button className="keystrok-window-control keystrok-control-maximize" />
    </div>
    <span className="keystrok-terminal-title">keystrok-scan</span>
  </div>
  <div className="keystrok-terminal-content">
    <div className="keystrok-body">
      Scanning for exposed API keys...
    </div>
  </div>
</div>
```

---

## Design Tokens Summary

This design system prioritizes:

1. **Immediate Security Context**: Critical information uses red/orange, safe states use green
2. **Developer Familiarity**: Terminal aesthetic with monospace fonts and familiar patterns
3. **Accessibility**: High contrast, keyboard navigation, screen reader support
4. **Consistency**: Standardized spacing, colors, and typography across all components
5. **Scalability**: CSS custom properties and utility classes for maintainable styling

The system is designed to grow with Keystrok's needs while maintaining visual consistency and security-focused user experience principles.