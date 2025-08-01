# Daily Game Picker - Design System

## Visual Identity
**Theme**: Clean, friendly, and game-focused with a modern feel that appeals to puzzle enthusiasts.

## Color Palette
### Primary Colors
- **Primary Blue**: `#2563eb` (for CTAs and primary actions)
- **Primary Dark**: `#1e40af` (hover states)
- **Success Green**: `#10b981` (completed games, positive feedback)

### Secondary Colors
- **Word Games**: `#8b5cf6` (purple theme)
- **Logic Games**: `#f59e0b` (amber theme)  
- **Math Games**: `#ef4444` (red theme)

### Neutral Colors
- **Background**: `#f8fafc` (light gray)
- **Card Background**: `#ffffff`
- **Text Primary**: `#1f2937`
- **Text Secondary**: `#6b7280`
- **Border**: `#e5e7eb`

## Typography
### Primary Font
- **Family**: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### Headings
- **H1**: 2.5rem (40px), font-weight: 700
- **H2**: 2rem (32px), font-weight: 600  
- **H3**: 1.5rem (24px), font-weight: 600
- **H4**: 1.25rem (20px), font-weight: 500

### Body Text
- **Large**: 1.125rem (18px)
- **Regular**: 1rem (16px)
- **Small**: 0.875rem (14px)

## Layout & Spacing
### Container
- **Max Width**: 1200px
- **Padding**: 1rem mobile, 2rem desktop

### Spacing Scale
- **xs**: 0.25rem (4px)
- **sm**: 0.5rem (8px)
- **md**: 1rem (16px)
- **lg**: 1.5rem (24px)
- **xl**: 2rem (32px)
- **2xl**: 3rem (48px)

## Components
### Game Cards
- **Background**: White with subtle shadow
- **Border Radius**: 0.75rem (12px)
- **Padding**: 1.5rem (24px)
- **Shadow**: `0 1px 3px rgba(0, 0, 0, 0.1)`
- **Hover**: Lift effect with increased shadow

### Buttons
#### Primary Button
- **Background**: Primary Blue
- **Text**: White
- **Padding**: 0.75rem 1.5rem
- **Border Radius**: 0.5rem (8px)
- **Font Weight**: 500

#### Secondary Button  
- **Background**: Transparent
- **Border**: 1px solid border color
- **Text**: Primary text color
- **Same padding and radius as primary**

### Preference Tags
- **Background**: Category color (20% opacity)
- **Text**: Category color (full opacity)
- **Padding**: 0.5rem 1rem
- **Border Radius**: 9999px (pill shape)
- **Font Size**: 0.875rem

## Responsive Design
### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px  
- **Desktop**: > 1024px

### Grid System
- **Mobile**: Single column
- **Tablet**: 2 columns for game cards
- **Desktop**: 3-4 columns for game cards

## Interactions
### Hover States
- **Cards**: Subtle lift and shadow increase
- **Buttons**: Darken background color
- **Links**: Underline and color change

### Focus States
- **All interactive elements**: 2px solid focus ring in primary color
- **Offset**: 2px from element

## Icons
- **Style**: Outline style icons (Heroicons or similar)
- **Size**: 1.5rem (24px) for standard, 1rem (16px) for small
- **Color**: Inherit from parent or text-secondary

## Animation
- **Duration**: 200ms for micro-interactions
- **Easing**: `ease-in-out`
- **Properties**: transform, opacity, box-shadow, background-color
