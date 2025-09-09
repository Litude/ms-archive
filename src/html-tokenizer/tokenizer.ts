// src/tokenizer.ts
import { HtmlToken, TagOpenToken } from "./types";
import { getAttribute, parseAttributes } from "./attributes";

export function tokenize(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
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
        tokens.push({ type: "tag-close", raw, name: name.toLowerCase(), rawName: name });
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

      const nameLower = name.toLowerCase();

      if (nameLower === "script" || nameLower === "style") {
        const closeTagRe = new RegExp(
          `<\\/\\s*${nameLower}\\s*>`,
          "i"
        );
        const match = closeTagRe.exec(html.slice(end + 1));
        let closePos: number;
        let tagLength = 0;
        if (match) {
          closePos = end + 1 + match.index;
          tagLength = match[0].length;
        } else {
          closePos = html.length;
        }

        const rawOpen = raw;
        const rawContent = html.slice(end + 1, closePos);
        const rawClose = html.slice(closePos, closePos + tagLength);

        if (nameLower === "script") {
          // If there is a SRC tag, this means the script is not inline (or if there is some text, it does not need to be handled) and we should treat this as a regular tag
          const isRegularTag = parsed.attrs.some(a => a.name === "src");
          if (isRegularTag) {
            const token: TagOpenToken = {
              type: "tag-open",
              raw,
              name: name.toLowerCase(),
              rawName: name,
              attrs: parsed.attrs,
              prefix: parsed.prefix,
              suffix: parsed.suffix,
              selfClosing: parsed.selfClosing,
            };
            tokens.push(token);
            pos = end + 1;
            continue;
          }
          else {
            tokens.push({
              type: "script",
              raw: rawOpen + rawContent + rawClose,
              name: name.toLowerCase(),
              rawName: name,
              rawOpen,
              rawContent,
              rawClose,
              attrs: parsed.attrs,
              prefix: parsed.prefix,
              suffix: parsed.suffix,
            });
          }
        } else {
          tokens.push({
            type: "style",
            raw: rawOpen + rawContent + rawClose,
            name: name.toLowerCase(),
            rawName: name,
            rawOpen,
            rawContent,
            rawClose,
            attrs: parsed.attrs,
            prefix: parsed.prefix,
            suffix: parsed.suffix,
          });
        }
        pos = closePos + tagLength;
        continue;
      }
      else {
        const token: TagOpenToken = {
          type: "tag-open",
          raw,
          name: name.toLowerCase(),
          rawName: name,
          attrs: parsed.attrs,
          prefix: parsed.prefix,
          suffix: parsed.suffix,
          selfClosing: parsed.selfClosing,
        };
        tokens.push(token);
        pos = end + 1;
        continue;
      }
    }

    // text
    let start = pos;
    while (pos < html.length && html[pos] !== "<") pos++;
    tokens.push({ type: "text", raw: html.slice(start, pos) });
  }

  return tokens;
}
