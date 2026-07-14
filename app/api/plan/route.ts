import { NextResponse } from "next/server"
import { generatePlan } from "@/lib/ai"
import { validatePlanJSON } from "@/lib/validator"
import { verifyPlanOrder, reorderPlan, hedgePlanSteps, enforcePlanCosts, buildSafeFallbackPlan, Plan } from "@/lib/plan-verify"
import { prisma } from "@/lib/prisma"
import { unionServicesForSituations } from "@/lib/situations"
import { ensureSituationRows, slugsOfRows, primaryRow } from "@/lib/situation-store"
import { normalizeEmployment } from "@/types/context"

async function savePlanToDB(
  citizenId: string,
  validatedPlan: { phases: any[] },
  services: any[],
  lifeEvent?: string
) {
  // Store the full { phases: [...] } structure so the plan page gets phase labels
  await prisma.actionPlan.upsert({
    where:  { citizenId },
    create: { citizenId, planJson: JSON.stringify(validatedPlan), lifeEvent: lifeEvent || null },
    update: { planJson: JSON.stringify(validatedPlan), lifeEvent: lifeEvent || null },
  })

  // Create deadline records for steps that have deadlineDays — deadlines only
  // ever come from this real, structured field, never manufactured from phase
  // number (a phase is a dependency rank, not a calendar position).
  for (const phase of validatedPlan.phases) {
    for (const step of phase.steps) {
      const svc = services.find((s: any) => s.id === step.serviceId)
      if (svc?.deadlineDays) {
        const existing = await prisma.deadline.findFirst({
          where: { citizenId, serviceId: step.serviceId },
        })
        if (!existing) {
          await prisma.deadline.create({
            data: {
              citizenId,
              serviceId:   step.serviceId,
              title:       step.title,
              titleEs:     step.title,
              dueDate:     new Date(Date.now() + svc.deadlineDays * 24 * 60 * 60 * 1000),
              serviceName: step.agency,
            },
          })
        }
      }
    }
  }
}

