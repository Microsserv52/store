import type { MetadataRoute } from "next";
import { appName, basePath } from "@/lib/config";
export const dynamic = "force-static";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: basePath + "/",
    name: "Microsserv52 " + appName,
    short_name: "MS52 " + appName,
    description: "Educational mock store. No real transactions.",
    start_url: basePath + "/",
    scope: basePath + "/",
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#9b3d25",
    icons: [
      {
        src: basePath + "/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
