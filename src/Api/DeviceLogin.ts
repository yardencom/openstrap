import { ServerRefusedError } from "./errors/ServerRefusedError.js";
import { ServerUnreachableError } from "./errors/ServerUnreachableError.js";

/** What the provider answers when asked to start a sign-in for something with no browser. */
type Started = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  interval?: number;
  expires_in?: number;
};

type Answered = { id_token?: string; access_token?: string; error?: string };

/** What openstrap tells a person while it waits for them. */
export type Code = { userCode: string; url: string; expiresIn: number };

/**
 * Signing in on a machine that cannot show a login page.
 *
 * A command line has no browser, and a person should not be pasting tokens into one either — so the
 * provider is asked to start a sign-in, prints a short code and where to type it, and openstrap
 * waits until the person has. This is the device authorization grant, which is what every tool that
 * signs a person in from a terminal uses, and the reason none of them ask for a password.
 *
 * openstrap keeps nothing of what comes back: what a person signs in with is theirs, and it is
 * traded straight away for a token of this machine's own.
 */
export class DeviceLogin {
  constructor(private readonly fetch = globalThis.fetch) {}

  /**
   * Asks the provider to start, and answers with the code to show a person.
   *
   * `openstrap` is the client this asks as. A provider that has not heard of it refuses, which is
   * an installation that has not been set up rather than a person who typed something wrong.
   */
  async begin(issuer: string, audience: string): Promise<{ code: Code; waiting: Promise<string> }> {
    const endpoints = await this.discover(issuer);
    const started = await this.form<Started>(endpoints.device, {
      client_id: "openstrap",
      scope: "openid profile",
      audience,
    });

    return {
      code: {
        userCode: started.user_code,
        url: started.verification_uri_complete ?? started.verification_uri,
        expiresIn: started.expires_in ?? 600,
      },
      waiting: this.until(endpoints.token, started),
    };
  }

  /** Where this provider does the two things a device sign-in needs. */
  private async discover(issuer: string): Promise<{ device: string; token: string }> {
    const known = await this.json<{ device_authorization_endpoint?: string; token_endpoint?: string }>(
      `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
    );

    if (!known.device_authorization_endpoint || !known.token_endpoint) {
      throw new Error(
        `${issuer} does not offer a device sign-in, so there is no way to sign in from a command line here.`,
      );
    }

    return { device: known.device_authorization_endpoint, token: known.token_endpoint };
  }

  /**
   * Waits for the person, at the pace the provider asked for.
   *
   * `authorization_pending` is the provider saying "not yet"; `slow_down` is it saying the asking
   * itself is too much. Anything else is over, one way or the other.
   */
  private async until(endpoint: string, started: Started): Promise<string> {
    let interval = (started.interval ?? 5) * 1000;
    const until = Date.now() + (started.expires_in ?? 600) * 1000;

    while (Date.now() < until) {
      await new Promise((wake) => setTimeout(wake, interval));

      const answer = await this.form<Answered>(endpoint, {
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: started.device_code,
        client_id: "openstrap",
      }, true);

      if (answer.id_token ?? answer.access_token) {
        return (answer.id_token ?? answer.access_token)!;
      }

      if (answer.error === "slow_down") {
        interval += 5000;
      } else if (answer.error !== "authorization_pending") {
        throw new Error(`Signing in did not finish: ${answer.error ?? "the provider said nothing"}`);
      }
    }

    throw new Error("The code expired before it was entered. Run `openstrap login` again.");
  }

  private async form<T>(url: string, fields: Record<string, string>, tolerate = false): Promise<T> {
    const answer = await this.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    }).catch((cause: unknown) => {
      throw new ServerUnreachableError(url, cause);
    });

    // While waiting, a refusal is the provider saying "not yet" and is read rather than thrown.
    if (!answer.ok && !tolerate) {
      throw new ServerRefusedError(answer.status, await answer.text());
    }

    return answer.json() as Promise<T>;
  }

  private async json<T>(url: string): Promise<T> {
    const answer = await this.fetch(url).catch((cause: unknown) => {
      throw new ServerUnreachableError(url, cause);
    });

    if (!answer.ok) {
      throw new ServerRefusedError(answer.status, `${url} answered ${answer.status}`);
    }

    return answer.json() as Promise<T>;
  }
}
