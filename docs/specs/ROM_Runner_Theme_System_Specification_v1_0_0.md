# ROM Runner - Theme System Specification

**Version:** 1.0.0  
**Created:** January 7, 2026  
**Status:** Ready for Development  
**Related Documents:** 
- `ROM_Runner_Complete_Requirements_v2_5_0.md`
- `types_v1_0_0.ts` → Superseded by `types_v1_1_0.ts`
- `settingsStore_v1_0_0.ts` → Superseded by `settingsStore_v1_1_0.ts`
- `tokens.css` → Superseded by `tokens_v1_1_0.css`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Brand Identity](#2-brand-identity)
3. [Theme Architecture](#3-theme-architecture)
4. [Built-in Themes](#4-built-in-themes)
5. [Custom Theme Support](#5-custom-theme-support)
6. [Theme Switching UI](#6-theme-switching-ui)
7. [Accessibility Requirements](#7-accessibility-requirements)
8. [TypeScript Interfaces](#8-typescript-interfaces)
9. [CSS Implementation](#9-css-implementation)
10. [Design Reference Links](#10-design-reference-links)

---

## 1. Overview

### 1.1 Purpose

ROM Runner supports multiple visual themes to provide users with a personalized experience. Themes control visual aspects only - fonts, colors, shadows, border styles, and basic shape properties. **Themes do NOT change layout, functionality, or feature availability.**

### 1.2 Core Principles

| Principle | Description |
|-----------|-------------|
| **Layout Consistency** | UI element positions never change between themes |
| **Feature Parity** | All features available in all themes |
| **Accessibility First** | All themes meet WCAG 2.1 AA standards |
| **Dark Mode Support** | Most themes have light and dark variants |
| **Customization** | Users can create and import custom themes |

### 1.3 What Themes Control

Themes control these visual properties ONLY:

- **Colors**: Background, text, accent, border, shadows
- **Typography**: Font family, font weights
- **Shadows**: Box shadows, neumorphic effects, glows
- **Border Styles**: Radius (rounded vs sharp), widths
- **Button Styles**: Hover effects, pressed states
- **Component Shapes**: Rounded corners vs 90° angles

### 1.4 What Themes DO NOT Control

- Page layouts and component positions
- Feature availability
- Navigation structure
- Modal/dialog placements
- Sidebar width or position
- Grid column counts

---

## 2. Brand Identity

### 2.1 Logo Assets

ROM Runner uses a pixel-art running character logo with two variants:

| Asset | Description | Files |
|-------|-------------|-------|
| **Badge** | Circular logo mark only | `Rom_Runner_-_Badge_1.svg`, `Rom_Runner_-_Badge_1_2x.png` |
| **Full** | Logo mark + "Rom Runner" wordmark | `Rom_Runner_-_Full_1.svg`, `Rom_Runner_-_Full_1_2x.png` |

### 2.2 Brand Colors

Extracted from official logo:

```css
/* Primary brand colors */
--brand-blue: #1f6cb2;         /* Logo circle background */
--brand-navy: #02375e;         /* Logo text color */
--brand-gray: #dbddda;         /* Logo pixel character */
```

### 2.3 Brand Usage Guidelines

- Logo should appear in header/title bar
- Badge variant used for favicons, app icons, small contexts
- Full variant used for splash screens, about dialogs, marketing
- Brand colors should be used as accent colors in default themes

---

## 3. Theme Architecture

### 3.1 Theme System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Theme System                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │
│  │  Built-in   │   │    User     │   │   Import/   │           │
│  │   Themes    │   │   Custom    │   │   Export    │           │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘           │
│         │                 │                 │                   │
│         └────────────┬────┴────────────────┘                   │
│                      ▼                                          │
│              ┌──────────────┐                                   │
│              │ Theme Engine │                                   │
│              │  (CSS Vars)  │                                   │
│              └──────┬───────┘                                   │
│                     ▼                                           │
│              ┌──────────────┐                                   │
│              │  CSS Custom  │                                   │
│              │  Properties  │                                   │
│              └──────────────┘                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Theme Identification

Each theme has a unique identifier:

```typescript
type ThemeId = 
  | 'default-light'      // Default Light
  | 'default-dark'       // Default Dark
  | 'neumorphic-light'   // Neumorphism Light
  | 'neumorphic-dark'    // Neumorphism Dark
  | 'retro-light'        // Retro Theme Light
  | 'retro-dark'         // Retro Theme Dark
  | 'terminal'           // Retro Terminal (no variants)
  | `custom-${string}`;  // Custom themes

type ThemeMode = 'light' | 'dark' | 'system';
```

### 3.3 Theme Selection Model

Users select TWO things:

1. **Theme Family**: e.g., "Neumorphism", "Retro", "Terminal"
2. **Color Mode**: Light, Dark, or System (follows OS preference)

**Note:** Terminal theme ignores color mode - it's always dark (green on black).

---

## 4. Built-in Themes

### 4.1 Theme Summary

| Theme Family | Has Light | Has Dark | Description |
|--------------|-----------|----------|-------------|
| **Default** | ✓ | ✓ | Clean, modern, professional |
| **Neumorphism** | ✓ | ✓ | Soft shadows, extruded UI elements |
| **Retro** | ✓ | ✓ | Vintage gaming aesthetic |
| **Terminal** | ✗ | Fixed | Green phosphor terminal look |

### 4.2 Default Theme

The default theme provides a clean, modern look suitable for extended use.

**Default Light:**
- Background: White/light gray surfaces
- Text: Dark gray/black
- Accents: Brand blue (#1f6cb2)
- Shadows: Subtle, functional
- Borders: Rounded (8px-16px radius)

**Default Dark:**
- Background: Dark gray/slate surfaces
- Text: Light gray/white
- Accents: Lighter brand blue (#60a5fa)
- Shadows: Subtle with increased strength
- Borders: Same radius as light

### 4.3 Neumorphism Theme

Soft UI design with elements appearing extruded from or pressed into the surface.

**Design References:**
- Weather apps with soft, pillowy interfaces
- Dashboard SaaS products with depth
- Smart home control interfaces
- Task manager concepts

**Neumorphism Light:**

```css
.neu-light {
  --background: #e0e0e0;
  --background-gradient: linear-gradient(145deg, #e6e6e6, #ffffff);
  --shadow-light: #ffffff;
  --shadow-dark: #bebebe;
  --shadow-distance: 6px;
  --shadow-blur: 12px;
  --text-primary: #333333;
  --accent-primary: #6d28d9; /* Purple accent */
}

/* Raised element */
.neu-raised {
  background: linear-gradient(145deg, #e6e6e6, #ffffff);
  box-shadow: 
    6px 6px 12px #bebebe,
    -6px -6px 12px #ffffff;
  border-radius: 16px;
}

/* Pressed/Active element */
.neu-pressed {
  background: linear-gradient(145deg, #ffffff, #e6e6e6);
  box-shadow: 
    inset 6px 6px 12px #bebebe,
    inset -6px -6px 12px #ffffff;
}
```

**Neumorphism Dark:**

```css
.neu-dark {
  --background: #2d2d2d;
  --background-gradient: linear-gradient(145deg, #313131, #292929);
  --shadow-light: #383838;
  --shadow-dark: #222222;
  --shadow-distance: 6px;
  --shadow-blur: 12px;
  --text-primary: #e0e0e0;
  --accent-primary: #3b82f6; /* Blue accent */
}

/* Raised element */
.neu-raised {
  background: linear-gradient(145deg, #313131, #292929);
  box-shadow: 
    6px 6px 12px #222222,
    -6px -6px 12px #383838;
  border-radius: 16px;
}

/* Pressed/Active element */
.neu-pressed {
  background: linear-gradient(145deg, #292929, #313131);
  box-shadow: 
    inset 6px 6px 12px #222222,
    inset -6px -6px 12px #383838;
}
```

### 4.4 Retro Theme

Vintage gaming aesthetic inspired by classic gaming hardware and software.

**Design References:**
- Retro UI elements from Shutterstock collections
- Classic gaming console aesthetics
- Vintage computer interfaces
- 80s/90s software design

**Retro Light:**

```css
.retro-light {
  --background: #f5f0e6;           /* Warm cream/beige */
  --surface-1: #ebe5d8;            /* Slightly darker cream */
  --surface-2: #dfd9ca;            /* Card backgrounds */
  --text-primary: #3d2914;         /* Dark brown text */
  --text-secondary: #6b5344;       /* Medium brown */
  --accent-primary: #c41e3a;       /* Classic red */
  --accent-secondary: #1e5fa8;     /* Classic blue */
  --border-color: #a69580;         /* Tan border */
  --border-radius: 4px;            /* Sharper corners */
  --shadow: 3px 3px 0 #a69580;     /* Hard offset shadow */
  --font-family: 'Press Start 2P', 'Courier New', monospace;
}
```

**Retro Dark:**

```css
.retro-dark {
  --background: #1a1814;           /* Dark warm brown */
  --surface-1: #2d2620;            /* Slightly lighter */
  --surface-2: #3d342c;            /* Card backgrounds */
  --text-primary: #e8dcc8;         /* Cream text */
  --text-secondary: #b5a78f;       /* Muted cream */
  --accent-primary: #ff6b6b;       /* Bright coral red */
  --accent-secondary: #4dabf7;     /* Bright blue */
  --border-color: #5c4f3d;         /* Dark tan border */
  --border-radius: 4px;            /* Sharper corners */
  --shadow: 3px 3px 0 #0d0b09;     /* Hard dark shadow */
  --font-family: 'Press Start 2P', 'Courier New', monospace;
}
```

### 4.5 Terminal Theme (Retro Terminal)

A nostalgic green phosphor terminal aesthetic. **Single variant only - no light mode.**

**Design References:**
- Vintage CRT terminal displays
- Classic Linux/Unix CLI interfaces
- Green phosphor monitors
- 1980s computer terminals

```css
.terminal {
  --background: #0a0a0a;           /* Near-black */
  --surface-1: #0f0f0f;            /* Slightly lighter black */
  --surface-2: #141414;            /* Card backgrounds */
  --text-primary: #00ff00;         /* Bright green */
  --text-secondary: #00cc00;       /* Slightly dimmer green */
  --text-tertiary: #009900;        /* Dim green */
  --accent-primary: #00ff00;       /* Green */
  --accent-warning: #ffff00;       /* Yellow (caution) */
  --accent-error: #ff4444;         /* Red (error) */
  --border-color: #003300;         /* Dark green border */
  --border-radius: 0;              /* Sharp 90° corners */
  
  /* Phosphor glow effect */
  --glow-color: rgba(0, 255, 0, 0.3);
  --text-shadow: 0 0 5px var(--glow-color);
  
  /* Scanline overlay (optional) */
  --scanline-opacity: 0.1;
  
  /* Monospace font only */
  --font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  --font-size-base: 14px;
  --line-height: 1.5;
}

/* Terminal text glow */
.terminal-text {
  color: var(--text-primary);
  text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
}

/* Scanline overlay (CSS pseudo-element on body) */
.theme-terminal::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15),
    rgba(0, 0, 0, 0.15) 1px,
    transparent 1px,
    transparent 2px
  );
  opacity: var(--scanline-opacity);
  z-index: 9999;
}

/* CRT screen curvature (optional) */
.terminal-container {
  border-radius: 8px;
  box-shadow: 
    inset 0 0 60px rgba(0, 255, 0, 0.1),
    0 0 20px rgba(0, 255, 0, 0.2);
}
```

---

## 5. Custom Theme Support

### 5.1 Custom Theme Structure

Users can create custom themes by defining a theme configuration file:

```typescript
interface CustomTheme {
  // Metadata
  id: string;                 // Unique identifier (auto-prefixed with 'custom-')
  name: string;               // Display name
  author: string;             // Creator name
  version: string;            // Semantic version
  description?: string;       // Optional description
  
  // Theme type
  type: 'flat' | 'neumorphic' | 'retro' | 'custom';
  
  // Color mode support
  supportsDarkMode: boolean;
  
  // Color definitions
  colors: {
    light: ThemeColors;
    dark?: ThemeColors;       // Required if supportsDarkMode is true
  };
  
  // Typography
  typography: ThemeTypography;
  
  // Spacing and sizing
  spacing: ThemeSpacing;
  
  // Shadow definitions
  shadows: ThemeShadows;
  
  // Border definitions
  borders: ThemeBorders;
  
  // Optional CSS overrides (for advanced users)
  customCSS?: string;
  
  // Optional assets
  assets?: {
    backgroundImage?: string;   // Data URL or relative path
    overlayImage?: string;      // e.g., scanlines
    customFontUrl?: string;     // Google Fonts or local font URL
  };
}

interface ThemeColors {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgAccent: string;
  
  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  textInverse: string;
  textLink: string;
  
  // Accents
  accentPrimary: string;
  accentSecondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Borders
  border: string;
  borderHover: string;
  borderFocus: string;
  
  // Shadows (for neumorphic themes)
  shadowLight?: string;
  shadowDark?: string;
}

interface ThemeTypography {
  fontFamily: string;
  fontFamilyMono: string;
  fontWeightNormal: number;
  fontWeightMedium: number;
  fontWeightBold: number;
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
}

interface ThemeSpacing {
  unit: number;              // Base unit in pixels (default: 4)
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
}

interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  inner: string;
  // Neumorphic-specific
  raised?: string;
  pressed?: string;
}

interface ThemeBorders {
  width: {
    thin: string;
    normal: string;
    thick: string;
  };
  style: 'solid' | 'dashed' | 'dotted';
}
```

### 5.2 Theme Export/Import

**Export:**
- Themes exported as JSON files
- Include validation schema version
- Bundle any custom assets as data URLs

**Import:**
- Validate theme structure before import
- Check accessibility compliance
- Preview before applying
- Store in user data directory

```typescript
interface ThemeExport {
  schemaVersion: '1.0.0';
  exportDate: string;        // ISO date
  theme: CustomTheme;
}
```

### 5.3 Theme Validation

Before applying a custom theme, ROM Runner validates:

| Check | Requirement |
|-------|-------------|
| **Color Contrast** | Text/background must meet 4.5:1 ratio |
| **Required Colors** | All required color properties defined |
| **Font Availability** | Fonts load successfully or fallback available |
| **CSS Safety** | Custom CSS doesn't break layout |

Validation warnings displayed but don't block application.

---

## 6. Theme Switching UI

### 6.1 Theme Selection Location

Theme selection available in:

1. **Settings Screen** → Appearance section
2. **Quick Settings** (optional) → Toolbar dropdown
3. **System Tray Menu** (optional) → Right-click context

### 6.2 Theme Picker Component

```
┌──────────────────────────────────────────────────────────────┐
│ Appearance                                                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Theme                                                        │
│ ┌────────────────────────────────────────────────────────┐  │
│ │  ○ Default     ○ Neumorphism     ○ Retro     ○ Terminal│  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ Color Mode                               (Disabled for Terminal)
│ ┌────────────────────────────────────────────────────────┐  │
│ │  ○ Light     ○ Dark     ○ System                       │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ Custom Themes                                                │
│ ┌────────────────────────────────────────────────────────┐  │
│ │  [+ Import Theme]    [Manage Custom Themes]            │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ Preview                                                      │
│ ┌────────────────────────────────────────────────────────┐  │
│ │                                                        │  │
│ │     [Live preview of selected theme combination]       │  │
│ │                                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Theme Application

Theme changes apply immediately (no restart required):

```typescript
const applyTheme = (themeId: ThemeId, colorMode: ThemeMode) => {
  const root = document.documentElement;
  
  // Remove all theme classes
  root.classList.remove(
    'theme-default', 'theme-neumorphic', 'theme-retro', 'theme-terminal',
    'light', 'dark'
  );
  
  // Apply theme family class
  const family = themeId.split('-')[0];
  root.classList.add(`theme-${family}`);
  
  // Apply color mode (except for terminal)
  if (family !== 'terminal') {
    if (colorMode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      root.classList.add(colorMode);
    }
  }
  
  // For terminal theme, always dark
  if (family === 'terminal') {
    root.classList.add('dark');
  }
};
```

---

## 7. Accessibility Requirements

### 7.1 WCAG 2.1 AA Compliance

All themes (including custom) must meet these requirements:

| Requirement | Standard | Implementation |
|-------------|----------|----------------|
| **Text Contrast** | 4.5:1 normal, 3:1 large | All text colors validated |
| **Focus Indicators** | Visible focus ring | 2px ring on all interactive elements |
| **Color Independence** | Not sole indicator | Icons/text accompany color status |
| **Reduced Motion** | Respect OS setting | Honor `prefers-reduced-motion` |
| **Error Identification** | Clear error states | Red + icon + text message |

### 7.2 Theme Validation Warnings

Custom themes that fail accessibility checks show warnings:

```
⚠️ Accessibility Warning
─────────────────────────────────────────
The following issues were detected:

• Text contrast ratio for textSecondary on bgPrimary is 3.2:1 
  (minimum 4.5:1 required)
  
• Focus indicator color has insufficient contrast

Theme applied with warnings. Some users may have difficulty 
reading content.

[Apply Anyway]  [Edit Theme]  [Cancel]
```

---

## 8. TypeScript Interfaces

### 8.1 Theme Type Definitions

These types should be added to `types_v1_1_0.ts`:

```typescript
// ============================================================================
// THEME TYPES
// ============================================================================

/** Theme family identifier */
export type ThemeFamily = 'default' | 'neumorphic' | 'retro' | 'terminal';

/** Color mode preference */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Complete theme identifier */
export type ThemeId = 
  | 'default-light'
  | 'default-dark'
  | 'neumorphic-light'
  | 'neumorphic-dark'
  | 'retro-light'
  | 'retro-dark'
  | 'terminal'
  | `custom-${string}`;

/** Theme configuration for state management */
export interface ThemeConfig {
  /** Selected theme family */
  family: ThemeFamily;
  
  /** Color mode preference */
  mode: ThemeMode;
  
  /** Resolved theme ID (computed from family + mode) */
  resolvedId: ThemeId;
  
  /** If using custom theme, the custom theme ID */
  customThemeId?: string;
}

/** Built-in theme metadata */
export interface BuiltInTheme {
  id: ThemeId;
  family: ThemeFamily;
  name: string;
  description: string;
  supportsColorModes: boolean;
  previewColors: {
    background: string;
    accent: string;
    text: string;
  };
}

/** Custom theme definition (user-created) */
export interface CustomTheme {
  id: string;
  name: string;
  author: string;
  version: string;
  description?: string;
  type: 'flat' | 'neumorphic' | 'retro' | 'custom';
  supportsDarkMode: boolean;
  colors: {
    light: ThemeColors;
    dark?: ThemeColors;
  };
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  shadows: ThemeShadows;
  borders: ThemeBorders;
  customCSS?: string;
  assets?: ThemeAssets;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgAccent: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  textInverse: string;
  textLink: string;
  accentPrimary: string;
  accentSecondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  borderHover: string;
  borderFocus: string;
  shadowLight?: string;
  shadowDark?: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontFamilyMono: string;
  fontWeightNormal: number;
  fontWeightMedium: number;
  fontWeightBold: number;
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
}

export interface ThemeSpacing {
  unit: number;
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
}

export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  inner: string;
  raised?: string;
  pressed?: string;
}

export interface ThemeBorders {
  width: {
    thin: string;
    normal: string;
    thick: string;
  };
  style: 'solid' | 'dashed' | 'dotted';
}

export interface ThemeAssets {
  backgroundImage?: string;
  overlayImage?: string;
  customFontUrl?: string;
}

/** Theme export format */
export interface ThemeExport {
  schemaVersion: '1.0.0';
  exportDate: string;
  theme: CustomTheme;
}

/** Theme validation result */
export interface ThemeValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  accessibilityIssues: AccessibilityIssue[];
}

export interface AccessibilityIssue {
  type: 'contrast' | 'focus' | 'color-only';
  severity: 'error' | 'warning';
  message: string;
  property?: string;
  actualValue?: string;
  requiredValue?: string;
}
```

---

## 9. CSS Implementation

### 9.1 CSS Custom Properties Structure

All themes use CSS custom properties for easy switching:

```css
/* Base properties applied to :root */
:root {
  /* Brand colors (constant across themes) */
  --brand-blue: #1f6cb2;
  --brand-navy: #02375e;
  --brand-gray: #dbddda;
  
  /* Platform colors (constant across themes) */
  --platform-nintendo: #E60012;
  --platform-sony: #003791;
  --platform-sega: #0060A8;
  --platform-microsoft: #107C10;
  --platform-atari: #F7941D;
  
  /* Compatibility colors (constant across themes) */
  --compat-perfect: #10b981;
  --compat-playable: #22c55e;
  --compat-ingame: #f59e0b;
  --compat-menu: #f97316;
  --compat-boots: #ef4444;
  --compat-broken: #dc2626;
  --compat-unknown: #6b7280;
}

/* Theme-specific properties set by theme classes */
.theme-default.light {
  --surface-0: #ffffff;
  --surface-1: #f9fafb;
  /* ... */
}

.theme-neumorphic.light {
  --surface-0: #e0e0e0;
  --neu-shadow-light: #ffffff;
  --neu-shadow-dark: #bebebe;
  /* ... */
}

.theme-terminal {
  --surface-0: #0a0a0a;
  --text-primary: #00ff00;
  --glow-color: rgba(0, 255, 0, 0.3);
  /* ... */
}
```

### 9.2 Component Styling Pattern

Components use semantic variable names that resolve to theme values:

```css
.card {
  background: var(--surface-1);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}

/* Theme-specific overrides via specificity */
.theme-neumorphic .card {
  box-shadow: var(--neu-shadow-raised);
}

.theme-terminal .card {
  border-color: var(--border-color);
  box-shadow: 0 0 10px var(--glow-color);
}
```

---

## 10. Design Reference Links

### 10.1 Neumorphism References

These links provide visual inspiration for the neumorphism themes:

- https://dribbble.com/shots/15321987-Weather-App-Night-Beyond-Neumorphism
- https://dribbble.com/shots/22865016-Dashboard-Neumorphism-UI-for-SaaS-Product
- https://dribbble.com/shots/9834365-Neumorphism-UI-Elements
- https://dribbble.com/shots/9916835-Neumorphism-Smart-Home-app
- https://dribbble.com/shots/9684036-Task-Manager-Concept-Neumorphism
- https://dribbble.com/shots/11335888-NEUMORPHISM-TUTORIAL
- https://dribbble.com/shots/11202391-Fitness-neumorphism
- https://uiverse.io/elements?tags=neumorphism&page=1 (interactive components)

### 10.2 Retro Theme References

- https://www.shutterstock.com/search/retro-ui (general retro UI)
- https://megakrunch.com/products/retro-ui-elements

### 10.3 Terminal Theme References

- https://www.shutterstock.com/image-vector/vintage-retro-green-digital-vector-graphic-2689599835
- https://www.shutterstock.com/image-vector/linux-unix-terminal-cli-utility-program-2545028495
- https://megakrunch.com/products/retro-ui-elements

---

## Appendix A: Migration Notes

### A.1 Files Superseded by This Specification

| Old File | New File | Changes |
|----------|----------|---------|
| `types_v1_0_0.ts` | `types_v1_1_0.ts` | Added theme type definitions |
| `settingsStore_v1_0_0.ts` | `settingsStore_v1_1_0.ts` | Added theme management actions |
| `tokens.css` | `tokens_v1_1_0.css` | Added all theme CSS variables |

### A.2 Settings Store Updates

The settings store needs these additions:

```typescript
// In SettingsState
themeFamily: ThemeFamily;           // Selected theme family
themeMode: ThemeMode;               // Light/dark/system preference
customThemes: Map<string, CustomTheme>; // User's custom themes

// In SettingsActions
setThemeFamily: (family: ThemeFamily) => void;
setThemeMode: (mode: ThemeMode) => void;
importCustomTheme: (theme: CustomTheme) => Promise<void>;
exportCustomTheme: (themeId: string) => Promise<ThemeExport>;
deleteCustomTheme: (themeId: string) => Promise<void>;
validateTheme: (theme: CustomTheme) => ThemeValidationResult;
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-07 | Initial theme system specification |
