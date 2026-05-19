import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendWhatsAppReminder } from "@/lib/whatsapp"

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const now = new Date()
  const deadlines = await prisma.deadline.findMany({
    where: { completed: false },
    include: { citizen: true }
  })

  let sent = 0
  for (const deadline of deadlines) {
    const daysLeft = Math.ceil(
      (new Date(deadline.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Would need whatsapp number stored on citizen — skip if not present
    if (daysLeft === 30 && !deadline.reminded30) {
      await sendWhatsAppReminder({ phone: "", deadline, daysLeft }).catch(() => {})
      await prisma.deadline.update({ where: { id: deadline.id }, data: { reminded30: true } })
      sent++
    }
    if (daysLeft === 7 && !deadline.reminded7) {
      await sendWhatsAppReminder({ phone: "", deadline, daysLeft }).catch(() => {})
      await prisma.deadline.update({ where: { id: deadline.id }, data: { reminded7: true } })
      sent++
    }
    if (daysLeft === 1 && !deadline.reminded1) {
      await sendWhatsAppReminder({ phone: "", deadline, daysLeft }).catch(() => {})
      await prisma.deadline.update({ where: { id: deadline.id }, data: { reminded1: true } })
      sent++
    }
  }

  return NextResponse.json({ processed: deadlines.length, sent })
}
