import { applyRewriteRulesToString } from "../html-process/html-urls";
import { VersionSettings } from "../model";
import { rewriteElementAttribute } from "./html-old-element";
export const urlRewriteTagAttributeTypes = [
  {
    tag: "img",
    attribute: "src"
  },
  {
    tag: "img",
    attribute: "lowsrc"
  },
  {
    tag: "body",
    attribute: "background"
  },
  {
    tag: "table",
    attribute: "background"
  },
  {
    tag: "td",
    attribute: "background"
  },
  {
    tag: "a",
    attribute: "href"
  },
  {
    tag: "area",
    attribute: "href"
  },
  {
    tag: "link",
    attribute: "href"
  },
  {
    tag: "iframe",
    attribute: "src"
  },
  {
    tag: "frame",
    attribute: "src",
  },
  {
    tag: "script",
    attribute: "src"
  },
  {
    tag: "bgsound",
    attribute: "src"
  },
  {
    tag: "option",
    attribute: "value"
  },
  {
    tag: "form",
    attribute: "action"
  },
  {
    tag: "input",
    attribute: "src",
    constraints: [
      { attribute: "type", value: "image" }
    ]
  },
  {
    tag: "embed",
    attribute: "src"
  }
];


function rewriteRefreshTags(html: string, requestedPath: string, settings: VersionSettings, rootPath: string, rewriteType: "relative" | "absolute"): string {
  return rewriteElementAttribute(html, "meta", "content", (value) => {
    const match = value.match(/^\s*(\d+)\s*;\s*url\s*=\s*(.+)\s*$/i);
    if (match) {
      let url = match[2];
      url = applyRewriteRulesToString(url, requestedPath, settings, rootPath, rewriteType, "external");
      return `${match[1]}; url=${url}`;
    }
    return value;
  }, [{ attribute: "http-equiv", value: "refresh" }]);
}

function rewriteFormRedirects(html: string): string {
  const patched = html.replace(
    /<(form)([^>]*\saction=["']?\/isapi\/redir\.dll["'][^>]*)>/i,
    (m, key, attrs) => `<${key} onsubmit="location=this.Target.value;return false;">`
  );
  return patched
}

export function rewriteUrls(html: string, requestedPath: string, settings: VersionSettings, rootPath: string, rewriteType: "relative" | "absolute"): string {
  const pathSegments = requestedPath.split('/').filter(Boolean);
  const depth = pathSegments.length > 1 ? pathSegments.length - 1 : 0;
  let updatedHtml = rewriteFormRedirects(html);
  updatedHtml = urlRewriteTagAttributeTypes.reduce((currentHtml, { tag, attribute, constraints }) => {
    return rewriteElementAttribute(currentHtml, tag, attribute, (value) => {
      value = applyRewriteRulesToString(value, requestedPath, settings, rootPath, rewriteType, "external");
      return value;
    }, constraints)
  }, updatedHtml);
  updatedHtml = rewriteRefreshTags(updatedHtml, requestedPath, settings, rootPath, rewriteType);
  return updatedHtml;
}
