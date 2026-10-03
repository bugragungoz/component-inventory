import type { ComponentChildren, JSX } from 'preact';
import { useId } from 'preact/hooks';
import { t } from '../i18n';

interface FieldShellProps {
  label: string;
  hint?: string | undefined;
  error?: string | null | undefined;
  id: string;
  children: ComponentChildren;
  class?: string | undefined;
  hideLabel?: boolean;
}

function FieldShell({ label, hint, error, id, children, class: cls, hideLabel }: FieldShellProps) {
  return (
    <div class={['bg-field', cls].filter(Boolean).join(' ')}>
      <label class={hideLabel ? 'bg-field-label sr-only' : 'bg-field-label'} for={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p class="bg-field-msg bg-field-msg-error" id={`${id}-msg`} role="alert">
          <strong>{t('common.errorPrefix')}</strong> {error}
        </p>
      ) : hint ? (
        <p class="bg-field-msg" id={`${id}-msg`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'label' | 'onInput' | 'value'> {
  label: string;
  hint?: string | undefined;
  error?: string | null | undefined;
  value: string;
  onValue: (v: string) => void;
  mono?: boolean;
  hideLabel?: boolean;
  fieldClass?: string;
}

/** Bugra TextField (added in Bugra): visible label, 3:1 border, the error starts with "Error:". */
export function TextField({ label, hint, error, value, onValue, mono, hideLabel, fieldClass, class: cls, id: givenId, ...rest }: TextFieldProps) {
  const autoId = useId();
  const id = (givenId as string | undefined) ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={id} class={fieldClass} hideLabel={hideLabel}>
      <input
        id={id}
        class={['bg-input', mono && 'mono', error && 'bg-input-error', cls].filter(Boolean).join(' ')}
        value={value}
        onInput={(e) => onValue((e.currentTarget as HTMLInputElement).value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

export interface TextAreaProps extends Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'label' | 'onInput' | 'value'> {
  label: string;
  hint?: string;
  value: string;
  onValue: (v: string) => void;
  fieldClass?: string;
}

export function TextArea({ label, hint, value, onValue, fieldClass, class: cls, ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id} class={fieldClass}>
      <textarea id={id} class={['bg-input bg-textarea', cls].filter(Boolean).join(' ')} value={value}
        onInput={(e) => onValue((e.currentTarget as HTMLTextAreaElement).value)} aria-describedby={hint ? `${id}-msg` : undefined} {...rest} />
    </FieldShell>
  );
}

export interface SelectProps {
  label: string;
  hint?: string;
  value: string;
  onValue: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  fieldClass?: string;
  hideLabel?: boolean;
  disabled?: boolean;
}

/** A native select in the Bugra field style (added). */
export function Select({ label, hint, value, onValue, options, fieldClass, hideLabel, disabled }: SelectProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id} class={fieldClass} hideLabel={hideLabel}>
      <div class="bg-select">
        <select id={id} class="bg-input" value={value} disabled={disabled} onChange={(e) => onValue((e.currentTarget as HTMLSelectElement).value)}
          aria-describedby={hint ? `${id}-msg` : undefined}>
          {options.map((o) => (
            <option value={o.value} key={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </FieldShell>
  );
}
