/** Cloudflare Pages Function for GET /llms/json — see ../llms.ts. */
import handler from "../../api/llms";

export const onRequestGet = (context: { request: Request }) => handler(context.request);
