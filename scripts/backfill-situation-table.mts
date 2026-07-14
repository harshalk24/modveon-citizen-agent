// One-off backfill (Task 2b-C1 — Situation table migration): create one
// Situation row per slug in each existing citizen's active situations
// (lib/situations.ts's getActiveSituations, which already falls back to
// [lifeEvent] when activeLifeEvents is still the pre-2a default). The shared
// slotsJson/entitlementsJson/pendingSlot go to the PRIMARY row (the one whose
// lifeEvent matches the compat CitizenContext.lifeEvent) — other rows get
// defaults, since filling only ever ran for the primary before this migration
// (safe, per the task doc). addedAt is staggered so ordering by addedAt
// ascending always puts the primary last, matching lib/situations.ts's
// existing array convention (last element = primary).
//
// Idempotent — skips any citizen who already has Situation rows, so it's
// safe to re-run.
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
import { getActiveSituations } from "../lib/situations"

async function main() {
  const contexts = await prisma.citizenContext.findMany()
  console.log(`Found ${contexts.length} citizen context(s) to check`)

  let migrated = 0
  let skippedNoSituation = 0
  let skippedAlreadyMigrated = 0

  for (const ctx of contexts) {
    const slugs = getActiveSituations(ctx)
    if (slugs.length === 0) {
      skippedNoSituation++
      continue
    }

    const existing = await prisma.situation.findMany({ where: { citizenId: ctx.citizenId } })
    if (existing.length > 0) {
      console.log(`  skip ${ctx.citizenId} — already has ${existing.length} Situation row(s)`)
      skippedAlreadyMigrated++
      continue
    }

    const primarySlug = ctx.lifeEvent && slugs.includes(ctx.lifeEvent) ? ctx.lifeEvent : slugs[slugs.length - 1]
    const now = new Date()
    for (let i = 0; i < slugs.length; i++) {
      const slug = slugs[i]
      const isPrimary = slug === primarySlug
      // Non-primary rows get strictly-earlier addedAt, by original array
      // position — guarantees primary always sorts last regardless of where
      // it originally sat in the activeLifeEvents array.
      const offsetSeconds = isPrimary ? 0 : (slugs.length - i) * 60
      await prisma.situation.create({
        data: {
          citizenId: ctx.citizenId,
          lifeEvent: slug,
          slotsJson: isPrimary ? ctx.slotsJson : "{}",
          entitlementsJson: isPrimary ? ctx.entitlementsJson : "[]",
          pendingSlot: isPrimary ? ctx.pendingSlot : null,
          status: "active",
          addedAt: new Date(now.getTime() - offsetSeconds * 1000),
        },
      })
    }
    console.log(`  backfilled ${ctx.citizenId} -> [${slugs.join(", ")}] (primary: ${primarySlug})`)
    migrated++
  }

  console.log(`Done. Migrated ${migrated}, skipped ${skippedNoSituation} (no situation), skipped ${skippedAlreadyMigrated} (already migrated).`)
}
main().finally(() => prisma.$disconnect())