export async function POST(req: Request) {
  const { citizenId, services: bodyServices, profile: bodyProfile, language = "es" } = await req.json()

  // Don't generate plans for anonymous sessions — no place to save them
  if (!citizenId || citizenId === "anonymous") {
    return NextResponse.json({ error: "citizenId required to generate plan" }, { status: 400 })
  }

  // Task 2b-3: the server derives services/profile from the citizen's stored
  // situations — the SAME 2a helpers the client used to call itself
  // (getActiveSituations + unionServicesForSituations) — so a caller can no
  // longer forget to union and silently narrow a multi-situation plan (the
  // straggler bug class from TASK_MULTICONTEXT_STRAGGLERS). Body services/
  // profile are still accepted as a transitional fallback so this can't break
  // a caller not yet migrated to the minimal { citizenId, language } POST.
  let services = bodyServices
  let profile  = bodyProfile
  if (!services || !profile) {
    const citizen = await prisma.citizen.findUnique({ where: { id: citizenId }, include: { context: true } })
    if (!citizen?.context) {
      return NextResponse.json({ error: "no context for citizen" }, { status: 400 })
    }
    const ctx = citizen.context
    // Task 2b-C1: situations/slots now come from Situation rows, not the
    // (now-unused) CitizenContext.activeLifeEvents/slotsJson columns — same
    // lazy-backfill self-healing as the chat route for a citizen whose
    // situation predates row-backing.
    const situationRows = await ensureSituationRows(citizenId, {
      lifeEvent: ctx.lifeEvent,
      slotsJson: ctx.slotsJson,
      entitlementsJson: ctx.entitlementsJson,
      pendingSlot: ctx.pendingSlot,
    })
    const situations = slugsOfRows(situationRows)
    const employment = normalizeEmployment(ctx.employment)
    const slots = JSON.parse(primaryRow(situationRows)?.slotsJson || "{}")
    services = unionServicesForSituations({ country: citizen.country, situations, employment, slots })
    profile = {
      firstName:  citizen.firstName || "there",
      country:    citizen.country,
      employment,
      // Primary (compat) lifeEvent — same "most-recently-added" value 2a
      // already writes; falls back to the last active situation if the
      // column is somehow behind the array.
      lifeEvent:  ctx.lifeEvent || (situations[situations.length - 1] ?? null),
      language,
    }
  }

  if (!services || !profile) {
    return NextResponse.json({ error: "Missing services or profile" }, { status: 400 })
  }

  // Compact services before sending to the LLM — full KB objects are large and
  // inflate the prompt unnecessarily. Keep dependsOn/blocks/amount/confidence/
  // reviewStatus too — needed for order verification and hedging below.
  const compactServices = (services as any[]).map(s => ({
    id:           s.id,
    name:         language === "es" ? (s.nameEs || s.name) : s.name,
    agency:       s.agency,
    agencyAddress: s.sourceUrl || s.applyUrl,
    documents:    language === "es" ? (s.documentsEs || s.documents) : s.documents,
    deadline:     s.deadline  || null,
    deadlineDays: s.deadlineDays || null,
    dependsOn:    s.dependsOn || [],
    blocks:       s.blocks || [],
    amount:       s.amount || undefined,
    confidence:   s.confidence,
    reviewStatus: s.reviewStatus,
    costUncertain: s.costUncertain,
    // Phase 2a: which active situation(s) this service belongs to, if the
    // caller sent a union (lib/situations.ts's unionServicesForSituations).
    // Absent for single-situation callers — attachStepSituations falls back
    // to the primary lifeEvent in that case.
    situations:   s._situations || undefined,
  }))

  // Phase 2a: tag each step with its situation, deterministically — never
  // asked of the plan-generating LLM, which has no reason to know about
  // situation bookkeeping. Falls back to the primary lifeEvent when a
  // service's situations are ambiguous or absent (single-situation citizens).
  function attachStepSituations(p: Plan): Plan {
    return {
      phases: p.phases.map(phase => ({
        ...phase,
        steps: phase.steps.map(step => {
          const svc = compactServices.find((s: any) => s.id === step.serviceId)
          const situation = svc?.situations?.[0] || profile?.lifeEvent || undefined
          return { ...step, situation }
        }),
      })),
    }
  }

  const genericLabel = (phase: number) => language === "es" ? `Fase ${phase}` : `Phase ${phase}`

  // Phase 2a: the union of every situation actually represented in the
  // retrieved services (not just profile.lifeEvent, the compat primary) —
  // told to generatePlan so it builds ONE plan covering all of them.
  const allSituations = Array.from(new Set(compactServices.flatMap((s: any) => s.situations || [])))
  const planSituations = allSituations.length > 0 ? allSituations : (profile?.lifeEvent ? [profile.lifeEvent] : [])

  try {
    let plan: Plan | null = null

    const result = await generatePlan({ services: compactServices, profile, language, situations: planSituations })
    console.log("Plan generated, validating...")
    const validation = validatePlanJSON(JSON.stringify(result))
    console.log("Plan validation:", validation.valid ? "OK" : validation.error)

    if (!validation.valid) {
      console.log("Plan invalid, retrying...")
      const retry = await generatePlan({ services: compactServices, profile, language, situations: planSituations })
      const retryValidation = validatePlanJSON(JSON.stringify(retry))
      console.log("Plan retry validation:", retryValidation.valid ? "OK" : retryValidation.error)

      if (retryValidation.valid) plan = retryValidation.parsed
    } else {
      plan = validation.parsed
    }

    if (!plan) {
      // Both JSON-validity attempts failed — safe, ordered, non-fabricated fallback.
      console.warn("Plan generation failed JSON validation twice — using safe fallback")
      const fallback = buildSafeFallbackPlan(compactServices, language as "en" | "es")
      const hedged = attachStepSituations(hedgePlanSteps(enforcePlanCosts(fallback, compactServices), compactServices))
      await savePlanToDB(citizenId, hedged, compactServices, profile?.lifeEvent)
      return NextResponse.json(hedged)
    }

    // Phase 2a completeness check — never trusted to the model just because
    // the prompt said to cover every situation. With several concurrent
    // situations (many services at once), the model has been observed to
    // quietly build a plan around only one of them and drop the rest, even
    // though every service was in its input. Verify deterministically and
    // regenerate once with the gap named, same "Task-6 pattern" as the
    // dependency-order check below; fall back to the always-complete
    // deterministic builder if it's still incomplete after that.
    const missingIds = (ids: string[]) => {
      const covered = new Set(plan!.phases.flatMap(p => p.steps.map(s => s.serviceId)))
      return ids.filter(id => !covered.has(id))
    }
    let missing = missingIds(compactServices.map((s: any) => s.id))
    if (missing.length > 0) {
      console.warn("Plan dropped services despite receiving them:", missing, "— regenerating once")
      const regen = await generatePlan({
        services: compactServices,
        profile,
        language,
        situations: planSituations,
        feedback: `Your previous plan completely omitted these service IDs even though they were provided: ${JSON.stringify(missing)}. Every service in "Services" must appear as a step somewhere in the plan — add steps for these missing ones (in whichever phase fits their dependencies) without removing any of the steps you already included.`,
      })
      const regenValidation = validatePlanJSON(JSON.stringify(regen))
      if (regenValidation.valid) {
        plan = regenValidation.parsed as Plan
        missing = missingIds(compactServices.map((s: any) => s.id))
      }
      if (missing.length > 0) {
        console.warn("Plan still incomplete after regeneration — using safe fallback")
        plan = buildSafeFallbackPlan(compactServices, language as "en" | "es")
      }
    }

    // Dependency order is deterministically enforced — never trusted to the
    // model just because the prompt said "put dependencies in earlier phases".
    let orderCheck = verifyPlanOrder(plan, compactServices)
    if (!orderCheck.ok) {
      console.warn("Plan order violated:", orderCheck.violations)
      const reordered = reorderPlan(plan, compactServices, genericLabel)
      const reorderedCheck = verifyPlanOrder(reordered, compactServices)

      if (reorderedCheck.ok) {
        console.log("Plan order fixed via deterministic reorder")
        plan = reordered
      } else {
        // Only reachable with a genuine cycle among the retrieved services —
        // regenerate once with the violations fed back, per the Task-6 pattern.
        console.warn("Deterministic reorder could not resolve the graph — regenerating once")
        const regen = await generatePlan({
          services: compactServices,
          profile,
          language,
          situations: planSituations,
          feedback: `Your previous plan violated these dependencies: ${JSON.stringify(orderCheck.violations)}. Reorder the steps so every dependency appears in an earlier (or same, earlier-listed) phase than the step that depends on it.`,
        })
        const regenValidation = validatePlanJSON(JSON.stringify(regen))
        const regenPlan = regenValidation.valid ? (regenValidation.parsed as Plan) : null
        const regenOrderCheck = regenPlan ? verifyPlanOrder(regenPlan, compactServices) : { ok: false, violations: [] }

        if (regenPlan && regenOrderCheck.ok) {
          plan = regenPlan
        } else {
          console.warn("Regeneration still violates order — using safe fallback")
          plan = buildSafeFallbackPlan(compactServices, language as "en" | "es")
        }
      }
    }

    // Cost enforcement and unverified-figure hedging apply regardless of which
    // path produced the final plan — order-correctness, cost-backing, and
    // fact-hedging are orthogonal checks. Cost enforcement runs first so its
    // corrected values are what hedging (deadline hedging, mainly) sees.
    plan = attachStepSituations(hedgePlanSteps(enforcePlanCosts(plan, compactServices), compactServices))

    await savePlanToDB(citizenId, plan, compactServices, profile?.lifeEvent)
    return NextResponse.json(plan)
  } catch (err: any) {
    console.error("Plan generation error:", err)
    // Return the actual error message so the client can surface it for debugging
    return NextResponse.json(
      { error: "Plan generation failed", detail: err?.message ?? String(err) },
      { status: 500 }
    )
  }
}
