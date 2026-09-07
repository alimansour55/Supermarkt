import DeliveryAreaPicker from './DeliveryAreaPicker';

const VARIANT_MAP = {
  mobile: { variant: 'compact', sheetOnly: true },
  menu: { variant: 'row', sheetOnly: true },
  form: { variant: 'form', sheetOnly: true },
  header: { variant: 'header', sheetOnly: false },
};

export default function LocationSelector({ variant = 'header', className = '', onSelected }) {
  const cfg = VARIANT_MAP[variant] || VARIANT_MAP.header;
  return (
    <DeliveryAreaPicker
      variant={cfg.variant}
      sheetOnly={cfg.sheetOnly}
      className={className}
      onSelected={onSelected}
    />
  );
}
