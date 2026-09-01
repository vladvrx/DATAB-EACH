export type InventoryFile = {
  path: string;
  bytes: number;
  gzip_bytes: number;
  category: string;
  dump_bucket: string;
  content_type: string;
};

export type BucketStats = {
  files: number;
  bytes: number;
  gzip_bytes: number;
};

export type Inventory = {
  generated: string;
  origin: string;
  totals: {
    candidates: number;
    real_files: number;
    spa_fallbacks: number;
    failed: number;
    bytes: number;
    gzip_bytes: number;
  };
  by_category: Record<string, BucketStats>;
  by_extension: Record<string, BucketStats>;
  by_dump_bucket: Record<string, BucketStats>;
  blender_export_key_count: number;
  blender_export_keys_sample: string[];
  unhashed_alias_count: number;
  unhashed_aliases: string[];
  files: InventoryFile[];
};
