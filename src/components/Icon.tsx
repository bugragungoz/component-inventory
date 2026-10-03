import type { JSX } from 'preact';
import { UI_ICONS } from './icons';
import { CATEGORY_ICONS } from './categoryIcons';

interface Props {
  name: string;
  size?: number;
  class?: string;
  title?: string;
}

/**
 * A few icons carry a short word (PCB, ASIC): `text:<x>,<y>,<size>:<WORD>`, drawn filled in the
 * mono font so it reads at 20 px.
 */
function IconText({ spec }: { spec: string }): JSX.Element {
  const [, pos = '', word = ''] = /^text:([^:]+):(.*)$/.exec(spec) ?? [];
  const [x = 12, y = 12, size = 6] = pos.split(',').map(Number);
  return (
    <text x={x} y={y} font-size={size} font-family="var(--font-mono)" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle" dominant-baseline="central">
      {word}
    </text>
  );
}

/** A UI or category icon. Decorative unless `title` is given. */
export function Icon({ name, size = 18, class: cls, title }: Props): JSX.Element {
  const paths = UI_ICONS[name] ?? CATEGORY_ICONS[name] ?? CATEGORY_ICONS.custom!;
  return (
    <svg
      class={cls ? `icon ${cls}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d) =>
        d.startsWith('text:') ? <IconText spec={d} key={d} /> : <path d={d} key={d} />,
      )}
    </svg>
  );
}
