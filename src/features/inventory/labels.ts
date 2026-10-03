/** Translated labels for stored English values (categories, fields, reasons, error codes). */
import type { AppError } from '../../api/invoke';
import { ATTRIBUTE_FIELDS } from '../../domain/attributes';
import { categoryLabelKey, subcategoryLabelKey } from '../../domain/taxonomy';
import { has, t } from '../../i18n';

export function categoryLabel(name: string): string {
  const key = categoryLabelKey(name);
  return key ? t(key) : name;
}

export function subcategoryLabel(name: string): string {
  const key = subcategoryLabelKey(name);
  return key ? t(key) : name;
}

export function fieldLabel(key: string): string {
  return has(`field.${key}`) ? t(`field.${key}`) : key;
}

export function attrLabel(key: string): string {
  if (has(`attr.${key}`)) return t(`attr.${key}`);
  return ATTRIBUTE_FIELDS[key]?.label ?? key;
}

export function reasonLabel(reason: string): string {
  return has(`movement.${reason}`) ? t(`movement.${reason}`) : reason;
}

export function errorMessage(e: unknown): string {
  const code = (e as AppError)?.code;
  if (code && has(`errors.${code}`)) return t(`errors.${code}`);
  return t('errors.generic');
}
