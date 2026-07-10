import { NextResponse } from "next/server"
import { generatePlan } from "@/lib/ai"
import { validatePlanJSON } from "@/lib/validator"
import { verifyPlanOrder, reorderPlan, hedgePlanSteps, enforcePlanCosts, buildSafeFallbackPlan, Plan } from "@/lib/plan-verify"
import { prisma } from "@/lib/prisma"

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
  const { citizenId, services, profile, language = "es" } = await req.json()

  if (!services || !profile) {
    return NextResponse.json({ error: "Missing services or profile" }, { status: 400 })
  }

  // Don't generate plans for anonymous sessions — no place to save them
  if (!citizenId || citizenId === "anonymous") {
    return NextResponse.json({ error: "citizenId required to generate plan" }, { status: 400 })
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
  }))

  const genericLabel = (phase: number) => language === "es" ? `Fase ${phase}` : `Phase ${phase}`

  try {
    let plan: Plan | null = null

    const result = await generatePlan({ services: compactServices, profile, language })
    console.log("Plan generated, validating...")
    const validation = validatePlanJSON(JSON.stringify(result))
    console.log("Plan validation:", validation.valid ? "OK" : validation.error)

    if (!validation.valid) {
      console.log("Plan invalid, retrying...")
      const retry = await generatePlan({ services: compactServices, profile, language })
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
      const hedged = hedgePlanSteps(enforcePlanCosts(fallback, compactServices), compactServices)
      await savePlanToDB(citizenId, hedged, compactServices, profile?.lifeEvent)
      return NextResponse.json(hedged)
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
    plan = hedgePlanSteps(enforcePlanCosts(plan, compactServices), compactServices)

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
