import { rewriteAudioTags } from "./html-audio";
import { rewriteHtmlJavascriptUrls } from "./html-javascript";
import { rewriteCharsetAndLanguage } from "./html-locale";
import { rewriteToolbar } from "./html-toolbar";
import { rewriteUrls } from "./html-urls";

export function decodeHtml(buffer: Buffer, settings: VersionSettings): string {
  let encoding = settings.encoding || "utf-8";
  const preview = new TextDecoder("windows-1252").decode(buffer.slice(0, 1024));

  const match = preview.match(/<meta\s+charset=["']?([^"'>\s]+)/i)
             || preview.match(/<meta\s+http-equiv=["']?Content-Type["']?\s+content=["'][^"']*charset=([^"'>\s]+)/i)
             || preview.match(/<meta\s+name=["']?charset["']?\s+content=["']?([^"'>\s]+)/i)
  if (match) {
    encoding = match[1];
  }

  return new TextDecoder(encoding).decode(buffer);
}

export function processHtml({ buffer, url, requestedPath, settings, site, version }: {
  buffer: Buffer,
  url: string,
  requestedPath: string,
  settings: VersionSettings,
  site: string,
  version: string
}): string {
  let html = decodeHtml(buffer, settings);
  html = rewriteCharsetAndLanguage(html, settings);
  html = rewriteToolbar(html, requestedPath,settings, site, version);
  html = rewriteUrls(html, requestedPath, settings, `/${site}/${version}/`, "relative");
  html = rewriteHtmlJavascriptUrls(html, requestedPath, settings, `/${site}/${version}/`, "relative");
  //html = rewriteAudioTags(html, url, settings, "popup");
  return html;
}
