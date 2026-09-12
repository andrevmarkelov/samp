export type MapMaterial = {
  index: number;
  model: number;
  txd: string;
  texture: string;
  color: number;
};

export type MapMaterialText = {
  text: string;
  index: number;
  size: number;
  font: string;
  fontSize: number;
  bold: boolean;
  fontColor: number;
  backColor: number;
  alignment: number;
};

export type MapObjectDef = {
  model: number;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  materials: MapMaterial[];
  texts: MapMaterialText[];
};

export type MapBuildingRemove = {
  model: number;
  x: number;
  y: number;
  z: number;
  radius: number;
};

export type ParsedMap = {
  objects: MapObjectDef[];
  removals: MapBuildingRemove[];
};

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

function toU32(value: string | number): number {
  const n = num(value);
  if (!Number.isFinite(n)) {
    return 0xffffffff;
  }

  return n >>> 0;
}

export function parsePawnMap(source: string): ParsedMap {
  const objects: MapObjectDef[] = [];
  const removals: MapBuildingRemove[] = [];
  let last: MapObjectDef | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//") || line.startsWith("new ")) {
      continue;
    }

    const remove = line.match(/^RemoveBuildingForPlayer\s*\((.*)\)\s*;?\s*$/i);
    if (remove) {
      const args = parseArgs(remove[1]);
      if (args.length >= 6) {
        removals.push({
          model: num(args[1]),
          x: num(args[2]),
          y: num(args[3]),
          z: num(args[4]),
          radius: num(args[5]),
        });
      }
      continue;
    }

    const create = line.match(
      /^(?:\w+\s*=\s*)?(CreateDynamicObject|CreateObject)\s*\((.*)\)\s*;?\s*$/i
    );
    if (create) {
      const args = parseArgs(create[2]);
      if (args.length < 7) {
        last = null;
        continue;
      }

      last = {
        model: num(args[0]),
        x: num(args[1]),
        y: num(args[2]),
        z: num(args[3]),
        rx: num(args[4]),
        ry: num(args[5]),
        rz: num(args[6]),
        materials: [],
        texts: [],
      };
      objects.push(last);
      continue;
    }

    const materialText = line.match(
      /^Set(?:Dynamic)?ObjectMaterialText\s*\((.*)\)\s*;?\s*$/i
    );
    if (materialText && last) {
      const args = parseArgs(materialText[1]);
      if (args.length >= 10) {
        last.texts.push({
          text: String(args[2]),
          index: num(args[1]),
          size: num(args[3]),
          font: String(args[4]),
          fontSize: num(args[5]),
          bold: num(args[6]) !== 0,
          fontColor: toU32(args[7]),
          backColor: toU32(args[8]),
          alignment: num(args[9]),
        });
      }
      continue;
    }

    const material = line.match(
      /^Set(?:Dynamic)?ObjectMaterial\s*\((.*)\)\s*;?\s*$/i
    );
    if (material && last) {
      const args = parseArgs(material[1]);
      if (args.length >= 6) {
        last.materials.push({
          index: num(args[1]),
          model: num(args[2]),
          txd: String(args[3]),
          texture: String(args[4]),
          color: toU32(args[5]),
        });
      }
    }
  }

  return { objects, removals };
}
