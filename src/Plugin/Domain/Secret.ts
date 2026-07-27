/**
 * A pointer to a secret held by the core secret store.
 *
 * Plugins receive references, never values: a secret is revealed only inside
 * the trusted execution boundary that owns the store.
 */
export type SecretReference = {
  store: string;
  name: string;
};

export type SecretStore = {
  id: string;
  displayName?: string;
  read(reference: SecretReference): Promise<string | null>;
  write(reference: SecretReference, value: string): Promise<void>;
  remove(reference: SecretReference): Promise<void>;
};
