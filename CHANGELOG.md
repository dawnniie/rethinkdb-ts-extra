# Changelog

## 0.3.1

- Updated `tsconfig.json` to emit declaration files, and reference these in `package.json`.

## 0.3.0 - The future is now!

The in-dev future implementation of rethinkdb-ts-extra, previously available at `rethinkdb-ts-extra/future`, is now default.

- Everything from `rethinkdb-ts-extra/future`: see previous versions and wiki for details.
- Removed all code from the old version and cleaned up where possible.
- Added some more internal documentation.
- Fixed eslint configuration to actually apply the rule presets (with some sanity changes).

## 0.2.8

- Actually updated `r.minval` and `r.maxval` types (oops, forgot).
- Reverted requirement of one value for `getAll` (broke spread parameter inputs).

## 0.2.7

- Added distinct type for `r.minval` and `r.maxval` so they are always allowed in `between`.
- Fixed the typing for `getAll` to require at least one value and to only allow `{ index: ... }` as the last argument.
- Updated `orderBy` to autocomplete but not error if an unknown index is passed.

#### `rethinkdb-ts-extra/future`

- Updated `extra` export to be non-default for consistency.
- Updated `db` and `table` to autocomplete but not error if unknown values are passed.

## 0.2.6

- Made slight adjustments to DeepValue and DeDatumToValue, hopefully fixing some bugs.
- Moved util types to dedicated file.

## 0.2.5

- Updated index value inputs (`between`, `getAll`) to allow deep/nested RValues.
- Removed `null` union from `update` & `replace` methods on single selections (from `.get`).

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
