import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_DIR = path.resolve(process.cwd(), "../model/data");

async function findSolarLogFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...(await findSolarLogFiles(full)));
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".csv")) {
      results.push(full);
    }
  }
  return results;
}

function parseFloatSafe(v: string) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const field = url.searchParams.get("field");

    if (!start || !end || !field) {
      return NextResponse.json({ error: "start, end and field are required" }, { status: 400 });
    }

    const startTs = new Date(start).getTime();
    const endTs = new Date(end).getTime();
    if (!isFinite(startTs) || !isFinite(endTs)) {
      return NextResponse.json({ error: "invalid start or end" }, { status: 400 });
    }

    const files = await findSolarLogFiles(DATA_DIR);
    const points: { timestamp: string; value: number }[] = [];

    for (const file of files) {
      const txt = await fs.promises.readFile(file, "utf8");
      const lines = txt.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) continue;
      const header = lines[0].split(",").map((h) => h.trim());
      const tsIdx = header.findIndex((h) => h.toLowerCase().startsWith("timestamp"));
      const voltageIdx = header.findIndex((h) => /volt/i.test(h));
      const currentIdx = header.findIndex((h) => /curr/i.test(h));
      const tempIdx = header.findIndex((h) => /temp/i.test(h));
      const humIdx = header.findIndex((h) => /humid/i.test(h));
      const luxIdx = header.findIndex((h) => /lux/i.test(h));

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        const tsRaw = cols[tsIdx]?.trim();
        if (!tsRaw) continue;
        const ts = new Date(tsRaw);
        if (!isFinite(ts.getTime())) continue;
        const t = ts.getTime();
        if (t < startTs || t > endTs) continue;

        let value = NaN;
        switch (field) {
          case "voltage":
            value = parseFloatSafe(cols[voltageIdx]);
            break;
          case "current":
            value = parseFloatSafe(cols[currentIdx]);
            break;
          case "temperature":
            value = parseFloatSafe(cols[tempIdx]);
            break;
          case "humidity":
            value = parseFloatSafe(cols[humIdx]);
            break;
          case "lux":
            value = parseFloatSafe(cols[luxIdx]);
            break;
          case "power":
            const v = parseFloatSafe(cols[voltageIdx]);
            const c = parseFloatSafe(cols[currentIdx]);
            if (Number.isFinite(v) && Number.isFinite(c)) value = v * c;
            break;
          default:
            return NextResponse.json({ error: `unsupported field: ${field}` }, { status: 400 });
        }

        if (Number.isFinite(value)) {
          points.push({ timestamp: ts.toISOString(), value });
        }
      }
    }

    points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return NextResponse.json({ field, data: points });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
