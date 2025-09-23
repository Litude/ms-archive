import path from "path";
import fs from "fs";
import { get } from "http";
import { ArchiveData, ArchiveVersion } from "./model";

const ARCHIVE_ROOT = path.join(process.cwd(), process.env.ARCHIVE_DIR ?? "archives");

const archiveMasterData: Record<string, ArchiveData> = {};

export function initializeArchive() {
    // Loop through all directories in archives
    fs.readdirSync(ARCHIVE_ROOT).forEach(site => {
        const sitePath = path.join(ARCHIVE_ROOT, site);
        if (fs.statSync(sitePath).isDirectory()) {
            // Initialize each site's archive
            initializeSiteArchive(sitePath);
        }
    });
}

function readArchivalData(filePath: string, originalName: string, ext: string): any {
    const fileDirectory = filePath.substring(0, filePath.lastIndexOf(path.sep));
    const archivalDataPath = path.join(fileDirectory, '.archivalData', `${path.basename(filePath)}.json`);
    const captureDataPath = path.join(fileDirectory, '.archivalData', `${originalName}.${ext}.archivaldata.csv`);
    if (fs.existsSync(archivalDataPath)) {
        const data = fs.readFileSync(archivalDataPath, 'utf8');
        return JSON.parse(data);
    }
    else if (fs.existsSync(captureDataPath)) {
        const relativePath = path.relative(fileDirectory, captureDataPath)
        // TODO: Perhaps we could check if the modify date occurs in the CSV to make sure that the archivaldata includes this capture
        return {
            description: "From the Wayback Machine.",
            captureDataPath: path.posix.join(...relativePath.split(path.sep)),
        }
    }
    return undefined;
}

function initializeSiteArchive(sitePath: string) {
    // Initialize the site's archive
    const versionDataPath = path.join(sitePath, ".versiondata.json");
    if (!fs.existsSync(versionDataPath)) {
        console.warn(`No version data found for site: ${sitePath}`);
        return;
    }

    // Helper to parse archive filenames and .meta files
    function parseArchiveFilename(filename: string): { originalName: string, date: Date, tag?: string, ext: string, isMeta?: boolean, metaEvent?: string, metaExt?: string } | null {
        // .meta file: basename.YYYYMMDD(.tag)?.ext.meta
        const metaMatch = filename.match(/^(.+?)\.(\d{8})(?:-(\d{6}))?(?:\.([^.]+))?\.([^.]+)\.meta$/);
        if (metaMatch) {
            const [, base, ymd, hms, tag, ext] = metaMatch;
            const date = hms
                ? new Date(`${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}T${hms.slice(0,2)}:${hms.slice(2,4)}:${hms.slice(4,6)}Z`)
                : new Date(`${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}T00:00:00Z`);
            // The tag for meta is the event (e.g. 'removed')
            return {
                originalName: base,
                date,
                tag,
                ext,
                isMeta: true,
            };
        }
        // Normal archive file
        const match = filename.match(/^(.+?)(?:\.(\d{8})(?:-(\d{6}))?)?(?:\.([^.]+))?\.([^.]+)$/);
        if (!match) return null;
        const [, base, ymd, hms, tag, ext] = match;
        let date: Date;
        if (ymd) {
            if (hms) {
                date = new Date(`${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}T${hms.slice(0,2)}:${hms.slice(2,4)}:${hms.slice(4,6)}Z`);
            } else {
                date = new Date(`${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}T00:00:00Z`);
            }
        } else {
            date = new Date(0); // epoch zero for undated files
        }
        return {
            originalName: base,
            date,
            tag,
            ext
        };
    }

    // Recursively walk directory, ignoring hidden files/dirs
    function buildArchiveMap(rootDir: string) {
        const archiveMap: Record<string, ArchiveVersion[]> = {};
        function walk(dir: string) {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.name.startsWith('.')) continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath);
                } else {
                    const parsed = parseArchiveFilename(entry.name);
                    if (parsed) {
                        const { originalName, date, tag, ext, isMeta } = parsed;
                        // For .meta files, key is the file it refers to (without .meta), path is null, tag is the meta event
                        let key: string;
                        if (isMeta) {
                            // Remove .meta from key, keep subdir and ext
                            const relDir = path.relative(rootDir, dir);
                            key = relDir ? path.posix.join(relDir.split(path.sep).join('/'), `${originalName}.${ext}`) : `${originalName}.${ext}`;
                            if (!archiveMap[key]) archiveMap[key] = [];
                            archiveMap[key].push({
                                path: null,
                                date,
                                tag, // meta event
                                ext,
                                originalName,
                                modifyTime: new Date(0),
                                fileSize: 0,
                            });
                        } else {
                            if (tag !== 'invalid') {
                                const stats = fs.statSync(fullPath);
                                const relDir = path.relative(rootDir, dir);
                                key = relDir ? path.posix.join(relDir.split(path.sep).join('/'), `${originalName}.${ext}`) : `${originalName}.${ext}`;
                                if (!archiveMap[key]) archiveMap[key] = [];
                                archiveMap[key].push({
                                    path: path.relative(rootDir, fullPath).split(path.sep).join('/'),
                                    date,
                                    tag,
                                    ext,
                                    originalName,
                                    modifyTime: stats.mtime,
                                    fileSize: stats.size,
                                    archivalData: readArchivalData(fullPath, originalName, ext),
                                });
                            }
                        }
                    }
                }
            }
        }
        walk(rootDir);
        // Sort versions by date descending
        for (const versions of Object.values(archiveMap)) {
            versions.sort((a, b) => b.date.getTime() - a.date.getTime());
        }
        return archiveMap;
    }

    const versionData: ArchiveData = {
        ...JSON.parse(fs.readFileSync(versionDataPath, "utf-8")),
        fileRoot: sitePath,
        archiveMap: buildArchiveMap(sitePath)
    };
    if (archiveMasterData[path.basename(sitePath)]) {
        throw new Error(`Duplicate archive found for site: ${sitePath}`);
    }
    archiveMasterData[path.basename(sitePath)] = versionData;
}


export function getSiteArchiveData(site: string): ArchiveData | undefined {
    return archiveMasterData[site];
}

export function getAllSites(): { name: string, path: string }[] {
    const sites = Object.keys(archiveMasterData).map(site => ({
        name: archiveMasterData[site].title,
        path: site
    }));
    sites.sort((a, b) => a.name.localeCompare(b.name));
    return sites;
}
