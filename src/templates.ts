import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { getAllSites, getSiteArchiveData } from "./archive";

const siteMainIndexTemplate = Handlebars.compile(fs.readFileSync(path.join(process.cwd(), "templates", "archive-index.handlebars"), "utf-8"));
const siteVersionIndexTemplate = Handlebars.compile(fs.readFileSync(path.join(process.cwd(), "templates", "site-versions.handlebars"), "utf-8"));
const siteFileListingTemplate = Handlebars.compile(fs.readFileSync(path.join(process.cwd(), "templates", "file-listing.handlebars"), "utf-8"));

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

export interface FileListingEntry {
  name: string;
  icon: string;
  iconType: string;
  lastModified: string;
  href: string;
  size: string;
  firstDate: string;
  lastDate: string;
  status: string;
  description: string;
}

export function getSiteFileListing(requestPath: string, files: FileListingEntry[]): string | undefined {
  return siteFileListingTemplate({ requestPath, files });
}
