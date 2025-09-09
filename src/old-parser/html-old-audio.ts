import { VersionSettings } from "../model";

interface AudioRewriteState {
    encounteredAudio: boolean;
    encounteredFilenames: string[];
}

const reAttr = /\b([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^>\s]+))/gi;

function extractAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = reAttr.exec(tag))) {
    attrs[m[1].toLowerCase()] = m[2] || m[3] || m[4] || "";
  }
  return attrs;
}

function replaceAudioTagsInsideJavaScriptDocumentWrite(html: string, url: string, rewriteState: AudioRewriteState) {
    return html.replace(/document\.write\((["'])(.*?)\1\);?/gi, (match, quote: string, inner: string) => {
        // If the inner string contains <bgsound>
        const replacement = inner.replace(/<(bgsound|embed)\b([^>]*)>(?:<\/\1>)?/gi, (match: string, tagType: string, rawAttributes: string) => {
            rewriteState.encounteredAudio = true;
            const attributes = extractAttributes(rawAttributes);
            let filename = attributes.src ?? "";
            filename = filename.endsWith(".mid") ? filename.replace(".mid", ".mp3") : filename;
            filename = filename.includes("+") ? filename.trim().slice(1, -1).trim() : `"${filename}"`;
            const loop = tagType.toLocaleLowerCase() === "bgsound" ? attributes.loop?.toLocaleLowerCase() === "infinite" : attributes.loop === "true";
            if (!rewriteState.encounteredFilenames.includes(filename.toLocaleLowerCase())) {
                rewriteState.encounteredFilenames.push(filename.toLocaleLowerCase());
                return `BroadcastChannelAudio.post(${filename}, "${url}", ${loop});`;
            }
            else {
                return '';
            }
        });
        return replacement === inner ? match : replacement;
    });
}

function replaceHtmlAudioTags(html: string, url: string, rewriteState: AudioRewriteState) {
    html = html.replace(/<(bgsound|embed)\b([^>]*)>/gi, (match: string, tagType: string, rawAttributes: string) => {
        rewriteState.encounteredAudio = true;
        const attributes = extractAttributes(rawAttributes);
        let filename = attributes.src ?? "";
        filename = filename.endsWith(".mid") ? filename.replace(".mid", ".mp3") : filename;
        const loop = tagType.toLocaleLowerCase() === "bgsound" ? attributes.loop?.toLocaleLowerCase() === "infinite" : attributes.loop === "true";
        if (!rewriteState.encounteredFilenames.includes(`"${filename}"`.toLocaleLowerCase())) {
            rewriteState.encounteredFilenames.push(`"${filename}"`.toLocaleLowerCase());
            return `<script>BroadcastChannelAudio.post("${filename}", "${url}", ${loop});</script>`;
        }
        else {
            return '';
        }
        
    });
  return html;
}

export function rewriteAudioTags(html: string, url: string, settings: VersionSettings, rewriteType: "audio" | "popup"): string {
  // Rewrite bgsound elements

    const rewriteState: AudioRewriteState = {
        encounteredAudio: false,
        encounteredFilenames: [],
    };

    // If we replace javascript tags first, the second replacement should no longer touch javascript tags
    html = replaceAudioTagsInsideJavaScriptDocumentWrite(html, url, rewriteState);
    html = replaceHtmlAudioTags(html, url, rewriteState);

    if (rewriteState.encounteredAudio) {
        return html.replace(/<head>/, (match) => {
            return `<head>
<script>
    const bc = new BroadcastChannel("audio-player");
    window.BroadcastChannelAudio = {
        post: function (path, origin, loop) {
            bc.postMessage({ type: "play", path, origin, loop });
        }
    };
    document.addEventListener('DOMContentLoaded', () => {
        window.addEventListener("pagehide", () => {
            bc.postMessage({ type: "stop", origin: "${url}" });
        });
    });
</script>
        `;
        });
    }
    else {
        return html;
    }
}
