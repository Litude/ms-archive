import { Token, TagOpenToken } from "./types";

export class TokenStream {
  tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  findById(id: string): TagOpenToken | undefined {
    return this.tokens.find(
      (t): t is TagOpenToken =>
        t.type === "tag-open" &&
        t.attrs.some(a => a.name.toLowerCase() === "id" && a.value === id)
    );
  }

  next(token: Token): Token | null {
    return this.tokens[token.index + 1] ?? null;
  }

  prev(token: Token): Token | null {
    return this.tokens[token.index - 1] ?? null;
  }

  *filterByTag(tagName: string): Iterable<TagOpenToken> {
    for (let t of this.tokens) {
      if (t.type === "tag-open" && t.name.toLowerCase() === tagName.toLowerCase()) {
        yield t;
      }
    }
  }
}
