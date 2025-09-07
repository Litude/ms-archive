

const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;

import * as acorn from "acorn";
import recast, { parse, print, visit } from "recast";
import { applyRewriteRulesToString, rewriteUrls, urlRewriteTagAttributeTypes } from "./html-urls";

export function rewriteHtmlJavascriptUrls(html: string, requestedPath: string, settings: VersionSettings, rootPath: string, rewriteType: "relative" | "absolute") {
  return html.replace(scriptRegex, (match, scriptBody) => {
    try {
      const newBody = rewriteJavascriptBlockUrl(scriptBody, requestedPath, settings, rootPath, rewriteType);
      return match.replace(scriptBody, newBody);
    } catch (e) {
      console.log(scriptBody);
      console.warn("JS parse error:", e.message);
      return match;
    }
  });
}

function isStringLiteral(n) {
  return n && n.type === "Literal" && typeof n.value === "string";
}

function isLocationProtocol(node) {
  // Matches: location.protocol (keep it simple; add window.location if you want)
  return (
    node &&
    node.type === "MemberExpression" &&
    !node.computed &&
    node.property.type === "Identifier" &&
    node.property.name === "protocol" &&
    node.object.type === "Identifier" &&
    node.object.name === "location"
  );
}

function flattenConcat(node: any, out: any[] = []) {
  if (node.type === "BinaryExpression" && node.operator === "+") {
    flattenConcat(node.left, out);
    flattenConcat(node.right, out);
  } else {
    out.push(node);
  }
  return out;
}

function buildConcat(parts) {
  return parts.reduce((acc, cur) => (acc ? recast.types.builders.binaryExpression("+", acc, cur) : cur), null);
}

export function rewriteJavascriptBlockUrl(jsCode: string, requestedPath: string, settings: VersionSettings, rootPath: string, rewriteType: "relative" | "absolute") {
  const pathSegments = requestedPath.split('/').filter(Boolean);
  const depth = pathSegments.length > 1 ? pathSegments.length - 1 : 0;

  const rewrittenCode = rewriteUrls(jsCode, requestedPath, settings, rootPath, rewriteType);
  let scriptChanged = false;

  const ast = parse(rewrittenCode, {
    parser: {
      parse(source: string) {
        return acorn.parse(source, { ecmaVersion: "latest" });
      }
    }
  });
  visit(ast, {
    visitBinaryExpression(path) {
      const node = path.node;
      if (node.operator !== "+") {
        return this.traverse(path);
      }

      const parts = flattenConcat(node); // flat array of operands
      let mutated = false;

      for (let i = 0; i < parts.length - 1; i++) {
        if (isLocationProtocol(parts[i]) && isStringLiteral(parts[i + 1])) {
          const str = parts[i + 1].value; // e.g., "//c.microsoft.com/trans_pixel.asp?"

          let combined;
          if (str.startsWith("//")) {
            combined = "http:" + str; // ==> "http://..."
          } else if (str.startsWith("/")) {
            combined = "http:/" + str; // ensure double slash overall
          } else {
            combined = "http://" + str;
          }
          // Replace the two parts with one literal
          parts.splice(i, 2, recast.types.builders.literal(combined));
          mutated = true;
        }
      }

      if (mutated) {
        path.replace(buildConcat(parts));
        // No need to traverse inside replaced node again
        //return false;
      }

      this.traverse(path);
    },
    visitLiteral(path) {
      if (typeof path.value.value === "string") {
        let url = path.value.value;
        if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
          url = applyRewriteRulesToString(url, requestedPath, settings, rootPath, rewriteType);
          if (url !== path.value.value) {
            scriptChanged = true;
            path.value.value = url;
            path.value.raw = JSON.stringify(path.value.value);
          }
        }
      }
      this.traverse(path);
    },
  });

  return scriptChanged ? print(ast).code : rewrittenCode;
}
