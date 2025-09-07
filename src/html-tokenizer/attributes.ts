// src/attributes.ts
import { Attr } from "./types";

/**
 * Parse attributes from a tag raw string (e.g. `<div id="x"class='y'>`).
 * Returns attributes plus prefix/suffix to allow exact re-assembly.
 */
export function parseAttributes(tagRaw: string): {
  attrs: Attr[];
  prefix: string;
  suffix: string;
  selfClosing: boolean;
} {
  const isSelfClosing = /\/\s*>$/.test(tagRaw);
  const innerStart = 1;
  const innerEnd = tagRaw.length - (isSelfClosing ? 2 : 1);
  const inner = tagRaw.slice(innerStart, innerEnd); // content inside <...> excluding trailing / if present

  // find tag name end
  let i = 0;
  while (i < inner.length && /\s/.test(inner[i])) i++;
  const nameStart = i;
  while (i < inner.length && !/\s/.test(inner[i]) && inner[i] !== "/") i++;
  const tagName = inner.slice(nameStart, i);

  const attrs: Attr[] = [];
  let pos = i; // position in `inner` where attributes begin (may point at spaces or directly at attr)

  while (pos < inner.length) {
    const attrStart = pos; // include possible leading whitespace in raw slice
    // skip to first non-space to find name
    let tmp = pos;
    while (tmp < inner.length && /\s/.test(inner[tmp])) tmp++;
    if (tmp >= inner.length) {
      // only trailing whitespace left
      pos = tmp;
      break;
    }

    const nameStartIdx = tmp;
    // attribute name runs until '=', space, or '/'
    while (
      tmp < inner.length &&
      inner[tmp] !== "=" &&
      !/\s/.test(inner[tmp]) &&
      inner[tmp] !== "/"
    ) {
      tmp++;
    }
    const name = inner.slice(nameStartIdx, tmp);
    if (!name) {
      // stray char: consume one char to avoid infinite loop
      pos = attrStart + 1;
      continue;
    }

    // now parse optional value
    let value: string | null = null;
    let quote: '"' | "'" | null = null;
    let newPos = tmp;

    // skip spaces between name and '=' (but keep attrStart unchanged so raw preserves leading space)
    while (newPos < inner.length && /\s/.test(inner[newPos])) newPos++;

    if (newPos < inner.length && inner[newPos] === "=") {
      // has value
      newPos++; // skip '='
      // skip whitespace after '='
      while (newPos < inner.length && /\s/.test(inner[newPos])) newPos++;

      if (newPos < inner.length && (inner[newPos] === '"' || inner[newPos] === "'")) {
        quote = inner[newPos] as '"' | "'";
        const vStart = newPos + 1;
        let vEnd = inner.indexOf(quote, vStart);
        if (vEnd === -1) {
          // unterminated quote — take till end of inner
          vEnd = inner.length;
          value = inner.slice(vStart, vEnd);
          newPos = vEnd;
        } else {
          value = inner.slice(vStart, vEnd);
          newPos = vEnd + 1;
        }
      } else {
        // unquoted value (stop only at whitespace or tag end)
        const vStart = newPos;
        while (
        newPos < inner.length &&
        !/\s/.test(inner[newPos]) &&
        inner[newPos] !== ">"
        ) {
        newPos++;
        }
        value = inner.slice(vStart, newPos);

      }
    } else {
      // boolean attribute (no '=')
      value = null;
      newPos = tmp;
    }

    const rawStart = attrStart;
    const rawEnd = newPos;
    const rawInner = inner.slice(rawStart, rawEnd);
    const globalStart = innerStart + rawStart;
    const globalEnd = innerStart + rawEnd;
    const raw = tagRaw.slice(globalStart, globalEnd);

    attrs.push({
      raw,
      name,
      value,
      quote,
      start: globalStart,
      end: globalEnd,
    });

    pos = newPos;
  }

  // prefix: everything from beginning of tagRaw up to start of first attr raw (or entire tagRaw if no attrs)
  const prefix = attrs.length
    ? tagRaw.slice(0, attrs[0].start)
    : tagRaw.slice(0, tagRaw.length - (isSelfClosing ? 2 : 1)) + (isSelfClosing ? "" : "");

  // suffix: everything from end of last attr raw up to and including '>'
  const suffix = attrs.length
    ? tagRaw.slice(attrs[attrs.length - 1].end)
    : tagRaw.slice(tagRaw.length - (isSelfClosing ? 2 : 1));

  return {
    attrs,
    prefix,
    suffix,
    selfClosing: isSelfClosing,
  };
}

/**
 * Update attribute value while preserving as much of the original raw formatting as possible.
 * - If attribute had quotes, replace the inner quoted value.
 * - If unquoted, replace the bare value (preserving spaces around '=').
 * - If boolean (no value), convert to quoted `name="newValue"` preserving leading whitespace.
 */
export function setAttrValue(attr: Attr, newValue: string): void {
  if (attr.value === null) {
    // boolean -> create an "=" + quoted value preserving leading whitespace
    const nameIdx = attr.raw.indexOf(attr.name);
    const leading = nameIdx >= 0 ? attr.raw.slice(0, nameIdx) : "";
    attr.quote = '"';
    attr.value = newValue;
    attr.raw = `${leading}${attr.name}=${attr.quote}${newValue}${attr.quote}`;
    return;
  }

  if (attr.quote) {
    const qi = attr.raw.indexOf(attr.quote);
    const qj = qi >= 0 ? attr.raw.indexOf(attr.quote, qi + 1) : -1;
    if (qi >= 0 && qj >= 0) {
      attr.raw = attr.raw.slice(0, qi + 1) + newValue + attr.raw.slice(qj);
      attr.value = newValue;
      return;
    }
    // fallback: regenerate preserving leading whitespace
  }

  // unquoted or malformed -> replace the unquoted token after '='
  const nameIdx = attr.raw.indexOf(attr.name);
  const eqIdx = nameIdx >= 0 ? attr.raw.indexOf("=", nameIdx + attr.name.length) : -1;
  if (eqIdx >= 0) {
    let vStart = eqIdx + 1;
    // keep whitespace between '=' and value
    while (vStart < attr.raw.length && /\s/.test(attr.raw[vStart])) vStart++;
    let vEnd = vStart;
    while (vEnd < attr.raw.length && !/\s/.test(attr.raw[vEnd])) vEnd++;
    attr.raw = attr.raw.slice(0, vStart) + newValue + attr.raw.slice(vEnd);
    attr.value = newValue;
    return;
  }

  // ultimate fallback (very unusual): create = "value"
  const leading = nameIdx >= 0 ? attr.raw.slice(0, nameIdx) : "";
  attr.quote = '"';
  attr.value = newValue;
  attr.raw = `${leading}${attr.name}=${attr.quote}${newValue}${attr.quote}`;
}
