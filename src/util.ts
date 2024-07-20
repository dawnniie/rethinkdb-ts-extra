import type { RDatum } from 'rethinkdb-ts'

export type Distinct<T, UniqueName> = T & { __UNIQUE__: UniqueName }
export type Empty = Distinct<string, 'set to r.literal()'>

// @ts-expect-error to not break older runtimes that don't support ERM
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose')

export type DistOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never

export type DeepPartial<T> = T | {
  [P in keyof T]?:
    (T[P] extends Array<infer U1>
      ? Array<DeepPartial<U1>>
      : T[P] extends ReadonlyArray<infer U2>
        ? ReadonlyArray<DeepPartial<U2>>
        : never) |
    DeepPartial<T[P]> |
    undefined
}

export type DeepValue<T> = RDatum<T> | (
  T extends object
    ? {
      [P in keyof T]:
        (T[P] extends Array<infer U1>
          ? Array<DeepValue<U1>>
          : T[P] extends ReadonlyArray<infer U2>
            ? ReadonlyArray<DeepValue<U2>>
            : never) |
        DeepValue<T[P]>
    }
    : T
)

export type DeepValuePartial<T> = RDatum<T> | (
  T extends object
    ? {
      [P in keyof T]?:
        (T[P] extends Array<infer U1>
          ? Array<DeepValuePartial<U1>>
          : T[P] extends ReadonlyArray<infer U2>
            ? ReadonlyArray<DeepValuePartial<U2>>
            : never) |
        DeepValuePartial<T[P]> |
        undefined
    }
    : T
)

type DeDatumDeep<T> = T extends RDatum<infer K>
  ? DeDatumDeep<K>
  : T extends object
    ? { [P in keyof T]: DeDatumDeep<T[P]> }
    : T

export type DeDatumToValue<T> = DeepValue<DeDatumDeep<T>>

export type PushEmpty<T> = {
  [K in keyof T]: unknown extends T[K]
    ? unknown
    : T[K] extends Exclude<T[K], undefined>
      ? PushEmpty<T[K]>
      : PushEmpty<T[K]> | Empty
}
