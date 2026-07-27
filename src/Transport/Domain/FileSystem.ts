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
}
