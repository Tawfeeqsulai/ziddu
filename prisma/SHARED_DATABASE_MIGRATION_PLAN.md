# Shared database alignment plan

This plan is intentionally non-executable. No migration, `db push`, reset, drop, truncate, or data update should run until this plan is reviewed and approved.

## Current compatibility layer

- `schema.shared.prisma` models the existing `users`, `vendors`, `posts`, `menu_categories`, `menu_sub_categories`, `menu_items`, `offers`, and `bills` tables using the verified `INT` primary and foreign-key types.
- `lib/db/shared-prisma.ts` provides a separate Prisma client for those existing tables.
- Discovery reads shared `posts` and `vendors` without assuming missing legacy display fields. Missing title, description, location, rating, likes, and saves use application-level display fallbacks.
- The original feature/auth schema remains backed up and unchanged for later migration work.

## Required additive migration

1. Preserve the existing shared tables and records.
2. Add authentication tables required by Better Auth, or agree on a reviewed adapter that uses the existing `users` table without changing its required columns.
3. Add feature tables for follows, likes, saves, phone OTPs, and affiliate records using `INT` foreign keys to shared `users`, `vendors`, `posts`, and `bills`.
4. Add any missing indexes and foreign keys only after checking existing data for orphaned references.
5. Decide how the application should represent missing vendor location, post title, post description, and interaction data before adding columns or separate tables.
6. Create an explicit data mapping for old application IDs to shared integer IDs; never cast existing string IDs in place.
7. Review the migration SQL and take a backup before applying it.

## Validation required before approval

- `prisma validate` for both schemas.
- Prisma client generation with the development server stopped so Windows can replace the query-engine DLL.
- Type checking, linting, and application tests.
- Read-only checks for orphaned foreign keys and duplicate business records.
- Review of every query that still uses the legacy `shop`, `post`, `product`, `user`, or `location` models.
