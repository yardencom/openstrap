import { createHash } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * pkg's word for a platform, against openstrap's.
 *
 * `linuxstatic` is a build flavour of pkg's; `linux` is what openstrap reads out of a target's
 * `/bin/sh` and what it calls the platform everywhere else. `macos` needs no translation: openstrap
 * says `macos` too, and `darwin` — which is Node's word — would be a third name for one thing.
 */
const platforms = { linuxstatic: "linux", win: "windows" };

/**
 * How openstrap is packaged.
 *
 * One list of platforms, and it is the release: the machine a person installs openstrap on and the
 * machines openstrap delivers itself to are the same machines, because it is the same program. The
 * entry is bundled first — pkg reads JavaScript, and openstrap is TypeScript in many files — which is
 * `npm run bundle`.
 *
 * Built as source rather than bytecode: a V8 bytecode cache is only valid for the V8 that produced
 * it, and a binary built here for another architecture would be rejected at startup on the machine it
 * was built for.
 */
export default {
  targets: [
    "node24-macos-arm64",
    "node24-macos-x64",
    "node24-linuxstatic-arm64",
    "node24-linuxstatic-x64",
  ],
  outputPath: "bin",
  bytecode: false,
  public: true,
  publicPackages: ["*"],

  /**
   * What pkg cannot say for itself about a binary it has just written.
   *
   * It is named for the platform it runs on. pkg names its output after its own build flavours, and
   * openstrap asks for a build by what it reads out of the target's `/bin/sh`: ELF or Mach-O, which
   * is `linux` or `darwin`. Those are the platform's words, so the packager's are translated here
   * rather than spread into the program.
   *
   * And the digest of its contents goes beside it, because that is what the copy delivered to a
   * machine is named after: an unchanged build is never sent twice, and a changed one is never
   * mistaken for the old one.
   */
  postBuild(built) {
    const [name, flavour, architecture] = built.split("/").pop().split("-");
    const binary = join(dirname(built), [name, platforms[flavour] ?? flavour, architecture].join("-"));

    renameSync(built, binary);
    writeFileSync(`${binary}.sha256`, createHash("sha256").update(readFileSync(binary)).digest("hex"));
  },
};
