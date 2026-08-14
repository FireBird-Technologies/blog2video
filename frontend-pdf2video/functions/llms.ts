/**
 * Cloudflare Pages Function for GET /llms and GET /llms/json.
 *
 * Mirrors api/llms.ts (Vercel) and shares its search module, so whichever host
 * pdf2vid.com is actually served from, the endpoint behaves identically. Only
 * one of the two ever runs; the unused file is inert.
 *
 * Pages routes functions/llms.ts to /llms; the trailing /json variant is handled
 * here rather than in a second file because the logic differs by one boolean.
 */
import handler from "../api/llms";

export const onRequestGet = (context: { request: Request }) => handler(context.request);
