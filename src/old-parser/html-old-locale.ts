import { VersionSettings } from "../model";

export function rewriteCharsetAndLanguage(html: string, settings: VersionSettings): string {
  html = html
    .replace((/<meta\s+charset=["']?([^"'>\s]+)["']>/i), "")
    .replace((/<meta\s+http-equiv=["']?Content-Type["']?\s+content=["'][^"']*charset=([^"'>\s]+)["']>/i), "")
    .replace((/<meta\s+name=["']?charset["']?\s+content=["']?([^"'>\s]+)["']>/i), "");
  html = html.replace(/<head([^>]*)>/i, `<head$1>\n<meta charset=\"utf-8\">`);
  html = settings.language ? html.replace(/<html>/i, `<html lang=\"${settings.language}\">`) : html;
  return html;
}
