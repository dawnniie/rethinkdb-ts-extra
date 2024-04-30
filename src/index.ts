import { r } from 'rethinkdb-ts'
import type { RSelection, RSingleSelection, RTable, InsertOptions, RDatum, RValue, WriteResult } from 'rethinkdb-ts'
import { createUpgrader } from './upgrade.js'

export interface ExtraTableConfigTypeBase { id: string }

interface ExtraTableConfigIndexSingleOrMulti { multi?: true }
interface ExtraTableConfigIndexCompound<T extends ExtraTableConfigTypeBase> { compound: ReadonlyArray<keyof T> }
interface ExtraTableConfigIndexCustom<T extends ExtraTableConfigTypeBase> { custom: (row: RDatum<T>) => RDatum<any> | ReadonlyArray<RDatum<any>> }
interface ExtraTableConfigIndexCustomMulti<T extends ExtraTableConfigTypeBase> { multi: true, custom: (row: RDatum<T>) => ReadonlyArray<RDatum<any> | ReadonlyArray<RDatum<any>>> }
export interface ExtraTableConfigIndexBase<T extends ExtraTableConfigTypeBase> {
  [index: string]: ExtraTableConfigIndexSingleOrMulti | ExtraTableConfigIndexCompound<T> | ExtraTableConfigIndexCustom<T> | ExtraTableConfigIndexCustomMulti<T>
}

export interface ExtraTableConfig<T extends ExtraTableConfigTypeBase, I extends ExtraTableConfigIndexBase<T>> {
  db: string
  table: string
  type: T
  indexes: I
}

/**
 * Constructs an object that is used in `attachConfigurations`, and does so with some nice intellisence autocomplete.
 *
 * It needs to be a chained function so that the user can specify a `Type` generic, but the generic that produces a `const` type for `indexes` internally can still be inferred.
 *
 * The different types of secondary indexes that can be configured are as follows:
 *
 * ```ts
 * simple: {} // (on 'simple' field)
 * multi: { multi: true } // (on 'multi' field)
 * compound: { compound: ['last_name', 'first_name'] }
 * custom: { custom: function (row) { return row('hobbies').add(row('sports')) } }
 * ```
 *
 * The `multi` index here is really just a simple index with the multi index option. Any simple or custom index can be set to be a multi index as long as the value in question is an array. A 'multi compound' index can also be constructed, but needs to be done with a custom expression. Read more about rethinkdb [secondary indexes here](https://rethinkdb.com/docs/secondary-indexes/javascript).
 *
 * @example
 * interface MyObject {
 *   id: string,
 *   my_number: boolean
 * }
 *
 * // Configure the 'myobjects' table in 'mydatabase' as holding MyObject documents,
 * // and with a custom index based on the `my_number` field
 * config<MyObject>('mydatabase', 'myobjects')(
 *   { my_number: { custom: function (row) { return row('my_number').add(1) } } }
 * )
 */
export function configure<T extends ExtraTableConfigTypeBase> (db: string, table: string): (<const I extends ExtraTableConfigIndexBase<T>> (indexes: I) => ExtraTableConfig<T, I>) {
  return <const I extends ExtraTableConfigIndexBase<T>> (indexes: I): ExtraTableConfig<T, I> => {
    return { db, table, type: null as unknown as T, indexes }
  }
}

type DistOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never

type DeDatumToValue<T> = T extends RDatum<infer K> ? RValue<K> : RValue<T>
type QueryForIndex<Config extends ExtraTableConfig<any, any>, Index extends keyof Config['indexes']> = (
  // Compound indexes we construct a mapped tuple with a specific type for each index based on the indexed fields
  'compound' extends keyof Config['indexes'][Index]
    ? {
        [F in Exclude<keyof Config['indexes'][Index]['compound'], keyof any[]>]:
        Config['indexes'][Index]['compound'][F] extends keyof Config['type']
          ? DeDatumToValue<Config['type'][Config['indexes'][Index]['compound'][F]]>
          : never
      }
    // Custom indexes we base the input on the output of the index value generation function
    : 'custom' extends keyof Config['indexes'][Index]
      ? 'multi' extends keyof Config['indexes'][Index]
        // Custom multi indexes with a nested array must be multi compound indexes, so infer the nested compound type
        ? Config['indexes'][Index]['custom'] extends ((...args: any) => ReadonlyArray<infer R extends readonly any[]>)
          ? { [F in Exclude<keyof R, keyof any[]>]: DeDatumToValue<R[F]> }
          // Otherwise they are regular multi indexes, so infer the multi type
          : Config['indexes'][Index]['custom'] extends ((...args: any) => infer R extends readonly any[])
            ? DeDatumToValue<R[number]>
            : never
        // Custom non-multi indexes with an array must be compound indexes, so infer the compound type
        : Config['indexes'][Index]['custom'] extends ((...args: any) => infer R extends readonly any[])
          ? { [F in Exclude<keyof R, keyof any[]>]: DeDatumToValue<R[F]> }
          // Otherwise they are regular custom indexes, so infer the simple type
          : Config['indexes'][Index]['custom'] extends ((...args: any) => infer R)
            ? DeDatumToValue<R>
            : never
      // Multi indexes we allow any possible value in the array from the specified field
      : 'multi' extends keyof Config['indexes'][Index]
        ? Config['type'][Index] extends infer R extends readonly any[]
          ? DeDatumToValue<R[number]>
          : never
        // Other indexes we just return the field type itself
        : RValue<Config['type'][Index]>
)

