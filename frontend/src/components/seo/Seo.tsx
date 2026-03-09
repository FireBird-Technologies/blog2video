import { useEffect } from "react";
import { defaultOgImage, siteName, siteUrl } from "../../content/siteContent";

type SchemaValue = Record<string, unknown> | Record<string, unknown>[];

interface SeoProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  noindex?: boolean;
  schema?: SchemaValue;
}

export default function Seo({
  title,
  description,
  path,
  image = defaultOgImage,
  noindex = false,
  schema,
}: SeoProps) {
  const canonicalUrl = `${siteUrl}${path}`;
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.title = fullTitle;

    const upsertMeta = (
      selector: string,
      attributeName: string,
      attributeValue: string,
      content: string
    ) => {
      let node = document.head.querySelector<HTMLMetaElement>(selector);
      if (!node) {
        node = document.createElement("meta");
        node.setAttribute(attributeName, attributeValue);
        document.head.appendChild(node);
      }
      node.setAttribute("content", content);
    };

    const upsertLink = (selector: string, rel: string, href: string) => {
      let node = document.head.querySelector<HTMLLinkElement>(selector);
      if (!node) {
        node = document.createElement("link");
        node.setAttribute("rel", rel);
        document.head.appendChild(node);
      }
      node.setAttribute("href", href);
    };

    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta(
      'meta[name="robots"]',
      "name",
      "robots",
      noindex ? "noindex, nofollow" : "index, follow"
    );
    upsertMeta('meta[property="og:type"]', "property", "og:type", "website");
    upsertMeta('meta[property="og:site_name"]', "property", "og:site_name", siteName);
    upsertMeta('meta[property="og:title"]', "property", "og:title", fullTitle);
    upsertMeta(
      'meta[property="og:description"]',
      "property",
      "og:description",
      description
    );
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    upsertMeta('meta[property="og:image"]', "property", "og:image", image);
    upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", fullTitle);
    upsertMeta(
      'meta[name="twitter:description"]',
      "name",
      "twitter:description",
      description
    );
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
    upsertLink('link[rel="canonical"]', "canonical", canonicalUrl);

    const schemaId = "seo-json-ld";
    const existingScript = document.getElementById(schemaId);
    if (schema) {
      const script =
        existingScript ||
        Object.assign(document.createElement("script"), {
          id: schemaId,
          type: "application/ld+json",
        });
      script.textContent = JSON.stringify(schema);
      if (!existingScript) document.head.appendChild(script);
    } else if (existingScript) {
      existingScript.remove();
    }
  }, [canonicalUrl, description, fullTitle, image, noindex, schema]);

  return null;
}
