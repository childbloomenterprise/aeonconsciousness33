import type { IncomingMessage, ServerResponse } from "node:http";
/** Minimal documented Node-function HTTP surface; avoids a build-tool runtime dependency. */
export type VercelRequest = IncomingMessage & {
  body?: unknown;
  query: Record<string, string | string[] | undefined>;
};
export type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => VercelResponse;
};