type RTableExtra<Config extends ExtraTableConfig<any, any>> = Omit<RTable<Config['type']>, 'get' | 'getAll' | 'between' | 'insert'> & {
  get: (key: Config['type']['id'] | RDatum<Config['type']['id']>) => RSingleSelection<Config['type'] | null>
  getAll: (<I extends keyof Config['indexes']>(key: QueryForIndex<Config, I>, options: { index: I }) => RSelection<Config['type']>) & ((...key: Array<Config['type']['id']>) => RSelection<Config['type']>)
  between: <I extends keyof Config['indexes']>(
    lowKey: QueryForIndex<Config, I>,
    highKey: QueryForIndex<Config, I>,
    options?: { index?: I, leftBound?: 'open' | 'closed', rightBound?: 'open' | 'closed' }
  ) => RSelection<Config['type']>
  insert: (obj: RValue<Config['type'] | DistOmit<Config['type'], 'id'>> | RValue<Array<Config['type'] | DistOmit<Config['type'], 'id'>>>, options?: InsertOptions) => RDatum<WriteResult<Config['type']>>
}

type Re<Configs extends { [name: string]: ExtraTableConfig<any, any> }> = typeof r
  & { [tableName in keyof Configs]: RTableExtra<Configs[tableName]> }
  & {
    /** A typescript-friendly way of clearing a field using `re.literal()` */
    empty: () => undefined
  }

interface AttachConfigurationsReturnType<Configs extends { [name: string]: ExtraTableConfig<any, any> }> { r: Re<Configs>, upgrade: ReturnType<typeof createUpgrader> }

/**
 * Attaches provided table configurations (and other utilies) to the `r` object with detailed extra data and index typings. Also provides an `upgrade` function for in-place database structure updates (sort of like automated migrations).
 *
 * Each table config is attached to `r` with its name (the key in the object), so that the table can be accessed by shorthand like so:
 *
 * ```ts
 * const { r } = attachConfigurations({ myTableName: configure<{ id: string }>('mydb', 'mytable')({}) })
 *
 * // instead of
 * r.db('mydb').table('mytable') // -> RTable<any>
 * // you can do
 * r.myTableName // -> RTableExtra<{ id: string , ...>
 * ```
 *
 * The type `RTableExtra` is an extension of `RTable`. While `RTable` already supports providing types, this must be done manually with each call. The shorthand pre-populates this type information, as well as extra information for secondary indexes. Some key `RTable` methods (currently `get`, `getAll`, `between` and `insert`) are re-typed in `RTableExtra` to take advantage of this extra type information. When you run an operation with an index, the configuration for that index and the table data will be used to typecheck the data you are passing.
 *
 * Even though these shorthands are attached in-place to the `r` object exported by `rethinkdb-ts`, you likely want to export and reference the `r` object where it is returned by `attachConfigurations`, because this is the only way to get the correct typings.
 *
 * If you're using custom indexes, you may find that having the `configure` calls in the arguments for the `attachConfigurations` call breaks the inference of the custom expression argument type. I can't figure out how to fix this yet, and my only solution has been to move the configure call away and pass the output in. If you have any ideas for this, please let me know.
 */
export function attachConfigurations<const Configs extends { [name: string]: ExtraTableConfig<any, any> }> (configs: Configs): AttachConfigurationsReturnType<Configs> {
  // @ts-expect-error this override is defined below
  for (const [name, config] of Object.entries(configs)) r[name] = r.db(config.db).table(config.table)
  // @ts-expect-error this override is defined below
  r.empty = () => r.literal()

  return { r: r as Re<Configs>, upgrade: createUpgrader(r, configs) }
}

export * from 'rethinkdb-ts'
