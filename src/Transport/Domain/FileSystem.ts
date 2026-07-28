export type FileAccess = "executable" | "private" | "readable";

export type FileSystemWriteOptions = {
  mode?: number;
};

export type TextFileWriteOptions = FileSystemWriteOptions & {
  access?: FileAccess;
  strategy?: "atomic";
};

export type RemovePathOptions = {
  force?: boolean;
  recursive?: boolean;
};

export type BinaryFileWriteOptions = FileSystemWriteOptions & {
  access?: FileAccess;
};

export interface FileSystemAPI {
  copyFile(source: string, destination: string): Promise<void>;
  createDirectory(path: string, options?: FileSystemWriteOptions): Promise<void>;
  createExclusiveDirectory(path: string): Promise<boolean>;
  executable(path: string): Promise<boolean>;
  extractTarGz(archivePath: string, destination: string, strip: number): Promise<void>;
  mode(path: string): Promise<number | null>;
  joinPath(...parts: string[]): string;
  parentPath(path: string): string;
  resolvePathWithin(directory: string, ...parts: string[]): string;
  setAccess(path: string, access: FileAccess): Promise<void>;
  readTextFile(path: string): Promise<string | null>;
  removePath(path: string, options?: RemovePathOptions): Promise<void>;
  writeTextFile(path: string, content: string, options?: TextFileWriteOptions): Promise<void>;
  /**
   * The bytes of a file, or null when there is no such file.
   *
   * Separate from `readTextFile` because a decoding is a decision: an executable
   * read as UTF-8 comes back corrupted, and the corruption is silent.
   */
  readFile(path: string): Promise<Buffer | null>;
  writeFile(path: string, content: Buffer, options?: BinaryFileWriteOptions): Promise<void>;
}
