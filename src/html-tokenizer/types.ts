// src/types.ts
export type Token =
  | TextToken
  | TagOpenToken
  | TagCloseToken
  | CommentToken
  | DoctypeToken;

export interface BaseToken {
  type: string;
  raw: string;     // exact source text for lossless roundtrip
}

export interface TextToken extends BaseToken {
  type: "text";
}

export interface TagOpenToken extends BaseToken {
  type: "tag-open";
  tag: string;     // lowercased tag name for easier comparisons
  name: string;
  attrs: Attr[];
  prefix: string;   // substring from '<' up to the first attribute raw (includes '<' and tag name)
  suffix: string;   // substring from end of last attribute raw up to and including '>' (includes '/>' if present)
  selfClosing: boolean;
}

export interface TagCloseToken extends BaseToken {
  type: "tag-close";
  tag: string;   // lowercased tag name for easier comparisons
  name: string;
}

export interface CommentToken extends BaseToken {
  type: "comment";
}

export interface DoctypeToken extends BaseToken {
  type: "doctype";
}

export interface Attr {
  raw: string;      // exact slice from the original tag (includes any leading whitespace)
  name: string;
  value: string | null;    // unquoted value when present, otherwise null for boolean attrs
  quote: '"' | "'" | null; // quoting character used for the value (if any)
  start: number;    // start index in the original tagRaw (absolute, i.e. index within tagRaw)
  end: number;      // end index (exclusive) in the original tagRaw
}
