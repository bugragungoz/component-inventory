/**
 * Built-in component database.
 * Keys are normalized part codes (uppercase, stripped of dashes/spaces/dots).
 * Lookup is performed by exact key match first, then alias patterns.
 *
 * Fields match the components table schema:
 *   category, subcategory, package, manufacturer, voltage_max (V),
 *   current_max (A), description, datasheet_url
 */

const DB = {
  // ================================================================
  // MOSFETs — N-Channel Power
  // ================================================================
  'IRF540':   { category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'Vishay/IR', voltage_max:100, current_max:28, description:'N-Ch Power MOSFET 100V 28A', datasheet_url:'https://www.vishay.com/docs/91020/91020.pdf' },
  'IRF540N':  { category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'Vishay/IR', voltage_max:100, current_max:33, description:'N-Ch Power MOSFET 100V 33A (Logic Level)', datasheet_url:'https://www.vishay.com/docs/91021/91021.pdf' },
  'IRF640':   { category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'Vishay/IR', voltage_max:200, current_max:18, description:'N-Ch Power MOSFET 200V 18A', datasheet_url:'https://www.vishay.com/docs/91023/91023.pdf' },
  'IRF840':   { category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'Vishay/IR', voltage_max:500, current_max:8,  description:'N-Ch Power MOSFET 500V 8A', datasheet_url:'https://www.vishay.com/docs/91029/91029.pdf' },
  'IRF3205':  { category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'Vishay/IR', voltage_max:55,  current_max:110,description:'N-Ch Power MOSFET 55V 110A', datasheet_url:'https://www.vishay.com/docs/91513/91513.pdf' },
  'IRLZ44N':  { category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'Vishay/IR', voltage_max:55,  current_max:47, description:'N-Ch Logic Level MOSFET 55V 47A', datasheet_url:'https://www.vishay.com/docs/91378/91378.pdf' },
  'IRF9540':  { category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'Vishay/IR', voltage_max:100, current_max:19, description:'P-Ch Power MOSFET 100V 19A', datasheet_url:'https://www.vishay.com/docs/91036/91036.pdf' },
  'IRF9540N': { category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'Vishay/IR', voltage_max:100, current_max:23, description:'P-Ch Power MOSFET 100V 23A', datasheet_url:'https://www.vishay.com/docs/91037/91037.pdf' },
  'STP40NF20':{ category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'STMicroelectronics', voltage_max:200, current_max:40, description:'N-Ch Power MOSFET 200V 40A', datasheet_url:'https://www.st.com/resource/en/datasheet/stp40nf20.pdf' },
  '40NF20':   { category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'STMicroelectronics', voltage_max:200, current_max:40, description:'N-Ch Power MOSFET 200V 40A (alias STP40NF20)', datasheet_url:'https://www.st.com/resource/en/datasheet/stp40nf20.pdf' },
  '40N03P':   { category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'Various', voltage_max:30, current_max:40, description:'N-Ch Power MOSFET 30V 40A', datasheet_url:'https://www.alldatasheet.com/view.jsp?Searchword=40N03P' },
  'STP16NF06':{ category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'STMicroelectronics', voltage_max:60, current_max:16, description:'N-Ch MOSFET 60V 16A', datasheet_url:'https://www.st.com/resource/en/datasheet/stp16nf06.pdf' },
  'IRFZ44N':  { category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'Vishay/IR', voltage_max:55,  current_max:49, description:'N-Ch Power MOSFET 55V 49A', datasheet_url:'https://www.vishay.com/docs/91329/sihfz44n.pdf' },
  'FDP8896':  { category:'Transistors', subcategory:'Power MOSFET', package:'TO-220', manufacturer:'ON Semi', voltage_max:30, current_max:80, description:'N-Ch MOSFET 30V 80A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/fdp8896-d.pdf' },
  'STF13NM60N':{ category:'Transistors', subcategory:'Power MOSFET', package:'TO-220F', manufacturer:'STMicroelectronics', voltage_max:600, current_max:13, description:'N-Ch Power MOSFET 600V 13A', datasheet_url:'https://www.st.com/resource/en/datasheet/stf13nm60n.pdf' },

  // ================================================================
  // BJT — NPN
  // ================================================================
  'BC547':  { category:'Transistors', subcategory:'BJT NPN', package:'TO-92', manufacturer:'Various', voltage_max:45, current_max:0.1, description:'NPN General Purpose Transistor 45V 100mA', datasheet_url:'https://www.onsemi.com/pdf/datasheet/bc547-d.pdf' },
  'BC548':  { category:'Transistors', subcategory:'BJT NPN', package:'TO-92', manufacturer:'Various', voltage_max:30, current_max:0.1, description:'NPN General Purpose Transistor 30V 100mA', datasheet_url:'https://www.onsemi.com/pdf/datasheet/bc548-d.pdf' },
  'BC549':  { category:'Transistors', subcategory:'BJT NPN', package:'TO-92', manufacturer:'Various', voltage_max:30, current_max:0.1, description:'NPN Low Noise Transistor 30V 100mA', datasheet_url:'https://www.onsemi.com/pdf/datasheet/bc549-d.pdf' },
  '2N2222': { category:'Transistors', subcategory:'BJT NPN', package:'TO-92', manufacturer:'Various', voltage_max:40, current_max:0.6, description:'NPN Switching Transistor 40V 600mA', datasheet_url:'https://www.onsemi.com/pdf/datasheet/p2n2222a-d.pdf' },
  '2N3904': { category:'Transistors', subcategory:'BJT NPN', package:'TO-92', manufacturer:'Various', voltage_max:40, current_max:0.2, description:'NPN General Purpose Transistor 40V 200mA', datasheet_url:'https://www.onsemi.com/pdf/datasheet/2n3903-d.pdf' },
  '2N5551': { category:'Transistors', subcategory:'BJT NPN', package:'TO-92', manufacturer:'Various', voltage_max:160,current_max:0.6, description:'NPN High Voltage Transistor 160V 600mA', datasheet_url:'https://www.onsemi.com/pdf/datasheet/2n5551-d.pdf' },
  'BD135':  { category:'Transistors', subcategory:'BJT NPN', package:'TO-126', manufacturer:'Various', voltage_max:45, current_max:1.5, description:'NPN Medium Power Transistor 45V 1.5A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/bd135-d.pdf' },
  'BD139':  { category:'Transistors', subcategory:'BJT NPN', package:'TO-126', manufacturer:'Various', voltage_max:80, current_max:1.5, description:'NPN Medium Power Transistor 80V 1.5A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/bd139-d.pdf' },
  'TIP31C': { category:'Transistors', subcategory:'BJT NPN', package:'TO-220', manufacturer:'Various', voltage_max:100,current_max:3,   description:'NPN Power Transistor 100V 3A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/tip31-d.pdf' },
  'TIP41C': { category:'Transistors', subcategory:'BJT NPN', package:'TO-220', manufacturer:'Various', voltage_max:100,current_max:6,   description:'NPN Power Transistor 100V 6A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/tip41a-d.pdf' },
  'TIP120': { category:'Transistors', subcategory:'Darlington NPN', package:'TO-220', manufacturer:'Various', voltage_max:60, current_max:5,   description:'NPN Darlington Transistor 60V 5A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/tip120-d.pdf' },
  'TIP122': { category:'Transistors', subcategory:'Darlington NPN', package:'TO-220', manufacturer:'Various', voltage_max:100,current_max:5,   description:'NPN Darlington Transistor 100V 5A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/tip120-d.pdf' },
  'MJE13003':{ category:'Transistors', subcategory:'BJT NPN', package:'TO-126', manufacturer:'Various', voltage_max:400,current_max:1.5, description:'NPN High Voltage Transistor 400V 1.5A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/mje13003-d.pdf' },

  // ================================================================
  // BJT — PNP
  // ================================================================
  'BC557':  { category:'Transistors', subcategory:'BJT PNP', package:'TO-92', manufacturer:'Various', voltage_max:45, current_max:0.1, description:'PNP General Purpose Transistor 45V 100mA', datasheet_url:'https://www.onsemi.com/pdf/datasheet/bc557-d.pdf' },
  'BC558':  { category:'Transistors', subcategory:'BJT PNP', package:'TO-92', manufacturer:'Various', voltage_max:30, current_max:0.1, description:'PNP General Purpose Transistor 30V 100mA', datasheet_url:'https://www.onsemi.com/pdf/datasheet/bc558-d.pdf' },
  '2N2907': { category:'Transistors', subcategory:'BJT PNP', package:'TO-92', manufacturer:'Various', voltage_max:40, current_max:0.6, description:'PNP Switching Transistor 40V 600mA', datasheet_url:'https://www.onsemi.com/pdf/datasheet/p2n2906a-d.pdf' },
  '2N3906': { category:'Transistors', subcategory:'BJT PNP', package:'TO-92', manufacturer:'Various', voltage_max:40, current_max:0.2, description:'PNP General Purpose Transistor 40V 200mA', datasheet_url:'https://www.onsemi.com/pdf/datasheet/2n3905-d.pdf' },
  '2N5401': { category:'Transistors', subcategory:'BJT PNP', package:'TO-92', manufacturer:'Various', voltage_max:150,current_max:0.6, description:'PNP High Voltage Transistor 150V 600mA', datasheet_url:'https://www.onsemi.com/pdf/datasheet/2n5401-d.pdf' },
  'BD136':  { category:'Transistors', subcategory:'BJT PNP', package:'TO-126', manufacturer:'Various', voltage_max:45, current_max:1.5, description:'PNP Medium Power Transistor 45V 1.5A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/bd135-d.pdf' },
  'BD140':  { category:'Transistors', subcategory:'BJT PNP', package:'TO-126', manufacturer:'Various', voltage_max:80, current_max:1.5, description:'PNP Medium Power Transistor 80V 1.5A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/bd140-d.pdf' },
  'TIP32C': { category:'Transistors', subcategory:'BJT PNP', package:'TO-220', manufacturer:'Various', voltage_max:100,current_max:3,   description:'PNP Power Transistor 100V 3A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/tip32-d.pdf' },
  'TIP42C': { category:'Transistors', subcategory:'BJT PNP', package:'TO-220', manufacturer:'Various', voltage_max:100,current_max:6,   description:'PNP Power Transistor 100V 6A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/tip42a-d.pdf' },
  'TIP125': { category:'Transistors', subcategory:'Darlington PNP', package:'TO-220', manufacturer:'Various', voltage_max:60, current_max:5,   description:'PNP Darlington Transistor 60V 5A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/tip125-d.pdf' },
  'TIP127': { category:'Transistors', subcategory:'Darlington PNP', package:'TO-220', manufacturer:'Various', voltage_max:100,current_max:5,   description:'PNP Darlington Transistor 100V 5A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/tip125-d.pdf' },

  // ================================================================
  // Diodes — Rectifier
  // ================================================================
  '1N4001': { category:'Diodes', subcategory:'Rectifier', package:'DO-41', manufacturer:'Various', voltage_max:50,  current_max:1, description:'General Purpose Rectifier Diode 50V 1A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n4001-d.pdf' },
  '1N4002': { category:'Diodes', subcategory:'Rectifier', package:'DO-41', manufacturer:'Various', voltage_max:100, current_max:1, description:'General Purpose Rectifier Diode 100V 1A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n4001-d.pdf' },
  '1N4003': { category:'Diodes', subcategory:'Rectifier', package:'DO-41', manufacturer:'Various', voltage_max:200, current_max:1, description:'General Purpose Rectifier Diode 200V 1A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n4001-d.pdf' },
  '1N4004': { category:'Diodes', subcategory:'Rectifier', package:'DO-41', manufacturer:'Various', voltage_max:400, current_max:1, description:'General Purpose Rectifier Diode 400V 1A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n4001-d.pdf' },
  '1N4005': { category:'Diodes', subcategory:'Rectifier', package:'DO-41', manufacturer:'Various', voltage_max:600, current_max:1, description:'General Purpose Rectifier Diode 600V 1A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n4001-d.pdf' },
  '1N4006': { category:'Diodes', subcategory:'Rectifier', package:'DO-41', manufacturer:'Various', voltage_max:800, current_max:1, description:'General Purpose Rectifier Diode 800V 1A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n4001-d.pdf' },
  '1N4007': { category:'Diodes', subcategory:'Rectifier', package:'DO-41', manufacturer:'Various', voltage_max:1000,current_max:1, description:'General Purpose Rectifier Diode 1000V 1A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n4001-d.pdf' },
  'FR104':  { category:'Diodes', subcategory:'Fast Recovery', package:'DO-41', manufacturer:'Various', voltage_max:400, current_max:1, description:'Fast Recovery Rectifier 400V 1A', datasheet_url:'https://www.vishay.com/docs/88521/fr101.pdf' },
  'FR107':  { category:'Diodes', subcategory:'Fast Recovery', package:'DO-41', manufacturer:'Various', voltage_max:1000,current_max:1, description:'Fast Recovery Rectifier 1000V 1A', datasheet_url:'https://www.vishay.com/docs/88521/fr101.pdf' },
  'UF4007': { category:'Diodes', subcategory:'Ultra Fast Recovery', package:'DO-41', manufacturer:'Various', voltage_max:1000,current_max:1, description:'Ultra Fast Recovery Rectifier 1000V 1A', datasheet_url:'https://www.vishay.com/docs/88768/uf4001.pdf' },
  'HER108': { category:'Diodes', subcategory:'High Efficiency', package:'DO-41', manufacturer:'Various', voltage_max:1000,current_max:1, description:'High Efficiency Rectifier 1000V 1A', datasheet_url:'https://www.vishay.com/docs/88550/her101.pdf' },
  'MUR460': { category:'Diodes', subcategory:'Ultra Fast Recovery', package:'TO-220AC', manufacturer:'ON Semi', voltage_max:600,current_max:4, description:'Ultra Fast Diode 600V 4A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/mur460-d.pdf' },
  'MBR20100':{ category:'Diodes', subcategory:'Schottky', package:'TO-220AB', manufacturer:'Various', voltage_max:100, current_max:20, description:'Schottky Barrier Rectifier 100V 20A', datasheet_url:'https://www.vishay.com/docs/93525/mbr2010.pdf' },
  'SR5100': { category:'Diodes', subcategory:'Schottky', package:'DO-27', manufacturer:'Various', voltage_max:100, current_max:5,  description:'Schottky Barrier Rectifier 100V 5A', datasheet_url:'https://www.vishay.com/docs/93497/sr5100.pdf' },
  'SR1060': { category:'Diodes', subcategory:'Schottky', package:'DO-27', manufacturer:'Various', voltage_max:60,  current_max:10, description:'Schottky Barrier Rectifier 60V 10A', datasheet_url:'https://www.vishay.com/docs/93548/sr1060.pdf' },
  '1N5819': { category:'Diodes', subcategory:'Schottky', package:'DO-41', manufacturer:'Various', voltage_max:40,  current_max:1,  description:'Schottky Barrier Rectifier 40V 1A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n5817-d.pdf' },
  '1N5822': { category:'Diodes', subcategory:'Schottky', package:'DO-27', manufacturer:'Various', voltage_max:40,  current_max:3,  description:'Schottky Barrier Rectifier 40V 3A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n5820-d.pdf' },
  'P6KE5A': { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:5,  current_max:null, description:'TVS Transient Voltage Suppressor 5V', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE12A':{ category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:12, current_max:null, description:'TVS Transient Voltage Suppressor 12V', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE36A':{ category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:36, current_max:null, description:'TVS Transient Voltage Suppressor 36V', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },

  // ================================================================
  // Diodes — Small Signal
  // ================================================================
  '1N4148': { category:'Diodes', subcategory:'Small Signal', package:'DO-35', manufacturer:'Various', voltage_max:100, current_max:0.2, description:'High Speed Switching Diode 100V 200mA', datasheet_url:'https://www.vishay.com/docs/81857/1n4148.pdf' },
  '1N914':  { category:'Diodes', subcategory:'Small Signal', package:'DO-35', manufacturer:'Various', voltage_max:100, current_max:0.2, description:'High Speed Switching Diode 100V 200mA', datasheet_url:'https://www.vishay.com/docs/85622/85622.pdf' },
  'BAT42':  { category:'Diodes', subcategory:'Schottky Small Signal', package:'DO-35', manufacturer:'Various', voltage_max:30,  current_max:0.2, description:'Schottky Signal Diode 30V 200mA', datasheet_url:'https://www.vishay.com/docs/85507/bat42.pdf' },
  'BAT85':  { category:'Diodes', subcategory:'Schottky Small Signal', package:'DO-35', manufacturer:'Various', voltage_max:30,  current_max:0.2, description:'Schottky Signal Diode 30V 200mA', datasheet_url:'https://www.vishay.com/docs/85514/bat85.pdf' },

  // ================================================================
  // Zener Diodes
  // ================================================================
  'BZX55C3V3':{ category:'Diodes', subcategory:'Zener', package:'DO-35', manufacturer:'Various', voltage_max:3.3, current_max:null, description:'Zener Diode 3.3V 500mW', datasheet_url:'https://www.vishay.com/docs/85604/bzx55.pdf' },
  'BZX55C5V1':{ category:'Diodes', subcategory:'Zener', package:'DO-35', manufacturer:'Various', voltage_max:5.1, current_max:null, description:'Zener Diode 5.1V 500mW', datasheet_url:'https://www.vishay.com/docs/85604/bzx55.pdf' },
  'BZX55C12': { category:'Diodes', subcategory:'Zener', package:'DO-35', manufacturer:'Various', voltage_max:12,  current_max:null, description:'Zener Diode 12V 500mW', datasheet_url:'https://www.vishay.com/docs/85604/bzx55.pdf' },
  'BZX55C15': { category:'Diodes', subcategory:'Zener', package:'DO-35', manufacturer:'Various', voltage_max:15,  current_max:null, description:'Zener Diode 15V 500mW', datasheet_url:'https://www.vishay.com/docs/85604/bzx55.pdf' },
  'BZX55C24': { category:'Diodes', subcategory:'Zener', package:'DO-35', manufacturer:'Various', voltage_max:24,  current_max:null, description:'Zener Diode 24V 500mW', datasheet_url:'https://www.vishay.com/docs/85604/bzx55.pdf' },
  '1N4733A':  { category:'Diodes', subcategory:'Zener', package:'DO-41', manufacturer:'Various', voltage_max:5.1, current_max:null, description:'Zener Diode 5.1V 1W', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n4728-d.pdf' },
  '1N4742A':  { category:'Diodes', subcategory:'Zener', package:'DO-41', manufacturer:'Various', voltage_max:12,  current_max:null, description:'Zener Diode 12V 1W', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n4728-d.pdf' },
  '1N4745A':  { category:'Diodes', subcategory:'Zener', package:'DO-41', manufacturer:'Various', voltage_max:16,  current_max:null, description:'Zener Diode 16V 1W', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n4728-d.pdf' },
  '1N4748A':  { category:'Diodes', subcategory:'Zener', package:'DO-41', manufacturer:'Various', voltage_max:22,  current_max:null, description:'Zener Diode 22V 1W', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n4728-d.pdf' },
  '1N4752A':  { category:'Diodes', subcategory:'Zener', package:'DO-41', manufacturer:'Various', voltage_max:33,  current_max:null, description:'Zener Diode 33V 1W', datasheet_url:'https://www.onsemi.com/pdf/datasheet/1n4728-d.pdf' },

  // ================================================================
  // Voltage Regulators — Linear
  // ================================================================
  'LM7805':  { category:'ICs', subcategory:'Linear Regulator', package:'TO-220', manufacturer:'Various', voltage_max:35, current_max:1.5, description:'5V Fixed Positive Voltage Regulator', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm78.pdf' },
  'LM7812':  { category:'ICs', subcategory:'Linear Regulator', package:'TO-220', manufacturer:'Various', voltage_max:35, current_max:1.5, description:'12V Fixed Positive Voltage Regulator', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm78.pdf' },
  'LM7815':  { category:'ICs', subcategory:'Linear Regulator', package:'TO-220', manufacturer:'Various', voltage_max:35, current_max:1.5, description:'15V Fixed Positive Voltage Regulator', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm78.pdf' },
  'LM7824':  { category:'ICs', subcategory:'Linear Regulator', package:'TO-220', manufacturer:'Various', voltage_max:40, current_max:1.5, description:'24V Fixed Positive Voltage Regulator', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm78.pdf' },
  'LM7905':  { category:'ICs', subcategory:'Linear Regulator', package:'TO-220', manufacturer:'Various', voltage_max:35, current_max:1.5, description:'-5V Fixed Negative Voltage Regulator', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm79.pdf' },
  'LM7912':  { category:'ICs', subcategory:'Linear Regulator', package:'TO-220', manufacturer:'Various', voltage_max:35, current_max:1.5, description:'-12V Fixed Negative Voltage Regulator', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm79.pdf' },
  'LM78L05': { category:'ICs', subcategory:'Linear Regulator', package:'TO-92', manufacturer:'Various', voltage_max:35, current_max:0.1, description:'5V Fixed Positive Regulator 100mA', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm78l.pdf' },
  'LM317':   { category:'ICs', subcategory:'Linear Regulator', package:'TO-220', manufacturer:'Various', voltage_max:40, current_max:1.5, description:'Adjustable Positive Voltage Regulator 1.25-37V', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm317.pdf' },
  'LM337':   { category:'ICs', subcategory:'Linear Regulator', package:'TO-220', manufacturer:'Various', voltage_max:40, current_max:1.5, description:'Adjustable Negative Voltage Regulator -1.25 to -37V', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm337.pdf' },
  'AMS1117': { category:'ICs', subcategory:'LDO Regulator', package:'SOT-223', manufacturer:'Advanced Monolithic Systems', voltage_max:15, current_max:1, description:'Low Dropout Regulator (various fixed/adj voltages)', datasheet_url:'https://www.advanced-monolithic.com/pdf/ds1117.pdf' },
  'LM1117':  { category:'ICs', subcategory:'LDO Regulator', package:'SOT-223', manufacturer:'Various', voltage_max:20, current_max:0.8, description:'Low Dropout Voltage Regulator', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm1117.pdf' },
  'TL431':   { category:'ICs', subcategory:'Voltage Reference', package:'TO-92', manufacturer:'Various', voltage_max:36, current_max:0.1, description:'Adjustable Precision Shunt Regulator 2.5-36V', datasheet_url:'https://www.ti.com/lit/ds/symlink/tl431.pdf' },
  'TL431A':  { category:'ICs', subcategory:'Voltage Reference', package:'TO-92', manufacturer:'Various', voltage_max:36, current_max:0.1, description:'Adjustable Precision Shunt Regulator 2.5-36V (A Grade)', datasheet_url:'https://www.ti.com/lit/ds/symlink/tl431.pdf' },
  'LM336':   { category:'ICs', subcategory:'Voltage Reference', package:'TO-92', manufacturer:'Various', voltage_max:null, current_max:0.01, description:'2.5V Reference Diode', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm336-2.5.pdf' },
  'LM385':   { category:'ICs', subcategory:'Voltage Reference', package:'TO-92', manufacturer:'Various', voltage_max:null, current_max:0.02, description:'Micropower Voltage Reference Diode', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm385.pdf' },

  // ================================================================
  // Timer & Op-Amp ICs
  // ================================================================
  'NE555':   { category:'ICs', subcategory:'Timer', package:'DIP-8', manufacturer:'Various', voltage_max:18, current_max:0.2, description:'555 Timer IC', datasheet_url:'https://www.ti.com/lit/ds/symlink/ne555.pdf' },
  'LM555':   { category:'ICs', subcategory:'Timer', package:'DIP-8', manufacturer:'Texas Instruments', voltage_max:18, current_max:0.2, description:'555 Timer IC', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm555.pdf' },
  'SE555':   { category:'ICs', subcategory:'Timer', package:'DIP-8', manufacturer:'Various', voltage_max:18, current_max:0.2, description:'555 Timer IC (Military Grade)', datasheet_url:'https://www.ti.com/lit/ds/symlink/se555.pdf' },
  'SA555':   { category:'ICs', subcategory:'Timer', package:'DIP-8', manufacturer:'Various', voltage_max:18, current_max:0.2, description:'555 Timer IC (Automotive)', datasheet_url:'https://www.ti.com/lit/ds/symlink/sa555.pdf' },
  'ICM7555': { category:'ICs', subcategory:'Timer', package:'DIP-8', manufacturer:'Renesas', voltage_max:18, current_max:0.1, description:'CMOS 555 Timer IC (Low Power)', datasheet_url:'https://www.renesas.com/us/en/document/dst/icm7555-icm7556-datasheet' },
  'NE556':   { category:'ICs', subcategory:'Timer', package:'DIP-14', manufacturer:'Various', voltage_max:18, current_max:0.2, description:'Dual 555 Timer IC', datasheet_url:'https://www.ti.com/lit/ds/symlink/ne556.pdf' },
  '555':     { category:'ICs', subcategory:'Timer', package:'DIP-8', manufacturer:'Various', voltage_max:18, current_max:0.2, description:'555 Timer IC', datasheet_url:'https://www.ti.com/lit/ds/symlink/ne555.pdf' },
  'LM358':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Various', voltage_max:32, current_max:null, description:'Dual General Purpose Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm358.pdf' },
  'LM324':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-14', manufacturer:'Various', voltage_max:32, current_max:null, description:'Quad General Purpose Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm324.pdf' },
  'LM741':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Various', voltage_max:44, current_max:null, description:'General Purpose Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/ua741.pdf' },
  'LM393':   { category:'ICs', subcategory:'Comparator', package:'DIP-8', manufacturer:'Various', voltage_max:36, current_max:null, description:'Dual Voltage Comparator', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm393.pdf' },
  'LM339':   { category:'ICs', subcategory:'Comparator', package:'DIP-14', manufacturer:'Various', voltage_max:36, current_max:null, description:'Quad Voltage Comparator', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm339.pdf' },
  'TL071':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Various', voltage_max:36, current_max:null, description:'Low Noise JFET Input Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/tl071.pdf' },
  'TL072':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Various', voltage_max:36, current_max:null, description:'Dual Low Noise JFET Input Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/tl072.pdf' },
  'TL074':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-14', manufacturer:'Various', voltage_max:36, current_max:null, description:'Quad Low Noise JFET Input Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/tl074.pdf' },
  'NE5532':  { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Various', voltage_max:44, current_max:null, description:'Dual Low Noise High Speed Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/ne5532.pdf' },
  'CA3140':  { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Renesas', voltage_max:36, current_max:null, description:'BiMOS Op-Amp with MOSFET Input', datasheet_url:'https://www.renesas.com/us/en/document/dst/ca3140-ca3140a-datasheet' },
  'LM386':   { category:'ICs', subcategory:'Audio Amplifier', package:'DIP-8', manufacturer:'Various', voltage_max:15, current_max:null, description:'Low Voltage Audio Power Amplifier', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm386.pdf' },
  'LM2596':  { category:'ICs', subcategory:'Switching Regulator', package:'TO-263', manufacturer:'Various', voltage_max:40, current_max:3, description:'SIMPLE SWITCHER 3A Step-Down Voltage Regulator', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm2596.pdf' },
  'LM2576':  { category:'ICs', subcategory:'Switching Regulator', package:'TO-263', manufacturer:'Various', voltage_max:40, current_max:3, description:'SIMPLE SWITCHER 3A Step-Down Voltage Regulator', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm2576.pdf' },
  'XL6009':  { category:'ICs', subcategory:'Switching Regulator', package:'TO-263', manufacturer:'XLSEMI', voltage_max:32, current_max:4, description:'400KHz 60V 4A Switching Current Boost LED Step-Up Converter', datasheet_url:'https://www.xlsemi.com/datasheet/XL6009%20datasheet.pdf' },
  'MP1584':  { category:'ICs', subcategory:'Switching Regulator', package:'SOIC-8', manufacturer:'MPS', voltage_max:28, current_max:3, description:'3A, 1.5MHz, 28V Step-Down Converter', datasheet_url:'https://www.monolithicpower.com/en/documentview/productdocument/index/version/2/document_type/Datasheet/lang/en/sku/MP1584/document_id/204' },

  // ================================================================
  // PWM Controllers & Gate Drivers
  // ================================================================
  'SG3525':  { category:'ICs', subcategory:'PWM Controller', package:'DIP-16', manufacturer:'Various', voltage_max:35, current_max:null, description:'Pulse Width Modulation Control Circuit', datasheet_url:'https://www.ti.com/lit/ds/symlink/sg3525.pdf' },
  'TL494':   { category:'ICs', subcategory:'PWM Controller', package:'DIP-16', manufacturer:'Texas Instruments', voltage_max:41, current_max:null, description:'Push-Pull PWM Control Circuit', datasheet_url:'https://www.ti.com/lit/ds/symlink/tl494.pdf' },
  'UC3842':  { category:'ICs', subcategory:'PWM Controller', package:'DIP-8', manufacturer:'Various', voltage_max:30, current_max:null, description:'Current Mode PWM Controller', datasheet_url:'https://www.ti.com/lit/ds/symlink/uc3842.pdf' },
  'UC3843':  { category:'ICs', subcategory:'PWM Controller', package:'DIP-8', manufacturer:'Various', voltage_max:30, current_max:null, description:'Current Mode PWM Controller (Adjustable Duty Cycle)', datasheet_url:'https://www.ti.com/lit/ds/symlink/uc3843.pdf' },
  'IR2110':  { category:'ICs', subcategory:'Gate Driver', package:'DIP-14', manufacturer:'Infineon/IR', voltage_max:600, current_max:2, description:'High/Low Side MOSFET Gate Driver 600V 2A', datasheet_url:'https://www.infineon.com/dgdl/Infineon-IR2110-DataSheet-v01_00-EN.pdf?fileId=5546d462533600a4015355c7c1c31671' },
  'IR2101':  { category:'ICs', subcategory:'Gate Driver', package:'DIP-8', manufacturer:'Infineon/IR', voltage_max:600, current_max:0.13, description:'High/Low Side Gate Driver 600V', datasheet_url:'https://www.infineon.com/dgdl/Infineon-IR2101-DataSheet-v01_00-EN.pdf?fileId=5546d462533600a401535573a1c31666' },
  'UCC27524': { category:'ICs', subcategory:'Gate Driver', package:'SOT-23-5', manufacturer:'Texas Instruments', voltage_max:18, current_max:5, description:'Dual 5A Sink/Source Gate Driver', datasheet_url:'https://www.ti.com/lit/ds/symlink/ucc27524.pdf' },
  'VIPER22A': { category:'ICs', subcategory:'Power Switch', package:'DIP-8', manufacturer:'STMicroelectronics', voltage_max:730, current_max:0.5, description:'Low Power Off-Line SMPS Primary Switch', datasheet_url:'https://www.st.com/resource/en/datasheet/viper22a.pdf' },
  'VIPER12A': { category:'ICs', subcategory:'Power Switch', package:'DIP-8', manufacturer:'STMicroelectronics', voltage_max:730, current_max:0.3, description:'Low Power Off-Line SMPS Primary Switch', datasheet_url:'https://www.st.com/resource/en/datasheet/viper12a.pdf' },
  'TOP246Y':  { category:'ICs', subcategory:'Power Switch', package:'TO-220-7C', manufacturer:'Power Integrations', voltage_max:700, current_max:3.5, description:'TOPSwitch-GX EcoSmart Integrated Off-Line Switcher', datasheet_url:'https://www.power.com/sites/default/files/product-docs/top242-250y.pdf' },

  // ================================================================
  // Logic ICs
  // ================================================================
  'CD4047':  { category:'ICs', subcategory:'Logic / Timer', package:'DIP-14', manufacturer:'Various', voltage_max:18, current_max:null, description:'Low-Power Monostable/Astable Multivibrator', datasheet_url:'https://www.ti.com/lit/ds/symlink/cd4047b.pdf' },
  'CD4060':  { category:'ICs', subcategory:'Logic / Counter', package:'DIP-16', manufacturer:'Various', voltage_max:18, current_max:null, description:'14-Stage Ripple-Carry Binary Counter + Oscillator', datasheet_url:'https://www.ti.com/lit/ds/symlink/cd4060b.pdf' },
  'CD4017':  { category:'ICs', subcategory:'Logic / Counter', package:'DIP-16', manufacturer:'Various', voltage_max:18, current_max:null, description:'Decade Counter / Divider', datasheet_url:'https://www.ti.com/lit/ds/symlink/cd4017b.pdf' },
  'CD4066':  { category:'ICs', subcategory:'Logic / Switch', package:'DIP-14', manufacturer:'Various', voltage_max:20, current_max:null, description:'Quad Bilateral Switch', datasheet_url:'https://www.ti.com/lit/ds/symlink/cd4066b.pdf' },
  'SN74HC595':{ category:'ICs', subcategory:'Logic / Shift Register', package:'DIP-16', manufacturer:'Texas Instruments', voltage_max:7, current_max:null, description:'8-Bit Shift Register with Output Latches', datasheet_url:'https://www.ti.com/lit/ds/symlink/sn74hc595.pdf' },
  'SN74HC00': { category:'ICs', subcategory:'Logic / NAND', package:'DIP-14', manufacturer:'Texas Instruments', voltage_max:7, current_max:null, description:'Quad 2-Input NAND Gate', datasheet_url:'https://www.ti.com/lit/ds/symlink/sn74hc00.pdf' },
  'SN74HC245':{ category:'ICs', subcategory:'Logic / Buffer', package:'DIP-20', manufacturer:'Texas Instruments', voltage_max:7, current_max:null, description:'Octal Bus Transceiver with 3-State Outputs', datasheet_url:'https://www.ti.com/lit/ds/symlink/sn74hc245.pdf' },

  // ================================================================
  // Motor Drivers
  // ================================================================
  'L298N':   { category:'ICs', subcategory:'Motor Driver', package:'Multiwatt15', manufacturer:'STMicroelectronics', voltage_max:46, current_max:2, description:'Dual Full-Bridge Motor Driver', datasheet_url:'https://www.st.com/resource/en/datasheet/l298.pdf' },
  'L293D':   { category:'ICs', subcategory:'Motor Driver', package:'DIP-16', manufacturer:'Various', voltage_max:36, current_max:0.6, description:'Quadruple Half-H Driver', datasheet_url:'https://www.ti.com/lit/ds/symlink/l293.pdf' },
  'DRV8825': { category:'ICs', subcategory:'Stepper Driver', package:'HTSSOP-28', manufacturer:'Texas Instruments', voltage_max:45, current_max:2.5, description:'Stepper Motor Controller IC', datasheet_url:'https://www.ti.com/lit/ds/symlink/drv8825.pdf' },
  'A4988':   { category:'ICs', subcategory:'Stepper Driver', package:'QFN-28', manufacturer:'Allegro', voltage_max:35, current_max:2, description:'DMOS Microstepping Driver with Translator', datasheet_url:'https://www.allegromicro.com/en/Products/Sense-and-Control/Motor-Drivers/Step-Motor-Drivers/A4988.aspx' },

  // ================================================================
  // Optocouplers
  // ================================================================
  'PC817':   { category:'ICs', subcategory:'Optocoupler', package:'DIP-4', manufacturer:'Various', voltage_max:80, current_max:0.05, description:'General Purpose Phototransistor Optocoupler', datasheet_url:'https://www.sharpsma.com/media/product/spec/PC817X%20Series_1.pdf' },
  '4N25':    { category:'ICs', subcategory:'Optocoupler', package:'DIP-6', manufacturer:'Various', voltage_max:70, current_max:0.05, description:'General Purpose Optocoupler (Phototransistor)', datasheet_url:'https://www.vishay.com/docs/83725/4n25.pdf' },
  '4N35':    { category:'ICs', subcategory:'Optocoupler', package:'DIP-6', manufacturer:'Vishay', voltage_max:70, current_max:0.15, description:'General Purpose Optocoupler', datasheet_url:'https://www.vishay.com/docs/83728/4n35.pdf' },
  'MOC3021': { category:'ICs', subcategory:'Optocoupler', package:'DIP-6', manufacturer:'Various', voltage_max:400, current_max:null, description:'Optoisolator Triac Driver Output (Non-Zero Crossing)', datasheet_url:'https://www.onsemi.com/pdf/datasheet/moc3021m-d.pdf' },
  'MOC3041': { category:'ICs', subcategory:'Optocoupler', package:'DIP-6', manufacturer:'Various', voltage_max:400, current_max:null, description:'Optoisolator Triac Driver Output (Zero Crossing)', datasheet_url:'https://www.onsemi.com/pdf/datasheet/moc3040m-d.pdf' },

  // ================================================================
  // Microcontrollers
  // ================================================================
  'ATMEGA328P': { category:'ICs', subcategory:'Microcontroller', package:'DIP-28', manufacturer:'Microchip/Atmel', voltage_max:5.5, current_max:0.2, description:'8-bit AVR MCU 32KB Flash, 2KB SRAM', datasheet_url:'https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-7810-Automotive-Microcontrollers-ATmega328P_Datasheet.pdf' },
  'ATTINY85':   { category:'ICs', subcategory:'Microcontroller', package:'DIP-8', manufacturer:'Microchip/Atmel', voltage_max:5.5, current_max:0.2, description:'8-bit AVR MCU 8KB Flash, 512B SRAM', datasheet_url:'https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-2586-AVR-8-bit-Microcontroller-ATtiny25-ATtiny45-ATtiny85_Datasheet.pdf' },
  'STM32F103C8':{ category:'ICs', subcategory:'Microcontroller', package:'LQFP-48', manufacturer:'STMicroelectronics', voltage_max:3.6, current_max:0.5, description:'32-bit ARM Cortex-M3 MCU 64KB Flash', datasheet_url:'https://www.st.com/resource/en/datasheet/stm32f103c8.pdf' },
  'PIC16F628A': { category:'ICs', subcategory:'Microcontroller', package:'DIP-18', manufacturer:'Microchip', voltage_max:5.5, current_max:0.25, description:'PIC MCU 2KB Flash, 128B SRAM', datasheet_url:'https://ww1.microchip.com/downloads/en/DeviceDoc/40044f.pdf' },

  // ================================================================
  // Crystals
  // ================================================================
  '8MHZ':    { category:'Crystals', subcategory:'HC-49/S', package:'HC-49/S', manufacturer:'Various', voltage_max:null, current_max:null, description:'8 MHz Crystal Resonator', datasheet_url:'' },
  '16MHZ':   { category:'Crystals', subcategory:'HC-49/S', package:'HC-49/S', manufacturer:'Various', voltage_max:null, current_max:null, description:'16 MHz Crystal Resonator', datasheet_url:'' },
  '20MHZ':   { category:'Crystals', subcategory:'HC-49/S', package:'HC-49/S', manufacturer:'Various', voltage_max:null, current_max:null, description:'20 MHz Crystal Resonator', datasheet_url:'' },

  // ================================================================
  // Relays
  // ================================================================
  'SRD05VDC':  { category:'Relays', subcategory:'Relay', package:'SRD-05VDC-SL-C', manufacturer:'Songle', voltage_max:250, current_max:10, description:'5V Coil Electromagnetic Relay 250VAC/10A', datasheet_url:'https://www.electrodragon.com/w/images/d/de/EDS_SRD.pdf' },
  'G5LE14DC5': { category:'Relays', subcategory:'Relay', package:'PC mount', manufacturer:'Omron', voltage_max:250, current_max:10, description:'Relay 5V Coil SPDT 10A', datasheet_url:'https://omronfs.omron.com/en_US/ecb/products/pdf/en-g5le.pdf' },

  // ================================================================
  // Thyristors / SCR
  // ================================================================
  'BT151800R': { category:'Thyristors', subcategory:'SCR', package:'TO-220', manufacturer:'Various', voltage_max:800, current_max:12, description:'SCR Thyristor 800V 12A', datasheet_url:'https://www.nxp.com/docs/en/data-sheet/BT151.pdf' },
  'BT151600R': { category:'Thyristors', subcategory:'SCR', package:'TO-220', manufacturer:'Various', voltage_max:600, current_max:12, description:'SCR Thyristor 600V 12A', datasheet_url:'https://www.nxp.com/docs/en/data-sheet/BT151.pdf' },
  'BT151':     { category:'Thyristors', subcategory:'SCR', package:'TO-220', manufacturer:'Various', voltage_max:800, current_max:12, description:'SCR Thyristor', datasheet_url:'https://www.nxp.com/docs/en/data-sheet/BT151.pdf' },
  'BT136600E': { category:'Thyristors', subcategory:'TRIAC', package:'TO-220', manufacturer:'Various', voltage_max:600, current_max:4, description:'TRIAC 600V 4A', datasheet_url:'https://www.nxp.com/docs/en/data-sheet/BT136.pdf' },
  'BT136800E': { category:'Thyristors', subcategory:'TRIAC', package:'TO-220', manufacturer:'Various', voltage_max:800, current_max:4, description:'TRIAC 800V 4A', datasheet_url:'https://www.nxp.com/docs/en/data-sheet/BT136.pdf' },
  'BT139600E': { category:'Thyristors', subcategory:'TRIAC', package:'TO-220', manufacturer:'Various', voltage_max:600, current_max:16, description:'TRIAC 600V 16A', datasheet_url:'https://www.nxp.com/docs/en/data-sheet/BT139.pdf' },
  'BTA16600B': { category:'Thyristors', subcategory:'TRIAC', package:'TO-220AB', manufacturer:'STMicroelectronics', voltage_max:600, current_max:16, description:'TRIAC 600V 16A', datasheet_url:'https://www.st.com/resource/en/datasheet/bta16.pdf' },
  'TIC226D':   { category:'Thyristors', subcategory:'TRIAC', package:'TO-220', manufacturer:'Texas Instruments', voltage_max:400, current_max:8, description:'TRIAC 400V 8A', datasheet_url:'https://www.ti.com/lit/ds/symlink/tic226.pdf' },
  'TIC226M':   { category:'Thyristors', subcategory:'TRIAC', package:'TO-220', manufacturer:'Texas Instruments', voltage_max:600, current_max:8, description:'TRIAC 600V 8A', datasheet_url:'https://www.ti.com/lit/ds/symlink/tic226.pdf' },
  'MAC97A6':   { category:'Thyristors', subcategory:'TRIAC', package:'TO-92', manufacturer:'ON Semi', voltage_max:400, current_max:0.6, description:'TRIAC 400V 600mA', datasheet_url:'https://www.onsemi.com/pdf/datasheet/mac97a-d.pdf' },
  'BTX38600R': { category:'Thyristors', subcategory:'SCR', package:'TO-220', manufacturer:'Various', voltage_max:600, current_max:16, description:'SCR Thyristor 600V 16A', datasheet_url:'' },
  'BTX38800R': { category:'Thyristors', subcategory:'SCR', package:'TO-220', manufacturer:'Various', voltage_max:800, current_max:16, description:'SCR Thyristor 800V 16A', datasheet_url:'' },
  'MCR100':    { category:'Thyristors', subcategory:'SCR', package:'TO-92', manufacturer:'ON Semi', voltage_max:400, current_max:0.8, description:'Sensitive Gate SCR 400V 800mA', datasheet_url:'https://www.onsemi.com/pdf/datasheet/mcr100-d.pdf' },

  // ================================================================
  // TVS Diodes — P6KE Series (extended)
  // ================================================================
  'P6KE6V8A':  { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:6.8,  current_max:null, description:'TVS Diode 6.8V Bidirectional', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE10A':   { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:10,   current_max:null, description:'TVS Diode 10V Unidirectional', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE15A':   { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:15,   current_max:null, description:'TVS Diode 15V Unidirectional', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE15CA':  { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:15,   current_max:null, description:'TVS Diode 15V Bidirectional', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE18A':   { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:18,   current_max:null, description:'TVS Diode 18V Unidirectional', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE22A':   { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:22,   current_max:null, description:'TVS Diode 22V Unidirectional', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE27A':   { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:27,   current_max:null, description:'TVS Diode 27V Unidirectional', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE33A':   { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:33,   current_max:null, description:'TVS Diode 33V Unidirectional', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE40A':   { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:40,   current_max:null, description:'TVS Diode 40V Unidirectional', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE47A':   { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:47,   current_max:null, description:'TVS Diode 47V Unidirectional', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE51A':   { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:51,   current_max:null, description:'TVS Diode 51V Unidirectional', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE68A':   { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:68,   current_max:null, description:'TVS Diode 68V Unidirectional', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'P6KE100A':  { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:100,  current_max:null, description:'TVS Diode 100V Unidirectional', datasheet_url:'https://www.vishay.com/docs/88367/p6ke6v8a.pdf' },
  'SMBJ5V0A':  { category:'Diodes', subcategory:'TVS', package:'SMB', manufacturer:'Various', voltage_max:5,    current_max:null, description:'SMB TVS Diode 5V', datasheet_url:'https://www.vishay.com/docs/88375/smbj5v0a.pdf' },
  'SMBJ15A':   { category:'Diodes', subcategory:'TVS', package:'SMB', manufacturer:'Various', voltage_max:15,   current_max:null, description:'SMB TVS Diode 15V', datasheet_url:'https://www.vishay.com/docs/88375/smbj5v0a.pdf' },
  'SMBJ24A':   { category:'Diodes', subcategory:'TVS', package:'SMB', manufacturer:'Various', voltage_max:24,   current_max:null, description:'SMB TVS Diode 24V', datasheet_url:'https://www.vishay.com/docs/88375/smbj5v0a.pdf' },
  'SMBJ36A':   { category:'Diodes', subcategory:'TVS', package:'SMB', manufacturer:'Various', voltage_max:36,   current_max:null, description:'SMB TVS Diode 36V', datasheet_url:'https://www.vishay.com/docs/88375/smbj5v0a.pdf' },
  'BZW06P15':  { category:'Diodes', subcategory:'TVS', package:'DO-15', manufacturer:'Various', voltage_max:15,   current_max:null, description:'TVS Diode 6W 15V', datasheet_url:'' },

  // ================================================================
  // Gate Drivers (extended)
  // ================================================================
  'IR2110':    { category:'ICs', subcategory:'Gate Driver', package:'DIP-14', manufacturer:'Infineon/IR', voltage_max:600, current_max:2,   description:'High/Low Side Gate Driver 600V 2A', datasheet_url:'https://www.infineon.com/dgdl/Infineon-IR2110-DataSheet-v01_00-EN.pdf?fileId=5546d462533600a4015355c7c1c31671' },
  'IR2110S':   { category:'ICs', subcategory:'Gate Driver', package:'SOIC-16', manufacturer:'Infineon/IR', voltage_max:600, current_max:2,   description:'High/Low Side Gate Driver 600V 2A SMD', datasheet_url:'https://www.infineon.com/dgdl/Infineon-IR2110-DataSheet-v01_00-EN.pdf?fileId=5546d462533600a4015355c7c1c31671' },
  'IR2112':    { category:'ICs', subcategory:'Gate Driver', package:'DIP-14', manufacturer:'Infineon/IR', voltage_max:600, current_max:1.9, description:'High/Low Side Gate Driver 600V with Shutdown', datasheet_url:'https://www.infineon.com/dgdl/Infineon-IR2112-DataSheet-v01_00-EN.pdf?fileId=5546d462533600a4015355c7c1c31672' },
  'IR2112S':   { category:'ICs', subcategory:'Gate Driver', package:'SOIC-16', manufacturer:'Infineon/IR', voltage_max:600, current_max:1.9, description:'High/Low Side Gate Driver 600V with Shutdown SMD', datasheet_url:'https://www.infineon.com/dgdl/Infineon-IR2112-DataSheet-v01_00-EN.pdf?fileId=5546d462533600a4015355c7c1c31672' },
  'IR2113':    { category:'ICs', subcategory:'Gate Driver', package:'DIP-14', manufacturer:'Infineon/IR', voltage_max:600, current_max:2,   description:'High/Low Side Gate Driver 600V 2A', datasheet_url:'https://www.infineon.com/dgdl/Infineon-IR2113-DataSheet-v01_00-EN.pdf' },
  'IR2104':    { category:'ICs', subcategory:'Gate Driver', package:'DIP-8', manufacturer:'Infineon/IR', voltage_max:600, current_max:1.9, description:'Half-Bridge Gate Driver 600V', datasheet_url:'https://www.infineon.com/dgdl/Infineon-IR2104-DataSheet-v01_00-EN.pdf' },
  'TC4420':    { category:'ICs', subcategory:'Gate Driver', package:'TO-220-5', manufacturer:'Microchip', voltage_max:18, current_max:6,   description:'Single MOSFET Driver 6A Inverting', datasheet_url:'https://ww1.microchip.com/downloads/en/DeviceDoc/21419e.pdf' },
  'TC4429':    { category:'ICs', subcategory:'Gate Driver', package:'TO-220-5', manufacturer:'Microchip', voltage_max:18, current_max:6,   description:'Single MOSFET Driver 6A Non-Inverting', datasheet_url:'https://ww1.microchip.com/downloads/en/DeviceDoc/21419e.pdf' },
  'MCP14E4':   { category:'ICs', subcategory:'Gate Driver', package:'DIP-8', manufacturer:'Microchip', voltage_max:18, current_max:4,   description:'Dual 4A High-Speed Gate Driver', datasheet_url:'https://ww1.microchip.com/downloads/en/DeviceDoc/20005320A.pdf' },
  'FAN7842':   { category:'ICs', subcategory:'Gate Driver', package:'SOP-8', manufacturer:'Fairchild/ON', voltage_max:600, current_max:1.5, description:'High/Low Side Gate Driver 600V', datasheet_url:'' },

  // ================================================================
  // Op-Amps (extended)
  // ================================================================
  'MCP6002':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Microchip', voltage_max:6, current_max:null, description:'Dual 1 MHz Low Power Op-Amp', datasheet_url:'https://ww1.microchip.com/downloads/en/DeviceDoc/21733j.pdf' },
  'MCP6002T':  { category:'ICs', subcategory:'Op-Amp', package:'SOT-23-8', manufacturer:'Microchip', voltage_max:6, current_max:null, description:'Dual 1 MHz Low Power Op-Amp SMD', datasheet_url:'https://ww1.microchip.com/downloads/en/DeviceDoc/21733j.pdf' },
  'MCP6004':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-14', manufacturer:'Microchip', voltage_max:6, current_max:null, description:'Quad 1 MHz Low Power Op-Amp', datasheet_url:'https://ww1.microchip.com/downloads/en/DeviceDoc/21733j.pdf' },
  'TL081':     { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Texas Instruments', voltage_max:36, current_max:null, description:'JFET Input Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/tl081.pdf' },
  'TL082':     { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Texas Instruments', voltage_max:36, current_max:null, description:'Dual JFET Input Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/tl082.pdf' },
  'OP07':      { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Various', voltage_max:36, current_max:null, description:'Low Offset Precision Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/op07d.pdf' },
  'OPA2134':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Texas Instruments', voltage_max:36, current_max:null, description:'High Performance Audio Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/opa2134.pdf' },
  'LMV358':    { category:'ICs', subcategory:'Op-Amp', package:'SOT-23-8', manufacturer:'Texas Instruments', voltage_max:5.5, current_max:null, description:'Dual Low Voltage Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/lmv358.pdf' },

  // ================================================================
  // Touch / Capacitive Sensing ICs
  // ================================================================
  'TTP223':    { category:'ICs', subcategory:'Touch Sensor', package:'SOT-23-6', manufacturer:'TONTEK', voltage_max:5.5, current_max:null, description:'1-Key Capacitive Touch Sensor IC', datasheet_url:'https://www.sunrom.com/get/835300' },
  'TTP223BA6': { category:'ICs', subcategory:'Touch Sensor', package:'SOT-23-6', manufacturer:'TONTEK', voltage_max:5.5, current_max:null, description:'1-Key Capacitive Touch Sensor IC (Active High)', datasheet_url:'https://www.sunrom.com/get/835300' },
  'TTP224':    { category:'ICs', subcategory:'Touch Sensor', package:'SOP-16', manufacturer:'TONTEK', voltage_max:5.5, current_max:null, description:'4-Key Capacitive Touch Sensor IC', datasheet_url:'' },
  'AT42QT1010':{ category:'ICs', subcategory:'Touch Sensor', package:'SOT-23', manufacturer:'Microchip', voltage_max:5.5, current_max:null, description:'1-Channel Capacitive Touch Sensor', datasheet_url:'https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-9179-AT42-QTouch-BSW-AT42QT1010_Datasheet.pdf' },

  // ================================================================
  // LED Driver ICs
  // ================================================================
  'QX5253':    { category:'ICs', subcategory:'LED Driver', package:'SOT-23-5', manufacturer:'QX', voltage_max:30, current_max:1.5, description:'Inductorless LED Driver IC', datasheet_url:'' },
  'PT4115':    { category:'ICs', subcategory:'LED Driver', package:'SOT-89-5', manufacturer:'PowTech', voltage_max:30, current_max:1.2, description:'Constant Current LED Driver', datasheet_url:'' },
  'WS2811':    { category:'ICs', subcategory:'LED Driver', package:'SOP-8', manufacturer:'WorldSemi', voltage_max:6, current_max:0.018, description:'3-Channel LED Driver with Programmable Interface', datasheet_url:'https://cdn-shop.adafruit.com/datasheets/WS2811.pdf' },
  'WS2812B':   { category:'ICs', subcategory:'LED Driver', package:'LED-5050', manufacturer:'WorldSemi', voltage_max:5.3, current_max:0.06, description:'Intelligent Control LED Integrated Light Source', datasheet_url:'https://cdn-shop.adafruit.com/datasheets/WS2812B.pdf' },
  'HY2213':    { category:'ICs', subcategory:'LED Driver', package:'SOT-23-5', manufacturer:'Hynetek', voltage_max:24, current_max:0.35, description:'Boost LED Constant Current Driver', datasheet_url:'' },

  // ================================================================
  // Resistors — Common Series (for pattern matching, explicit entries)
  // ================================================================
  'CFR25':     { category:'Resistors', subcategory:'Carbon Film', package:'0207', manufacturer:'Various', voltage_max:350, current_max:null, description:'Carbon Film Resistor 1/4W', datasheet_url:'' },
  'CFR50':     { category:'Resistors', subcategory:'Carbon Film', package:'0207', manufacturer:'Various', voltage_max:350, current_max:null, description:'Carbon Film Resistor 1/2W', datasheet_url:'' },
  'MF25':      { category:'Resistors', subcategory:'Metal Film', package:'0207', manufacturer:'Various', voltage_max:200, current_max:null, description:'Metal Film Resistor 1/4W 1%', datasheet_url:'' },
  'MF50':      { category:'Resistors', subcategory:'Metal Film', package:'0207', manufacturer:'Various', voltage_max:200, current_max:null, description:'Metal Film Resistor 1/2W 1%', datasheet_url:'' },
  'RS1W':      { category:'Resistors', subcategory:'Wirewound', package:'Axial', manufacturer:'Various', voltage_max:500, current_max:null, description:'Wirewound Resistor 1W', datasheet_url:'' },
  'RS2W':      { category:'Resistors', subcategory:'Wirewound', package:'Axial', manufacturer:'Various', voltage_max:500, current_max:null, description:'Wirewound Resistor 2W', datasheet_url:'' },
  'SQP10':     { category:'Resistors', subcategory:'Wirewound', package:'SQP', manufacturer:'Various', voltage_max:500, current_max:null, description:'Wirewound Resistor 10W', datasheet_url:'' },

  // ================================================================
  // Capacitors — Common Types (for pattern matching)
  // ================================================================
  'ECAP':      { category:'Capacitors', subcategory:'Electrolytic', package:'Radial', manufacturer:'Various', voltage_max:null, current_max:null, description:'Aluminium Electrolytic Capacitor', datasheet_url:'' },
  'MMK':       { category:'Capacitors', subcategory:'Film', package:'Radial', manufacturer:'Various', voltage_max:null, current_max:null, description:'Metallized Polyester Film Capacitor', datasheet_url:'' },
  'MKT':       { category:'Capacitors', subcategory:'Film', package:'Radial', manufacturer:'Various', voltage_max:null, current_max:null, description:'Metallized Polyester Film Capacitor', datasheet_url:'' },
  'MKP':       { category:'Capacitors', subcategory:'Film', package:'Radial', manufacturer:'Various', voltage_max:null, current_max:null, description:'Metallized Polypropylene Film Capacitor', datasheet_url:'' },

  // ================================================================
  // Additional MOSFETs (SMD)
  // ================================================================
  'IRFR024N':  { category:'Transistors', subcategory:'Power MOSFET', package:'D-PAK', manufacturer:'Vishay/IR', voltage_max:55,  current_max:17,  description:'N-Ch Power MOSFET 55V 17A D-PAK', datasheet_url:'https://www.vishay.com/docs/91263/sihfr024n.pdf' },
  'IRF7317':   { category:'Transistors', subcategory:'Power MOSFET', package:'SOIC-8', manufacturer:'Vishay/IR', voltage_max:30,  current_max:6.5,  description:'Dual N+P-Ch MOSFET 30V 6.5A SOIC-8', datasheet_url:'https://www.vishay.com/docs/91275/irf7317.pdf' },
  'AO3400':    { category:'Transistors', subcategory:'Power MOSFET', package:'SOT-23', manufacturer:'Alpha & Omega', voltage_max:30, current_max:5.7, description:'N-Ch MOSFET 30V 5.7A SOT-23', datasheet_url:'https://www.aosmd.com/pdfs/datasheet/AO3400A.pdf' },
  'AO3401':    { category:'Transistors', subcategory:'Power MOSFET', package:'SOT-23', manufacturer:'Alpha & Omega', voltage_max:30, current_max:4,   description:'P-Ch MOSFET 30V 4A SOT-23', datasheet_url:'https://www.aosmd.com/pdfs/datasheet/AO3401A.pdf' },
  'SI2302':    { category:'Transistors', subcategory:'Power MOSFET', package:'SOT-23', manufacturer:'Vishay/Siliconix', voltage_max:20, current_max:2.7, description:'N-Ch MOSFET 20V 2.7A SOT-23', datasheet_url:'https://www.vishay.com/docs/70611/si2302ds.pdf' },
  'STN3NF06L': { category:'Transistors', subcategory:'Power MOSFET', package:'SOT-223', manufacturer:'STMicroelectronics', voltage_max:60, current_max:3.5, description:'N-Ch MOSFET 60V 3.5A SOT-223', datasheet_url:'https://www.st.com/resource/en/datasheet/stn3nf06l.pdf' },

  // ================================================================
  // Additional BJTs (SMD)
  // ================================================================
  'MMBT3904':  { category:'Transistors', subcategory:'BJT NPN', package:'SOT-23', manufacturer:'Various', voltage_max:40, current_max:0.2, description:'NPN Transistor 40V 200mA SOT-23', datasheet_url:'https://www.onsemi.com/pdf/datasheet/mmbt3904-d.pdf' },
  'MMBT3906':  { category:'Transistors', subcategory:'BJT PNP', package:'SOT-23', manufacturer:'Various', voltage_max:40, current_max:0.2, description:'PNP Transistor 40V 200mA SOT-23', datasheet_url:'https://www.onsemi.com/pdf/datasheet/mmbt3906-d.pdf' },
  'MMBT2222A': { category:'Transistors', subcategory:'BJT NPN', package:'SOT-23', manufacturer:'Various', voltage_max:40, current_max:0.6, description:'NPN Switching Transistor 40V 600mA SOT-23', datasheet_url:'' },
  'S8050':     { category:'Transistors', subcategory:'BJT NPN', package:'TO-92', manufacturer:'Various', voltage_max:25, current_max:0.5, description:'NPN Transistor 25V 500mA', datasheet_url:'' },
  'S8550':     { category:'Transistors', subcategory:'BJT PNP', package:'TO-92', manufacturer:'Various', voltage_max:25, current_max:0.5, description:'PNP Transistor 25V 500mA', datasheet_url:'' },
  'SS8050':    { category:'Transistors', subcategory:'BJT NPN', package:'SOT-23', manufacturer:'Various', voltage_max:25, current_max:0.5, description:'NPN Transistor 25V 500mA SOT-23', datasheet_url:'' },

  // ================================================================
  // Additional SMD Diodes
  // ================================================================
  'M7':        { category:'Diodes', subcategory:'Rectifier', package:'SMA', manufacturer:'Various', voltage_max:1000,current_max:1, description:'General Purpose Rectifier 1000V 1A SMA (1N4007 equiv)', datasheet_url:'https://www.diodes.com/assets/Datasheets/ds28001.pdf' },
  'SS34':      { category:'Diodes', subcategory:'Schottky', package:'SMA', manufacturer:'Various', voltage_max:40,  current_max:3, description:'Schottky Rectifier 40V 3A SMA', datasheet_url:'' },
  'SS54':      { category:'Diodes', subcategory:'Schottky', package:'SMA', manufacturer:'Various', voltage_max:40,  current_max:5, description:'Schottky Rectifier 40V 5A SMA', datasheet_url:'' },
  'B5819W':    { category:'Diodes', subcategory:'Schottky', package:'SOD-123', manufacturer:'Various', voltage_max:40,  current_max:1, description:'Schottky Rectifier 40V 1A SOD-123', datasheet_url:'' },
  'BAV99':     { category:'Diodes', subcategory:'Small Signal', package:'SOT-23', manufacturer:'Various', voltage_max:70,  current_max:0.2, description:'Dual Series Small Signal Diode 70V 200mA', datasheet_url:'https://www.vishay.com/docs/85661/bav99.pdf' },
  'MBRS140T3': { category:'Diodes', subcategory:'Schottky', package:'SMB', manufacturer:'ON Semi', voltage_max:40,  current_max:1, description:'Schottky Power Rectifier 40V 1A', datasheet_url:'https://www.onsemi.com/pdf/datasheet/mbrs1100t3-d.pdf' },
  'STPS1H100A':{ category:'Diodes', subcategory:'Schottky', package:'SMA', manufacturer:'STMicroelectronics', voltage_max:100, current_max:1, description:'Schottky Rectifier 100V 1A', datasheet_url:'https://www.st.com/resource/en/datasheet/stps1h100a.pdf' },

  // ================================================================
  // Connectors & Headers
  // ================================================================
  'KF301':     { category:'Connectors', subcategory:'Terminal Block', package:'PCB-THT', manufacturer:'Dinkle/Various', voltage_max:300, current_max:15, description:'PCB Terminal Block 5mm Pitch', datasheet_url:'' },
  'KF2EDGK':   { category:'Connectors', subcategory:'Terminal Block', package:'PCB-THT', manufacturer:'Dinkle/Various', voltage_max:300, current_max:10, description:'Pluggable Terminal Block 5.08mm Pitch', datasheet_url:'' },
  'PH2S':      { category:'Connectors', subcategory:'Wire-to-Board', package:'JST', manufacturer:'JST', voltage_max:250, current_max:2, description:'JST-PH 2.0mm Pitch Connector', datasheet_url:'' },
  'XH2P':      { category:'Connectors', subcategory:'Wire-to-Board', package:'JST', manufacturer:'JST', voltage_max:250, current_max:3, description:'JST-XH 2.5mm Pitch Connector', datasheet_url:'' },
  'DS1136':    { category:'Connectors', subcategory:'IC Socket', package:'DIP', manufacturer:'Various', voltage_max:null, current_max:null, description:'DIP IC Socket', datasheet_url:'' },

  // ================================================================
  // Sensors
  // ================================================================
  'LM35':      { category:'Sensors', subcategory:'Temperature', package:'TO-92', manufacturer:'Texas Instruments', voltage_max:35, current_max:null, description:'Precision Centigrade Temperature Sensor', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm35.pdf' },
  'LM35DZ':    { category:'Sensors', subcategory:'Temperature', package:'TO-92', manufacturer:'Texas Instruments', voltage_max:35, current_max:null, description:'Precision Centigrade Temperature Sensor (0-100°C)', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm35.pdf' },
  'DS18B20':   { category:'Sensors', subcategory:'Temperature', package:'TO-92', manufacturer:'Maxim/DS', voltage_max:5.5, current_max:null, description:'1-Wire Digital Thermometer -55 to +125°C', datasheet_url:'https://datasheets.maximintegrated.com/en/ds/DS18B20.pdf' },
  'DHT11':     { category:'Sensors', subcategory:'Humidity / Temp', package:'SIP-4', manufacturer:'AOSONG', voltage_max:5.5, current_max:null, description:'Digital Relative Humidity and Temperature Sensor', datasheet_url:'https://www.mouser.com/datasheet/2/758/DHT11-Technical-Data-Sheet-Translated-Version-1143054.pdf' },
  'DHT22':     { category:'Sensors', subcategory:'Humidity / Temp', package:'SIP-4', manufacturer:'AOSONG', voltage_max:5.5, current_max:null, description:'Digital Humidity and Temperature Sensor ±0.5°C', datasheet_url:'https://cdn-shop.adafruit.com/datasheets/DHT22.pdf' },
  'NTC10K':    { category:'Sensors', subcategory:'NTC Thermistor', package:'Radial', manufacturer:'Various', voltage_max:null, current_max:null, description:'NTC Thermistor 10kΩ at 25°C', datasheet_url:'' },
  'PTC250':    { category:'Sensors', subcategory:'PTC Thermistor', package:'Radial', manufacturer:'Various', voltage_max:null, current_max:null, description:'PTC Thermistor Self-Resetting Fuse', datasheet_url:'' },
  'ACS712':    { category:'Sensors', subcategory:'Current Sensor', package:'SOIC-8', manufacturer:'Allegro', voltage_max:5.5, current_max:5, description:'Hall Effect Current Sensor IC ±5/20/30A', datasheet_url:'https://www.allegromicro.com/~/media/Files/Datasheets/ACS712-Datasheet.ashx' },
  'INA219':    { category:'Sensors', subcategory:'Current/Power', package:'SOIC-8', manufacturer:'Texas Instruments', voltage_max:26, current_max:null, description:'I2C Current/Power Monitor', datasheet_url:'https://www.ti.com/lit/ds/symlink/ina219.pdf' },

  // ================================================================
  // Additional Voltage Regulators
  // ================================================================
  'XL4016':    { category:'ICs', subcategory:'Buck Converter', package:'TO-263-5', manufacturer:'XLSEMI', voltage_max:40, current_max:8, description:'High Efficiency PWM Buck DC/DC Converter 8A', datasheet_url:'' },
  'LM2596':    { category:'ICs', subcategory:'Buck Converter', package:'TO-263-5', manufacturer:'Texas Instruments', voltage_max:40, current_max:3, description:'Simple Switcher Buck Converter 3A', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm2596.pdf' },
  'LM2576':    { category:'ICs', subcategory:'Buck Converter', package:'TO-220-5', manufacturer:'Texas Instruments', voltage_max:40, current_max:3, description:'Simple Switcher Buck Converter 3A', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm2576.pdf' },
  'MC34063':   { category:'ICs', subcategory:'DC-DC Converter', package:'DIP-8', manufacturer:'Various', voltage_max:40, current_max:1.5, description:'Step Up/Down/Inverting Switching Regulator', datasheet_url:'https://www.onsemi.com/pdf/datasheet/mc34063a-d.pdf' },
  'XL6009':    { category:'ICs', subcategory:'Boost Converter', package:'SOP-8', manufacturer:'XLSEMI', voltage_max:40, current_max:4, description:'Boost/SEPIC/Flyback DC/DC Converter 4A', datasheet_url:'' },
  'MT3608':    { category:'ICs', subcategory:'Boost Converter', package:'SOT-23-6', manufacturer:'Aerosemi', voltage_max:28, current_max:2, description:'2A High Efficiency Boost Converter', datasheet_url:'' },
  'LTC3780':   { category:'ICs', subcategory:'Buck-Boost Converter', package:'SSOP-20', manufacturer:'Linear/Analog Devices', voltage_max:30, current_max:20, description:'High Efficiency Buck-Boost Converter', datasheet_url:'https://www.analog.com/media/en/technical-documentation/data-sheets/3780fc.pdf' },
  'AS1117':    { category:'ICs', subcategory:'LDO Regulator', package:'SOT-223', manufacturer:'Various', voltage_max:15, current_max:0.8, description:'Low Dropout Regulator (AMS1117 equivalent)', datasheet_url:'' },
  'LD1117':    { category:'ICs', subcategory:'LDO Regulator', package:'SOT-223', manufacturer:'STMicroelectronics', voltage_max:15, current_max:0.8, description:'Low Dropout Regulator (LM1117 equivalent)', datasheet_url:'https://www.st.com/resource/en/datasheet/ld1117.pdf' },

  // ================================================================
  // Additional Logic / MCU
  // ================================================================
  'ESP8266':   { category:'ICs', subcategory:'WiFi SoC', package:'Module', manufacturer:'Espressif', voltage_max:3.6, current_max:0.35, description:'Wi-Fi SoC 802.11 b/g/n', datasheet_url:'https://www.espressif.com/sites/default/files/documentation/esp8266-technical_reference_en.pdf' },
  'ESP32':     { category:'ICs', subcategory:'WiFi+BT SoC', package:'Module', manufacturer:'Espressif', voltage_max:3.6, current_max:0.5, description:'Wi-Fi + Bluetooth SoC Dual Core', datasheet_url:'https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf' },
  'SN74HC04':  { category:'ICs', subcategory:'Logic / Inverter', package:'DIP-14', manufacturer:'Texas Instruments', voltage_max:7, current_max:null, description:'Hex Inverter', datasheet_url:'https://www.ti.com/lit/ds/symlink/sn74hc04.pdf' },
  'SN74HC14':  { category:'ICs', subcategory:'Logic / Inverter', package:'DIP-14', manufacturer:'Texas Instruments', voltage_max:7, current_max:null, description:'Hex Inverter Schmitt Trigger', datasheet_url:'https://www.ti.com/lit/ds/symlink/sn74hc14.pdf' },
  'SN74HC08':  { category:'ICs', subcategory:'Logic / AND', package:'DIP-14', manufacturer:'Texas Instruments', voltage_max:7, current_max:null, description:'Quad 2-Input AND Gate', datasheet_url:'https://www.ti.com/lit/ds/symlink/sn74hc08.pdf' },
  'SN74HC32':  { category:'ICs', subcategory:'Logic / OR', package:'DIP-14', manufacturer:'Texas Instruments', voltage_max:7, current_max:null, description:'Quad 2-Input OR Gate', datasheet_url:'https://www.ti.com/lit/ds/symlink/sn74hc32.pdf' },
  'CD4053':    { category:'ICs', subcategory:'Logic / Mux', package:'DIP-16', manufacturer:'Various', voltage_max:15, current_max:null, description:'Triple 2-Channel Analog Mux/Demux', datasheet_url:'https://www.ti.com/lit/ds/symlink/cd4053b.pdf' },
  'ATTINY13':  { category:'ICs', subcategory:'Microcontroller', package:'DIP-8', manufacturer:'Microchip/Atmel', voltage_max:5.5, current_max:0.2, description:'8-bit AVR MCU 1KB Flash', datasheet_url:'https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-2535-8-bit-AVR-Microcontroller-ATtiny13A_Datasheet.pdf' },
  'PIC12F675': { category:'ICs', subcategory:'Microcontroller', package:'DIP-8', manufacturer:'Microchip', voltage_max:5.5, current_max:null, description:'PIC MCU 1.75KB Flash, 64B SRAM', datasheet_url:'https://ww1.microchip.com/downloads/en/DeviceDoc/41190G.pdf' },

  // ================================================================
  // Communication ICs
  // ================================================================
  'MAX232':    { category:'ICs', subcategory:'RS-232 Driver', package:'DIP-16', manufacturer:'Maxim/TI', voltage_max:6, current_max:null, description:'RS-232 Driver/Receiver (±10V from +5V)', datasheet_url:'https://www.ti.com/lit/ds/symlink/max232.pdf' },
  'MAX485':    { category:'ICs', subcategory:'RS-485 Transceiver', package:'DIP-8', manufacturer:'Maxim', voltage_max:5.25, current_max:null, description:'Low-Power RS-485/RS-422 Transceiver', datasheet_url:'https://datasheets.maximintegrated.com/en/ds/MAX1487-MAX491.pdf' },
  'SI4463':    { category:'ICs', subcategory:'RF Transceiver', package:'QFN-20', manufacturer:'Silicon Labs', voltage_max:3.6, current_max:0.1, description:'High-Performance RF Transceiver 119-1050MHz', datasheet_url:'https://www.silabs.com/documents/public/data-sheets/Si4464-63-61-60.pdf' },
  'NRF24L01':  { category:'ICs', subcategory:'RF Transceiver', package:'QFN-20', manufacturer:'Nordic Semi', voltage_max:3.6, current_max:0.013, description:'2.4GHz RF Transceiver', datasheet_url:'https://infocenter.nordicsemi.com/pdf/nRF24L01P_PS_v1.0.pdf' },
};

// ================================================================
// Pattern-based lookup — catches entire component families
// Each entry: { pattern: RegExp, result: {...fields} }
// ================================================================
const PATTERNS = [
  // Resistors — Carbon Film (CFRxxSJT-xxx, CFRxxJ-xxx)
  { pattern: /^CFR\d/,        result: { category:'Resistors',   subcategory:'Carbon Film',     package:'0207',    description:'Carbon Film Resistor' } },
  // Resistors — Metal Film (MFxx)
  { pattern: /^MF\d/,         result: { category:'Resistors',   subcategory:'Metal Film',      package:'0207',    description:'Metal Film Resistor 1%' } },
  // Resistors — Wirewound (SQP, AKA RX)
  { pattern: /^SQP\d/,        result: { category:'Resistors',   subcategory:'Wirewound',       package:'SQP',     description:'Wirewound Resistor' } },
  // TVS Diodes — P6KE family
  { pattern: /^P6KE/,         result: { category:'Diodes',      subcategory:'TVS',             package:'DO-15',   description:'TVS Transient Voltage Suppressor' } },
  // TVS Diodes — SMBJ family
  { pattern: /^SMBJ/,         result: { category:'Diodes',      subcategory:'TVS',             package:'SMB',     description:'SMB TVS Diode' } },
  // TVS Diodes — BZW family
  { pattern: /^BZW/,          result: { category:'Diodes',      subcategory:'TVS',             package:'DO-15',   description:'Transient Voltage Suppressor' } },
  // Zener BZX55 / BZX85 family
  { pattern: /^BZX\d+C/,      result: { category:'Diodes',      subcategory:'Zener',           package:'DO-35',   description:'Zener Diode' } },
  // Zener 1N47xx family
  { pattern: /^1N47\d{2}/,    result: { category:'Diodes',      subcategory:'Zener',           package:'DO-41',   description:'Zener Diode 1W' } },
  // Rectifier 1N40xx family
  { pattern: /^1N40\d{2}/,    result: { category:'Diodes',      subcategory:'Rectifier',       package:'DO-41',   description:'General Purpose Rectifier Diode' } },
  // Thyristors BT1xx (SCR)
  { pattern: /^BT1[3-9]\d/,   result: { category:'Thyristors',  subcategory:'SCR',             package:'TO-220',  description:'SCR Thyristor' } },
  // Thyristors BT1xx (TRIAC — BT136/139)
  { pattern: /^BT13[69]/,     result: { category:'Thyristors',  subcategory:'TRIAC',           package:'TO-220',  description:'TRIAC' } },
  // TRIACs BTA family
  { pattern: /^BTA\d/,        result: { category:'Thyristors',  subcategory:'TRIAC',           package:'TO-220',  description:'TRIAC' } },
  // MOSFET — IRF family
  { pattern: /^IRF\d/,        result: { category:'Transistors', subcategory:'Power MOSFET',    package:'TO-220',  description:'N-Ch Power MOSFET' } },
  // MOSFET — IRFZ family
  { pattern: /^IRFZ\d/,       result: { category:'Transistors', subcategory:'Power MOSFET',    package:'TO-220',  description:'N-Ch Power MOSFET' } },
  // MOSFET — STP family
  { pattern: /^STP\d/,        result: { category:'Transistors', subcategory:'Power MOSFET',    package:'TO-220',  description:'N-Ch Power MOSFET' } },
  // Gate Drivers — IR21xx
  { pattern: /^IR21\d{2}/,    result: { category:'ICs',         subcategory:'Gate Driver',     package:'DIP-14',  manufacturer:'Infineon/IR', description:'High/Low Side Gate Driver' } },
  // PWM Controllers — UC38xx / UC39xx
  { pattern: /^UC3[89]\d{2}/, result: { category:'ICs',         subcategory:'PWM Controller',  package:'DIP-8',   description:'Current Mode PWM Controller' } },
  // Touch ICs — TTP family
  { pattern: /^TTP2\d{2}/,    result: { category:'ICs',         subcategory:'Touch Sensor',    package:'SOT-23-6',manufacturer:'TONTEK', description:'Capacitive Touch Sensor IC' } },
  // Op-Amps — MCP6xxx
  { pattern: /^MCP6\d{3}/,    result: { category:'ICs',         subcategory:'Op-Amp',          package:'DIP-8',   manufacturer:'Microchip', description:'Low Power CMOS Op-Amp' } },
  // LDO Regulators — LM78xx / LM79xx
  { pattern: /^LM78\d{2}/,    result: { category:'ICs',         subcategory:'Linear Regulator',package:'TO-220',  description:'Fixed Positive Voltage Regulator' } },
  { pattern: /^LM79\d{2}/,    result: { category:'ICs',         subcategory:'Linear Regulator',package:'TO-220',  description:'Fixed Negative Voltage Regulator' } },
  // Optocouplers — MOC30xx
  { pattern: /^MOC30\d{2}/,   result: { category:'ICs',         subcategory:'Optocoupler',     package:'DIP-6',   description:'Optoisolator Triac Driver Output' } },
  // VIPER family — offline switcher ICs
  { pattern: /^VIPER/,        result: { category:'ICs',         subcategory:'Power Switch',    package:'DIP-8',   manufacturer:'STMicroelectronics', description:'Off-Line SMPS Primary Switch' } },
  // Schottky SMD M7 / SxYY pattern
  { pattern: /^SS\d{2}$/,     result: { category:'Diodes',      subcategory:'Schottky',        package:'SMA',     description:'Schottky Barrier Rectifier' } },
  // Crystals — numeric MHz
  { pattern: /^\d{1,3}MHZ$/,  result: { category:'Crystals',    subcategory:'HC-49/S',         package:'HC-49/S', description:'Crystal Resonator' } },
  // Relay SRD family
  { pattern: /^SRD\d{2}/,     result: { category:'Relays',      subcategory:'Relay',           package:'PC mount',description:'Electromagnetic Relay' } },
  // Electrolytic capacitors — common prefix patterns
  { pattern: /^(UVR|UVZ|UCC|EEU|EEUFR)/,  result: { category:'Capacitors', subcategory:'Electrolytic', package:'Radial', description:'Aluminium Electrolytic Capacitor' } },
  // IC socket DS1136 / DS1009 family
  { pattern: /^DS113[0-9]/,   result: { category:'Connectors',  subcategory:'IC Socket',       package:'DIP',     description:'DIP IC Socket' } },
];

// ================================================================
// Lookup function — normalises part code before searching
// ================================================================
function normaliseKey(partCode) {
  return String(partCode).toUpperCase().replace(/[\s\-_.]/g, '');
}

/**
 * Lookup a component by part code.
 * Priority: exact DB match → prefix/suffix DB match → pattern match.
 */
export function lookupComponent(partCode) {
  if (!partCode) return null;

  const key = normaliseKey(partCode);

  // 1. Exact match
  if (DB[key]) return DB[key];

  // 2. Prefix/suffix DB key match — handles suffix variants like "A", "C", "T", package codes
  for (const [dbKey, val] of Object.entries(DB)) {
    if (key === dbKey) return val;
    if (key.startsWith(dbKey) || dbKey.startsWith(key)) return val;
  }

  // 3. Pattern-based family match
  for (const { pattern, result } of PATTERNS) {
    if (pattern.test(key)) return result;
  }

  return null;
}

// ================================================================
// Description-based categorization
// Matches free-text description against known component type keywords.
// Returns { category, subcategory } or null.
// ================================================================

// Rules evaluated in order — first match wins.
const DESC_RULES = [
  // ── Transistors / MOSFETs ──────────────────────────────────────
  [/N[-\s]?CH(?:ANNEL)?.{0,15}MOSFET/i,         { category:'Transistors', subcategory:'N-Channel MOSFET' }],
  [/P[-\s]?CH(?:ANNEL)?.{0,15}MOSFET/i,         { category:'Transistors', subcategory:'P-Channel MOSFET' }],
  [/SMD.{0,10}MOSFET|MOSFET.{0,10}SMD/i,        { category:'Transistors', subcategory:'Power MOSFET' }],
  [/POWER MOSFET|MOSFET/i,                        { category:'Transistors', subcategory:'Power MOSFET' }],
  [/IGBT/i,                                       { category:'Transistors', subcategory:'IGBT' }],
  [/DARLINGTON.{0,6}NPN|NPN.{0,6}DARLINGTON/i,  { category:'Transistors', subcategory:'Darlington NPN' }],
  [/DARLINGTON.{0,6}PNP|PNP.{0,6}DARLINGTON/i,  { category:'Transistors', subcategory:'Darlington PNP' }],
  [/\bNPN\b/i,                                    { category:'Transistors', subcategory:'BJT NPN' }],
  [/\bPNP\b/i,                                    { category:'Transistors', subcategory:'BJT PNP' }],
  [/TRENCH.?MOS|TRENCH.?FET/i,                   { category:'Transistors', subcategory:'N-Channel MOSFET' }],
  // ── Thyristors ────────────────────────────────────────────────
  [/\bTRIAC\b/i,                                  { category:'Thyristors', subcategory:'TRIAC' }],
  [/\bSCR\b|THYRISTOR/i,                          { category:'Thyristors', subcategory:'SCR' }],
  // ── Diodes ────────────────────────────────────────────────────
  [/DIODE BRIDGE|BRIDGE RECTIFIER|KOPRu DIYOT/i, { category:'Diodes', subcategory:'Bridge Rectifier' }],
  [/\bZENER\b/i,                                  { category:'Diodes', subcategory:'Zener' }],
  [/SCHOTTKY/i,                                   { category:'Diodes', subcategory:'Schottky' }],
  [/TVS|TRANSIENT VOLTAGE SUPP/i,                 { category:'Diodes', subcategory:'TVS' }],
  [/FAST RECOVERY|ULTRA FAST|HIGH EFFICIENCY/i,  { category:'Diodes', subcategory:'Fast Recovery' }],
  [/RECTIFIER DIODE|DIODE.{0,10}\d+V|GENERAL PURPOSE.{0,10}DIODE/i, { category:'Diodes', subcategory:'Rectifier' }],
  // ── Capacitors ────────────────────────────────────────────────
  [/ELECTROLYTIC|ALUMIN.{0,3}UM CAP/i,           { category:'Capacitors', subcategory:'Electrolytic' }],
  [/TANTALUM/i,                                   { category:'Capacitors', subcategory:'Tantalum' }],
  [/CERAMIC|MLCC/i,                               { category:'Capacitors', subcategory:'Ceramic' }],
  [/FILM CAP|POLYESTER|POLYPROPYLENE/i,           { category:'Capacitors', subcategory:'Film' }],
  // ── Resistors ─────────────────────────────────────────────────
  [/PTC.{0,10}RESET|SELF.?RESET/i,               { category:'Sensors', subcategory:'PTC Thermistor' }],
  [/\bPTC\b.{0,15}THERMISTOR/i,                  { category:'Sensors', subcategory:'PTC Thermistor' }],
  [/\bNTC\b.{0,15}THERMISTOR|THERMISTOR.{0,15}\bNTC\b/i, { category:'Sensors', subcategory:'NTC Thermistor' }],
  [/THERMISTOR/i,                                 { category:'Resistors', subcategory:'Thermistor' }],
  [/CARBON FILM.{0,10}RESIST/i,                   { category:'Resistors', subcategory:'Carbon Film' }],
  [/METAL FILM.{0,10}RESIST/i,                    { category:'Resistors', subcategory:'Metal Film' }],
  [/WIREWOUND/i,                                  { category:'Resistors', subcategory:'Wirewound' }],
  [/VARISTOR|MOV/i,                               { category:'Resistors', subcategory:'Varistor' }],
  // ── Inductors / Magnetics ─────────────────────────────────────
  [/FERRITE.{0,10}TOROID|TOROID.{0,10}FERRITE/i, { category:'Inductors', subcategory:'Toroid Core' }],
  [/FERRITE.{0,10}CORE|FERRITE BEAD/i,            { category:'Inductors', subcategory:'Ferrite Core' }],
  [/COMMON MODE CHOKE|CMC/i,                      { category:'Inductors', subcategory:'Common Mode Choke' }],
  [/INDUCTOR|CHOKE COIL/i,                        { category:'Inductors', subcategory:'Inductor' }],
  [/TRANSFORMER/i,                                { category:'Inductors', subcategory:'Transformer' }],
  // ── ICs ───────────────────────────────────────────────────────
  [/GATE DRIVER|HIGH.?LOW SIDE DRIVER|HALF.?BRIDGE DRIVER/i, { category:'ICs', subcategory:'Gate Driver' }],
  [/PWM CONTROLLER|PWM CONTROL CIRCUIT/i,         { category:'ICs', subcategory:'PWM Controller' }],
  [/BUCK.{0,15}CONVERTER|STEP.?DOWN CONVERTER/i,  { category:'ICs', subcategory:'Buck Converter' }],
  [/BOOST.{0,15}CONVERTER|STEP.?UP CONVERTER/i,   { category:'ICs', subcategory:'Boost Converter' }],
  [/BUCK.?BOOST|SEPIC|FLYBACK/i,                  { category:'ICs', subcategory:'DC-DC Converter' }],
  [/OP.?AMP|OPERATIONAL AMP/i,                    { category:'ICs', subcategory:'Op-Amp' }],
  [/COMPARATOR/i,                                  { category:'ICs', subcategory:'Comparator' }],
  [/555 TIMER|\bTIMER IC\b/i,                     { category:'ICs', subcategory:'Timer' }],
  [/LOW DROPOUT|LDO REGULATOR/i,                  { category:'ICs', subcategory:'LDO Regulator' }],
  [/VOLTAGE REGULATOR|LINEAR REGULATOR/i,          { category:'ICs', subcategory:'Linear Regulator' }],
  [/OPTOCOUPLER|OPTOISOLATOR|PHOTOTRANSISTOR OUTPUT/i, { category:'ICs', subcategory:'Optocoupler' }],
  [/TOUCH SENSOR|CAPACITIVE TOUCH/i,              { category:'ICs', subcategory:'Touch Sensor' }],
  [/LED DRIVER|CONSTANT CURRENT.{0,10}LED/i,      { category:'ICs', subcategory:'LED Driver' }],
  [/MOTOR DRIVER|FULL.?BRIDGE DRIVER|HALF.?BRIDGE DRIVER/i, { category:'ICs', subcategory:'Motor Driver' }],
  [/STEPPER.{0,10}DRIVER/i,                       { category:'ICs', subcategory:'Stepper Driver' }],
  [/RS.?232|UART DRIVER/i,                        { category:'ICs', subcategory:'RS-232 Driver' }],
  [/RS.?485/i,                                    { category:'ICs', subcategory:'RS-485 Transceiver' }],
  [/RF TRANSCEIVER|2\.4GHZ TRANSCEIVER/i,        { category:'ICs', subcategory:'RF Transceiver' }],
  [/WI.?FI|BLUETOOTH/i,                           { category:'ICs', subcategory:'WiFi+BT SoC' }],
  [/MICROCONTROLLER|8.?BIT AVR|ARM CORTEX|PIC MCU/i, { category:'ICs', subcategory:'Microcontroller' }],
  [/SHIFT REGISTER/i,                              { category:'ICs', subcategory:'Logic / Shift Register' }],
  [/NAND GATE/i,                                   { category:'ICs', subcategory:'Logic / NAND' }],
  [/HALL EFFECT|CURRENT SENSOR|POWER MONITOR/i,   { category:'Sensors', subcategory:'Current Sensor' }],
  // ── Sensors ───────────────────────────────────────────────────
  [/TEMPERATURE SENSOR|THERMOMETER/i,             { category:'Sensors', subcategory:'Temperature' }],
  [/HUMIDITY.{0,10}TEMP|TEMP.{0,10}HUMIDITY/i,   { category:'Sensors', subcategory:'Humidity / Temp' }],
  // ── Connectors ────────────────────────────────────────────────
  [/IC SOCKET|DIP SOCKET/i,                       { category:'Connectors', subcategory:'IC Socket' }],
  [/TERMINAL BLOCK/i,                              { category:'Connectors', subcategory:'Terminal Block' }],
  [/CONNECTOR/i,                                   { category:'Connectors', subcategory:'Connector' }],
  // ── Crystals ──────────────────────────────────────────────────
  [/CRYSTAL RESONATOR|QUARTZ CRYSTAL/i,           { category:'Crystals', subcategory:'Crystal' }],
  // ── Relays ────────────────────────────────────────────────────
  [/ELECTROMAGNETIC RELAY|RELAY.{0,6}COIL|COIL.{0,6}RELAY/i, { category:'Relays', subcategory:'Relay' }],
  // ── Mechanical ────────────────────────────────────────────────
  [/PERTINAKS|PERTINAX|PERFBOARD/i,               { category:'Mechanical', subcategory:'PCB / Board' }],
  [/HEAT SINK|HEATSINK/i,                          { category:'Mechanical', subcategory:'Heat Sink' }],
  [/LEHIM|SOLDER/i,                                { category:'Consumables', subcategory:'Solder' }],
  [/FLUX/i,                                        { category:'Consumables', subcategory:'Flux' }],
];

/**
 * Attempt to categorize a component by its description text.
 * Returns { category, subcategory } or null.
 */
export function categorizeByDescription(description) {
  if (!description) return null;
  for (const [pattern, result] of DESC_RULES) {
    if (pattern.test(description)) return result;
  }
  return null;
}

/**
 * Apply hardcoded data to a component object, filling only EMPTY fields.
 * Returns a new object (original not mutated).
 */
export function applyDbData(comp, dbRecord) {
  if (!dbRecord) return comp;
  return {
    ...comp,
    category:     comp.category     || dbRecord.category     || '',
    subcategory:  comp.subcategory  || dbRecord.subcategory  || '',
    package:      comp.package      || dbRecord.package      || '',
    manufacturer: comp.manufacturer || dbRecord.manufacturer || '',
    description:  comp.description  || dbRecord.description  || '',
    datasheet_url:comp.datasheet_url|| dbRecord.datasheet_url|| '',
    voltage_max:  comp.voltage_max  != null ? comp.voltage_max : (dbRecord.voltage_max  ?? null),
    current_max:  comp.current_max  != null ? comp.current_max : (dbRecord.current_max  ?? null),
  };
}
