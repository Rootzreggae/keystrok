# Terminal Design Specification

This document captures the comprehensive terminal aesthetic system used throughout Keystrok, derived from analysis of the main and ready-for-clerk branches.

## Color Palette

### Core Background Colors
- **Primary Background**: `#111417` (HSL: 210 15% 8%) - Main application background, matches landing page exactly
- **Secondary Background**: `#1a1e23` (HSL: 210 15% 12%) - Slightly lighter background for layered elements
- **Card Background**: `#2b2e3b` (HSL: 210 15% 16%) - Elevated surfaces with more distinction

### Terminal Window Colors
- **Terminal Background**: `rgba(30, 30, 30, 0.95)` - Main terminal content area
- **Terminal Background Light**: `rgba(45, 45, 48, 0.9)` - Terminal headers and elevated sections
- **Terminal Border**: `#444` - Standard border color for terminal elements
- **Header Background**: `rgba(35, 35, 38, 0.95)` - Specific to terminal window headers

### Text Colors
- **Primary Text**: `#ffffff` - Pure white for high contrast
- **Terminal Text**: `#d4d4d4` - Standard terminal text color
- **Terminal Text Bright**: `#ffffff` - Bright terminal text for emphasis
- **Terminal Text Muted**: `#a0a0a0` - Subdued text for secondary information
- **Muted Foreground**: `#a3a3a3` (HSL: 0 0% 65%) - Better contrast gray for UI elements

### Accent Colors
- **Primary Accent**: `#0066ff` (HSL: 214 100% 50%) - Professional blue for primary actions
- **Terminal Accent**: `#4ade80` - Signature green accent for terminal elements
- **Terminal Accent Dim**: `rgba(74, 222, 128, 0.1)` - Translucent version for backgrounds
- **Terminal Accent Bright**: `rgba(74, 222, 128, 0.5)` - Semi-transparent version for glows

### Status Colors
- **Success**: `#4ade80` (HSL: 174 72% 56%) - Teal green for success states
- **Warning**: `#f59e0b` (HSL: 32 95% 44%) - Professional amber for warnings
- **Error**: `#ef4444` (HSL: 0 84% 60%) - Clear red for error states
- **Info**: `#0066ff` (HSL: 214 100% 50%) - Blue for informational content

### Terminal Window Control Colors
- **Close Button**: `rgb(239, 68, 68)` - Red circle (bg-red-500)
- **Minimize Button**: `rgb(234, 179, 8)` - Yellow circle (bg-yellow-500)
- **Maximize Button**: `rgb(34, 197, 94)` - Green circle (bg-green-500)

## Typography

### Font Families
- **Primary Monospace**: `'JetBrains Mono', 'Monaco', 'Consolas', 'Courier New', monospace`
- **Fallback Sans**: Standard system font stack for non-terminal elements

### Font Sizes
- **Terminal Content**: `0.875rem` (14px) - text-sm for terminal body content
- **Terminal Title**: `0.75rem` (12px) - text-xs for terminal window titles  
- **Mobile Terminal**: `1rem` (16px) minimum - increased from desktop for better mobile readability
- **Terminal Code**: `0.875em` - Slightly smaller for inline code blocks
- **Terminal Keyboard**: `0.875rem` (14px) - For keyboard shortcuts

### Font Weights
- **Terminal Standard**: `400` (normal) - Default terminal text weight
- **Terminal Medium**: `500` - For emphasized terminal text
- **Terminal Bold**: `600` - For terminal headings and strong emphasis
- **Terminal Title**: `500` (font-medium) - For terminal window titles

### Letter Spacing
- **Terminal Title**: `0.1em` (tracking-wider) - Uppercase terminal window titles
- **Terminal Labels**: `0.05em` - For form labels and buttons
- **Standard Text**: Normal - Default letter spacing for body text

## Visual Effects

### Glow Effects
- **Subtle Blue Glow**: `0 0 20px rgba(0, 102, 255, 0.2)` - For blue elements
- **Subtle Green Glow**: `0 0 20px rgba(74, 222, 128, 0.2)` - For terminal accent elements
- **Subtle Purple Glow**: `0 0 20px rgba(139, 92, 246, 0.2)` - For purple accent elements
- **Terminal Hover Glow**: `0 0 25px rgba(74, 222, 128, 0.5)` - Enhanced hover state
- **Terminal Soft Glow**: `0 0 10px rgba(74, 222, 128, 0.1)` - Minimal ambient glow

### Backdrop Effects
- **Terminal Blur**: `blur(15px)` - Strong backdrop blur for floating terminals
- **Light Blur**: `blur(4px)` - Subtle backdrop blur for overlays (backdrop-blur-sm)

### Shadows
- **Terminal Shadow**: `0 10px 25px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)` - Terminal window depth
- **Elevated Shadow**: `0 20px 40px rgba(0, 0, 0, 0.3)` - For expanded or focused elements
- **Subtle Shadow**: `0 1px 2px 0 rgba(0, 0, 0, 0.05)` - For window control buttons

### Animation Effects
- **Terminal Pulse**: 2s cubic-bezier(0.4, 0, 0.6, 1) infinite - For cursor and loading states
- **Terminal Scan**: 3s linear infinite - Animated scanning line effect
- **Terminal Shimmer**: 2s infinite - Loading state animation across elements
- **Fade In**: 0.3s ease-out - Standard appearance animation
- **Smooth Transitions**: 0.2s ease - Standard state changes
- **Enhanced Transitions**: 0.3s cubic-bezier(0.4, 0, 0.2, 1) - Smooth organic movement

