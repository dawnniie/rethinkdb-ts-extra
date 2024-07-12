export { isCursor, isRethinkDBError } from 'rethinkdb-ts'
export type * from 'rethinkdb-ts/lib/types.js'

import { createSyncer } from './sync.js'
import { r as _r } from 'rethinkdb-ts'
import type { ExtraTableConfigIndexBase } from './indexes.js'
import type { SyncOptions } from './sync.js'
import type { ExtraTableConfig, ExtraTableConfigTypeBase, RDatabaseExtraConfigs, RExtra, RConnectionOptionsExtra } from './types.js'
import type { R } from 'rethinkdb-ts'

export function table<T extends ExtraTableConfigTypeBase> (_options?: {}): (<const I extends ExtraTableConfigIndexBase<T>> (indexes: I) => ExtraTableConfig<T, I>) {
  return <const I extends ExtraTableConfigIndexBase<T>> (indexes: I): ExtraTableConfig<T, I> => {
    return { db: '_', table: '_', type: null as unknown as T, indexes }
  }
}

async function extra<const Configs extends RDatabaseExtraConfigs, const DefaultDB extends string = 'test'>(configs: Configs): Promise<RExtra<Configs, DefaultDB>>
async function extra<const Configs extends RDatabaseExtraConfigs, const DefaultDB extends string = 'test'>(configs: Configs, defaultDb: DefaultDB): Promise<RExtra<Configs, DefaultDB>>
async function extra<const Configs extends RDatabaseExtraConfigs, const DefaultDB extends string = 'test'>(configs: Configs, autoConnect: true | RConnectionOptionsExtra<DefaultDB>, autoSync?: SyncOptions): Promise<RExtra<Configs, DefaultDB>>
async function extra<const Configs extends RDatabaseExtraConfigs, const DefaultDB extends string = 'test'>(configs: Configs, someOptions?: DefaultDB | true | RConnectionOptionsExtra<DefaultDB>, autoSync?: true | SyncOptions) {
  // @ts-expect-error this override is allowed, as long as we keep it typed correctly
  const r = _r as RExtra<Configs, DefaultDB>
  
  r.empty = () => r.literal() as unknown as undefined

  const oldConfigs: { [name: string]: ExtraTableConfig<any, ExtraTableConfigIndexBase<any>> } = {}
  for (const d in configs) for (const t in configs[d]) oldConfigs[`${d}.${t}`] = { ...configs[d][t]!, db: d, table: t }
  r.structureSync = createSyncer(r as unknown as R, oldConfigs)

  // @ts-expect-error type otherwise defined
  r.$ = (dbName: string, tableName?: string) => tableName ? r.db(dbName).table(tableName) : r.table(dbName)
  
  if (someOptions) {
    if (typeof someOptions !== 'string') {
      // we should connect for the user, based on the options they have passed or some sensible defaults
      const { url = undefined, host = undefined, port = undefined, server = null, servers = undefined, ...options } = (someOptions === true ? {} : someOptions) as RConnectionOptionsExtra<DefaultDB>
      const truthy = [url, host && port, server, servers].map(v => Boolean(v))
      if (truthy.filter(value => value).length > 1) throw new Error('connection options: only one of url, host & port, server, or servers may be specified')
      
      if (url) {
        if (!url.startsWith('rethinkdb://') && !url.startsWith('//')) throw new Error('connection options: invalid url scheme')
        const noScheme = url.startsWith('r') ? url.replace('rethinkdb://', '') : url.replace('//', '')
        const [auth, location] = noScheme.includes('@') ? noScheme.split('@') as [string, string] : [undefined, noScheme]
        let [user, password] = auth?.split(':') ?? [undefined, undefined]
        const host = (!location || location.startsWith(':') || location.startsWith('/')) ? undefined : location.split('/')[0]!.split(':')[0]!
        const port = location.split('/')[0]!.includes(':') ? Number(location.split(':')[1]!.split('/')[0]!) : undefined
        if (port !== undefined && isNaN(port)) throw new Error('connection options: invalid url port')
        let db = location.split('/')[1] || undefined

        if (user && options.user) throw new Error('connection options: user specified twice (url & options)')
        if (!user) user = options.user || 'admin'
        if (password && options.password) throw new Error('connection options: password specified twice (url & options)')
        if (!password) password = options.password || ''
        if (db && db !== 'test' && db !== options.db) console.warn('warn: when including a connection db in your url, your typings may be incorrect unless you set the db option too')
        if (!db) db = options.db || 'test'

        await r.connectPool({ host: host ?? 'localhost', port: port ?? 28015, ...options, user, password, db })
      } else if (host || port) {
        await r.connectPool({ host: host ?? 'localhost', port: port ?? 28015, ...options })
      } else if (server) {
        await r.connectPool({ servers: [server], ...options })
      } else if (servers) {
        await r.connectPool({ servers, ...options })
      } else {
        await r.connectPool({ host: 'localhost', port: 28015, ...options })
      }
      
      if (autoSync) await r.structureSync(autoSync === true ? {} : autoSync)
    }
  } else {
    // the user is managing connecting themselves
    // we should do some level of enforcing/notification for inconsistent default db settings, in case they mess it up
    const defaultDb = someOptions || 'test'
    function checkConnections() {
      const connections = r.getPoolMaster()?.getPools().map(p => p.getConnections()).flat()
      // @ts-expect-error allow us to reach in to this private property: https://github.com/rethinkdb/rethinkdb-ts/blob/main/src/connection/connection.ts#L44
      if (connections?.find(c => c.db !== defaultDb)) console.warn('warning: default db option set, but connections detected with different option - this will cause unexpected behaviour when using queries that assume a default database')
      // keep trying until we actually find a connection to check
      if (!connections?.length) setTimeout(() => checkConnections(), 10 * 1000)
    }

    setTimeout(() => checkConnections(), 10 * 1000)
  }

  return r
}

export default extra
