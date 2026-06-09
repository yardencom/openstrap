export class OpenStrapPluginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenStrapPluginError";
  }
}
