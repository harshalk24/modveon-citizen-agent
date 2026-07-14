import { isUnverified, containsHedgeKeyword } from "@/lib/grounding"

// Structural type — works for both full KB `Service[]` and the plan route's
// compactServices, which only carry a subset of Service's fields.
export interface DependencyNode {
  id: string
  dependsOn?: string[]
  blocks?: string[]
  agency?: string
  amount?: string
  deadline?: string
  confidence?: number
  reviewStatus?: "needs_review" | "approved"
  costUncertain?: boolean
}

export interface PlanStep {
  serviceId: string
  cost?: string
  deadline?: string | null
  // Phase 2a: which active situation this step belongs to — attached
  // deterministically in app/api/plan/route.ts from the retrieved service's
  // _situations tag, never asked of the plan-generating LLM.
  situation?: string
  [key: string]: unknown
}

// A phase number is a dependency rank, NOT calendar time — phase 1 is doable
// now, phase 2 depends on something in phase 1 being done, etc. (Task S2).
export interface PlanPhase {
  phase: number
  label: string
  steps: PlanStep[]
}

export interface Plan {
  phases: PlanPhase[]
}

// Build "must come before" edges (id -> set of ids required before it),
// restricted to nodes actually present in `idSet`. A dependsOn/blocks target
// NOT in idSet is treated as already satisfied — it's not part of this batch
// (e.g. filtered out by employment/life-event), so there's nothing to enforce.
function buildEdges(idSet: Set<string>, nodes: DependencyNode[]): Map<string, Set<string>> {
  const edges = new Map<string, Set<string>>()
  const ensure = (id: string) => {
    if (!edges.has(id)) edges.set(id, new Set())
  }
  for (const n of nodes) {
    if (!idSet.has(n.id)) continue
    ensure(n.id)
    for (const dep of n.dependsOn || []) {
      if (idSet.has(dep)) edges.get(n.id)!.add(dep)
    }
    for (const blocked of n.blocks || []) {
      if (idSet.has(blocked)) {
        ensure(blocked)
        edges.get(blocked)!.add(n.id)
      }
    }
  }
  return edges
}

// Corrected topological batching (fixes sequencePlan()'s three bugs — see
// lib/kb.ts comment): no hardcoded phase cap, an out-of-set dependency is
// treated as already satisfied rather than blocking forever, and a genuine
// cycle dumps its stuck members into the current rank instead of dropping them.
export function computeRanks(ids: string[], nodes: DependencyNode[]): Map<string, number> {
  const idSet = new Set(ids)
  const edges = buildEdges(idSet, nodes)
  const rank = new Map<string, number>()
  const done = new Set<string>()
  let remaining = [...ids]
  let r = 0

  while (remaining.length > 0) {
    const ready = remaining.filter(id => {
      const deps = edges.get(id) ?? new Set()
      return Array.from(deps).every(d => done.has(d))
    })
    if (ready.length === 0) {
      // A cycle among what's left — include everything remaining at this
      // rank rather than silently losing services.
      remaining.forEach(id => { rank.set(id, r); done.add(id) })
      break
    }
    ready.forEach(id => { rank.set(id, r); done.add(id) })
    remaining = remaining.filter(id => !done.has(id))
    r++
  }

  return rank
}

// Verifies the LLM-generated plan's actual phase/order assignment respects
// the dependency graph — never trusts the model to have followed the prompt.
// A dependency must land in an earlier phase (or an earlier position within
// the same phase) than the step that depends on it.
export function verifyPlanOrder(plan: Plan, nodes: DependencyNode[]): { ok: boolean; violations: string[] } {
  const stepIds = plan.phases.flatMap(p => p.steps.map(s => s.serviceId))
  const idSet = new Set(stepIds)
  const edges = buildEdges(idSet, nodes)

  const stepPhase = new Map<string, number>()
  const stepPosition = new Map<string, number>()
  plan.phases.forEach(p => p.steps.forEach((s, i) => {
    stepPhase.set(s.serviceId, p.phase)
    stepPosition.set(s.serviceId, i)
  }))

  const violations: string[] = []
  for (const [id, deps] of Array.from(edges)) {
    if (!stepPhase.has(id)) continue
    for (const dep of Array.from(deps)) {
      if (!stepPhase.has(dep)) continue
      const depPhase = stepPhase.get(dep)!
      const ownPhase = stepPhase.get(id)!
      if (depPhase > ownPhase) {
        violations.push(`"${id}" is scheduled in phase ${ownPhase} but depends on "${dep}", which is scheduled later (phase ${depPhase})`)
      } else if (depPhase === ownPhase && stepPosition.get(dep)! > stepPosition.get(id)!) {
        violations.push(`"${id}" is listed before its dependency "${dep}" within the same phase ${ownPhase}`)
      }
    }
  }

  return { ok: violations.length === 0, violations }
}

