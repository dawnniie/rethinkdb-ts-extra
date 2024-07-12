import type { ExtraTableConfig, ExtraTableConfigTypeBase } from './types.js'
import type { RDatum, RValue } from 'rethinkdb-ts'

export type PrimaryIndex = '_PRIMARY'
interface ExtraTableConfigIndexSingleOrMulti { multi?: true }
interface ExtraTableConfigIndexCompound<T extends ExtraTableConfigTypeBase> { compound: ReadonlyArray<keyof T> }
interface ExtraTableConfigIndexCustom<T extends ExtraTableConfigTypeBase> { custom: (row: RDatum<T>) => RDatum<any> | ReadonlyArray<RDatum<any>> }
interface ExtraTableConfigIndexCustomMulti<T extends ExtraTableConfigTypeBase> { multi: true, custom: (row: RDatum<T>) => ReadonlyArray<RDatum<any> | ReadonlyArray<RDatum<any>>> }
export interface ExtraTableConfigIndexBase<T extends ExtraTableConfigTypeBase> {
  [index: string]: ExtraTableConfigIndexSingleOrMulti | ExtraTableConfigIndexCompound<T> | ExtraTableConfigIndexCustom<T> | ExtraTableConfigIndexCustomMulti<T>
}

type DeDatumToValue<T> = T extends RDatum<infer K> ? RValue<K> : RValue<T>

export type QueryForIndex<Config extends ExtraTableConfig<any, any>, Index extends (keyof Config['indexes'] | PrimaryIndex)> = (
  // First check primary index, this generally happens in default cases etc
  PrimaryIndex extends Index
    ? RValue<Config['type']['id']>
    // Compound indexes we construct a mapped tuple with a specific type for each index based on the indexed fields
    : 'compound' extends keyof Config['indexes'][Index]
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
