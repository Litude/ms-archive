import { HtmlToken } from "../html-tokenizer/types";
import { VersionSettings } from "../model";
import { applyRewriteRulesToString, urlRewriteTagAttributes } from "./html-urls";
import * as HtmlAttributes from "../html-tokenizer/attributes";
import * as HtmlSerializer from "../html-tokenizer/serializer";
import * as HtmlTokenizer from "../html-tokenizer/tokenizer";
import { rewriteCharsetAndLanguage } from "./html-locale";

export function decodeHtml(buffer: Buffer, settings: VersionSettings): string {
  let encoding = settings.encoding || "utf-8";
  const preview = new TextDecoder("windows-1252").decode(buffer.subarray(0, 1024));

  const match = preview.match(/<meta\s+charset=["']?([^"'>\s]+)/i)
             || preview.match(/<meta\s+http-equiv=["']?Content-Type["']?\s+content=["'][^"']*charset=([^"'>\s]+)/i)
             || preview.match(/<meta\s+name=["']?charset["']?\s+content=["']?([^"'>\s]+)/i)
  if (match) {
    encoding = match[1];
  }

  return new TextDecoder(encoding).decode(buffer);
}

export function processHtmlTokenized({ buffer, url, requestedPath, settings, site, version }: {
  buffer: Buffer,
  url: string,
  requestedPath: string,
  settings: VersionSettings,
  site: string,
  version: string
}): string {
  const html = decodeHtml(buffer, settings);
  let tokenDocument = HtmlTokenizer.tokenize(html);
  tokenDocument = rewriteCharsetAndLanguage(tokenDocument, settings);
  for (const token of tokenDocument) {
    if (token.type === "tag-open") {
      const attributes = urlRewriteTagAttributes[token.name] || [];
      for (const attr of attributes) {
        const currentAttr = HtmlAttributes.getAttribute(token, attr.attribute);
        if (currentAttr && currentAttr.value) {
          HtmlAttributes.setAttributeValue(currentAttr, applyRewriteRulesToString(currentAttr.value, requestedPath, settings, `/${site}/${version}/`, "absolute", attr.outsideRewriteType));
        }
      }
    }
  }
  return HtmlSerializer.serialize(tokenDocument);
}
