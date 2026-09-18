import type { ListResult, ListedMachine } from "../../application/ListCommand.js";
import type { CommandText } from "../types.js";
import { Palette } from "./Palette.js";

type Status = ListedMachine["status"];

/** Machines a person can act on first, then the ones only a provider could answer for, then records nothing stands behind. */
const order: readonly Status[] = ["running", "suspended", "stopped", "unknown", "unreachable", "missing"];

export class ListText implements CommandText<ListResult> {
  private static readonly header = ["NAME", "STATUS", "PROVIDER", "IMAGE", "NOTE"];

  constructor(private readonly palette = Palette.plain()) {}

  print(result: ListResult): string {
    if (result.machines.length === 0) {
      return result.from === "server"
        ? "This organization has no machines yet.\n"
        : "No machines have been made on this computer yet.\n"
        + "\nA server would know about machines made anywhere: put its token in the secret store.\n";
    }

    const groups = order
      .map((status) => result.machines.filter((machine) => machine.status === status).sort(ListText.byName))
      .filter((group) => group.length > 0);
    const noted = result.machines.some((machine) => ListText.note(machine) !== "");
    const columns = noted ? ListText.header.length : ListText.header.length - 1;
    const rows = [ListText.header.slice(0, columns), ...groups.flat().map((machine) => ListText.row(machine).slice(0, columns))];
    const widths = ListText.widths(rows);
    const lines = [this.palette.bold(ListText.line(rows[0]!, widths, (cell) => cell))];

    for (const group of groups) {
      if (lines.length > 1) {
        lines.push("");
      }

      for (const machine of group) {
        lines.push(ListText.line(ListText.row(machine).slice(0, columns), widths, (cell, index) => this.paint(machine, index, cell)));
      }
    }

    return `${lines.join("\n")}\n`;
  }

  private paint(machine: ListedMachine, column: number, cell: string): string {
    if (machine.status === "missing") {
      return this.palette.dim(cell);
    }

    if (column === 1) {
      return this.status(machine.status, cell);
    }

    return column === 4 ? this.palette.dim(cell) : cell;
  }

  private status(status: Status, cell: string): string {
    switch (status) {
      case "running":
        return this.palette.green(cell);
      case "stopped":
      case "suspended":
        return this.palette.yellow(cell);
      case "unreachable":
        return this.palette.red(cell);
      case "unknown":
        return this.palette.magenta(cell);
      case "missing":
        return this.palette.dim(cell);
    }
  }

  private static row(machine: ListedMachine): readonly string[] {
    return [
      machine.name,
      machine.status,
      machine.provider ?? "—",
      machine.image?.reference ?? "—",
      ListText.note(machine),
    ];
  }

  private static note(machine: ListedMachine): string {
    return machine.detail ?? (machine.host === undefined ? "" : `on ${machine.host}`);
  }

  private static byName(one: ListedMachine, other: ListedMachine): number {
    return one.name.localeCompare(other.name);
  }

  private static widths(rows: readonly (readonly string[])[]): readonly number[] {
    return rows[0]!.map((_column, index) => Math.max(...rows.map((row) => row[index]!.length)));
  }

  private static line(
    row: readonly string[],
    widths: readonly number[],
    paint: (cell: string, index: number) => string,
  ): string {
    return row
      .map((column, index) => paint(index === row.length - 1 ? column : column.padEnd(widths[index]!), index))
      .join("  ")
      .trimEnd();
  }
}
