# ROM Runner - Restored Sections (Reference Copy)

**Version:** 1.0.0  
**Created:** January 7, 2026  
**Purpose:** Reference document for content restored in v2.7.0  
**Status:** ✅ INTEGRATED into ROM_Runner_Complete_Requirements_v2_7_0.md

---

## Table of Contents

1. [Caching Strategy](#1-caching-strategy)
2. [Notification System](#2-notification-system)
3. [Import/Migration from Other Tools](#3-importmigration-from-other-tools)
4. [Scraping & Metadata Resolution](#4-scraping--metadata-resolution)
5. [Network Source Details](#5-network-source-details)
6. [ROM Hacks, Fan Games & Custom Content](#6-rom-hacks-fan-games--custom-content)
7. [Shader & Controller Configuration](#7-shader--controller-configuration)
8. [Error Handling & Recovery](#8-error-handling--recovery)
9. [Testing Strategy](#9-testing-strategy)
10. [SD Card Health & Detection](#10-sd-card-health--detection)
11. [Packaging & Distribution](#11-packaging--distribution)
12. [Plugin/Extension System](#12-pluginextension-system)

---

## 1. Caching Strategy

### 1.1 Cache Architecture

ROM Runner uses a three-layer cache architecture for optimal performance:

```
┌─────────────────────────────────────────────────────────────────┐
│                       Cache Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: In-Memory (Hot)                                       │
│  ├─ LRU Cache: 100MB max                                        │
│  ├─ TTL: Session (until app close)                              │
│  ├─ Contents:                                                    │
│  │   ├─ Recent ROM queries                                      │
│  │   ├─ Platform/Emulator definitions                           │
│  │   ├─ Active profile data                                     │
│  │   └─ UI state                                                │
│  │                                                               │
│  Layer 2: SQLite (Warm)                                         │
│  ├─ All structured data                                         │
│  ├─ FTS5 index for search                                       │
│  ├─ Scraper response cache (with TTL)                           │
│  │                                                               │
│  Layer 3: Filesystem (Cold)                                     │
│  ├─ Downloaded images                                           │
│  ├─ Downloaded videos                                           │
│  ├─ Manuals (PDFs)                                              │
│  └─ Large metadata files                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Memory Cache Implementation

```typescript
// LRU Cache with size limits
class MemoryCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private maxSize: number;        // bytes
  private currentSize: number;
  private sizeCalculator: (value: V) => number;
  
  constructor(maxSizeMB: number, sizeCalculator: (v: V) => number) {
    this.cache = new Map();
    this.maxSize = maxSizeMB * 1024 * 1024;
    this.currentSize = 0;
    this.sizeCalculator = sizeCalculator;
  }
  
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value;
  }
  
  set(key: K, value: V): void {
    const size = this.sizeCalculator(value);
    
    // Evict until we have space
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      const oldest = this.cache.keys().next().value;
      this.delete(oldest);
    }
    
    // Remove existing if present
    if (this.cache.has(key)) {
      this.delete(key);
    }
    
    this.cache.set(key, { value, size });
    this.currentSize += size;
  }
  
  delete(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    this.cache.delete(key);
    this.currentSize -= entry.size;
    return true;
  }
  
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }
}

interface CacheEntry<V> {
  value: V;
  size: number;
}
```

### 1.3 Media Cache Configuration

```typescript
interface MediaCacheConfig {
  // Size limits
  maxImageCacheMB: number;       // Default: 2048 (2GB)
  maxVideoCacheMB: number;       // Default: 5120 (5GB)
  maxTotalCacheMB: number;       // Default: 10240 (10GB)
  
  // Quality settings affect cache usage
  imageQuality: 'low' | 'medium' | 'high' | 'original';
  videoQuality: 'low' | 'medium' | 'high';
  
  // Eviction
  evictionPolicy: 'lru' | 'lfu' | 'size-weighted';
  maxAgeDays: number;            // Default: 90
  
  // Behavior
  preloadThumbnails: boolean;    // Preload visible thumbnails
  prefetchCount: number;         // How many to prefetch ahead
}
```

### 1.4 Media Cache Implementation

```typescript
class MediaCache {
  private config: MediaCacheConfig;
  private db: Database;
  private cachePath: string;
  
  async get(url: string, type: 'image' | 'video'): Promise<string | null> {
    // Check cache_entries table
    const entry = await this.db.get(
      'SELECT * FROM cache_entries WHERE cache_type = ? AND cache_key = ?',
      [type, url]
    );
    
    if (!entry) return null;
    
    // Verify file exists
    if (!await fs.exists(entry.file_path)) {
      await this.removeEntry(entry.id);
      return null;
    }
    
    // Update access tracking
    await this.db.run(
      `UPDATE cache_entries 
       SET last_accessed = datetime('now'), access_count = access_count + 1 
       WHERE id = ?`,
      [entry.id]
    );
    
    return entry.file_path;
  }
  
  async put(url: string, type: 'image' | 'video', data: Buffer): Promise<string> {
    // Ensure space available
    await this.ensureSpace(data.length, type);
    
    // Generate cache path
    const hash = crypto.createHash('sha1').update(url).digest('hex');
    const ext = this.getExtension(url);
    const relativePath = `${type}s/${hash.substring(0, 2)}/${hash}${ext}`;
    const fullPath = path.join(this.cachePath, relativePath);
    
    // Write file
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    
    // Record in database
    await this.db.run(
      `INSERT INTO cache_entries (id, cache_type, cache_key, file_path, file_size, created_at, last_accessed)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [uuid(), type, url, fullPath, data.length]
    );
    
    return fullPath;
  }
  
  async ensureSpace(needed: number, type: 'image' | 'video'): Promise<void> {
    const maxSize = type === 'image' 
      ? this.config.maxImageCacheMB * 1024 * 1024
      : this.config.maxVideoCacheMB * 1024 * 1024;
    
    const currentSize = await this.getCacheSize(type);
    
    if (currentSize + needed <= maxSize) return;
    
    // Need to evict
    const toEvict = currentSize + needed - maxSize;
    await this.evict(type, toEvict);
  }
  
  async evict(type: string, bytesNeeded: number): Promise<void> {
    // Get candidates based on eviction policy
    let query: string;
    switch (this.config.evictionPolicy) {
      case 'lru':
        query = 'ORDER BY last_accessed ASC';
        break;
      case 'lfu':
        query = 'ORDER BY access_count ASC, last_accessed ASC';
        break;
      case 'size-weighted':
        // Prefer evicting large, rarely-accessed files
        query = 'ORDER BY (file_size / (access_count + 1)) DESC';
        break;
    }
    
    const entries = await this.db.all(
      `SELECT * FROM cache_entries WHERE cache_type = ? ${query}`,
      [type]
    );
    
    let evicted = 0;
    for (const entry of entries) {
      if (evicted >= bytesNeeded) break;
      
      await this.removeEntry(entry.id);
      evicted += entry.file_size;
    }
  }
  
  async cleanup(): Promise<CleanupResult> {
    // Remove expired entries
    const maxAge = this.config.maxAgeDays;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAge);
    
    const expired = await this.db.all(
      `SELECT * FROM cache_entries WHERE last_accessed < ?`,
      [cutoff.toISOString()]
    );
    
    let removedCount = 0;
    let removedBytes = 0;
    
    for (const entry of expired) {
      await this.removeEntry(entry.id);
      removedCount++;
      removedBytes += entry.file_size;
    }
    
    // Remove orphaned files
    const orphaned = await this.findOrphanedFiles();
    for (const filePath of orphaned) {
      await fs.unlink(filePath);
    }
    
    return { removedCount, removedBytes, orphanedFiles: orphaned.length };
  }
}
```

### 1.5 Scraper Response Cache

```typescript
interface ScraperCacheEntry {
  service: string;
  queryHash: string;
  responseJson: string;
  expiresAt: Date;
}

class ScraperCache {
  private db: Database;
  
  // TTLs by response type
  private readonly TTLs = {
    game_metadata: 7 * 24 * 60 * 60,    // 7 days
    media_url: 30 * 24 * 60 * 60,        // 30 days
    search_results: 24 * 60 * 60,        // 24 hours
    rate_limit_info: 5 * 60,             // 5 minutes
  };
  
  async get<T>(service: string, query: object): Promise<T | null> {
    const queryHash = this.hashQuery(query);
    
    const entry = await this.db.get(
      `SELECT * FROM scraper_cache 
       WHERE service = ? AND query_hash = ? AND expires_at > datetime('now')`,
      [service, queryHash]
    );
    
    if (!entry) return null;
    
    return JSON.parse(entry.response_json);
  }
  
  async set<T>(
    service: string, 
    query: object, 
    response: T, 
    type: keyof typeof this.TTLs
  ): Promise<void> {
    const queryHash = this.hashQuery(query);
    const ttl = this.TTLs[type];
    const expiresAt = new Date(Date.now() + ttl * 1000);
    
    await this.db.run(
      `INSERT OR REPLACE INTO scraper_cache (id, service, query_hash, response_json, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [uuid(), service, queryHash, JSON.stringify(response), expiresAt.toISOString()]
    );
  }
  
  private hashQuery(query: object): string {
    const normalized = JSON.stringify(query, Object.keys(query).sort());
    return crypto.createHash('sha1').update(normalized).digest('hex');
  }
}
```

### 1.6 Cache Invalidation Rules

```typescript
interface CacheInvalidationRules {
  // Automatic invalidation triggers
  triggers: {
    // When source is rescanned, invalidate ROM cache for that source
    onSourceRescan: (sourceId: string) => void;
    
    // When profile changes, invalidate computed lists
    onProfileChange: (profileId: string) => void;
    
    // When definitions update, invalidate emulator/platform caches
    onDefinitionUpdate: () => void;
    
    // When user changes metadata, invalidate that game's cache
    onMetadataOverride: (gameId: string) => void;
  };
  
  // Manual invalidation
  manual: {
    clearROMCache: () => void;
    clearMediaCache: () => void;
    clearScraperCache: () => void;
    clearAll: () => void;
  };
}
```

---

## 2. Notification System

### 2.1 Notification Types

```typescript
type NotificationType = 'info' | 'success' | 'warning' | 'error';
type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  
  // Content
  title: string;
  message: string;
  
  // Action
  actionType?: NotificationAction;
  actionData?: Record<string, any>;
  
  // State
  isRead: boolean;
  isDismissed: boolean;
  
  // Timing
  createdAt: Date;
  expiresAt?: Date;
  
  // Grouping
  groupId?: string;  // For grouping related notifications
}

type NotificationAction = 
  | 'view_transfer'
  | 'view_game'
  | 'open_destination'
  | 'view_error'
  | 'dismiss'
  | 'retry'
  | 'cancel'
  | 'open_settings'
  | 'view_update';
```

### 2.2 Notification Priority Behavior

| Priority | Toast | System Tray | Sound | Duration |
|----------|-------|-------------|-------|----------|
| low | No | No | No | N/A |
| normal | Yes | No | No | 5s |
| high | Yes | Yes | Optional | 10s |
| urgent | Yes | Yes | Yes | Until dismissed |

### 2.3 Notification Triggers

```typescript
// Transfer notifications
interface TransferNotifications {
  started: {
    type: 'info';
    priority: 'normal';
    message: 'Transfer started: {profile} to {device}';
  };
  completed: {
    type: 'success';
    priority: 'high';
    message: 'Transfer complete: {count} files ({size})';
    action: 'view_transfer';
  };
  failed: {
    type: 'error';
    priority: 'urgent';
    message: 'Transfer failed: {error}';
    action: 'view_error';
  };
  paused: {
    type: 'info';
    priority: 'normal';
    message: 'Transfer paused: {progress}% complete';
  };
}

// Device notifications
interface DeviceNotifications {
  connected: {
    type: 'info';
    priority: 'normal';
    message: 'Device connected: {deviceName}';
  };
  disconnected: {
    type: 'warning';
    priority: 'urgent';  // Urgent if during transfer
    message: 'Device disconnected: {deviceName}';
  };
  lowSpace: {
    type: 'warning';
    priority: 'high';
    message: 'Low space on {deviceName}: {remaining} remaining';
  };
}

// Scan notifications
interface ScanNotifications {
  completed: {
    type: 'success';
    priority: 'normal';
    message: 'Scan complete: {newCount} new ROMs found';
  };
  error: {
    type: 'error';
    priority: 'high';
    message: 'Scan error: {error}';
  };
}

// Scrape notifications
interface ScrapeNotifications {
  completed: {
    type: 'success';
    priority: 'normal';
    message: 'Scraping complete: {count} games updated';
  };
  rateLimited: {
    type: 'warning';
    priority: 'normal';
    message: 'Rate limited by {service}. Resuming in {minutes} minutes.';
  };
}

// Update notifications
interface UpdateNotifications {
  appUpdateAvailable: {
    type: 'info';
    priority: 'high';
    message: 'Update available: ROM Runner {version}';
    action: 'view_update';
  };
  definitionsUpdated: {
    type: 'success';
    priority: 'low';
    message: 'Definition pack updated to {version}';
  };
}
```

### 2.4 System Notification Integration

```typescript
// Use Tauri's notification API for system notifications
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';

class SystemNotificationService {
  private enabled: boolean = true;
  
  async initialize(): Promise<void> {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }
    this.enabled = permissionGranted;
  }
  
  async send(notification: Notification): Promise<void> {
    // Only send high/urgent priority to system
    if (notification.priority !== 'high' && notification.priority !== 'urgent') {
      return;
    }
    
    if (!this.enabled) return;
    
    await sendNotification({
      title: notification.title,
      body: notification.message,
      icon: this.getIcon(notification.type),
    });
  }
  
  private getIcon(type: NotificationType): string {
    switch (type) {
      case 'info': return 'info-circle';
      case 'success': return 'check-circle';
      case 'warning': return 'alert-triangle';
      case 'error': return 'x-circle';
    }
  }
}
```

### 2.5 Notification Store (Zustand)

```typescript
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead' | 'isDismissed'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  clearOld: (maxAgeDays: number) => void;
}
```

### 2.6 Toast Component

```typescript
// React toast component using Radix UI
interface ToastProps {
  notification: Notification;
  onDismiss: () => void;
  onAction?: () => void;
}

const Toast: React.FC<ToastProps> = ({ notification, onDismiss, onAction }) => {
  const icons = {
    info: InfoIcon,
    success: CheckCircleIcon,
    warning: AlertTriangleIcon,
    error: XCircleIcon,
  };
  
  const Icon = icons[notification.type];
  
  return (
    <RadixToast.Root
      className={cn(
        'toast',
        `toast--${notification.type}`,
        notification.priority === 'urgent' && 'toast--urgent'
      )}
      duration={getDuration(notification.priority)}
    >
      <div className="toast__icon">
        <Icon />
      </div>
      <div className="toast__content">
        <RadixToast.Title className="toast__title">
          {notification.title}
        </RadixToast.Title>
        <RadixToast.Description className="toast__message">
          {notification.message}
        </RadixToast.Description>
      </div>
      {notification.actionType && (
        <RadixToast.Action altText="View" onClick={onAction}>
          View
        </RadixToast.Action>
      )}
      <RadixToast.Close onClick={onDismiss} />
    </RadixToast.Root>
  );
};

function getDuration(priority: NotificationPriority): number {
  switch (priority) {
    case 'low': return 3000;
    case 'normal': return 5000;
    case 'high': return 10000;
    case 'urgent': return Infinity;  // Must be manually dismissed
  }
}
```

### 2.7 Notification Settings

```typescript
interface NotificationSettings {
  enabled: boolean;
  systemNotifications: boolean;
  soundEnabled: boolean;
  groupSimilar: boolean;
  maxHistoryDays: number;
  
  // Per-category settings
  categories: {
    transfers: { enabled: boolean; systemNotify: boolean };
    devices: { enabled: boolean; systemNotify: boolean };
    scanning: { enabled: boolean; systemNotify: boolean };
    scraping: { enabled: boolean; systemNotify: boolean };
    updates: { enabled: boolean; systemNotify: boolean };
  };
}
```

---

## 3. Import/Migration from Other Tools

### 3.1 Supported Import Sources

| Source | Import Type | Data Imported |
|--------|-------------|---------------|
| LaunchBox | Database + Media | ROMs, metadata, images, playlists |
| Playnite | Library | ROMs, metadata, collections |
| EmulationStation | gamelists + media | ROMs, metadata, images, favorites |
| RomM | Library + metadata | ROMs, metadata, collections |
| Skraper | Media + local DB | Images, metadata cache |
| RetroArch | Playlists + thumbnails | Playlist entries, thumbnails |

### 3.2 Import Architecture

```typescript
// Abstract importer interface
interface ToolImporter {
  name: string;
  toolId: string;
  
  // Detection
  canImport(path: string): Promise<boolean>;
  detectInstallation(): Promise<string | null>;
  
  // Analysis
  analyzeImport(path: string): Promise<ImportAnalysis>;
  
  // Import
  import(path: string, options: ImportOptions): Promise<ImportResult>;
}

interface ImportAnalysis {
  toolName: string;
  toolVersion: string | null;
  
  // Content counts
  romCount: number;
  platformCount: number;
  platforms: string[];
  
  // Media
  hasMedia: boolean;
  mediaCount: number;
  mediaSize: number;
  
  // Metadata
  hasMetadata: boolean;
  metadataSource: string | null;
  
  // Compatibility
  compatibilityIssues: string[];
  warnings: string[];
}

interface ImportOptions {
  // What to import
  importRoms: boolean;
  importMedia: boolean;
  importMetadata: boolean;
  importPlaylists: boolean;
  
  // Conflict handling
  onRomConflict: 'skip' | 'overwrite' | 'keep-both';
  onMediaConflict: 'skip' | 'overwrite' | 'prefer-higher-quality';
  
  // Processing
  recomputeHashes: boolean;
  matchToDATs: boolean;
}

interface ImportResult {
  success: boolean;
  romsImported: number;
  mediaImported: number;
  playlistsImported: number;
  errors: ImportError[];
  warnings: string[];
  duration: number;
}

interface ImportError {
  file: string;
  error: string;
  recoverable: boolean;
}
```

### 3.3 LaunchBox Importer

```typescript
class LaunchBoxImporter implements ToolImporter {
  name = 'LaunchBox';
  toolId = 'launchbox';
  
  async canImport(path: string): Promise<boolean> {
    // Check for LaunchBox.exe and Data folder
    return await fs.exists(join(path, 'LaunchBox.exe')) &&
           await fs.exists(join(path, 'Data'));
  }
  
  async detectInstallation(): Promise<string | null> {
    // Check common locations
    const locations = [
      'C:\\LaunchBox',
      'D:\\LaunchBox',
      join(os.homedir(), 'LaunchBox'),
    ];
    
    for (const loc of locations) {
      if (await this.canImport(loc)) {
        return loc;
      }
    }
    
    // Check registry (Windows)
    try {
      const regKey = await registry.get(
        'HKCU\\SOFTWARE\\LaunchBox',
        'InstallPath'
      );
      if (regKey && await this.canImport(regKey)) {
        return regKey;
      }
    } catch {}
    
    return null;
  }
  
  async analyzeImport(path: string): Promise<ImportAnalysis> {
    const dataPath = join(path, 'Data');
    
    // Parse Platforms.xml
    const platformsXml = await fs.readFile(join(dataPath, 'Platforms.xml'), 'utf-8');
    const platforms = await this.parsePlatformsXml(platformsXml);
    
    // Count ROMs from each platform's XML
    let romCount = 0;
    for (const platform of platforms) {
      const platformXml = join(dataPath, 'Platforms', `${platform}.xml`);
      if (await fs.exists(platformXml)) {
        const content = await fs.readFile(platformXml, 'utf-8');
        romCount += this.countGamesInXml(content);
      }
    }
    
    // Check media
    const imagesPath = join(path, 'Images');
    const hasMedia = await fs.exists(imagesPath);
    
    return {
      toolName: 'LaunchBox',
      toolVersion: await this.getVersion(path),
      romCount,
      platformCount: platforms.length,
      platforms,
      hasMedia,
      mediaCount: hasMedia ? await this.countMedia(imagesPath) : 0,
      mediaSize: hasMedia ? await this.getMediaSize(imagesPath) : 0,
      hasMetadata: true,
      metadataSource: 'LaunchBox Games Database',
      compatibilityIssues: [],
      warnings: [],
    };
  }
  
  async import(path: string, options: ImportOptions): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      romsImported: 0,
      mediaImported: 0,
      playlistsImported: 0,
      errors: [],
      warnings: [],
      duration: 0,
    };
    
    const startTime = Date.now();
    
    try {
      // Import platforms and ROMs
      if (options.importRoms) {
        const dataPath = join(path, 'Data');
        const platformsXml = await fs.readFile(join(dataPath, 'Platforms.xml'), 'utf-8');
        const platforms = await this.parsePlatformsXml(platformsXml);
        
        for (const platform of platforms) {
          const imported = await this.importPlatform(path, platform, options);
          result.romsImported += imported.roms;
          result.errors.push(...imported.errors);
        }
      }
      
      // Import media
      if (options.importMedia) {
        const mediaResult = await this.importMedia(path, options);
        result.mediaImported = mediaResult.count;
        result.errors.push(...mediaResult.errors);
      }
      
      // Import playlists
      if (options.importPlaylists) {
        const playlistResult = await this.importPlaylists(path, options);
        result.playlistsImported = playlistResult.count;
        result.errors.push(...playlistResult.errors);
      }
      
    } catch (e) {
      result.success = false;
      result.errors.push({
        file: path,
        error: e.message,
        recoverable: false,
      });
    }
    
    result.duration = Date.now() - startTime;
    return result;
  }
  
  private async parsePlatformsXml(xml: string): Promise<string[]> {
    // Parse XML and extract platform names
    const parser = new XMLParser();
    const doc = parser.parse(xml);
    return doc.LaunchBox?.Platform?.map((p: any) => p.Name) || [];
  }
  
  private countGamesInXml(xml: string): number {
    // Count <Game> elements
    const matches = xml.match(/<Game>/g);
    return matches ? matches.length : 0;
  }
}
```

### 3.4 EmulationStation Importer

```typescript
class EmulationStationImporter implements ToolImporter {
  name = 'EmulationStation';
  toolId = 'emulationstation';
  
  async canImport(path: string): Promise<boolean> {
    // Check for gamelists folder or es_systems.cfg
    return await fs.exists(join(path, 'gamelists')) ||
           await fs.exists(join(path, '.emulationstation', 'gamelists'));
  }
  
  async analyzeImport(path: string): Promise<ImportAnalysis> {
    const gamelistsPath = await this.findGamelistsPath(path);
    if (!gamelistsPath) {
      return {
        toolName: 'EmulationStation',
        toolVersion: null,
        romCount: 0,
        platformCount: 0,
        platforms: [],
        hasMedia: false,
        mediaCount: 0,
        mediaSize: 0,
        hasMetadata: false,
        metadataSource: null,
        compatibilityIssues: ['Could not find gamelists folder'],
        warnings: [],
      };
    }
    
    // Find all gamelist.xml files
    const gamelists = await fs.readdir(gamelistsPath);
    const platforms: string[] = [];
    let romCount = 0;
    let mediaCount = 0;
    
    for (const platform of gamelists) {
      const gamelistFile = join(gamelistsPath, platform, 'gamelist.xml');
      if (await fs.exists(gamelistFile)) {
        platforms.push(platform);
        const content = await fs.readFile(gamelistFile, 'utf-8');
        romCount += this.countGamesInGamelist(content);
        
        // Check for media
        const mediaPath = join(gamelistsPath, platform, 'media');
        if (await fs.exists(mediaPath)) {
          mediaCount += await this.countFilesRecursive(mediaPath);
        }
      }
    }
    
    return {
      toolName: 'EmulationStation',
      toolVersion: null,
      romCount,
      platformCount: platforms.length,
      platforms,
      hasMedia: mediaCount > 0,
      mediaCount,
      mediaSize: 0,  // Calculate if needed
      hasMetadata: true,
      metadataSource: 'gamelist.xml',
      compatibilityIssues: [],
      warnings: [],
    };
  }
  
  private countGamesInGamelist(xml: string): number {
    const matches = xml.match(/<game>/gi);
    return matches ? matches.length : 0;
  }
}
```

### 3.5 Playnite Importer

```typescript
class PlayniteImporter implements ToolImporter {
  name = 'Playnite';
  toolId = 'playnite';
  
  async canImport(path: string): Promise<boolean> {
    // Check for games.db or library folder
    return await fs.exists(join(path, 'library', 'games.db')) ||
           await fs.exists(join(path, 'games.db'));
  }
  
  async detectInstallation(): Promise<string | null> {
    const locations = [
      join(process.env.APPDATA || '', 'Playnite'),
      join(process.env.LOCALAPPDATA || '', 'Playnite'),
    ];
    
    for (const loc of locations) {
      if (await this.canImport(loc)) {
        return loc;
      }
    }
    
    return null;
  }
  
  async analyzeImport(path: string): Promise<ImportAnalysis> {
    // Playnite uses LiteDB
    const dbPath = join(path, 'library', 'games.db');
    
    // Open LiteDB and count entries
    // Note: Would need LiteDB binding or export to JSON first
    
    return {
      toolName: 'Playnite',
      toolVersion: null,
      romCount: 0,  // Calculated from DB
      platformCount: 0,
      platforms: [],
      hasMedia: true,
      mediaCount: 0,
      mediaSize: 0,
      hasMetadata: true,
      metadataSource: 'Playnite Database',
      compatibilityIssues: [],
      warnings: ['Playnite import requires database export or LiteDB access'],
    };
  }
}
```

### 3.6 RomM Importer

```typescript
class RomMImporter implements ToolImporter {
  name = 'RomM';
  toolId = 'romm';
  
  async canImport(path: string): Promise<boolean> {
    // RomM is typically a Docker-based server
    // Check for exported JSON or direct database access
    return await fs.exists(join(path, 'romm_export.json')) ||
           await fs.exists(join(path, 'database', 'romm.db'));
  }
  
  async analyzeImport(path: string): Promise<ImportAnalysis> {
    // Check for export file first
    const exportPath = join(path, 'romm_export.json');
    if (await fs.exists(exportPath)) {
      const data = JSON.parse(await fs.readFile(exportPath, 'utf-8'));
      return {
        toolName: 'RomM',
        toolVersion: data.version || null,
        romCount: data.roms?.length || 0,
        platformCount: data.platforms?.length || 0,
        platforms: data.platforms?.map((p: any) => p.name) || [],
        hasMedia: true,
        mediaCount: 0,
        mediaSize: 0,
        hasMetadata: true,
        metadataSource: 'RomM',
        compatibilityIssues: [],
        warnings: [],
      };
    }
    
    return {
      toolName: 'RomM',
      toolVersion: null,
      romCount: 0,
      platformCount: 0,
      platforms: [],
      hasMedia: false,
      mediaCount: 0,
      mediaSize: 0,
      hasMetadata: false,
      metadataSource: null,
      compatibilityIssues: ['No export file found. Export from RomM first.'],
      warnings: [],
    };
  }
}
```

### 3.7 Skraper Importer

```typescript
class SkraperImporter implements ToolImporter {
  name = 'Skraper';
  toolId = 'skraper';
  
  async canImport(path: string): Promise<boolean> {
    // Check for Skraper cache folder
    return await fs.exists(join(path, 'cache')) ||
           await fs.exists(join(path, 'medias'));
  }
  
  // Imports media and metadata cache from Skraper
  async analyzeImport(path: string): Promise<ImportAnalysis> {
    const cachePath = join(path, 'cache');
    const mediasPath = join(path, 'medias');
    
    let mediaCount = 0;
    let mediaSize = 0;
    
    if (await fs.exists(mediasPath)) {
      const result = await this.analyzeMediaFolder(mediasPath);
      mediaCount = result.count;
      mediaSize = result.size;
    }
    
    return {
      toolName: 'Skraper',
      toolVersion: null,
      romCount: 0,  // Skraper doesn't track ROMs, just media
      platformCount: 0,
      platforms: [],
      hasMedia: mediaCount > 0,
      mediaCount,
      mediaSize,
      hasMetadata: await fs.exists(cachePath),
      metadataSource: 'ScreenScraper (cached)',
      compatibilityIssues: [],
      warnings: ['Skraper import only includes media, not ROM information'],
    };
  }
}
```

### 3.8 Import UI Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Import from Other Tools                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Step 1: Select Source                                           │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ ○ LaunchBox         [Auto-detect: C:\LaunchBox]            ││
│ │ ○ Playnite          [Not found]                            ││
│ │ ○ EmulationStation  [Browse...]                            ││
│ │ ○ RomM              [Browse...]                            ││
│ │ ○ Skraper           [Browse...]                            ││
│ │ ○ RetroArch         [Browse...]                            ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Step 2: Analysis                                                │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Found:                                                      ││
│ │   • 2,345 ROMs across 24 platforms                         ││
│ │   • 4,567 images (2.3 GB)                                  ││
│ │   • 12 playlists                                           ││
│ │                                                             ││
│ │ ⚠ 3 warnings:                                              ││
│ │   • Some ROMs may not match existing library               ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Step 3: Options                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ ☑ Import ROMs (match to existing library)                  ││
│ │ ☑ Import Media (images, videos)                            ││
│ │ ☑ Import Metadata (descriptions, ratings)                  ││
│ │ ☑ Import Playlists                                         ││
│ │                                                             ││
│ │ On conflict:                                                ││
│ │   ROMs:   [Skip existing ▼]                                ││
│ │   Media:  [Prefer higher quality ▼]                        ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                              [Cancel]  [Import]                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Scraping & Metadata Resolution

### 4.1 Scraper Fallback Chain

When the primary scraper doesn't find a game, ROM Runner cascades through backup services:

```typescript
interface ScraperServiceConfig {
  id: string;
  name: string;
  priority: number;           // Lower = higher priority
  enabled: boolean;
  requiresCredentials: boolean;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  capabilities: {
    metadata: boolean;
    boxart: boolean;
    screenshots: boolean;
    videos: boolean;
    manuals: boolean;
  };
}

const defaultFallbackChain: ScraperServiceConfig[] = [
  {
    id: 'screenscraper',
    name: 'ScreenScraper',
    priority: 1,
    enabled: true,
    requiresCredentials: true,
    rateLimit: { requestsPerMinute: 60, requestsPerDay: 10000 },
    capabilities: {
      metadata: true,
      boxart: true,
      screenshots: true,
      videos: true,
      manuals: true,
    },
  },
  {
    id: 'thegamesdb',
    name: 'TheGamesDB',
    priority: 2,
    enabled: true,
    requiresCredentials: true,
    rateLimit: { requestsPerMinute: 30, requestsPerDay: 3000 },
    capabilities: {
      metadata: true,
      boxart: true,
      screenshots: true,
      videos: false,
      manuals: false,
    },
  },
  {
    id: 'igdb',
    name: 'IGDB',
    priority: 3,
    enabled: true,
    requiresCredentials: true,
    rateLimit: { requestsPerMinute: 4, requestsPerDay: 500 },
    capabilities: {
      metadata: true,
      boxart: true,
      screenshots: true,
      videos: false,
      manuals: false,
    },
  },
  {
    id: 'launchbox',
    name: 'LaunchBox DB',
    priority: 4,
    enabled: true,
    requiresCredentials: false,
    rateLimit: { requestsPerMinute: 30, requestsPerDay: 5000 },
    capabilities: {
      metadata: true,
      boxart: true,
      screenshots: true,
      videos: false,
      manuals: false,
    },
  },
  {
    id: 'mobygames',
    name: 'MobyGames',
    priority: 5,
    enabled: false,  // Disabled by default (strict rate limits)
    requiresCredentials: true,
    rateLimit: { requestsPerMinute: 1, requestsPerDay: 360 },
    capabilities: {
      metadata: true,
      boxart: true,
      screenshots: true,
      videos: false,
      manuals: false,
    },
  },
];
```

### 4.2 Fallback Behavior

```typescript
interface FallbackBehavior {
  // When primary returns no results
  onNoResults: 'try-next' | 'stop';
  
  // When primary returns partial data
  onPartialData: 'try-next-for-missing' | 'accept-partial' | 'stop';
  
  // Maximum services to try
  maxServicesToTry: number;  // Default: 3
  
  // Whether to merge data from multiple services
  mergeResults: boolean;  // Default: true
}
```

### 4.3 Metadata Conflict Resolution

When multiple sources provide conflicting data, use these resolution strategies:

```typescript
type ResolutionStrategy = 
  | 'prefer_source'     // Always use first source's value
  | 'prefer_recent'     // Use most recently updated value
  | 'prefer_detailed'   // Use longest/most detailed value
  | 'prefer_majority'   // Use value that appears most often
  | 'manual';           // Ask user to resolve

interface MetadataResolutionConfig {
  // Per-field strategies
  fieldStrategies: Record<string, ResolutionStrategy>;
  
  // Source priority (used for prefer_source)
  sourcePriority: string[];  // ['screenscraper', 'igdb', 'thegamesdb', ...]
  
  // Store alternatives for manual review
  storeAlternatives: boolean;
}

const defaultResolutionConfig: MetadataResolutionConfig = {
  fieldStrategies: {
    // Use most detailed for text fields
    description: 'prefer_detailed',
    
    // Use most trusted source for dates
    releaseDate: 'prefer_source',
    
    // Use majority for categorical data
    developer: 'prefer_majority',
    publisher: 'prefer_majority',
    genre: 'prefer_majority',
    
    // Use most recent for ratings (they change over time)
    rating: 'prefer_recent',
    
    // Use most detailed for player info
    players: 'prefer_detailed',
  },
  
  sourcePriority: ['screenscraper', 'igdb', 'thegamesdb', 'launchbox', 'mobygames'],
  
  storeAlternatives: true,
};
```

### 4.4 Conflict Resolution UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Resolve Metadata Conflicts - Chrono Trigger                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Release Date:                                                   │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ ○ March 11, 1995 (ScreenScraper)                           ││
│ │ ● August 22, 1995 (IGDB) ← US Release                      ││
│ │ ○ November 17, 1995 (TheGamesDB) ← EU Release              ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Developer:                                                      │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ ● Square (ScreenScraper, IGDB)                             ││
│ │ ○ Square Co., Ltd. (TheGamesDB)                            ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ☐ Apply to all similar conflicts                                │
│                                                                 │
│                    [Skip]  [Apply]  [Apply to All]              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Network Source Details

### 5.1 Network Source Types

ROM Runner supports various network source types for accessing ROM collections:

```typescript
type NetworkSourceType = 'smb' | 'nfs' | 'webdav' | 'sftp' | 'ftp';

interface NetworkSourceConfig {
  id: string;
  name: string;
  type: NetworkSourceType;
  
  // Connection
  host: string;
  port: number | null;    // null = use default
  path: string;
  
  // Authentication
  authType: 'none' | 'basic' | 'ntlm' | 'kerberos' | 'key';
  username: string | null;
  password: string | null;  // Stored in OS keychain
  privateKeyPath: string | null;  // For SFTP with key auth
  domain: string | null;    // For NTLM
  
  // Behavior
  timeout: number;          // Connection timeout (ms)
  retryAttempts: number;
  autoReconnect: boolean;
  
  // Caching
  cacheEnabled: boolean;
  cacheTTL: number;         // How long to cache directory listings (seconds)
}
```

### 5.2 SMB/CIFS Support

```typescript
interface SMBConfig extends NetworkSourceConfig {
  type: 'smb';
  
  // SMB-specific
  smbVersion: '2.0' | '2.1' | '3.0' | '3.1.1' | 'auto';
  shareName: string;
  
  // Authentication
  authType: 'none' | 'basic' | 'ntlm' | 'kerberos';
  domain: string | null;
  
  // Options
  followSymlinks: boolean;
  caseSensitive: boolean;
}

// Connection example
const smbSource: SMBConfig = {
  id: 'nas-roms',
  name: 'NAS ROM Collection',
  type: 'smb',
  host: '192.168.1.100',
  port: null,  // 445
  path: '/ROMs',
  shareName: 'media',
  smbVersion: 'auto',
  authType: 'basic',
  username: 'romrunner',
  password: null,  // Retrieved from keychain
  domain: null,
  timeout: 30000,
  retryAttempts: 3,
  autoReconnect: true,
  cacheEnabled: true,
  cacheTTL: 300,
  followSymlinks: true,
  caseSensitive: false,
};
```

### 5.3 NFS Support

```typescript
interface NFSConfig extends NetworkSourceConfig {
  type: 'nfs';
  
  // NFS-specific
  nfsVersion: '3' | '4' | '4.1' | 'auto';
  exportPath: string;
  
  // Options
  uid: number | null;
  gid: number | null;
  readOnly: boolean;
}
```

### 5.4 WebDAV Support

```typescript
interface WebDAVConfig extends NetworkSourceConfig {
  type: 'webdav';
  
  // WebDAV-specific
  useSSL: boolean;
  verifySSL: boolean;
  
  // Authentication
  authType: 'none' | 'basic' | 'digest';
}
```

### 5.5 SFTP Support

```typescript
interface SFTPConfig extends NetworkSourceConfig {
  type: 'sftp';
  
  // Authentication
  authType: 'basic' | 'key';
  privateKeyPath: string | null;
  privateKeyPassphrase: string | null;  // Stored in keychain
  
  // Options
  compression: boolean;
  keepaliveInterval: number;
}
```

### 5.6 Retry Logic

```typescript
interface RetryConfig {
  maxAttempts: number;          // Default: 3
  initialDelay: number;         // Default: 1000ms
  maxDelay: number;             // Default: 30000ms
  backoffMultiplier: number;    // Default: 2 (exponential)
  retryableErrors: string[];    // Error codes to retry
}

async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.initialDelay;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      if (!isRetryable(error, config.retryableErrors)) {
        throw error;
      }
      
      // Don't delay after last attempt
      if (attempt < config.maxAttempts) {
        await sleep(delay);
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }
  }
  
  throw lastError;
}

const retryableErrors = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
];
```

### 5.7 Credential Storage

```typescript
// Use OS keychain for secure credential storage
import { getPassword, setPassword, deletePassword } from 'keyring';

class CredentialManager {
  private service = 'ROM Runner';
  
  async getCredentials(sourceId: string): Promise<Credentials | null> {
    const key = `network-source-${sourceId}`;
    const stored = await getPassword(this.service, key);
    
    if (!stored) return null;
    
    return JSON.parse(stored);
  }
  
  async setCredentials(sourceId: string, credentials: Credentials): Promise<void> {
    const key = `network-source-${sourceId}`;
    await setPassword(this.service, key, JSON.stringify(credentials));
  }
  
  async deleteCredentials(sourceId: string): Promise<void> {
    const key = `network-source-${sourceId}`;
    await deletePassword(this.service, key);
  }
}

interface Credentials {
  username: string;
  password?: string;
  privateKeyPassphrase?: string;
  domain?: string;
}
```

### 5.8 Offline Handling

```typescript
interface OfflineHandling {
  // What works offline
  offlineCapable: {
    localSourceScanning: true;
    localTransfers: true;
    profileManagement: true;
    listCreation: true;  // From cached data
    metadataViewing: true;  // Cached metadata
  };
  
  // What requires network
  requiresNetwork: {
    networkSourceScanning: true;
    metadataScraping: true;
    definitionUpdates: true;
    ratingUpdates: true;
    accountLinking: true;
  };
  
  // Graceful degradation
  whenOffline: {
    showOfflineIndicator: true;
    useCachedDefinitions: true;
    useCachedMetadata: true;
    queueNetworkOperations: true;  // For later when online
    disableNetworkSources: true;
  };
}
```

---

## 6. ROM Hacks, Fan Games & Custom Content

### 6.1 ROM Hack Support

#### Supported Patch Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| IPS | .ips | International Patching System (max 16MB) |
| BPS | .bps | Beat Patching System (with CRC32) |
| UPS | .ups | Universal Patching System |
| xdelta | .xdelta, .vcdiff | xdelta/VCDIFF format |
| PPF | .ppf | PlayStation Patch Format |

#### ROM Hack Categories

```typescript
type ROMHackCategory = 
  | 'enhancement'       // Bug fixes, QoL improvements
  | 'difficulty'        // Hard modes, easy modes
  | 'translation'       // Fan translations
  | 'overhaul'          // Complete game changes
  | 'graphics'          // Visual upgrades
  | 'audio'             // Music/sound changes
  | 'randomizer'        // Randomized content
  | 'demake'            // Ports to older systems
  | 'other';

interface ROMHack {
  id: string;
  name: string;
  category: ROMHackCategory;
  
  // Base ROM info
  basePlatformId: string;
  baseGameId: string;
  baseRomHash: string;         // Expected hash of base ROM
  
  // Patch info
  patchFormat: 'ips' | 'bps' | 'ups' | 'xdelta' | 'ppf';
  patchPath: string;
  patchHash: string;
  
  // Metadata
  author: string;
  version: string;
  releaseDate: string | null;
  description: string;
  sourceUrl: string | null;    // romhacking.net, etc.
  
  // Output info
  outputFilename: string;
  outputHash: string | null;   // Expected hash after patching
}
```

### 6.2 Pokemon ROM Hack Ecosystem

Pokemon hacks have special handling due to their popularity and complexity:

```typescript
interface PokemonHackInfo {
  // Base info
  hackName: string;
  baseGame: 'red' | 'blue' | 'yellow' | 'gold' | 'silver' | 'crystal' | 
            'ruby' | 'sapphire' | 'emerald' | 'firered' | 'leafgreen' |
            'diamond' | 'pearl' | 'platinum' | 'heartgold' | 'soulsilver' |
            'black' | 'white' | 'black2' | 'white2' |
            'x' | 'y' | 'oras' | 'sunmoon' | 'usum' | 'swsh';
  
  // Hack type
  hackType: 'enhancement' | 'difficulty' | 'overhaul' | 'dex-expansion' | 
            'qol' | 'nuzlocke' | 'randomizer';
  
  // Features
  features: {
    newPokemon: boolean;        // Adds fakemon or later-gen Pokemon
    newMoves: boolean;
    newAbilities: boolean;
    physicalSpecialSplit: boolean;  // For Gen 1-3 hacks
    fairyType: boolean;         // For pre-Gen 6 hacks
    megaEvolutions: boolean;
    zMoves: boolean;
    dynamax: boolean;
    newRegion: boolean;
    expandedDex: boolean;
    difficultyOptions: boolean;
  };
  
  // Community info
  communityRating: number | null;
  recommendedFor: ('beginners' | 'veterans' | 'nuzlockers' | 'completionists')[];
  completionTime: string | null;  // e.g., "40-60 hours"
  
  // Sources
  pokecommunityUrl: string | null;
  gbatempUrl: string | null;
  redditUrl: string | null;
  discordUrl: string | null;
}

// Popular Pokemon hacks to pre-populate
const popularPokemonHacks: PokemonHackInfo[] = [
  {
    hackName: 'Pokemon Radical Red',
    baseGame: 'firered',
    hackType: 'difficulty',
    features: {
      newPokemon: true,  // Up to Gen 8
      newMoves: true,
      newAbilities: true,
      physicalSpecialSplit: true,
      fairyType: true,
      megaEvolutions: true,
      zMoves: false,
      dynamax: false,
      newRegion: false,
      expandedDex: true,
      difficultyOptions: true,
    },
    communityRating: 9.5,
    recommendedFor: ['veterans', 'nuzlockers'],
    completionTime: '30-50 hours',
    pokecommunityUrl: 'https://www.pokecommunity.com/...',
    gbatempUrl: null,
    redditUrl: 'https://reddit.com/r/pokemonradicalred',
    discordUrl: 'https://discord.gg/...',
  },
  {
    hackName: 'Pokemon Unbound',
    baseGame: 'firered',
    hackType: 'overhaul',
    features: {
      newPokemon: true,
      newMoves: true,
      newAbilities: true,
      physicalSpecialSplit: true,
      fairyType: true,
      megaEvolutions: true,
      zMoves: true,
      dynamax: false,
      newRegion: true,
      expandedDex: true,
      difficultyOptions: true,
    },
    communityRating: 9.8,
    recommendedFor: ['beginners', 'veterans', 'completionists'],
    completionTime: '50-80 hours',
    pokecommunityUrl: 'https://www.pokecommunity.com/...',
    gbatempUrl: null,
    redditUrl: null,
    discordUrl: 'https://discord.gg/...',
  },
  // ... more popular hacks
];
```

### 6.3 Fan-Made Games

Support for standalone fan-made games:

```typescript
type FanGameEngine = 
  | 'rpg-maker-xp'
  | 'rpg-maker-vx'
  | 'rpg-maker-vx-ace'
  | 'rpg-maker-mv'
  | 'rpg-maker-mz'
  | 'gamemaker'
  | 'unity'
  | 'godot'
  | 'pico-8'
  | 'love2d'
  | 'renpy'
  | 'custom';

interface FanGame {
  id: string;
  name: string;
  engine: FanGameEngine;
  
  // What it's based on
  basedOn: string | null;      // e.g., "Pokemon", "Zelda", null for original
  
  // Files
  executablePath: string;
  dataPath: string;
  
  // Requirements
  requiresRTP: boolean;        // RPG Maker Runtime Package
  rtpVersion: string | null;
  windowsOnly: boolean;
  
  // Players
  supportedPlayers: {
    joiplay: boolean;          // Android RPG Maker player
    easyrpg: boolean;          // Open-source RPG Maker 2000/2003 player
    mkxp: boolean;             // Open-source RGSS player
    native: boolean;           // Runs natively
  };
  
  // Metadata
  author: string;
  version: string;
  description: string;
  downloadUrl: string | null;
}

// Popular Pokemon fan games
const popularPokemonFanGames: FanGame[] = [
  {
    id: 'pokemon-insurgence',
    name: 'Pokemon Insurgence',
    engine: 'rpg-maker-xp',
    basedOn: 'Pokemon',
    executablePath: 'Game.exe',
    dataPath: 'Data',
    requiresRTP: false,  // Bundled
    rtpVersion: null,
    windowsOnly: true,
    supportedPlayers: {
      joiplay: true,
      easyrpg: false,
      mkxp: true,
      native: true,
    },
    author: 'thesuzerain',
    version: '1.2.7',
    description: 'Dark Pokemon game with Delta species',
    downloadUrl: 'https://p-insurgence.com/',
  },
  // ... more fan games
];
```

### 6.4 PortMaster Integration

For Linux CFWs (KNULLI, ArkOS, AmberELEC, ROCKNIX):

```typescript
interface PortMasterGame {
  id: string;
  name: string;
  portMasterId: string;       // ID in PortMaster database
  
  // Requirements
  requiresGameFiles: boolean;  // Needs original game files
  requiredFiles: string[];     // List of required files
  sourceType: 'free' | 'commercial-required';
  
  // Compatibility
  supportedCFWs: string[];     // ['knulli', 'arkos', 'amberelec', 'rocknix']
  supportedDevices: string[];  // Specific device requirements
  
  // Installation
  installPath: string;
  installSize: number;         // bytes
  
  // Metadata
  description: string;
  genre: string;
  releaseYear: number | null;
  website: string | null;
}

// Example PortMaster games
const portMasterGames: PortMasterGame[] = [
  {
    id: 'stardew-valley',
    name: 'Stardew Valley',
    portMasterId: 'stardewvalley',
    requiresGameFiles: true,
    requiredFiles: ['Content', 'Stardew Valley.exe'],
    sourceType: 'commercial-required',
    supportedCFWs: ['knulli', 'arkos', 'amberelec', 'rocknix'],
    supportedDevices: ['rg35xx-plus', 'rg35xx-h', 'rgb30', 'rg-arc'],
    installPath: '/roms/ports/stardewvalley',
    installSize: 500_000_000,
    description: 'Farming simulation RPG',
    genre: 'Simulation',
    releaseYear: 2016,
    website: 'https://www.stardewvalley.net/',
  },
  {
    id: 'cave-story',
    name: 'Cave Story',
    portMasterId: 'cavestory',
    requiresGameFiles: false,  // Freeware version
    requiredFiles: [],
    sourceType: 'free',
    supportedCFWs: ['knulli', 'arkos', 'amberelec', 'rocknix'],
    supportedDevices: [],  // All supported
    installPath: '/roms/ports/cavestory',
    installSize: 20_000_000,
    description: 'Classic action-adventure platformer',
    genre: 'Action',
    releaseYear: 2004,
    website: null,
  },
];
```

### 6.5 Patch Application Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Patch Application Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User adds patch file                                        │
│     - Specify which base ROM it patches                         │
│     - Or auto-detect from patch metadata                        │
│                                                                  │
│  2. Verify base ROM                                             │
│     - Check hash matches expected                               │
│     - Warn if mismatch (patch may fail)                         │
│                                                                  │
│  3. During transfer:                                            │
│     - Read base ROM                                             │
│     - Apply patch in memory                                     │
│     - Write patched ROM to destination                          │
│     - Do not modify source                                      │
│                                                                  │
│  4. Generate metadata                                           │
│     - Use hack name/description                                 │
│     - Link to original game metadata                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.6 Android Fan Game Support

```typescript
// Players for running fan games on Android handhelds
interface AndroidFanGamePlayer {
  id: string;
  name: string;
  packageName: string;
  supportedEngines: FanGameEngine[];
  downloadUrl: string;
  notes: string;
}

const androidFanGamePlayers: AndroidFanGamePlayer[] = [
  {
    id: 'joiplay',
    name: 'JoiPlay',
    packageName: 'com.joiplay.joiplay',
    supportedEngines: ['rpg-maker-xp', 'rpg-maker-vx', 'rpg-maker-vx-ace', 'rpg-maker-mv', 'renpy'],
    downloadUrl: 'https://joiplay.cyou/',
    notes: 'Requires JoiPlay RPG Maker plugin for RPG Maker games',
  },
  {
    id: 'easyrpg',
    name: 'EasyRPG Player',
    packageName: 'org.easyrpg.player',
    supportedEngines: ['rpg-maker-2000', 'rpg-maker-2003'],
    downloadUrl: 'https://easyrpg.org/',
    notes: 'Open-source RPG Maker 2000/2003 interpreter',
  },
  {
    id: 'love-android',
    name: 'LÖVE for Android',
    packageName: 'org.love2d.android',
    supportedEngines: ['love2d'],
    downloadUrl: 'https://love2d.org/',
    notes: 'Run .love files directly',
  },
];
```

---

## 7. Shader & Controller Configuration

### 7.1 Shader Management

#### Scope Levels

Shaders can be configured at multiple levels, with more specific scopes overriding broader ones:

1. **Global Default** - Applied to all games
2. **Per-Platform** - Applied to all games of a platform
3. **Per-Selection/List** - Applied to games in a specific list
4. **Per-ROM** - Applied to a specific game

```typescript
type ShaderScope = 'global' | 'platform' | 'list' | 'rom';

interface ShaderPreset {
  id: string;
  name: string;
  category: ShaderCategory;
  
  // Shader file info
  shaderPath: string;          // Path to .glslp/.slangp file
  shaderType: 'glsl' | 'slang' | 'cg';
  
  // Compatibility
  supportedAPIs: ('opengl' | 'vulkan' | 'direct3d')[];
  performanceImpact: 'low' | 'medium' | 'high' | 'very-high';
  
  // Recommended for
  recommendedFor: string[];    // Platform IDs
  
  // Preview
  previewImage: string | null;
  description: string;
}

type ShaderCategory = 
  | 'crt'              // CRT simulation
  | 'lcd'              // LCD effects
  | 'scanlines'        // Scanline overlays
  | 'smoothing'        // xBR, HQx, etc.
  | 'sharpen'          // Sharpening
  | 'ntsc'             // NTSC artifacts
  | 'handheld'         // Handheld screen simulation
  | 'artistic'         // Artistic effects
  | 'none';            // Pass-through
```

#### Common Shader Presets

```typescript
const commonShaderPresets: ShaderPreset[] = [
  {
    id: 'crt-royale',
    name: 'CRT-Royale',
    category: 'crt',
    shaderPath: 'shaders/crt/crt-royale.slangp',
    shaderType: 'slang',
    supportedAPIs: ['vulkan', 'opengl'],
    performanceImpact: 'very-high',
    recommendedFor: ['nes', 'snes', 'genesis', 'n64', 'psx'],
    previewImage: 'previews/crt-royale.png',
    description: 'High-quality CRT simulation with accurate phosphors and geometry',
  },
  {
    id: 'crt-geom',
    name: 'CRT-Geom',
    category: 'crt',
    shaderPath: 'shaders/crt/crt-geom.slangp',
    shaderType: 'slang',
    supportedAPIs: ['vulkan', 'opengl'],
    performanceImpact: 'medium',
    recommendedFor: ['nes', 'snes', 'genesis', 'n64', 'psx'],
    previewImage: 'previews/crt-geom.png',
    description: 'CRT simulation with adjustable curvature and scanlines',
  },
  {
    id: 'crt-pi',
    name: 'CRT-Pi',
    category: 'crt',
    shaderPath: 'shaders/crt/crt-pi.slangp',
    shaderType: 'slang',
    supportedAPIs: ['vulkan', 'opengl'],
    performanceImpact: 'low',
    recommendedFor: ['nes', 'snes', 'genesis'],
    previewImage: 'previews/crt-pi.png',
    description: 'Lightweight CRT shader optimized for low-power devices',
  },
  {
    id: 'xbr-4x',
    name: 'xBR 4x',
    category: 'smoothing',
    shaderPath: 'shaders/xbr/xbr-4x.slangp',
    shaderType: 'slang',
    supportedAPIs: ['vulkan', 'opengl'],
    performanceImpact: 'medium',
    recommendedFor: ['nes', 'snes', 'gba', 'gbc'],
    previewImage: 'previews/xbr-4x.png',
    description: 'Edge-smoothing that preserves sharp details',
  },
  {
    id: 'gba-color',
    name: 'GBA Color Correction',
    category: 'handheld',
    shaderPath: 'shaders/handheld/gba-color.slangp',
    shaderType: 'slang',
    supportedAPIs: ['vulkan', 'opengl'],
    performanceImpact: 'low',
    recommendedFor: ['gba'],
    previewImage: 'previews/gba-color.png',
    description: 'Simulates GBA screen color characteristics',
  },
  {
    id: 'gb-dmg',
    name: 'Game Boy DMG',
    category: 'handheld',
    shaderPath: 'shaders/handheld/gb-dmg.slangp',
    shaderType: 'slang',
    supportedAPIs: ['vulkan', 'opengl'],
    performanceImpact: 'low',
    recommendedFor: ['gb'],
    previewImage: 'previews/gb-dmg.png',
    description: 'Classic green-tinted Game Boy look',
  },
  {
    id: 'none',
    name: 'None (Pass-through)',
    category: 'none',
    shaderPath: '',
    shaderType: 'slang',
    supportedAPIs: ['vulkan', 'opengl', 'direct3d'],
    performanceImpact: 'low',
    recommendedFor: [],
    previewImage: null,
    description: 'No shader effects applied',
  },
];
```

### 7.2 Controller Configuration

#### Controller Profile Structure

```typescript
interface ControllerProfile {
  id: string;
  name: string;
  
  // Scope
  targetPlatformId: string | null;   // null = global
  targetEmulatorId: string | null;   // null = all emulators
  
  // Mappings
  mappings: ControllerMapping[];
  
  // Analog configuration
  analogConfig: AnalogConfig | null;
  
  // Turbo configuration
  turboConfig: TurboConfig | null;
  
  // Device targeting
  targetDeviceType: 'any' | 'gamepad' | 'keyboard' | 'specific';
  specificDeviceId: string | null;
}

interface ControllerMapping {
  // Virtual button (emulated system)
  virtualButton: string;       // e.g., 'a', 'b', 'start', 'dpad_up'
  
  // Physical input
  physicalButton: string | null;    // e.g., 'south', 'east', 'start'
  physicalAxis: string | null;      // e.g., 'left_stick_x'
  axisDirection: 'positive' | 'negative' | null;
  
  // Modifiers
  requiresModifier: boolean;
  modifierButton: string | null;
}

interface AnalogConfig {
  leftStickDeadzone: number;   // 0.0 - 1.0
  rightStickDeadzone: number;
  leftTriggerDeadzone: number;
  rightTriggerDeadzone: number;
  
  // Sensitivity curves
  leftStickSensitivity: number;
  rightStickSensitivity: number;
  
  // Inversion
  invertLeftY: boolean;
  invertRightY: boolean;
}

interface TurboConfig {
  enabled: boolean;
  frequency: number;           // Hz (presses per second)
  turboButtons: string[];      // Which buttons have turbo
}
```

### 7.3 Shader/Controller Override UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Chrono Trigger - Settings Override                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Shader Preset:                                                  │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ [Inherit from Platform ▼]                                   ││
│ │                                                             ││
│ │ Options:                                                    ││
│ │ ○ None (pass-through)                                       ││
│ │ ○ CRT-Geom                                                  ││
│ │ ○ CRT-Royale                                                ││
│ │ ○ Scanlines-Simple                                          ││
│ │ ● Inherit from Platform (currently: CRT-Pi)                 ││
│ │ ○ Custom...                                                 ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Controller Profile:                                             │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ [Default SNES ▼]                                            ││
│ │                                                             ││
│ │ Options:                                                    ││
│ │ ● Default SNES                                              ││
│ │ ○ SNES - Swapped A/B                                        ││
│ │ ○ Custom...                                                 ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Error Handling & Recovery

### 8.1 Error Categories

```typescript
// Standard error codes for all operations
const ErrorCodes = {
  // Transfer errors (1xxx)
  TRANSFER_SOURCE_NOT_FOUND: 1001,
  TRANSFER_DEST_NOT_FOUND: 1002,
  TRANSFER_DEST_FULL: 1003,
  TRANSFER_PERMISSION_DENIED: 1004,
  TRANSFER_FILE_TOO_LARGE: 1005,      // FAT32 4GB limit
  TRANSFER_PATH_TOO_LONG: 1006,
  TRANSFER_VERIFICATION_FAILED: 1007,
  TRANSFER_CONVERSION_FAILED: 1008,
  TRANSFER_CANCELLED: 1009,
  TRANSFER_DEVICE_REMOVED: 1010,
  
  // Scraping errors (2xxx)
  SCRAPE_AUTH_FAILED: 2001,
  SCRAPE_RATE_LIMITED: 2002,
  SCRAPE_NOT_FOUND: 2003,
  SCRAPE_SERVICE_DOWN: 2004,
  SCRAPE_INVALID_RESPONSE: 2005,
  SCRAPE_NO_API_KEY: 2006,
  
  // Device/mount errors (3xxx)
  DEVICE_NOT_FOUND: 3001,
  DEVICE_NOT_MOUNTED: 3002,
  DEVICE_READ_ONLY: 3003,
  DEVICE_FILESYSTEM_UNSUPPORTED: 3004,
  DEVICE_PERMISSION_DENIED: 3005,
  DEVICE_FAKE_DETECTED: 3006,
  DEVICE_HEALTH_CRITICAL: 3007,
  
  // Database errors (4xxx)
  DB_CORRUPTED: 4001,
  DB_LOCKED: 4002,
  DB_MIGRATION_FAILED: 4003,
  DB_SCHEMA_MISMATCH: 4004,
  
  // Network errors (5xxx)
  NETWORK_UNREACHABLE: 5001,
  NETWORK_TIMEOUT: 5002,
  NETWORK_AUTH_FAILED: 5003,
  NETWORK_SHARE_NOT_FOUND: 5004,
  
  // Update errors (6xxx)
  UPDATE_SIGNATURE_INVALID: 6001,
  UPDATE_DOWNLOAD_FAILED: 6002,
  UPDATE_APPLY_FAILED: 6003,
  UPDATE_KEY_UNKNOWN: 6004,
  
  // Conversion errors (7xxx)
  CONVERSION_TOOL_MISSING: 7001,
  CONVERSION_FAILED: 7002,
  CONVERSION_VERIFICATION_FAILED: 7003,
  CONVERSION_CORRUPT_SOURCE: 7004,
  CONVERSION_INSUFFICIENT_SPACE: 7005,
};
```

### 8.2 Error Response Structure

```typescript
interface ErrorResponse {
  code: number;
  type: 'transfer' | 'scrape' | 'device' | 'database' | 'network' | 'update' | 'conversion';
  message: string;              // User-friendly message
  details: string | null;       // Technical details (expandable)
  recoverable: boolean;
  suggestedActions: SuggestedAction[];
  timestamp: Date;
  context: Record<string, any>; // Additional context
}

interface SuggestedAction {
  label: string;
  action: 'retry' | 'skip' | 'cancel' | 'open-settings' | 'report' | 'custom';
  customHandler?: string;       // For custom actions
}
```

### 8.3 Recovery Strategies

```typescript
// Per-error-type recovery strategies
const recoveryStrategies: Record<number, RecoveryStrategy> = {
  [ErrorCodes.TRANSFER_DEST_FULL]: {
    message: 'Destination is full',
    suggestions: [
      'Free up space on destination',
      'Choose a smaller selection',
      'Use a different destination',
    ],
    autoRecovery: null,
  },
  
  [ErrorCodes.TRANSFER_FILE_TOO_LARGE]: {
    message: 'File exceeds FAT32 4GB limit',
    suggestions: [
      'Enable compression/conversion for this file',
      'Format destination as exFAT',
      'Skip this file',
    ],
    autoRecovery: 'convert-or-skip',
  },
  
  [ErrorCodes.TRANSFER_DEVICE_REMOVED]: {
    message: 'Device was disconnected',
    suggestions: [
      'Reconnect device and resume',
      'Cancel transfer',
    ],
    autoRecovery: 'wait-for-reconnect',
  },
  
  [ErrorCodes.SCRAPE_RATE_LIMITED]: {
    message: 'Rate limited by scraping service',
    suggestions: [
      'Wait and retry automatically',
      'Use backup scraping service',
      'Skip scraping for now',
    ],
    autoRecovery: 'wait-and-retry',
  },
  
  [ErrorCodes.DEVICE_FAKE_DETECTED]: {
    message: 'This appears to be a counterfeit storage device',
    suggestions: [
      'Do not use this device - data loss is likely',
      'Test with dedicated software (H2testw)',
      'Return the device for refund',
    ],
    autoRecovery: null,
  },
  
  [ErrorCodes.CONVERSION_TOOL_MISSING]: {
    message: 'Required conversion tool not found',
    suggestions: [
      'Download and install the required tool',
      'Skip conversion (copy original)',
      'Cancel transfer',
    ],
    autoRecovery: 'skip-conversion',
  },
};

interface RecoveryStrategy {
  message: string;
  suggestions: string[];
  autoRecovery: string | null;  // Automatic recovery action if applicable
}
```

### 8.4 Error UI Component

```typescript
interface ErrorDisplayProps {
  error: ErrorResponse;
  onRetry?: () => void;
  onSkip?: () => void;
  onCancel?: () => void;
  onReport?: () => void;
}

// Error display component
const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onSkip,
  onCancel,
  onReport,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <div className={`error-display error-display--${error.type}`}>
      <div className="error-display__header">
        <AlertCircleIcon className="error-display__icon" />
        <div className="error-display__title">
          {error.message}
          <span className="error-display__code">Error {error.code}</span>
        </div>
      </div>
      
      {error.details && (
        <button 
          className="error-display__details-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      )}
      
      {showDetails && error.details && (
        <pre className="error-display__details">
          {error.details}
        </pre>
      )}
      
      <div className="error-display__suggestions">
        <h4>Suggested actions:</h4>
        <ul>
          {error.suggestedActions.map((action, i) => (
            <li key={i}>{action.label}</li>
          ))}
        </ul>
      </div>
      
      <div className="error-display__actions">
        {error.recoverable && onRetry && (
          <Button onClick={onRetry}>Retry</Button>
        )}
        {onSkip && (
          <Button variant="secondary" onClick={onSkip}>Skip</Button>
        )}
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        )}
        {onReport && (
          <Button variant="ghost" onClick={onReport}>Report Issue</Button>
        )}
      </div>
    </div>
  );
};
```

### 8.5 Crash Recovery

```typescript
// On next launch after crash
async function checkForRecovery(): Promise<RecoveryInfo | null> {
  // Check for incomplete transfers
  const checkpoint = await loadCheckpoint();
  
  if (!checkpoint) return null;
  
  // Verify destination state
  const destinationState = await verifyDestinationState(checkpoint);
  
  return {
    type: 'incomplete-transfer',
    checkpoint,
    destinationState,
    options: [
      { label: 'Resume Transfer', action: 'resume' },
      { label: 'Start Over', action: 'restart' },
      { label: 'Dismiss', action: 'dismiss' },
    ],
  };
}

