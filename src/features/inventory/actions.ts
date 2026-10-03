/**
 * Part actions shared by the table, the detail panel and the selection bar. Every destructive
 * action asks in the app first (`confirm` resolves only when the owner answers) and offers Undo.
 */
import { api } from '../../api/commands';
import type { Component, ComponentInput } from '../../api/types';
import { t } from '../../i18n';
import { confirm } from '../../state/dialogs';
import { components, loadInventory, refreshUsage, removeLocal, upsertLocal, usage } from '../../state/inventory';
import { toast } from '../../state/toasts';
import { detailId, editing, newPartDraft } from '../../state/ui';
import { errorMessage } from './labels';

/** Asks, deletes, and offers Undo (the same ids and BOM lines come back). */
export async function askDelete(list: Component[]): Promise<boolean> {
  if (!list.length) return false;
  const used = list.filter((c) => usage.value.has(c.id)).length;
  const body = [
    list.length === 1 ? t('delete.bodyOne', { code: list[0]!.part_code }) : t('delete.bodyMany', { count: list.length }),
    used ? t('delete.bodyUsed', { count: used }) : '',
    t('delete.bodyUndo'),
  ].filter(Boolean).join(' ');
  const ok = await confirm({
    title: t('delete.title', { count: list.length }),
    body,
    confirmLabel: t('delete.confirm'),
    cancelLabel: t('common.cancel'),
    danger: true,
  });
  if (!ok) return false;
  try {
    const snapshot = await api.deleteComponents(list.map((c) => c.id));
    removeLocal(list.map((c) => c.id));
    if (detailId.value !== null && list.some((c) => c.id === detailId.value)) detailId.value = null;
    if (snapshot.bom_rows.length) void refreshUsage().catch(() => {});
    toast(t('delete.done', { count: list.length }), {
      tone: 'ok',
      actionLabel: t('common.undo'),
      onAction: async () => {
        try {
          const report = await api.restoreComponents(snapshot);
          await loadInventory();
          toast(report.skipped.length ? t('delete.restoredSkipped', { count: report.skipped.length }) : t('delete.restored', { count: list.length }),
            { tone: report.skipped.length ? 'warn' : 'ok' });
        } catch (e) {
          toast(errorMessage(e), { tone: 'warn' });
        }
      },
    });
    return true;
  } catch (e) {
    toast(errorMessage(e), { tone: 'warn' });
    return false;
  }
}

/** Saves a new or edited part and puts it in the table without a reload. */
export async function savePart(input: ComponentInput): Promise<Component> {
  const saved = await api.saveComponent(input);
  upsertLocal(saved);
  return saved;
}

/** Adds (or takes away) pieces; the movement log records it. */
export async function adjustQuantity(c: Component, delta: number): Promise<void> {
  if (!delta) return;
  try {
    upsertLocal(await api.adjustQuantity(c.id, delta));
  } catch (e) {
    toast(errorMessage(e), { tone: 'warn' });
  }
}

/** Opens the add dialog prefilled with this part (a new code is required). */
export function duplicatePart(c: Component): void {
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = c;
  newPartDraft.value = { ...rest, part_code: '', quantity: 0, image_path: '' };
  editing.value = 'new';
}

export function findByCode(code: string): Component | undefined {
  const key = code.trim().toLocaleUpperCase('en');
  return components.value.find((c) => c.part_code.toLocaleUpperCase('en') === key);
}

/** An empty part with the owner's default quantity. */
export function blankInput(defaultQuantity: number): ComponentInput {
  return {
    id: null, part_code: '', category: '', subcategory: '', quantity: defaultQuantity, package: '', manufacturer: '', mpn: '', location: '',
    preferred_supplier: '', voltage_max: null, current_max: null, resistance: '', tolerance: '', power_rating: null, description: '',
    datasheet_url: '', unit_price: null, notes: '', image_path: '', attributes: {}, custom_fields: {},
  };
}

export function toInput(c: Component): ComponentInput {
  const { created_at: _c, updated_at: _u, ...rest } = c;
  return { ...rest };
}
