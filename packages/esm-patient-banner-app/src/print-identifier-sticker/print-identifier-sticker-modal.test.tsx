import React from 'react';
import Barcode from 'react-barcode';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { useReactToPrint } from 'react-to-print';
import { age, getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { mockFhirPatient } from '__mocks__';
import { type ConfigObject, configSchema } from '../config-schema';
import { getByTextWithMarkup } from 'tools';
import PrintIdentifierSticker from './print-identifier-sticker.modal';

const mockedCloseModal = jest.fn();
const mockedUseConfig = jest.mocked(useConfig<ConfigObject>);
const mockedUseReactToPrint = jest.mocked(useReactToPrint);

const defaultConfig: ConfigObject = getDefaultsFromConfigSchema(configSchema);

jest.mock('react-to-print', () => ({
  ...jest.requireActual('react-to-print'),
  useReactToPrint: jest.fn(),
}));

jest.mock('react-barcode', () => jest.fn().mockReturnValue(<div data-testid="barcode" />));

describe('PrintIdentifierStickerModal', () => {
  beforeEach(() => {
    mockedUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
  });

  it('renders the print modal', async () => {
    const user = userEvent.setup();
    const mockHandlePrint = jest.fn();
    mockedUseReactToPrint.mockReturnValue(mockHandlePrint);

    renderPrintIdentifierStickerModal();

    expect(screen.getByText(/print identifier sticker/i)).toBeInTheDocument();
    const printButton = screen.getByRole('button', { name: /print/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    await user.click(cancelButton);
    expect(mockedCloseModal).toHaveBeenCalledTimes(1);

    await user.click(printButton);
    expect(mockHandlePrint).toHaveBeenCalledTimes(1);
  });

  it('renders a barcode if enabled via config', async () => {
    mockedUseConfig.mockReturnValue({
      ...defaultConfig,
      printPatientSticker: {
        ...defaultConfig.printPatientSticker,
        header: {
          showBarcode: true,
          showLogo: true,
          logo: '',
        },
      },
    });

    renderPrintIdentifierStickerModal();

    expect(screen.getByTestId('barcode')).toBeInTheDocument();
    expect(Barcode).toHaveBeenCalledWith(
      {
        value: '100008E',
        width: 2,
        background: '#f4f4f4',
        displayValue: true,
        renderer: 'img',
        font: 'IBM Plex Sans',
        format: 'CODE39',
        textAlign: 'center',
        textPosition: 'bottom',
        fontSize: 16,
      },
      {},
    );
    expect(screen.getByTestId('openmrs-logo')).toBeInTheDocument();
  });

  it("should not render a barcode if it's disabled via config", async () => {
    mockedUseConfig.mockReturnValue({
      ...defaultConfig,
      printPatientSticker: {
        ...defaultConfig.printPatientSticker,
        header: {
          showBarcode: false,
          showLogo: false,
          logo: '',
        },
      },
    });

    renderPrintIdentifierStickerModal();

    expect(screen.queryByTestId('barcode')).not.toBeInTheDocument();
    expect(screen.queryByTestId('openmrs-logo')).not.toBeInTheDocument();
  });

  it('renders a custom implementation logo if passed via config', () => {
    mockedUseConfig.mockReturnValue({
      ...defaultConfig,
      printPatientSticker: {
        ...defaultConfig.printPatientSticker,
        header: {
          showBarcode: true,
          showLogo: true,
          logo: '/openmrs/spa/logo.png',
        },
      },
    });

    renderPrintIdentifierStickerModal();

    expect(screen.getByRole('img')).toHaveAttribute('src', '/openmrs/spa/logo.png');
  });

  it("renders the patient's details in the print modal", () => {
    renderPrintIdentifierStickerModal();

    expect(getByTextWithMarkup(/Joshua Johnson/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(/\+255777053243/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(/100008E/i)).toBeInTheDocument();
    expect(getByTextWithMarkup(age(mockFhirPatient.birthDate))).toBeInTheDocument();
  });
});

function renderPrintIdentifierStickerModal() {
  return render(<PrintIdentifierSticker closeModal={mockedCloseModal} patient={mockFhirPatient} />);
}
