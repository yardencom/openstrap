/** The server answered, and the answer was no. Its own sentence is kept: it knows the reason. */
export class ServerRefusedError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ServerRefusedError";
  }
}