// Rebuilds `phases` using the correct rank order. Each step's own LLM-authored
// content (title, documents, etc.) is left untouched — only its phase
// placement changes. A phase's original label is reused wherever that phase's
// exact step set is unchanged; otherwise a generic label is generated.
export function reorderPlan(plan: Plan, nodes: DependencyNode[], genericLabel: (phase: number) => string): Plan {
  const stepIds = plan.phases.flatMap(p => p.steps.map(s => s.serviceId))
  const ranks = computeRanks(stepIds, nodes)
  const stepById = new Map<string, PlanStep>()
  plan.phases.forEach(p => p.steps.forEach(s => stepById.set(s.serviceId, s)))

  const rankGroups = new Map<number, string[]>()
  for (const id of stepIds) {
    const r = ranks.get(id) ?? 0
    if (!rankGroups.has(r)) rankGroups.set(r, [])
    rankGroups.get(r)!.push(id)
  }
  const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => a - b)

  const phases: PlanPhase[] = sortedRanks.map((r, i) => {
    const phaseNum = i + 1
    const ids = rankGroups.get(r)!
    const unchanged = plan.phases.find(p => {
      const origIds = p.steps.map(s => s.serviceId)
      return origIds.length === ids.length && origIds.every(id => ids.includes(id))
    })
    return {
      phase: phaseNum,
      label: unchanged ? unchanged.label : genericLabel(phaseNum),
      steps: ids.map(id => stepById.get(id)).filter((s): s is PlanStep => !!s),
    }
  })

  return { phases }
}

// Fix B1: uses lib/grounding.ts's HEDGE_KEYWORDS (via containsHedgeKeyword)
// instead of a hand-copied list — a Spanish hedge ("depende", "puede variar")
// recognized by grounding is now guaranteed to be recognized here too; the
// two layers can't drift apart the way they did before (grounding had terms
// plan-verify was missing).
const hasHedgeText = (text: string) => containsHedgeKeyword(text)

// A step citing a figure from an unverified service must hedge it, consistent
// with the reply-path behavior (Task 5/6) — applied regardless of whether the
// plan came from the LLM as-is, was reordered, regenerated, or fell back.
export function hedgePlanSteps<N extends DependencyNode>(plan: Plan, nodes: N[]): Plan {
  const byId = new Map(nodes.map(n => [n.id, n]))

  return {
    phases: plan.phases.map(p => ({
      ...p,
      steps: p.steps.map(step => {
        const node = byId.get(step.serviceId)
        if (!node || !isUnverified(node)) return step

        const cost = typeof step.cost === "string" && hasHedgeText(step.cost)
          ? step.cost
          : (node.amount ? `${node.amount} (unconfirmed — verify with ${node.agency ?? "the agency"})` : `Cost not confirmed — verify with ${node.agency ?? "the agency"}`)

        const deadline = typeof step.deadline === "string" && !hasHedgeText(step.deadline)
          ? (node.deadline ? `${node.deadline} (unconfirmed — verify with ${node.agency ?? "the agency"})` : step.deadline)
          : step.deadline

        return { ...step, cost, deadline }
      }),
    })),
  }
}

const isFreeClaim = (text: string) => /\bfree\b|\bgratis\b/i.test(text)
const amountDenotesFree = (amount?: string) => !!amount && /\bfree\b|\bgratis\b|\$0(?:\.0+)?\b/i.test(amount)
const extractDollarNumbers = (text: string) =>
  Array.from(text.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)).map(m => m[1].replace(/,/g, ""))
const VARIANCE_WORDS = [
  "varies", "vary", "varía", "depends", "depende", "según", "tier", "domestic", "abroad",
  "confirm", "verify", "unconfirmed", "not confirmed", "no confirmado",
  "aproximadamente", "alrededor de", "puede variar",
]
const hasVarianceLanguage = (text: string) => VARIANCE_WORDS.some(k => text.toLowerCase().includes(k))

