import extra, { table } from './future.js'
import type { SillyPost } from './test.js'

const tableConfig = {
  my_database: {
    posts: table<SillyPost>()({
      forum_id: {},
      tags: { multi: true },
      // compound index allowing to order posts in a 'forum' by like count
      forum_search: { compound: ['forum_id', 'likes'] },
      // custom multi index allowing two fields to be used in one index, in this case to retrieve from either user's perspective
      user_id: { custom: row => [row('from_user_id'), row('to_user_id')], multi: true },
      // custom multi compound index allowing multiple compound indexes to be assigned, effectively a combination of the above two indexes
      user_search: { custom: row => [[row('from_user_id'), row('likes')], [row('to_user_id'), row('likes')]] as const, multi: true },
      // custom index, in this case a kind of 'quality' based on the number of tags and likes
      quality: { custom: row => row('tags').count().mul(3).add(row('likes').count()) },
      // custom compound index, when a compound index needs to be more complex
      identifier: { custom: row => [row('forum_id'), row('name').downcase()] as const }
    })
  },
  my_database_2: {
    plain_table: table<{ id: number }>()({})
  }
}

const r = await extra(
  tableConfig,
  { url: 'rethinkdb://localhost:28015', db: 'my_database' },
  { memory: { db: 'my_database', table: 'sync', id: 'sync' }, log: 'actions' }
)

// @ts-expect-error
await r.$('posts').insert({ id: '_', forum_id: '_', from_user_id: '_', to_user_id: '_', likes: 1, tags: [], name: undefined }).run()
await r.$('posts').update({ name: 'test' }).run()
await r.$('posts').update({ name: undefined }).run()
console.log(await r.$('posts').run())
await r.$('posts').update({ name: r.literal() }).run()
console.log(await r.$('posts').run())

await r.$('posts').getAll('test', 'another test').run()
await r.$('posts').getAll('test', { index: 'forum_id' }).run()
await r.$('posts').getAll('tag', { index: 'tags' }).run()
await r.$('posts').getAll('tag', 'another tag', { index: 'tags' }).run()
await r.$('posts').between(['test', r.minval], ['test', r.maxval], { index: 'forum_search' }).orderBy({ index: 'forum_search' }).run()
await r.$('posts').getAll('test', { index: 'user_id' }).run()
await r.$('posts').between(['test', r.minval], ['test', r.maxval], { index: 'user_search' }).orderBy({ index: 'user_search' }).run()
await r.$('posts').between(10, r.maxval, { index: 'quality' }).orderBy({ index: 'quality' }).run()
await r.$('posts').getAll(['test', 'hello'], { index: 'identifier' }).run()
await r.$('posts').update(prev => ({ name: 'new', tags: prev('tags').add('hello') })).run()
await r.$('posts').update<SillyPost & { old_likes: number }>(prev => ({ likes: prev('old_likes'), old_likes: r.literal() })).run()
await r.table('posts').get('test').run()
await r.db('my_database_2').table('plain_table').get(12).run()
await r.$('my_database_2', 'plain_table').get(12).run()
await r.$('posts').delete().run()

await r.getPoolMaster()?.drain()

