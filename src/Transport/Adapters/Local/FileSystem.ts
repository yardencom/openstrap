import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, chmod, copyFile, lstat, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import * as tar from "tar";

import type {
  FileAccess,
  FileSystemAPI,
  FileSystemWriteOptions,
  RemovePathOptions,
  TextFileWriteOptions,
} from "../../Domain/FileSystem.js";

const fileModes: Record<FileAccess, number> = {
  executable: 0o755,
  private: 0o600,
  readable: 0o644,
};

export class LocalFileSystem implements FileSystemAPI {
  async copyFile(source: string, destination: string): Promise<void> {
    await copyFile(source, destination);
  }

  async createDirectory(path: string, options: FileSystemWriteOptions = {}): Promise<void> {
    await mkdir(path, { recursive: true });

    if (options.mode !== undefined) {
      await chmod(path, options.mode);
    }
  }

  async createExclusiveDirectory(path: string): Promise<boolean> {
    try {
      await mkdir(path);
      return true;
    } catch (error) {
      if (errorCode(error) === "EEXIST") {
        return false;
      }

      throw error;
    }
  }

  async executable(path: string): Promise<boolean> {
    try {
      await access(path, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  async extractTarGz(archivePath: string, destination: string, strip: number): Promise<void> {
    await this.createDirectory(destination);
    await tar.x({
      cwd: destination,
      file: archivePath,
      strip,
    });
  }

  joinPath(...parts: string[]): string {
    return join(...parts);
  }

  async mode(path: string): Promise<number | null> {
    try {
      return (await stat(path)).mode & 0o777;
    } catch (error) {
      if (errorCode(error) === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  parentPath(path: string): string {
    return dirname(path);
  }

  resolvePathWithin(directory: string, ...parts: string[]): string {
    const root = resolve(directory);
    const path = resolve(root, ...parts);
    const relation = relative(root, path);

    if (relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
      throw new Error(`Path escapes its directory: ${path}`);
    }

    return path;
  }

  async setAccess(path: string, fileAccess: FileAccess): Promise<void> {
    await chmod(path, fileModes[fileAccess]);
  }

  async readTextFile(path: string): Promise<string | null> {
    try {
      return await readFile(path, "utf8");
    } catch (error) {
      if (errorCode(error) === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async removePath(path: string, options: RemovePathOptions = {}): Promise<void> {
    await rm(path, options);
  }

  async writeTextFile(path: string, content: string, options: TextFileWriteOptions = {}): Promise<void> {
    const mode = this.textFileMode(options);

    if (options.strategy === "atomic") {
      await this.writeTextFileAtomically(path, content, mode);
      return;
    }

    await this.createDirectory(this.parentPath(path));
    await writeFile(path, content, "utf8");

    if (mode !== undefined) {
      await chmod(path, mode);
    }
  }

  private async writeTextFileAtomically(path: string, content: string, mode: number | undefined): Promise<void> {
    const current = await this.currentTextFile(path);

    if (current?.content === content && (mode === undefined || current.mode === mode)) {
      return;
    }

    await this.createDirectory(this.parentPath(path));
    const temporary = `${path}.${randomUUID()}.tmp`;
    const effectiveMode = mode ?? current?.mode;

    try {
      await writeFile(temporary, content, { encoding: "utf8", flag: "wx", mode: effectiveMode });

      if (effectiveMode !== undefined) {
        await chmod(temporary, effectiveMode);
      }

      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  private async currentTextFile(path: string): Promise<{ content: string | null; mode?: number } | null> {
    try {
      const file = await lstat(path);

      if (file.isSymbolicLink()) {
        return { content: null };
      }

      if (!file.isFile()) {
        throw new Error(`Path is not a regular file: ${path}`);
      }

      return { content: await readFile(path, "utf8"), mode: file.mode & 0o777 };
    } catch (error) {
      if (errorCode(error) === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  private textFileMode(options: TextFileWriteOptions): number | undefined {
    if (options.access !== undefined && options.mode !== undefined) {
      throw new Error("Text file access and mode cannot be specified together");
    }

    return options.access === undefined ? options.mode : fileModes[options.access];
  }
}

function errorCode(error: unknown): string | undefined {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return error.code;
  }

  return undefined;
}
