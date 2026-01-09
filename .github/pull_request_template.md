## Description

- What does this PR change and why?

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactor (no functional change)
- [ ] Test improvement

## Related Issues

- Fixes #
- Relates to #

## Testing

- Commands run:
  - [ ] `pnpm lint`
  - [ ] `pnpm type-check`
  - [ ] `pnpm test:coverage` (≥ 80% coverage)
  - [ ] `pnpm build`
  - [ ] `pnpm test:e2e` (if applicable)

## Screenshots / Video (UI Changes)

- N/A

## Checklist (from CONTRIBUTING.md)

- [ ] PR is small, focused, and reviewable (aim for < ~400 lines changed; split if larger)
- [ ] TypeScript strict mode passes (no implicit `any`, no unused vars, etc.)
- [ ] Added/updated tests for changes; coverage remains ≥ 80%
- [ ] CI-required checks pass locally (`lint`, `type-check`, `test:coverage`, `build`)
- [ ] SOLID/DI respected:
  - [ ] New services are behind interfaces (e.g., `src/interfaces/I*.ts`)
  - [ ] Implementations are registered in the DI container when applicable
- [ ] Feature flags:
  - [ ] New/incomplete features are behind a flag
  - [ ] Any new flags are added to `.env.example` (default `false`)
- [ ] Accessibility considered (WCAG 2.2 AA): keyboard access, labels/ARIA, focus states
- [ ] Documentation updated if needed (README/docs)
- [ ] No secrets / tokens / personal data included
