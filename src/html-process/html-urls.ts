import { HtmlToken } from "../html-tokenizer/types";
import { VersionSettings } from "../model";
import * as HtmlAttributes from "../html-tokenizer/attributes";
import { rewriteJavascriptBlockUrl } from "./html-javascript";

interface TagRewriteValue {
  attribute: string;
  outsideRewriteType: "local" | "external"
  constraints?: { attribute: string; value: string }[]
}

export const urlRewriteTagAttributes: Record<string, TagRewriteValue[]> = {
  "img": [
    {
      attribute: "src",
      outsideRewriteType: "local"
    },
    {
      attribute: "lowsrc",
      outsideRewriteType: "local"
    }
  ],
  "body": [
    {
      attribute: "background",
      outsideRewriteType: "local"
    }
  ],
  "table": [
    {
      attribute: "background",
      outsideRewriteType: "local"
    }
  ],
  "td": [
    {
      attribute: "background",
      outsideRewriteType: "local"
    }
  ],
  "a": [
    {
      attribute: "href",
      outsideRewriteType: "external"
    }
  ],
  "area": [
    {
      attribute: "href",
      outsideRewriteType: "external"
    }
  ],
  "link": [
    {
      attribute: "href",
      outsideRewriteType: "local"
    }
  ],
  "iframe": [
    {
      attribute: "src",
      outsideRewriteType: "local"
    }
  ],
  "frame": [
    {
      attribute: "src",
      outsideRewriteType: "local"
    }
  ],
  "script": [
    {
      attribute: "src",
      outsideRewriteType: "local"
    }
  ],
  "bgsound": [
    {
      attribute: "src",
      outsideRewriteType: "local"
    }
  ],
  "option": [
    {
      attribute: "value",
      outsideRewriteType: "external"
    }
  ],
  "form": [
    {
      attribute: "action",
      outsideRewriteType: "external"
    }
  ],
  "input": [
    {
      attribute: "src",
      outsideRewriteType: "local",
      constraints: [
        { attribute: "type", value: "image" }
      ]
    }
  ],
  "embed": [
    {
      attribute: "src",
      outsideRewriteType: "local"
    }
  ]
}

function getUrlUpperDirectoryCount(url: string): number {
  let count = 0;
  for (let i = 0; i < url.length; i += 3) {
    const segment = url.slice(i, i + 3);
    if (segment === "../") {
      count++;
    }
  }
  return count;
}

