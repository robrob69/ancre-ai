/**
 * CopilotKit Runtime - Minimal self-hosted runtime for Ancre.
 *
 * This Express server hosts the CopilotKit runtime which orchestrates
 * LLM calls and tool/action execution for the CopilotKit frontend.
 *
 * Architecture decision:
 *   CopilotKit requires a Node.js runtime to handle its protocol.
 *   We keep this as a thin orchestrator - heavy business logic stays
 *   in our FastAPI backend, invoked as "remote actions" by the runtime.
 */

import express from "express";
import cors from "cors";
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from "@copilotkit/runtime";

const app = express();
const PORT = parseInt(process.env.COPILOT_RUNTIME_PORT || "4000", 10);

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", service: "copilot-runtime" });
});

// CopilotKit runtime endpoint
app.use("/copilotkit", (req, res, next) => {
  const runtime = new CopilotRuntime({
    // Remote actions can point back to our FastAPI backend
    // This is where we'd add remote endpoints for backend-driven actions
    remoteActions: [
      {
        url: process.env.BACKEND_ACTIONS_URL || "http://localhost:8000/api/v1/copilotkit/actions",
      },
    ],
  });

  const handler = copilotRuntimeNodeHttpEndpoint({
    endpoint: "/copilotkit",
    runtime,
    serviceAdapter: new OpenAIAdapter({
      model: process.env.COPILOT_LLM_MODEL || "gpt-4o-mini",
    }),
  });

  return handler(req, res, next);
});

app.listen(PORT, () => {
  console.log(`🤖 CopilotKit Runtime running on http://localhost:${PORT}`);
  console.log(`   Runtime endpoint: http://localhost:${PORT}/copilotkit`);
});
