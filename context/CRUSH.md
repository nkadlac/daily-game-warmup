# Daily Game Picker - Development Guide

## Build/Test Commands
```bash
# Install dependencies (update when project is initialized)
npm install

# Development server
npm run dev

# Build for production
npm run build

# Run all tests
npm test

# Run single test file
npm test -- path/to/test.spec.js

# Lint code
npm run lint

# Type checking
npm run typecheck
```

## Code Style Guidelines

### General
- Use TypeScript for type safety
- Prefer functional components and hooks
- Use meaningful, descriptive variable names
- Keep functions small and focused

### Imports
- Group imports: external libraries first, then internal modules
- Use absolute imports when possible
- Sort imports alphabetically within groups

### Naming Conventions
- Components: PascalCase (GamePicker.tsx)
- Files/folders: kebab-case (game-picker/)
- Variables/functions: camelCase (selectedGame)
- Constants: UPPER_SNAKE_CASE (MAX_GAMES)

### Error Handling
- Use try/catch for async operations
- Provide meaningful error messages
- Log errors appropriately for debugging