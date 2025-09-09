

const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;

import { VersionSettings } from "../model";
import { rewriteJavascriptBlockUrl } from "../html-process/html-javascript";

export function rewriteHtmlJavascriptUrls(html: string, requestedPath: string, settings: VersionSettings, rootPath: string, rewriteType: "relative" | "absolute") {
  return html.replace(scriptRegex, (match, scriptBody) => {
    try {
      const newBody = rewriteJavascriptBlockUrl(scriptBody, requestedPath, settings, rootPath, rewriteType);
      return match.replace(scriptBody, newBody);
    } catch (e) {
      console.log(scriptBody);
      console.warn("JS parse error:", e.message);
      return match;
    }
  });
}
