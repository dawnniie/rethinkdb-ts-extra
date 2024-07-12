import type { ExtraTableConfigIndexBase, PrimaryIndex, QueryForIndex } from './indexes.js'
import type { SyncOptions, SyncReturnType } from './sync.js'
import type { FieldSelector, InsertOptions, R, RBaseConnectionOptions, RDatabase, RDatum, RSelection, RServerConnectionOptions, RSingleSelection, RStream, RTable, RValue, UpdateOptions, WriteResult } from 'rethinkdb-ts'

type DistOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never
type DeepValue<T> = T | { [P in keyof T]: RValue<T[P]> | DeepValue<T[P]> }
type DeepPartial<T> = T | { [P in keyof T]?: T[P] extends Array<infer U1> ? Array<DeepPartial<U1>> : T[P] extends ReadonlyArray<infer U2> ? ReadonlyArray<DeepPartial<U2>> : DeepPartial<T[P]> }

/** see: https://github.com/rethinkdb/rethinkdb/issues/2884#issuecomment-65291774 */
type AllowedPrimaryKeyTypes = string | number | boolean
export interface ExtraTableConfigTypeBase { id: AllowedPrimaryKeyTypes | AllowedPrimaryKeyTypes[] }

export interface ExtraTableConfig<T extends ExtraTableConfigTypeBase, I extends ExtraTableConfigIndexBase<T>> {
  db: string,
  table: string,
  type: T,
  indexes: I
}

type BaseOptionsKeys = 'user' | 'password' | 'discovery' | 'pool' | 'buffer' | 'max' | 'timeout' | 'pingInterval' | 'timeoutError' | 'timeoutGb' | 'maxExponent' | 'silent' | 'log'
export type RConnectionOptionsExtra<DefaultDB extends string> = Pick<RBaseConnectionOptions, BaseOptionsKeys> & {
  /**
   * default database to use when unspecified
   * @default 'test'
   */
  db?: DefaultDB,
  /**
   * postgresql-like connection url to locate the server
   * 
   * `[rethinkdb:]//[user[:password]@][host][:port][/db]`
   * 
   * note: only one of url, host & port, server, or servers may be specified
   */
  url?: string,
  /**
   * host to find the rethinkdb server
   * 
   * note: only one of url, host & port, server, or servers may be specified
   * @default 'localhost'
   */
  host?: string,
  /**
   * port to connect to the rethinkdb driver via
   * 
   * note: only one of url, host & port, server, or servers may be specified
   * @default 28015
   */
  port?: number,
  /**
   * note: only one of url, host & port, server, or servers may be specified
   */
  server?: RServerConnectionOptions,
  /**
   * note: only one of url, host & port, server, or servers may be specified
   */
  servers?: RServerConnectionOptions[],
  /**
   * whether to wait for the pool to be healthy before continuing
   * @default true
   */
  waitForHealthy?: boolean
}

export type RStreamExtra<Config extends ExtraTableConfig<any, any>, T> = Omit<RStream<T>, 'orderBy'> & {
  <A extends keyof T>(attribute: RValue<A>): RStreamExtra<Config, T[A]>,
  (n: RValue<number>): RDatum<T>,
  
  orderBy(...fieldOrIndex: Array<FieldSelector<T> | { index: keyof Config['indexes'] }>): RStreamExtra<Config, T>
}

export type RSingleSelectionExtra<_Config extends ExtraTableConfig<any, any>, T> = Omit<RSingleSelection<T>, 'update' | 'replace'> & {
  <A extends keyof T>(attribute: RValue<A>): RDatum<T[A]>,
  
  update(obj: RValue<DeepPartial<T>>, options?: UpdateOptions): RDatum<WriteResult<T>>,
  update(updater: (previous: RDatum<T>) => RValue<DeepPartial<DeepValue<T>>>, options?: UpdateOptions): RDatum<WriteResult<T>>,

  replace(obj: RValue<T>, options?: UpdateOptions): RDatum<WriteResult<T>>,
  replace(replacer: (previous: RDatum<T>) => RValue<DeepValue<T>>, options?: UpdateOptions): RDatum<WriteResult<T>>
}

