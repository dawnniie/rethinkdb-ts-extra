import { attachConfigurations, configure } from './index.js'

interface SillyPost {
  id: string
  name: string
  forum_id: string
  from_user_id: string
  to_user_id: string
  tags: string[]
  likes: number
}

const tableConfig = {
  test: configure<SillyPost>('rdb-ts-extra-test', 'data')({
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
}

const { r, upgrade } = attachConfigurations(tableConfig)

await r.connectPool()
await upgrade({ db: 'rdb-ts-extra-test' })

await r.test.getAll('test', { index: 'forum_id' }).run()
await r.test.getAll('tag', { index: 'tags' }).run()
await r.test.between(['test', r.minval], ['test', r.maxval], { index: 'forum_search' }).orderBy({ index: 'forum_search' }).run()
await r.test.getAll('test', { index: 'user_id' }).run()
await r.test.between(['test', r.minval], ['test', r.maxval], { index: 'user_search' }).orderBy({ index: 'user_search' }).run()
await r.test.between(10, r.maxval, { index: 'quality' }).orderBy({ index: 'quality' }).run()
await r.test.getAll(['test', 'hello'], { index: 'identifier' }).run()

await r.getPoolMaster()?.drain()
