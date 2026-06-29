# Exact Landing Page Design Specifications

## Overview
This document contains the precise specifications for recreating the Keystrok landing page design from the main branch. The design uses a **professional dark theme with blue and purple accents** - NOT terminal green. The original design is sophisticated and developer-focused with modern visual effects.

## Analysis Notes
- **Main vs Ready-for-Clerk**: Both branches contain identical landing page implementations
- **Color Scheme**: Professional dark theme with specific HSL values, not terminal green
- **Key Features**: Draggable floating windows, particle effects, terminal aesthetics, auto-rearrange functionality

---

## 1. Color Palette & Theme

### Core Background Colors
```css
--background: 210 15% 8%;           /* #111417 - Main background */
--background-light: 210 15% 12%;    /* #1a1e23 - Slightly lighter */
--foreground: 0 0% 100%;            /* #ffffff - Pure white text */
```

### Primary Brand Colors
```css
--primary: 214 100% 50%;            /* #0066ff - Professional blue */
--primary-foreground: 0 0% 100%;    /* White text on blue */
```

### Accent Colors
```css
--secondary: 174 72% 56%;           /* #4ade80 - Success green/teal */
--accent: 262 83% 58%;              /* #8b5cf6 - Purple accent */
--success: 174 72% 56%;             /* #4ade80 - Teal green */
--warning: 32 95% 44%;              /* #f59e0b - Professional amber */
--destructive: 0 84% 60%;           /* #ef4444 - Clear red */
--info: 214 100% 50%;               /* #0066ff - Blue for info */
```

### Terminal Color Palette
```css
--terminal-bg: rgba(30, 30, 30, 0.95);
--terminal-bg-light: rgba(45, 45, 48, 0.9);
--terminal-border: #444;
--terminal-text: #d4d4d4;
--terminal-text-muted: #a0a0a0;
--terminal-text-bright: #ffffff;
--terminal-accent: #4ade80;         /* Teal green for terminal highlights */
--terminal-red: #ff6b6b;
--terminal-yellow: #ffd93d;
--terminal-blue: #74c0fc;
--terminal-purple: #d0bfff;
```

### Border & Surface Colors
```css
--border: 210 15% 20%;              /* #374151 - Visible but subtle borders */
--card: 210 15% 16%;                /* #2b2e3b - Elevated surfaces */
--input: 210 15% 8%;                /* #111417 - Match background */
```

---

## 2. Layout Structure

### Main Container
```jsx
<div className="min-h-screen bg-background pt-2">
  <Navigation />
  <main>
    <Hero />
    <FloatingWindows />
  </main>
  <footer>
    {/* Footer content */}
  </footer>
</div>
```

### Responsive Breakpoints
- Mobile: `< 768px`
- Tablet: `768px - 1024px`
- Desktop: `> 1024px`
- Max width: `max-w-7xl mx-auto`

---

## 3. Navigation Component

### Structure
```jsx
<nav className={`z-50 transition-all duration-300 ease-in-out mx-4 md:mx-6 lg:mx-8 ${
  isNavbarSticky
    ? "sticky top-2 bg-card/80 backdrop-blur-md shadow-sm rounded-full py-2"
    : "relative bg-card/80 backdrop-blur-md rounded-full py-2"
}`}>
```

### Logo Design
```jsx
<div className="logo-container relative">
  <Shield className="h-6 w-6 logo-icon transition-all duration-300 group-hover:text-primary" />
  <div className="absolute inset-0 bg-primary/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
</div>
<span className="text-xl font-bold text-foreground font-mono tracking-tight">
  KEYSTROK<span className="text-primary animate-pulse">_</span>
</span>
```

### Logo Container Styling
```css
.logo-container {
  background-color: hsl(217 91% 60% / 0.15);  /* Blue background with 15% opacity */
  border: 1px solid hsl(217 91% 60% / 0.25);  /* Blue border with 25% opacity */
  padding: 12px;
  border-radius: 50px;                        /* Fully rounded */
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.logo-container:hover {
  background-color: hsl(217 91% 60% / 0.2);   /* Slightly more opaque on hover */
  border-color: hsl(217 91% 60% / 0.35);      /* Stronger border on hover */
}

.logo-icon {
  color: hsl(217 91% 60%);                    /* Blue color for the shield icon */
  width: 24px;
  height: 24px;
}
```

---

## 4. Hero Section

### Main Container
```jsx
<section className="relative terminal-card rounded-3xl shadow-none px-4 sm:px-6 md:px-8 lg:px-3 pb-8 sm:pb-10 md:pb-12 lg:pb-14 transition-all duration-300 ease-in-out -mt-16 mx-2 pt-[120px]">
```

### Background Effects
1. **Particle System**: Using `@tsparticles/react` with specific configuration
2. **Floating Geometric Elements**: Positioned absolutely with CSS animations
3. **Grid Overlay**: Very subtle repeating linear gradients
4. **Backdrop**: Terminal card styling with blur effects