export function applyRewriteRulesToString(url: string, requestedPath: string, settings: VersionSettings, rootPath: string, rewriteType: "relative" | "absolute", outsideRewriteType: "local" | "external"): string {
  // First we make all URLs that are inside the site relative to the site root (starting with /)
  // Then we apply all mapping rules to all URLs
  // Finally depending on rewriteType the URLs that are site relative are either made archive absolute or path relative
  // If a rewrite rule startsWith / it is relative to basePathname, else it is relative to the site root

  const rewriteSettings = settings.urlRewrites;

  // Remove base origin http://<baseOrigin> from all urls
  if (url.startsWith(rewriteSettings.baseOrigin)) {
    url = url.slice(rewriteSettings.baseOrigin.length);
  }

  // Next we normalize all urls that start with ../ and make them absolute
  const requestPathSegments = requestedPath.split('/').filter(Boolean);
  const normalizedReqPathSegments = requestPathSegments.slice(0, -1).map(segment => segment.toLocaleLowerCase());
  const requestUrlDepth = requestPathSegments.length > 1 ? requestPathSegments.length - 1 : 0;
  if (url.startsWith("../")) {
    const upperDirCount = getUrlUpperDirectoryCount(url);
    if (upperDirCount <= requestUrlDepth) {
      if (upperDirCount === requestUrlDepth) {
        url = `${url.slice(3 * upperDirCount)}`;
      }
      else {
        url = `${requestPathSegments.slice(0, requestUrlDepth - upperDirCount).join('/')}/${url.slice(3 * upperDirCount)}`;
      }
    }
    else {
      // URL goes outside, need to fix path according to basePathname
      const outsideCount = upperDirCount - requestUrlDepth;
      url = `${rewriteSettings.basePathname.split('/').slice(0, -(outsideCount + 1)).join('/')}/${url.slice(3 * upperDirCount)}`;
    }
  }
  else if (url.toLowerCase().startsWith(rewriteSettings.basePathname.toLowerCase())) {
    url = url.slice(rewriteSettings.basePathname.length);
  }
  // This means the URL is site relative, so if there is depth in the request, we need to prepend the missing parts
  else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
    if (requestUrlDepth > 0) {
      url = `${requestPathSegments.slice(0, requestUrlDepth).join('/')}/${url}`;
    }
  }

  let longestMatch: { from: string, to: string } | null = null;
  let longestFrom = '';
  if (rewriteSettings.paths) {
    for (const [from, to] of Object.entries(rewriteSettings.paths)) {
      let testFrom = from.toLowerCase();
      if (url.toLowerCase().startsWith(testFrom) && testFrom.length > longestFrom.length) {
        longestMatch = { from: testFrom, to };
        longestFrom = testFrom;
      }
    }
  }
  if (longestMatch) {
    url = longestMatch.to + url.slice(longestMatch.from.length);
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // If the URL is already absolute, no need to rewrite
    return url;
  }

  // Any url at this point that is starting with / is considered outside the site
  if (url.startsWith("/") && outsideRewriteType === "external") {
    // Rootpath check is a bug workaround, some urls inside javascript are processed multiple times...
    if (!url.startsWith(rootPath)) {
      url = (rewriteSettings.baseOrigin || "") + url;
    }
  }
  else {
    if (url.startsWith("/")) {
        let rewriteDomainFakeUrl = rewriteSettings.baseOrigin.startsWith('http://') ? rewriteSettings.baseOrigin.slice(7) : rewriteSettings.baseOrigin;
        rewriteDomainFakeUrl = rewriteDomainFakeUrl.startsWith('https://') ? rewriteDomainFakeUrl.slice(8) : rewriteDomainFakeUrl;
        rewriteDomainFakeUrl = rewriteDomainFakeUrl.startsWith('www.') ? rewriteDomainFakeUrl.slice(4) : rewriteDomainFakeUrl;
        url = `www.${rewriteDomainFakeUrl}${url}`;
    }

    if (rewriteType === "absolute") {
      url = `${rootPath}${url}`
    }
    else {
      const normalizedUrlSegments = url.split('/').filter(Boolean).map(segment => segment.toLowerCase());
      let commonPath = '';
      let depthProcessed = 0;
      for (let i = 0; i < Math.min(normalizedReqPathSegments.length, normalizedUrlSegments.length); i++) {
        if (normalizedReqPathSegments[i] === normalizedUrlSegments[i]) {
          ++depthProcessed;
          commonPath += `/${normalizedReqPathSegments[i]}`;
        } else {
          break;
        }
      }
      url = url.slice(commonPath.length);
      if (depthProcessed < requestUrlDepth) {
        for (let i = 0; i < (requestUrlDepth - depthProcessed); i++) {
          url = `../${url}`;
        }
      }
      if (!url.length) {
        url = settings.defaultPage;
      }
    }
  }
  return url;
}


export function rewriteTokenizedHtmlUrls(tokenDocument: HtmlToken[], requestedPath: string, settings: VersionSettings, rootPath: string, rewriteType: "relative" | "absolute"): HtmlToken[] {
    for (const token of tokenDocument) {
      if (token.type === "tag-open") {
        const attributes = urlRewriteTagAttributes[token.name] || [];
        for (const attr of attributes) {
          const currentAttr = HtmlAttributes.getAttribute(token, attr.attribute);
          if (currentAttr && currentAttr.value) {
            HtmlAttributes.setAttributeValue(currentAttr, applyRewriteRulesToString(currentAttr.value, requestedPath, settings, rootPath, rewriteType, attr.outsideRewriteType));
          }
        }
      }
      else if (token.type === "script") {
        const rewritten = rewriteJavascriptBlockUrl(token.rawContent, requestedPath, settings, rootPath, "relative");
        if (rewritten !== token.rawContent) {
          token.rawContent = rewritten;
        }
      }
    }
    return tokenDocument;
}
