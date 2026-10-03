/**
 * Add or edit a part. Simple mode asks only what most parts need; detailed mode shows everything.
 * While the part code is typed, the parts library and the built-in rules offer what they know; the
 * owner decides whether to use it. Quantities are read in the UI language's number format.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { api } from '../../api/commands';
import type { AppError } from '../../api/invoke';
import type { Component, ComponentInput, LibraryPart } from '../../api/types';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Select, TextArea, TextField } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Note } from '../../components/Misc';
import { schemaFor } from '../../domain/attributes';
import { categorizeByDescription, lookupComponent } from '../../domain/classify/datasheetDb';
import type { PartHint } from '../../domain/classify/types';
import { parseLocaleNumber, parseUserQuantity } from '../../domain/number';
import { CANONICAL_CATEGORIES, normalizeCategory, subcategoriesFor, UNCATEGORIZED } from '../../domain/taxonomy';
import { compareText, formatNumber, locale, t } from '../../i18n';
import { confirm } from '../../state/dialogs';
import { categoryTree, customColumns, showStoragePlace, storagePlaces } from '../../state/inventory';
import { saveSettings, settings } from '../../state/settings';
import { toast } from '../../state/toasts';
import { detailId, editing, newPartDraft } from '../../state/ui';
import { adjustQuantity, blankInput, findByCode, savePart, toInput } from './actions';
import { attrLabel, categoryLabel, errorMessage, fieldLabel, subcategoryLabel } from './labels';
import { useImage } from './useImage';

type TextKeys = 'part_code' | 'category' | 'subcategory' | 'package' | 'manufacturer' | 'mpn' | 'location' | 'preferred_supplier' | 'resistance' |
  'tolerance' | 'description' | 'datasheet_url' | 'notes' | 'image_path';
type NumKeys = 'quantity' | 'voltage_max' | 'current_max' | 'power_rating' | 'unit_price';

export type Form = Record<TextKeys | NumKeys, string> & { attributes: Record<string, unknown>; custom_fields: Record<string, unknown> };

const NEW_CATEGORY = '\u0000new';

function numText(n: number | null): string {
  return n === null ? '' : formatNumber(n, locale.value, { useGrouping: false, maximumFractionDigits: 6 });
}

export function toForm(c: ComponentInput): Form {
  return {
    part_code: c.part_code, category: c.category === UNCATEGORIZED ? '' : c.category, subcategory: c.subcategory, package: c.package,
    manufacturer: c.manufacturer, mpn: c.mpn, location: c.location, preferred_supplier: c.preferred_supplier, resistance: c.resistance,
    tolerance: c.tolerance, description: c.description, datasheet_url: c.datasheet_url, notes: c.notes, image_path: c.image_path,
    quantity: numText(c.quantity), voltage_max: numText(c.voltage_max), current_max: numText(c.current_max), power_rating: numText(c.power_rating),
    unit_price: numText(c.unit_price), attributes: { ...c.attributes }, custom_fields: { ...c.custom_fields },
  };
}

/** Which electrical fields fit the category (resistors have ohms and watts, the rest volts and amps). */
export function typeOf(category: string): 'resistor' | 'capacitor' | 'inductor' | 'transistor' | 'diode' | 'generic' {
  const c = category.toLowerCase();
  if (['resistors', 'potentiometers', 'thermistors', 'varistors'].includes(c)) return 'resistor';
  if (c.includes('capacitor')) return 'capacitor';
  if (c.includes('inductor') || c.includes('transformer')) return 'inductor';
  if (c.includes('transistor') || c.includes('thyristor')) return 'transistor';
  if (c.includes('diode')) return 'diode';
  return 'generic';
}

