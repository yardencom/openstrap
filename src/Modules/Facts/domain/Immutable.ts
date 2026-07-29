/**
 * What was read, all the way down.
 *
 * Facts are what a machine answered at one moment. Nothing may edit them afterwards — a requirement
 * checked against edited facts checks nothing — and this is how that is said. `readonly` on its own
 * reaches one level: it stops `facts.os = …` and allows `facts.os.name = …`, which is most of the
 * facts, and `facts.users.openstrap.groups.push(…)` deeper still.
 *
 * Said in the type rather than done at runtime. A recursive freeze walked every section on every
 * collection to prevent something no code here does; the compiler prevents it in the only place it
 * could be written, at no cost to anyone running openstrap.
 */
export type Immutable<T> = { readonly [K in keyof T]: Immutable<T[K]> };
