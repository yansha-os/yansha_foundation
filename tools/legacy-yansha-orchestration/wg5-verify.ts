import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config();
config({ path: ".env.local", override: true });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const rows = await sql`SELECT count(*)::int AS n FROM circle_members WHERE 'salah' = ANY("sharedTelemetry")`;
  const rls = await sql`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('circles','circle_members','circle_assignments')`;
  const def = await sql`SELECT column_default FROM information_schema.columns WHERE table_name = 'circle_members' AND column_name = 'sharedTelemetry'`;

  console.log("rows_with_salah:", JSON.stringify(rows));
  console.log("rls:", JSON.stringify(rls));
  console.log("default:", JSON.stringify(def));
}

main();
