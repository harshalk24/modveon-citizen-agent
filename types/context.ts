export interface EntitlementStatus {
  serviceId: string
  status: "new" | "applied" | "pending" | "received"
  savedAt?: string
}

export interface PlanStep {
  serviceId: string
  serviceName: string
  serviceNameEs: string
  agency: string
  agencyAddress?: string
  phase: number
  documents: string[]
  documentsEs: string[]
  deadline?: string
  deadlineDays?: number
  estimatedTime?: string
  cost?: string
  whatToSayWhenYouArrive?: string
  whatToDoIfProblems?: string
  canDoOnline?: boolean
  onlineUrl?: string | null
  status: "not-started" | "in-progress" | "done"
  completedAt?: string
}

export type Employment = "formal" | "informal" | "unemployed" | "unknown"

// Maps legacy values (from before the formal/informal/unemployed/unknown
// vocabulary) so old DB rows don't silently mismatch KB eligibility.
export function normalizeEmployment(value: string | null | undefined): Employment {
  if (value === "employed") return "formal"
  if (value === "self-employed") return "informal"
  if (value === "formal" || value === "informal" || value === "unemployed") return value
  return "unknown"
}

export interface CitizenContextData {
  citizenId: string
  profile: {
    firstName: string
    country: string
    employment: Employment
    lifeEvent: string
    pendingLifeEvent?: string
    language: "es" | "en"
    email?: string
    whatsappNumber?: string
    gender?: string
    // Explicit-capture only (Task A) — see CitizenContext.municipality.
    municipality?: string
  }
  // Slot-filling (Task S1) — decision-relevant facts gathered for the CURRENT
  // situation only (see lib/slots.ts). Not episodic history.
  slots?: Record<string, string>
  pendingSlot?: string
  entitlements: EntitlementStatus[]
  planSteps: PlanStep[]
  deadlines: {
    serviceId: string
    title: string
    titleEs: string
    dueDate: string
    completed: boolean
    reminded30: boolean
    reminded7: boolean
    reminded1: boolean
  }[]
  conversationSummary?: string
  lastUpdated: string
  planUpdatedAt?: string
  planLifeEvent?: string
}
