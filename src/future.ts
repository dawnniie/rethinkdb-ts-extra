export { isCursor, isRethinkDBError } from 'rethinkdb-ts'
export type * from 'rethinkdb-ts/lib/types.js'

import { connect } from './connect.js'
import { sync } from './sync.js'
import { r as _r } from 'rethinkdb-ts'
import type { ConnectOptions } from './connect.js';
import type { ExtraTableConfigIndexBase } from './indexes.js'
import type { SyncOptions } from './sync.js'
import type { ExtraTableConfig, ExtraTableConfigTypeBase, RDatabaseExtraConfigs, RExtra } from './types.js'
import type { R } from 'rethinkdb-ts'

export function table<T extends ExtraTableConfigTypeBase>(_options?: {}) {
  return <const I extends ExtraTableConfigIndexBase<T>>(indexes: I) => {
    return { db: '_', table: '_', type: null as unknown as T, indexes } as ExtraTableConfig<T, I>
  }
}

async function extra<const Configs extends RDatabaseExtraConfigs, const DefaultDB extends string = 'test'>(configs: Configs): Promise<RExtra<Configs, DefaultDB>>
async function extra<const Configs extends RDatabaseExtraConfigs, const DefaultDB extends string = 'test'>(configs: Configs, defaultDb: DefaultDB): Promise<RExtra<Configs, DefaultDB>>
async function extra<const Configs extends RDatabaseExtraConfigs, const DefaultDB extends string = 'test'>(configs: Configs, connect: true | ConnectOptions<DefaultDB>, sync?: SyncOptions): Promise<RExtra<Configs, DefaultDB>>
async function extra<const Configs extends RDatabaseExtraConfigs, const DefaultDB extends string = 'test'>(configs: Configs, defaultDbOrConnect?: DefaultDB | true | ConnectOptions<DefaultDB>, syncOptions?: true | SyncOptions) {
  // @ts-expect-error this override is allowed, as long as we keep it typed correctly
  const r = _r as RExtra<Configs, DefaultDB>

  const oldConfigs: { [name: string]: ExtraTableConfig<any, ExtraTableConfigIndexBase<any>> } = {}
  for (const [dbName, tables] of Object.entries(configs)) {
    for (const [tableName, data] of Object.entries(tables)) {
      oldConfigs[`${dbName}.${tableName}`] = { ...data, db: dbName, table: tableName }
    }
  }

  r.extra = {
    connect: (options?: ConnectOptions<DefaultDB>) => connect(r, options),
    sync: (options?: SyncOptions) => sync(r as unknown as R, oldConfigs, options)
  }

  // @ts-expect-error type otherwise defined
  r.$ = (dbName: string, tableName?: string) => tableName ? r.db(dbName).table(tableName) : r.table(dbName)

  r[Symbol.asyncDispose] = async () => await r.getPoolMaster()?.drain()
  
  if (defaultDbOrConnect && typeof defaultDbOrConnect !== 'string') {
    // we should connect for the user
    await r.extra.connect(defaultDbOrConnect === true ? {} : defaultDbOrConnect)
    if (syncOptions) await r.extra.sync(syncOptions === true ? {} : syncOptions)
  } else {
    // the user is managing connecting themselves
    // we should do some level of enforcing/notification for inconsistent default db settings, in case they mess it up
    const defaultDb = defaultDbOrConnect || 'test'
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
