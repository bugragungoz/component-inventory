import type { StartupStatus } from '../../api/types';
import { api } from '../../api/commands';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { t } from '../../i18n';

/** Shown when the database could not be opened. Nothing was changed; the owner gets a way out. */
export function StartupError({ status }: { status: StartupStatus }) {
  const code = status.error?.code ?? 'startup';
  const message = code === 'newer_schema' ? t('startup.newerSchema') : t('startup.failed');
  return (
    <div class="startup-error" role="alert">
      <div class="startup-error-box">
        <Icon name="alert" size={28} class="tone-warn" />
        <h1>{t('startup.title')}</h1>
        <p>
          <strong>{t('common.errorPrefix')}</strong> {message}
        </p>
        <p class="muted">{t('startup.nothingChanged')}</p>
        {status.error?.detail ? <pre class="startup-detail">{status.error.detail}</pre> : null}
        {status.data_dir ? <p class="muted mono startup-path">{status.data_dir}</p> : null}
        <div class="startup-actions">
          <Button icon="folder" onClick={() => void api.openFolder('data').catch(() => {})}>
            {t('startup.openFolder')}
          </Button>
          <Button variant="primary" icon="refresh" onClick={() => location.reload()}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    </div>
  );
}
