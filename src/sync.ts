import { createHash } from 'crypto'
import type { ExtraTableConfigIndexBase } from './indexes.js'
import type { RDatabaseExtraConfigs } from './types.js'
import type { R } from 'rethinkdb-ts'

export interface SyncOptions {
  memory?: {
    db: string,
    table: string,
    /** ID of a row inside the specified db & table, to store the previous sync hash. */
    id: string,
    /** Define a custom hash generator from a configuration object. The default generator does a SHA1 hex digest of the JSON.stringified configs. */
    hashGenerator?: (configs: unknown) => string,
    /** Define a custom comparison function for hashes, returning true if they are equal. */
    hashComparison?: (oldHash: string, newHash: string) => boolean
  },
  /** Whether to drop any databases we encounter that don't appear in the config. */
  dropUnknownDatabases?: boolean,
  /** Whether to drop any tables we encounter that don't appear in the config (only in known config databases). */
  dropUnknownTables?: boolean,
  /** Whether to drop any indexes we encounter that don't appear in the config (only in known config tables). */
  dropUnknownIndexes?: boolean,
  /** Logging level */
  log?: 'actions' | 'verbose' | false
}

interface SyncAction { entity: 'database' | 'table' | 'index', action: 'create' | 'drop', name: string }
export interface SyncReturnType { skipped: boolean, actions: SyncAction[] }

function diff<T> (previous: T[], current: T[]): { added: T[], removed: T[] } {
  const result = { added: [] as T[], removed: [] as T[] }
  for (const p of previous) if (!current.includes(p)) result.removed.push(p)
  for (const c of current) if (!previous.includes(c)) result.added.push(c)
  return result
}

export async function sync(r: R, configs: RDatabaseExtraConfigs, options: SyncOptions = {}): Promise<SyncReturnType> {
  const actions: SyncAction[] = []

  const databases = await r.dbList().run()
  const databasesInConfig = Object.keys(configs)

  let oldHash: string | null = null
  let newHash: string | null = null
  if (options.memory) {
    if (options.log === 'verbose') console.log('db sync: memory option enabled, initiating hash comparison.')
    const { db: mdb, table: mtable, id: mid } = options.memory

    if (!databases.includes(mdb)) {
      await r.dbCreate(mdb).run()
      if (databasesInConfig.includes(mdb)) actions.push({ entity: 'database', action: 'create', name: mdb })
    }
    const tables = await r.db(mdb).tableList().run()
    if (!tables.includes(mtable)) await r.db(mdb).tableCreate(mtable).run()
    const data = await r.db(mdb).table(mtable).get(mid).run() as unknown

    oldHash = typeof data === 'object' && (data !== null) && 'h' in data && typeof data.h === 'string' ? data.h : null
    if (options.log === 'verbose') console.log('db sync: previous sync hash:', oldHash)
    newHash = options.memory.hashGenerator ? options.memory.hashGenerator(configs) : createHash('sha1').update(JSON.stringify(configs)).digest('hex')
    if (options.log === 'verbose') console.log('db sync: new sync hash:', newHash)
    const alreadySynced = oldHash && (options.memory.hashComparison ? options.memory.hashComparison(oldHash, newHash) : oldHash === newHash)
    if (alreadySynced) {
      if (options.log === 'verbose') console.log('db sync: hashes equal, sync skipped.')
      return { skipped: true, actions }
    } else {
      if (options.log === 'verbose') console.log('db sync: inconsistent hashes, continuing...')
    }
  }

  if (options.log === 'verbose') console.log('db sync: running...')

  const databasesDiff = diff(databases.filter(db => db !== options.memory?.db), databasesInConfig.filter(db => db !== options.memory?.db))

  for (const database of databasesDiff.added) {
    actions.push({ entity: 'database', action: 'create', name: database })
    await r.dbCreate(database).run()
  }

  if (options.dropUnknownDatabases === true) {
    for (const database of databasesDiff.removed) {
      if (database === 'rethinkdb') continue
      actions.push({ entity: 'database', action: 'drop', name: database })
      await r.dbDrop(database).run()
    }
  }

  for (const database of databasesInConfig) {
    if (options.log === 'verbose') console.log(`db sync: syncing database ${database}...`)

    const tables = await r.db(database).tableList().run()
    const tablesInConfig = Object.keys(configs[database] as Record<string, unknown>)
    const tablesDiff = diff(tables.filter(table => table !== options.memory?.table), tablesInConfig)

    for (const table of tablesDiff.added) {
      actions.push({ entity: 'table', action: 'create', name: `${database}.${table}` })
      await r.db(database).tableCreate(table).run()
    }

    if (options.dropUnknownTables === true) {
      for (const table of tablesDiff.removed) {
        actions.push({ entity: 'table', action: 'drop', name: `${database}.${table}` })
        await r.db(database).tableDrop(table).run()
      }
    }

    for (const table of tablesInConfig) {
      const tableConfig = configs[database]?.[table]
      if (!tableConfig) continue

      const indexes = await r.db(database).table(table).indexList().run()
      const indexesInConfig = Object.keys(tableConfig.indexes as Record<string, unknown>)
      const indexesDiff = diff(indexes, indexesInConfig)

      for (const index of indexesDiff.added) {
        actions.push({ entity: 'index', action: 'create', name: `${database}.${table}:${index}` })

        const indexConfig = tableConfig.indexes[index] as ExtraTableConfigIndexBase<any>[string]
        if (!indexConfig) continue
        const multi = 'multi' in indexConfig ? indexConfig.multi : false

        if ('custom' in indexConfig) await r.db(database).table(table).indexCreate(index, indexConfig.custom, { multi }).run()
        else if ('compound' in indexConfig) await r.db(database).table(table).indexCreate(index, indexConfig.compound.map(f => r.row(f as string))).run()
        else await r.db(database).table(table).indexCreate(index, { multi }).run()

        await r.db(database).table(table).indexWait(index).run()
      }

      if (options.dropUnknownIndexes === true) {
        for (const index of indexesDiff.removed) {
          actions.push({ entity: 'index', action: 'drop', name: `${database}.${table}:${index}` })
          await r.db(database).table(table).indexDrop(index).run()
        }
      }
    }
  }

  if (options.log === 'verbose') console.log('db sync: sync complete.')

  if (options.memory && newHash) {
    const { db: mdb, table: mtable, id: mid } = options.memory

    if (oldHash === null) await r.db(mdb).table(mtable).insert({ id: mid, h: newHash }).run()
    else await r.db(mdb).table(mtable).get(mid).update({ h: newHash }).run()
    if (options.log === 'verbose') console.log('db sync: memory option enabled, new hash saved.')
  }

  if (actions.length && options.log) {
    console.log(`--- db sync complete, performed ${actions.length} actions ---`)
    for (const action of actions) console.log(`- ${action.action.toUpperCase()} ${action.entity} ${action.name}`)
  }

  return { skipped: false, actions }
}
