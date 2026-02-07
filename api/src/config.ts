import "dotenv/config";

export interface ApiConfig {
  port: number;
  databaseUrl: string;
  logLevel: "debug" | "info" | "warn" | "error";
}

export function loadConfig(): ApiConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const port = parseInt(process.env.PORT ?? "3000", 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a number between 1 and 65535");
  }

  const logLevel = (process.env.LOG_LEVEL ?? "info") as ApiConfig["logLevel"];
  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    throw new Error("LOG_LEVEL must be one of: debug, info, warn, error");
  }

  return { port, databaseUrl, logLevel };
}