export type RSelectionExtra<Config extends ExtraTableConfig<any, any>, T> = Omit<RSelection<T>, 'update' | 'replace' | 'orderBy'> & {
  <A extends keyof T>(attribute: RValue<A>): RStreamExtra<Config, T[A]>,
  (n: RValue<number>): RDatum<T>,
  
  update(obj: RValue<DeepPartial<T>>, options?: UpdateOptions): RDatum<WriteResult<T>>,
  update(updater: (previous: RDatum<T>) => RValue<DeepPartial<DeepValue<T>>>, options?: UpdateOptions): RDatum<WriteResult<T>>,

  replace(obj: RValue<T>, options?: UpdateOptions): RDatum<WriteResult<T>>,
  replace(replacer: (previous: RDatum<T>) => RValue<DeepValue<T>>, options?: UpdateOptions): RDatum<WriteResult<T>>,

  orderBy(...fieldOrIndex: Array<FieldSelector<T> | { index: keyof Config['indexes'] }>): RStreamExtra<Config, T>
}

export type RTableExtra<Config extends ExtraTableConfig<any, any>> = Omit<RTable<Config['type']>, 'get' | 'getAll' | 'between' | 'insert' | 'update' | 'replace' | 'orderBy'> & {
  <A extends keyof Config['type']>(attribute: RValue<A>): RStreamExtra<Config, Config['type'][A]>,
  (n: RValue<number>): RDatum<Config['type']>,
  
  get(key: Config['type']['id'] | RDatum<Config['type']['id']>): RSingleSelectionExtra<Config, Config['type'] | null>,

  getAll<I extends keyof Config['indexes']>(key: QueryForIndex<Config, I>, options: { index: I }): RSelectionExtra<Config, Config['type']>,
  getAll<I extends (keyof Config['indexes'] | PrimaryIndex) = PrimaryIndex>(...keys: Array<QueryForIndex<Config, I> | { index: I }>): RSelectionExtra<Config, Config['type']>,

  between<I extends (keyof Config['indexes'] | PrimaryIndex) = PrimaryIndex>(
    lowKey: QueryForIndex<Config, I>,
    highKey: QueryForIndex<Config, I>,
    options?: { index?: I, leftBound?: 'open' | 'closed', rightBound?: 'open' | 'closed' }
  ): RSelectionExtra<Config, Config['type']>,

  insert(
    obj: RValue<Config['type'] |
      DistOmit<Config['type'], 'id'>> |
      RValue<Array<Config['type'] | DistOmit<Config['type'], 'id'>>>,
    options?: InsertOptions
  ): RDatum<WriteResult<Config['type']>>,

  update(obj: RValue<DeepPartial<Config['type']>>, options?: UpdateOptions): RDatum<WriteResult<Config['type']>>,
  update(updater: (previous: RDatum<Config['type']>) => RValue<DeepPartial<DeepValue<Config['type']>>>, options?: UpdateOptions): RDatum<WriteResult<Config['type']>>,

  replace(obj: RValue<Config['type']>, options?: UpdateOptions): RDatum<WriteResult<Config['type']>>,
  replace(replacer: (previous: RDatum<Config['type']>) => RValue<DeepValue<Config['type']>>, options?: UpdateOptions): RDatum<WriteResult<Config['type']>>,

  orderBy(...fieldOrIndex: Array<FieldSelector<Config['type']> | { index: keyof Config['indexes'] }>): RStreamExtra<Config, Config['type']>
}

export type RDatabaseExtraConfigs = Record<string, Record<string, ExtraTableConfig<any, any>>>

export type RDatabaseExtra<Configs extends RDatabaseExtraConfigs, Database extends keyof Configs> = Omit<RDatabase, 'db' | 'table'> & {
  table<T extends keyof Configs[Database]>(tableName: T): RTableExtra<Configs[Database][T]>
}

export type RExtra<Configs extends RDatabaseExtraConfigs, Database extends string> = Omit<R, 'asc' | 'desc' | 'db' | 'table'> & {
  asc<T>(index: T): T,
  desc<T>(index: T): T,

  db<D extends keyof Configs>(dbName: D): RDatabaseExtra<Configs, D>,
  table<T extends (Database extends keyof Configs ? keyof Configs[Database] : string)>(tableName: T): Database extends keyof Configs ? RTableExtra<Configs[Database][T]> : RTable,

  empty(): undefined,
  structureSync(options: SyncOptions): Promise<SyncReturnType>,
  $<T extends (Database extends keyof Configs ? keyof Configs[Database] : string)>(tableName: T): Database extends keyof Configs ? RTableExtra<Configs[Database][T]> : RTable,
  $<D extends keyof Configs, T extends keyof Configs[D]>(dbName: D, tableName: T): RTableExtra<Configs[D][T]>
}
