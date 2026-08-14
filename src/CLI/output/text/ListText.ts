import type { ListResult, ListedMachine } from "../../application/ListCommand.js";
import type { CommandText } from "../types.js";

/** Every machine on one line each, with the columns wide enough for what is actually in them. */
export class ListText implements CommandText<ListResult> {
  print(result: ListResult): string {
    if (result.machines.length === 0) {
      return result.from === "server"
        ? "This organization has no machines yet.\n"
        : "No machines have been made on this computer yet.\n"
        + "\nA server would know about machines made anywhere: set OPENSTRAP_SERVER_URL.\n";
    }

    const rows = result.machines.map(ListText.row);
    const widths = ListText.widths(rows);

    return `${rows.map((row) => ListText.line(row, widths)).join("\n")}\n`;
  }

  private static row(machine: ListedMachine): readonly string[] {
    return [
      machine.name,
      machine.status,
      machine.provider ?? "—",
      machine.image?.reference ?? "—",
      // What openstrap can say beyond the status, which is the whole reason a status can be a word
      // like `unreachable` without leaving a person to guess at it.
      machine.detail ?? (machine.host === undefined ? "" : `on ${machine.host}`),
    ];
  }

  private static widths(rows: readonly (readonly string[])[]): readonly number[] {
    return rows[0]!.map((_column, index) => Math.max(...rows.map((row) => row[index]!.length)));
  }

  /** The last column is not padded: nothing follows it, and trailing spaces are noise in a pipe. */
  private static line(row: readonly string[], widths: readonly number[]): string {
    return row
      .map((column, index) => (index === row.length - 1 ? column : column.padEnd(widths[index]!)))
      .join("  ")
      .trimEnd();
  }
}