interface RecoveryInfo {
  type: 'incomplete-transfer' | 'database-corruption' | 'crash';
  checkpoint?: TransferCheckpoint;
  destinationState?: DestinationState;
  options: RecoveryOption[];
}
```

### 8.6 Support Bundle Export

```typescript
interface SupportBundle {
  // Included data
  includes: {
    logs: boolean;              // Application logs (sanitized)
    config: boolean;            // Settings (secrets removed)
    transferReport: boolean;    // Last transfer details
    deviceInfo: boolean;        // Detected devices
    systemInfo: boolean;        // OS, RAM, etc.
  };
  
  // Exclusions for privacy
  excludes: string[];           // e.g., ['api_keys', 'passwords', 'serial_numbers']
}

async function exportSupportBundle(): Promise<string> {
  const bundle = {
    timestamp: new Date().toISOString(),
    appVersion: APP_VERSION,
    
    // System info
    system: {
      os: await getOSInfo(),
      memory: await getMemoryInfo(),
      // Serial numbers sanitized
    },
    
    // Logs (last 1000 lines)
    logs: await getRecentLogs(1000),
    
    // Config (secrets removed)
    config: sanitizeConfig(await getConfig()),
    
    // Last transfer
    lastTransfer: await getLastTransferReport(),
    
    // Detected devices
    devices: await getDetectedDevices(),
  };
  
  const bundlePath = path.join(tempDir, `romrunner-support-${Date.now()}.zip`);
  await createZip(bundlePath, bundle);
  
  return bundlePath;
}
```

---

## 9. Testing Strategy

### 9.1 Testing Pyramid

```
           ┌─────────┐
          │   E2E   │  (5%)  - Critical user flows
         └─────────┘
        ┌───────────────┐
       │  Integration  │  (20%) - Component interactions
      └───────────────┘
     ┌───────────────────────┐
    │         Unit          │  (75%) - Individual functions
   └───────────────────────┘
