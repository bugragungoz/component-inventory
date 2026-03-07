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

  // ================================================================
  // Timer & Op-Amp ICs
  // ================================================================
  'NE555':   { category:'ICs', subcategory:'Timer', package:'DIP-8', manufacturer:'Various', voltage_max:18, current_max:0.2, description:'555 Timer IC', datasheet_url:'https://www.ti.com/lit/ds/symlink/ne555.pdf' },
  'LM555':   { category:'ICs', subcategory:'Timer', package:'DIP-8', manufacturer:'Texas Instruments', voltage_max:18, current_max:0.2, description:'555 Timer IC', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm555.pdf' },
  'LM358':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Various', voltage_max:32, current_max:null, description:'Dual General Purpose Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm358.pdf' },
  'LM324':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-14', manufacturer:'Various', voltage_max:32, current_max:null, description:'Quad General Purpose Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm324.pdf' },
  'LM741':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Various', voltage_max:44, current_max:null, description:'General Purpose Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/ua741.pdf' },
  'LM393':   { category:'ICs', subcategory:'Comparator', package:'DIP-8', manufacturer:'Various', voltage_max:36, current_max:null, description:'Dual Voltage Comparator', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm393.pdf' },
  'LM339':   { category:'ICs', subcategory:'Comparator', package:'DIP-14', manufacturer:'Various', voltage_max:36, current_max:null, description:'Quad Voltage Comparator', datasheet_url:'https://www.ti.com/lit/ds/symlink/lm339.pdf' },
  'TL071':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Various', voltage_max:36, current_max:null, description:'Low Noise JFET Input Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/tl071.pdf' },
  'TL072':   { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Various', voltage_max:36, current_max:null, description:'Dual Low Noise JFET Input Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/tl072.pdf' },
  'NE5532':  { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Various', voltage_max:44, current_max:null, description:'Dual Low Noise High Speed Op-Amp', datasheet_url:'https://www.ti.com/lit/ds/symlink/ne5532.pdf' },
  'CA3140':  { category:'ICs', subcategory:'Op-Amp', package:'DIP-8', manufacturer:'Renesas', voltage_max:36, current_max:null, description:'BiMOS Op-Amp with MOSFET Input', datasheet_url:'https://www.renesas.com/us/en/document/dst/ca3140-ca3140a-datasheet' },

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
};

// ================================================================
// Lookup function — normalises part code before searching
// ================================================================
function normaliseKey(partCode) {
  return String(partCode).toUpperCase().replace(/[\s\-_.]/g, '');
}

/**
 * Lookup a component by part code.
 * Returns the matching record or null.
 * Tries exact match, then prefix/suffix match for code families (e.g. 1N4007 → 1N4007).
 */
export function lookupComponent(partCode) {
  if (!partCode) return null;

  const key = normaliseKey(partCode);

  // 1. Exact match
  if (DB[key]) return DB[key];

  // 2. Partial key match — the DB key starts with or equals the query key,
  //    or the query key starts with the DB key (handles suffix variants like "A" / "C").
  for (const [dbKey, val] of Object.entries(DB)) {
    if (key === dbKey) return val;
    if (key.startsWith(dbKey) || dbKey.startsWith(key)) return val;
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
