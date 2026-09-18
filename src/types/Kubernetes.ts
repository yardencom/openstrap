/** One thing a cluster is told to keep: a deployment, a service, a secret, a volume claim. */
export type KubernetesObject = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  [field: string]: unknown;
};
