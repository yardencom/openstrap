import { NoImageForArchitectureError } from "./errors/NoImageForArchitectureError.js";
import { UnknownImageError } from "./errors/UnknownImageError.js";
import type { ResolvedImage } from "@openstrap/plugin-contract";

/** What the registry calls the architecture Node calls `arm64`. */
const architectures: Record<string, string> = {
  arm64: "arm64",
  aarch64: "arm64",
  x64: "amd64",
  x86_64: "amd64",
  ia32: "i386",
  ppc64: "ppc64le",
};

/**
 * The catalogue, which already exists and is not openstrap's.
 *
 * Anyone may publish a machine image here under a name, and each one is served with the checksum of
 * the file that was published. openstrap holds no list of distributions, no list of versions and no
 * list of URLs: it asks this by name, which is why an operating system nobody has heard of today
 * works the day somebody publishes it.
 */
const registry = "https://vagrantcloud.com/api/v2";

/**
 * How many boxes sharing a name are asked about before giving up.
 *
 * One name, several publishers, and each has to be asked separately whether it built for this
 * machine. The most fetched is nearly always the answer; this is the tail, bounded so that a
 * common word does not become twenty requests.
 */
const considered = 5;

/**
 * A build of one box, for one hypervisor, for one architecture.
 *
 * Named as the registry names them — this is its answer read back, not openstrap's vocabulary.
 */
type Published = {
  name: string;
  architecture?: string;
  download_url?: string;
  checksum?: string;
  checksum_type?: string;
};

type Release = { version: string; status?: string; providers?: readonly Published[] };
type Listed = { tag: string; current_version?: { providers?: readonly Published[] } };

type Fetch = typeof globalThis.fetch;

/**
 * The name someone wrote, as a thing the registry can be asked about.
 *
 * `gentoo` is a name to look up; `generic/gentoo` is one box exactly, and only then does `:4.3.12`
 * mean a version — a version of the box, which is what the registry has versions of. Without an
 * owner the colon is part of the name, because that is how this catalogue writes an operating
 * system and its release: `ubuntu:22.04` is the box called `ubuntu2204`.
 */
type Asked = { tag?: string; search: string; version?: string };

/**
 * What `gentoo` is, and what `generic/debian12:4.3.12` is.
 *
 * A name a person writes, turned into one file to fetch and the checksum it was published with. The
 * answer comes from a registry that anyone publishes to, so openstrap needs to know no distribution,
 * no version and no URL — which is the only arrangement under which any operating system works,
 * including the ones released after this was written.
 *
 * No signature is checked. The registry publishes a checksum beside each file and serves both over
 * the same TLS: openstrap can say the bytes are the ones that were published under that name, which
 * is what it is in a position to say.
 */
export class Images {
  constructor(private readonly fetch: Fetch = globalThis.fetch) {}

  async resolve(reference: string, architecture: string): Promise<ResolvedImage> {
    const arch = architectures[architecture];

    if (!arch) {
      throw new NoImageForArchitectureError(reference, architecture, Object.keys(architectures));
    }

    const asked = Images.asked(reference);
    const candidates = asked.tag ? [asked.tag] : await this.ranked(asked.search);
    const available = new Set<string>();

    for (const tag of candidates) {
      const box = await this.built(tag, asked.version, arch);

      box.available.forEach((one) => available.add(one));

      if (box.published) {
        return {
          reference,
          url: box.published.download_url!,
          sha256: box.published.checksum!,
          platform: Images.platformOf(tag),
          architecture: arch,
          // A published box is a gzipped tar with a disk image inside it, and the disk is qcow2.
          // What is downloaded is the box, so that is what this says: the provider unpacks it.
          format: "vagrant-box",
          boot: arch === "arm64" ? "uefi" : "bios",
        };
      }
    }

    if (candidates.length === 0) {
      throw new UnknownImageError(reference, asked.search, [], arch);
    }

    throw new NoImageForArchitectureError(reference, arch, [...available], candidates.join(", "));
  }

  /**
   * The boxes published under this name, most fetched first.
   *
   * Several publishers use one name and the registry says how often each is downloaded, so the
   * question "what is `gentoo`" has an answer that nobody at openstrap had to pick. Asked in order
   * rather than taken outright: the most popular box is not always built for every architecture,
   * and the next one down is a real answer where it is the only one.
   */
  private async ranked(search: string): Promise<readonly string[]> {
    const found = await this.ask<{ boxes?: readonly Listed[] }>(
      `${registry}/search?q=${encodeURIComponent(search)}&provider=qemu&limit=20&sort=downloads&order=desc`,
    );

    return (found.boxes ?? [])
      .filter((box) => Images.qemu(box.current_version?.providers).length > 0)
      .map((box) => box.tag)
      .slice(0, considered);
  }

  /**
   * The newest release of that box built for this architecture, and which architectures it has.
   *
   * The newest release is not always the one to take: a publisher who skipped an architecture in
   * their latest build has not withdrawn the one before it, and a machine can be made from that.
   */
  private async built(
    tag: string,
    version: string | undefined,
    architecture: string,
  ): Promise<{ published?: Published; available: readonly string[] }> {
    const box = await this.ask<{ versions?: readonly Release[] }>(`${registry}/box/${tag}`);
    const releases = (box.versions ?? [])
      .filter((release) => release.status === undefined || release.status === "active")
      .filter((release) => version === undefined || release.version === version);
    const published = releases
      .map((release) => Images.qemu(release.providers, architecture)[0])
      .find((one) => one !== undefined);

    return {
      published,
      available: [...new Set(releases.flatMap((release) => Images.qemu(release.providers).map((one) => one.architecture!)))],
    };
  }

  /** The builds openstrap can boot: a disk image, for this architecture, with a checksum to hold it to. */
  private static qemu(published: readonly Published[] | undefined, architecture?: string): readonly Published[] {
    return (published ?? []).filter((one) =>
      one.name === "qemu"
      && one.architecture !== undefined
      && (architecture === undefined || one.architecture === architecture)
      && (one.download_url === undefined || one.checksum_type === "sha256"));
  }

  /** Splits `owner/name:version` from `name:version`, which the registry writes as one word. */
  private static asked(reference: string): Asked {
    const [named, version] = reference.split(":");
    const name = named ?? "";

    return name.includes("/")
      ? { tag: name, search: name, version }
      // `fedora:38` is the box called `fedora38`: this catalogue puts the release in the name, and
      // asking it for a version of `fedora` would be asking for a version of the box's own build.
      : { search: version === undefined ? name : `${name}${version.replaceAll(".", "")}` };
  }

  /**
   * Which kernel a machine made from this box will run.
   *
   * The registry does not publish it and the name is what there is to go on. openstrap needs it for
   * one thing — which build of itself to deliver there — and everything not named after a kernel of
   * its own is Linux, which is the truth for the overwhelming majority of what is published.
   */
  private static platformOf(tag: string): string {
    const name = tag.split("/").at(-1) ?? tag;
    const kernel = /^(freebsd|openbsd|netbsd|dragonfly|windows|solaris|illumos|haiku|macos)/.exec(name);

    return kernel?.[1] ?? "linux";
  }

  /** Reading the registry's answer, which is all this needs of the network. */
  private async ask<T>(url: string): Promise<T> {
    const answer = await this.fetch(url, { redirect: "follow" });

    if (!answer.ok) {
      throw new Error(`${url} answered ${answer.status}`);
    }

    return answer.json() as Promise<T>;
  }
}
