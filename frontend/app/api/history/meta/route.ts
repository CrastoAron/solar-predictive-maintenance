import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_DIR = path.resolve(process.cwd(), "../model/data");

async function findDirs(dir: string): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const dirs: string[] = [];
  for (const e of entries) {
    if (e.isDirectory()) dirs.push(path.join(dir, e.name));
  }
  return dirs;
}

function parseDateSafe(v: string) {
  const d = new Date(v);
  return isFinite(d.getTime()) ? d.toISOString() : null;
}

export async function GET() {
  try {
    const dirs = await findDirs(DATA_DIR);
    const folders: { name: string; earliest: string | null }[] = [];
    let overallEarliest: string | null = null;

    for (const d of dirs) {
      // look for solar_log.csv or any .csv files inside
      const files = await fs.promises.readdir(d);
      const csvs = files.filter((f) => f.toLowerCase().endsWith(".csv"));
      let folderEarliest: string | null = null;
      for (const f of csvs) {
        const full = path.join(d, f);
        const txt = await fs.promises.readFile(full, "utf8");
        const lines = txt.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) continue;
        const header = lines[0].split(",").map((h) => h.trim());
        const tsIdx = header.findIndex((h) => /date|time|timestamp/i.test(h));
        if (tsIdx === -1) continue;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",");
          const tsRaw = cols[tsIdx]?.trim();
          const iso = parseDateSafe(tsRaw);
          if (!iso) continue;
          if (!folderEarliest || new Date(iso) < new Date(folderEarliest)) folderEarliest = iso;
        }
      }
      folders.push({ name: path.basename(d), earliest: folderEarliest });
      if (folderEarliest && (!overallEarliest || new Date(folderEarliest) < new Date(overallEarliest))) {
        overallEarliest = folderEarliest;
      }
    }

    return NextResponse.json({ folders, earliest: overallEarliest });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
