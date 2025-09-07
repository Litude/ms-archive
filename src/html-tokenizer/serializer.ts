// src/serializer.ts
import { Token, TagOpenToken } from "./types";
import { Attr } from "./types";

/** fallback serialization of attributes (used only if prefix/suffix were not captured) */
function serializeAttrsFallback(attrs: Attr[]): string {
  return attrs.map(a => a.raw).join("");
}

export function serialize(tokens: Token[]): string {
  return tokens
    .map(token => {
      if (token.type === "tag-open") {
        const t = token as TagOpenToken;
        if (typeof t.prefix === "string" && typeof t.suffix === "string") {
          return t.prefix + t.attrs.map(a => a.raw).join("") + t.suffix;
        } else {
          // fallback (should rarely happen)
          return `<${t.name}${serializeAttrsFallback(t.attrs)}${t.selfClosing ? " /" : ""}>`;
        }
      }
      return token.raw;
    })
    .join("");
}
