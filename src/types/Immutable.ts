/** What was read, all the way down. */
export type Immutable<T> = { readonly [K in keyof T]: Immutable<T[K]> };
