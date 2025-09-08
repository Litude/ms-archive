import { VersionSettings } from "../model";
import { rewriteAudioTags } from "./html-old-audio";
import { rewriteHtmlJavascriptUrls } from "./html-old-javascript";
import { rewriteCharsetAndLanguage } from "./html-old-locale";
import { rewriteToolbar } from "./html-old-toolbar";
import { rewriteUrls } from "./html-old-urls";
import { decodeHtml } from "../html-process/html-process";


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
