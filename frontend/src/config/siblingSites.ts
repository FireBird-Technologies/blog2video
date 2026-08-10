/**
 * The other two properties in this family, and how to link to them.
 *
 * pdf2vid.com is the same engine with a document as its input (see
 * ../brand/brand.ts — it is a brand of this same build, plus the standalone
 * marketing deployment in ../../../frontend-pdf2video). bloghub.app is the
 * newsletter and blog directory that feeds both.
 *
 * All three sites link to each other, and every outbound link is UTM-tagged so
 * the receiving domain can attribute the referral: in GA, Acquisition →
 * Traffic acquisition, broken down by utm_content to see which surface here
 * sent the visitor. ../lib/blog2video.ts is the mirror of this file on
 * bloghub.app.
 */

export const PDF2VID_URL = "https://pdf2vid.com";
export const BLOGHUB_URL = "https://bloghub.app";

function withUtm(base: string, content: string, campaign: string): string {
  const params = new URLSearchParams({
    utm_source: "blog2video",
    utm_medium: "referral",
    utm_campaign: campaign,
    utm_content: content,
  });
  return `${base}?${params.toString()}`;
}

/** `content` names the surface, e.g. "footer" or "landing_directories". */
export function pdf2vidUrl(content: string): string {
  return withUtm(PDF2VID_URL, content, "pdf2vid");
}

export function bloghubUrl(content: string): string {
  return withUtm(BLOGHUB_URL, content, "bloghub");
}
