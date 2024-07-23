import type { ConnectOptions } from './connect.js'
import type { ExtraTableConfigIndexBase, PrimaryIndex, QueryForIndex } from './indexes.js'
import type { SyncOptions, SyncReturnType } from './sync.js'
import type { DeepPartial, DeepValue, DeepValuePartial, DistOmit, Empty, PushEmpty, RMinMaxVal } from './util.js'
import type { FieldSelector, InsertOptions, MasterPool, R, RDatabase, RDatum, RSelection, RSingleSelection, RStream, RTable, RValue, UpdateOptions, WriteResult } from 'rethinkdb-ts'

/** see: https://github.com/rethinkdb/rethinkdb/issues/2884#issuecomment-65291774 */
type AllowedPrimaryKeyTypes = string | number | boolean
export interface ExtraTableConfigTypeBase { id: AllowedPrimaryKeyTypes | AllowedPrimaryKeyTypes[] }

export interface ExtraTableConfig<T extends ExtraTableConfigTypeBase, I extends ExtraTableConfigIndexBase<T>> {
  type: T,
  indexes: I
}

export type RStreamExtra<Config extends ExtraTableConfig<any, any>, T> = Omit<RStream<T>, 'orderBy'> & {
  <A extends keyof T>(attribute: RValue<A>): RStreamExtra<Config, T[A]>,
  (n: RValue<number>): RDatum<T>,
  
  orderBy(...fieldOrIndex: Array<FieldSelector<T> | { index: keyof Config['indexes'] | (string & {}) }>): RStreamExtra<Config, T>
}

export type RSingleSelectionExtra<_Config extends ExtraTableConfig<any, any>, T, TN = Exclude<T, null>> = Omit<RSingleSelection<T>, 'update' | 'replace'> & {
  <A extends keyof T>(attribute: RValue<A>): RDatum<T[A]>,
  
  update<Previous = TN>(obj: RValue<DeepPartial<PushEmpty<TN>>> & { [K in Exclude<keyof Previous, keyof TN>]: Empty }, options?: UpdateOptions): RDatum<WriteResult<T>>,
  update<Previous = TN>(
    updater: (previous: RDatum<Previous>) => DeepValuePartial<PushEmpty<TN>> & { [K in Exclude<keyof Previous, keyof TN>]: Empty },
    options?: UpdateOptions
  ): RDatum<WriteResult<T>>,

  replace(obj: RValue<TN>, options?: UpdateOptions): RDatum<WriteResult<T>>,
  replace<Previous = TN>(replacer: (previous: RDatum<Previous>) => RValue<DeepValue<TN>>, options?: UpdateOptions): RDatum<WriteResult<T>>
}

export type RSelectionExtra<Config extends ExtraTableConfig<any, any>, T> = Omit<RSelection<T>, 'update' | 'replace' | 'orderBy'> & {
  <A extends keyof T>(attribute: RValue<A>): RStreamExtra<Config, T[A]>,
  (n: RValue<number>): RDatum<T>,
  
  update<Previous = T>(obj: RValue<DeepPartial<PushEmpty<T>>> & { [K in Exclude<keyof Previous, keyof T>]: Empty }, options?: UpdateOptions): RDatum<WriteResult<T>>,
  update<Previous = T>(
    updater: (previous: RDatum<Previous>) => DeepValuePartial<PushEmpty<T>> & { [K in Exclude<keyof Previous, keyof T>]: Empty },
    options?: UpdateOptions
  ): RDatum<WriteResult<T>>,

  replace(obj: RValue<T>, options?: UpdateOptions): RDatum<WriteResult<T>>,
  replace<Previous = T>(replacer: (previous: RDatum<Previous>) => RValue<DeepValue<T>>, options?: UpdateOptions): RDatum<WriteResult<T>>,

  orderBy(...fieldOrIndex: Array<FieldSelector<T> | { index: keyof Config['indexes'] | (string & {}) }>): RSelectionExtra<Config, T>
}

