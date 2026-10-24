import { createServer } from "node:http";
import { loadEnv } from "vite";
import type { VercelRequest, VercelResponse } from "../server/types";
import { extractAndReply } from "../server/ai";
import { isSensitiveText, isHealthText } from "../shared/safety";
import { chatInput } from "../shared/contracts";
import { sourceReply } from "../shared/health";
Object.assign(process.env, loadEnv("development", process.cwd(), ""));
const routes = [
  "chat",
  "transcribe",
  "journeys",
  "events",
  "health-context",
  "nearby",
  "conversations",
  "privacy",
  "status",
  "onboarding",
  "photo",
  "preview-chat",
];
createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost:3001");
  const name = url.pathname.replace("/api/", "");
  if (!routes.includes(name)) {
    res.writeHead(404);
    res.end();
    return;
  }
  let length = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 4400000) {
      res.writeHead(413);
      res.end(JSON.stringify({ error: { message: "Request too large." } }));
      return;
    }
    chunks.push(chunk);
  }
  const request = Object.assign(req, {
    query: Object.fromEntries(url.searchParams),
    body: Buffer.concat(chunks).toString() || undefined,
  });
  const response = Object.assign(res, {
    status(code: number) {
      res.statusCode = code;
      return response;
    },
    json(data: unknown) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
      return response;
    },
  });
  try {
    if (name === "preview-chat") {
      // Loopback development only; never part of the deployed API routes.
      const origin = req.headers.origin;
      if (
        req.method !== "POST" ||
        !origin ||
        !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
      ) {
        res.writeHead(403);
        res.end();
        return;
      }
      const input = chatInput.parse(JSON.parse(request.body || "{}"));
      if (isSensitiveText(input.text) || isHealthText(input.text)) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            error: {
              message:
                "Use curated health information for private messages in local preview.",
            },
          }),
        );
        return;
      }
      const result = await extractAndReply(input.text, {
        destination: null,
        journey: null,
        timezone: input.timezone,
        now: new Date().toISOString(),
        recent: [],
        messages: [],
      });
      response.json(
        result.intent === "health" || isHealthText(result.reply)
          ? sourceReply(input.text)
          : { reply: result.reply, intent: result.intent },
      );
      return;
    }
    const module = await import(`../api/${name}.ts`);
    await module.default(
      request as VercelRequest,
      response as unknown as VercelResponse,
    );
  } catch {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: { message: "Local service could not complete the request." },
      }),
    );
  }
}).listen(Number(process.env.LOCAL_API_PORT || 3001), "127.0.0.1", () =>
  console.log("LINC-33 local API ready"),
);
