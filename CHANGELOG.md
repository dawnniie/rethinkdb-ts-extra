# Changelog

## 0.2.0

- Fixed restrictions of primary key types and ensured primary key types are reflected in `get`, `getAll`, etc.
- Improved typings for some functions, including `getAll` with various spread parameter & index usages.
- More deeper replacements of `R` types, allowing for updated typings in functions like `update` and `orderBy`.
- Named 'upgrade' system to 'sync', to be more in line with what it actually does.
- Rearranged sync options, by default always performing syncing and optionally specifying all of db, table & id to save sync hashes.
- Better distribution of code across files.
- Dependency updates (inc. linter move from ts-standard to eslint-config-love).

#### `rethinkdb-ts-extra/future`

New experimental implementation of `rethinkdb-ts-extra` with a completely different but cleaner DX. WIP.

- Native support/autocomplete for `.db()` and `.table()` functions.
- New `r.$(db?, table)` selector to replace shorthand syntax.
- Based on main `extra` export, returning `Promise<R>`, with auto-connect & auto-sync options.
- No more re-export of `r` getting mixed up in your autocomplete!
- More planned.

## 0.1.1

- Improved index support & typings for custom generated multi, compound and multi-compound indexes.
- Fixed a bug where using the same database for both data and the upgrade could attempt to create it twice.

## 0.1.0

Initial version.