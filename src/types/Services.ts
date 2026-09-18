/** One thing that runs on the machine, described the way compose files and app platforms describe it. */
export type DeclaredService = {
  image: string;
  /** The port it answers on. Named so other services can reach it as `name:port`. */
  port?: number;
  /** Whether the machine publishes the port to the outside, not only to the other services. */
  public?: boolean;
  environment?: Readonly<Record<string, string>>;
  /** Environment variables whose values are secrets, as `VARIABLE: name-in-the-store`. */
  secrets?: Readonly<Record<string, string>>;
  /** A path inside the container that has to survive a restart. */
  storage?: string;
};

/** How to log in to a registry that does not hand out its images to anyone who asks. */
export type Registry = {
  username: string;
  /** The name of the secret holding the password or token, never the value. */
  password: string;
};
