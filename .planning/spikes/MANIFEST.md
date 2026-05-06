# Spike Manifest

## Idea

Pre-Phase-17 native-wrapper choice. Couch is a PWA today (`couchtonight.app`). For App Store + Google Play submission, the codebase needs to be wrapped natively. Two routes lead this category in 2025-2026: **Capacitor** (Ionic — full hybrid-app framework with native plugin access, requires JS bundler) and **PWABuilder** (Microsoft — thin wrapper around an existing PWA, no bundler required). CLAUDE.md says "Don't introduce a bundler or build step" — that constraint shapes the answer.

This spike batch produces a decision matrix + recommendation feeding Phase 17 planning.

## Spikes

| # | Name | Validates | Verdict | Tags |
|---|------|-----------|---------|------|
| 001 | capacitor-vs-pwabuilder | Decision matrix across 13 dimensions; recommend one route for Couch v1 launch | VALIDATED ✓ | research, native-wrapper, phase-17-prep, app-store, pwa |
