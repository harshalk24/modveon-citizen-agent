export type WaitingForInput =
  | null
  | "start"            // intro message shown — waiting for user to tap Start
  | "initial"          // first chips: yes-apply / show-benefits
  | "benefits-confirm" // after showing benefits: yes-rnpn / not-now
  | "baby-name"        // text input for baby's name
  | "form-confirm"     // confirm/edit the filled form
  | "next-step"        // post-submission choice chips

export type PreviewMessageType =
  | "user"
  | "assistant"
  | "activity"
  | "doc-retrieved"
  | "doc-request"
  | "form-preview"
  | "status"
  | "confirmation"
  | "whatsapp-mock"

export interface PreviewActivity {
  id: string
  label: string
  status: "waiting" | "running" | "done" | "failed"
  detail?: string
}

export interface PreviewMessage {
  id: string
  type: PreviewMessageType
  content?: string
  activities?: PreviewActivity[]
  isComplete?: boolean
  formFields?: {
    label: string
    value: string
    status: "filled" | "missing" | "optional"
    source?: string
  }[]
  docData?: { key: string; value: string }[]
  docName?: string
  confirmOptions?: { label: string; value: string; primary?: boolean }[]
  whatsappText?: string
}

export type ChipOption = { label: string; value: string; primary?: boolean }
