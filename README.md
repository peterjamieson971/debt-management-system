# Debt Management System

A comprehensive debt management system built with Node.js and Turbo monorepo architecture.

## Project Structure

```
debt-management-system/
├── apps/          # Applications (web, mobile, etc.)
├── packages/      # Shared packages/libraries
├── turbo.json     # Turbo configuration
└── package.json   # Root package.json
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

- **Start development servers**: `npm run dev`
- **Build all packages**: `npm run build`
- **Run tests**: `npm run test`
- **Lint code**: `npm run lint`
- **Type check**: `npm run type-check`

### Turbo Commands

This project uses [Turbo](https://turbo.build/) for efficient monorepo management:

- `turbo build` - Build all apps and packages
- `turbo dev` - Start all development servers
- `turbo lint` - Lint all packages
- `turbo test` - Run all tests
- `turbo clean` - Clean all build artifacts

## Architecture

This monorepo is structured to support:

- **Multiple applications** (web dashboard, mobile app, API services)
- **Shared packages** (utilities, components, types, configuration)
- **Efficient builds** with Turbo's caching and parallelization
- **Consistent tooling** across all packages

## Contributing

1. Follow the established coding standards
2. Write tests for new features
3. Ensure all linting and type checking passes
4. Update documentation as needed

## License

ISC