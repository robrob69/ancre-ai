import { z } from "zod"

// ---------------------------------------------------------------------------
// KPI Cards
// ---------------------------------------------------------------------------
export const kpiCardsSchema = z.object({
  title: z.string().nullish(),
  items: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      delta: z.string().nullish(),
    })
  ),
})
export type KpiCardsPayload = z.infer<typeof kpiCardsSchema>

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
export const stepsSchema = z.object({
  title: z.string().nullish(),
  steps: z.array(
    z.object({
      title: z.string(),
      description: z.string().nullish(),
      status: z.enum(["todo", "doing", "done"]).nullish(),
    })
  ),
})
export type StepsPayload = z.infer<typeof stepsSchema>

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------
export const tableSchema = z.object({
  title: z.string().nullish(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
})
export type TablePayload = z.infer<typeof tableSchema>

// ---------------------------------------------------------------------------
// Callout
// ---------------------------------------------------------------------------
export const calloutSchema = z.object({
  tone: z.enum(["info", "warning", "success", "danger"]),
  title: z.string().nullish(),
  message: z.string(),
})
export type CalloutPayload = z.infer<typeof calloutSchema>

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
export const blockSchemas = {
  kpi_cards: kpiCardsSchema,
  steps: stepsSchema,
  table: tableSchema,
  callout: calloutSchema,
} as const
