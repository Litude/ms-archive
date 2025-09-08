// src/tokenizer.ts
import { Token, TagOpenToken } from "./types";
import { parseAttributes } from "./attributes";

export function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < html.length) {
    if (html[pos] === "<") {
      // comment
      if (html.startsWith("<!--", pos)) {
        let end = html.indexOf("-->", pos);
        if (end === -1) end = html.length;
        const raw = html.slice(pos, end + 3);
        tokens.push({ type: "comment", raw });
        pos = end + 3;
        continue;
      }

      // doctype
      if (/^<!doctype/i.test(html.slice(pos))) {
        let end = html.indexOf(">", pos);
        if (end === -1) end = html.length;
        const raw = html.slice(pos, end + 1);
        tokens.push({ type: "doctype", raw });
        pos = end + 1;
        continue;
      }

      // closing tag
      if (/^<\/\s*[\w:-]+/i.test(html.slice(pos))) {
        let end = html.indexOf(">", pos);
        if (end === -1) end = html.length;
        const raw = html.slice(pos, end + 1);
        const name = raw.replace(/^<\/\s*|>$/g, "").trim().split(/\s+/)[0];
        tokens.push({ type: "tag-close", raw, tag: name.toLowerCase(), name });
        pos = end + 1;
        continue;
      }

      // opening tag
      let end = html.indexOf(">", pos);
      if (end === -1) end = html.length;
      const raw = html.slice(pos, end + 1);
      const inner = raw.replace(/^<\s*|\/?>$/g, "").trim();
      const name = inner.split(/\s+/)[0] || "";
      const parsed = parseAttributes(raw);
      const token: TagOpenToken = {
        type: "tag-open",
        raw,
        tag: name.toLowerCase(),
        name,
        attrs: parsed.attrs,
        prefix: parsed.prefix,
        suffix: parsed.suffix,
        selfClosing: parsed.selfClosing,
      };
      tokens.push(token);
      pos = end + 1;
      continue;
    }

    // text
    let start = pos;
    while (pos < html.length && html[pos] !== "<") pos++;
    tokens.push({ type: "text", raw: html.slice(start, pos) });
  }

  return tokens;
}
