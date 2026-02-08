// Subscription types
export type SubscriptionPlan = "free" | "pro"
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled"

// Assistant types
export interface Assistant {
  id: string
  tenant_id: string
  name: string
  system_prompt: string | null
  model: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
  collection_ids: string[]
}

export interface AssistantCreate {
  name: string
  system_prompt?: string
  model?: string
  settings?: Record<string, unknown>
  collection_ids?: string[]
}

export interface AssistantUpdate {
  name?: string
  system_prompt?: string
  model?: string
  settings?: Record<string, unknown>
  collection_ids?: string[]
}

// Collection types
export interface Collection {
  id: string
  tenant_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  documents_count: number
  total_chunks: number
}

export interface CollectionCreate {
  name: string
  description?: string
}

// Document types
export interface Document {
  id: string
  collection_id: string
  filename: string
  content_type: string
  file_size: number
  status: DocumentStatus
  error_message: string | null
  page_count: number | null
  chunk_count: number | null
  tokens_used: number | null
  created_at: string
  updated_at: string
  processed_at: string | null
}

export type DocumentStatus = "pending" | "processing" | "ready" | "failed"

export interface DocumentUploadResponse {
  id: string
  filename: string
  status: DocumentStatus
  message: string
}

// Chat types
export interface ChatRequest {
  message: string
  conversation_id?: string
  include_history?: boolean
  max_history_messages?: number
}

export interface ChatResponse {
  message: string
  conversation_id: string
  citations: Citation[]
  tokens_input: number
  tokens_output: number
}

export interface Citation {
  chunk_id: string
  document_id: string
  document_filename: string
  page_number: number | null
  excerpt: string
  score: number
}

// Generative UI blocks
export type BlockType = "kpi_cards" | "steps" | "table" | "callout" | "error"

export interface Block {
  id: string
  type: BlockType
  payload: unknown
}

export interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  citations?: Citation[]
  blocks?: Block[]
  created_at: string
}

export interface Conversation {
  id: string
  assistant_id: string
  messages: Message[]
  created_at: string
}

// API Error
export interface ApiError {
  detail: string
  status_code?: number
}
