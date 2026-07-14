// One-off backfill (TASK_MULTICONTEXT Step 1): existing citizens with a
// non-null lifeEvent get activeLifeEvents = [lifeEvent]. Safe to re-run —
// only touches rows where activeLifeEvents is still the default "[]".
import fs from "node:fs"
import path from "node:path"

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return
  for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.replace(/\r$/, "")
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1")
  }
}
loadDotEnvLocal()

import { prisma } from "../lib/prisma"

async function main() {
  const candidates = await prisma.citizenContext.findMany({
    where: { lifeEvent: { not: null }, activeLifeEvents: "[]" },
    select: { id: true, citizenId: true, lifeEvent: true },
  })
  console.log(`Found ${candidates.length} citizen(s) to backfill`)
  for (const c of candidates) {
    await prisma.citizenContext.update({
      where: { id: c.id },
      data: { activeLifeEvents: JSON.stringify([c.lifeEvent]) },
    })
    console.log(`  backfilled ${c.citizenId} -> [${c.lifeEvent}]`)
  }
  console.log("Done.")
}
main().finally(() => prisma.$disconnect())
