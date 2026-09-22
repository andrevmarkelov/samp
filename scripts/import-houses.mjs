import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const sourcePath = "C:/Users/Markelov/Desktop/База данных/houses.sql";
const outputPath = join(process.cwd(), "sql", "houses_seed.sql");

function parseRowFields(line) {
  const trimmed = line.trim().replace(/[;,]$/, "");
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) {
    return null;
  }

  const body = trimmed.slice(1, -1);
  const fields = [];
  let current = "";
  let inString = false;

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];

    if (inString) {
      current += ch;
      if (ch === "'" && body[i - 1] !== "\\") {
        inString = false;
      }
      continue;
    }

    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }

    if (ch === ",") {
      fields.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    fields.push(current.trim());
  }

  return fields.length >= 19 ? fields : null;
}

function parseInsertRows(sql) {
  const valuesIndex = sql.indexOf("VALUES");
  if (valuesIndex < 0) {
    throw new Error("VALUES not found");
  }

  const rows = [];
  for (const line of sql.slice(valuesIndex + 6).split(/\r?\n/)) {
    const fields = parseRowFields(line);
    if (!fields) {
      continue;
    }

    rows.push({
      id: Number(fields[0]),
      entranceX: Number(fields[1]),
      entranceY: Number(fields[2]),
      entranceZ: Number(fields[3]),
      interiorX: Number(fields[4]),
      interiorY: Number(fields[5]),
      interiorZ: Number(fields[6]),
      vehicleX: Number(fields[7]),
      vehicleY: Number(fields[8]),
      vehicleZ: Number(fields[9]),
      vehicleAngle: Number(fields[10]),
      price: Number(fields[12]),
      hasMedkit: Number(fields[13]) ? 1 : 0,
      interiorId: Number(fields[14]),
      isLocked: Number(fields[15]) ? 1 : 0,
      classId: Number(fields[18]),
    });
  }

  return rows;
}

const sql = readFileSync(sourcePath, "utf8");
const rows = parseInsertRows(sql);

if (rows.length === 0) {
  throw new Error("No house rows parsed");
}

rows.sort((a, b) => a.id - b.id);

const values = rows.map((row) =>
  `(${row.id}, NULL, ${row.entranceX}, ${row.entranceY}, ${row.entranceZ}, ${row.interiorX}, ${row.interiorY}, ${row.interiorZ}, ${row.vehicleX}, ${row.vehicleY}, ${row.vehicleZ}, ${row.vehicleAngle}, ${row.price}, ${row.interiorId}, ${row.hasMedkit}, ${row.isLocked}, ${row.classId})`
);

const chunks = [];
for (let i = 0; i < values.length; i += 50) {
  chunks.push(values.slice(i, i + 50).join(",\n"));
}

const seedSql = `INSERT INTO houses (
  id,
  owner_id,
  entrance_x,
  entrance_y,
  entrance_z,
  interior_x,
  interior_y,
  interior_z,
  vehicle_x,
  vehicle_y,
  vehicle_z,
  vehicle_angle,
  price,
  interior_id,
  has_medkit,
  is_locked,
  class_id
) VALUES
${chunks.join(",\n")}
ON DUPLICATE KEY UPDATE
  entrance_x = VALUES(entrance_x),
  entrance_y = VALUES(entrance_y),
  entrance_z = VALUES(entrance_z),
  interior_x = VALUES(interior_x),
  interior_y = VALUES(interior_y),
  interior_z = VALUES(interior_z),
  vehicle_x = VALUES(vehicle_x),
  vehicle_y = VALUES(vehicle_y),
  vehicle_z = VALUES(vehicle_z),
  vehicle_angle = VALUES(vehicle_angle),
  price = VALUES(price),
  interior_id = VALUES(interior_id),
  class_id = VALUES(class_id);
`;

writeFileSync(outputPath, seedSql, "utf8");
console.log(`Parsed ${rows.length} houses (${rows[0].id}..${rows.at(-1).id})`);
console.log(`Written ${outputPath}`);
