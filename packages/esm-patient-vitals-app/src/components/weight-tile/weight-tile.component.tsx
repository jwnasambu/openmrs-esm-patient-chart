import React from 'react';
import { useTranslation } from 'react-i18next';
import { InlineLoading } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { useVitalsAndBiometrics, useConceptUnits } from '../../common';
import { type ConfigObject } from '../../config-schema';
import styles from './weight-tile.scss';

interface WeightTileInterface {
  patientUuid: string;
}

const WeightTile: React.FC<WeightTileInterface> = ({ patientUuid }) => {
  const config = useConfig<ConfigObject>();
  const { t } = useTranslation();
  const { conceptUnits } = useConceptUnits();
  const { data: biometrics, isLoading } = useVitalsAndBiometrics(patientUuid, 'biometrics');
  const weightData = biometrics?.filter((result) => result.weight);

  if (isLoading) {
    return <InlineLoading role="progressbar" description={`${t('loading', 'Loading')} ...`} />;
  }

  if (weightData?.length) {
    return (
      <div>
        <p className={styles.label}>{t('weight', 'Weight')}</p>
        <p className={styles.content}>
          <span className={styles.value}>{weightData?.[0]?.weight}</span>{' '}
          {conceptUnits.get(config.concepts.weightUuid) ?? ''}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className={styles.label}>{t('weight', 'Weight')}</p>
      <p className={styles.content}>--</p>
    </div>
  );
};

export default WeightTile;
