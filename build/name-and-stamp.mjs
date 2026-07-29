import { createHash } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * What pkg cannot say for itself about a binary it has just written.
 *
 * A `postBuild` hook, which is where pkg offers to be extended, and it is given the file. Two things
 * happen to it here.
 *
 * It is named for the platform it runs on. pkg names its output after its own build flavours —
 * `macos`, `linuxstatic` — and openstrap asks for a build by what it read out of the target's
 * `/bin/sh`: ELF or Mach-O, which is `linux` or `darwin`. Those are the platform's words and pkg's
 * are the packager's, so the packager's are translated rather than spread into the program.
 *
 * And its digest is written beside it, because the copy openstrap delivers to a machine is named
 * after the digest of its contents: an unchanged build is then never sent twice, and a changed one is
 * never mistaken for the old one.
 */
const flavours = { macos: "darwin", linuxstatic: "linux", win: "windows" };

const built = process.env.PKG_OUTPUT;
const [name, flavour, architecture] = built.split("/").pop().split("-");
const binary = join(dirname(built), [name, flavours[flavour] ?? flavour, architecture].join("-"));

renameSync(built, binary);
writeFileSync(`${binary}.sha256`, createHash("sha256").update(readFileSync(binary)).digest("hex"));

// The bundle is an input, not a release artifact, and it is the one thing in here that is not a
// binary openstrap can be.
rmSync(join(dirname(built), "openstrap.cjs"), { force: true });
