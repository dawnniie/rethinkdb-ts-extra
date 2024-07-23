import { connect } from './connect.js'
import { sync } from './sync.js'
import { r as _r } from 'rethinkdb-ts'
import type { ConnectOptions } from './connect.js';
import type { ExtraTableConfigIndexBase } from './indexes.js'
import type { SyncOptions } from './sync.js'
import type { ExtraTableConfig, ExtraTableConfigTypeBase, RDatabaseExtraConfigs, RExtra } from './types.js'
import type { R } from 'rethinkdb-ts'

export { isCursor, isRethinkDBError } from 'rethinkdb-ts'
export type * from 'rethinkdb-ts/lib/types.js'

/**
 * Describe configuration for a table in a database.
 * 
 * Use the generic `T` to pass the type of data contained in the table. It must have an `id` property with a valid primary key type.
 * 
 * No need to pass any arguments, `_options` is a future placeholder - this will return another function for configuring indexes, so immediately invoke that like so:
 * 
 * ```ts
 * table<YourDataType>()({ ... })
 * ```
 */
export function table<T extends ExtraTableConfigTypeBase>(_options?: unknown) {
  /**
   * Describe the indexes in this table. If you have no indexes, just pass `{}`.
   * 
   * Otherwise, pass a map of index name to config object, like so:
   * ```ts
   * simple: {}, // (on 'simple' field)
   * multi: { multi: true }, // (on 'multi' field)
   * compound: { compound: ['last_name', 'first_name'] }, // named 'compound'
   * custom: { custom: function (row) { return row('hobbies').add(row('sports')) } } // named 'custom'
   * ```
   * 
   * For more info, refer to the wiki page on [Secondary Indexes](https://github.com/dawnniie/rethinkdb-ts-extra/wiki/Secondary-Indexes).
   */
  return <const I extends ExtraTableConfigIndexBase<T>>(indexes: I) => {
    const configuration: ExtraTableConfig<T, I> = { type: null as unknown as T, indexes }
    return configuration
  }
}

/**
 * Initialise `rethinkdb-ts-extra` and attach types to the `r` object before returning it.
 * 
 * Please refer to [the wiki (Getting Started)](https://github.com/dawnniie/rethinkdb-ts-extra/wiki/Getting-Started) for guidance on how to use this function, as it goes into more detail for the various options.
 * 
 * The first option should always be your db & table configurations, which is a two-layer object mapping table names to the `table` function, like so:
 * ```ts
 * extra({
 *   db_name: {
 *     table_name: table<...>()({ ... }),
 *     ...
 *   },
 *   ...
 * })
 * ```
 */
async function extra<const Configs extends RDatabaseExtraConfigs, const DefaultDB extends string = 'test'>(configs: Configs): Promise<RExtra<Configs, DefaultDB>>
async function extra<const Configs extends RDatabaseExtraConfigs, const DefaultDB extends string = 'test'>(configs: Configs, defaultDb: DefaultDB): Promise<RExtra<Configs, DefaultDB>>
async function extra<const Configs extends RDatabaseExtraConfigs, const DefaultDB extends string = 'test'>(configs: Configs, connect: true | ConnectOptions<DefaultDB>, sync?: SyncOptions): Promise<RExtra<Configs, DefaultDB>>
async function extra<const Configs extends RDatabaseExtraConfigs, const DefaultDB extends string = 'test'>(configs: Configs, defaultDbOrConnect?: DefaultDB | true | ConnectOptions<DefaultDB>, syncOptions?: true | SyncOptions) {
  // @ts-expect-error this override is allowed, as long as we keep it typed correctly
  const r = _r as RExtra<Configs, DefaultDB>

  r.extra = {
    connect: async (options?: ConnectOptions<DefaultDB>) => await connect(r, options),
    sync: async (options?: SyncOptions) => await sync(r as unknown as R, configs, options)
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
      if (!connections?.length) setTimeout(() => { checkConnections(); }, 10 * 1000)
    }

    setTimeout(() => { checkConnections(); }, 10 * 1000)
  }

  return r
}

export { extra }
