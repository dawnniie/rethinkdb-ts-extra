import type { ConnectOptions } from './connect.js'
import type { ExtraTableConfigIndexBase, PrimaryIndex, QueryForIndex } from './indexes.js'
import type { SyncOptions, SyncReturnType } from './sync.js'
import type { FieldSelector, InsertOptions, MasterPool, R, RDatabase, RDatum, RSelection, RSingleSelection, RStream, RTable, RValue, UpdateOptions, WriteResult } from 'rethinkdb-ts'

export type Distinct<T, UniqueName> = T & { __UNIQUE__: UniqueName }
export type Empty = Distinct<string, 'set to r.literal()'>

type DistOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never
type DeepPartial<T> = T | { [P in keyof T]?: (T[P] extends Array<infer U1> ? Array<DeepPartial<U1>> : T[P] extends ReadonlyArray<infer U2> ? ReadonlyArray<DeepPartial<U2>> : DeepPartial<T[P]>) | undefined }
type DeepValue<T> = RDatum<T> | (T extends object ? { [P in keyof T]: T[P] extends Array<infer U1> ? Array<DeepValue<U1>> : T[P] extends ReadonlyArray<infer U2> ? ReadonlyArray<DeepValue<U2>> : DeepValue<T[P]> } : T)
type DeepValuePartial<T> = RDatum<T> | (T extends object ? { [P in keyof T]?: (T[P] extends Array<infer U1> ? Array<DeepValuePartial<U1>> : T[P] extends ReadonlyArray<infer U2> ? ReadonlyArray<DeepValuePartial<U2>> : DeepValuePartial<T[P]>) | undefined } : T)
type PushEmpty<T> = { [K in keyof T]: unknown extends T[K] ? unknown : T[K] extends Exclude<T[K], undefined> ? PushEmpty<T[K]> : PushEmpty<T[K]> | Empty }

/** see: https://github.com/rethinkdb/rethinkdb/issues/2884#issuecomment-65291774 */
type AllowedPrimaryKeyTypes = string | number | boolean
export interface ExtraTableConfigTypeBase { id: AllowedPrimaryKeyTypes | AllowedPrimaryKeyTypes[] }

export interface ExtraTableConfig<T extends ExtraTableConfigTypeBase, I extends ExtraTableConfigIndexBase<T>> {
  db: string,
  table: string,
  type: T,
  indexes: I
}

export type RStreamExtra<Config extends ExtraTableConfig<any, any>, T> = Omit<RStream<T>, 'orderBy'> & {
  <A extends keyof T>(attribute: RValue<A>): RStreamExtra<Config, T[A]>,
  (n: RValue<number>): RDatum<T>,
  
  orderBy(...fieldOrIndex: Array<FieldSelector<T> | { index: keyof Config['indexes'] }>): RStreamExtra<Config, T>
}

export type RSingleSelectionExtra<_Config extends ExtraTableConfig<any, any>, T> = Omit<RSingleSelection<T>, 'update' | 'replace'> & {
  <A extends keyof T>(attribute: RValue<A>): RDatum<T[A]>,
  
  update(obj: RValue<DeepPartial<PushEmpty<T>>>, options?: UpdateOptions): RDatum<WriteResult<T>>,
  update<Previous = T>(
    updater: (previous: RDatum<Previous>) => DeepValuePartial<PushEmpty<T>> & { [K in Exclude<keyof Previous, keyof T>]: Empty },
    options?: UpdateOptions
  ): RDatum<WriteResult<T>>,

  replace(obj: RValue<T>, options?: UpdateOptions): RDatum<WriteResult<T>>,
  replace<Previous = T>(replacer: (previous: RDatum<Previous>) => RValue<DeepValue<T>>, options?: UpdateOptions): RDatum<WriteResult<T>>
}

export type RSelectionExtra<Config extends ExtraTableConfig<any, any>, T> = Omit<RSelection<T>, 'update' | 'replace' | 'orderBy'> & {
  <A extends keyof T>(attribute: RValue<A>): RStreamExtra<Config, T[A]>,
  (n: RValue<number>): RDatum<T>,
  
  update(obj: RValue<DeepPartial<PushEmpty<T>>>, options?: UpdateOptions): RDatum<WriteResult<T>>,
  update<Previous = T>(
    updater: (previous: RDatum<Previous>) => DeepValuePartial<PushEmpty<T>> & { [K in Exclude<keyof Previous, keyof T>]: Empty },
    options?: UpdateOptions
  ): RDatum<WriteResult<T>>,

  replace(obj: RValue<T>, options?: UpdateOptions): RDatum<WriteResult<T>>,
  replace<Previous = T>(replacer: (previous: RDatum<Previous>) => RValue<DeepValue<T>>, options?: UpdateOptions): RDatum<WriteResult<T>>,

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

  update(obj: RValue<DeepPartial<PushEmpty<Config['type']>>>, options?: UpdateOptions): RDatum<WriteResult<Config['type']>>,
  update<Previous = Config['type']>(
    updater: (previous: RDatum<Previous>) => DeepValuePartial<PushEmpty<Config['type']>> & { [K in Exclude<keyof Previous, keyof Config['type']>]: Empty },
    options?: UpdateOptions
  ): RDatum<WriteResult<Config['type']>>,

  replace(obj: RValue<Config['type']>, options?: UpdateOptions): RDatum<WriteResult<Config['type']>>,
  replace<Previous = Config['type']>(replacer: (previous: RDatum<Previous>) => RValue<DeepValue<Config['type']>>, options?: UpdateOptions): RDatum<WriteResult<Config['type']>>,

  orderBy(...fieldOrIndex: Array<FieldSelector<Config['type']> | { index: keyof Config['indexes'] }>): RStreamExtra<Config, Config['type']>
}

export type RDatabaseExtraConfigs = Record<string, Record<string, ExtraTableConfig<any, any>>>

export type RDatabaseExtra<Configs extends RDatabaseExtraConfigs, Database extends keyof Configs> = Omit<RDatabase, 'db' | 'table'> & {
  table<T extends keyof Configs[Database]>(tableName: T): RTableExtra<Configs[Database][T]>
}

export type RExtra<Configs extends RDatabaseExtraConfigs, DefaultDB extends string> = Omit<R, 'asc' | 'desc' | 'literal' | 'db' | 'table'> & {
  asc<T>(index: T): T,
  desc<T>(index: T): T,
  literal(): Empty,
  literal<T>(obj: T): RDatum<T>,

  db<D extends keyof Configs>(dbName: D): RDatabaseExtra<Configs, D>,
  table<T extends (DefaultDB extends keyof Configs ? keyof Configs[DefaultDB] : string)>(tableName: T): DefaultDB extends keyof Configs ? RTableExtra<Configs[DefaultDB][T]> : RTable,

  extra: {
    connect(options?: ConnectOptions<DefaultDB>): Promise<MasterPool>,
    sync(options?: SyncOptions): Promise<SyncReturnType>
  },
  $<T extends (DefaultDB extends keyof Configs ? keyof Configs[DefaultDB] : string)>(tableName: T): DefaultDB extends keyof Configs ? RTableExtra<Configs[DefaultDB][T]> : RTable,
  $<D extends keyof Configs, T extends keyof Configs[D]>(dbName: D, tableName: T): RTableExtra<Configs[D][T]>
}
