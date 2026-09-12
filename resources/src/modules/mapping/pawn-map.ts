import { ObjectMp } from "@omp-node/core";

const DRAW_DISTANCE = 300;

function parseArgs(inner: string): Array<string | number> {
  const args: Array<string | number> = [];
  let i = 0;

  while (i < inner.length) {
    while (i < inner.length && /[\s,]/.test(inner[i])) {
      i++;
    }

    if (i >= inner.length) {
      break;
    }

    if (inner[i] === '"') {
      i++;
      let value = "";
      while (i < inner.length && inner[i] !== '"') {
        if (inner[i] === "\\" && i + 1 < inner.length) {
          const next = inner[i + 1];
          value += next === "n" ? "\n" : next;
          i += 2;
          continue;
        }

        value += inner[i];
        i++;
      }
      i++;
      args.push(value);
      continue;
    }

    const start = i;
    while (i < inner.length && inner[i] !== ",") {
      i++;
    }
    const raw = inner.slice(start, i).trim();
    if (raw.length > 0) {
      args.push(Number(raw));
    }
  }

  return args;
}

function num(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

export function loadPawnMap(source: string): number {
  let created = 0;
  let last: ObjectMp | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//") || line.startsWith("new ")) {
      continue;
    }

    const create = line.match(
      /^(?:\w+\s*=\s*)?(CreateDynamicObject|CreateObject)\s*\((.*)\)\s*;?\s*$/i
    );
    if (create) {
      const args = parseArgs(create[2]);
      if (args.length < 7) {
        continue;
      }

      try {
        last = new ObjectMp(
          num(args[0]),
          num(args[1]),
          num(args[2]),
          num(args[3]),
          num(args[4]),
          num(args[5]),
          num(args[6]),
          DRAW_DISTANCE
        );
        created++;
      } catch {
        last = null;
      }
      continue;
    }

    const materialText = line.match(
      /^Set(?:Dynamic)?ObjectMaterialText\s*\((.*)\)\s*;?\s*$/i
    );
    if (materialText && last) {
      const args = parseArgs(materialText[1]);
      if (args.length >= 10) {
        last.setMaterialText(
          String(args[2]),
          num(args[1]),
          num(args[3]),
          String(args[4]),
          num(args[5]),
          num(args[6]) !== 0,
          num(args[7]),
          num(args[8]),
          num(args[9])
        );
      }
      continue;
    }

    const material = line.match(
      /^Set(?:Dynamic)?ObjectMaterial\s*\((.*)\)\s*;?\s*$/i
    );
    if (material && last) {
      const args = parseArgs(material[1]);
      if (args.length >= 6) {
        last.setMaterial(
          num(args[1]),
          num(args[2]),
          String(args[3]),
          String(args[4]),
          num(args[5])
        );
      }
    }
  }

  return created;
}