// Deterministic cost-assertion enforcement (Task 8) — mirrors verifyPlanOrder's
// "never trust the LLM" stance, but for cost claims. Runs on the LLM plan
// regardless of confidence/reviewStatus: an "approved" entry only vouches for
// the fields it actually has, so a missing `amount` still means no cost
// assertion is backed by anything. Fixes in place rather than just flagging,
// since a plan (unlike a chat reply) has no regenerate-and-recheck loop for
// cost specifically — corrected values always come from the KB, never invented.
export function enforcePlanCosts<N extends DependencyNode>(plan: Plan, nodes: N[]): Plan {
  const byId = new Map(nodes.map(n => [n.id, n]))

  const safeCost = (node: DependencyNode) =>
    node.amount
      ? `${node.amount}${isUnverified(node) ? ` (unconfirmed — verify with ${node.agency ?? "the agency"})` : ""}`
      : `Cost not confirmed — verify with ${node.agency ?? "the agency"}`

  return {
    phases: plan.phases.map(p => ({
      ...p,
      steps: p.steps.map(step => {
        const node = byId.get(step.serviceId)
        const cost = typeof step.cost === "string" ? step.cost : ""
        if (!node || !cost) return step

        if (!node.amount) {
          // No structured cost field at all — no cost claim is backed by
          // anything, "Free" included. Replace unconditionally.
          if (isFreeClaim(cost) || extractDollarNumbers(cost).length > 0) {
            console.warn(`Plan cost enforcement: "${step.serviceId}" asserted a cost ("${cost}") with no backing amount field — replacing with safe phrasing`)
            return { ...step, cost: safeCost(node) }
          }
          return step
        }

        if (isFreeClaim(cost) && !amountDenotesFree(node.amount)) {
          console.warn(`Plan cost enforcement: "${step.serviceId}" claimed "Free" but KB amount is "${node.amount}" — correcting`)
          return { ...step, cost: safeCost(node) }
        }

        const kbNumbers = extractDollarNumbers(node.amount)
        const statedNumbers = extractDollarNumbers(cost)
        if (statedNumbers.some(n => !kbNumbers.includes(n))) {
          console.warn(`Plan cost enforcement: "${step.serviceId}" stated a figure not in KB amount ("${node.amount}") — correcting`)
          return { ...step, cost: safeCost(node) }
        }

        if (node.costUncertain && !hasVarianceLanguage(cost)) {
          console.warn(`Plan cost enforcement: "${step.serviceId}" is cost-uncertain but the stated cost lacks variance language — correcting`)
          return { ...step, cost: safeCost(node) }
        }

        return step
      }),
    })),
  }
}

// Deterministic, dependency-ordered fallback for when generation fails twice.
// Never fabricates a cost or duration — uses the real KB amount/deadline when
// present, an honest "not confirmed" phrase otherwise. Covers every retrieved
// service (not just 3), batched into phases by the corrected topological order.
export function buildSafeFallbackPlan(
  compactServices: (DependencyNode & { name: string; agencyAddress: string; documents: string[] })[],
  language: "en" | "es"
): Plan {
  const isEs = language === "es"
  const ids = compactServices.map(s => s.id)
  const ranks = computeRanks(ids, compactServices)

  const byRank = new Map<number, typeof compactServices>()
  for (const s of compactServices) {
    const r = ranks.get(s.id) ?? 0
    if (!byRank.has(r)) byRank.set(r, [])
    byRank.get(r)!.push(s)
  }
  const sortedRanks = Array.from(byRank.keys()).sort((a, b) => a - b)

  const phases = sortedRanks.map((r, i) => {
    const phaseNum = i + 1
    const steps = byRank.get(r)!.map(s => {
      const unverified = isUnverified(s)
      const costFromKB = s.amount
        ? (unverified ? `${s.amount} (unconfirmed — verify with ${s.agency})` : s.amount)
        : `Cost not confirmed — verify with ${s.agency}`
      const deadline = s.deadline
        ? (unverified ? `${s.deadline} (unconfirmed — verify with ${s.agency})` : s.deadline)
        : null

      return {
        serviceId:              s.id,
        title:                  s.name,
        agency:                 s.agency,
        agencyAddress:          s.agencyAddress,
        deadline,
        estimatedTime:          isEs ? "Tiempo no confirmado — varía según la oficina" : "Time not confirmed — varies by office",
        cost:                   costFromKB,
        documents:              s.documents || [],
        whatToSayWhenYouArrive: isEs ? `Hola, vengo a tramitar ${s.name}.` : `Hi, I'm here to apply for ${s.name}.`,
        whatToDoIfProblems:     isEs ? `Contactá a ${s.agency} directamente en ${s.agencyAddress}` : `Contact ${s.agency} directly at ${s.agencyAddress}`,
        canDoOnline: false,
        onlineUrl:   null,
        why:         isEs ? "Parte de tu plan" : "Part of your plan",
      }
    })
    return {
      phase: phaseNum,
      label: isEs ? `Fase ${phaseNum}` : `Phase ${phaseNum}`,
      steps,
    }
  })

  return { phases }
}
