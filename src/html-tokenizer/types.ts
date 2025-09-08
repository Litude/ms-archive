// src/types.ts
export type HtmlToken =
  | TextToken
  | TagOpenToken
  | TagCloseToken
  | CommentToken
  | DoctypeToken
  | ScriptToken
  | StyleToken;

export interface BaseToken {
  type: string;
  raw: string;     // exact source text for lossless roundtrip
}

export interface TextToken extends BaseToken {
  type: "text";
}

export interface TagOpenToken extends BaseToken {
  type: "tag-open";
  name: string;     // lowercased tag name for easier comparisons
  rawName: string; // original tag name (case preserved)
  attrs: Attr[];
  prefix: string;   // substring from '<' up to the first attribute raw (includes '<' and tag name)
  suffix: string;   // substring from end of last attribute raw up to and including '>' (includes '/>' if present)
  selfClosing: boolean;
}

export interface TagCloseToken extends BaseToken {
  type: "tag-close";
  name: string;   // lowercased tag name for easier comparisons
  rawName: string;
}

export interface CommentToken extends BaseToken {
  type: "comment";
}

export interface DoctypeToken extends BaseToken {
  type: "doctype";
}

export interface ScriptToken extends BaseToken {
  type: "script";
  name: string;   // lowercased tag name for easier comparisons
  rawName: string;
  rawOpen: string;   // opening <script ...>
  rawContent: string; // inner JS
  rawClose: string;  // closing </script>
  attrs: Attr[];
  prefix: string;   // substring from '<' up to the first attribute raw (includes '<' and tag name)
  suffix: string;   // substring from end of last attribute raw up to and including '>' (includes '/>' if present)
}

export interface StyleToken extends BaseToken {
  type: "style";
  name: string;   // lowercased tag name for easier comparisons
  rawName: string;
  rawOpen: string;   
  rawContent: string; // inner CSS
  rawClose: string;  
  attrs: Attr[];
  prefix: string;   // substring from '<' up to the first attribute raw (includes '<' and tag name)
  suffix: string;   // substring from end of last attribute raw up to and including '>' (includes '/>' if present)
}

export interface Attr {
  raw: string;      // exact slice from the original tag (includes any leading whitespace)
  rawName: string;
  name: string;       // lowercased name for easier comparisons
  value: string | null;    // unquoted value when present, otherwise null for boolean attrs
  quote: '"' | "'" | null; // quoting character used for the value (if any)
  start: number;    // start index in the original tagRaw (absolute, i.e. index within tagRaw)
  end: number;      // end index (exclusive) in the original tagRaw
}
