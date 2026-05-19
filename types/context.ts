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
  week: number
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

export interface CitizenContextData {
  citizenId: string
  profile: {
    firstName: string
    country: string
    employment: string
    lifeEvent: string
    language: "es" | "en"
    email?: string
    whatsappNumber?: string
  }
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