```

### 9.2 Unit Tests (Rust)

```rust
// Hash computation
#[cfg(test)]
mod hash_tests {
    use super::*;
    
    #[test]
    fn test_md5_hash() {
        let data = b"test data";
        let hash = compute_md5(data);
        assert_eq!(hash, "eb733a00c0c9d336e65691a37ab54293");
    }
    
    #[test]
    fn test_sha1_hash() {
        let data = b"test data";
        let hash = compute_sha1(data);
        assert_eq!(hash, "f48dd853820860816c75d54d0f584dc863327f7c");
    }
    
    #[test]
    fn test_crc32_hash() {
        let data = b"test data";
        let hash = compute_crc32(data);
        assert_eq!(hash, "crc32_value");
    }
}

// Transfer engine
#[cfg(test)]
mod transfer_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_atomic_copy() {
        let temp_dir = tempdir().unwrap();
        let source = temp_dir.path().join("source.bin");
        let dest = temp_dir.path().join("dest.bin");
        
        // Create source file
        fs::write(&source, b"test content").unwrap();
        
        // Perform atomic copy
        let result = atomic_copy(&source, &dest).await;
        assert!(result.is_ok());
        
        // Verify destination
        let content = fs::read(&dest).unwrap();
        assert_eq!(content, b"test content");
    }
    
    #[tokio::test]
    async fn test_copy_with_cancellation() {
        let cancel_token = CancellationToken::new();
        let cancel_clone = cancel_token.clone();
        
        // Start copy in background
        let copy_handle = tokio::spawn(async move {
            // ... long copy operation
        });
        
        // Cancel after short delay
        tokio::time::sleep(Duration::from_millis(100)).await;
        cancel_clone.cancel();
        
        // Verify cancellation
        let result = copy_handle.await.unwrap();
        assert!(matches!(result, Err(TransferError::Cancelled)));
    }
    
    #[tokio::test]
    async fn test_checkpoint_save_restore() {
        let checkpoint = TransferCheckpoint {
            job_id: "test-job".to_string(),
            files_completed: 5,
            bytes_transferred: 1000,
            // ...
        };
        
        save_checkpoint(&checkpoint).await.unwrap();
        
        let restored = load_checkpoint("test-job").await.unwrap();
        assert_eq!(restored.files_completed, 5);
    }
}

