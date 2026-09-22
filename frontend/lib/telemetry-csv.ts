export interface TelemetryRow {
  timestamp: string;
  voltage: number;
  current: number;
  power: number;
  lux: number;
  temperature: number;
  humidity: number;
}

let cachedRows: TelemetryRow[] | null = null;

export async function getTelemetryRows(): Promise<TelemetryRow[]> {
  if (cachedRows) return cachedRows;

  const response = await fetch("/data/cleaned_real_telemetry.csv");
  if (!response.ok) throw new Error("Telemetry CSV could not be loaded");

  const lines = (await response.text()).trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  const column = (name: string) => headers.indexOf(name);

  cachedRows = lines.slice(1).flatMap((line) => {
    const values = line.split(",");
    const timestamp = values[column("timestamp")];
    const power = Number(values[column("power")]);
    if (!timestamp || !Number.isFinite(power)) return [];

    return [{
      timestamp,
      voltage: Number(values[column("voltage")]),
      current: Number(values[column("current")]),
      power,
      lux: Number(values[column("lux")]),
      temperature: Number(values[column("temperature")]),
      humidity: Number(values[column("humidity")]),
    }];
  });

  return cachedRows;
}