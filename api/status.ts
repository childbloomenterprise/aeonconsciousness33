import type { VercelRequest, VercelResponse } from "../server/types.js";
export default function status(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    auth: !!(
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
      (process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY)
    ),
    ai: !!(
      process.env.NVIDIA_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.OPENROUTER_API_KEY
    ),
    nvidia: !!process.env.NVIDIA_API_KEY,
    voice_ai:
      !!process.env.GROQ_API_KEY ||
      (!!process.env.GEMINI_API_KEY &&
        process.env.GEMINI_SENSITIVE_PROCESSING_ENABLED === "true"),
    private_ai:
      !!process.env.GEMINI_API_KEY &&
      process.env.GEMINI_SENSITIVE_PROCESSING_ENABLED === "true",
    nearby: !!process.env.GOOGLE_MAPS_SERVER_KEY,
    // Demonstration points are restricted to the local design preview.
    nearby_demo: false,
    account_deletion: !!process.env.SUPABASE_SECRET_KEY,
  });
}