// Format conversion
#[cfg(test)]
mod conversion_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_chd_conversion() {
        // Test with known good ISO
        let source = test_fixtures::get_test_iso();
        let dest = tempdir().unwrap().path().join("output.chd");
        
        let result = convert_to_chd(&source, &dest).await;
        assert!(result.is_ok());
        
        // Verify CHD header
        let header = read_chd_header(&dest).unwrap();
        assert_eq!(header.version, 5);
    }
}

// DAT matching
#[cfg(test)]
mod dat_tests {
    use super::*;
    
    #[test]
    fn test_no_intro_match() {
        let hash = "abc123";
        let dat = load_test_dat("no-intro-snes.dat");
        
        let match_result = match_rom(&hash, &dat);
        assert!(match_result.is_some());
        assert_eq!(match_result.unwrap().name, "Super Mario World (USA)");
    }
    
    #[test]
    fn test_redump_match() {
        let hash = "def456";
        let dat = load_test_dat("redump-psx.dat");
        
        let match_result = match_rom(&hash, &dat);
        assert!(match_result.is_some());
    }
}
```

### 9.3 Integration Tests

```rust
// Database integration
#[cfg(test)]
mod db_integration_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_full_scan_to_database_flow() {
        let db = create_test_database().await;
        let source_dir = create_test_source_with_roms(10);
        
