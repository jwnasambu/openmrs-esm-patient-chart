import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  Button,
  ButtonSet,
  Dropdown,
  Form,
  InlineNotification,
  SelectItem,
  Stack,
  TextInput,
  TimePicker,
  TimePickerSelect,
} from '@carbon/react';
import {
  useSession,
  useVisit,
  useLayoutType,
  useConfig,
  toOmrsIsoString,
  toDateObjectStrict,
  showSnackbar,
  ResponsiveWrapper,
  OpenmrsDatePicker,
} from '@openmrs/esm-framework';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type DefaultPatientWorkspaceProps, type amPm, convertTime12to24 } from '@openmrs/esm-patient-common-lib';
import { savePatientImmunization } from './immunizations.resource';
import { useImmunizationsConceptSet } from '../hooks/useImmunizationsConceptSet';
import { mapToFHIRImmunizationResource } from './immunization-mapper';
import { type ConfigObject } from '../config-schema';
import { type ImmunizationFormData } from '../types';
import { immunizationFormSub } from './utils';
import { DoseInput } from './components/dose-input.component';
import { useImmunizations } from '../hooks/useImmunizations';
import styles from './immunizations-form.scss';

interface ResponsiveWrapperProps {
  children: React.ReactNode;
  isTablet: boolean;
}

