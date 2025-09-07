import path from "path";
import fs from "fs";
import { get } from "http";

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

    const versionData: ArchiveData = {
        ...JSON.parse(fs.readFileSync(versionDataPath, "utf-8")),
        fileRoot: sitePath
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