### Particle Configuration
```typescript
{
  particles: {
    color: { value: "#8b5cf6" },      // Purple accent
    links: {
      color: "#0066ff",               // Primary blue
      distance: 150,
      opacity: 0.15,
      width: 1,
    },
    number: { value: 50 },
    opacity: { value: { min: 0.1, max: 0.4 } },
    size: { value: { min: 1, max: 2.5 } },
    move: {
      speed: 0.8,
      random: true,
      outModes: { default: "bounce" },
    }
  }
}
```

### Typography Hierarchy
```jsx
<h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl font-bold leading-tight tracking-tight">
  Most API key tools are built for enterprises. This one is built for developers who just want to get stuff done.
</h1>

<p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
  Track your API keys. Know who created them. Renew them for security. That's it.
  <span className="block mt-2 text-base text-primary font-mono neon-text">
    // Why pay for 47 features when you only need 3? This is the tool built for the problem.
  </span>
</p>
```

### CTA Buttons
```jsx
{/* Primary Button */}
<Button className="rounded px-8 py-6 text-lg font-semibold bg-blue-600 hover:bg-blue-700 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-600/25 relative overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000"></div>
  {/* Button content with z-index layering */}
</Button>

{/* Secondary Button */}
<Button variant="outline" className="rounded px-8 py-6 text-lg font-semibold border-2 border-slate-600 hover:bg-slate-800/50 transition-all duration-300 hover:scale-105 bg-transparent text-slate-300 hover:text-white">
```

---

## 5. Terminal Window Component

### Structure
```jsx
<div className="rounded-lg shadow-lg overflow-hidden bg-[rgba(45,45,48,0.95)] backdrop-blur-sm border border-[rgba(255,255,255,0.1)]">
  {/* Window Controls */}
  <div className="flex items-center gap-2 px-4 py-2 bg-[rgba(35,35,38,0.95)] border-b border-[rgba(255,255,255,0.1)]">
    <div className="flex gap-2">
      <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div>
      <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm"></div>
      <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
    </div>
    <span className="text-[#e5e5e5] text-xs font-mono ml-2 uppercase tracking-wider font-medium">
      {title}
    </span>
  </div>
  
  {/* Content Area */}
  <div className="p-4 font-mono text-sm text-[#e5e5e5] leading-relaxed whitespace-pre-wrap min-h-[100px]">
    {children}
  </div>
</div>
```

---

## 6. Floating Windows System

### Core Concept
The floating windows create an interactive demo showing code files that users can drag around. After 8 seconds of inactivity, they automatically return to their original positions.

### Window Data Structure
```typescript
interface WindowData {
  id: string;
  title: string;
  content: string | React.ReactNode;
  className: string;
  ascii: string;
  x: number;
  y: number;
  initialX: number;
  initialY: number;
  isDragging: boolean;
  isUserMoved: boolean;
  zIndex: number;
}
```

### Initial Windows
1. **story.md** - The real story behind the project
2. **features.js** - Core features in JavaScript format
3. **security.py** - Security handling policy
4. **demo.tsx** - Sandbox mode initialization
5. **waitlist.sh** - Interactive waitlist form (spans 2 columns)

### Drag Implementation
```typescript
const handleMouseDown = (e: React.MouseEvent, id: string) => {
  // Calculate offset from mouse to element
  const rect = windowRef.getBoundingClientRect();
  offset.current = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
  
  // Set dragging state and bring to front
  setWindows(prev => prev.map(w => 
    w.id === id 
      ? { ...w, isDragging: true, isUserMoved: true }
      : w
  ));
  bringToFront(id);
};
```

### Auto-Reset Timer
```typescript
// Reset windows to original positions after 8 seconds
resetTimerRef.current = setTimeout(() => {
  setWindows(prev => prev.map(w => ({
    ...w,
    x: w.initialX,
    y: w.initialY,
    isUserMoved: false,
  })));
}, 8000);
```

### Window Styling
```jsx
<div
  className="absolute rounded-xl overflow-hidden bg-[rgba(30,30,30,0.95)] border border-[#444] shadow-[0_20px_40px_rgba(0,0,0,0.3)]"
  style={{
    left: win.x,
    top: win.y,
    backdropFilter: "blur(15px)",
    transition: win.isDragging ? "none" : "all 0.5s ease-out",
    zIndex: win.zIndex,
  }}
>
```

---

## 7. Typography System

### Font Stack
```css
font-family: 'JetBrains Mono', 'Monaco', 'Consolas', 'Courier New', monospace;
```

### Scale
```css
.text-display-1 { @apply text-7xl font-light leading-[1.1] tracking-[-0.03em]; }
.text-display-2 { @apply text-6xl font-light leading-[1.1] tracking-[-0.02em]; }
.text-h1 { @apply text-4xl font-bold leading-[1.2] tracking-[-0.02em]; }
.text-h2 { @apply text-3xl font-bold leading-[1.3] tracking-[-0.01em]; }
.text-h3 { @apply text-2xl font-semibold leading-[1.4]; }
.text-body-lg { @apply text-lg font-normal leading-[1.7]; }
.text-body { @apply text-base font-normal leading-[1.6]; }
```

