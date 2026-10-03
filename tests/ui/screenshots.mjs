// README screenshots from the real app UI on synthetic data (no personal data): npm run shots.
// Writes docs/screenshots/*.png at 1440 x 900, scale 1.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, startHarness } from './harness.mjs';

const out = path.join(ROOT, 'docs', 'screenshots');
fs.mkdirSync(out, { recursive: true });

const P = (part_code, category, subcategory, quantity, pkg, description, extra = {}) => ({
  id: null, part_code, category, subcategory, quantity, package: pkg, manufacturer: '', mpn: '', location: '', preferred_supplier: '', voltage_max: null, current_max: null,
  resistance: '', tolerance: '', power_rating: null, description, datasheet_url: '', unit_price: null, notes: '', image_path: '', attributes: {}, custom_fields: {}, ...extra,
});
const PARTS = [
  P('IRFZ44N', 'Transistors', 'MOSFET N-Channel', 8, 'TO-220', '55V 49A N-channel power MOSFET', { manufacturer: 'Infineon', location: 'Drawer A1', voltage_max: 55, current_max: 49, attributes: { channel: 'N-Channel', vgs_th: '4', rds_on: '17.5' } }),
  P('IRF540N', 'Transistors', 'MOSFET N-Channel', 4, 'TO-220', '100V 33A N-channel MOSFET', { location: 'Drawer A1', voltage_max: 100, current_max: 33 }),
  P('BC547B', 'Transistors', 'BJT NPN - General Purpose', 48, 'TO-92', '45V 100mA NPN transistor', { location: 'Drawer A2' }),
  P('2N2222A', 'Transistors', 'BJT NPN - General Purpose', 22, 'TO-92', '40V 600mA NPN transistor', { location: 'Drawer A2' }),
  P('BC557B', 'Transistors', 'BJT PNP - General Purpose', 1, 'TO-92', '45V 100mA PNP transistor', { location: 'Drawer A2' }),
  P('BT139-800E', 'Thyristors', 'TRIAC', 4, 'TO-220', '16A 800V triac'),
  P('1N4007', 'Diodes', 'Rectifier', 120, 'DO-41', '1000V 1A rectifier diode', { location: 'Drawer B1' }),
  P('UF4007', 'Diodes', 'Fast Recovery', 10, 'DO-41', '1000V 1A ultra-fast diode', { location: 'Drawer B1' }),
  P('BAT54S', 'Diodes', 'Schottky', 20, 'SOT-23', 'Dual series Schottky diode'),
  P('1N4728A', 'Diodes', 'Zener', 5, 'DO-41', '3.3V 1W Zener diode'),
  P('R-10K-0603', 'Resistors', 'SMD', 400, '0603', '10kΩ 1% 0.1W', { resistance: '10k', tolerance: '1%', power_rating: 0.1, location: 'Box 1' }),
  P('R-91K-0603', 'Resistors', 'SMD', 100, '0603', '91kΩ 1% 0.1W', { resistance: '91k', tolerance: '1%', location: 'Box 1' }),
  P('R-150K-0603', 'Resistors', 'SMD', 100, '0603', '150kΩ 1% 0.1W', { resistance: '150k', tolerance: '1%', location: 'Box 1' }),
  P('R-5MR-2512', 'Resistors', 'Shunt', 2, '2512', '5mΩ 3W shunt resistor', { resistance: '5m', power_rating: 3 }),
  P('C-100N-0805', 'Capacitors', 'MLCC', 250, '0805', '100nF 50V X7R'),
  P('C-470U-25V', 'Capacitors', 'Electrolytic', 12, 'Radial', '470µF 25V electrolytic'),
  P('LM7805', 'ICs', 'Linear Regulator', 7, 'TO-220', '5V 1.5A positive regulator', { location: 'Drawer C1' }),
  P('LM317', 'ICs', 'Linear Regulator', 7, 'TO-220', 'Adjustable 1.5A regulator', { location: 'Drawer C1' }),
  P('LM358ADT', 'ICs', 'Op-Amp', 10, 'SO-8', 'Dual operational amplifier'),
  P('NE555P', 'ICs', 'Timer', 15, 'DIP-8', 'Precision timer'),
  P('SN74HC595DR', 'ICs', 'Shift Register', 5, 'SOIC-16', '8-bit shift register'),
  P('IR2101STRPBF', 'ICs', 'Gate Driver', 3, 'SOIC-8', 'High and low side driver'),
  P('PC817', 'ICs', 'Optocoupler', 30, 'DIP-4', 'Phototransistor optocoupler'),
  P('ADS1115IDGSR', 'ICs', 'ADC', 3, 'MSOP-10', '16-bit ADC with PGA'),
  P('PIC18F25K22-I/SS', 'Microcontrollers', 'PIC', 2, 'SSOP-28', '8-bit microcontroller'),
  P('ESP32-WROOM-32E', 'Microcontrollers', 'ESP32 / ESP8266', 3, 'Module', 'Wi-Fi and Bluetooth module'),
  P('INA219', 'Sensors', 'Current', 1, 'Module', 'I2C bidirectional current sensor module'),
  P('DHT22', 'Sensors', 'Humidity', 2, 'Module', 'Temperature and humidity sensor'),
  P('SRD-05VDC-SL-C', 'Relays', 'SPDT', 5, 'Through-hole', '5V relay 10A'),
  P('HDR-1X40-2.54', 'Connectors', 'Pin Header', 10, '2.54 mm', '1x40 male pin header'),
  P('XT60', 'Connectors', 'XT60 / XT30', 6, '', 'XT60 connector pair'),
  P('HC49-16MHZ', 'Crystals', 'Crystal', 10, 'HC-49/S', '16 MHz crystal'),
  P('TACT-6X6', 'Switches', 'Tactile', 40, '6x6 mm', 'Tactile push button'),
  P('ST-LINK-V2', 'Modules', 'Programmer / Debugger', 1, '', 'ST-Link V2 mini programmer'),
  P('LM2596-MODULE', 'Modules', 'Power Supply', 5, '', 'Adjustable buck converter board 1.25-30V'),
  P('SOLDER-0.8MM', 'Consumables', 'Solder', 1, '', '0.8 mm solder wire'),
];

