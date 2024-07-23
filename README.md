# rethinkdb-ts-extra

This package is an extension of `rethinkdb-ts` and functions as an almost drop-in replacement. Everything from `rethinkdb-ts` is re-exported (except `r` itself).

The overall purpose of this package is to configure strictly typed data structures (and secondary indexes) for every table in your database. This provides numerous advantages and makes it (generally) safer to work with your data. It also corrects some small inconsistencies/bugs in the original typings for `rethinkdb-ts`.

## Installation & Usage

```sh
# Install from npm (or pnpm, bun, yarn, etc)
npm i rethinkdb-ts-extra
```

If you're using `rethinkdb-ts` or another package already, you can safely remove that from your dependencies.

From here, check out the wiki and [Getting Started](https://github.com/dawnniie/rethinkdb-ts-extra/wiki/Getting-Started) page for more detailed documentation, examples, and explanations.

## Example

```ts
import { extra, table } from 'rethinkdb-ts-extra'

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

const r = await extra({
  // describe database layout/structure/data types/indexes/etc
  my_database: {
    users: table<User>()({ /* indexes would go here, but we have none for users */ }),
    posts: table<Post>()({
      author_id: {}, // simple index
      tags: { multi: true }, // multi index
      /* (a 'url' index like this is a bit silly but it's just to demonstrate custom expression indexes) */
      url: { custom: function (post) { return r.add('/', post('author_id'), '/', post('id')) } }
    })
  }
}, {
  // immediately connect
  url: process.env.RETHINKDB_URL, // connection URLs
  db: 'my_database' // default db
}, {
  // automatically 'sync' the database to match the configurations
  dropUnknownIndexes: true,
  log: 'verbose'
})

// export to use everywhere else in the project
export const { r }

// and then...
const posts = await r.table('posts').getAll('ben', { index: 'author_id' }).run()
console.log(posts) // Post[]
```

## Project Status

You (probably) shouldn't find any functionality issues in this project, since it's all pretty straight forward. You may find typing issues.

I built this internally for a private project and have pulled it out to open source. Everything works fine within the scope of my project, but I don't do everything with RethinkDB and it's definitely possible that you could encounter something weird with typings that I haven't, in which case please make an issue!
