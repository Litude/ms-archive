import path from "path";
import fs from "fs";
import { get } from "http";
import { ArchiveData } from "./model";

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

function initializeSiteArchive(sitePath: string) {
    // Initialize the site's archive
    const versionDataPath = path.join(sitePath, ".versiondata.json");
    if (!fs.existsSync(versionDataPath)) {
        console.warn(`No version data found for site: ${sitePath}`);
        return;
    }

    // Helper to parse archive filenames
    function parseArchiveFilename(filename: string): { originalName: string, date: Date, tag?: string, ext: string } | null {
        // Match: basename(.YYYYMMDD(-HHMMSS)?(.tag)?)?.ext
        // All date/tag parts optional
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
        const archiveMap: Record<string, Array<{ path: string, date: Date, tag?: string, ext: string, originalName: string }>> = {};
        function walk(dir: string) {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.name.startsWith('.')) continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath);
                } else {
                    const parsed = parseArchiveFilename(entry.name);
                    if (parsed) {
                        const { originalName, date, tag, ext } = parsed;
                        // Build key as relative path from rootDir, including subdirs and extension
                        const relDir = path.relative(rootDir, dir);
                        // If in root, relDir is '', so skip adding slash
                        const key = relDir ? path.posix.join(relDir.split(path.sep).join('/'), `${originalName}.${ext}`) : `${originalName}.${ext}`;
                        if (!archiveMap[key]) archiveMap[key] = [];
                        archiveMap[key].push({
                            path: path.relative(rootDir, fullPath).split(path.sep).join('/'),
                            date,
                            tag,
                            ext,
                            originalName
                        });
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
