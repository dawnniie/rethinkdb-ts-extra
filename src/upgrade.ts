import { createHash } from 'crypto'
import { R, ExtraTableConfig, ExtraTableConfigIndexBase } from './index.js'

export interface UpgradeOptions {
  /** Database to use for storing upgrade data @default 'upgrade' */
  db?: string
  /** Table to use for storing upgrade data @default 'upgrade' */
  table?: string
  /** ID of row inside upgrade table to use for storing the previous upgrade hash @default 'hash' */
  id?: string
  /** Define a custom hash generator from a configuration object. The default generator does a SHA1 hex digest of the JSON.stringified configs. */
  customHashGenerator?: (configs: unknown) => string
  /** Define a custom comparison function for hashes, returning true if they are equal - I don't know why you would need this, but why not! */
  customHashComparison?: (oldHash: string, newHash: string) => boolean
  /** Whether to drop any databases we encounter that don't appear in the config. */
  dropUnknownDatabases?: boolean
  /** Whether to drop any tables we encounter that don't appear in the config under known databases. */
  dropUnknownTables?: boolean
  /** Whether to drop any indexes we encounter that don't appear in the config under known tables. */
  dropUnknownIndexes?: boolean
}

interface UpgradeAction { entity: 'database' | 'table' | 'index', action: 'create' | 'drop', name: string }
interface UpgradeReturnType { skipped: boolean, actions: UpgradeAction[] }

function diff<T> (previous: T[], current: T[]): { added: T[], removed: T[] } {
  const result = { added: [] as T[], removed: [] as T[] }
  for (const p of previous) if (!current.includes(p)) result.removed.push(p)
  for (const c of current) if (!previous.includes(c)) result.added.push(c)
  return result
}

export function createUpgrader (r: R, configs: { [name: string]: ExtraTableConfig<any, ExtraTableConfigIndexBase<any>> }) {
  return async (options: UpgradeOptions): Promise<UpgradeReturnType> => {
    const actions: UpgradeAction[] = []

    const upgradeDb = options.db ?? 'upgrade'
    const upgradeTable = options.table ?? 'upgrade'
    const upgradeId = options.id ?? 'hash'

    const databases = await r.dbList().run()
    if (!databases.includes(upgradeDb)) await r.dbCreate(upgradeDb).run()
    const utables = await r.db(upgradeDb).tableList().run()
    if (!utables.includes(upgradeTable)) await r.db(upgradeDb).tableCreate(upgradeTable).run()
    const data = await r.db(upgradeDb).table(upgradeTable).get(upgradeId).run() as unknown

    const oldHash = typeof data === 'object' && (data != null) && 'h' in data && typeof data.h === 'string' ? data.h : null
    const newHash = (options.customHashGenerator != null) ? options.customHashGenerator(configs) : createHash('sha1').update(JSON.stringify(configs)).digest('hex')
    const needsUpgrade = oldHash === null || !((options.customHashComparison != null) ? options.customHashComparison(oldHash, newHash) : oldHash === newHash)
    if (!needsUpgrade) return { skipped: true, actions }

    const databasesInConfig = [...new Set(Object.values(configs).map(config => config.db))]
    const databasesDiff = diff(databases.filter(db => db !== upgradeDb), databasesInConfig)

    for (const database of databasesDiff.added) {
      actions.push({ entity: 'database', action: 'create', name: database })
      await r.dbCreate(database).run()
    }

    if (options.dropUnknownDatabases === true) {
      for (const database of databasesDiff.removed) {
        actions.push({ entity: 'database', action: 'drop', name: database })
        await r.dbDrop(database).run()
      }
    }

    for (const database of databasesInConfig) {
      const tables = await r.db(database).tableList().run()
      const tablesInConfig = Object.values(configs).filter(c => c.db === database).map(c => c.table)
      const tablesDiff = diff(tables.filter(table => table !== upgradeTable), tablesInConfig)

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
        const tableConfig = Object.values(configs).find(c => c.db === database && c.table === table)
        if (tableConfig === undefined) continue

        const indexes = await r.db(database).table(table).indexList().run()
        const indexesInConfig = Object.keys(tableConfig.indexes)
        const indexesDiff = diff(indexes, indexesInConfig)

        for (const index of indexesDiff.added) {
          actions.push({ entity: 'index', action: 'create', name: `${database}.${table}:${index}` })

          const indexConfig = tableConfig.indexes[index]
          if (indexConfig === undefined) continue
          const multi = 'multi' in indexConfig ? indexConfig.multi : false

          if ('custom' in indexConfig) await r.db(database).table(table).indexCreate(index, indexConfig.custom, { multi }).run()
          else if ('compound' in indexConfig) await r.db(database).table(table).indexCreate(index, indexConfig.compound.map((f: string) => r.row(f))).run()
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

    if (oldHash === null) await r.db(upgradeDb).table(upgradeTable).insert({ id: upgradeId, h: newHash }).run()
    else await r.db(upgradeDb).table(upgradeTable).get(upgradeId).update({ h: newHash }).run()

    return { skipped: false, actions }
  }
}
