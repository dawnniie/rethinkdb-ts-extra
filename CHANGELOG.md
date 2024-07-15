# Changelog

## 0.2.4

Quick fix for build.

## 0.2.3

- Fixed `orderBy` return type when used on `RTableExtra` and `RSelectionExtra`.
- Further added `Previous` generic to non-replacement-function (just object literal) `update` method.
- Fixed (hopefully) some nested array/datum typing issues.

#### `rethinkdb-ts-extra/future`

- Added support for TS 5.2 'using' (ERM): `await using r = extra(...)`.
- Added an 'escape' back to regular `rethinkdb-ts` when specifying an unknown database in `r.db`.

## 0.2.2

- Added `Previous` generic to `update` and `replace` methods, allowing for a different 'previous' type in mapping functions, and enforcing removal of old properties.
- Updated `r.empty()` to return a new `Empty` type.
- Improved consistency of optional behaviours in `update`: by first unioning `Empty` to all optional properties, and then making all properties both optional and undefined-able.
- Updated `sync` to allow calling with no options object at all.

#### `rethinkdb-ts-extra/future`

- Renamed `r.structureSync` to `r.extra.sync` (less pollution of the top level).
- Added `r.extra.connect`, accepting the same custom options as the connect parameter in `extra()`.
- Removed `r.empty()` in favour of adjusting the type for `r.literal()` (to return `Empty` too).
- Moved custom connection options/logic to dedicated file.
- Fixed a bug where defaultDb would not be validated when the user was manually connecting.

## 0.2.1

- Re-introduced lost call signatures for some types.
- Cleaned up (and made more consistent) `Config` and `T` generics for `R_Extra` type replacements.

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