const ImmunizationsForm: React.FC<DefaultPatientWorkspaceProps> = ({
  patientUuid,
  closeWorkspace,
  closeWorkspaceWithSavedChanges,
  promptBeforeClosing,
}) => {
  const { t } = useTranslation();
  const { immunizationsConfig } = useConfig<ConfigObject>();
  const currentUser = useSession();
  const { currentVisit } = useVisit(patientUuid);
  const isTablet = useLayoutType() === 'tablet';
  const { immunizationsConceptSet } = useImmunizationsConceptSet(immunizationsConfig);
  const { mutate } = useImmunizations(patientUuid);
  const [immunizationToEditMeta, setImmunizationToEditMeta] = useState<{
    immunizationObsUuid: string;
    visitUuid?: string;
  }>();

  const immunizationFormSchema = useMemo(() => {
    return z.object({
      vaccineUuid: z.string().refine((value) => !!value, t('vaccineRequired', 'Vaccine required')),
      vaccinationDate: z.date().refine((value) => !!value, t('vaccinationDateRequired', 'Vaccination date required')),
      vaccinationTime: z.string(),
      timeFormat: z.enum(['PM', 'AM']),
      doseNumber: z
        .number()
        .nullable()
        // The backend will attempt to convert the dose number to a positive integer
        // so we need to set it to null if the value is less than 1
        .transform((value) => (value < 1 ? null : value)),
      expirationDate: z.date().nullable(),
      lotNumber: z.string().nullable(),
      manufacturer: z.string().nullable(),
    });
  }, [t]);

  type ImmunizationFormInputData = z.infer<typeof immunizationFormSchema>;
  const formProps = useForm<ImmunizationFormInputData>({
    mode: 'all',
    resolver: zodResolver(immunizationFormSchema),
    defaultValues: {
      vaccineUuid: '',
      vaccinationDate: new Date(),
      vaccinationTime: dayjs(new Date()).format('hh:mm'),
      timeFormat: new Date().getHours() >= 12 ? 'PM' : 'AM',
      doseNumber: 1,
      expirationDate: null,
      lotNumber: '',
      manufacturer: '',
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
    watch,
  } = formProps;

  useEffect(() => {
    promptBeforeClosing(() => isDirty);
  }, [isDirty, promptBeforeClosing]);

  const vaccineUuid = watch('vaccineUuid');

  useEffect(() => {
    const sub = immunizationFormSub.subscribe((props) => {
      if (props) {
        const vaccinationDateOrNow = props.vaccinationDate || new Date();
        reset({
          vaccineUuid: props.vaccineUuid,
          vaccinationDate: vaccinationDateOrNow,
          vaccinationTime: dayjs(vaccinationDateOrNow).format('hh:mm'),
          timeFormat: vaccinationDateOrNow.getHours() >= 12 ? 'PM' : 'AM',
          doseNumber: props.doseNumber,
          expirationDate: props.expirationDate,
          lotNumber: props.lotNumber,
          manufacturer: props.manufacturer,
        });
        setImmunizationToEditMeta({ immunizationObsUuid: props.immunizationId, visitUuid: props.visitId });
      }
    });

    return () => {
      // cleanup
      sub.unsubscribe();
      immunizationFormSub.next(null);
    };
  }, [reset]);

  const onSubmit = useCallback(
    (data: ImmunizationFormInputData) => {
      const {
        vaccineUuid,
        vaccinationDate,
        doseNumber,
        expirationDate,
        lotNumber,
        manufacturer,
        timeFormat,
        vaccinationTime,
      } = data;
      const abortController = new AbortController();

      const [hours, minutes] = convertTime12to24(vaccinationTime, timeFormat);

      const immunization: ImmunizationFormData = {
        patientUuid,
        immunizationId: immunizationToEditMeta?.immunizationObsUuid,
        vaccineName: immunizationsConceptSet.answers.find((answer) => answer.uuid === vaccineUuid).display,
        vaccineUuid: vaccineUuid,
        vaccinationDate: toDateObjectStrict(
          toOmrsIsoString(
            new Date(
              dayjs(vaccinationDate).year(),
              dayjs(vaccinationDate).month(),
              dayjs(vaccinationDate).date(),
              hours,
              minutes,
            ),
          ),
        ),
        doseNumber,
        expirationDate,
        lotNumber,
        manufacturer,
      };

      savePatientImmunization(
        mapToFHIRImmunizationResource(
          immunization,
          immunizationToEditMeta?.visitUuid || currentVisit?.uuid,
          currentUser?.sessionLocation?.uuid,
          currentUser?.currentProvider?.uuid,
        ),
        immunizationToEditMeta?.immunizationObsUuid,
        abortController,
      ).then(
        () => {
          closeWorkspaceWithSavedChanges();
          mutate();
          showSnackbar({
            kind: 'success',
            title: t('vaccinationSaved', 'Vaccination saved successfully'),
            isLowContrast: true,
          });
        },
        (err) => {
          showSnackbar({
            title: t('errorSaving', 'Error saving vaccination'),
            kind: 'error',
            isLowContrast: false,
            subtitle: err?.message,
          });
        },
      );
      return () => abortController.abort();
    },
    [
      currentUser?.sessionLocation?.uuid,
      patientUuid,
      currentUser?.currentProvider?.uuid,
      currentVisit?.uuid,
      immunizationToEditMeta,
      immunizationsConceptSet,
      closeWorkspaceWithSavedChanges,
      t,
      mutate,
    ],
  );

  return (
    <FormProvider {...formProps}>
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit)} data-testid="immunization-form">
        <Stack gap={1} className={styles.container}>
          <section className={` ${styles.row}`}>
            <div className={styles.dateTimeSection}>
              <ResponsiveWrapper>
                <Controller
                  name="vaccinationDate"
                  control={control}
                  render={({ field, fieldState }) => (
                    <OpenmrsDatePicker
                      {...field}
                      id="vaccinationDate"
                      data-testid="vaccinationDate"
                      className={styles.datePicker}
                      maxDate={new Date()}
                      labelText={t('vaccinationDate', 'Vaccination date')}
                      invalid={Boolean(fieldState?.error?.message)}
                      invalidText={fieldState?.error?.message}
                    />
                  )}
                />
              </ResponsiveWrapper>
              <ResponsiveWrapper>
                <Controller
                  name="vaccinationTime"
                  control={control}
                  render={({ field: { onBlur, onChange, value } }) => (
                    <div className={styles.timePickerContainer}>
                      <TimePicker
                        id="vaccinationTime"
                        labelText={t('time', 'Time')}
                        onChange={(event) => onChange(event.target.value as amPm)}
                        pattern="^(1[0-2]|0?[1-9]):([0-5]?[0-9])$"
                        value={value}
                        onBlur={onBlur}
                      >
                        <Controller
                          name="timeFormat"
                          control={control}
                          render={({ field: { onChange, value } }) => (
                            <TimePickerSelect
                              id="timeFormatSelect"
                              onChange={(event) => onChange(event.target.value as amPm)}
                              value={value}
                              aria-label={t('timeFormat ', 'Time Format')}
                            >
                              <SelectItem value="AM" text={t('AM', 'AM')} />
                              <SelectItem value="PM" text={t('PM', 'PM')} />
                            </TimePickerSelect>
                          )}
                        />
                      </TimePicker>
                    </div>
                  )}
                />
              </ResponsiveWrapper>
            </div>
          </section>
          <section>
            <ResponsiveWrapper>
              <Controller
                name="vaccineUuid"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div className={styles.row}>
                    <Dropdown
                      id="immunization"
                      label={t('pleaseSelect', 'Please select')}
                      titleText={t('immunization', 'Immunization')}
                      items={immunizationsConceptSet?.answers?.map((item) => item.uuid) || []}
                      itemToString={(item) =>
                        immunizationsConceptSet?.answers.find((candidate) => candidate.uuid == item)?.display
                      }
                      onChange={(val) => onChange(val.selectedItem)}
                      selectedItem={value}
                      invalid={!!errors?.vaccineUuid}
                    />
                  </div>
                )}
              />
            </ResponsiveWrapper>
          </section>
          {errors?.vaccineUuid && (
            <section>
              <div className={styles.row}>
                <InlineNotification
                  role="alert"
                  style={{ margin: '0', minWidth: '100%' }}
                  kind="error"
                  lowContrast
                  title={t('error', 'Error')}
                  subtitle={errors.vaccineUuid.message}
                />
              </div>
            </section>
          )}
          {vaccineUuid && (
            <section>
              <ResponsiveWrapper>
                <DoseInput
                  vaccine={vaccineUuid}
                  sequences={immunizationsConfig.sequenceDefinitions}
                  control={control}
                />
              </ResponsiveWrapper>
            </section>
          )}
          <section>
            <ResponsiveWrapper>
              <Controller
                name="manufacturer"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div className={styles.row}>
                    <TextInput
                      type="text"
                      id="manufacturer"
                      labelText={t('manufacturer', 'Manufacturer')}
                      value={value}
                      onChange={(evt) => onChange(evt.target.value)}
                    />
                  </div>
                )}
              />
            </ResponsiveWrapper>
          </section>
          <section>
            <ResponsiveWrapper>
              <Controller
                name="lotNumber"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div className={styles.row}>
                    <TextInput
                      type="text"
                      id="lotNumber"
                      labelText={t('lotNumber', 'Lot Number')}
                      value={value}
                      onChange={(evt) => onChange(evt.target.value)}
                    />
                  </div>
                )}
              />
            </ResponsiveWrapper>
          </section>
          <section>
            <ResponsiveWrapper>
              <Controller
                name="expirationDate"
                control={control}
                render={({ field, fieldState }) => (
                  <div className={styles.row}>
                    <OpenmrsDatePicker
                      {...field}
                      id="vaccinationExpiration"
                      data-testid="vaccinationExpiration"
                      className={styles.datePicker}
                      minDate={immunizationToEditMeta ? null : new Date()}
                      labelText={t('expirationDate', 'Expiration date')}
                      invalid={Boolean(fieldState?.error?.message)}
                      invalidText={fieldState?.error?.message}
                    />
                  </div>
                )}
              />
            </ResponsiveWrapper>
          </section>
        </Stack>
        <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button className={styles.button} kind="primary" disabled={isSubmitting} type="submit">
            {t('save', 'Save')}
          </Button>
        </ButtonSet>
      </Form>
    </FormProvider>
  );
};

export default ImmunizationsForm;
