import { HtmlToken, TagOpenToken } from "../html-tokenizer/types";
import { VersionSettings } from "../model";
import * as HtmlAttributes from "../html-tokenizer/attributes";
import * as HtmlTokenizer from "../html-tokenizer/tokenizer";

export function rewriteCharsetAndLanguage(htmlTokens: HtmlToken[], settings: VersionSettings): HtmlToken[] {

  // Remove existing charset meta tags
  let removeIfLineBreak = false;
  let firstCharsetIndex = -1;
  htmlTokens = htmlTokens.filter((token, index) => {
    if (token.type === "tag-open" && token.name === "meta") {
      // e.g. <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=iso8859-1">
      //  or  <META NAME="CHARSET" CONTENT="Shift_jis">
      //  or  <META CHARSET="utf-8">
      if ((HtmlAttributes.getAttributeValue(token, "http-equiv")?.toLowerCase() === "content-type" && HtmlAttributes.getAttributeValue(token, "content")?.toLowerCase().includes("charset=")) ||
          (HtmlAttributes.getAttributeValue(token, "name")?.toLowerCase() === "charset" && HtmlAttributes.getAttributeValue(token, "content")) ||
          HtmlAttributes.getAttributeValue(token, "charset")
      ) {
        removeIfLineBreak = true;
        if (firstCharsetIndex === -1) {
          firstCharsetIndex = index;
        }
        return false;
      }
    }
    else if (removeIfLineBreak && token.type === "text" && /^\s*$/.test(token.raw)) {
      removeIfLineBreak = false;
      return false;
    }
    return true;
  });

  if (firstCharsetIndex !== -1) {
    // Insert new charset meta tag at the position of the first removed one
    const charsetTokens = HtmlTokenizer.tokenize(`<meta charset="utf-8">\r\n`);
    htmlTokens.splice(firstCharsetIndex, 0, ...charsetTokens);
  }

  const htmlTag = htmlTokens.find(token => token.type === "tag-open" && token.name === "html") as TagOpenToken | undefined;
  if (htmlTag && settings.language) {
    const langAttribute = HtmlAttributes.getAttribute(htmlTag, "lang");
    if (langAttribute) {
      HtmlAttributes.setAttributeValue(langAttribute, settings.language);
    } else {
      const langAttr = HtmlAttributes.createAttribute("lang", settings.language);
      htmlTag.attrs.push(langAttr);
    }
  }

  return htmlTokens;
}
