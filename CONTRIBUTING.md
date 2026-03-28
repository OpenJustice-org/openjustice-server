# Contributing to OpenJustice

Thank you for your interest in contributing to OpenJustice. Every contribution, whether it is a bug report, documentation improvement, or new feature, helps strengthen this project. We appreciate your time and effort.

## Getting Started

### Prerequisites

Ensure you have the following installed:

- Node.js 18+
- PostgreSQL 15+
- Redis

### Fork and Clone

1. Fork the repository at [github.com/openjustice/openjustice](https://github.com/openjustice/openjustice).
2. Clone your fork locally:

```bash
git clone https://github.com/<your-username>/openjustice.git
cd openjustice
```

### Backend Setup (NestJS + Prisma + PostgreSQL)

```bash
cd server
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run start:dev
```

Update the `.env` file with your local PostgreSQL and Redis connection details before starting the server.

### Frontend Setup (Next.js + React + Tailwind CSS + shadcn/ui)

```bash
cd client
npm install
cp .env.example .env.local
npm run dev
```

Update `.env.local` to point to your running backend instance.

## Development Workflow

1. Create a feature branch from `main` using one of the following prefixes:
   - `feat/` -- new features
   - `fix/` -- bug fixes
   - `docs/` -- documentation changes

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes, following existing code patterns and project conventions.

3. Before committing, verify your changes pass all checks:

   ```bash
   npm run lint
   npm test
   npm run build
   ```

4. Push your branch and submit a pull request against `main`.

## Commit Conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must use one of the following types:

- **feat** -- a new feature
- **fix** -- a bug fix
- **docs** -- documentation changes
- **refactor** -- code changes that neither fix a bug nor add a feature
- **test** -- adding or updating tests
- **chore** -- maintenance tasks (dependencies, CI, tooling)

Format:

```
<type>(<optional scope>): <description>
```

Examples:

```
feat(auth): add role-based access control
fix(api): correct pagination offset calculation
docs: update setup instructions in README
```

## Pull Request Guidelines

- Keep PRs focused on a single concern. Aim for under 500 lines of changes.
- Fill out the pull request template completely.
- Ensure all CI checks pass before requesting review.
- Link any related issues in the PR description.
- Be responsive to review feedback.

## Code of Conduct

All contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

## Questions

If you have questions or need help:

- Open a [GitHub Discussion](https://github.com/openjustice/openjustice/discussions) for general questions and ideas.
- Open a [GitHub Issue](https://github.com/openjustice/openjustice/issues) for bug reports and specific feature requests.
