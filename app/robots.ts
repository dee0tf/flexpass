import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/api/", "/auth/", "/login", "/signup"],
      },
    ],
    sitemap: "https://www.flexpasshq.com/sitemap.xml",
  };
}
