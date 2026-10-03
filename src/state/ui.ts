/** Which view and which panels are open. */
import { signal } from '@preact/signals';
import type { Component } from '../api/types';

export type View = 'inventory' | 'projects' | 'import' | 'backups' | 'settings';

export const view = signal<View>('inventory');
/** The part shown in the detail panel. */
export const detailId = signal<number | null>(null);
/** The edit dialog: a part to edit, 'new' for a new one, null when closed. */
export const editing = signal<Component | 'new' | null>(null);
/** Prefill for a new part (from the library or a duplicate). */
export const newPartDraft = signal<Partial<Component> | null>(null);
export const exportOpen = signal(false);
export const labelsFor = signal<Component[] | null>(null);
export const bulkOpen = signal(false);
export const assignTo = signal<Component[] | null>(null);
export const renameTarget = signal<{ category: string; subcategory: string | null } | null>(null);
/** The storage place dialog: move chosen parts into a place, or rename a place. */
export const placeTarget = signal<{ kind: 'move'; parts: Component[] } | { kind: 'rename'; from: string } | null>(null);
export const columnsOpen = signal(false);
export const shortcutsOpen = signal(false);

export function openPart(id: number): void {
  detailId.value = id;
}
