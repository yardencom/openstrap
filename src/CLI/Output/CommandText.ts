/**
 * A command's result in the words a person reads it by.
 *
 * One per command, because what a run has to say about itself has nothing in common with
 * what creating a machine has to say. They share only that both can be asked.
 */
export interface CommandText<TResult> {
  of(result: TResult): string;
}