## Layout Patterns

### Terminal Window Structure
- **Window Header Height**: `2rem` (32px) - Standard terminal header height
- **Window Controls**: Three circles (12px diameter) positioned 16px from left edge
- **Window Title**: Positioned after controls with 2px margin-left, uppercase, tracking-wider
- **Content Padding**: `1rem` (16px) - Standard padding for terminal content areas
- **Header Padding**: `0.5rem 1rem` (8px 16px) - Vertical and horizontal header padding

### Border Radius Scale
- **Extra Small**: `0.375rem` (6px) - Fine details
- **Small**: `0.5rem` (8px) - Standard UI elements  
- **Default**: `0.75rem` (12px) - Cards and containers
- **Medium**: `1rem` (16px) - Larger containers
- **Large**: `1.25rem` (20px) - Major layout elements
- **Extra Large**: `1.5rem` (24px) - Hero sections
- **Full Round**: `9999px` - Completely rounded elements

### Grid Systems
- **Hyprland Grid**: Responsive tiling system with container queries
- **Smart Masonry**: Dynamic masonry layout with expansion capabilities
- **Breakpoints**: 320px, 640px, 1024px, 1280px, 1536px for progressive enhancement

### Spacing Conventions
- **Tight Spacing**: `0.5rem` (8px) - Between related elements
- **Standard Spacing**: `1rem` (16px) - General element separation
- **Loose Spacing**: `1.5rem` (24px) - Between unrelated sections
- **Extra Loose**: `2rem` (32px) - Major layout separation

## Interactive Elements

### Button States
- **Default**: `rgba(30, 30, 30, 0.8)` background, `#444` border, `#d4d4d4` text
- **Hover**: `#4ade80` border, `rgba(74, 222, 128, 0.1)` background, `#4ade80` text
- **Focus**: `#4ade80` border with `0 0 0 1px rgba(74, 222, 128, 0.5)` box-shadow
- **Active**: `rgba(74, 222, 128, 0.2)` background
- **Primary**: `#4ade80` background, `#4ade80` border, `#000000` text

### Input Field States
- **Default**: `rgba(30, 30, 30, 0.8)` background, `#444` border, `#d4d4d4` text
- **Focus**: `#4ade80` border, `0 0 0 1px rgba(74, 222, 128, 0.5)` ring
- **Placeholder**: `#666` color, monospace font
- **Disabled**: `0.5` opacity, `grayscale(50%)` filter, `pointer-events: none`

### Table States
- **Header**: `rgba(45, 45, 48, 0.9)` background, `#444` border-bottom
- **Cell**: `rgba(30, 30, 30, 0.5)` background, `#333` border-bottom  
- **Row Hover**: `rgba(74, 222, 128, 0.05)` background
- **Row Border**: `#333` bottom border

### Badge States
- **Default**: `rgba(45, 45, 48, 0.8)` background, `#444` border
- **Success**: `rgba(74, 222, 128, 0.1)` background, `#4ade80` border and text
- **Error**: `rgba(255, 107, 107, 0.1)` background, `#ff6b6b` border and text
- **Warning**: `rgba(255, 217, 61, 0.1)` background, `#ffd93d` border and text

### Focus Indicators
- **Primary Focus**: `2px solid #4ade80` outline with `2px` offset
- **High Contrast**: `2px solid #ffffff` outline for accessibility mode
- **Focus Within**: Applied to containers with focusable children

## Responsive Behavior

### Mobile Adaptations (≤768px)
- **Minimum Font Sizes**: 16px for inputs and buttons (iOS Safari requirement)
- **Enhanced Touch Targets**: Minimum 44px height for interactive elements
- **Increased Padding**: `0.5rem 0.75rem` for better touch interaction
- **Tighter Layouts**: Reduced spacing to accommodate smaller screens
- **Simplified Animations**: Reduced motion for better performance

### Container Queries
- **320px**: Single column layout
- **640px**: Auto-fit columns with 280px minimum width
- **1024px**: Auto-fit columns with 320px minimum width
- **1280px**: Auto-fit columns with 350px minimum width
- **1536px**: Auto-fit columns with 400px minimum width

### Animation Timing
- **Quick Interactions**: `0.2s ease` - State changes, hover effects
- **Standard Animations**: `0.3s ease-out` - Component appearances
- **Complex Animations**: `0.5s cubic-bezier(0.4, 0, 0.2, 1)` - Layout changes
- **Background Animations**: `2-3s` - Ambient effects like scanning lines

## Accessibility Considerations

### High Contrast Mode
- **Background**: `rgba(0, 0, 0, 0.95)` - Pure black background
- **Border**: `#ffffff` - White borders for maximum contrast
- **Text**: `#ffffff` - Pure white text

### Reduced Motion
- **Animations**: Disabled via `animation: none` and `transition: none`
- **Transforms**: Static positioning with `transform: none`
- **Hover Effects**: Simplified to color changes only

### Focus Management
- **Keyboard Navigation**: Clear focus rings with sufficient contrast
- **Focus Within**: Container-level focus indication
- **Text Selection**: Enabled for content, disabled for interactive elements
- **Screen Reader**: Semantic HTML structure with proper ARIA labels

## Print Styles

### Layout Adaptations
- **Grid Systems**: Convert to block layout with `display: block !important`
- **Animations**: Completely disabled with `animation: none`
- **Page Breaks**: `break-inside: avoid` and `page-break-inside: avoid`
- **Spacing**: `1rem` bottom margin for readability
- **Effects**: All transforms and filters removed for clarity
