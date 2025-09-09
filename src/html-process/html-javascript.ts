import * as acorn from "acorn";
import recast, { parse, print, visit } from "recast";
import { VersionSettings } from "../model";
import { applyRewriteRulesToString, rewriteTokenizedHtmlUrls } from "../html-process/html-urls";
import * as HtmlTokenizer from "../html-tokenizer/tokenizer";
import * as HtmlSerializer from "../html-tokenizer/serializer";

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

function constantFold(node): string | null {
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const left = constantFold(node.left);
    const right = constantFold(node.right);
    if (typeof left === "string" && typeof right === "string") {
      return left + right;
    }
  }
  return null;
}

function escapeScriptTags(str: string): string {
  return str.replace(/<\/script>/gi, "<\\/SCRIPT>");
}

export function rewriteJavascriptBlockUrl(jsCode: string, requestedPath: string, settings: VersionSettings, rootPath: string, rewriteType: "relative" | "absolute") {
  const pathSegments = requestedPath.split('/').filter(Boolean);
  const depth = pathSegments.length > 1 ? pathSegments.length - 1 : 0;

  //const rewrittenCode = rewriteUrls(jsCode, requestedPath, settings, rootPath, rewriteType);
  let scriptChanged = false;

  const ast = parse(jsCode, {
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
    visitCallExpression(path) {
        const node = path.node;

        // Check for document.write / document.writeln
        if (
            node.callee.type === "MemberExpression" &&
            node.callee.object.type === "Identifier" &&
            node.callee.object.name === "document" &&
            node.callee.property.type === "Identifier" &&
            (node.callee.property.name === "write" || node.callee.property.name === "writeln")
        ) {
            // Try to fold all arguments
            const foldedParts = node.arguments.map(arg => constantFold(arg));
            const folded = foldedParts.every(part => typeof part === "string") ? foldedParts.join("") : undefined;

            if (typeof folded === "string") {
                let tokenizedContent = HtmlTokenizer.tokenize(folded);
                tokenizedContent = rewriteTokenizedHtmlUrls(tokenizedContent, requestedPath, settings, rootPath, rewriteType);
                let rewritten = HtmlSerializer.serialize(tokenizedContent);


                if (rewritten !== folded) {
                    // Escape </SCRIPT> safely
                    rewritten = escapeScriptTags(rewritten);
                    scriptChanged = true;

                    // Replace original argument with safe rewritten string
                    // Use literal to avoid breaking AST
                    node.arguments = [recast.types.builders.literal(rewritten)];
                }
            }
        }

    this.traverse(path);
    },
    visitLiteral(path) {
      if (typeof path.value.value === "string") {
        let url = path.value.value;
        if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
          const localResource = url.endsWith(".js") || url.endsWith(".css") || url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".gif") || url.endsWith(".mid") || url.endsWith(".wav");
          url = applyRewriteRulesToString(url, requestedPath, settings, rootPath, rewriteType, localResource ? "local" : "external");
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

  return scriptChanged ? print(ast).code : jsCode;
}

