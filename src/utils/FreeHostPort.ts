import { createServer } from "node:net";

/**
 * A port on this machine nothing is listening on.
 *
 * Asked of the kernel rather than of a table openstrap keeps, and that is the whole difference: a
 * table knows which ports openstrap forwarded and nothing about the other program that took 2222
 * this morning. Binding is the only question whose answer is the truth.
 *
 * Two `create` runs at once on this host would race between the check and the forward. They cannot
 * be at once: `create` holds the run lock for the whole of it.
 */
export class FreeHostPort {
  constructor(private readonly host = "127.0.0.1") {}

  /** The first port from here upwards that nothing holds. */
  async from(first: number, tries = 200): Promise<number> {
    for (let port = first; port < first + tries; port += 1) {
      if (await this.free(port)) {
        return port;
      }
    }

    throw new Error(`No free port between ${first} and ${first + tries - 1} on ${this.host}`);
  }

  private free(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createServer();

      socket.once("error", () => resolve(false));
      socket.listen({ port, host: this.host, exclusive: true }, () => {
        socket.close(() => resolve(true));
      });
    });
  }
}