        // Run scan
        let scan_result = scan_source(&db, &source_dir).await.unwrap();
        assert_eq!(scan_result.roms_found, 10);
        
        // Verify database state
        let roms = db.get_all_roms().await.unwrap();
        assert_eq!(roms.len(), 10);
    }
    
    #[tokio::test]
    async fn test_fts_search() {
        let db = create_test_database().await;
        
        // Insert test data
        db.insert_rom(&Rom {
            name: "Super Mario World".to_string(),
            description: "Classic platformer game".to_string(),
            // ...
        }).await.unwrap();
        
        // Search
        let results = db.search("mario platformer").await.unwrap();
        assert!(!results.is_empty());
    }
}

// Transfer integration
#[cfg(test)]
mod transfer_integration_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_complete_transfer_flow() {
        let source = create_test_source_with_roms(5);
        let dest = create_mock_destination(1024 * 1024 * 100); // 100MB
        
        let profile = TransferProfile {
            source_id: source.id.clone(),
            destination_id: dest.id.clone(),
            // ...
        };
        
        let result = execute_transfer(&profile).await;
        assert!(result.is_ok());
        
        // Verify all files transferred
        let transferred = dest.list_files().await.unwrap();
        assert_eq!(transferred.len(), 5);
    }
}
```

### 9.4 UI Tests (React with Vitest)

```typescript
// Component tests
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