export type RTableExtra<Config extends ExtraTableConfig<any, any>> = Omit<RTable<Config['type']>, 'get' | 'getAll' | 'between' | 'insert' | 'update' | 'replace' | 'orderBy'> & {
  <A extends keyof Config['type']>(attribute: RValue<A>): RStreamExtra<Config, Config['type'][A]>,
  (n: RValue<number>): RDatum<Config['type']>,
  
  get(key: Config['type']['id'] | RDatum<Config['type']['id']>): RSingleSelectionExtra<Config, Config['type'] | null>,

  getAll<I extends (keyof Config['indexes'] | PrimaryIndex) = PrimaryIndex>(
    ...args: Array<QueryForIndex<Config, I>> | [
      ...Array<QueryForIndex<Config, I>>,
      { index: I }
    ]
  ): RSelectionExtra<Config, Config['type']>,

  between<I extends (keyof Config['indexes'] | PrimaryIndex) = PrimaryIndex>(
    lowKey: QueryForIndex<Config, I, RMinMaxVal>,
    highKey: QueryForIndex<Config, I, RMinMaxVal>,
    options?: { index?: I, leftBound?: 'open' | 'closed', rightBound?: 'open' | 'closed' }
  ): RSelectionExtra<Config, Config['type']>,

  insert(
    obj: RValue<Config['type'] |
      DistOmit<Config['type'], 'id'>> |
      RValue<Array<Config['type'] | DistOmit<Config['type'], 'id'>>>,
    options?: InsertOptions
  ): RDatum<WriteResult<Config['type']>>,

  update<Previous = Config['type']>(obj: RValue<DeepPartial<PushEmpty<Config['type']>>> & { [K in Exclude<keyof Previous, keyof Config['type']>]: Empty }, options?: UpdateOptions): RDatum<WriteResult<Config['type']>>,
  update<Previous = Config['type']>(
    updater: (previous: RDatum<Previous>) => DeepValuePartial<PushEmpty<Config['type']>> & { [K in Exclude<keyof Previous, keyof Config['type']>]: Empty },
    options?: UpdateOptions
  ): RDatum<WriteResult<Config['type']>>,

  replace(obj: RValue<Config['type']>, options?: UpdateOptions): RDatum<WriteResult<Config['type']>>,
  replace<Previous = Config['type']>(replacer: (previous: RDatum<Previous>) => RValue<DeepValue<Config['type']>>, options?: UpdateOptions): RDatum<WriteResult<Config['type']>>,

  orderBy(...fieldOrIndex: Array<FieldSelector<Config['type']> | { index: keyof Config['indexes'] | (string & {}) }>): RTableExtra<Config>
}

export type RDatabaseExtraConfigs = Record<string, Record<string, ExtraTableConfig<any, any>>>

export type RDatabaseExtra<Configs extends RDatabaseExtraConfigs, Database extends keyof Configs> = Omit<RDatabase, 'db' | 'table'> & {
  table<T extends keyof Configs[Database] | (string & {})>(tableName: T): T extends keyof Configs[Database] ? RTableExtra<Configs[Database][T]> : RTable
}

export type RExtra<Configs extends RDatabaseExtraConfigs, DefaultDB extends string> = Omit<R, 'asc' | 'desc' | 'literal' | 'minval' | 'maxval' | 'db' | 'table'> & {
  asc<T>(index: T): T,
  desc<T>(index: T): T,
  literal(): Empty,
  literal<T>(obj: T): RDatum<T>,
  minval: RMinMaxVal,
  maxval: RMinMaxVal,

  db<D extends keyof Configs | (string & {})>(dbName: D): D extends keyof Configs ? RDatabaseExtra<Configs, D> : RDatabase,
  table<T extends (DefaultDB extends keyof Configs ? keyof Configs[DefaultDB] : never) | (string & {})>(tableName: T):
    DefaultDB extends keyof Configs ? T extends keyof Configs[DefaultDB] ? RTableExtra<Configs[DefaultDB][T]> : RTable : RTable,

  extra: {
    /**
     * Initialise a RethinkDB connection. Uses `r.connectPool` internally with almost the same options, but some extra validation.
     * 
     * Also accepts a 'url' option, which is a PostgresQL-like connection url to locate the server.
     */
    connect(options?: ConnectOptions<DefaultDB>): Promise<MasterPool>,
    /**
     * Synchronises the connected database to match your database configuration, creating dbs, tables, and indexes where necessary.
     */
    sync(options?: SyncOptions): Promise<SyncReturnType>
  },

  /**
   * Shorthand syntax for selecting a table instead of `r.db('...').table('...')`.
   */
  $<T extends (DefaultDB extends keyof Configs ? keyof Configs[DefaultDB] : string)>(tableName: T): DefaultDB extends keyof Configs ? RTableExtra<Configs[DefaultDB][T]> : RTable,
  $<D extends keyof Configs, T extends keyof Configs[D]>(dbName: D, tableName: T): RTableExtra<Configs[D][T]>,

  [Symbol.asyncDispose](): Promise<void>
}
