import { rewriteElementAttribute } from "./html-element";
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

export function applyRewriteRulesToString(url: string, requestedPath: string, settings: VersionSettings, rootPath: string, rewriteType: "relative" | "absolute") {
  // First we make all URLs that are inside the site relative to the site root (starting with /)
  // Then we apply all mapping rules to all URLs
  // Finally depending on rewriteType the URLs that are site relative are either made archive absolute or path relative
  // If a rewrite rule startsWith / it is relative to basePathname, else it is relative to the site root

  const rewriteSettings = settings.urlRewrites;
  // Absolute URL that is outside the site, no need to rewrite

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

  if (url.startsWith("/")) {
    // Rootpath check is a bug workaround, some urls inside javascript are processed multiple times...
    if (!url.startsWith(rootPath)) {
      url = (rewriteSettings.baseOrigin || "") + url;
    }
  }
  else {
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

function rewriteRefreshTags(html: string, requestedPath: string, settings: VersionSettings, rootPath: string, rewriteType: "relative" | "absolute"): string {
  return rewriteElementAttribute(html, "meta", "content", (value) => {
    const match = value.match(/^\s*(\d+)\s*;\s*url\s*=\s*(.+)\s*$/i);
    if (match) {
      let url = match[2];
      url = applyRewriteRulesToString(url, requestedPath, settings, rootPath, rewriteType);
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
      value = applyRewriteRulesToString(value, requestedPath, settings, rootPath, rewriteType);
      return value;
    }, constraints)
  }, updatedHtml);
  updatedHtml = rewriteRefreshTags(updatedHtml, requestedPath, settings, rootPath, rewriteType);
  return updatedHtml;
}
