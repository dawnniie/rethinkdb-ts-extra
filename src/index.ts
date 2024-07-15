import { createSyncer } from './sync.js'
import { r } from 'rethinkdb-ts'
import type { ExtraTableConfigIndexBase } from './indexes.js'
import type { Empty, ExtraTableConfig, ExtraTableConfigTypeBase, RTableExtra } from './types.js'

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

type Re<Configs extends { [name: string]: ExtraTableConfig<any, any> }> = typeof r
  & { [tableName in keyof Configs]: RTableExtra<Configs[tableName]> }
  & {
    /** Wrap around an index name to perform orderBy in reverse */
    desc<T>(index: T): T,
    /** A typescript-friendly way of clearing a field using `re.literal()` */
    empty(): Empty
  }

interface AttachConfigurationsReturnType<Configs extends { [name: string]: ExtraTableConfig<any, any> }> { r: Re<Configs>, sync: ReturnType<typeof createSyncer> }

/**
 * Attaches provided table configurations (and other utilies) to the `r` object with detailed extra data and index typings. Also provides a `sync` function for in-place database structure updates (sort of like automated structure (not data!) migrations).
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

  return { r: r as Re<Configs>, sync: createSyncer(r, configs) }
}

export * from 'rethinkdb-ts'