describe('VirtualList', () => {
  it('renders visible items only', () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    
    render(<VirtualList items={items} itemHeight={50} height={500} />);
    
    // Should only render ~10 items (500px / 50px)
    const renderedItems = screen.getAllByRole('listitem');
    expect(renderedItems.length).toBeLessThan(20);
  });
  
  it('updates on scroll', async () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    
    render(<VirtualList items={items} itemHeight={50} height={500} />);
    
    // Scroll down
    fireEvent.scroll(screen.getByRole('list'), { target: { scrollTop: 5000 } });
    
    // Should now show items around index 100
    await screen.findByText('Item 100');
  });
});

describe('TransferQueueCalculations', () => {
  it('calculates total size correctly', () => {
    const queue = [
      { size: 1000000 },
      { size: 2000000 },
      { size: 500000 },
    ];
    
    const total = calculateQueueSize(queue);
    expect(total).toBe(3500000);
  });
  
  it('calculates estimated time correctly', () => {
    const queue = [{ size: 100000000 }]; // 100MB
    const speedMbps = 10; // 10 MB/s
    
    const eta = calculateETA(queue, speedMbps);
    expect(eta).toBeCloseTo(10, 0); // ~10 seconds
  });
});
```

### 9.5 E2E Tests (Playwright)

```typescript
// e2e/transfer.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Transfer Flow', () => {
  test('complete transfer from source to destination', async ({ page }) => {
    await page.goto('/');
    
    // Add source
    await page.click('[data-testid="add-source"]');
    await page.fill('[data-testid="source-path"]', '/test/roms');
    await page.click('[data-testid="confirm-source"]');
    
    // Wait for scan
    await expect(page.locator('[data-testid="scan-complete"]')).toBeVisible({ timeout: 30000 });
    
    // Select games
    await page.click('[data-testid="select-all"]');
    
    // Start transfer
    await page.click('[data-testid="transfer-button"]');
    await page.click('[data-testid="destination-select"]');
    await page.click('[data-testid="destination-usb"]');
    await page.click('[data-testid="start-transfer"]');
    
    // Wait for completion
    await expect(page.locator('[data-testid="transfer-complete"]')).toBeVisible({ timeout: 60000 });
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('transferred successfully');
  });
  
  test('handles device disconnect during transfer', async ({ page }) => {
    // Start transfer
    await startTransfer(page);
    
    // Simulate device disconnect
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('device-disconnected'));
    });
    
    // Should show recovery dialog
    await expect(page.locator('[data-testid="recovery-dialog"]')).toBeVisible();
    
    // Click resume
    await page.click('[data-testid="resume-transfer"]');
    
    // Should continue after reconnect
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('device-connected'));
    });
    
    await expect(page.locator('[data-testid="transfer-progress"]')).toBeVisible();
  });
});
```

### 9.6 Mock Device System

```typescript
// For testing without physical hardware
class MockDestination implements Destination {
  private files: Map<string, Buffer> = new Map();
  private totalSpace: number;
  private usedSpace: number = 0;
  private connected: boolean = true;
  
