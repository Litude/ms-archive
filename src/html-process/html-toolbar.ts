import { rewriteElementAttribute } from "./html-element";
import { applyRewriteRulesToString, rewriteUrls, urlRewriteTagAttributeTypes } from "./html-urls";

function detectToolbarVersion(html: string): string | null {
  if (html.includes("<!-- Start: ToolBar V2.0-->") || html.includes("<!-- End: ToolBar V2.0-->")) {
    return "2.0";
  } else if (html.includes("<!--TOOLBAR_START-->")) {
    return "1.0";
  }
  return null;
}

function rewriteToolbarV1(html: string, requestedPath: string, settings: VersionSettings, site: string, version: string): string {
    // html = html.replace(/<!--TOOLBAR_START-->(.*?)<!--TOOLBAR_END-->/s, (match, content) => {
    //   return '<!--TOOLBAR_START-->' + content.replace(/(<img[^>]*\s+src=["'])([^"']+)(["'][^>]*>)/gi, (match, prefix, src, suffix) => {
    //     const filename = src.split('/').pop();
    //     const rewritten = `${prefix}${settings.urlRewrites.basePathname}toolbar/1.0/images/${filename}${suffix}`;
    //     return rewritten;
    //   }) + '<!--TOOLBAR_END-->';
    // });

    // if (html.includes("<!-- games TOOLBAR-->")) {
    //   html = html.replace(/<!-- games TOOLBAR-->(.*?)<!-- end of games TOOLBAR-->/s, (match, content) => {
    //     return '<!-- games TOOLBAR-->' + content.replace(/(<img[^>]*\s+src=["'])([^"']+)(["'][^>]*>)/gi, (match, prefix, src, suffix) => {
    //       const filename = src.split('/').pop();
    //       return `${prefix}${settings.urlRewrites.basePathname}toolbar/1.0/images/${filename}${suffix}`;
    //     }) + '<!-- games TOOLBAR_END-->';
    //   });
    // }
    return html;
}

function rewriteToolbarV2(html: string, requestedPath: string, settings: VersionSettings, site: string, version: string): string {
  if (!html.includes("<!-- Start: ToolBar V2.0-->")) {
    html = html.replace(/(<script .*><\/script>\s*)+<!-- Start: ToolBar for down-level browsers-->(.*?)<!-- End: ToolBar V2\.0-->/s, (match, scripts, content) => {
      const rewrittenScripts = rewriteElementAttribute(scripts, "script", "src", (value) => {
        const filename = value.split('/').pop()
        return `${settings.urlRewrites.basePathname}toolbar/2.0/${filename}`;
      })
      return (
        '<!-- Start: ToolBar V2.0-->\n' +
        rewrittenScripts +
        '<!-- Start: ToolBar for down-level browsers-->' +
        rewriteToolbarUrls(content, requestedPath, settings, site, version) +
        '<!-- End: ToolBar V2.0-->');
    });
  }
  else {
    html = html.replace(/<!-- Start: ToolBar V2\.0-->(.*?)<!-- End: ToolBar V2\.0-->/s, (match, content) => {
      return '<!-- Start: ToolBar V2.0-->' + rewriteToolbarUrls(content, requestedPath, settings, site, version) + '<!-- End: ToolBar V2.0-->'
    });
  }
  return html;
}

export function rewriteToolbar(html: string, requestedPath: string,  settings: VersionSettings, site: string, version: string): string {
  const toolbarVersion = detectToolbarVersion(html);
  switch (toolbarVersion) {
    case "2.0":
      html = rewriteToolbarV2(html, requestedPath, settings, site, version);
      break;
    case "1.0":
      html = rewriteToolbarV1(html, requestedPath, settings, site, version);
      break;
  }
  return html;
}


function rewriteToolbarUrls(html: string, requestedPath: string, settings: VersionSettings, site: string, version: string): string {
  const pathSegments = requestedPath.split('/').filter(Boolean);
  const depth = pathSegments.length > 1 ? pathSegments.length - 1 : 0;
  let updatedHtml = urlRewriteTagAttributeTypes.reduce((currentHtml, { tag, attribute }) => {
    return rewriteElementAttribute(currentHtml, tag, attribute, (value) => {
      const filename = value.split('/').pop()
      if (filename?.includes('.')) {
        const extension = filename.split('.').pop()
        if (extension === 'js' || extension === 'css') {
          return `${settings.urlRewrites.basePathname}toolbar/2.0/${filename}`;
        }
        else if (['gif', 'jpg', 'jpeg', 'png', 'bmp', 'ico'].includes(extension?.toLowerCase() || '')) {
          return `${settings.urlRewrites.basePathname}toolbar/2.0/images/${filename}`;
        }
      }
      return value;
    })
  }, html);
  return updatedHtml;
}
