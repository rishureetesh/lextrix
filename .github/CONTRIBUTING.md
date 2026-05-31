# Contributing to Lextron

Thank you for your interest in Lextron. This project is an independent rich text editor.

## How to help

- Report [bugs](https://github.com/rishureetesh/lextron/issues) with reproduction steps
- Improve [documentation](./docs/README.md)
- Submit focused pull requests with tests

## Development setup

```bash
git clone https://github.com/rishureetesh/lextron.git
cd lextron
npm install
npm run build
npm run dev          # demo at http://localhost:5173
npm test             # unit + change tests
```

See [.github/DEVELOPMENT.md](./.github/DEVELOPMENT.md) for package layout and testing details.

## Pull request guidelines

1. Branch from `main`
2. Run `npm run lint`, `npm run typecheck`, and `npm test`
3. Keep PRs focused — one feature or fix per PR
4. Add or update tests when behavior changes
5. Update docs when public API or configuration changes

By submitting a pull request you agree to license your contribution under the
[MIT License](./LICENSE).