### Terminal Typography
```css
.terminal-heading-lg { @apply text-lg font-mono font-semibold leading-tight; color: #ffffff; }
.terminal-heading-md { @apply text-base font-mono font-semibold leading-tight; color: #ffffff; }
.terminal-content { @apply text-sm font-mono leading-relaxed; color: #d4d4d4; }
.terminal-title { @apply text-xs font-mono ml-2 uppercase tracking-wider font-medium; color: #d4d4d4; }
```

---

## 8. Animation & Effects

### Keyframe Animations
```css
@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes terminal-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes terminal-scan {
  0% { transform: translateY(-100%); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateY(100%); opacity: 0; }
}
```

### Floating Elements
```jsx
<div className="absolute top-20 left-10 w-4 h-4 border border-primary/20 rotate-45 animate-float-slow"></div>
<div className="absolute top-40 right-20 w-6 h-6 border border-success/20 rotate-12 animate-float-medium"></div>
<div className="absolute bottom-40 left-20 w-3 h-3 bg-accent/20 rounded-full animate-float-fast"></div>
```

### Transition System
- Duration: `300ms` for most interactions
- Timing: `ease-in-out` for smooth animations
- Transform: `hover:scale-105` for buttons
- Opacity: Fade effects on state changes

---

## 9. Interactive Elements

### Button States
```css
/* Primary Button */
.btn-primary {
  background: #0066ff;
  border: none;
  color: white;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  background: #0052cc;
  transform: scale(1.05);
  box-shadow: 0 8px 25px rgba(0, 102, 255, 0.25);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  border: 2px solid #64748b;
  color: #cbd5e1;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: rgba(51, 65, 85, 0.5);
  color: white;
  transform: scale(1.05);
}
```

### Form Elements
```css
input, textarea, select {
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid #444;
  color: #d4d4d4;
  font-family: 'JetBrains Mono', monospace;
}

input:focus, textarea:focus, select:focus {
  border-color: #4ade80;
  box-shadow: 0 0 0 1px rgba(74, 222, 128, 0.5);
  outline: none;
}

::placeholder {
  color: #666;
  font-family: 'JetBrains Mono', monospace;
}
```

---

## 10. Responsive Behavior

### Mobile Optimizations
```css
@media (max-width: 768px) {
  .terminal-content { font-size: 1rem; padding: 1rem; }
  .terminal-input, .terminal-button { font-size: 1rem; padding: 0.5rem 0.75rem; }
  .text-base { font-size: 1.125rem !important; }
  .text-sm { font-size: 1rem !important; }
  .text-xs { font-size: 0.875rem !important; }
}
```

### Layout Adjustments
- Hero section: Stacked layout on mobile
- Floating windows: Hidden on mobile (using `hidden lg:block`)
- Navigation: Hamburger menu implementation
- Buttons: Full width on mobile

---

## 11. Accessibility Features

### Focus Management
```css
.terminal-focus-visible:focus-visible {
  outline: 2px solid var(--terminal-accent);
  outline-offset: 2px;
}

.terminal-focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-gray-900;
}
```

### High Contrast Support
```css
@media (prefers-contrast: high) {
  .terminal-aesthetic {
    --terminal-border: #ffffff;
    --terminal-text: #ffffff;
    --terminal-accent: #00ff00;
  }
}
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  .terminal-pulse,
  .terminal-scan,
  .terminal-shimmer {
    animation: none;
  }
  
  .terminal-card,
  .terminal-button,
  .terminal-input {
    transition: none;
  }
}
```

---

## 12. Implementation Notes

### Key Dependencies
- `@tsparticles/react` - Particle effects
- `@tsparticles/slim` - Lightweight particles engine
- `lucide-react` - Icon system
- `next/navigation` - Next.js routing
- `next-auth/react` - Authentication

### Performance Considerations
- Particles are GPU-accelerated
- Dragging uses `transform` for performance
- Event listeners are properly cleaned up
- Components are client-side only where needed

### Browser Compatibility
- Modern browsers supporting CSS Grid and Flexbox
- Backdrop-filter support required for blur effects
- Fallbacks provided for unsupported features

---

## Summary

This landing page design is **NOT terminal green themed** but rather uses a sophisticated **professional dark theme** with:

1. **Blue primary color** (`#0066ff`) for branding and CTAs
2. **Purple accents** (`#8b5cf6`) for highlights and particles  
3. **Teal green** (`#4ade80`) for success states and terminal text
4. **Dark backgrounds** with precise HSL values
5. **Professional typography** using JetBrains Mono
6. **Interactive particle effects** and draggable windows
7. **Smooth animations** and transitions throughout
8. **Full responsive design** with mobile optimizations
9. **Accessibility features** and reduced motion support
10. **Auto-rearrange functionality** after 8 seconds of inactivity

The design strikes a balance between being developer-focused (with terminal aesthetics) while maintaining a professional, modern appearance suitable for a SaaS product targeting developers and technical teams.