---
name: ecos-studio-dev-guardrails
description: Enforce collaboration guardrails when working in /home/luyoung/ecos-studio. Use when implementing, debugging, or reviewing changes in this repo. Require the user to execute all build/start/package commands personally, keep development on branch ecc-fe, and block commit/merge/push/rebase/reset/tag operations unless explicit user permission is granted in the current conversation.
---

# Ecos Studio Dev Guardrails

## Overview

Apply strict workflow constraints for ECOS Studio collaboration so build execution and git history control remain with the user.

## Rule 1: Let User Run Build Commands

- Do not execute build/start/package commands in this repo.
- Provide the exact command for the user to run, then wait for output.
- Treat the following as user-run only:
  - `make setup`, `make dev`, `make build`, `make gui`, `make demo-*`
  - `bazel build ...`, `bazel run ...`
  - `pnpm tauri dev`, `pnpm tauri build`, `pnpm build`
  - Any other command whose primary purpose is compile, bundle, package, or launch the app

## Rule 2: Stay on Branch `ecc-fe`

- Check the current branch before non-trivial edits or git write operations:
  - `git rev-parse --abbrev-ref HEAD`
- Continue only when branch is `ecc-fe`.
- If not on `ecc-fe`, stop and ask the user to switch; do not switch branches autonomously unless explicitly asked.

## Rule 3: Require Explicit Permission for Git History Actions

- Never run the following unless the user explicitly authorizes them in the current conversation:
  - `git commit`
  - `git push`
  - `git merge`
  - `git rebase`
  - `git cherry-pick`
  - `git tag`
  - `git reset` (any mode)
  - `git clean`
- Default behavior: edit files only, show proposed git commands, and let the user execute history-changing actions.
