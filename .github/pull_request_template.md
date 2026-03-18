## Summary

- What does this PR change and why?

## Type of Change

<!-- Compact mode: keep only selected (checked) items in this section when authoring PR body. -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] CI/CD pipeline change
- [ ] Infrastructure as Code (Bicep/Terraform/ARM) change
- [ ] Script/automation change
- [ ] Documentation update
- [ ] Refactor (no functional change)
- [ ] Test improvement

## Related Issues

<!-- Compact mode: keep only if relevant content is available -->

- Fixes #
- Relates to #

## Key changes

<!-- What changed at a high level. Keep this quick-scan friendly. -->

-

## Risk/impact

<!-- Scope, expected impact, and any notable risks. -->

- Risk level: <!-- Low / Medium / High -->
- Runtime/service code changed: <!-- Yes / No -->
- Potential impact:

## Validation

<!-- What you checked before opening this PR (tests, pipeline validation, manual checks). -->

## Testing

- Commands run: <!-- all of these should remain visible; checked or not -->
  - [ ] `pnpm lint`
  - [ ] `pnpm type-check`
  - [ ] `pnpm test:coverage` (≥ 80% coverage)
  - [ ] `pnpm build`
  - [ ] `pnpm test:e2e` (if applicable)

-

## Checklist

<!-- Compact mode: keep only checked items in final PR body; keep this section heading. -->

- [ ] PR is small, focused, and reviewable (aim for < ~400 lines changed; split if larger) <!-- always show and validate -->
- [ ] TypeScript strict mode passes (no implicit `any`, no unused vars, etc.) <!-- only show when Typescript files are included in the PR -->
- [ ] SOLID/DI respected: <!-- only show if PR includes class or interface definitions -->
  - [ ] New services are behind interfaces (e.g., `src/interfaces/I*.ts`)
  - [ ] Implementations are registered in the DI container when applicable
- [ ] Feature flags: <!-- only show when feature flags are part of the PR -->
  - [ ] New/incomplete features are behind a flag
  - [ ] Any new flags are added to `.env.example` (default `false`)
- [ ] Accessibility considered (WCAG 2.2 AA): keyboard access, labels/ARIA, focus states
- [ ] Documentation updated if needed (README/docs)
- [ ] No secrets / tokens / personal data included <!-- always show and validate -->
- [ ] Backward compatibility considered <!-- always show and validate -->
- [ ] Validation steps completed <!-- always show and validate -->
- [ ] Ready for review <!-- always show and validate -->
