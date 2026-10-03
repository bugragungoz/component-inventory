/** Every dialog that belongs to the whole app, opened through signals in state/ui. */
import { BulkDialog } from '../bulk/BulkDialog';
import { ExportDialog } from '../export/ExportDialog';
import { LabelsDialog } from '../labels/LabelsDialog';
import { AssignDialog } from '../projects/AssignDialog';
import { assignTo, bulkOpen, columnsOpen, editing, exportOpen, labelsFor, placeTarget, renameTarget, shortcutsOpen } from '../../state/ui';
import { EditDialog } from './EditDialog';
import { ColumnsDialog, PlaceDialog, RenameDialog, ShortcutsDialog } from './SmallDialogs';

export function DialogsHost() {
  return (
    <>
      {editing.value !== null ? <EditDialog target={editing.value} key={editing.value === 'new' ? 'new' : editing.value.id} /> : null}
      {renameTarget.value ? <RenameDialog target={renameTarget.value} /> : null}
      {placeTarget.value ? <PlaceDialog target={placeTarget.value} /> : null}
      {columnsOpen.value ? <ColumnsDialog /> : null}
      {shortcutsOpen.value ? <ShortcutsDialog /> : null}
      {labelsFor.value ? <LabelsDialog parts={labelsFor.value} /> : null}
      {exportOpen.value ? <ExportDialog /> : null}
      {assignTo.value ? <AssignDialog parts={assignTo.value} /> : null}
      {bulkOpen.value ? <BulkDialog /> : null}
    </>
  );
}