/** A short description from the electrical values ("10kΩ 1% 0.25W Metal Film"). */
export function autoDescription(f: Form): string {
  const sub = f.subcategory.trim();
  const type = typeOf(f.category);
  const parts: string[] = [];
  const v = f.voltage_max.trim();
  const i = f.current_max.trim();
  if (type === 'resistor') {
    const r = f.resistance.trim();
    if (r) parts.push(/[a-zA-ZΩ]/.test(r) ? r : `${r}Ω`);
    if (f.tolerance.trim()) parts.push(f.tolerance.trim().endsWith('%') ? f.tolerance.trim() : `${f.tolerance.trim()}%`);
    if (f.power_rating.trim()) parts.push(`${f.power_rating.trim()}W`);
    parts.push(sub || 'Resistor');
  } else {
    parts.push(sub || f.category.trim());
    if (v) parts.push(`${v}V`);
    if (i && type !== 'capacitor') parts.push(`${i}A`);
  }
  return parts.filter(Boolean).join(' ');
}

/** Fills only the empty fields from what the library or the rules know. */
export function fillEmpty(f: Form, hint: Partial<PartHint & LibraryPart>): Form {
  const out = { ...f, attributes: { ...f.attributes } };
  const set = (k: TextKeys, v: string | undefined) => { if (v && !out[k].trim()) out[k] = v; };
  if (hint.category && (!out.category || out.category === UNCATEGORIZED)) out.category = normalizeCategory(hint.category);
  if (hint.category && out.category === normalizeCategory(hint.category) && !out.subcategory.trim() && hint.subcategory) out.subcategory = hint.subcategory;
  set('subcategory', hint.subcategory);
  set('package', hint.package);
  set('manufacturer', hint.manufacturer);
  set('mpn', hint.mpn);
  set('description', hint.description);
  set('datasheet_url', hint.datasheet_url);
  set('resistance', hint.resistance);
  set('tolerance', hint.tolerance);
  set('preferred_supplier', hint.preferred_supplier);
  const setNum = (k: NumKeys, v: number | null | undefined) => { if (v !== null && v !== undefined && !out[k].trim()) out[k] = numText(v); };
  setNum('voltage_max', hint.voltage_max);
  setNum('current_max', hint.current_max);
  setNum('power_rating', hint.power_rating);
  if (hint.attributes) for (const [k, v] of Object.entries(hint.attributes)) if (out.attributes[k] === undefined || out.attributes[k] === '') out.attributes[k] = v;
  return out;
}

interface Errors { part_code?: string; quantity?: string; datasheet_url?: string; numbers?: string }

function validate(f: Form, isNew: boolean, defaultQty: number): { errors: Errors; input?: Omit<ComponentInput, 'id'> } {
  const errors: Errors = {};
  if (!f.part_code.trim()) errors.part_code = t('edit.errCodeRequired');
  let quantity: number | null = f.quantity.trim() ? parseUserQuantity(f.quantity, locale.value) : isNew ? defaultQty : null;
  if (quantity === null || quantity < 0 || quantity > 999_999_999) {
    errors.quantity = t('edit.errQuantity');
    quantity = 0;
  }
  const url = f.datasheet_url.trim();
  if (url && !/^https?:\/\//i.test(url)) errors.datasheet_url = t('edit.errUrl');
  const nums: Partial<Record<NumKeys, number | null>> = {};
  for (const k of ['voltage_max', 'current_max', 'power_rating', 'unit_price'] as const) {
    const s = f[k].trim();
    const n = s ? parseLocaleNumber(s) : null;
    if (s && n === null) errors.numbers = t('edit.errNumber', { field: fieldLabel(k) });
    nums[k] = n;
  }
  if (Object.keys(errors).length) return { errors };
  const attributes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f.attributes)) if (v !== '' && v !== null && v !== undefined) attributes[k] = v;
  const custom: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f.custom_fields)) if (v !== '' && v !== null && v !== undefined) custom[k] = v;
  return {
    errors,
    input: {
      part_code: f.part_code.trim(), category: normalizeCategory(f.category), subcategory: f.subcategory.trim(), quantity: quantity!,
      package: f.package, manufacturer: f.manufacturer, mpn: f.mpn, location: f.location, preferred_supplier: f.preferred_supplier,
      voltage_max: nums.voltage_max ?? null, current_max: nums.current_max ?? null, resistance: f.resistance, tolerance: f.tolerance,
      power_rating: nums.power_rating ?? null, description: f.description, datasheet_url: url, unit_price: nums.unit_price ?? null,
      notes: f.notes, image_path: f.image_path, attributes, custom_fields: custom,
    },
  };
}

