/** Mirrors the Rust types in crates/inventory-core (model.rs, imports.rs, settings.rs, ...). */

export type Json = Record<string, unknown>;

export interface Component {
  id: number;
  part_code: string;
  category: string;
  subcategory: string;
  quantity: number;
  package: string;
  manufacturer: string;
  mpn: string;
  /** Storage place: where the part is kept (drawer, box, shelf). */
  location: string;
  preferred_supplier: string;
  voltage_max: number | null;
  current_max: number | null;
  resistance: string;
  tolerance: string;
  power_rating: number | null;
  description: string;
  datasheet_url: string;
  unit_price: number | null;
  notes: string;
  image_path: string;
  attributes: Json;
  custom_fields: Json;
  created_at: string;
  updated_at: string;
}

export type ComponentInput = Omit<Component, 'id' | 'created_at' | 'updated_at'> & { id: number | null };

export interface Movement {
  id: number;
  component_id: number;
  part_code: string;
  delta: number;
  quantity_after: number;
  reason: string;
  import_batch_id: number | null;
  created_at: string;
}

export interface ProjectUse {
  project_id: number;
  project_name: string;
  required_qty: number;
  note: string;
}

export interface ComponentDetail {
  component: Component;
  movements: Movement[];
  projects: ProjectUse[];
}

export interface BomLink {
  id: number;
  project_id: number;
  component_id: number;
  required_qty: number;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface DeletedSnapshot {
  components: Component[];
  bom_rows: BomLink[];
}

export interface CustomColumn {
  id: number;
  col_key: string;
  col_label: string;
  col_type: 'text' | 'number' | 'url' | string;
  is_visible: boolean;
  order_index: number;
}

export interface CustomColumnInput {
  id: number | null;
  col_label: string;
  col_type: string;
  is_visible: boolean;
  order_index: number;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  notes: string;
  schematic_path: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  line_count: number;
  shortage: number;
}

export interface ProjectPatch {
  id: number;
  name?: string;
  description?: string;
  notes?: string;
  schematic_path?: '';
}

export interface ProjectSnapshot {
  project: Omit<Project, 'line_count' | 'shortage'> | null;
  bom_rows: BomLink[];
}

export interface BomRow {
  id: number;
  project_id: number;
  component_id: number;
  part_code: string;
  description: string;
  category: string;
  subcategory: string;
  stock: number;
  required_qty: number;
  note: string;
  shortage: number;
}

export interface BomLineInput {
  project_id: number;
  component_id: number;
  required_qty: number;
  note: string;
  add_to_existing: boolean;
}

export interface BomLinePatch {
  id: number;
  required_qty?: number;
  note?: string;
}

export interface UsageSummary {
  component_id: number;
  project_count: number;
  total_required: number;
}

export type BackupKind = 'auto' | 'manual' | 'pre-import' | 'pre-undo' | 'pre-bulk' | 'pre-restore' | 'pre-delete' | 'pre-migration' | 'legacy';

export interface BackupEntry {
  file_name: string;
  path: string;
  created_at: string;
  size_bytes: number;
  kind: BackupKind;
}

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface BackupDiff {
  added: Component[];
  removed: Component[];
  changed: Array<{ part_code: string; fields: FieldChange[] }>;
}

export interface MigrationReport {
  from_version: number;
  to_version: number;
  backup_path: string | null;
  messages: string[];
}

export interface LibraryPart {
  part_code: string;
  mpn: string;
  category: string;
  subcategory: string;
  package: string;
  manufacturer: string;
  description: string;
  datasheet_url: string;
  voltage_max: number | null;
  current_max: number | null;
  resistance: string;
  tolerance: string;
  power_rating: number | null;
  attributes: Json;
}

export interface AppInfo {
  data_dir: string;
  db_path: string;
  backups_dir: string;
  schema_version: number;
  migration: MigrationReport | null;
  library_available: boolean;
  component_count: number;
}

export interface ColumnPref {
  key: string;
  visible: boolean;
}

export interface AppSettings {
  language: string | null;
  theme: 'system' | 'dark' | 'light';
  default_quantity: number;
  form_mode: 'detailed' | 'simple';
  low_stock_threshold: number;
  show_storage_place: 'auto' | 'show' | 'hide';
  backup_interval_minutes: number;
  backup_retention: number;
  export_folder: string | null;
  drive_enabled: boolean;
  drive_folder: string | null;
  drive_base_name: string;
  update_check: boolean;
  table_columns: ColumnPref[];
  table_sort: { column: string; direction: 'asc' | 'desc' };
  legacy_imported: boolean;
}

export type ImportMode = 'add' | 'sync' | 'replace';

export interface ImportRow {
  part_code: string;
  quantity: number;
  category: string;
  subcategory: string;
  package: string;
  manufacturer: string;
  mpn: string;
  location: string;
  preferred_supplier: string;
  description: string;
  datasheet_url: string;
  notes: string;
  resistance: string;
  tolerance: string;
  voltage_max: number | null;
  current_max: number | null;
  power_rating: number | null;
  unit_price: number | null;
}

export interface ImportRequest {
  source_label: string;
  source_kind: string;
  mode: ImportMode;
  rows: ImportRow[];
}

export interface ImportResult {
  batch_id: number;
  created: number;
  updated: number;
  unchanged: number;
  removed: number;
  pieces: number;
  backup_file: string;
}

export interface ImportBatch {
  id: number;
  created_at: string;
  source_label: string;
  source_kind: string;
  mode: ImportMode;
  row_count: number;
  created: number;
  updated: number;
  removed: number;
  pieces: number;
  status: 'applied' | 'undone';
  undone_at: string | null;
  backup_file: string;
}

export interface ImportBatchDetail {
  batch: ImportBatch;
  items: Array<{ part_code: string; component_id: number; action: string; qty_before: number; qty_after: number }>;
}

export interface UndoResult {
  batch_id: number;
  reverted: number;
  deleted: number;
  restored: number;
  notes: Array<{ part_code: string; reason: 'deleted_since' | 'edited_since' | 'used_in_project' | 'stock_below' | 'code_taken'; field: string | null }>;
  backup_file: string;
}

export interface ComponentPatch {
  id: number;
  part_code?: string;
  category?: string;
  subcategory?: string;
  package?: string;
  manufacturer?: string;
  mpn?: string;
  description?: string;
  datasheet_url?: string;
  voltage_max?: number;
  current_max?: number;
  /** An empty string takes the part out of its storage place. */
  location?: string;
}

export interface CountResult {
  count: number;
  backup_file: string;
}

export interface RestoreReport {
  skipped: string[];
}

export interface RestoreBackupResult {
  safety_backup: BackupEntry;
  migration: MigrationReport;
}

export interface SyncStatus {
  state: 'off' | 'ok' | 'error' | 'pending';
  folder: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  files: string[];
}

export interface UpdateCheck {
  status: 'skipped' | 'current' | 'available' | 'error';
  current: string | null;
  latest: string | null;
  url: string | null;
}

export interface StartupStatus {
  ok: boolean;
  error: { code: string; detail: string } | null;
  data_dir: string;
}
