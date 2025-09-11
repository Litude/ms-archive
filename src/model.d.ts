
type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;

type Require<T, K extends keyof T> = T & { [P in K]-?: T[P]; }

// Types
interface VersionSettings {
  defaultPage: string;
  encoding?: string;
  language?: string;
  urlRewrites: {
    baseOrigin: string;
    basePathname: string;
    paths: Record<string, string>;
  }
}

export interface VersionEntry {
  settings?: Partial<VersionSettings>;
  paths: Record<string, string>;
}

export interface ArchiveVersion {
  path: string | null,
  date: Date,
  tag?: string,
  ext: string,
  originalName: string
}

export interface ArchiveData {
  title: string;
  originalUrl: string;
  indexStyle?: string;
  settings: VersionSettings;
  versions: Record<string, VersionEntry>;
  archiveMap: Record<string, ArchiveVersion[]>;
  fileRoot: string;
}
