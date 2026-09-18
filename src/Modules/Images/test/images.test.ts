import { describe, expect, it } from "vitest";

import { Images } from "../Images.js";
import { NoImageForArchitectureError } from "../errors/NoImageForArchitectureError.js";
import { UnknownImageError } from "../errors/UnknownImageError.js";

/**
 * openstrap does not know what operating systems there are.
 *
 * It used to: three distributions were written into it, each with the shape of its own checksum
 * file, and asking for a fourth was an error saying openstrap had not heard of it. Which meant a
 * new release of a supported one worked and everything else did not, forever, until somebody added
 * it — and the day somebody publishes an operating system nobody has heard of, that is the day
 * openstrap cannot make a machine with it.
 *
 * So the name goes to a registry anyone publishes to, and openstrap holds no distribution, no
 * version and no URL of its own.
 */
describe("The image a name resolves to", () => {
  it("is whatever the registry has published under that name", async () => {
    const images = new Images(registry());

    const image = await images.resolve("gentoo", "arm64");

    expect(image).toEqual({
      reference: "gentoo",
      url: "https://registry.example/generic/gentoo/4.3.12/qemu/arm64.box",
      sha256: "a".repeat(64),
      platform: "linux",
      architecture: "arm64",
      // The box is what was published and what the checksum is for, so the box is what is fetched.
      format: "vagrant-box",
      boot: "uefi",
    });
  });

  it("is the one most people fetch, when several publishers use the name", async () => {
    const images = new Images(registry());

    // `obscure/gentoo` is published too and answers to the same word. Which of them `gentoo` means
    // is a question the registry already answers, by saying how often each is downloaded.
    expect((await images.resolve("gentoo", "arm64")).url).toContain("/generic/gentoo/");
  });

  it("takes a release to be part of the name, because that is how the registry writes one", async () => {
    const images = new Images(registry());

    // `debian:12` is the box called `debian12`. The registry's own versions are versions of a box —
    // its build number — and asking it for version 12 of `debian` asks a different question.
    expect((await images.resolve("debian:12", "x64")).url).toContain("/generic/debian12/");
  });

  it("is one exact box when one is named in full, at the version that was asked for", async () => {
    const images = new Images(registry());

    const image = await images.resolve("generic/debian12:4.3.11", "x64");

    expect(image.url).toBe("https://registry.example/generic/debian12/4.3.11/qemu/amd64.box");
  });

  it("skips a release that was not built for this machine, rather than failing at the newest", async () => {
    const images = new Images(registry());

    // 4.3.12 of `alpine318` is amd64 only; 4.3.11 has arm64. A machine is made from the newest
    // release that can run here, which is not always the newest release.
    expect((await images.resolve("alpine318", "arm64")).url).toContain("/4.3.11/");
  });

  it("says so when nobody has published under that name, and does not offer a list of what to write", async () => {
    const images = new Images(registry());

    await expect(images.resolve("nosuchthing", "arm64")).rejects.toThrow(UnknownImageError);
    await expect(images.resolve("nosuchthing", "arm64")).rejects.toThrow(/keeps no list of operating systems/);
  });

  it("says which architectures a published image was built for, when this one is not among them", async () => {
    const images = new Images(registry());

    // A different name to write and a machine that cannot run this one are not the same problem,
    // and an answer that treats them alike sends someone looking for a spelling mistake.
    await expect(images.resolve("generic/ubuntu2204", "arm64")).rejects.toThrow(NoImageForArchitectureError);
    await expect(images.resolve("generic/ubuntu2204", "arm64")).rejects.toThrow(/published for amd64/);
  });

  it("is named after its own kernel when the name says one, because that decides what is delivered there", async () => {
    const images = new Images(registry());

    expect((await images.resolve("freebsd14", "x64")).platform).toBe("freebsd");
  });

  it("refuses an architecture no published box is built for at all", async () => {
    const images = new Images(registry());

    await expect(images.resolve("gentoo", "mips")).rejects.toThrow(NoImageForArchitectureError);
  });
});

type Release = { version: string; providers: readonly Record<string, unknown>[] };

/** A build of one box, as the registry answers about it. */
function built(box: string, version: string, architecture: string): Record<string, unknown> {
  return {
    name: "qemu",
    architecture,
    download_url: `https://registry.example/${box}/${version}/qemu/${architecture}.box`,
    checksum: "a".repeat(64),
    checksum_type: "sha256",
  };
}

const boxes: Record<string, readonly Release[]> = {
  "generic/gentoo": [{ version: "4.3.12", providers: [built("generic/gentoo", "4.3.12", "arm64")] }],
  "obscure/gentoo": [{ version: "1.0.0", providers: [built("obscure/gentoo", "1.0.0", "arm64")] }],
  "generic/debian12": [
    { version: "4.3.12", providers: [built("generic/debian12", "4.3.12", "amd64")] },
    { version: "4.3.11", providers: [built("generic/debian12", "4.3.11", "amd64")] },
  ],
  "generic/alpine318": [
    { version: "4.3.12", providers: [built("generic/alpine318", "4.3.12", "amd64")] },
    { version: "4.3.11", providers: [built("generic/alpine318", "4.3.11", "arm64")] },
  ],
  "generic/ubuntu2204": [{ version: "4.3.12", providers: [built("generic/ubuntu2204", "4.3.12", "amd64")] }],
  "generic/freebsd14": [{ version: "4.3.12", providers: [built("generic/freebsd14", "4.3.12", "amd64")] }],
};

/** Downloads, so that "which `gentoo` is meant" has an answer nobody at openstrap picked. */
const downloads: Record<string, number> = { "generic/gentoo": 688_205, "obscure/gentoo": 12 };

/**
 * The registry, answering as the real one does.
 *
 * Search matches a name and offers what it found; a box is asked about by tag and answers with its
 * releases. Nothing here knows a distribution, which is the point being tested.
 */
function registry(): typeof globalThis.fetch {
  return (async (input: string | URL) => {
    const url = new URL(String(input));
    const found: Record<string, unknown> = url.pathname.endsWith("/search")
      ? searched(url.searchParams.get("q") ?? "")
      : { versions: boxes[url.pathname.replace("/api/v2/box/", "")] ?? [] };

    return { ok: true, status: 200, json: async () => found } as Response;
  }) as typeof globalThis.fetch;
}

function searched(query: string): { boxes: readonly Record<string, unknown>[] } {
  const matching = Object.keys(boxes)
    .filter((tag) => tag.split("/").at(-1) === query)
    .sort((one, other) => (downloads[other] ?? 0) - (downloads[one] ?? 0));

  return {
    boxes: matching.map((tag) => ({ tag, current_version: { providers: boxes[tag]![0]!.providers } })),
  };
}
