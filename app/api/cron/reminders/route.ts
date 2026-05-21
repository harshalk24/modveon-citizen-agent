import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendWhatsAppReminder, sendWhatsAppMessage } from "@/lib/whatsapp"

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

    // D+1 follow-up — fires the day after deadline passed, only if D-1 reminder was sent
    if (daysLeft === -1 && deadline.reminded1 && !deadline.completed) {
      const phone = (deadline.citizen as any)?.profile?.whatsappNumber ||
                    (deadline.citizen as any)?.whatsappNumber
      if (phone) {
        const isEs = (deadline.citizen as any)?.language !== "en"
        const name = (deadline.citizen as any)?.firstName || ""
        const msg = isEs
          ? `Hola ${name} 👋 ¿Pudiste completar "${deadline.titleEs}" ayer?\n\nRespondé:\n✅ *Sí, listo*\n❓ *Tuve problemas*\n📅 *No pude ir todavía*`
          : `Hi ${name} 👋 Were you able to complete "${deadline.title}" yesterday?\n\nReply:\n✅ *Yes, done*\n❓ *Had problems*\n📅 *Couldn't make it yet*`
        await sendWhatsAppMessage(phone, msg).catch(() => {})
        sent++
      }
    }
  }

  return NextResponse.json({ processed: deadlines.length, sent })
}