  constructor(totalSpaceBytes: number) {
    this.totalSpace = totalSpaceBytes;
  }
  
  async writeFile(path: string, data: Buffer): Promise<void> {
    if (!this.connected) {
      throw new Error('Device not connected');
    }
    
    if (this.usedSpace + data.length > this.totalSpace) {
      throw new Error('Insufficient space');
    }
    
    this.files.set(path, data);
    this.usedSpace += data.length;
  }
  
  async readFile(path: string): Promise<Buffer> {
    const data = this.files.get(path);
    if (!data) throw new Error('File not found');
    return data;
  }
  
  async deleteFile(path: string): Promise<void> {
    const data = this.files.get(path);
    if (data) {
      this.usedSpace -= data.length;
      this.files.delete(path);
    }
  }
  
  async listFiles(): Promise<string[]> {
    return Array.from(this.files.keys());
  }
  
  async getAvailableSpace(): Promise<number> {
    return this.totalSpace - this.usedSpace;
  }
  
  // Test helpers
  disconnect(): void {
    this.connected = false;
  }
  
  reconnect(): void {
    this.connected = true;
  }
  
  simulateSlowWrite(delayMs: number): void {
    // For testing timeouts
  }
}
```

---

## 10. SD Card Health & Detection

### 10.1 Health Check Interface

```typescript
interface SDCardHealth {
  // Basic info
  deviceModel: string;
  serialNumber: string;
  capacity: number;              // bytes
  
  // Health indicators
  healthStatus: 'good' | 'warning' | 'critical' | 'unknown';
  healthScore: number;           // 0-100
  
  // Speed test results
  sequentialRead: number;        // MB/s
  sequentialWrite: number;       // MB/s
  randomRead: number;            // IOPS
  randomWrite: number;           // IOPS
  speedClass: SDSpeedClass;
  
  // Issues detected
  issues: SDCardIssue[];
  
  // Recommendations
  recommendations: string[];
}

type SDSpeedClass = 
  | 'Class 2'    // 2 MB/s
  | 'Class 4'    // 4 MB/s
  | 'Class 6'    // 6 MB/s
  | 'Class 10'   // 10 MB/s
  | 'UHS-I U1'   // 10 MB/s
  | 'UHS-I U3'   // 30 MB/s
  | 'UHS-II'     // 156 MB/s
  | 'UHS-III'    // 312 MB/s
  | 'Unknown';

interface SDCardIssue {
  type: 'fake_capacity' | 'slow_speed' | 'high_error_rate' | 'filesystem_errors';
  severity: 'warning' | 'critical';
  description: string;
  recommendation: string;
}
```

### 10.2 Fake Card Detection

Counterfeit SD cards report false capacities, causing data loss. ROM Runner can detect these:

```rust
// Detect fake/counterfeit SD cards
pub async fn detect_fake_card(path: &Path) -> Result<FakeCardResult> {
    let reported_size = get_reported_size(path)?;
    
    // Quick test: write pattern to end of card
    let test_offset = reported_size - (1024 * 1024);  // Last 1MB
    let test_pattern = generate_test_pattern();
    
    write_at_offset(path, test_offset, &test_pattern).await?;
    
    // Read back and verify
    let read_back = read_at_offset(path, test_offset, test_pattern.len()).await?;
    
    if read_back != test_pattern {
        // Data corruption at reported size = fake card
        return Ok(FakeCardResult {
            is_fake: true,
            reported_size,
            actual_size: estimate_actual_size(path).await?,
            confidence: 0.95,
        });
    }
    
    // Optional: full verification (takes longer)
    // Binary search to find actual capacity
    
    Ok(FakeCardResult {
        is_fake: false,
        reported_size,
        actual_size: reported_size,
        confidence: 0.8,
    })
}

// Binary search to find actual capacity of fake card
pub async fn estimate_actual_size(path: &Path) -> Result<u64> {
    let reported = get_reported_size(path)?;
    let mut low = 0u64;
    let mut high = reported;
    
    while high - low > 1024 * 1024 {  // 1MB precision
        let mid = (low + high) / 2;
        
        if await test_offset_works(path, mid) {
            low = mid;
        } else {
            high = mid;
        }
    }
    
    Ok(low)
}

fn generate_test_pattern() -> Vec<u8> {
    // Generate recognizable but varied pattern
    let mut pattern = Vec::with_capacity(1024 * 1024);
    for i in 0..pattern.capacity() {
        pattern.push(((i * 0x1234567) ^ 0xDEADBEEF) as u8);
    }
    pattern
}
```

### 10.3 Speed Test

```rust
pub async fn test_sd_speed(path: &Path, test_size_mb: usize) -> Result<SpeedTestResult> {
    let test_file = path.join(".romrunner_speedtest");
    let test_data = vec![0u8; test_size_mb * 1024 * 1024];
    
    // Sequential write
    let write_start = Instant::now();
    tokio::fs::write(&test_file, &test_data).await?;
    sync_file(&test_file).await?;  // Ensure data is flushed
    let write_time = write_start.elapsed();
    
    // Sequential read
    let read_start = Instant::now();
    let _ = tokio::fs::read(&test_file).await?;
    let read_time = read_start.elapsed();
    
    // Cleanup
    tokio::fs::remove_file(&test_file).await?;
    
    let write_speed = (test_size_mb as f64) / write_time.as_secs_f64();
    let read_speed = (test_size_mb as f64) / read_time.as_secs_f64();
    
    Ok(SpeedTestResult {
        sequential_write_mbps: write_speed,
        sequential_read_mbps: read_speed,
        speed_class: classify_speed(write_speed),
        test_size_mb,
        test_duration: write_time + read_time,
    })
}

