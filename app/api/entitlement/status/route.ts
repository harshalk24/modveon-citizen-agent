import { NextResponse } from "next/server"
import { updateEntitlementStatus } from "@/lib/situation-store"

// Task ENTITLEMENT_STATUS — mirrors PATCH /api/plan/step's shape/trust level
// exactly (bare {citizenId, serviceId, ...} body, no ownership header) for
// consistency between the two "mark this thing done" endpoints. See
// updateEntitlementStatus's comment in lib/situation-store.ts for why the
// Dashboard's "Benefits claimed" progress row needed this.
export async function PATCH(req: Request) {
  const { citizenId, serviceId, received } = await req.json()

  if (!citizenId || !serviceId || typeof received !== "boolean") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const found = await updateEntitlementStatus(citizenId, serviceId, received)
  if (!found) return NextResponse.json({ error: "Entitlement not found" }, { status: 404 })

  return NextResponse.json({ ok: true })
}
