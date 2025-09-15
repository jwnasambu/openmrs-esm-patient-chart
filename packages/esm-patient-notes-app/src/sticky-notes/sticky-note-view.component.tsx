import React from 'react';
import { useTranslation } from 'react-i18next';
import { TextArea } from '@carbon/react';
import styles from './sticky-note.scss';

interface StickyNoteData {
  id?: string;
  patientUuid: string;
  note: string;
  createdAt?: string;
  createdBy?: {
    uuid: string;
    display: string;
  };
}

interface StickyNoteViewProps {
  existingNote: StickyNoteData;
}

const StickyNoteView: React.FC<StickyNoteViewProps> = ({ existingNote }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.stickyNoteContainer}>
      <TextArea
        id="sticky-note-text"
        labelText={t('noteContent', 'Note Content')}
        value={existingNote.note}
        readOnly
        rows={6}
        maxLength={1000}
        className={styles.noteTextArea}
      />
      <div className={styles.characterCount}>
        {existingNote.note.length}/1000 {t('characters', 'characters')}
      </div>

      <div className={styles.noteMetadata}>
        <div className={styles.metadataItem}>
          <strong>{t('createdBy', 'Created by')}:</strong> {existingNote.createdBy?.display || 'Unknown'}
        </div>
        <div className={styles.metadataItem}>
          <strong>{t('createdOn', 'Created on')}:</strong>{' '}
          {existingNote.createdAt ? new Date(existingNote.createdAt).toLocaleString() : 'Unknown'}
        </div>
      </div>
    </div>
  );
};

export default StickyNoteView;