fn classify_speed(write_mbps: f64) -> SDSpeedClass {
    if write_mbps >= 156.0 {
        SDSpeedClass::UHSII
    } else if write_mbps >= 30.0 {
        SDSpeedClass::UHSIU3
    } else if write_mbps >= 10.0 {
        SDSpeedClass::UHSIU1
    } else if write_mbps >= 6.0 {
        SDSpeedClass::Class10
    } else if write_mbps >= 4.0 {
        SDSpeedClass::Class6
    } else if write_mbps >= 2.0 {
        SDSpeedClass::Class4
    } else {
        SDSpeedClass::Class2
    }
}
```

### 10.4 Health Check Settings

```typescript
interface DestinationHealthSettings {
  // Auto-check on connect
  autoCheckOnConnect: boolean;
  
  // What to check
  checkFakeCapacity: boolean;
  checkSpeed: boolean;
  checkFilesystemErrors: boolean;
  
  // Speed test config
  speedTestSizeMB: number;       // Default: 100
  
  // Warnings
  warnOnSlowCard: boolean;
  minimumWriteSpeedMBps: number; // Default: 10
  
  // Fake card handling
  blockFakeCards: boolean;       // Prevent transfers to detected fake cards
  
  // Schedule
  periodicCheckInterval: number; // Hours, 0 = disabled
}
```

### 10.5 Health Check UI

```
┌─────────────────────────────────────────────────────────────────┐
│ SD Card Health Check - SanDisk Ultra 64GB                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ✓ Capacity Verified                                             │
│   Reported: 64 GB                                               │
│   Actual: 64 GB (verified)                                      │
│                                                                 │
│ ⚠ Speed Warning                                                 │
│   Write Speed: 8.5 MB/s (Class 6)                               │
│   Read Speed: 45.2 MB/s                                         │
│   Expected: Class 10 or better                                  │
│                                                                 │
│ ✓ Filesystem OK                                                 │
│   Type: FAT32                                                   │
│   No errors detected                                            │
│                                                                 │
│ Recommendation:                                                 │
│ This card is slower than expected. Large transfers may take     │
│ longer. Consider upgrading to a UHS-I card for better           │
│ performance.                                                    │
│                                                                 │
│ Health Score: 72/100                                            │
│                                                                 │
│              [Run Full Test]  [View History]  [Close]           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Packaging & Distribution

### 11.1 Installer Types

#### Windows

| Format | Description | Use Case |
|--------|-------------|----------|
| NSIS (.exe) | Standard installer | Recommended for most users |
| MSI | Enterprise installer | IT deployment |
| Portable ZIP | No installation | USB/portable use |

#### macOS

| Format | Description | Use Case |
|--------|-------------|----------|
| DMG | Drag-to-Applications | Standard macOS install |
| PKG | Package installer | Automated deployment |

#### Linux

| Format | Description | Use Case |
|--------|-------------|----------|
| AppImage | Universal binary | Works on any distro |
| Flatpak | Sandboxed app | App store integration |
| DEB | Debian/Ubuntu | apt package manager |
| RPM | Fedora/RHEL | dnf package manager |

### 11.2 Auto-Update System

ROM Runner uses Tauri's built-in updater:

```typescript
interface UpdateConfig {
  // Check behavior
  checkOnLaunch: boolean;        // Default: true
  checkInterval: number;         // Hours between checks, 0 = manual only
  
  // Channels
  channel: 'stable' | 'beta';
  
  // Download behavior
  autoDownload: boolean;         // Download in background
  autoInstall: boolean;          // Install on next restart
  
  // Notifications
  notifyOnAvailable: boolean;
  notifyOnDownloaded: boolean;
}
```

**Update Flow:**

```
1. Check for updates (on launch or scheduled)
   ↓
2. If update available:
   - Show notification
   - Download in background (if autoDownload)
   ↓
3. When downloaded:
   - Show "Restart to update" notification
   - Or apply on next manual restart
   ↓
4. Apply update:
   - Verify signature
   - Backup current version (for rollback)
   - Apply update
   - Restart app
```

### 11.3 Update Channels

```typescript
interface UpdateChannel {
  name: 'stable' | 'beta';
  updateUrl: string;
  description: string;
}

const updateChannels: UpdateChannel[] = [
  {
    name: 'stable',
    updateUrl: 'https://updates.romrunner.app/stable',
    description: 'Recommended for most users. Thoroughly tested releases.',
  },
  {
    name: 'beta',
    updateUrl: 'https://updates.romrunner.app/beta',
    description: 'Early access to new features. May contain bugs.',
  },
];
```

### 11.4 Rollback Support

```typescript
async function rollbackUpdate(): Promise<void> {
  // Check for backup
  const backupPath = path.join(appDataDir, 'backup', previousVersion);
  
  if (!await fs.exists(backupPath)) {
    throw new Error('No backup available for rollback');
  }
  
  // Restore backup
  await copyDirectory(backupPath, appDir);
  
  // Restart
  await restartApp();
}
```

### 11.5 Offline Operation

**Works Offline:**
- ROM scanning and management
- Transfer operations
- Profile management
- List creation (from existing data)
- All local operations

**Requires Online:**
- Metadata scraping
- Definition updates
- Rating updates
- Account linking (ScreenScraper, etc.)

**Graceful Degradation:**
- Cache scraped data locally
- Use cached definitions if update fails
- Clear indication of offline status
- Queue operations for when back online

### 11.6 Definition Pack Updates

Separate from app updates, definition packs can be updated independently:

```typescript
interface DefinitionUpdateConfig {
  // Update source
  source: 'github' | 'cdn' | 'self-hosted';
  customUrl: string | null;      // For self-hosted
  
  // Check behavior
  checkOnLaunch: boolean;
  checkInterval: number;         // Hours
  
  // Apply behavior
  autoApply: boolean;            // Apply immediately vs manual
  
  // Verification
  requireSignature: boolean;     // Verify signed updates
}
```

---

## 12. Plugin/Extension System

### 12.1 Plugin Types

```typescript
type PluginType = 
  | 'scraper'          // Custom metadata sources
  | 'exporter'         // Custom export formats
  | 'theme'            // Custom themes
  | 'definition-pack'  // Custom device/emulator definitions
  | 'converter';       // Custom format converters

interface Plugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  type: PluginType;
  
  // Permissions
  permissions: PluginPermission[];
  
  // Entry points
  main: string;        // Main plugin file
  
  // Lifecycle
  onLoad?: () => Promise<void>;
  onUnload?: () => Promise<void>;
}

type PluginPermission = 
  | 'network'          // Make HTTP requests
  | 'filesystem'       // Read/write files
  | 'database'         // Access ROM Runner database
  | 'settings'         // Read/write settings
  | 'notifications';   // Show notifications
```

### 12.2 Plugin API

```typescript
interface PluginAPI {
  // Logging
  log: {
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  };
  
  // Storage
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
  };
  
  // HTTP (if permission granted)
  http?: {
    get(url: string, options?: RequestOptions): Promise<Response>;
    post(url: string, body: any, options?: RequestOptions): Promise<Response>;
  };
  
  // Database (if permission granted)
  database?: {
    query(sql: string, params: any[]): Promise<any[]>;
    execute(sql: string, params: any[]): Promise<void>;
  };
  
  // UI hooks
  ui: {
    showNotification(notification: Notification): void;
    showProgress(title: string, total: number): ProgressHandle;
    registerMenuItem(item: MenuItem): void;
    registerSettingsSection(section: SettingsSection): void;
  };
}
```

### 12.3 Scraper Plugin Interface

```typescript
interface ScraperPlugin extends Plugin {
  type: 'scraper';
  
  // Scraper capabilities
  capabilities: {
    metadata: boolean;
    boxart: boolean;
    screenshots: boolean;
    videos: boolean;
    manuals: boolean;
  };
  
  // Rate limits
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  
  // Methods
  search(query: ScraperQuery): Promise<ScraperSearchResult[]>;
  getMetadata(gameId: string): Promise<GameMetadata>;
  getMedia(gameId: string, mediaType: MediaType): Promise<MediaResult>;
}

interface ScraperQuery {
  gameName: string;
  platformId: string;
  romHash?: string;
  romSize?: number;
}
```

### 12.4 Exporter Plugin Interface

```typescript
interface ExporterPlugin extends Plugin {
  type: 'exporter';
  
  // Export format
  format: {
    id: string;
    name: string;
    extension: string;
    mimeType: string;
  };
  
  // Methods
  export(data: ExportData, options: ExportOptions): Promise<ExportResult>;
  
  // UI
  getOptionsUI(): React.ComponentType<ExportOptionsProps>;
}

interface ExportData {
  roms: ROM[];
  metadata: Record<string, GameMetadata>;
  media: Record<string, MediaPaths>;
}
```

### 12.5 Theme Plugin Interface

```typescript
interface ThemePlugin extends Plugin {
  type: 'theme';
  
  // Theme definition
  theme: {
    name: string;
    variant: 'light' | 'dark' | 'both';
    
    // CSS variables
    colors: Record<string, string>;
    fonts: Record<string, string>;
    shadows: Record<string, string>;
    borderRadius: Record<string, string>;
    
    // Optional custom CSS
    customCSS?: string;
    
    // Optional assets
    assets?: {
      backgroundImage?: string;
      logo?: string;
      icons?: Record<string, string>;
    };
  };
}
```

### 12.6 Plugin Marketplace (Future)

```typescript
interface PluginMarketplace {
  // Browse plugins
  search(query: string): Promise<MarketplacePlugin[]>;
  getCategories(): Promise<Category[]>;
  getFeatured(): Promise<MarketplacePlugin[]>;
  
  // Plugin details
  getPlugin(id: string): Promise<MarketplacePluginDetail>;
  getReviews(id: string): Promise<Review[]>;
  
  // Installation
  install(id: string): Promise<void>;
  uninstall(id: string): Promise<void>;
  update(id: string): Promise<void>;
  
  // User actions
  rate(id: string, rating: number): Promise<void>;
  review(id: string, review: string): Promise<void>;
  report(id: string, reason: string): Promise<void>;
}

interface MarketplacePlugin {
  id: string;
  name: string;
  author: string;
  type: PluginType;
  rating: number;
  downloads: number;
  verified: boolean;
  preview: string;
}
```

---

## Settings Additions Summary

All restored features require additional settings:

```typescript
interface AppSettings {
  // ... existing settings ...
  
  // Section 1: Caching
  cache: MediaCacheConfig;
  
  // Section 2: Notifications
  notifications: NotificationSettings;
  
  // Section 3: Import (future)
  import: {
    lastImportSource: string | null;
    defaultConflictResolution: 'skip' | 'overwrite' | 'keep-both';
  };
  
  // Section 4: Scraping
  scraping: {
    fallbackChain: ScraperServiceConfig[];
    conflictResolution: MetadataResolutionConfig;
  };
  
  // Section 5: Network
  network: {
    defaultTimeout: number;
    defaultRetryAttempts: number;
    offlineMode: boolean;
  };
  
  // Section 6: ROM Hacks
  romHacks: {
    autoDetectBaseRom: boolean;
    showPokemonHackInfo: boolean;
    portMasterIntegration: boolean;
  };
  
  // Section 7: Shaders
  shaders: {
    defaultPreset: string;
    platformDefaults: Record<string, string>;
  };
  
  // Section 10: SD Card Health
  destinationHealth: DestinationHealthSettings;
  
  // Section 11: Updates
  updates: {
    app: UpdateConfig;
    definitions: DefinitionUpdateConfig;
  };
  
  // Section 12: Plugins
  plugins: {
    enabled: boolean;
    allowUnsigned: boolean;
    updateCheck: boolean;
  };
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | January 7, 2026 | Initial restoration document |

---

**End of Restored Sections Document**