function Suggestions({ code, onUse }: { code: string; onUse: (hint: Partial<PartHint & LibraryPart>, label: string) => void }) {
  const [lib, setLib] = useState<LibraryPart[]>([]);
  const term = code.trim();
  useEffect(() => {
    if (term.length < 2) {
      setLib([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api.searchLibrary(term, 3).then((r) => { if (!cancelled) setLib(r); }, () => { if (!cancelled) setLib([]); });
    }, 220);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [term]);
  const rule = useMemo(() => (term.length >= 2 ? lookupComponent(term) : null), [term]);
  if (!lib.length && !rule) return null;
  return (
    <div class="suggest" aria-live="polite">
      {rule ? (
        <div class="suggest-row">
          <Icon name="wand" size={16} />
          <div class="suggest-text">
            <strong>{t('edit.rulesKnow')}</strong>
            <span class="muted">{[rule.category && categoryLabel(normalizeCategory(rule.category)), rule.subcategory, rule.package, rule.description].filter(Boolean).join(' · ')}</span>
          </div>
          <Button size="sm" onClick={() => onUse(rule, t('edit.rulesKnow'))}>{t('edit.fillEmpty')}</Button>
        </div>
      ) : null}
      {lib.map((p) => (
        <div class="suggest-row" key={p.part_code}>
          <Icon name="library" size={16} />
          <div class="suggest-text">
            <strong class="mono">{p.part_code}</strong>
            <span class="muted">{[p.category && categoryLabel(normalizeCategory(p.category)), p.package, p.manufacturer, p.description].filter(Boolean).join(' · ')}</span>
          </div>
          <Button size="sm" onClick={() => onUse(p, p.part_code)}>{t('edit.fillEmpty')}</Button>
        </div>
      ))}
    </div>
  );
}

export function EditDialog({ target }: { target: Component | 'new' }) {
  const isNew = target === 'new';
  const defaultQty = settings.value?.default_quantity ?? 1;
  const initial = useMemo<Form>(() => {
    if (!isNew) return toForm(toInput(target));
    const draft = newPartDraft.value;
    const base = { ...blankInput(defaultQty), ...(draft ?? {}) } as ComponentInput;
    const f = toForm(base);
    return { ...f, quantity: draft?.quantity ? numText(draft.quantity) : '' };
  }, []);
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<Component | null>(null);
  const [customCategory, setCustomCategory] = useState(false);
  const mode = settings.value?.form_mode ?? 'detailed';
  const detailed = mode === 'detailed';
  const image = useImage(form.image_path);

  useEffect(() => () => { newPartDraft.value = null; }, []);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const close = async () => {
    if (busy) return;
    if (dirty) {
      const ok = await confirm({ title: t('edit.discardTitle'), body: t('edit.discardBody'), confirmLabel: t('edit.discard'), cancelLabel: t('edit.keepEditing'), danger: true });
      if (!ok) return;
    }
    editing.value = null;
  };

  const categories = useMemo(() => {
    const inUse = categoryTree.value.map((n) => n.name);
    const all = [...new Set([...CANONICAL_CATEGORIES, ...inUse])].filter((c) => c !== UNCATEGORIZED);
    return all.sort((a, b) => compareText(categoryLabel(a), categoryLabel(b)));
  }, [categoryTree.value]);
  const showCustomField = customCategory || (!!form.category && !categories.includes(form.category));
  const subs = useMemo(() => {
    const inUse = categoryTree.value.find((n) => n.name === form.category)?.subs.map((s) => s.name) ?? [];
    return subcategoriesFor(form.category, inUse, locale.value);
  }, [form.category, categoryTree.value]);
  const schema = schemaFor(form.category, form.subcategory);
  const type = typeOf(form.category);
  const showPlace = detailed || showStoragePlace.value;

  const submit = async (e?: Event) => {
    e?.preventDefault();
    const { errors: errs, input } = validate(form, isNew, defaultQty);
    setErrors(errs);
    setExisting(null);
    if (!input) {
      document.querySelector<HTMLElement>('.bg-dialog [aria-invalid="true"]')?.focus();
      return;
    }
    const clash = findByCode(input.part_code);
    if (clash && (isNew || clash.id !== target.id)) {
      setErrors({ part_code: t('errors.duplicate_part_code') });
      setExisting(clash);
      document.getElementById('edit-part-code')?.focus();
      return;
    }
    setBusy(true);
    try {
      const saved = await savePart({ ...input, id: isNew ? null : target.id });
      editing.value = null;
      toast(isNew ? t('edit.added', { code: saved.part_code }) : t('edit.saved', { code: saved.part_code }), {
        tone: 'ok',
        actionLabel: isNew ? t('edit.show') : undefined,
        onAction: isNew ? () => { detailId.value = saved.id; } : undefined,
      });
    } catch (err) {
      if ((err as AppError).code === 'duplicate_part_code') setErrors({ part_code: t('errors.duplicate_part_code') });
      else toast(errorMessage(err), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };

  const addToExisting = async () => {
    if (!existing) return;
    const n = form.quantity.trim() ? parseUserQuantity(form.quantity, locale.value) : defaultQty;
    if (n === null || n <= 0) {
      setErrors({ quantity: t('edit.errQuantity') });
      return;
    }
    setBusy(true);
    await adjustQuantity(existing, n);
    setBusy(false);
    editing.value = null;
    detailId.value = existing.id;
    toast(t('edit.addedToExisting', { count: n, code: existing.part_code }), { tone: 'ok' });
  };

  const pickImage = async () => {
    try {
      const path = await api.pickComponentImage(form.part_code.trim() || 'part');
      if (path) set('image_path', path);
    } catch (err) {
      toast(errorMessage(err), { tone: 'warn' });
    }
  };

  return (
    <Dialog
      title={isNew ? t('edit.addTitle') : t('edit.editTitle', { code: target.part_code })}
      onClose={() => void close()}
      busy={busy}
      size="form"
      initialFocus="#edit-part-code"
      actions={
        <>
          <div class="segmented" role="group" aria-label={t('edit.formMode')}>
            <button type="button" aria-pressed={!detailed} onClick={() => void saveSettings({ form_mode: 'simple' }).catch(() => {})}>{t('edit.simple')}</button>
            <button type="button" aria-pressed={detailed} onClick={() => void saveSettings({ form_mode: 'detailed' }).catch(() => {})}>{t('edit.detailed')}</button>
          </div>
          <span class="grow" />
          <Button onClick={() => void close()} disabled={busy}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="edit-form" disabled={busy}>{isNew ? t('edit.add') : t('edit.save')}</Button>
        </>
      }
    >
      <form id="edit-form" class="form-grid" onSubmit={(e) => void submit(e)} noValidate>
        <div class="span-2">
          <TextField id="edit-part-code" label={fieldLabel('part_code')} value={form.part_code} onValue={(v) => { set('part_code', v); setExisting(null); }} mono required
            error={errors.part_code} autoComplete="off" spellcheck={false} hint={isNew ? t('edit.codeHint') : undefined} />
          {existing ? (
            <div class="inline-actions">
              <Button size="sm" variant="primary" icon="plus" onClick={() => void addToExisting()}>{t('edit.addToExisting', { count: existing.quantity })}</Button>
              <Button size="sm" onClick={() => { editing.value = null; detailId.value = existing.id; }}>{t('edit.openExisting')}</Button>
            </div>
          ) : null}
          {isNew || dirty ? <Suggestions code={form.part_code} onUse={(hint, label) => { setForm((f) => fillEmpty(f, hint)); toast(t('edit.filledFrom', { source: label }), { tone: 'ok' }); }} /> : null}
        </div>

        <TextField label={fieldLabel('quantity')} value={form.quantity} onValue={(v) => set('quantity', v)} inputMode="numeric" class="num"
          placeholder={isNew ? formatNumber(defaultQty) : undefined} error={errors.quantity} hint={isNew ? t('edit.qtyHint', { count: defaultQty }) : undefined} />

        <div class="field-stack">
          <Select
            label={fieldLabel('category')}
            value={showCustomField ? NEW_CATEGORY : form.category}
            onValue={(v) => {
              if (v === NEW_CATEGORY) { setCustomCategory(true); set('category', ''); return; }
              setCustomCategory(false);
              set('category', v);
            }}
            options={[
              { value: '', label: categoryLabel(UNCATEGORIZED) },
              ...categories.map((c) => ({ value: c, label: categoryLabel(c) })),
              { value: NEW_CATEGORY, label: t('edit.newCategory') },
            ]}
          />
          {showCustomField ? (
            <TextField label={t('edit.newCategoryName')} value={form.category} onValue={(v) => set('category', v)} hideLabel placeholder={t('edit.newCategoryName')} />
          ) : null}
        </div>

        <div>
          <TextField label={fieldLabel('subcategory')} value={form.subcategory} onValue={(v) => set('subcategory', v)} list="edit-subs" autoComplete="off" />
          <datalist id="edit-subs">
            {subs.map((s) => <option value={s} label={subcategoryLabel(s) !== s ? subcategoryLabel(s) : undefined} key={s} />)}
          </datalist>
        </div>
        <TextField label={fieldLabel('package')} value={form.package} onValue={(v) => set('package', v)} mono autoComplete="off" />

        <div class="span-2">
          <TextArea label={fieldLabel('description')} value={form.description} onValue={(v) => set('description', v)} rows={2} />
          <div class="inline-actions">
            <Button size="sm" variant="quiet" onClick={() => set('description', autoDescription(form))} disabled={!form.category && !form.subcategory}>{t('edit.autoDescription')}</Button>
            <Button size="sm" variant="quiet" disabled={!form.description.trim()}
              onClick={() => {
                const hit = categorizeByDescription(form.description);
                if (!hit) { toast(t('edit.noCategoryGuess'), { tone: 'info' }); return; }
                setForm((f) => ({ ...f, category: normalizeCategory(hit.category), subcategory: hit.subcategory || f.subcategory }));
                toast(t('edit.categoryGuessed', { category: categoryLabel(normalizeCategory(hit.category)) }), { tone: 'ok' });
              }}>{t('edit.guessCategory')}</Button>
          </div>
        </div>

        {showPlace ? (
          <div class="span-2">
            <TextField label={fieldLabel('location')} value={form.location} onValue={(v) => set('location', v)} list="edit-places" autoComplete="off" hint={t('edit.placeHint')} />
            <datalist id="edit-places">{storagePlaces.value.map((p) => <option value={p.name} key={p.name} />)}</datalist>
          </div>
        ) : null}

        {detailed ? (
          <>
            <h3 class="form-section span-2">{t('edit.electrical')}</h3>
            {type === 'resistor' ? (
              <>
                <TextField label={fieldLabel('resistance')} value={form.resistance} onValue={(v) => set('resistance', v)} mono placeholder="10k" />
                <TextField label={fieldLabel('tolerance')} value={form.tolerance} onValue={(v) => set('tolerance', v)} mono placeholder="1%" />
                <TextField label={`${fieldLabel('power_rating')} (W)`} value={form.power_rating} onValue={(v) => set('power_rating', v)} mono inputMode="decimal" placeholder="0,25" />
              </>
            ) : (
              <>
                <TextField label={`${type === 'capacitor' ? t('edit.ratedVoltage') : fieldLabel('voltage_max')} (V)`} value={form.voltage_max} onValue={(v) => set('voltage_max', v)} mono inputMode="decimal" />
                {type !== 'capacitor' ? <TextField label={`${fieldLabel('current_max')} (A)`} value={form.current_max} onValue={(v) => set('current_max', v)} mono inputMode="decimal" /> : null}
                {type === 'capacitor' || type === 'inductor' ? <TextField label={fieldLabel('tolerance')} value={form.tolerance} onValue={(v) => set('tolerance', v)} mono /> : null}
              </>
            )}
            {errors.numbers ? <p class="bg-field-msg bg-field-msg-error span-2" role="alert"><strong>{t('common.errorPrefix')}</strong> {errors.numbers}</p> : null}

            {schema ? (
              <>
                <h3 class="form-section span-2">{t('edit.parameters')}</h3>
                {schema.fields.map((f) => {
                  const value = String(form.attributes[f.key] ?? '');
                  const label = f.unit ? `${attrLabel(f.key)} (${f.unit})` : attrLabel(f.key);
                  const onValue = (v: string) => setForm((x) => ({ ...x, attributes: { ...x.attributes, [f.key]: v } }));
                  return f.type === 'select' ? (
                    <Select key={f.key} label={label} value={value} onValue={onValue} options={(f.options ?? []).map((o) => ({ value: o, label: o || '-' }))} />
                  ) : (
                    <TextField key={f.key} label={label} value={value} onValue={onValue} mono={f.type === 'number'} placeholder={f.placeholder} inputMode={f.type === 'number' ? 'decimal' : undefined} />
                  );
                })}
              </>
            ) : null}

            <h3 class="form-section span-2">{t('edit.sourcing')}</h3>
            <TextField label={fieldLabel('manufacturer')} value={form.manufacturer} onValue={(v) => set('manufacturer', v)} />
            <TextField label={fieldLabel('mpn')} value={form.mpn} onValue={(v) => set('mpn', v)} mono />
            <TextField label={fieldLabel('preferred_supplier')} value={form.preferred_supplier} onValue={(v) => set('preferred_supplier', v)} />
            <TextField label={fieldLabel('unit_price')} value={form.unit_price} onValue={(v) => set('unit_price', v)} mono inputMode="decimal" />
            <TextField fieldClass="span-2" label={fieldLabel('datasheet_url')} value={form.datasheet_url} onValue={(v) => set('datasheet_url', v)} type="url" error={errors.datasheet_url} placeholder="https://" />

            {customColumns.value.length ? (
              <>
                <h3 class="form-section span-2">{t('edit.customFields')}</h3>
                {customColumns.value.map((cc) => (
                  <TextField key={cc.col_key} label={cc.col_label} value={String(form.custom_fields[cc.col_key] ?? '')}
                    onValue={(v) => setForm((x) => ({ ...x, custom_fields: { ...x.custom_fields, [cc.col_key]: v } }))}
                    inputMode={cc.col_type === 'number' ? 'decimal' : undefined} type={cc.col_type === 'url' ? 'url' : 'text'} />
                ))}
              </>
            ) : null}

            <TextArea fieldClass="span-2" label={fieldLabel('notes')} value={form.notes} onValue={(v) => set('notes', v)} rows={3} />

            <div class="span-2 image-field">
              <span class="bg-field-label">{fieldLabel('image_path')}</span>
              <div class="image-row">
                {image.url ? <img src={image.url} alt="" class="image-thumb" /> : <div class="image-thumb is-empty"><Icon name="image" size={22} /></div>}
                <Button size="sm" icon="image" onClick={() => void pickImage()}>{form.image_path ? t('edit.changeImage') : t('edit.chooseImage')}</Button>
                {form.image_path ? <Button size="sm" variant="quiet" onClick={() => set('image_path', '')}>{t('edit.removeImage')}</Button> : null}
              </div>
            </div>
          </>
        ) : (
          <div class="span-2">
            <Note icon="info">{t('edit.simpleNote')}</Note>
          </div>
        )}
      </form>
    </Dialog>
  );
}