async function seeded(opts) {
  const h = await startHarness({ library: true, viewport: { width: 1440, height: 900 }, ...opts });
  for (const p of PARTS) await h.call('save_component', { component: p });
  return h;
}
const shot = (h, name) => h.page.screenshot({ path: path.join(out, `${name}.png`) });

for (const theme of ['dark', 'light']) {
  const h = await seeded({ locale: 'en-US', theme });
  await h.open();
  await h.page.waitForTimeout(500);
  await shot(h, `inventory-${theme}`);
  if (theme === 'dark') {
    await h.page.locator('.tree-row', { hasText: 'Transistors' }).click();
    await h.page.locator('.tr', { hasText: 'IRFZ44N' }).click();
    await h.page.waitForTimeout(500);
    await shot(h, 'detail-dark');
  }
  await h.stop();
}

{
  const h = await seeded({ locale: 'tr-TR', theme: 'dark' });
  await h.open();
  // An order from the extension (the PDF route is open: B17 in docs/FEEDBACK.md).
  const order = JSON.parse(fs.readFileSync(path.join(ROOT, 'test-fixtures/orders/expected.json'), 'utf8')).motorobit;
  const payload = { format: 'cinv', version: 1, source: { site: 'motorobit', kind: 'order', url: '' }, items: order.map((i) => ({ name: i.name, code: i.code, qty: i.qty })) };
  h.state.deepLinks.push(`component-inventory://import?d=${Buffer.from(JSON.stringify(payload)).toString('base64url')}`);
  await h.emit('deep-link-pending', null);
  await h.page.waitForSelector('.review');
  await h.page.waitForTimeout(400);
  await shot(h, 'import-review-tr');
  await h.stop();
}

{
  const h = await seeded({ locale: 'en-US', theme: 'dark' });
  const parts = await h.call('list_components', {});
  const id = (code) => parts.find((p) => p.part_code === code).id;
  const project = await h.call('create_project', { name: 'Bench power supply' });
  for (const [code, qty] of [['LM317', 2], ['IRFZ44N', 2], ['1N4007', 8], ['C-470U-25V', 4], ['R-10K-0603', 6], ['BC557B', 2], ['INA219', 1]]) {
    await h.call('upsert_bom_line', { line: { project_id: project.id, component_id: id(code), required_qty: qty, note: '', add_to_existing: false } });
  }
  await h.open();
  await h.page.getByRole('button', { name: 'Projects' }).click();
  await h.page.waitForSelector('.data-table td');
  await h.page.waitForTimeout(400);
  await shot(h, 'projects-dark');
  await h.page.getByRole('button', { name: 'Settings' }).click();
  await h.page.waitForTimeout(400);
  await shot(h, 'settings-dark');
  await h.stop();
}
console.log('screenshots ->', path.relative(ROOT, out));
