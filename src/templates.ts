import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { getAllSites, getSiteArchiveData } from "./archive";

const siteMainIndexTemplate = Handlebars.compile(fs.readFileSync(path.join(process.cwd(), "templates", "archive-index.handlebars"), "utf-8"));
const siteVersionIndexTemplate = Handlebars.compile(fs.readFileSync(path.join(process.cwd(), "templates", "site-versions.handlebars"), "utf-8"));

export function getSiteMainIndex(): string | undefined {
  const archiveData = getAllSites();
  if (!archiveData) return undefined;
  return siteMainIndexTemplate({ sites: archiveData });
}

export function getSiteVersionIndex(site: string): string | undefined {
  const archiveData = getSiteArchiveData(site);
  if (!archiveData) return undefined;
  const versions = Object.keys(archiveData.versions);
  return siteVersionIndexTemplate({ site, style: archiveData.indexStyle, title: archiveData.title, versions });
}
