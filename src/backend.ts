import express from "express";
import fs, { promises } from "fs";
import path from "path";
import { TextDecoder } from "util";
import { decodeHtml, processHtml } from "./html-process/html-process.js";
import { getSiteArchiveData, initializeArchive } from "./archive.js";
import { getSiteMainIndex, getSiteVersionIndex } from "./templates.js";
import { fileExistsCaseSensitive } from "./file-utils.js";
import { rewriteJavascriptBlockUrl } from "./html-process/html-javascript.js";
import { tokenize } from "./html-tokenizer/tokenizer.js";
import { serialize } from "./html-tokenizer/serializer.js";
import { ArchiveVersion, DeepPartial, VersionEntry, VersionSettings } from "./model.js";

const app = express();
const PORT = 3000;

initializeArchive();

function mergeGlobalAndVersionSettings(global: VersionSettings, version: VersionEntry
): { settings: VersionSettings, paths: Record<string, string> } {

  return { settings: deepMerge(global, version.settings || {}), paths: version.paths || {} };
}

function deepMerge<T>(obj1: T, obj2: DeepPartial<T>): T {
  const result: any = Array.isArray(obj1) ? [...obj1] : { ...obj1 };
  for (const key in obj2) {
    const typedKey = key as keyof T;
    if (
      obj2[typedKey] &&
      typeof obj2[typedKey] === 'object' &&
      !Array.isArray(obj2[typedKey])
    ) {
      result[typedKey] = deepMerge(obj1[typedKey] || {}, obj2[typedKey]);
    } else {
      result[typedKey] = obj2[typedKey];
    }
  }
  return result;
}



app.get("/", (req, res) => {
  const mainHtml = getSiteMainIndex();
  if (!mainHtml) {
    return res.status(400).send("No archive data has been configured");
  }
  res.send(mainHtml);
});

app.use('/static', express.static('public'))

app.get("/:site/", (req, res) => {
  const siteHtml = getSiteVersionIndex(req.params.site);
  if (!siteHtml) {
    return res.status(404).send("Unknown site");
  }
  res.send(siteHtml);
});

function getFileVersion(requestedPath: string, requestedVersion: Date, archiveData: Record<string, ArchiveVersion[]>): string | null {
  if (!(requestedPath in archiveData)) {
    return null;
  }
  const candidates = archiveData[requestedPath].filter(v => v.date <= requestedVersion);
  if (candidates.length === 0) {
    return null;
  }
  return candidates[0].path;
}

function getFilenamePath(currentVersionData: { settings: VersionSettings, paths: Record<string, string> }, requestedPath: string) {
  if (requestedPath in currentVersionData.paths) {
    const filename = currentVersionData.paths[requestedPath].split('/').pop();
    if (!filename) {
      throw new Error(`Invalid path mapping: ${currentVersionData.paths[requestedPath]}`);
    }
    const baseDirectory = currentVersionData.paths[requestedPath].split('/').slice(0, -1).join('/');
    return path.join(baseDirectory, '.versioned', filename).replaceAll('\\', '/');
  }
  else {
    return requestedPath;
  }
}

app.get("/:site/:version/{*pathRaw}", async (req, res) => {
  const { site, version, pathRaw } = req.params as { site: string; version: string; pathRaw: string[] | undefined };
  const archiveFlagsRaw = req.query.archiveFlags as string | undefined;
  const archiveFlags = (archiveFlagsRaw ?? "").split(',');
  const rawResponse = archiveFlags.includes("raw");
  const tokenizedResponse = archiveFlags.includes("tokenize");

  const archiveData = getSiteArchiveData(site);
  if (!archiveData) {
    return res.status(404).send("Unknown site");
  }

  const versionData = version in archiveData.versions ? archiveData.versions[version] : undefined;
  if (!versionData) {
    return res.status(404).send("Unknown version");
  }

  const { versions: _, ...globalSettings } = archiveData;

  const currentVersionData = mergeGlobalAndVersionSettings(globalSettings.settings, versionData);
  if (!currentVersionData) {
    return res.status(404).send("Unknown version");
  }

  if (pathRaw && pathRaw.at(-1) === "") {
    pathRaw[pathRaw.length - 1] = currentVersionData.settings.defaultPage;
  }
  const requestedPath = pathRaw ? pathRaw.join('/') : currentVersionData.settings.defaultPage;


  const filename = getFileVersion(requestedPath, new Date(`${version}T23:59:59Z`), archiveData.archiveMap);
  if (!filename) {
    return res.status(404).send("Not found");
  }

  // const filename = getFilenamePath(currentVersionData, requestedPath);
  // if (!await fileExistsCaseSensitive(archiveData.fileRoot, filename)) {
  //   return res.status(404).send("Not found");
  // }
  const filePath = path.join(archiveData.fileRoot, filename);

  const ext = path.extname(filePath).toLowerCase();

  if (rawResponse) {
    const buffer = await promises.readFile(filePath);
    const contentType = [".html", ".htm", ".asp", ".aspx"].includes(ext) ? "text/html" : undefined;
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    return res.send(buffer);
  }
  else if (tokenizedResponse) {
    const buffer = await promises.readFile(filePath);
    const html = decodeHtml(buffer, currentVersionData.settings);
    const htmlTokens = tokenize(html);
    for (const token of htmlTokens) {
      console.log(JSON.stringify(token))
    }
    const reserialized = serialize(htmlTokens);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(reserialized);
  }

  if ([".html", ".htm", ".asp", ".aspx", ".idc"].includes(ext)) {
    const buffer = await promises.readFile(filePath);
    // ASP and ASPX are by default HTML, but in rare cases they might actually be e.g. images
    // In this case there must be a .headers.json file present that indicates the content type
    // and HTML parsing is skipped
    if ([".asp", ".aspx", ".idc"].includes(ext)) {
      let headers: Record<string, string> = {};
      try {
        const headerFilePath = `${path.join(archiveData.fileRoot, `${requestedPath}.headers.json`)}`;
        headers = JSON.parse((await promises.readFile(headerFilePath)).toString());
      } catch (err) {
      }
      if (headers['content-type']) {
        res.setHeader("Content-Type", headers['content-type']);
        res.send(buffer);
        return;
      }
    }
    const html = processHtml({ buffer, url: `/${site}/${version}/${requestedPath}`, requestedPath, settings: currentVersionData.settings, site, version });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } else if (ext === ".txt" && currentVersionData.settings.encoding) {
    const buffer = await promises.readFile(filePath);
    const text = new TextDecoder(currentVersionData.settings.encoding).decode(buffer);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(text);
  } else if (ext === ".js") {
    const actualDomain = `${req.protocol}://${req.headers.host}`;
    const requestOrigin = req.headers.referer?.startsWith(actualDomain) ? req.headers.referer.slice(actualDomain.length) : currentVersionData.settings.defaultPage;
    const buffer = await promises.readFile(filePath);
    const jsCode = new TextDecoder(currentVersionData.settings.encoding).decode(buffer);
    const js = rewriteJavascriptBlockUrl(jsCode, requestOrigin, currentVersionData.settings, `/${site}/${version}/`, "absolute");
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.send(js);
  } else {
    res.sendFile(filePath, {
      dotfiles: 'allow'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Archive server at http://localhost:${PORT}`);
});
