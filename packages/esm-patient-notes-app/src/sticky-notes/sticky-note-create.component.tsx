import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextArea, Button } from '@carbon/react';
import styles from './sticky-note.scss';

interface StickyNoteCreateProps {
  patientUuid: string;
  onSave: (note: string) => void;
}

const StickyNoteCreate: React.FC<StickyNoteCreateProps> = ({ patientUuid, onSave }) => {
  const { t } = useTranslation();
  const [noteText, setNoteText] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNoteText(e.target.value);
  };

  const handleSave = () => {
    if (noteText.trim().length > 0) {
      onSave(noteText);
      setNoteText('');
    }
  };

  return (
    <div className={styles.stickyNoteContainer}>
      <TextArea
        id="sticky-note-text"
        labelText={t('noteContent', 'Note Content')}
        value={noteText}
        onChange={handleChange}
        rows={6}
        maxLength={1000}
        className={styles.noteTextArea}
      />
      <div className={styles.characterCount}>
        {noteText.length}/1000 {t('characters', 'characters')}
      </div>

      <Button kind="primary" onClick={handleSave} disabled={noteText.trim().length === 0}>
        {t('saveNote', 'Save Note')}
      </Button>
    </div>
  );
};

export default StickyNoteCreate;
