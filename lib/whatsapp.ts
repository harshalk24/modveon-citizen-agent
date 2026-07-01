import twilio from "twilio"

let _client: ReturnType<typeof twilio> | null = null

function getClient() {
  if (!_client) {
    _client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  }
  return _client
}

function getFrom() {
  return process.env.TWILIO_WHATSAPP_FROM!
}

export async function sendWhatsAppReminder(params: {
  phone: string
  deadline: { title: string; titleEs?: string }
  daysLeft: number
}) {
  if (!params.phone) return
  const message = `
*Citizen Agent* — Deadline reminder

*${params.daysLeft} days* left for: *${params.deadline.title}*

Did you complete it? Reply *Yes* to mark as done, or *No* to remind you in 3 days.

More info: citizen-assist.sv/plan
`.trim()

  await getClient().messages.create({
    from: `whatsapp:${getFrom()}`,
    to: `whatsapp:${params.phone}`,
    body: message,
  })
}

export async function sendWhatsAppMessage(phone: string, text: string) {
  await getClient().messages.create({
    from: `whatsapp:${getFrom()}`,
    to: `whatsapp:${phone}`,
    body: text,
  })
}
