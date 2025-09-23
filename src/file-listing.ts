import { ArchiveData, ArchiveVersion } from "./model";
import { FileListingEntry, getSiteFileListing } from "./templates";
import { Temporal } from 'temporal-polyfill';

const IconType: Record<string, string> = {
  "html": "TXT",
  "htm": "TXT",
  "asp": "TXT",
  "aspx": "TXT",
  "php": "TXT",
  "idc": "TXT",
  "txt": "TXT",
  "css": "TXT",
  "js": "TXT",
  "json": "TXT",
  "xml": "TXT",
  "jpg": "IMG",
  "jpeg": "IMG",
  "png": "IMG",
  "gif": "IMG",
  "svg": "IMG",
  "mp3": "SND",
  "wav": "SND",
  "mid": "SND",
  "midi": "SND",
  "avi": "VID",
  "pdf": "PDF",
  "doc": "DOC",
}

const IconMap: Record<string, string> = {
  "TXT": "text.gif",
  "IMG": "image2.gif",
  "SND": "sound2.gif",
  "VID": "video.gif",
  "PDF": "pdf.gif",
  "DOC": "doc.gif",
  "DIR": "directory.gif",
  "BIN": "binary.gif",
}

function getIconType(ext: string): string {
  return IconType[ext.toLowerCase()] || "BIN";
}

function getIcon(ext: string): string {
  const type = getIconType(ext.toLowerCase());
  return IconMap[type] || IconMap["BIN"];
}

function formatUTC(date: Date): string {
  const instant = Temporal.Instant.from(date.toISOString());
  const zoned = instant.toZonedDateTimeISO('UTC');
  return `${zoned.toPlainDate().toString()} ${zoned.hour.toString().padStart(2, '0')}:${zoned.minute.toString().padStart(2, '0')}`;
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size}`;
  else if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}K`;
  else if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)}M`;
  else return `${(size / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

export function generateSiteDirectoryListing(requestPath: string, archiveVersions: Record<string, ArchiveVersion[]>, version: Date): string | undefined {
  // Find all files under the requested path
  // First we need to check that the key (path) starts with the requestPath and is not under another subdirectory
  // Then we need to filter by date
  // Finally, we need to sort by date descending and return the list

  requestPath = requestPath === '/' ? '' : requestPath;

  const matchingFiles: FileListingEntry[] = Object.entries(archiveVersions)
    .filter(([path, versions]) => {
        if (!requestPath) {
            return !path.includes('/');
        }
        else {
            return path.startsWith(requestPath) && !path.slice(requestPath.length).includes('/')
        }
    })
    .map(([path, versions]) => {
      // Find the latest version before or on the requested date
      const index = versions.findIndex(v => v.date <= version);
      if (index === -1) {
        return null;
      } else if (versions[index].path === null && versions[index].tag === 'removed') {
        return null;
      }
      else if (index > 0) {
        return { ...versions[index], nextDate: versions[index - 1].date };
      }
      else {
        return { ...versions[index], nextDate: null };
      }
    })
    .filter((v): v is ArchiveVersion & { nextDate: Date | null } => v !== null)
    .map(v => {
        const name = `${v.originalName}${v.ext ? `.${v.ext}` : ""}`;
        const description = v.archivalData?.description || "";
        const captureDataDescription = v.archivalData?.captureDataPath ? `See <a href="${v.archivalData.captureDataPath}">capture data</a>.` : "";
        return {
            name,
            lastModified: formatUTC(v.modifyTime),
            href: name,
            icon: getIcon(v.ext),
            iconType: getIconType(v.ext),
            size: formatFileSize(v.fileSize),
            firstDate: +v.date ? formatUTC(v.date) : "-",
            lastDate: v.nextDate ? formatUTC(v.nextDate) : "-",
            description: [description, captureDataDescription].filter(s => s).join(' '),
            status: v.tag ? `${v.tag[0].toUpperCase()}${v.tag.slice(1)}` : "Original",
        };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
    
  // To find the directories that we need to list, we need to find all paths that are exactly one level deeper than the requestPath
  // then we filter these by date and check which directories have at least one file before or on the requested date
  const matchingDirNames = new Set<string>();
  Object.entries(archiveVersions)
    .filter(([path, versions]) => {
        if (!requestPath) {
            return path.includes('/');
        }
        else {
            // Make sure that subdirectories that are more than one level deeper are excluded
            return path.startsWith(requestPath) && path.slice(requestPath.length).includes('/')
        }
    })
    .forEach(([path, versions]) => {
      const candidate = versions.find(v => v.date <= version);
      if (candidate && candidate.path !== null && candidate.tag !== 'removed') {
        const subPath = path.slice(requestPath.length);
        const dirName = subPath.split('/')[0];
        matchingDirNames.add(dirName);
      }
    });

  const matchingDirs: FileListingEntry[] = [];
  
  // Add directories to the list
  for (const dir of matchingDirNames) {
    matchingDirs.push({
      name: `${dir}/`,
      lastModified: '',
      iconType: "DIR",
      icon: "dir.gif",
      firstDate: '',
      lastDate: '',
      href: `${dir}/_files`,
      size: "-",
      status: "",
      description: "",
    });
  }
  matchingDirs.sort((a, b) => a.name.localeCompare(b.name));

  if (matchingDirs.length === 0 && matchingFiles.length === 0) {
    return undefined;
  }

  const depth = requestPath ? requestPath.split('/').length : 0;

  return getSiteFileListing(requestPath, [...(depth > 0 ? [{
    name: "Parent Directory",
    icon: "back.gif",
    iconType: "PARENTDIR",
    lastModified: '',
    href: '../_files',
    size: "-",
    firstDate: '',
    lastDate: '',
    status: "",
    description: "",
  }] : []), ...matchingDirs, ...matchingFiles]);
}
