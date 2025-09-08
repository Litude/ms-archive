// src/serializer.ts
import { HtmlToken, ScriptToken, StyleToken, TagOpenToken } from "./types";
import { Attr } from "./types";

/** fallback serialization of attributes (used only if prefix/suffix were not captured) */
function serializeAttrsFallback(attrs: Attr[]): string {
  return attrs.map(a => a.raw).join("");
}

export function serialize(tokens: HtmlToken[]): string {
  return tokens
    .map(token => {
      switch (token.type) {
        case "tag-open": {
          const t = token as TagOpenToken;
          if (typeof t.prefix === "string" && typeof t.suffix === "string") {
            return t.prefix + t.attrs.map(a => a.raw).join("") + t.suffix;
          } else {
            // fallback (should rarely happen)
            return `<${t.rawName}${serializeAttrsFallback(t.attrs)}${t.selfClosing ? " /" : ""}>`;
          }
        }
        case "script": {
          const t = token as ScriptToken;
          // lossless reassembly: opening tag, attrs, closing tag
          let open: string;
          if (typeof t.prefix === "string" && typeof t.suffix === "string") {
            open = t.prefix + t.attrs.map(a => a.raw).join("") + t.suffix;
          } else {
            open = `<${t.rawName}${serializeAttrsFallback(t.attrs)}>`;
          }
          return open + t.rawContent + t.rawClose;
        }
        case "style": {
          const t = token as StyleToken;
          let open: string;
          if (typeof t.prefix === "string" && typeof t.suffix === "string") {
            open = t.prefix + t.attrs.map(a => a.raw).join("") + t.suffix;
          } else {
            open = `<${t.rawName}${serializeAttrsFallback(t.attrs)}>`;
          }
          return open + t.rawContent + t.rawClose;
        }

        default:
          return token.raw;
      }
    })
    .join("");
}
