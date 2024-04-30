# rethinkdb-ts-extra

This package is an extension of `rethinkdb-ts` and functions as a drop-in replacement.

Everything from `rethinkdb-ts` is re-exported, along with some extra functions to help implement stricter end-to-end type safety.

The general idea is to configure precisely typed data (and secondary index) structures for every table in your database.

## Installation

Install from NPM (or pnpm, bun yarn, etc).

```sh
npm i rethinkdb-ts-extra
```

You can directly replace all `rethinkdb-ts` imports with `rethinkdb-ts-extra`. This won't change any behaviour, allowing you to migrate gradually.

## Usage

See the Example below for a more hands-on example of how you might use this.

#### configure

Constructs an object that is used in `attachConfigurations`, and does so with some nice intellisence autocomplete.

```ts
syntax: <Type extends { id: string }>(db: string, table: string)(indexes: Record<string, Index>) => ExtraTableConfig
```

It needs to be a chained function so that the user can specify a `Type` generic, but the generic that produces a `const` type for `indexes` internally can still be inferred.

The different types of secondary indexes that can be configured are as follows:

```ts
simple: {} // (on 'simple' field)
multi: { multi: true } // (on 'multi' field)
compound: { compound: ['last_name', 'first_name'] }
custom: { custom: function (row) { return row('hobbies').add(row('sports')) } }
```

The `multi` index here is really just a simple index with the multi index option. Any simple or custom index can be set to be a multi index as long as the value in question is an array. A 'multi compound' index can also be constructed, but needs to be done with a custom expression. Read more about rethinkdb [secondary indexes here](https://rethinkdb.com/docs/secondary-indexes/javascript).

When constructing a compound or multi compound index based on a custom expression, you will likely need to append `as const` after the array so that we can correctly infer the individual fields. See `src/test.ts` for some meaningless examples of more complex custom expression indexes.

#### attachConfigurations

Attaches provided table configurations (and other utilies) to the `r` object with detailed extra data and index typings. Also provides an `upgrade` function for in-place database structure updates (sort of like automated migrations).

```ts
syntax: (configs: Record<string, ExtraTableConfig>)
```

Each table config is attached to `r` with its name (the key in the object), so that the table can be accessed by shorthand like so:

```ts
const { r } = attachConfigurations({ myTableName: configure<{ id: string }>('mydb', 'mytable')({}) })

// instead of
r.db('mydb').table('mytable') // -> RTable<any>
// you can do
r.myTableName // -> RTableExtra<{ id: string , ...>
```

The type `RTableExtra` is an extension of `RTable`. While `RTable` already supports providing types, this must be done manually with each call. The shorthand pre-populates this type information, as well as extra information for secondary indexes. Some key `RTable` methods (currently `get`, `getAll`, `between` and `insert`) are re-typed in `RTableExtra` to take advantage of this extra type information. When you run an operation with an index, the configuration for that index and the table data will be used to typecheck the data you are passing.

Even though these shorthands are attached in-place to the `r` object exported by `rethinkdb-ts`, you likely want to export and reference the `r` object where it is returned by `attachConfigurations`, because this is the only way to get the correct typings.

If you're using custom indexes, you may find that having the `configure` calls in the arguments for the `attachConfigurations` call breaks the inference of the custom expression argument type. I can't figure out how to fix this yet, and my only solution has been to move the configure call away and pass the output in. If you have any ideas for this, please let me know.

**upgrade**

In the object returned by `attachConfigurations`, these is also an `upgrade` function. You can call this every time your code runs to sha1 hash the configurations and compare this to the previous hash (stored in the database itself). If the hashes don't match, the database structure will be automatically updated to what your configuration specifies (creating databases, tables, and indexes). Nothing is dropped by default unless you specify so.

If no previous hash exists, it will be treated as a mismatch and everything in the configuration will be created in the database as necessary (where it doesn't already exist).

#### r.empty()

**Note: `r.empty` is only available on `r` after `attachConfigurations` is run.**

Instead of using `r.literal()` (with no arguments) to clear data, use `r.empty()`. It functions exactly the same, but `r.literal()` is typed as `RDatum<any>` which will likely cause an error against your typed database structure. `r.empty()` is typed to return undefined which will play nicely.

## Example

```ts
import { attachConfigurations, configure } from 'rethinkdb-ts-extra'

// definitions
interface User {
  id: string
  username: string
}

interface Post {
  id: string,
  author_id: string,
  tags: string[]
}

/* etc... you would define interfaces/types for everything in your database,
  which I put in other files */

const { r, upgrade } = attachConfigurations({
  users: configure<User>('mydb', 'users')({ /* indexes would go here, but none for users */ }),
  posts: configure<Post>('mydb', 'posts')({
    author_id: {}, // simple index
    tags: { multi: true }, // multi index
    /* (a 'url' index like this is a bit silly but it's just to demonstrate arbitrary expression indexes) */
    url: { custom: function (post) { return r.add('/', post('author_id'), '/', post('id')) } }
  }),

})

// check for any changes in structure since we last ran, running updates to bring the database into sync if necessary
// put this in 'mydb' instead of the default (which is 'upgrade')
await upgrade({ db: 'mydb', dropUnknownIndexes: true })

// export to use everywhere else in the project
export const { r }
```

## Project Status

You (probably) shouldn't find any functionality issues in this project, since it's all pretty straight forward. You may find typing issues though.

I built this internally for a private project and have pulled it out to open source. Everything works fine within the scope of my project, but I don't do everything with RethinkDB and it's definitely possible that you might encounter something weird with typings that I haven't, in which case I'd appreciate a bug report or contribution.
