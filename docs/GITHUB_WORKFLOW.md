# GitHub Workflow (main + develop)

This project uses one GitHub repository with two long-lived branches.

## Branches

- `main`: production-ready branch
- `develop`: integration branch for daily development

## Day-to-day flow

1. Pull latest `develop`.
2. Create feature branch from `develop`.
3. Push branch and open PR to `develop`.
4. Team reviews and tests.
5. Merge to `develop`.
6. When ready to release, open PR from `develop` to `main`.

## First-time setup (local repo to GitHub)

From repo root:

```powershell
git init
git add .
git commit -m "chore: initial repository setup"
git branch -M main
git remote add origin https://github.com/dtopra/Event-Tayyib.git
git push -u origin main
git checkout -b develop
git push -u origin develop
```

If `origin` already exists:

```powershell
git remote set-url origin https://github.com/dtopra/Event-Tayyib.git
```

## Feature branch example

```powershell
git checkout develop
git pull
git checkout -b feature/floorplan-drawer-improvements
```

After changes:

```powershell
git add .
git commit -m "feat: improve floor plan drawer behavior"
git push -u origin feature/floorplan-drawer-improvements
```

Then open PR:
- base: `develop`
- compare: `feature/floorplan-drawer-improvements`

## Release PR

When `develop` is verified, open PR:
- base: `main`
- compare: `develop`
