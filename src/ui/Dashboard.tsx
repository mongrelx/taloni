import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import chalk from 'chalk'
import { Box, Text, useApp, useInput, useWindowSize } from 'ink'
import { useCallback, useEffect, useState } from 'react'
import {
  addBooking,
  addContact,
  addDocument,
  addFireplace,
  addFirewood,
  addHeatingSystem,
  addInsurance,
  addMeterReading,
  addProperty,
  addRenovation,
  addTask,
  addTool,
  addTransaction,
  addUtility,
  addWastewaterSystem,
  addWaterTest,
  advanceRecurrence,
  assessComposting,
  assessWastewater,
  type Booking,
  bookingNights,
  type Contact,
  type Document,
  type DocumentLinkType,
  deleteProperty,
  deleteRow,
  type Fireplace,
  type Firewood,
  getBookings,
  getContacts,
  getDocuments,
  getDocumentsFor,
  getFireplaces,
  getFirewood,
  getHeatingSystems,
  getInsurance,
  getMeterReadings,
  getProperties,
  getRenovations,
  getTasks,
  getTools,
  getTransactions,
  getUtilities,
  getWastewaterSystems,
  getWaterTests,
  type HeatingSystem,
  type Insurance,
  type MeterReading,
  type Property,
  type Recurrence,
  type Renovation,
  type Task,
  type Tool,
  type Transaction,
  type Utility,
  updateBooking,
  updateContact,
  updateDocument,
  updateFireplace,
  updateFirewood,
  updateHeatingSystem,
  updateInsurance,
  updateMeterReading,
  updateProperty,
  updateRenovation,
  updateTask,
  updateTaskStatus,
  updateTool,
  updateTransaction,
  updateUtility,
  updateWastewaterSystem,
  updateWaterTest,
  type WastewaterSystem,
  type WaterTest,
} from '../db/index.js'

type Tab =
  | 'overview'
  | 'tasks'
  | 'renovations'
  | 'utilities'
  | 'tools'
  | 'compliance'
  | 'firewood'
  | 'seasonal'
  | 'archive'

const TABS: { id: Tab; label: string; shortcut: string }[] = [
  { id: 'overview', label: '1. Yleisnäkymä', shortcut: '1' },
  { id: 'tasks', label: '2. Tehtävälista', shortcut: '2' },
  { id: 'renovations', label: '3. Talous & Korjaukset', shortcut: '3' },
  { id: 'utilities', label: '4. Sähkö & Kulutus', shortcut: '4' },
  { id: 'tools', label: '5. Vakuutus & Kalusto', shortcut: '5' },
  { id: 'compliance', label: '6. Määräaikaishuolto', shortcut: '6' },
  { id: 'firewood', label: '7. Polttopuu & Sauna', shortcut: '7' },
  { id: 'seasonal', label: '8. Vuokraus & Kausi', shortcut: '8' },
  { id: 'archive', label: '9. Yhteystiedot & Arkisto', shortcut: '9' },
]

const TAB_COLORS: Record<Tab, string> = {
  overview: '#8A2BE2', // Violetti
  tasks: '#FF8C42', // Oranssi
  renovations: '#2ECC71', // Vihreä
  utilities: '#3498DB', // Sininen
  tools: '#E74C3C', // Punainen
  compliance: '#00B894', // Turkoosi (lakisääteiset velvoitteet)
  firewood: '#D35400', // Poltettu oranssi (polttopuu & sauna)
  seasonal: '#1ABC9C', // Vihreänsininen (vuokraus & kausi)
  archive: '#5DADE2', // Vaaleansininen (yhteystiedot & arkisto)
}

// Unicode HBar-kuvaaja
function HBar({
  value,
  max,
  width,
}: {
  value: number
  max: number
  width: number
}) {
  if (max === 0) return <Text color="#555555">{'░'.repeat(width)}</Text>
  const ratio = Math.min(value / max, 1)
  const filled = Math.round(ratio * width)
  const color = ratio > 0.9 ? '#E74C3C' : ratio > 0.75 ? '#F1C40F' : '#2ECC71'

  return (
    <Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text color="#333333">{'░'.repeat(Math.max(width - filled, 0))}</Text>
    </Text>
  )
}

type FormType =
  | 'task'
  | 'transaction'
  | 'property'
  | 'utility'
  | 'renovation'
  | 'tool'
  | 'insurance'
  | 'fireplace'
  | 'wastewater'
  | 'heating'
  | 'water_test'
  | 'firewood'
  | 'booking'
  | 'contact'
  | 'document'
  | 'meter'
  | 'bulk_sweep'

// Indeksi viimeisestä kentästä lomakkeessa (= "tallenna"-painikkeen indeksi).
function getMaxField(formType: FormType): number {
  switch (formType) {
    case 'document':
      return 8 // 0:kohde 1:tyyppi 2:otsikko 3:polku 4:pvm 5:huomiot 6:linkitystyyppi 7:linkitetty tietue 8:tallenna
    case 'contact':
      return 5 // 0:nimi 1:rooli 2:puhelin 3:email 4:huomiot 5:tallenna
    case 'meter':
      return 5 // 0:kohde 1:mittarityyppi 2:lukema 3:pvm 4:huomiot 5:tallenna
    case 'water_test':
      return 10 // 0:kohde 1:pvm 2:E.coli 3:koliformit 4:nitraatti 5:pH 6:rauta 7:fluoridi 8:läpäisy 9:huomiot 10:tallenna
    case 'property':
      return 17 // 0-8 perustiedot+sauna+verot, 9:sähköliittymä 10:vesiliittymä 11:jäteyhtiö 12:astia 13:tyhjennysväli 14:biojäte 15:kompost.ilmoitus 16:ilmoituspvm 17:tallenna
    case 'firewood':
      return 8 // 0:kohde 1:puulaji 2:määrä 3:yksikkö 4:sijainti 5:kuivumisaste 6:pinottu 7:huomiot 8:tallenna
    case 'booking':
      return 7 // 0:kohde 1:varaaja 2:saapuminen 3:lähtö 4:hinta 5:tila 6:huomiot 7:tallenna
    case 'renovation':
      return 7 // 0:kohde 1:nimi 2:tila 3:budjetti 4:kulutettu 5:alkupvm 6:loppupvm 7:tallenna
    case 'wastewater':
      return 11 // 0:kohde 1:tyyppi 2:rakennusvuosi 3:ranta 4:pohjavesi 5:wc 6:vapautus 7:lupa 8:tyhjennetty 9:seuraava 10:palvelu 11:tallenna
    case 'fireplace':
      return 6 // 0:kohde 1:tyyppi 2:nimi 3:nuohottu 4:seuraava 5:nuohooja 6:tallenna
    case 'utility':
      return 6 // 0:kohde 1:laskutyyppi 2:toimittaja 3:summa 4:kulutus 5:kausi 6:tallenna
    case 'insurance':
      return 6 // 0:kohde 1:nimi 2:yhtiö 3:maksu 4:uusimispvm 5:kattavuus 6:tallenna
    case 'task':
      return 6 // 0:kohde 1:kuvaus 2:kategoria 3:kiireellisyys 4:kustannus 5:toistuvuus 6:tallenna
    case 'heating':
      return 5 // 0:kohde 1:tyyppi 2:kuvaus 3:tarkastettu 4:seuraava 5:tallenna
    case 'tool':
      return 4 // 0:nimi 1:kuntotila 2:sijainti 3:hankintapvm 4:tallenna
    default:
      return 5
  }
}

// Valintajärjestykset ja suomenkieliset etiketit Vaiheen 1 rekistereille.
// Käytetään sekä lomakkeen valitsimissa että Määräaikaishuolto-näkymässä.
const FIREPLACE_TYPES: Fireplace['type'][] = [
  'bakery_oven',
  'fireplace',
  'sauna_stove',
  'masonry_heater',
  'chimney',
  'kamina',
  'water_boiler',
  'wood_stove',
]
const FIREPLACE_LABELS: Record<Fireplace['type'], string> = {
  bakery_oven: 'Leivinuuni',
  fireplace: 'Takka',
  sauna_stove: 'Kiuas',
  masonry_heater: 'Varaava uuni',
  chimney: 'Hormi/piippu',
  kamina: 'Kamina',
  water_boiler: 'Muuripata / vesipata',
  wood_stove: 'Puuliesi',
}
const WASTEWATER_TYPES: WastewaterSystem['type'][] = [
  'septic_tank',
  'sealed_tank',
  'soil_filter',
  'small_treatment',
  'mains_sewer',
]
const WASTEWATER_LABELS: Record<WastewaterSystem['type'], string> = {
  septic_tank: 'Saostuskaivo',
  sealed_tank: 'Umpisäiliö',
  soil_filter: 'Maasuodattamo',
  small_treatment: 'Pienpuhdistamo',
  mains_sewer: 'Kunnan viemäri',
}
const HEATING_TYPES: HeatingSystem['type'][] = [
  'wood',
  'oil',
  'geothermal',
  'air_heat_pump',
  'electric',
  'district',
]
const HEATING_LABELS: Record<HeatingSystem['type'], string> = {
  wood: '🪵 Puulämmitys',
  oil: '🛢 Öljylämmitys',
  geothermal: '♨ Maalämpö',
  air_heat_pump: '🌀 Ilmalämpöpumppu',
  electric: '⚡ Sähkölämmitys',
  district: '🏭 Kaukolämpö',
}
const RECURRENCE_OPTIONS: Recurrence[] = [
  'none',
  'monthly',
  'quarterly',
  'yearly',
  'every_3_years',
]
const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Ei toistu',
  monthly: 'Kuukausittain',
  quarterly: 'Neljännesvuosittain',
  yearly: 'Vuosittain',
  every_3_years: '3 v välein',
}
type ComplianceList = 'fireplaces' | 'wastewater' | 'heating' | 'water_tests'
const COMPLIANCE_LISTS: ComplianceList[] = [
  'fireplaces',
  'wastewater',
  'heating',
  'water_tests',
]

// Vaihe 2 — polttopuu & sauna
const WOOD_TYPES = ['Koivu', 'Kuusi', 'Mänty', 'Leppä', 'Haapa', 'Sekapuu']
const FIREWOOD_UNITS: Firewood['unit'][] = ['pino-m³', 'motti', 'irto-m³']
const DRYING_STATES: Firewood['drying_status'][] = ['fresh', 'drying', 'ready']
const DRYING_LABELS: Record<Firewood['drying_status'], string> = {
  fresh: 'Tuore',
  drying: 'Kuivumassa',
  ready: 'Käyttövalmis',
}
const DRYING_COLORS: Record<Firewood['drying_status'], string> = {
  fresh: '#E74C3C',
  drying: '#F1C40F',
  ready: '#2ECC71',
}
const SAUNA_TYPES: Property['sauna_type'][] = ['none', 'wood', 'electric']
const SAUNA_LABELS: Record<Property['sauna_type'], string> = {
  none: 'Ei saunaa',
  wood: '🔥 Puukiuas',
  electric: '⚡ Sähkökiuas',
}
const BIOWASTE_OPTIONS: Property['biowaste'][] = [
  'collection',
  'home_compost',
  'shared',
  'none',
]
const BIOWASTE_LABELS: Record<Property['biowaste'], string> = {
  collection: 'Kunnan keräys',
  home_compost: 'Kotikompostointi',
  shared: 'Yhteiskeräyspiste',
  none: 'Ei biojätettä',
}

// Vaihe 3 — vuokraus & vuodenkierto
const BOOKING_STATUSES: Booking['status'][] = [
  'tentative',
  'confirmed',
  'completed',
  'cancelled',
]
const BOOKING_STATUS_LABELS: Record<Booking['status'], string> = {
  tentative: 'Alustava',
  confirmed: 'Vahvistettu',
  completed: 'Valmis',
  cancelled: 'Peruttu',
}
const BOOKING_STATUS_COLORS: Record<Booking['status'], string> = {
  tentative: '#F1C40F',
  confirmed: '#2ECC71',
  completed: '#3498DB',
  cancelled: '#E74C3C',
}
// Kausikatsausten tarkistuslistapohjat (luodaan tehtäviksi valitulle kohteelle).
const SEASONAL_TEMPLATES = {
  spring: {
    label: 'Kevätavaus',
    category: 'Kevätavaus',
    month: '05',
    day: '15',
    tasks: [
      'Avaa päävesihana ja tarkista vuodot',
      'Käynnistä vesipumppu ja ilmaa putket',
      'Ota kaivovesinäyte / tarkista veden laatu',
      'Kytke sähköt ja sulakkeet päälle',
      'Tarkista katto, räystäät ja rakenteet talven jäljiltä',
      'Poista pakkasneste hajulukoista ja WC:stä',
      'Tarkista tulisijat ja piippu ennen käyttöä',
    ],
  },
  autumn: {
    label: 'Syyssulku',
    category: 'Syyssulku',
    month: '10',
    day: '01',
    tasks: [
      'Sulje päävesihana',
      'Tyhjennä vesijärjestelmä ja putkistot',
      'Lisää pakkasneste hajulukkoihin ja WC-pönttöön',
      'Tyhjennä ja sulata jääkaappi / pakastin',
      'Katkaise turhat sähköt, jätä peruslämpö päälle',
      'Sulje kaasupullot ja tarkista paloturvallisuus',
      'Vie roskat ja tarkista jätevesisäiliön taso',
    ],
  },
} as const

// Vaihe 4 — tukitiedot
const CONTACT_ROLES: Contact['role'][] = [
  'nuohooja',
  'lvi',
  'sahko',
  'loka',
  'isannointi',
  'other',
]
const CONTACT_ROLE_LABELS: Record<Contact['role'], string> = {
  nuohooja: 'Nuohooja',
  lvi: 'LVI-asennus',
  sahko: 'Sähköasennus',
  loka: 'Loka-auto',
  isannointi: 'Isännöinti',
  other: 'Muu',
}
const DOC_TYPES: Document['doc_type'][] = [
  'deed',
  'purchase',
  'permit',
  'inspection',
  'warranty',
  'other',
]
const DOC_TYPE_LABELS: Record<Document['doc_type'], string> = {
  deed: 'Lainhuuto',
  purchase: 'Kauppakirja',
  permit: 'Rakennuslupa',
  inspection: 'Tarkastuspöytäkirja',
  warranty: 'Takuu',
  other: 'Muu',
}
const METER_TYPES: MeterReading['meter_type'][] = ['electric', 'water']
const METER_LABELS: Record<MeterReading['meter_type'], string> = {
  electric: '⚡ Sähkö',
  water: '💧 Vesi',
}
const meterUnit = (t: MeterReading['meter_type']) =>
  t === 'electric' ? 'kWh' : 'm³'
type ArchiveList = 'contacts' | 'documents' | 'meters'
const ARCHIVE_LISTS: ArchiveList[] = ['contacts', 'documents', 'meters']
const DOC_LINK_TYPES: DocumentLinkType[] = [
  '',
  'fireplace',
  'wastewater',
  'water_test',
  'insurance',
]
const DOC_LINK_LABELS: Record<DocumentLinkType, string> = {
  '': 'Ei linkitystä',
  fireplace: 'Tulisija',
  wastewater: 'Jätevesijärjestelmä',
  water_test: 'Vesitutkimus',
  insurance: 'Vakuutus',
}

// Avaa tiedosto käyttöjärjestelmän oletussovelluksella (esim. PDF-katseluohjelma).
function openFileWithOS(path: string): boolean {
  if (!path.trim()) return false
  const expanded = path.startsWith('~') ? path.replace(/^~/, homedir()) : path
  const opener =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open'
  try {
    spawn(opener, [expanded], { detached: true, stdio: 'ignore' }).unref()
    return true
  } catch {
    return false
  }
}

function getPriorityColor(p: Task['priority']) {
  switch (p) {
    case 'high':
      return '#E74C3C'
    case 'medium':
      return '#F1C40F'
    case 'low':
      return '#95A5A6'
    default:
      return '#95A5A6'
  }
}

function Panel({
  title,
  color,
  children,
  width,
}: {
  title: string
  color: string
  children: React.ReactNode
  width: number
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      paddingX={1}
      width={width}
      height="shrink"
    >
      <Text bold color={color}>
        {title}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {children}
      </Box>
    </Box>
  )
}

export function Dashboard() {
  const { exit } = useApp()
  const { columns } = useWindowSize()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Kohteet (Properties)
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(
    null,
  ) // null = Kaikki kohteet

  // Data
  const [tasks, setTasks] = useState<Task[]>([])
  const [renovations, setRenovations] = useState<Renovation[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [utilities, setUtilities] = useState<Utility[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [insurance, setInsurance] = useState<Insurance[]>([])

  // Vaihe 1: Lakisääteinen ydin
  const [heatingSystems, setHeatingSystems] = useState<HeatingSystem[]>([])
  const [fireplaces, setFireplaces] = useState<Fireplace[]>([])
  const [wastewaterSystems, setWastewaterSystems] = useState<
    WastewaterSystem[]
  >([])
  const [waterTests, setWaterTests] = useState<WaterTest[]>([])

  // Listanavigointi
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0)
  const [selectedTxIndex, setSelectedTxIndex] = useState(0)
  const [selectedRenovationIndex, setSelectedRenovationIndex] = useState(0)
  const [selectedToolIndex, setSelectedToolIndex] = useState(0)
  const [selectedInsuranceIndex, setSelectedInsuranceIndex] = useState(0)

  // Aktiivinen lista välilehdillä, joilla on kaksi listaa rinnakkain
  const [focusedRenList, setFocusedRenList] = useState<
    'renovations' | 'transactions'
  >('renovations')
  const [focusedToolList, setFocusedToolList] = useState<'tools' | 'insurance'>(
    'tools',
  )

  // Lomake (Form)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formType, setFormType] = useState<FormType>('task')
  const [editingId, setEditingId] = useState<number | null>(null) // null = lisää uusi, muuten muokkaa

  // Lomakekentät (Tehtävät & Tapahtumat)
  const [formPropId, setFormPropId] = useState<number>(1)
  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high'>(
    'medium',
  )
  const [formCost, setFormCost] = useState('')
  const [formTxType, setFormTxType] = useState<'income' | 'expense'>('expense')
  const [formTxAmount, setFormTxAmount] = useState('')
  const [formTxDesc, setFormTxDesc] = useState('')

  // Lomakekentät (Remontit / Renovations)
  const [formRenName, setFormRenName] = useState('')
  const [formRenStatus, setFormRenStatus] =
    useState<Renovation['status']>('planning')
  const [formRenBudget, setFormRenBudget] = useState('')
  const [formRenSpent, setFormRenSpent] = useState('')
  const [formRenStartDate, setFormRenStartDate] = useState('')
  const [formRenEndDate, setFormRenEndDate] = useState('')

  // Lomakekentät (Kalusto / Tools)
  const [formToolName, setFormToolName] = useState('')
  const [formToolStatus, setFormToolStatus] =
    useState<Tool['status']>('working')
  const [formToolLocation, setFormToolLocation] = useState('')
  const [formToolPurchaseDate, setFormToolPurchaseDate] = useState('')

  // Lomakekentät (Vakuutukset / Insurance)
  const [formInsPolicyName, setFormInsPolicyName] = useState('')
  const [formInsProvider, setFormInsProvider] = useState('')
  const [formInsPremium, setFormInsPremium] = useState('')
  const [formInsRenewalDate, setFormInsRenewalDate] = useState('')
  const [formInsCoverageDetails, setFormInsCoverageDetails] = useState('')

  // Lomakekentät (Kiinteistöt)
  const [formPropName, setFormPropName] = useState('')
  const [formPropTunnus, setFormPropTunnus] = useState('')
  const [formPropWater, setFormPropWater] = useState<'well' | 'mains'>('well')
  const [formPropYear, setFormPropYear] = useState('1950')
  const [formPropLoc, setFormPropLoc] = useState('')
  const [formPropSaunaType, setFormPropSaunaType] =
    useState<Property['sauna_type']>('none')
  const [formPropSaunaInfo, setFormPropSaunaInfo] = useState('')
  const [formPropTax, setFormPropTax] = useState('0')
  const [formPropRoadFee, setFormPropRoadFee] = useState('0')
  const [formPropElecFuse, setFormPropElecFuse] = useState('')
  const [formPropWaterConn, setFormPropWaterConn] = useState('')
  const [formPropWasteProvider, setFormPropWasteProvider] = useState('')
  const [formPropWasteBin, setFormPropWasteBin] = useState('')
  const [formPropWasteInterval, setFormPropWasteInterval] = useState('')
  const [formPropBiowaste, setFormPropBiowaste] =
    useState<Property['biowaste']>('collection')
  const [formPropCompostReg, setFormPropCompostReg] = useState<0 | 1>(0)
  const [formPropCompostDate, setFormPropCompostDate] = useState('')

  // Lomakekentät (Kulutus / Utilities)
  const [formUtilType, setFormUtilType] =
    useState<Utility['type']>('electric_siirto')
  const [formUtilProvider, setFormUtilProvider] = useState('')
  const [formUtilAmount, setFormUtilAmount] = useState('')
  const [formUtilMonth, setFormUtilMonth] = useState('') // YYYY-MM
  const [formUtilUsage, setFormUtilUsage] = useState('') // kWh tai m³
  const [selectedUtilIndex, setSelectedUtilIndex] = useState(0)

  // Lomakekentät (Tehtävän toistuvuus — Vaihe 1b)
  const [formRecurrence, setFormRecurrence] = useState<Recurrence>('none')

  // Lomakekentät (Tulisijat / Fireplaces)
  const [formFpType, setFormFpType] = useState<Fireplace['type']>('fireplace')
  const [formFpName, setFormFpName] = useState('')
  const [formFpLastSweep, setFormFpLastSweep] = useState('')
  const [formFpNextSweep, setFormFpNextSweep] = useState('')
  const [formFpSweeper, setFormFpSweeper] = useState('')

  // Lomakekentät (Jätevesijärjestelmät / Wastewater)
  const [formWwType, setFormWwType] =
    useState<WastewaterSystem['type']>('septic_tank')
  const [formWwPermit, setFormWwPermit] = useState('')
  const [formWwLastEmptied, setFormWwLastEmptied] = useState('')
  const [formWwNextEmptied, setFormWwNextEmptied] = useState('')
  const [formWwProvider, setFormWwProvider] = useState('')
  const [formWwBuildYear, setFormWwBuildYear] = useState('')
  const [formWwShoreline, setFormWwShoreline] = useState<0 | 1>(0)
  const [formWwGroundwater, setFormWwGroundwater] = useState<0 | 1>(0)
  const [formWwHasWc, setFormWwHasWc] = useState<0 | 1>(1)
  const [formWwExemption, setFormWwExemption] = useState<0 | 1>(0)

  // Lomakekentät (Lämmitysjärjestelmät / Heating)
  const [formHtType, setFormHtType] = useState<HeatingSystem['type']>('wood')
  const [formHtDesc, setFormHtDesc] = useState('')
  const [formHtLastInsp, setFormHtLastInsp] = useState('')
  const [formHtNextInsp, setFormHtNextInsp] = useState('')

  // Lomakekentät (Kaivovesitutkimukset / Water tests)
  const [formWtDate, setFormWtDate] = useState('')
  const [formWtEcoli, setFormWtEcoli] = useState('')
  const [formWtColiforms, setFormWtColiforms] = useState('')
  const [formWtNitrate, setFormWtNitrate] = useState('')
  const [formWtPh, setFormWtPh] = useState('')
  const [formWtIron, setFormWtIron] = useState('')
  const [formWtFluoride, setFormWtFluoride] = useState('')
  const [formWtPassed, setFormWtPassed] = useState<0 | 1>(1)
  const [formWtNotes, setFormWtNotes] = useState('')

  // Määräaikaishuolto-välilehden navigointi (Vaihe 1b)
  const [focusedComplianceList, setFocusedComplianceList] =
    useState<ComplianceList>('fireplaces')
  const [selectedComplianceIndex, setSelectedComplianceIndex] = useState(0)

  // Koko kiinteistön kertanuohous (Vaihe 9)
  const [formBulkDate, setFormBulkDate] = useState('')
  const [formBulkFireplaces, setFormBulkFireplaces] = useState<Fireplace[]>([])
  const [formBulkExcluded, setFormBulkExcluded] = useState<number[]>([]) // ei-nuohotut (id:t)

  // Polttopuu (Vaihe 2)
  const [firewood, setFirewood] = useState<Firewood[]>([])
  const [selectedFirewoodIndex, setSelectedFirewoodIndex] = useState(0)
  const [formFwWoodType, setFormFwWoodType] = useState('Koivu')
  const [formFwVolume, setFormFwVolume] = useState('')
  const [formFwUnit, setFormFwUnit] = useState<Firewood['unit']>('pino-m³')
  const [formFwLocation, setFormFwLocation] = useState('')
  const [formFwDrying, setFormFwDrying] =
    useState<Firewood['drying_status']>('ready')
  const [formFwStacked, setFormFwStacked] = useState('')
  const [formFwNotes, setFormFwNotes] = useState('')

  // Vuokraus (Vaihe 3)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [selectedBookingIndex, setSelectedBookingIndex] = useState(0)
  const [formBkGuest, setFormBkGuest] = useState('')
  const [formBkStart, setFormBkStart] = useState('')
  const [formBkEnd, setFormBkEnd] = useState('')
  const [formBkPrice, setFormBkPrice] = useState('')
  const [formBkStatus, setFormBkStatus] =
    useState<Booking['status']>('confirmed')
  const [formBkNotes, setFormBkNotes] = useState('')

  // Tukitiedot (Vaihe 4)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([])
  const [focusedArchiveList, setFocusedArchiveList] =
    useState<ArchiveList>('contacts')
  const [selectedArchiveIndex, setSelectedArchiveIndex] = useState(0)
  // Yhteystieto-lomake
  const [formCoName, setFormCoName] = useState('')
  const [formCoRole, setFormCoRole] = useState<Contact['role']>('nuohooja')
  const [formCoPhone, setFormCoPhone] = useState('')
  const [formCoEmail, setFormCoEmail] = useState('')
  const [formCoNotes, setFormCoNotes] = useState('')
  // Asiakirja-lomake
  const [formDocType, setFormDocType] = useState<Document['doc_type']>('deed')
  const [formDocTitle, setFormDocTitle] = useState('')
  const [formDocPath, setFormDocPath] = useState('')
  const [formDocDate, setFormDocDate] = useState('')
  const [formDocNotes, setFormDocNotes] = useState('')
  const [formDocLinkedType, setFormDocLinkedType] =
    useState<DocumentLinkType>('')
  const [formDocLinkedId, setFormDocLinkedId] = useState<number>(0)
  // Mittarilukema-lomake
  const [formMtType, setFormMtType] =
    useState<MeterReading['meter_type']>('electric')
  const [formMtReading, setFormMtReading] = useState('')
  const [formMtDate, setFormMtDate] = useState('')
  const [formMtNotes, setFormMtNotes] = useState('')

  // Lomakkeen aktiivinen kenttä
  const [activeField, setActiveField] = useState<number>(0)

  const [notification, setNotification] = useState<string | null>(
    'Käytä näppäimiä [1-5] välilehtiin | [p] vaihtaa kohdetta | [a] lisää | [e] muokkaa | [q] poistu',
  )

  const reloadData = useCallback(() => {
    try {
      const props = getProperties()
      setProperties(props)

      const propId = selectedPropertyId ?? undefined
      setTasks(getTasks(propId))
      setRenovations(getRenovations(propId))
      setTransactions(getTransactions(propId))
      setUtilities(getUtilities(propId))
      setTools(getTools())
      setInsurance(getInsurance(propId))
      setHeatingSystems(getHeatingSystems(propId))
      setFireplaces(getFireplaces(propId))
      setWastewaterSystems(getWastewaterSystems(propId))
      setWaterTests(getWaterTests(propId))
      setFirewood(getFirewood(propId))
      setBookings(getBookings(propId))
      setContacts(getContacts())
      setDocuments(getDocuments(propId))
      setMeterReadings(getMeterReadings(propId))
    } catch (e) {
      setNotification(`Virhe ladattaessa tietoja: ${(e as Error).message}`)
    }
  }, [selectedPropertyId])

  useEffect(() => {
    reloadData()
  }, [reloadData])

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [notification])

  const cycleProperty = () => {
    if (properties.length === 0) return
    if (selectedPropertyId === null) {
      setSelectedPropertyId(properties[0]!.id)
      setNotification(`Valittu kohde: ${properties[0]!.name}`)
    } else {
      const idx = properties.findIndex((p) => p.id === selectedPropertyId)
      if (idx === properties.length - 1) {
        setSelectedPropertyId(null)
        setNotification('Näytetään kaikki kohteet')
      } else {
        const nextProp = properties[idx + 1]!
        setSelectedPropertyId(nextProp.id)
        setNotification(`Valittu kohde: ${nextProp.name}`)
      }
    }
    setSelectedTaskIndex(0)
    setSelectedTxIndex(0)
  }

  // Asiakirjan linkityskohteet valitulle kohteelle (tyypin mukaan).
  const linkCandidates = (
    type: DocumentLinkType,
    propId: number,
  ): { id: number; label: string }[] => {
    switch (type) {
      case 'fireplace':
        return fireplaces
          .filter((f) => f.property_id === propId)
          .map((f) => ({ id: f.id, label: f.name }))
      case 'wastewater':
        return wastewaterSystems
          .filter((w) => w.property_id === propId)
          .map((w) => ({ id: w.id, label: WASTEWATER_LABELS[w.type] }))
      case 'water_test':
        return waterTests
          .filter((t) => t.property_id === propId)
          .map((t) => ({ id: t.id, label: t.test_date }))
      case 'insurance':
        return insurance
          .filter((i) => i.property_id === propId)
          .map((i) => ({ id: i.id, label: i.policy_name }))
      default:
        return []
    }
  }

  // Avaa lomake uuden kohteen lisäämiseksi
  const openAddForm = () => {
    setEditingId(null)
    setActiveField(0)

    if (activeTab === 'overview') {
      setFormType('property')
      setFormPropName('')
      setFormPropTunnus('')
      setFormPropWater('well')
      setFormPropYear('1950')
      setFormPropLoc('')
      setFormPropSaunaType('none')
      setFormPropSaunaInfo('')
      setFormPropTax('0')
      setFormPropRoadFee('0')
      setFormPropElecFuse('')
      setFormPropWaterConn('')
      setFormPropWasteProvider('')
      setFormPropWasteBin('')
      setFormPropWasteInterval('')
      setFormPropBiowaste('collection')
      setFormPropCompostReg(0)
      setFormPropCompostDate('')
      setIsFormOpen(true)
      setNotification(
        'Lomake: Lisää uusi kiinteistö. Liiku nuolilla, tallenna alhaalta.',
      )
    } else if (activeTab === 'tasks') {
      setFormType('task')
      const initialPropId =
        selectedPropertyId ?? (properties[0] ? properties[0].id : 1)
      setFormPropId(initialPropId)
      setFormTitle('')
      setFormCategory('')
      setFormPriority('medium')
      setFormCost('0')
      setFormRecurrence('none')
      setIsFormOpen(true)
      setNotification(
        'Lomake: Lisää uusi tehtävä. Liiku nuolilla, tallenna alhaalta.',
      )
    } else if (activeTab === 'renovations') {
      const initialPropId =
        selectedPropertyId ?? (properties[0] ? properties[0].id : 1)
      if (focusedRenList === 'transactions') {
        setFormType('transaction')
        setFormPropId(initialPropId)
        setFormTxType('expense')
        setFormCategory('')
        setFormTxAmount('')
        setFormTxDesc('')
        setIsFormOpen(true)
        setNotification(
          'Lomake: Lisää uusi taloustapahtuma. Liiku nuolilla, tallenna alhaalta.',
        )
      } else {
        setFormType('renovation')
        setFormPropId(initialPropId)
        setFormRenName('')
        setFormRenStatus('planning')
        setFormRenBudget('0')
        setFormRenSpent('0')
        setFormRenStartDate(new Date().toISOString().split('T')[0])
        setFormRenEndDate('')
        setIsFormOpen(true)
        setNotification(
          'Lomake: Lisää uusi remonttihanke. Liiku nuolilla, tallenna alhaalta.',
        )
      }
    } else if (activeTab === 'utilities') {
      setFormType('utility')
      const initialPropId =
        selectedPropertyId ?? (properties[0] ? properties[0].id : 1)
      setFormPropId(initialPropId)
      setFormUtilType('electric_siirto')
      setFormUtilProvider('')
      setFormUtilAmount('')
      const now = new Date()
      setFormUtilMonth(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      )
      setFormUtilUsage('')
      setIsFormOpen(true)
      setNotification(
        'Lomake: Lisää uusi kulutuslasku. Liiku nuolilla, tallenna alhaalta.',
      )
    } else if (activeTab === 'tools') {
      if (focusedToolList === 'insurance') {
        setFormType('insurance')
        const initialPropId =
          selectedPropertyId ?? (properties[0] ? properties[0].id : 1)
        setFormPropId(initialPropId)
        setFormInsPolicyName('')
        setFormInsProvider('')
        setFormInsPremium('')
        setFormInsRenewalDate(new Date().toISOString().split('T')[0])
        setFormInsCoverageDetails('')
        setIsFormOpen(true)
        setNotification(
          'Lomake: Lisää uusi vakuutussopimus. Liiku nuolilla, tallenna alhaalta.',
        )
      } else {
        setFormType('tool')
        setFormToolName('')
        setFormToolStatus('working')
        setFormToolLocation('')
        setFormToolPurchaseDate(new Date().toISOString().split('T')[0])
        setIsFormOpen(true)
        setNotification(
          'Lomake: Lisää uusi työkalu. Liiku nuolilla, tallenna alhaalta.',
        )
      }
    } else if (activeTab === 'compliance') {
      const initialPropId =
        selectedPropertyId ?? (properties[0] ? properties[0].id : 1)
      setFormPropId(initialPropId)
      if (focusedComplianceList === 'fireplaces') {
        setFormType('fireplace')
        setFormFpType('fireplace')
        setFormFpName('')
        setFormFpLastSweep('')
        setFormFpNextSweep('')
        setFormFpSweeper('')
        setNotification(
          'Lomake: Lisää uusi tulisija. Liiku nuolilla, tallenna alhaalta.',
        )
      } else if (focusedComplianceList === 'wastewater') {
        setFormType('wastewater')
        setFormWwType('septic_tank')
        setFormWwPermit('')
        setFormWwLastEmptied('')
        setFormWwNextEmptied('')
        setFormWwProvider('')
        setFormWwBuildYear('')
        setFormWwShoreline(0)
        setFormWwGroundwater(0)
        setFormWwHasWc(1)
        setFormWwExemption(0)
        setNotification(
          'Lomake: Lisää uusi jätevesijärjestelmä. Liiku nuolilla, tallenna alhaalta.',
        )
      } else if (focusedComplianceList === 'heating') {
        setFormType('heating')
        setFormHtType('wood')
        setFormHtDesc('')
        setFormHtLastInsp('')
        setFormHtNextInsp('')
        setNotification(
          'Lomake: Lisää uusi lämmitysjärjestelmä. Liiku nuolilla, tallenna alhaalta.',
        )
      } else {
        setFormType('water_test')
        setFormWtDate(new Date().toISOString().split('T')[0]!)
        setFormWtEcoli('')
        setFormWtColiforms('')
        setFormWtNitrate('')
        setFormWtPh('')
        setFormWtIron('')
        setFormWtFluoride('')
        setFormWtPassed(1)
        setFormWtNotes('')
        setNotification(
          'Lomake: Kirjaa uusi kaivovesitutkimus. Liiku nuolilla, tallenna alhaalta.',
        )
      }
      setIsFormOpen(true)
    } else if (activeTab === 'firewood') {
      setFormType('firewood')
      const initialPropId =
        selectedPropertyId ?? (properties[0] ? properties[0].id : 1)
      setFormPropId(initialPropId)
      setFormFwWoodType('Koivu')
      setFormFwVolume('')
      setFormFwUnit('pino-m³')
      setFormFwLocation('')
      setFormFwDrying('ready')
      setFormFwStacked(new Date().toISOString().split('T')[0]!)
      setFormFwNotes('')
      setIsFormOpen(true)
      setNotification(
        'Lomake: Lisää polttopuuerä. Liiku nuolilla, tallenna alhaalta.',
      )
    } else if (activeTab === 'seasonal') {
      setFormType('booking')
      const initialPropId =
        selectedPropertyId ?? (properties[0] ? properties[0].id : 1)
      setFormPropId(initialPropId)
      setFormBkGuest('')
      setFormBkStart(new Date().toISOString().split('T')[0]!)
      setFormBkEnd('')
      setFormBkPrice('')
      setFormBkStatus('confirmed')
      setFormBkNotes('')
      setIsFormOpen(true)
      setNotification(
        'Lomake: Lisää vuokravaraus. Liiku nuolilla, tallenna alhaalta.',
      )
    } else if (activeTab === 'archive') {
      const initialPropId =
        selectedPropertyId ?? (properties[0] ? properties[0].id : 1)
      setFormPropId(initialPropId)
      if (focusedArchiveList === 'contacts') {
        setFormType('contact')
        setFormCoName('')
        setFormCoRole('nuohooja')
        setFormCoPhone('')
        setFormCoEmail('')
        setFormCoNotes('')
        setNotification(
          'Lomake: Lisää yhteystieto. Liiku nuolilla, tallenna alhaalta.',
        )
      } else if (focusedArchiveList === 'documents') {
        setFormType('document')
        setFormDocType('deed')
        setFormDocTitle('')
        setFormDocPath('')
        setFormDocDate('')
        setFormDocNotes('')
        setFormDocLinkedType('')
        setFormDocLinkedId(0)
        setNotification(
          'Lomake: Lisää asiakirja. Liiku nuolilla, tallenna alhaalta.',
        )
      } else {
        setFormType('meter')
        setFormMtType('electric')
        setFormMtReading('')
        setFormMtDate(new Date().toISOString().split('T')[0]!)
        setFormMtNotes('')
        setNotification(
          'Lomake: Kirjaa mittarilukema. Liiku nuolilla, tallenna alhaalta.',
        )
      }
      setIsFormOpen(true)
    } else {
      setNotification('Lisääminen ei ole käytössä tällä välilehdellä!')
    }
  }

  // Avaa lomake muokkausta varten
  const openEditForm = () => {
    setActiveField(0)
    if (activeTab === 'overview') {
      if (selectedPropertyId !== null) {
        const prop = properties.find((p) => p.id === selectedPropertyId)
        if (!prop) return
        setEditingId(prop.id)
        setFormType('property')
        setFormPropName(prop.name)
        setFormPropTunnus(prop.kiinteistotunnus)
        setFormPropWater(prop.water_source)
        setFormPropYear(prop.build_year.toString())
        setFormPropLoc(prop.location)
        setFormPropSaunaType(prop.sauna_type ?? 'none')
        setFormPropSaunaInfo(prop.sauna_info ?? '')
        setFormPropTax((prop.property_tax ?? 0).toString())
        setFormPropRoadFee((prop.road_fee ?? 0).toString())
        setFormPropElecFuse(prop.electricity_fuse ?? '')
        setFormPropWaterConn(prop.water_connection ?? '')
        setFormPropWasteProvider(prop.waste_provider ?? '')
        setFormPropWasteBin(prop.waste_bin ?? '')
        setFormPropWasteInterval(prop.waste_interval ?? '')
        setFormPropBiowaste(prop.biowaste ?? 'collection')
        setFormPropCompostReg(prop.compost_registered ?? 0)
        setFormPropCompostDate(prop.compost_reg_date ?? '')
        setIsFormOpen(true)
        setNotification(`Muokataan kiinteistöä: "${prop.name}"`)
      } else {
        setNotification('Valitse ensin muokattava kiinteistö painamalla [p]!')
      }
    } else if (activeTab === 'tasks' && tasks.length > 0) {
      const task = tasks[selectedTaskIndex]
      if (!task) return
      setEditingId(task.id)
      setFormType('task')
      setFormPropId(task.property_id)
      setFormTitle(task.title)
      setFormCategory(task.category)
      setFormPriority(task.priority)
      setFormCost(task.cost.toString())
      setFormRecurrence(task.recurrence ?? 'none')
      setIsFormOpen(true)
      setNotification(`Muokataan tehtävää: "${task.title}"`)
    } else if (activeTab === 'renovations') {
      if (focusedRenList === 'transactions') {
        if (
          transactions.length === 0 ||
          selectedTxIndex >= transactions.length
        ) {
          setNotification('Valitse muokattava taloustapahtuma listalta!')
          return
        }
        const tx = transactions[selectedTxIndex]
        if (!tx) return
        setEditingId(tx.id)
        setFormType('transaction')
        setFormPropId(tx.property_id)
        setFormTxType(tx.type)
        setFormCategory(tx.category)
        setFormTxAmount(tx.amount.toString())
        setFormTxDesc(tx.description)
        setIsFormOpen(true)
        setNotification(`Muokataan tapahtumaa: "${tx.description}"`)
      } else if (
        renovations.length > 0 &&
        selectedRenovationIndex < renovations.length
      ) {
        const ren = renovations[selectedRenovationIndex]
        if (!ren) return
        setEditingId(ren.id)
        setFormType('renovation')
        setFormPropId(ren.property_id)
        setFormRenName(ren.project_name)
        setFormRenStatus(ren.status)
        setFormRenBudget(ren.budget.toString())
        setFormRenSpent(ren.spent.toString())
        setFormRenStartDate(ren.start_date)
        setFormRenEndDate(ren.end_date || '')
        setIsFormOpen(true)
        setNotification(`Muokataan remonttihanketta: "${ren.project_name}"`)
      } else {
        setNotification('Valitse muokattava remonttihanke listalta!')
      }
    } else if (activeTab === 'utilities' && utilities.length > 0) {
      const u = utilities[selectedUtilIndex]
      if (!u) return
      setEditingId(u.id)
      setFormType('utility')
      setFormPropId(u.property_id)
      setFormUtilType(u.type)
      setFormUtilProvider(u.provider)
      setFormUtilAmount(u.amount.toString())
      setFormUtilMonth(u.billing_month)
      setFormUtilUsage(u.usage_value.toString())
      setIsFormOpen(true)
      setNotification(`Muokataan kulutusta: ${u.type} ${u.billing_month}`)
    } else if (activeTab === 'tools') {
      if (focusedToolList === 'insurance') {
        if (insurance.length > 0 && selectedInsuranceIndex < insurance.length) {
          const ins = insurance[selectedInsuranceIndex]
          if (!ins) return
          setEditingId(ins.id)
          setFormType('insurance')
          setFormPropId(ins.property_id)
          setFormInsPolicyName(ins.policy_name)
          setFormInsProvider(ins.provider)
          setFormInsPremium(ins.premium.toString())
          setFormInsRenewalDate(ins.renewal_date)
          setFormInsCoverageDetails(ins.coverage_details)
          setIsFormOpen(true)
          setNotification(`Muokataan vakuutusta: "${ins.policy_name}"`)
        } else {
          setNotification('Valitse muokattava vakuutus listalta!')
        }
      } else {
        if (tools.length > 0 && selectedToolIndex < tools.length) {
          const t = tools[selectedToolIndex]
          if (!t) return
          setEditingId(t.id)
          setFormType('tool')
          setFormToolName(t.name)
          setFormToolStatus(t.status)
          setFormToolLocation(t.location)
          setFormToolPurchaseDate(t.purchase_date)
          setIsFormOpen(true)
          setNotification(`Muokataan laitetta: "${t.name}"`)
        } else {
          setNotification('Valitse muokattava laite listalta!')
        }
      }
    } else if (activeTab === 'compliance') {
      if (focusedComplianceList === 'fireplaces') {
        const f = fireplaces[selectedComplianceIndex]
        if (!f) {
          setNotification('Valitse muokattava tulisija listalta!')
          return
        }
        setEditingId(f.id)
        setFormType('fireplace')
        setFormPropId(f.property_id)
        setFormFpType(f.type)
        setFormFpName(f.name)
        setFormFpLastSweep(f.last_sweep ?? '')
        setFormFpNextSweep(f.next_sweep ?? '')
        setFormFpSweeper(f.sweeper)
        setIsFormOpen(true)
        setNotification(`Muokataan tulisijaa: "${f.name}"`)
      } else if (focusedComplianceList === 'wastewater') {
        const w = wastewaterSystems[selectedComplianceIndex]
        if (!w) {
          setNotification('Valitse muokattava jätevesijärjestelmä listalta!')
          return
        }
        setEditingId(w.id)
        setFormType('wastewater')
        setFormPropId(w.property_id)
        setFormWwType(w.type)
        setFormWwPermit(w.permit_info)
        setFormWwLastEmptied(w.last_emptied ?? '')
        setFormWwNextEmptied(w.next_emptied ?? '')
        setFormWwProvider(w.emptying_provider)
        setFormWwBuildYear(w.build_year ? String(w.build_year) : '')
        setFormWwShoreline(w.shoreline ?? 0)
        setFormWwGroundwater(w.groundwater ?? 0)
        setFormWwHasWc(w.has_wc ?? 1)
        setFormWwExemption(w.exemption ?? 0)
        setIsFormOpen(true)
        setNotification(
          `Muokataan jätevesijärjestelmää (${WASTEWATER_LABELS[w.type]})`,
        )
      } else if (focusedComplianceList === 'heating') {
        const h = heatingSystems[selectedComplianceIndex]
        if (!h) {
          setNotification('Valitse muokattava lämmitysjärjestelmä listalta!')
          return
        }
        setEditingId(h.id)
        setFormType('heating')
        setFormPropId(h.property_id)
        setFormHtType(h.type)
        setFormHtDesc(h.description)
        setFormHtLastInsp(h.last_inspection ?? '')
        setFormHtNextInsp(h.next_inspection ?? '')
        setIsFormOpen(true)
        setNotification(
          `Muokataan lämmitysjärjestelmää (${HEATING_LABELS[h.type]})`,
        )
      } else {
        const wt = waterTests[selectedComplianceIndex]
        if (!wt) {
          setNotification('Valitse muokattava vesitutkimus listalta!')
          return
        }
        setEditingId(wt.id)
        setFormType('water_test')
        setFormPropId(wt.property_id)
        setFormWtDate(wt.test_date)
        setFormWtEcoli(wt.ecoli)
        setFormWtColiforms(wt.coliforms)
        setFormWtNitrate(wt.nitrate)
        setFormWtPh(wt.ph)
        setFormWtIron(wt.iron)
        setFormWtFluoride(wt.fluoride)
        setFormWtPassed(wt.passed)
        setFormWtNotes(wt.notes)
        setIsFormOpen(true)
        setNotification(`Muokataan vesitutkimusta: ${wt.test_date}`)
      }
    } else if (activeTab === 'firewood') {
      const f = firewood[selectedFirewoodIndex]
      if (!f) {
        setNotification('Valitse muokattava polttopuuerä listalta!')
        return
      }
      setEditingId(f.id)
      setFormType('firewood')
      setFormPropId(f.property_id)
      setFormFwWoodType(f.wood_type)
      setFormFwVolume(f.volume.toString())
      setFormFwUnit(f.unit)
      setFormFwLocation(f.location)
      setFormFwDrying(f.drying_status)
      setFormFwStacked(f.stacked_date)
      setFormFwNotes(f.notes)
      setIsFormOpen(true)
      setNotification(
        `Muokataan polttopuuerää: ${f.wood_type} ${f.volume} ${f.unit}`,
      )
    } else if (activeTab === 'seasonal') {
      const b = bookings[selectedBookingIndex]
      if (!b) {
        setNotification('Valitse muokattava varaus listalta!')
        return
      }
      setEditingId(b.id)
      setFormType('booking')
      setFormPropId(b.property_id)
      setFormBkGuest(b.guest_name)
      setFormBkStart(b.start_date)
      setFormBkEnd(b.end_date)
      setFormBkPrice(b.price.toString())
      setFormBkStatus(b.status)
      setFormBkNotes(b.notes)
      setIsFormOpen(true)
      setNotification(`Muokataan varausta: ${b.guest_name} (${b.start_date})`)
    } else if (activeTab === 'archive') {
      if (focusedArchiveList === 'contacts') {
        const c = contacts[selectedArchiveIndex]
        if (!c) {
          setNotification('Valitse muokattava yhteystieto listalta!')
          return
        }
        setEditingId(c.id)
        setFormType('contact')
        setFormCoName(c.name)
        setFormCoRole(c.role)
        setFormCoPhone(c.phone)
        setFormCoEmail(c.email)
        setFormCoNotes(c.notes)
        setIsFormOpen(true)
        setNotification(`Muokataan yhteystietoa: ${c.name}`)
      } else if (focusedArchiveList === 'documents') {
        const d = documents[selectedArchiveIndex]
        if (!d) {
          setNotification('Valitse muokattava asiakirja listalta!')
          return
        }
        setEditingId(d.id)
        setFormType('document')
        setFormPropId(d.property_id)
        setFormDocType(d.doc_type)
        setFormDocTitle(d.title)
        setFormDocPath(d.file_path)
        setFormDocDate(d.issued_date)
        setFormDocNotes(d.notes)
        setFormDocLinkedType(d.linked_type ?? '')
        setFormDocLinkedId(d.linked_id ?? 0)
        setIsFormOpen(true)
        setNotification(`Muokataan asiakirjaa: ${d.title}`)
      } else {
        const m = meterReadings[selectedArchiveIndex]
        if (!m) {
          setNotification('Valitse muokattava mittarilukema listalta!')
          return
        }
        setEditingId(m.id)
        setFormType('meter')
        setFormPropId(m.property_id)
        setFormMtType(m.meter_type)
        setFormMtReading(m.reading.toString())
        setFormMtDate(m.reading_date)
        setFormMtNotes(m.notes)
        setIsFormOpen(true)
        setNotification(`Muokataan mittarilukemaa: ${m.reading_date}`)
      }
    } else {
      setNotification('Valitse muokattava kohde listalta!')
    }
  }

  // Poista kohde (vain tab 1 ja tietty property valittu)
  const triggerDelete = () => {
    if (activeTab === 'overview') {
      if (selectedPropertyId !== null) {
        const prop = properties.find((p) => p.id === selectedPropertyId)
        if (prop) {
          deleteProperty(prop.id)
          setNotification(
            `Poistettu kiinteistö: "${prop.name}" kaikkine tietoineen.`,
          )
          setSelectedPropertyId(null)
          reloadData()
        }
      } else {
        setNotification('Valitse ensin poistettava kiinteistö painamalla [p]!')
      }
    } else if (activeTab === 'tasks' && tasks.length > 0) {
      const task = tasks[selectedTaskIndex]
      if (task) {
        deleteRow('tasks', task.id)
        setNotification(`Poistettu tehtävä: "${task.title}"`)
        setSelectedTaskIndex(0)
        reloadData()
      }
    } else if (activeTab === 'renovations') {
      if (focusedRenList === 'transactions') {
        if (transactions.length > 0 && selectedTxIndex < transactions.length) {
          const tx = transactions[selectedTxIndex]
          if (tx) {
            deleteRow('transactions', tx.id)
            setNotification(`Poistettu tapahtuma: "${tx.description}"`)
            setSelectedTxIndex(0)
            reloadData()
          }
        } else {
          setNotification('Valitse ensin poistettava taloustapahtuma!')
        }
      } else if (
        renovations.length > 0 &&
        selectedRenovationIndex < renovations.length
      ) {
        const ren = renovations[selectedRenovationIndex]
        if (ren) {
          deleteRow('renovations', ren.id)
          setNotification(`Poistettu remonttihanke: "${ren.project_name}"`)
          setSelectedRenovationIndex(0)
          reloadData()
        }
      }
    } else if (activeTab === 'utilities' && utilities.length > 0) {
      const u = utilities[selectedUtilIndex]
      if (u) {
        deleteRow('utilities', u.id)
        setNotification(`Poistettu kulutuslasku: ${u.type} ${u.billing_month}`)
        setSelectedUtilIndex(0)
        reloadData()
      }
    } else if (activeTab === 'tools') {
      if (focusedToolList === 'insurance') {
        if (insurance.length > 0 && selectedInsuranceIndex < insurance.length) {
          const ins = insurance[selectedInsuranceIndex]
          if (ins) {
            deleteRow('insurance', ins.id)
            setNotification(`Poistettu vakuutus: "${ins.policy_name}"`)
            setSelectedInsuranceIndex(0)
            reloadData()
          }
        }
      } else {
        if (tools.length > 0 && selectedToolIndex < tools.length) {
          const t = tools[selectedToolIndex]
          if (t) {
            deleteRow('tools', t.id)
            setNotification(`Poistettu laite: "${t.name}"`)
            setSelectedToolIndex(0)
            reloadData()
          }
        }
      }
    } else if (activeTab === 'compliance') {
      if (focusedComplianceList === 'fireplaces') {
        const f = fireplaces[selectedComplianceIndex]
        if (f) {
          deleteRow('fireplaces', f.id)
          setNotification(`Poistettu tulisija: "${f.name}"`)
        }
      } else if (focusedComplianceList === 'wastewater') {
        const w = wastewaterSystems[selectedComplianceIndex]
        if (w) {
          deleteRow('wastewater_systems', w.id)
          setNotification(
            `Poistettu jätevesijärjestelmä (${WASTEWATER_LABELS[w.type]})`,
          )
        }
      } else if (focusedComplianceList === 'heating') {
        const h = heatingSystems[selectedComplianceIndex]
        if (h) {
          deleteRow('heating_systems', h.id)
          setNotification(
            `Poistettu lämmitysjärjestelmä (${HEATING_LABELS[h.type]})`,
          )
        }
      } else {
        const wt = waterTests[selectedComplianceIndex]
        if (wt) {
          deleteRow('water_tests', wt.id)
          setNotification(`Poistettu vesitutkimus: ${wt.test_date}`)
        }
      }
      setSelectedComplianceIndex(0)
      reloadData()
    } else if (activeTab === 'firewood') {
      const f = firewood[selectedFirewoodIndex]
      if (f) {
        deleteRow('firewood', f.id)
        setNotification(
          `Poistettu polttopuuerä: ${f.wood_type} ${f.volume} ${f.unit}`,
        )
        setSelectedFirewoodIndex(0)
        reloadData()
      }
    } else if (activeTab === 'seasonal') {
      const b = bookings[selectedBookingIndex]
      if (b) {
        deleteRow('bookings', b.id)
        setNotification(`Poistettu varaus: ${b.guest_name} (${b.start_date})`)
        setSelectedBookingIndex(0)
        reloadData()
      }
    } else if (activeTab === 'archive') {
      if (focusedArchiveList === 'contacts') {
        const c = contacts[selectedArchiveIndex]
        if (c) {
          deleteRow('contacts', c.id)
          setNotification(`Poistettu yhteystieto: ${c.name}`)
        }
      } else if (focusedArchiveList === 'documents') {
        const d = documents[selectedArchiveIndex]
        if (d) {
          deleteRow('documents', d.id)
          setNotification(`Poistettu asiakirja: ${d.title}`)
        }
      } else {
        const m = meterReadings[selectedArchiveIndex]
        if (m) {
          deleteRow('meter_readings', m.id)
          setNotification(`Poistettu mittarilukema: ${m.reading_date}`)
        }
      }
      setSelectedArchiveIndex(0)
      reloadData()
    }
  }

  // Kirjaa valitun varauksen vuokratulo taloustapahtumaksi (kerran varausta kohti).
  const recordBookingIncome = () => {
    const b = bookings[selectedBookingIndex]
    if (!b) {
      setNotification('Valitse varaus listalta.')
      return
    }
    if (b.status === 'cancelled') {
      setNotification('Peruttua varausta ei kirjata tuloksi.')
      return
    }
    if (b.income_recorded) {
      setNotification('Tämän varauksen tulo on jo kirjattu.')
      return
    }
    if (b.price <= 0) {
      setNotification('Varauksella ei ole hintaa — ei kirjattavaa tuloa.')
      return
    }
    try {
      addTransaction({
        property_id: b.property_id,
        type: 'income',
        category: 'Vuokraus',
        amount: b.price,
        date: b.start_date,
        description: `Vuokratulo: ${b.guest_name} (${b.start_date}–${b.end_date})`,
        renovation_id: null,
      })
      updateBooking({ ...b, income_recorded: 1 })
      setNotification(
        `Vuokratulo ${b.price.toFixed(2)} € kirjattu taloustapahtumaksi.`,
      )
      reloadData()
    } catch (e) {
      setNotification(`Tulon kirjaus epäonnistui: ${(e as Error).message}`)
    }
  }

  // Luo kausikatsauksen tarkistuslista tehtävinä valitulle kohteelle.
  const generateSeasonalChecklist = (season: 'spring' | 'autumn') => {
    if (selectedPropertyId === null) {
      setNotification('Valitse ensin yksittäinen kohde painamalla [p]!')
      return
    }
    const tpl = SEASONAL_TEMPLATES[season]
    const year = new Date().getFullYear()
    const due = `${year}-${tpl.month}-${tpl.day}`
    try {
      tpl.tasks.forEach((title) => {
        addTask({
          property_id: selectedPropertyId,
          title,
          status: 'pending',
          priority: 'medium',
          due_date: due,
          category: tpl.category,
          cost: 0,
          recurrence: 'none',
          next_due: null,
        })
      })
      setNotification(
        `${tpl.label}: luotiin ${tpl.tasks.length} tehtävää (eräpäivä ${due}). Katso välilehti 2.`,
      )
      reloadData()
    } catch (e) {
      setNotification(
        `Tarkistuslistan luonti epäonnistui: ${(e as Error).message}`,
      )
    }
  }

  // Avaa koko kiinteistön kertanuohous-lomake.
  const openBulkSweep = () => {
    const propId = selectedPropertyId ?? (properties[0] ? properties[0].id : 1)
    const fps = getFireplaces(propId)
    if (fps.length === 0) {
      setNotification(
        'Valitulla kohteella ei ole tulisijoja. Lisää ensin tulisija [a].',
      )
      return
    }
    setFormType('bulk_sweep')
    setFormPropId(propId)
    setFormBulkFireplaces(fps)
    setFormBulkExcluded([])
    setFormBulkDate(new Date().toISOString().split('T')[0]!)
    setEditingId(null)
    setActiveField(0)
    setIsFormOpen(true)
    setNotification(
      'Koko kiinteistön nuohous: valitse päivä ja jätä tarvittaessa yksittäisiä pois. Tallenna alhaalta.',
    )
  }

  // Lomakkeen viimeisen kentän indeksi — bulk_sweep on dynaaminen (riippuu tulisijamäärästä).
  const currentMaxField = () =>
    formType === 'bulk_sweep'
      ? formBulkFireplaces.length + 2
      : getMaxField(formType)

  // Tallenna lomake SQLiteen
  const saveForm = () => {
    try {
      if (formType === 'property') {
        const yearNum = parseInt(formPropYear, 10) || 1900
        if (!formPropName.trim()) {
          setNotification('Virhe: Nimi ei voi olla tyhjä!')
          return
        }
        if (!formPropTunnus.trim()) {
          setNotification('Virhe: Kiinteistötunnus ei voi olla tyhjä!')
          return
        }
        // Energiatehokkuuden kentät (floor_area, energy_rating, ...) eivät vielä ole TUI-lomakkeella —
        // säilytetään olemassa oleva arvo muokattaessa, oletusarvot uutta kiinteistöä lisättäessä.
        const existingProp = properties.find((p) => p.id === editingId)
        const propExtra = {
          sauna_type: formPropSaunaType,
          sauna_info: formPropSaunaInfo,
          property_tax: parseFloat(formPropTax) || 0,
          road_fee: parseFloat(formPropRoadFee) || 0,
          electricity_fuse: formPropElecFuse,
          water_connection: formPropWaterConn,
          waste_provider: formPropWasteProvider,
          waste_bin: formPropWasteBin,
          waste_interval: formPropWasteInterval,
          biowaste: formPropBiowaste,
          compost_registered: formPropCompostReg,
          compost_reg_date: formPropCompostDate,
          floor_area: existingProp?.floor_area ?? 0,
          energy_rating: existingProp?.energy_rating ?? '',
          energy_cert_date: existingProp?.energy_cert_date ?? '',
          energy_cert_valid_until: existingProp?.energy_cert_valid_until ?? '',
        }
        if (editingId === null) {
          addProperty({
            name: formPropName,
            kiinteistotunnus: formPropTunnus,
            water_source: formPropWater,
            build_year: yearNum,
            location: formPropLoc || 'Finland',
            ...propExtra,
          })
          setNotification('Uusi kiinteistö tallennettu!')
        } else {
          updateProperty({
            id: editingId,
            name: formPropName,
            kiinteistotunnus: formPropTunnus,
            water_source: formPropWater,
            build_year: yearNum,
            location: formPropLoc || 'Finland',
            ...propExtra,
          })
          setNotification('Kiinteistötiedot päivitetty!')
        }
      } else if (formType === 'task') {
        const costNum = parseFloat(formCost) || 0
        if (!formTitle.trim()) {
          setNotification('Virhe: Otsikko ei voi olla tyhjä!')
          return
        }
        if (editingId === null) {
          const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]!
          addTask({
            property_id: formPropId,
            title: formTitle,
            status: 'pending',
            priority: formPriority,
            due_date: dueDate,
            category: formCategory || 'Yleinen',
            cost: costNum,
            recurrence: formRecurrence,
            next_due:
              formRecurrence === 'none'
                ? null
                : advanceRecurrence(dueDate, formRecurrence),
          })
          setNotification('Uusi tehtävä tallennettu!')
        } else {
          const existing = tasks.find((t) => t.id === editingId)
          const dueDate =
            existing?.due_date || new Date().toISOString().split('T')[0]!
          // Säilytä olemassa oleva next_due jos toistuvuus ei muuttunut; muuten laske uudelleen.
          const nextDue =
            formRecurrence === 'none'
              ? null
              : existing?.recurrence === formRecurrence && existing?.next_due
                ? existing.next_due
                : advanceRecurrence(dueDate, formRecurrence)
          updateTask({
            id: editingId,
            property_id: formPropId,
            title: formTitle,
            status: existing?.status || 'pending',
            priority: formPriority,
            due_date: dueDate,
            category: formCategory || 'Yleinen',
            cost: costNum,
            recurrence: formRecurrence,
            next_due: nextDue,
          })
          setNotification('Tehtävä päivitetty!')
        }
      } else if (formType === 'renovation') {
        const budgetNum = parseFloat(formRenBudget) || 0
        const spentNum = parseFloat(formRenSpent) || 0
        if (!formRenName.trim()) {
          setNotification('Virhe: Hankkeen nimi ei voi olla tyhjä!')
          return
        }
        if (!formRenStartDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          setNotification('Virhe: Aloituspäivän pitää olla muotoa YYYY-MM-DD!')
          return
        }
        const endDateStr = formRenEndDate.trim() ? formRenEndDate.trim() : null
        if (endDateStr && !endDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          setNotification(
            'Virhe: Lopetuspäivän pitää olla muotoa YYYY-MM-DD tai tyhjä!',
          )
          return
        }

        if (editingId === null) {
          addRenovation({
            property_id: formPropId,
            project_name: formRenName,
            status: formRenStatus,
            budget: budgetNum,
            spent: spentNum,
            start_date: formRenStartDate,
            end_date: endDateStr,
          })
          setNotification('Uusi remonttihanke tallennettu!')
        } else {
          updateRenovation({
            id: editingId,
            property_id: formPropId,
            project_name: formRenName,
            status: formRenStatus,
            budget: budgetNum,
            spent: spentNum,
            start_date: formRenStartDate,
            end_date: endDateStr,
          })
          setNotification('Remonttihankkeen tiedot päivitetty!')
        }
      } else if (formType === 'tool') {
        if (!formToolName.trim()) {
          setNotification('Virhe: Laitteen nimi ei voi olla tyhjä!')
          return
        }
        if (!formToolPurchaseDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          setNotification('Virhe: Hankintapäivän pitää olla muotoa YYYY-MM-DD!')
          return
        }
        if (editingId === null) {
          addTool({
            name: formToolName,
            status: formToolStatus,
            location: formToolLocation || '-',
            purchase_date: formToolPurchaseDate,
          })
          setNotification('Uusi laite lisätty kalustoon!')
        } else {
          updateTool({
            id: editingId,
            name: formToolName,
            status: formToolStatus,
            location: formToolLocation || '-',
            purchase_date: formToolPurchaseDate,
          })
          setNotification('Laitteen tiedot päivitetty!')
        }
      } else if (formType === 'insurance') {
        const premiumNum = parseFloat(formInsPremium) || 0
        if (!formInsPolicyName.trim()) {
          setNotification('Virhe: Vakuutuksen nimi ei voi olla tyhjä!')
          return
        }
        if (!formInsProvider.trim()) {
          setNotification('Virhe: Yhtiö ei voi olla tyhjä!')
          return
        }
        if (!formInsRenewalDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          setNotification('Virhe: Uusimispäivän pitää olla muotoa YYYY-MM-DD!')
          return
        }
        if (editingId === null) {
          addInsurance({
            property_id: formPropId,
            policy_name: formInsPolicyName,
            provider: formInsProvider,
            premium: premiumNum,
            renewal_date: formInsRenewalDate,
            coverage_details: formInsCoverageDetails || '-',
          })
          setNotification('Uusi vakuutussopimus tallennettu!')
        } else {
          updateInsurance({
            id: editingId,
            property_id: formPropId,
            policy_name: formInsPolicyName,
            provider: formInsProvider,
            premium: premiumNum,
            renewal_date: formInsRenewalDate,
            coverage_details: formInsCoverageDetails || '-',
          })
          setNotification('Vakuutussopimuksen tiedot päivitetty!')
        }
      } else if (formType === 'transaction') {
        const amountNum = parseFloat(formTxAmount) || 0
        if (!formTxDesc.trim()) {
          setNotification('Virhe: Selite ei voi olla tyhjä!')
          return
        }
        if (editingId === null) {
          addTransaction({
            property_id: formPropId,
            type: formTxType,
            category: formCategory || 'Yleinen',
            amount: amountNum,
            date: new Date().toISOString().split('T')[0],
            description: formTxDesc,
            renovation_id: null,
          })
          setNotification('Uusi tapahtuma tallennettu!')
        } else {
          const existing = transactions.find((t) => t.id === editingId)
          updateTransaction({
            id: editingId,
            property_id: formPropId,
            type: formTxType,
            category: formCategory || 'Yleinen',
            amount: amountNum,
            date: existing?.date || new Date().toISOString().split('T')[0],
            description: formTxDesc,
            renovation_id: existing?.renovation_id ?? null,
          })
          setNotification('Tapahtuma päivitetty!')
        }
      } else if (formType === 'utility') {
        const amountNum = parseFloat(formUtilAmount) || 0
        const usageNum = parseFloat(formUtilUsage) || 0
        if (!formUtilMonth.match(/^\d{4}-\d{2}$/)) {
          setNotification(
            'Virhe: Laskutuskausi pitää olla muodossa YYYY-MM (esim. 2026-05)',
          )
          return
        }
        const billingDate = `${formUtilMonth}-01`
        if (editingId === null) {
          addUtility({
            property_id: formPropId,
            type: formUtilType,
            amount: amountNum,
            billing_date: billingDate,
            billing_month: formUtilMonth,
            usage_value: usageNum,
            provider: formUtilProvider || '-',
          })
          setNotification('Kulutuslasku tallennettu!')
        } else {
          updateUtility({
            id: editingId,
            property_id: formPropId,
            type: formUtilType,
            amount: amountNum,
            billing_date: billingDate,
            billing_month: formUtilMonth,
            usage_value: usageNum,
            provider: formUtilProvider || '-',
          })
          setNotification('Kulutuslasku päivitetty!')
        }
      } else if (formType === 'fireplace') {
        const dateRe = /^\d{4}-\d{2}-\d{2}$/
        if (!formFpName.trim()) {
          setNotification('Virhe: Tulisijan nimi ei voi olla tyhjä!')
          return
        }
        const last = formFpLastSweep.trim() || null
        const next = formFpNextSweep.trim() || null
        if (last && !dateRe.test(last)) {
          setNotification('Virhe: Nuohouspäivän muoto YYYY-MM-DD tai tyhjä!')
          return
        }
        if (next && !dateRe.test(next)) {
          setNotification(
            'Virhe: Seuraavan nuohouksen muoto YYYY-MM-DD tai tyhjä!',
          )
          return
        }
        const payload = {
          property_id: formPropId,
          type: formFpType,
          name: formFpName,
          last_sweep: last,
          next_sweep: next,
          sweeper: formFpSweeper,
        }
        if (editingId === null) {
          addFireplace(payload)
          setNotification('Uusi tulisija tallennettu!')
        } else {
          updateFireplace({ id: editingId, ...payload })
          setNotification('Tulisijan tiedot päivitetty!')
        }
      } else if (formType === 'wastewater') {
        const dateRe = /^\d{4}-\d{2}-\d{2}$/
        const last = formWwLastEmptied.trim() || null
        const next = formWwNextEmptied.trim() || null
        if (last && !dateRe.test(last)) {
          setNotification('Virhe: Tyhjennyspäivän muoto YYYY-MM-DD tai tyhjä!')
          return
        }
        if (next && !dateRe.test(next)) {
          setNotification(
            'Virhe: Seuraavan tyhjennyksen muoto YYYY-MM-DD tai tyhjä!',
          )
          return
        }
        const payload = {
          property_id: formPropId,
          type: formWwType,
          permit_info: formWwPermit,
          last_emptied: last,
          next_emptied: next,
          emptying_provider: formWwProvider,
          build_year: parseInt(formWwBuildYear, 10) || 0,
          shoreline: formWwShoreline,
          groundwater: formWwGroundwater,
          has_wc: formWwHasWc,
          exemption: formWwExemption,
        }
        if (editingId === null) {
          addWastewaterSystem(payload)
          setNotification('Uusi jätevesijärjestelmä tallennettu!')
        } else {
          updateWastewaterSystem({ id: editingId, ...payload })
          setNotification('Jätevesijärjestelmän tiedot päivitetty!')
        }
      } else if (formType === 'heating') {
        const dateRe = /^\d{4}-\d{2}-\d{2}$/
        const last = formHtLastInsp.trim() || null
        const next = formHtNextInsp.trim() || null
        if (last && !dateRe.test(last)) {
          setNotification('Virhe: Tarkastuspäivän muoto YYYY-MM-DD tai tyhjä!')
          return
        }
        if (next && !dateRe.test(next)) {
          setNotification(
            'Virhe: Seuraavan tarkastuksen muoto YYYY-MM-DD tai tyhjä!',
          )
          return
        }
        const payload = {
          property_id: formPropId,
          type: formHtType,
          description: formHtDesc,
          last_inspection: last,
          next_inspection: next,
        }
        if (editingId === null) {
          addHeatingSystem(payload)
          setNotification('Uusi lämmitysjärjestelmä tallennettu!')
        } else {
          updateHeatingSystem({ id: editingId, ...payload })
          setNotification('Lämmitysjärjestelmän tiedot päivitetty!')
        }
      } else if (formType === 'water_test') {
        if (!formWtDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          setNotification('Virhe: Näytepäivän muoto YYYY-MM-DD!')
          return
        }
        const payload = {
          property_id: formPropId,
          test_date: formWtDate,
          ecoli: formWtEcoli,
          coliforms: formWtColiforms,
          nitrate: formWtNitrate,
          ph: formWtPh,
          iron: formWtIron,
          fluoride: formWtFluoride,
          passed: formWtPassed,
          notes: formWtNotes,
        }
        if (editingId === null) {
          addWaterTest(payload)
          setNotification('Uusi vesitutkimus tallennettu!')
        } else {
          updateWaterTest({ id: editingId, ...payload })
          setNotification('Vesitutkimuksen tiedot päivitetty!')
        }
      } else if (formType === 'firewood') {
        const volNum = parseFloat(formFwVolume) || 0
        if (volNum <= 0) {
          setNotification('Virhe: Määrän pitää olla suurempi kuin 0!')
          return
        }
        if (
          formFwStacked.trim() &&
          !formFwStacked.match(/^\d{4}-\d{2}-\d{2}$/)
        ) {
          setNotification('Virhe: Pinoamispäivän muoto YYYY-MM-DD tai tyhjä!')
          return
        }
        const payload = {
          property_id: formPropId,
          wood_type: formFwWoodType,
          volume: volNum,
          unit: formFwUnit,
          location: formFwLocation,
          drying_status: formFwDrying,
          stacked_date: formFwStacked.trim(),
          notes: formFwNotes,
        }
        if (editingId === null) {
          addFirewood(payload)
          setNotification('Polttopuuerä tallennettu!')
        } else {
          updateFirewood({ id: editingId, ...payload })
          setNotification('Polttopuuerän tiedot päivitetty!')
        }
      } else if (formType === 'booking') {
        const dateRe = /^\d{4}-\d{2}-\d{2}$/
        if (!formBkGuest.trim()) {
          setNotification('Virhe: Varaajan nimi ei voi olla tyhjä!')
          return
        }
        if (!dateRe.test(formBkStart)) {
          setNotification('Virhe: Saapumispäivän muoto YYYY-MM-DD!')
          return
        }
        if (!dateRe.test(formBkEnd)) {
          setNotification('Virhe: Lähtöpäivän muoto YYYY-MM-DD!')
          return
        }
        if (formBkEnd < formBkStart) {
          setNotification('Virhe: Lähtöpäivä ei voi olla ennen saapumista!')
          return
        }
        const priceNum = parseFloat(formBkPrice) || 0
        if (editingId === null) {
          addBooking({
            property_id: formPropId,
            guest_name: formBkGuest,
            start_date: formBkStart,
            end_date: formBkEnd,
            price: priceNum,
            status: formBkStatus,
            income_recorded: 0,
            notes: formBkNotes,
          })
          setNotification(
            'Vuokravaraus tallennettu! Kirjaa tulo painamalla [Enter] listalla.',
          )
        } else {
          const existing = bookings.find((b) => b.id === editingId)
          updateBooking({
            id: editingId,
            property_id: formPropId,
            guest_name: formBkGuest,
            start_date: formBkStart,
            end_date: formBkEnd,
            price: priceNum,
            status: formBkStatus,
            income_recorded: existing?.income_recorded ?? 0,
            notes: formBkNotes,
          })
          setNotification('Varauksen tiedot päivitetty!')
        }
      } else if (formType === 'contact') {
        if (!formCoName.trim()) {
          setNotification('Virhe: Nimi ei voi olla tyhjä!')
          return
        }
        const payload = {
          name: formCoName,
          role: formCoRole,
          phone: formCoPhone,
          email: formCoEmail,
          notes: formCoNotes,
        }
        if (editingId === null) {
          addContact(payload)
          setNotification('Yhteystieto tallennettu!')
        } else {
          updateContact({ id: editingId, ...payload })
          setNotification('Yhteystiedon tiedot päivitetty!')
        }
      } else if (formType === 'document') {
        if (!formDocTitle.trim()) {
          setNotification('Virhe: Asiakirjan otsikko ei voi olla tyhjä!')
          return
        }
        if (formDocDate.trim() && !formDocDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          setNotification('Virhe: Päiväyksen muoto YYYY-MM-DD tai tyhjä!')
          return
        }
        const payload = {
          property_id: formPropId,
          doc_type: formDocType,
          title: formDocTitle,
          file_path: formDocPath,
          issued_date: formDocDate.trim(),
          notes: formDocNotes,
          linked_type: formDocLinkedType,
          linked_id: formDocLinkedType ? formDocLinkedId : 0,
        }
        if (editingId === null) {
          addDocument(payload)
          setNotification('Asiakirja tallennettu!')
        } else {
          updateDocument({ id: editingId, ...payload })
          setNotification('Asiakirjan tiedot päivitetty!')
        }
      } else if (formType === 'meter') {
        if (!formMtDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          setNotification('Virhe: Lukemapäivän muoto YYYY-MM-DD!')
          return
        }
        const readingNum = parseFloat(formMtReading)
        if (Number.isNaN(readingNum)) {
          setNotification('Virhe: Anna mittarilukema numerona!')
          return
        }
        const payload = {
          property_id: formPropId,
          meter_type: formMtType,
          reading: readingNum,
          reading_date: formMtDate,
          notes: formMtNotes,
        }
        if (editingId === null) {
          addMeterReading(payload)
          setNotification('Mittarilukema tallennettu!')
        } else {
          updateMeterReading({ id: editingId, ...payload })
          setNotification('Mittarilukema päivitetty!')
        }
      } else if (formType === 'bulk_sweep') {
        if (!formBulkDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          setNotification('Virhe: Nuohouspäivän muoto YYYY-MM-DD!')
          return
        }
        const next = advanceRecurrence(formBulkDate, 'yearly')
        let done = 0
        for (const f of formBulkFireplaces) {
          if (formBulkExcluded.includes(f.id)) continue
          updateFireplace({ ...f, last_sweep: formBulkDate, next_sweep: next })
          done++
        }
        setNotification(
          `Nuohous kirjattu ${done} tulisijalle/piipulle (${formBulkExcluded.length} jätettiin pois).`,
        )
      }
      setIsFormOpen(false)
      reloadData()
    } catch (e) {
      setNotification(`Tallennusvirhe: ${(e as Error).message}`)
    }
  }

  // Keyboard navigation
  useInput((input, key) => {
    if (isFormOpen) {
      if (key.escape) {
        setIsFormOpen(false)
        setNotification('Lomake peruutettu.')
        return
      }

      if (key.upArrow) {
        const maxField = currentMaxField()
        setActiveField((prev) => (prev > 0 ? prev - 1 : maxField))
        return
      }

      if (key.downArrow || key.tab) {
        const maxField = currentMaxField()
        setActiveField((prev) => (prev < maxField ? prev + 1 : 0))
        return
      }

      if (key.return) {
        const saveField = currentMaxField()
        if (activeField === saveField) {
          saveForm()
        } else {
          const maxField = currentMaxField()
          setActiveField((prev) => (prev < maxField ? prev + 1 : 0))
        }
        return
      }

      // Input changes
      if (formType === 'property') {
        // 0:Nimi 1:Tunnus 2:Vesilähde 3:Vuosi 4:Sijainti 5:Saunatyyppi 6:Saunatieto 7:Kiinteistövero 8:Tiekunta 9:Tallenna
        if (activeField === 0) {
          if (key.backspace) setFormPropName((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormPropName((prev) => prev + input)
          }
        } else if (activeField === 1) {
          if (key.backspace) setFormPropTunnus((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormPropTunnus((prev) => prev + input)
          }
        } else if (activeField === 2) {
          // Selector well/mains
          if (key.leftArrow || key.rightArrow || input === ' ') {
            setFormPropWater((prev) => (prev === 'well' ? 'mains' : 'well'))
          }
        } else if (activeField === 3) {
          if (key.backspace) setFormPropYear((prev) => prev.slice(0, -1))
          else if (/[0-9]/.test(input) && input.length === 1) {
            setFormPropYear((prev) => prev + input)
          }
        } else if (activeField === 4) {
          if (key.backspace) setFormPropLoc((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormPropLoc((prev) => prev + input)
          }
        } else if (activeField === 5) {
          if (key.leftArrow || key.rightArrow || input === ' ') {
            const idx = SAUNA_TYPES.indexOf(formPropSaunaType)
            if (key.rightArrow || input === ' ')
              setFormPropSaunaType(SAUNA_TYPES[(idx + 1) % SAUNA_TYPES.length]!)
            else
              setFormPropSaunaType(
                SAUNA_TYPES[
                  (idx - 1 + SAUNA_TYPES.length) % SAUNA_TYPES.length
                ]!,
              )
          }
        } else if (activeField === 6) {
          if (key.backspace) setFormPropSaunaInfo((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormPropSaunaInfo((prev) => prev + input)
          }
        } else if (activeField === 7) {
          if (key.backspace) setFormPropTax((prev) => prev.slice(0, -1))
          else if (/[0-9.]/.test(input) && input.length === 1)
            setFormPropTax((prev) => prev + input)
        } else if (activeField === 8) {
          if (key.backspace) setFormPropRoadFee((prev) => prev.slice(0, -1))
          else if (/[0-9.]/.test(input) && input.length === 1)
            setFormPropRoadFee((prev) => prev + input)
        } else {
          // Vaihe 7: liittymät & jätehuolto (kentät 9–16)
          const txt =
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          const tgl = key.leftArrow || key.rightArrow || input === ' '
          if (activeField === 9) {
            if (key.backspace) setFormPropElecFuse((p) => p.slice(0, -1))
            else if (txt) setFormPropElecFuse((p) => p + input)
          } else if (activeField === 10) {
            if (key.backspace) setFormPropWaterConn((p) => p.slice(0, -1))
            else if (txt) setFormPropWaterConn((p) => p + input)
          } else if (activeField === 11) {
            if (key.backspace) setFormPropWasteProvider((p) => p.slice(0, -1))
            else if (txt) setFormPropWasteProvider((p) => p + input)
          } else if (activeField === 12) {
            if (key.backspace) setFormPropWasteBin((p) => p.slice(0, -1))
            else if (txt) setFormPropWasteBin((p) => p + input)
          } else if (activeField === 13) {
            if (key.backspace) setFormPropWasteInterval((p) => p.slice(0, -1))
            else if (txt) setFormPropWasteInterval((p) => p + input)
          } else if (activeField === 14) {
            if (tgl) {
              const i = BIOWASTE_OPTIONS.indexOf(formPropBiowaste)
              if (key.rightArrow || input === ' ')
                setFormPropBiowaste(
                  BIOWASTE_OPTIONS[(i + 1) % BIOWASTE_OPTIONS.length]!,
                )
              else
                setFormPropBiowaste(
                  BIOWASTE_OPTIONS[
                    (i - 1 + BIOWASTE_OPTIONS.length) % BIOWASTE_OPTIONS.length
                  ]!,
                )
            }
          } else if (activeField === 15) {
            if (tgl) setFormPropCompostReg((p) => (p ? 0 : 1))
          } else if (activeField === 16) {
            if (key.backspace) setFormPropCompostDate((p) => p.slice(0, -1))
            else if (/[0-9-]/.test(input) && input.length === 1)
              setFormPropCompostDate((p) => p + input)
          }
        }
      } else if (formType === 'bulk_sweep') {
        // 0:kohde 1:nuohouspäivä 2..(2+N-1):tulisijakohtainen nuohottu/ei-toggle
        if (activeField === 0) {
          if (key.leftArrow || key.rightArrow) {
            const idx = properties.findIndex((p) => p.id === formPropId)
            const ni = key.rightArrow
              ? (idx + 1) % properties.length
              : (idx - 1 + properties.length) % properties.length
            const np = properties[ni]!.id
            setFormPropId(np)
            setFormBulkFireplaces(getFireplaces(np))
            setFormBulkExcluded([])
          }
        } else if (activeField === 1) {
          if (key.backspace) setFormBulkDate((p) => p.slice(0, -1))
          else if (/[0-9-]/.test(input) && input.length === 1)
            setFormBulkDate((p) => p + input)
        } else {
          const fpIdx = activeField - 2
          const fp = formBulkFireplaces[fpIdx]
          if (fp && (key.leftArrow || key.rightArrow || input === ' ')) {
            setFormBulkExcluded((prev) =>
              prev.includes(fp.id)
                ? prev.filter((x) => x !== fp.id)
                : [...prev, fp.id],
            )
          }
        }
      } else if (formType === 'task') {
        if (activeField === 0) {
          if (key.leftArrow || key.rightArrow) {
            const idx = properties.findIndex((p) => p.id === formPropId)
            if (key.rightArrow) {
              const nextIdx = idx < properties.length - 1 ? idx + 1 : 0
              setFormPropId(properties[nextIdx]!.id)
            } else {
              const prevIdx = idx > 0 ? idx - 1 : properties.length - 1
              setFormPropId(properties[prevIdx]!.id)
            }
          }
        } else if (activeField === 1) {
          if (key.backspace) setFormTitle((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormTitle((prev) => prev + input)
          }
        } else if (activeField === 2) {
          if (key.backspace) setFormCategory((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormCategory((prev) => prev + input)
          }
        } else if (activeField === 3) {
          if (key.leftArrow || key.rightArrow || input === ' ') {
            const priorities: Task['priority'][] = ['low', 'medium', 'high']
            const curIdx = priorities.indexOf(formPriority)
            if (key.rightArrow || input === ' ') {
              const nextIdx = curIdx < 2 ? curIdx + 1 : 0
              setFormPriority(priorities[nextIdx]!)
            } else {
              const prevIdx = curIdx > 0 ? curIdx - 1 : 2
              setFormPriority(priorities[prevIdx]!)
            }
          }
        } else if (activeField === 4) {
          if (key.backspace) setFormCost((prev) => prev.slice(0, -1))
          else if (/[0-9.]/.test(input) && input.length === 1) {
            setFormCost((prev) => prev + input)
          }
        } else if (activeField === 5) {
          // Toistuvuuden valitsin
          if (key.leftArrow || key.rightArrow || input === ' ') {
            const idx = RECURRENCE_OPTIONS.indexOf(formRecurrence)
            if (key.rightArrow || input === ' ')
              setFormRecurrence(
                RECURRENCE_OPTIONS[(idx + 1) % RECURRENCE_OPTIONS.length]!,
              )
            else
              setFormRecurrence(
                RECURRENCE_OPTIONS[
                  (idx - 1 + RECURRENCE_OPTIONS.length) %
                    RECURRENCE_OPTIONS.length
                ]!,
              )
          }
        }
      } else if (formType === 'renovation') {
        // renovation form: 0:kohde 1:hankkeen nimi 2:tila 3:budjetti 4:kulutettu 5:aloituspvm 6:lopetuspvm 7:tallenna
        if (activeField === 0) {
          if (key.leftArrow || key.rightArrow) {
            const idx = properties.findIndex((p) => p.id === formPropId)
            if (key.rightArrow) {
              const nextIdx = idx < properties.length - 1 ? idx + 1 : 0
              setFormPropId(properties[nextIdx]!.id)
            } else {
              const prevIdx = idx > 0 ? idx - 1 : properties.length - 1
              setFormPropId(properties[prevIdx]!.id)
            }
          }
        } else if (activeField === 1) {
          if (key.backspace) setFormRenName((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormRenName((prev) => prev + input)
          }
        } else if (activeField === 2) {
          if (key.leftArrow || key.rightArrow || input === ' ') {
            const statuses: Renovation['status'][] = [
              'planning',
              'in_progress',
              'completed',
            ]
            const curIdx = statuses.indexOf(formRenStatus)
            if (key.rightArrow || input === ' ') {
              setFormRenStatus(statuses[(curIdx + 1) % statuses.length]!)
            } else {
              setFormRenStatus(
                statuses[(curIdx - 1 + statuses.length) % statuses.length]!,
              )
            }
          }
        } else if (activeField === 3) {
          if (key.backspace) setFormRenBudget((prev) => prev.slice(0, -1))
          else if (/[0-9.]/.test(input) && input.length === 1) {
            setFormRenBudget((prev) => prev + input)
          }
        } else if (activeField === 4) {
          if (key.backspace) setFormRenSpent((prev) => prev.slice(0, -1))
          else if (/[0-9.]/.test(input) && input.length === 1) {
            setFormRenSpent((prev) => prev + input)
          }
        } else if (activeField === 5) {
          if (key.backspace) setFormRenStartDate((prev) => prev.slice(0, -1))
          else if (/[0-9-]/.test(input) && input.length === 1) {
            setFormRenStartDate((prev) => prev + input)
          }
        } else if (activeField === 6) {
          if (key.backspace) setFormRenEndDate((prev) => prev.slice(0, -1))
          else if (/[0-9-]/.test(input) && input.length === 1) {
            setFormRenEndDate((prev) => prev + input)
          }
        }
      } else if (formType === 'tool') {
        // tool form: 0:laite/työkalu 1:kuntotila 2:sijaintipaikka 3:hankintapvm 4:tallenna
        if (activeField === 0) {
          if (key.backspace) setFormToolName((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormToolName((prev) => prev + input)
          }
        } else if (activeField === 1) {
          if (key.leftArrow || key.rightArrow || input === ' ') {
            const statuses: Tool['status'][] = [
              'working',
              'needs_repair',
              'lost',
            ]
            const curIdx = statuses.indexOf(formToolStatus)
            if (key.rightArrow || input === ' ') {
              setFormToolStatus(statuses[(curIdx + 1) % statuses.length]!)
            } else {
              setFormToolStatus(
                statuses[(curIdx - 1 + statuses.length) % statuses.length]!,
              )
            }
          }
        } else if (activeField === 2) {
          if (key.backspace) setFormToolLocation((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormToolLocation((prev) => prev + input)
          }
        } else if (activeField === 3) {
          if (key.backspace)
            setFormToolPurchaseDate((prev) => prev.slice(0, -1))
          else if (/[0-9-]/.test(input) && input.length === 1) {
            setFormToolPurchaseDate((prev) => prev + input)
          }
        }
      } else if (formType === 'transaction') {
        // transaction form: 0:kohde 1:tyyppi 2:kategoria 3:summa 4:selite 5:tallenna
        if (activeField === 0) {
          if (key.leftArrow || key.rightArrow) {
            const idx = properties.findIndex((p) => p.id === formPropId)
            if (key.rightArrow) {
              const nextIdx = idx < properties.length - 1 ? idx + 1 : 0
              setFormPropId(properties[nextIdx]!.id)
            } else {
              const prevIdx = idx > 0 ? idx - 1 : properties.length - 1
              setFormPropId(properties[prevIdx]!.id)
            }
          }
        } else if (activeField === 1) {
          if (key.leftArrow || key.rightArrow || input === ' ') {
            setFormTxType((prev) => (prev === 'expense' ? 'income' : 'expense'))
          }
        } else if (activeField === 2) {
          if (key.backspace) setFormCategory((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormCategory((prev) => prev + input)
          }
        } else if (activeField === 3) {
          if (key.backspace) setFormTxAmount((prev) => prev.slice(0, -1))
          else if (/[0-9.]/.test(input) && input.length === 1) {
            setFormTxAmount((prev) => prev + input)
          }
        } else if (activeField === 4) {
          if (key.backspace) setFormTxDesc((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormTxDesc((prev) => prev + input)
          }
        }
      } else if (formType === 'utility') {
        // utility form: 0:kohde 1:laskutyyppi 2:toimittaja 3:summa 4:kulutus 5:kausi 6:tallenna
        const UTIL_TYPES: Utility['type'][] = [
          'electric_siirto',
          'electric_energia',
          'water',
          'waste',
          'gas',
          'internet',
        ]
        if (activeField === 0) {
          if (key.leftArrow || key.rightArrow) {
            const idx = properties.findIndex((p) => p.id === formPropId)
            if (key.rightArrow)
              setFormPropId(
                properties[Math.min(idx + 1, properties.length - 1)]!.id,
              )
            else setFormPropId(properties[Math.max(idx - 1, 0)]!.id)
          }
        } else if (activeField === 1) {
          if (key.leftArrow || key.rightArrow || input === ' ') {
            const idx = UTIL_TYPES.indexOf(formUtilType)
            if (key.rightArrow || input === ' ')
              setFormUtilType(UTIL_TYPES[(idx + 1) % UTIL_TYPES.length]!)
            else
              setFormUtilType(
                UTIL_TYPES[(idx - 1 + UTIL_TYPES.length) % UTIL_TYPES.length]!,
              )
          }
        } else if (activeField === 2) {
          if (key.backspace) setFormUtilProvider((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          )
            setFormUtilProvider((prev) => prev + input)
        } else if (activeField === 3) {
          if (key.backspace) setFormUtilAmount((prev) => prev.slice(0, -1))
          else if (/[0-9.]/.test(input) && input.length === 1)
            setFormUtilAmount((prev) => prev + input)
        } else if (activeField === 4) {
          if (key.backspace) setFormUtilUsage((prev) => prev.slice(0, -1))
          else if (/[0-9.]/.test(input) && input.length === 1)
            setFormUtilUsage((prev) => prev + input)
        } else if (activeField === 5) {
          if (key.backspace) setFormUtilMonth((prev) => prev.slice(0, -1))
          else if (/[0-9-]/.test(input) && input.length === 1)
            setFormUtilMonth((prev) => prev + input)
        }
      } else if (formType === 'insurance') {
        // insurance form: 0:kohde 1:nimi 2:yhtiö 3:maksu (€) 4:uusimispvm 5:kattavuus 6:tallenna
        if (activeField === 0) {
          if (key.leftArrow || key.rightArrow) {
            const idx = properties.findIndex((p) => p.id === formPropId)
            if (key.rightArrow)
              setFormPropId(
                properties[Math.min(idx + 1, properties.length - 1)]!.id,
              )
            else setFormPropId(properties[Math.max(idx - 1, 0)]!.id)
          }
        } else if (activeField === 1) {
          if (key.backspace) setFormInsPolicyName((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormInsPolicyName((prev) => prev + input)
          }
        } else if (activeField === 2) {
          if (key.backspace) setFormInsProvider((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormInsProvider((prev) => prev + input)
          }
        } else if (activeField === 3) {
          if (key.backspace) setFormInsPremium((prev) => prev.slice(0, -1))
          else if (/[0-9.]/.test(input) && input.length === 1)
            setFormInsPremium((prev) => prev + input)
        } else if (activeField === 4) {
          if (key.backspace) setFormInsRenewalDate((prev) => prev.slice(0, -1))
          else if (/[0-9-]/.test(input) && input.length === 1)
            setFormInsRenewalDate((prev) => prev + input)
        } else if (activeField === 5) {
          if (key.backspace)
            setFormInsCoverageDetails((prev) => prev.slice(0, -1))
          else if (
            input.length === 1 &&
            input !== '\r' &&
            input !== '\n' &&
            input !== '\t'
          ) {
            setFormInsCoverageDetails((prev) => prev + input)
          }
        }
      } else {
        // Vaihe 1b -lomakkeet (tulisija, jätevesi, lämmitys, vesitutkimus).
        // Yhteiset apurit vähentävät toistoa.
        const isText =
          input.length === 1 &&
          input !== '\r' &&
          input !== '\n' &&
          input !== '\t'
        const isDateChar = /[0-9-]/.test(input) && input.length === 1
        const cycleProp = () => {
          const idx = properties.findIndex((p) => p.id === formPropId)
          if (key.rightArrow)
            setFormPropId(
              properties[Math.min(idx + 1, properties.length - 1)]!.id,
            )
          else setFormPropId(properties[Math.max(idx - 1, 0)]!.id)
        }
        const cycleEnum = <T,>(opts: T[], cur: T, set: (v: T) => void) => {
          const idx = opts.indexOf(cur)
          if (key.rightArrow || input === ' ')
            set(opts[(idx + 1) % opts.length]!)
          else set(opts[(idx - 1 + opts.length) % opts.length]!)
        }
        const editText = (
          set: React.Dispatch<React.SetStateAction<string>>,
        ) => {
          if (key.backspace) set((prev) => prev.slice(0, -1))
          else if (isText) set((prev) => prev + input)
        }
        const editDate = (
          set: React.Dispatch<React.SetStateAction<string>>,
        ) => {
          if (key.backspace) set((prev) => prev.slice(0, -1))
          else if (isDateChar) set((prev) => prev + input)
        }
        const editNum = (set: React.Dispatch<React.SetStateAction<string>>) => {
          if (key.backspace) set((prev) => prev.slice(0, -1))
          else if (/[0-9.]/.test(input) && input.length === 1)
            set((prev) => prev + input)
        }

        if (formType === 'fireplace') {
          // 0:kohde 1:tyyppi 2:nimi 3:nuohottu 4:seuraava 5:nuohooja
          if (activeField === 0) {
            if (key.leftArrow || key.rightArrow) cycleProp()
          } else if (activeField === 1) {
            if (key.leftArrow || key.rightArrow || input === ' ')
              cycleEnum(FIREPLACE_TYPES, formFpType, setFormFpType)
          } else if (activeField === 2) editText(setFormFpName)
          else if (activeField === 3) editDate(setFormFpLastSweep)
          else if (activeField === 4) editDate(setFormFpNextSweep)
          else if (activeField === 5) editText(setFormFpSweeper)
        } else if (formType === 'wastewater') {
          // 0:kohde 1:tyyppi 2:rakennusvuosi 3:ranta 4:pohjavesi 5:wc 6:vapautus 7:lupa 8:tyhjennetty 9:seuraava 10:palvelu
          const toggle = key.leftArrow || key.rightArrow || input === ' '
          if (activeField === 0) {
            if (key.leftArrow || key.rightArrow) cycleProp()
          } else if (activeField === 1) {
            if (toggle) cycleEnum(WASTEWATER_TYPES, formWwType, setFormWwType)
          } else if (activeField === 2) editNum(setFormWwBuildYear)
          else if (activeField === 3) {
            if (toggle) setFormWwShoreline((p) => (p ? 0 : 1))
          } else if (activeField === 4) {
            if (toggle) setFormWwGroundwater((p) => (p ? 0 : 1))
          } else if (activeField === 5) {
            if (toggle) setFormWwHasWc((p) => (p ? 0 : 1))
          } else if (activeField === 6) {
            if (toggle) setFormWwExemption((p) => (p ? 0 : 1))
          } else if (activeField === 7) editText(setFormWwPermit)
          else if (activeField === 8) editDate(setFormWwLastEmptied)
          else if (activeField === 9) editDate(setFormWwNextEmptied)
          else if (activeField === 10) editText(setFormWwProvider)
        } else if (formType === 'heating') {
          // 0:kohde 1:tyyppi 2:kuvaus 3:tarkastettu 4:seuraava
          if (activeField === 0) {
            if (key.leftArrow || key.rightArrow) cycleProp()
          } else if (activeField === 1) {
            if (key.leftArrow || key.rightArrow || input === ' ')
              cycleEnum(HEATING_TYPES, formHtType, setFormHtType)
          } else if (activeField === 2) editText(setFormHtDesc)
          else if (activeField === 3) editDate(setFormHtLastInsp)
          else if (activeField === 4) editDate(setFormHtNextInsp)
        } else if (formType === 'water_test') {
          // 0:kohde 1:pvm 2:E.coli 3:koliformit 4:nitraatti 5:pH 6:rauta 7:fluoridi 8:läpäisy 9:huomiot
          if (activeField === 0) {
            if (key.leftArrow || key.rightArrow) cycleProp()
          } else if (activeField === 1) editDate(setFormWtDate)
          else if (activeField === 2) editText(setFormWtEcoli)
          else if (activeField === 3) editText(setFormWtColiforms)
          else if (activeField === 4) editText(setFormWtNitrate)
          else if (activeField === 5) editText(setFormWtPh)
          else if (activeField === 6) editText(setFormWtIron)
          else if (activeField === 7) editText(setFormWtFluoride)
          else if (activeField === 8) {
            if (key.leftArrow || key.rightArrow || input === ' ')
              setFormWtPassed((prev) => (prev === 1 ? 0 : 1))
          } else if (activeField === 9) editText(setFormWtNotes)
        } else if (formType === 'firewood') {
          // 0:kohde 1:puulaji 2:määrä 3:yksikkö 4:sijainti 5:kuivumisaste 6:pinottu 7:huomiot
          if (activeField === 0) {
            if (key.leftArrow || key.rightArrow) cycleProp()
          } else if (activeField === 1) {
            if (key.leftArrow || key.rightArrow || input === ' ')
              cycleEnum(WOOD_TYPES, formFwWoodType, setFormFwWoodType)
          } else if (activeField === 2) editNum(setFormFwVolume)
          else if (activeField === 3) {
            if (key.leftArrow || key.rightArrow || input === ' ')
              cycleEnum(FIREWOOD_UNITS, formFwUnit, setFormFwUnit)
          } else if (activeField === 4) editText(setFormFwLocation)
          else if (activeField === 5) {
            if (key.leftArrow || key.rightArrow || input === ' ')
              cycleEnum(DRYING_STATES, formFwDrying, setFormFwDrying)
          } else if (activeField === 6) editDate(setFormFwStacked)
          else if (activeField === 7) editText(setFormFwNotes)
        } else if (formType === 'booking') {
          // 0:kohde 1:varaaja 2:saapuminen 3:lähtö 4:hinta 5:tila 6:huomiot
          if (activeField === 0) {
            if (key.leftArrow || key.rightArrow) cycleProp()
          } else if (activeField === 1) editText(setFormBkGuest)
          else if (activeField === 2) editDate(setFormBkStart)
          else if (activeField === 3) editDate(setFormBkEnd)
          else if (activeField === 4) editNum(setFormBkPrice)
          else if (activeField === 5) {
            if (key.leftArrow || key.rightArrow || input === ' ')
              cycleEnum(BOOKING_STATUSES, formBkStatus, setFormBkStatus)
          } else if (activeField === 6) editText(setFormBkNotes)
        } else if (formType === 'contact') {
          // 0:nimi 1:rooli 2:puhelin 3:email 4:huomiot  (globaali — ei kohdevalitsinta)
          if (activeField === 0) editText(setFormCoName)
          else if (activeField === 1) {
            if (key.leftArrow || key.rightArrow || input === ' ')
              cycleEnum(CONTACT_ROLES, formCoRole, setFormCoRole)
          } else if (activeField === 2) editText(setFormCoPhone)
          else if (activeField === 3) editText(setFormCoEmail)
          else if (activeField === 4) editText(setFormCoNotes)
        } else if (formType === 'document') {
          // 0:kohde 1:tyyppi 2:otsikko 3:polku 4:pvm 5:huomiot 6:linkitystyyppi 7:linkitetty tietue
          if (activeField === 0) {
            if (key.leftArrow || key.rightArrow) cycleProp()
          } else if (activeField === 1) {
            if (key.leftArrow || key.rightArrow || input === ' ')
              cycleEnum(DOC_TYPES, formDocType, setFormDocType)
          } else if (activeField === 2) editText(setFormDocTitle)
          else if (activeField === 3) editText(setFormDocPath)
          else if (activeField === 4) editDate(setFormDocDate)
          else if (activeField === 5) editText(setFormDocNotes)
          else if (activeField === 6) {
            if (key.leftArrow || key.rightArrow || input === ' ') {
              const i = DOC_LINK_TYPES.indexOf(formDocLinkedType)
              const next =
                key.rightArrow || input === ' '
                  ? DOC_LINK_TYPES[(i + 1) % DOC_LINK_TYPES.length]!
                  : DOC_LINK_TYPES[
                      (i - 1 + DOC_LINK_TYPES.length) % DOC_LINK_TYPES.length
                    ]!
              setFormDocLinkedType(next)
              setFormDocLinkedId(linkCandidates(next, formPropId)[0]?.id ?? 0) // valitse ensimmäinen ehdokas
            }
          } else if (activeField === 7) {
            if (key.leftArrow || key.rightArrow) {
              const cands = linkCandidates(formDocLinkedType, formPropId)
              if (cands.length > 0) {
                const i = Math.max(
                  0,
                  cands.findIndex((c) => c.id === formDocLinkedId),
                )
                const ni = key.rightArrow
                  ? (i + 1) % cands.length
                  : (i - 1 + cands.length) % cands.length
                setFormDocLinkedId(cands[ni]!.id)
              }
            }
          }
        } else if (formType === 'meter') {
          // 0:kohde 1:mittarityyppi 2:lukema 3:pvm 4:huomiot
          if (activeField === 0) {
            if (key.leftArrow || key.rightArrow) cycleProp()
          } else if (activeField === 1) {
            if (key.leftArrow || key.rightArrow || input === ' ')
              cycleEnum(METER_TYPES, formMtType, setFormMtType)
          } else if (activeField === 2) editNum(setFormMtReading)
          else if (activeField === 3) editDate(setFormMtDate)
          else if (activeField === 4) editText(setFormMtNotes)
        }
      }
      return
    }

    // Default TUI keys
    if (input === 'q') {
      exit()
      return
    }

    if (input === 'p') {
      cycleProperty()
      return
    }

    if (input === 'n' && activeTab === 'compliance') {
      openBulkSweep()
      return
    }

    if (input === 'a') {
      openAddForm()
      return
    }

    if (input === 'e') {
      openEditForm()
      return
    }

    if (input === 'd') {
      triggerDelete()
      return
    }

    // Tabs
    if (input === '1') {
      setActiveTab('overview')
      setSelectedTaskIndex(0)
      setSelectedTxIndex(0)
      setSelectedRenovationIndex(0)
    }
    if (input === '2') {
      setActiveTab('tasks')
      setSelectedTaskIndex(0)
    }
    if (input === '3') {
      setActiveTab('renovations')
      setSelectedTxIndex(0)
      setSelectedRenovationIndex(0)
    }
    if (input === '4') {
      setActiveTab('utilities')
    }
    if (input === '5') {
      setActiveTab('tools')
    }
    if (input === '6') {
      setActiveTab('compliance')
      setSelectedComplianceIndex(0)
    }
    if (input === '7') {
      setActiveTab('firewood')
      setSelectedFirewoodIndex(0)
    }
    if (input === '8') {
      setActiveTab('seasonal')
      setSelectedBookingIndex(0)
    }
    if (input === '9') {
      setActiveTab('archive')
      setSelectedArchiveIndex(0)
    }

    // Nav list tasks
    if (activeTab === 'tasks' && tasks.length > 0) {
      if (key.upArrow) {
        setSelectedTaskIndex((prev) => (prev > 0 ? prev - 1 : tasks.length - 1))
      }
      if (key.downArrow) {
        setSelectedTaskIndex((prev) => (prev < tasks.length - 1 ? prev + 1 : 0))
      }

      if (key.return || input === ' ') {
        const currentTask = tasks[selectedTaskIndex]
        if (currentTask) {
          let nextStatus: Task['status'] = 'pending'
          if (currentTask.status === 'pending') nextStatus = 'in_progress'
          else if (currentTask.status === 'in_progress')
            nextStatus = 'completed'

          updateTaskStatus(currentTask.id, nextStatus)
          setNotification(
            `Tehtävä "${currentTask.title}" merkitty: [${nextStatus.toUpperCase()}]`,
          )
          reloadData()
        }
      }
    }

    // Nav list renovations & transactions (Tab 3)
    if (activeTab === 'renovations') {
      // ←/→ tai Tab vaihtaa fokuksen remonttilistan ja tapahtumalistan välillä,
      // ↑/↓ selaa kulloinkin fokusoitua listaa.
      if (key.leftArrow || key.rightArrow || key.tab) {
        setFocusedRenList((prev) =>
          prev === 'renovations' ? 'transactions' : 'renovations',
        )
        setNotification(
          focusedRenList === 'renovations'
            ? 'Valittu tapahtumalista. ↑/↓ selaa | [a] lisää | [e] muokkaa | [d] poista'
            : 'Valittu remonttilista. ↑/↓ selaa | [a] lisää | [e] muokkaa | [d] poista',
        )
        return
      }
      if (focusedRenList === 'transactions' && transactions.length > 0) {
        if (key.upArrow) {
          setSelectedTxIndex((prev) =>
            prev > 0 ? prev - 1 : transactions.length - 1,
          )
        }
        if (key.downArrow) {
          setSelectedTxIndex((prev) =>
            prev < transactions.length - 1 ? prev + 1 : 0,
          )
        }
      } else if (focusedRenList === 'renovations' && renovations.length > 0) {
        if (key.upArrow) {
          setSelectedRenovationIndex((prev) =>
            prev > 0 ? prev - 1 : renovations.length - 1,
          )
        }
        if (key.downArrow) {
          setSelectedRenovationIndex((prev) =>
            prev < renovations.length - 1 ? prev + 1 : 0,
          )
        }
      }
    }

    // Nav utilities list
    if (activeTab === 'utilities' && utilities.length > 0) {
      if (key.upArrow) {
        setSelectedUtilIndex((prev) =>
          prev > 0 ? prev - 1 : utilities.length - 1,
        )
      }
      if (key.downArrow) {
        setSelectedUtilIndex((prev) =>
          prev < utilities.length - 1 ? prev + 1 : 0,
        )
      }
    }

    // Nav tools/insurance lists — ←/→ tai Tab vaihtaa fokuksen, ↑/↓ selaa fokusoitua listaa.
    if (activeTab === 'tools') {
      if (key.leftArrow) {
        setFocusedToolList('tools')
        setNotification(
          'Valittu kalustolista. ↑/↓ selaa | [a] lisää | [e] muokkaa | [d] poista',
        )
        return
      }
      if (key.rightArrow) {
        setFocusedToolList('insurance')
        setNotification(
          'Valittu vakuutuslista. ↑/↓ selaa | [a] lisää | [e] muokkaa | [d] poista',
        )
        return
      }
      if (key.tab) {
        setFocusedToolList((prev) => (prev === 'tools' ? 'insurance' : 'tools'))
        return
      }
      if (focusedToolList === 'insurance') {
        if (key.upArrow && insurance.length > 0) {
          setSelectedInsuranceIndex((prev) =>
            prev > 0 ? prev - 1 : insurance.length - 1,
          )
        }
        if (key.downArrow && insurance.length > 0) {
          setSelectedInsuranceIndex((prev) =>
            prev < insurance.length - 1 ? prev + 1 : 0,
          )
        }
      } else {
        if (key.upArrow && tools.length > 0) {
          setSelectedToolIndex((prev) =>
            prev > 0 ? prev - 1 : tools.length - 1,
          )
        }
        if (key.downArrow && tools.length > 0) {
          setSelectedToolIndex((prev) =>
            prev < tools.length - 1 ? prev + 1 : 0,
          )
        }
      }
    }

    // Nav compliance registries (Tab 6) — Tab/←/→ vaihtaa rekisteriä, ↑/↓ selaa fokusoitua listaa.
    if (activeTab === 'compliance') {
      const COMPLIANCE_NAMES: Record<ComplianceList, string> = {
        fireplaces: 'Tulisijat',
        wastewater: 'Jätevesi',
        heating: 'Lämmitys',
        water_tests: 'Kaivovesi',
      }
      const lengths: Record<ComplianceList, number> = {
        fireplaces: fireplaces.length,
        wastewater: wastewaterSystems.length,
        heating: heatingSystems.length,
        water_tests: waterTests.length,
      }
      if (key.leftArrow || key.rightArrow || key.tab) {
        const idx = COMPLIANCE_LISTS.indexOf(focusedComplianceList)
        const nextList = key.leftArrow
          ? COMPLIANCE_LISTS[
              (idx - 1 + COMPLIANCE_LISTS.length) % COMPLIANCE_LISTS.length
            ]!
          : COMPLIANCE_LISTS[(idx + 1) % COMPLIANCE_LISTS.length]!
        setFocusedComplianceList(nextList)
        setSelectedComplianceIndex(0)
        setNotification(
          `Valittu rekisteri: ${COMPLIANCE_NAMES[nextList]}. ↑/↓ selaa | [a] lisää | [e] muokkaa | [d] poista`,
        )
        return
      }
      const len = lengths[focusedComplianceList]
      if (key.upArrow && len > 0)
        setSelectedComplianceIndex((prev) => (prev > 0 ? prev - 1 : len - 1))
      if (key.downArrow && len > 0)
        setSelectedComplianceIndex((prev) => (prev < len - 1 ? prev + 1 : 0))
    }

    // Nav firewood list (Tab 7)
    if (activeTab === 'firewood' && firewood.length > 0) {
      if (key.upArrow)
        setSelectedFirewoodIndex((prev) =>
          prev > 0 ? prev - 1 : firewood.length - 1,
        )
      if (key.downArrow)
        setSelectedFirewoodIndex((prev) =>
          prev < firewood.length - 1 ? prev + 1 : 0,
        )
    }

    // Nav & actions on the rental/seasonal tab (Tab 8)
    if (activeTab === 'seasonal') {
      if (input === 'k') {
        generateSeasonalChecklist('spring')
        return
      }
      if (input === 's') {
        generateSeasonalChecklist('autumn')
        return
      }
      if (key.return) {
        recordBookingIncome()
        return
      }
      if (bookings.length > 0) {
        if (key.upArrow)
          setSelectedBookingIndex((prev) =>
            prev > 0 ? prev - 1 : bookings.length - 1,
          )
        if (key.downArrow)
          setSelectedBookingIndex((prev) =>
            prev < bookings.length - 1 ? prev + 1 : 0,
          )
      }
    }

    // Nav archive registries (Tab 9) — Tab/←/→ vaihtaa rekisteriä, ↑/↓ selaa fokusoitua listaa.
    if (activeTab === 'archive') {
      // [o] avaa valitun asiakirjan tiedoston käyttöjärjestelmällä.
      if (input === 'o' && focusedArchiveList === 'documents') {
        const d = documents[selectedArchiveIndex]
        if (!d) {
          setNotification('Valitse asiakirja listalta.')
          return
        }
        if (!d.file_path.trim()) {
          setNotification('Asiakirjalla ei ole tiedostopolkua.')
          return
        }
        setNotification(
          openFileWithOS(d.file_path)
            ? `Avataan: ${d.file_path}`
            : `Tiedoston avaus epäonnistui: ${d.file_path}`,
        )
        return
      }
      const NAMES: Record<ArchiveList, string> = {
        contacts: 'Yhteystiedot',
        documents: 'Asiakirjat',
        meters: 'Mittarilukemat',
      }
      const lengths: Record<ArchiveList, number> = {
        contacts: contacts.length,
        documents: documents.length,
        meters: meterReadings.length,
      }
      if (key.leftArrow || key.rightArrow || key.tab) {
        const idx = ARCHIVE_LISTS.indexOf(focusedArchiveList)
        const next = key.leftArrow
          ? ARCHIVE_LISTS[
              (idx - 1 + ARCHIVE_LISTS.length) % ARCHIVE_LISTS.length
            ]!
          : ARCHIVE_LISTS[(idx + 1) % ARCHIVE_LISTS.length]!
        setFocusedArchiveList(next)
        setSelectedArchiveIndex(0)
        setNotification(
          `Valittu rekisteri: ${NAMES[next]}. ↑/↓ selaa | [a] lisää | [e] muokkaa | [d] poista`,
        )
        return
      }
      const len = lengths[focusedArchiveList]
      if (key.upArrow && len > 0)
        setSelectedArchiveIndex((prev) => (prev > 0 ? prev - 1 : len - 1))
      if (key.downArrow && len > 0)
        setSelectedArchiveIndex((prev) => (prev < len - 1 ? prev + 1 : 0))
    }
  })

  // Dimensions
  const termWidth = columns || 95
  const layoutWidth = Math.min(140, termWidth)
  const isWide = layoutWidth >= 90
  const halfWidth = Math.floor(layoutWidth / 2) - 1

  // Helpers
  const getSelectedPropertyName = () => {
    if (selectedPropertyId === null) return 'Kaikki kiinteistöt'
    const p = properties.find((p) => p.id === selectedPropertyId)
    return p ? p.name : 'Unknown'
  }

  const activeProp = properties.find((p) => p.id === selectedPropertyId)

  // Render Header
  const renderHeader = () => {
    const waterSourceLabel =
      activeProp?.water_source === 'well' ? 'Oma kaivo' : 'Kunnan vesiliittymä'

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box
          justifyContent="space-between"
          paddingX={1}
          borderStyle="single"
          borderColor="#8A2BE2"
        >
          <Text bold color="#A29BFE">
            🏠 KIINTEISTÖVAHTI
          </Text>
          <Text color="#6C5CE7">Hirsitalojen ylläpitojärjestelmä</Text>
        </Box>
        <Box flexDirection="row" justifyContent="center" marginTop={1} gap={2}>
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.id
            const baseColor = TAB_COLORS[tab.id]
            return (
              <Box
                key={tab.id}
                borderStyle="round"
                borderColor={isSelected ? baseColor : '#555555'}
                paddingX={1}
              >
                <Text
                  bold={isSelected}
                  color={isSelected ? baseColor : '#888888'}
                >
                  {tab.label}
                </Text>
              </Box>
            )
          })}
        </Box>

        <Box
          flexDirection="row"
          justifyContent="space-between"
          borderStyle="double"
          borderColor="#2ECC71"
          paddingX={1}
          marginTop={1}
        >
          <Box flexDirection="row" gap={1}>
            <Text bold color="#2ECC71">
              VALITTU KOHDE:
            </Text>
            <Text bold color="#FFFFFF">
              {getSelectedPropertyName()}
            </Text>
          </Box>
          {activeProp && (
            <Box flexDirection="row" gap={2}>
              <Text color="#A29BFE">
                Kiinteistötunnus: {activeProp.kiinteistotunnus}
              </Text>
              <Text
                color={
                  activeProp.water_source === 'well' ? '#F1C40F' : '#3498DB'
                }
              >
                Vesijärjestelmä: {waterSourceLabel}
              </Text>
              <Text color="#888888">
                Rakennusvuosi: {activeProp.build_year}
              </Text>
            </Box>
          )}
          {!activeProp && (
            <Text color="#888888">
              Yhteenveto 3 hirsitalosta (2 kaivoa, 1 vesijohto)
            </Text>
          )}
        </Box>
      </Box>
    )
  }

  // Render Footer
  const renderFooter = () => {
    return (
      <Box flexDirection="column" marginTop={1}>
        {notification && (
          <Box borderStyle="single" borderColor="#FFB703" paddingX={1}>
            <Text bold color="#FFB703">
              ⚡ TILA:{' '}
            </Text>
            <Text color="#FFB703">{notification}</Text>
          </Box>
        )}
        <Box
          justifyContent="space-between"
          paddingX={1}
          borderStyle="single"
          borderColor="#555555"
          marginTop={1}
        >
          <Text color="#777777">
            [q] Poistu | [1-9] Välilehdet | [p] Vaihda kohde | [a] Lisää | [e]
            Muokkaa | [d] Poista
          </Text>
          <Text color="#777777">Tietokanta: SQLite (node:sqlite)</Text>
        </Box>
      </Box>
    )
  }

  // Render Form
  const renderForm = () => {
    const isEditing = editingId !== null

    // Kompaktit rivin apurit Vaiheen 1b -lomakkeille (väri = #00B894).
    const C = '#00B894'
    const propName =
      properties.find((p) => p.id === formPropId)?.name || 'Valitse nuolilla'
    const rowProp = (idx: number) => (
      <Box flexDirection="row" key={`f${idx}`}>
        <Box width={26}>
          <Text
            color={activeField === idx ? C : '#FFFFFF'}
            bold={activeField === idx}
          >
            {activeField === idx
              ? '➔ Kohde (Kiinteistö):'
              : '  Kohde (Kiinteistö):'}
          </Text>
        </Box>
        <Text color="#1ABC9C" bold>
          ◀ {propName} ▶
        </Text>
      </Box>
    )
    const rowSelect = (idx: number, label: string, value: string) => (
      <Box flexDirection="row" key={`f${idx}`}>
        <Box width={26}>
          <Text
            color={activeField === idx ? C : '#FFFFFF'}
            bold={activeField === idx}
          >
            {activeField === idx ? `➔ ${label}` : `  ${label}`}
          </Text>
        </Box>
        <Text color="#1ABC9C" bold>
          ◀ {value} ▶
        </Text>
      </Box>
    )
    const rowText = (
      idx: number,
      label: string,
      value: string,
      placeholder: string,
    ) => (
      <Box flexDirection="row" key={`f${idx}`}>
        <Box width={26}>
          <Text
            color={activeField === idx ? C : '#FFFFFF'}
            bold={activeField === idx}
          >
            {activeField === idx ? `➔ ${label}` : `  ${label}`}
          </Text>
        </Box>
        <Text color={activeField === idx ? '#FFFFFF' : '#999999'}>
          {value || chalk.gray(placeholder)}
          {activeField === idx && '█'}
        </Text>
      </Box>
    )
    const rowSave = (idx: number) => (
      <Box justifyContent="center" marginTop={1} key={`f${idx}`}>
        <Box
          borderStyle="single"
          borderColor={activeField === idx ? '#2ECC71' : '#555555'}
          paddingX={3}
        >
          <Text bold color={activeField === idx ? '#2ECC71' : '#888888'}>
            [ {isEditing ? 'TALLENNA MUUTOKSET' : 'TALLENNA UUSI'} ]
          </Text>
        </Box>
      </Box>
    )
    const formShell = (title: string, rows: React.ReactNode) => (
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={C}
        padding={1}
        marginY={1}
      >
        <Text bold color={C}>
          {isEditing ? `✏ MUOKKAA — ${title}` : `➕ LISÄÄ — ${title}`}
        </Text>
        <Text color="#888888" italic>
          Siirry ↑/↓ tai Tab, ◀/▶ vaihtaa valintaa. Peruuta [Esc].
        </Text>
        <Box flexDirection="column" marginTop={1} gap={1}>
          {rows}
        </Box>
      </Box>
    )

    if (formType === 'fireplace') {
      return formShell(
        'TULISIJA',
        <>
          {rowProp(0)}
          {rowSelect(1, 'Tulisijan tyyppi:', FIREPLACE_LABELS[formFpType])}
          {rowText(2, 'Nimi:', formFpName, 'esim. Olohuoneen takka')}
          {rowText(
            3,
            'Nuohottu (YYYY-MM-DD):',
            formFpLastSweep,
            '(tyhjä = ei tiedossa)',
          )}
          {rowText(4, 'Seuraava nuohous:', formFpNextSweep, '(YYYY-MM-DD)')}
          {rowText(
            5,
            'Nuohooja:',
            formFpSweeper,
            'esim. Sysmän nuohouspalvelu',
          )}
          {rowSave(6)}
        </>,
      )
    }

    if (formType === 'wastewater') {
      return formShell(
        'JÄTEVESIJÄRJESTELMÄ',
        <>
          {rowProp(0)}
          {rowSelect(1, 'Järjestelmätyyppi:', WASTEWATER_LABELS[formWwType])}
          {rowText(2, 'Rakennusvuosi:', formWwBuildYear, 'esim. 1973')}
          {rowSelect(
            3,
            'Ranta-alue (≤100 m):',
            formWwShoreline ? 'KYLLÄ' : 'EI',
          )}
          {rowSelect(4, 'Pohjavesialue:', formWwGroundwater ? 'KYLLÄ' : 'EI')}
          {rowSelect(
            5,
            'WC-vedet järjestelmään:',
            formWwHasWc ? 'KYLLÄ' : 'EI',
          )}
          {rowSelect(
            6,
            'Ikä-/vähäisyysvapautus:',
            formWwExemption ? 'KYLLÄ' : 'EI',
          )}
          {rowText(
            7,
            'Lupatiedot:',
            formWwPermit,
            'esim. lupa 2015, rakennusvalvonta',
          )}
          {rowText(
            8,
            'Tyhjennetty (YYYY-MM-DD):',
            formWwLastEmptied,
            '(tyhjä = ei tiedossa)',
          )}
          {rowText(9, 'Seuraava tyhjennys:', formWwNextEmptied, '(YYYY-MM-DD)')}
          {rowText(
            10,
            'Tyhjennyspalvelu:',
            formWwProvider,
            'esim. Lakeuden Loka',
          )}
          {rowSave(11)}
        </>,
      )
    }

    if (formType === 'heating') {
      return formShell(
        'LÄMMITYSJÄRJESTELMÄ',
        <>
          {rowProp(0)}
          {rowSelect(1, 'Lämmitysmuoto:', HEATING_LABELS[formHtType])}
          {rowText(
            2,
            'Kuvaus:',
            formHtDesc,
            'esim. 1500 l öljysäiliö kellarissa',
          )}
          {rowText(
            3,
            'Tarkastettu (YYYY-MM-DD):',
            formHtLastInsp,
            '(tyhjä = ei tiedossa)',
          )}
          {rowText(
            4,
            'Seuraava tarkastus:',
            formHtNextInsp,
            '(YYYY-MM-DD, esim. öljysäiliö)',
          )}
          {rowSave(5)}
        </>,
      )
    }

    if (formType === 'water_test') {
      return formShell(
        'KAIVOVESITUTKIMUS',
        <>
          {rowProp(0)}
          {rowText(1, 'Näytepäivä (YYYY-MM-DD):', formWtDate, '(YYYY-MM-DD)')}
          {rowText(2, 'E.coli:', formWtEcoli, 'esim. 0 pmy/100ml')}
          {rowText(3, 'Koliformit:', formWtColiforms, 'esim. 0 pmy/100ml')}
          {rowText(4, 'Nitraatti:', formWtNitrate, 'esim. 2.1 mg/l')}
          {rowText(5, 'pH:', formWtPh, 'esim. 6.8')}
          {rowText(6, 'Rauta:', formWtIron, 'esim. 0.05 mg/l')}
          {rowText(7, 'Fluoridi:', formWtFluoride, 'esim. 0.3 mg/l')}
          {rowSelect(
            8,
            'Läpäisi vaatimukset:',
            formWtPassed === 1 ? 'KYLLÄ' : 'EI',
          )}
          {rowText(
            9,
            'Huomiot:',
            formWtNotes,
            'esim. laboratorio, suositukset',
          )}
          {rowSave(10)}
        </>,
      )
    }

    if (formType === 'firewood') {
      return formShell(
        'POLTTOPUUERÄ',
        <>
          {rowProp(0)}
          {rowSelect(1, 'Puulaji:', formFwWoodType)}
          {rowText(2, 'Määrä:', formFwVolume, 'esim. 8')}
          {rowSelect(3, 'Yksikkö:', formFwUnit)}
          {rowText(4, 'Varastopaikka:', formFwLocation, 'esim. klapiliiteri')}
          {rowSelect(5, 'Kuivumisaste:', DRYING_LABELS[formFwDrying])}
          {rowText(
            6,
            'Pinottu (YYYY-MM-DD):',
            formFwStacked,
            '(tyhjä sallittu)',
          )}
          {rowText(7, 'Huomiot:', formFwNotes, 'esim. ostoklapit, saunapuut')}
          {rowSave(8)}
        </>,
      )
    }

    if (formType === 'booking') {
      const nights = bookingNights({
        start_date: formBkStart,
        end_date: formBkEnd,
      })
      return formShell(
        'VUOKRAVARAUS',
        <>
          {rowProp(0)}
          {rowText(1, 'Varaaja:', formBkGuest, 'esim. Virtanen')}
          {rowText(2, 'Saapuminen (YYYY-MM-DD):', formBkStart, '(YYYY-MM-DD)')}
          {rowText(
            3,
            `Lähtö (YYYY-MM-DD):${nights > 0 ? ` — ${nights} yötä` : ''}`,
            formBkEnd,
            '(YYYY-MM-DD)',
          )}
          {rowText(4, 'Hinta yhteensä (€):', formBkPrice, 'esim. 285')}
          {rowSelect(5, 'Tila:', BOOKING_STATUS_LABELS[formBkStatus])}
          {rowText(6, 'Huomiot:', formBkNotes, 'esim. juhannus, koko perhe')}
          {rowSave(7)}
        </>,
      )
    }

    if (formType === 'bulk_sweep') {
      const saveIdx = formBulkFireplaces.length + 2
      return (
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="#E67E22"
          padding={1}
          marginY={1}
        >
          <Text bold color="#E67E22">
            🔥 KOKO KIINTEISTÖN NUOHOUS
          </Text>
          <Text color="#888888" italic>
            Merkitse nuohouspäivä kaikille kiinteistön tulisijoille/piipuille
            kerralla. Jätä tarvittaessa yksittäisiä pois (◀/▶ tai välilyönti).
            Peruuta [Esc].
          </Text>
          <Box flexDirection="column" marginTop={1} gap={1}>
            {rowProp(0)}
            {rowText(
              1,
              'Nuohouspäivä (YYYY-MM-DD):',
              formBulkDate,
              '(YYYY-MM-DD)',
            )}
            {formBulkFireplaces.map((f, i) => {
              const idx = i + 2
              const excluded = formBulkExcluded.includes(f.id)
              return (
                <Box key={f.id} flexDirection="row">
                  <Box width={30}>
                    <Text
                      color={activeField === idx ? '#E67E22' : '#FFFFFF'}
                      bold={activeField === idx}
                    >
                      {activeField === idx ? `➔ ${f.name}` : `  ${f.name}`}{' '}
                      <Text color="#666666">({FIREPLACE_LABELS[f.type]})</Text>
                    </Text>
                  </Box>
                  <Text color={excluded ? '#E74C3C' : '#2ECC71'} bold>
                    ◀ {excluded ? 'EI NUOHOTTU' : 'NUOHOTTU'} ▶
                  </Text>
                </Box>
              )
            })}
            {rowSave(saveIdx)}
          </Box>
        </Box>
      )
    }

    if (formType === 'contact') {
      return formShell(
        'YHTEYSTIETO',
        <>
          {rowText(0, 'Nimi:', formCoName, 'esim. Sysmän nuohouspalvelu')}
          {rowSelect(1, 'Rooli:', CONTACT_ROLE_LABELS[formCoRole])}
          {rowText(2, 'Puhelin:', formCoPhone, 'esim. 040 123 4567')}
          {rowText(3, 'Sähköposti:', formCoEmail, '(valinnainen)')}
          {rowText(4, 'Huomiot:', formCoNotes, 'esim. piirinuohooja, Sysmä')}
          {rowSave(5)}
        </>,
      )
    }

    if (formType === 'document') {
      const linkCands = linkCandidates(formDocLinkedType, formPropId)
      const linkedLabel =
        formDocLinkedType === ''
          ? '—'
          : (linkCands.find((c) => c.id === formDocLinkedId)?.label ??
            '(ei ehdokkaita)')
      return formShell(
        'ASIAKIRJA',
        <>
          {rowProp(0)}
          {rowSelect(1, 'Tyyppi:', DOC_TYPE_LABELS[formDocType])}
          {rowText(2, 'Otsikko:', formDocTitle, 'esim. Nuohoustodistus 2026')}
          {rowText(
            3,
            'Tiedostopolku/viite:',
            formDocPath,
            'esim. ~/Documents/nuohous.pdf',
          )}
          {rowText(
            4,
            'Päiväys (YYYY-MM-DD):',
            formDocDate,
            '(esim. nuohouspäivä)',
          )}
          {rowText(5, 'Huomiot:', formDocNotes, '(valinnainen)')}
          {rowSelect(
            6,
            'Liitä tietueeseen:',
            DOC_LINK_LABELS[formDocLinkedType],
          )}
          {rowSelect(7, 'Linkitetty tietue:', linkedLabel)}
          {rowSave(8)}
        </>,
      )
    }

    if (formType === 'meter') {
      return formShell(
        'MITTARILUKEMA',
        <>
          {rowProp(0)}
          {rowSelect(
            1,
            'Mittarityyppi:',
            `${METER_LABELS[formMtType]} (${meterUnit(formMtType)})`,
          )}
          {rowText(
            2,
            `Lukema (${meterUnit(formMtType)}):`,
            formMtReading,
            'esim. 24500',
          )}
          {rowText(3, 'Lukemapäivä (YYYY-MM-DD):', formMtDate, '(YYYY-MM-DD)')}
          {rowText(4, 'Huomiot:', formMtNotes, '(valinnainen)')}
          {rowSave(5)}
        </>,
      )
    }

    if (formType === 'property') {
      return (
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="#8A2BE2"
          padding={1}
          marginY={1}
        >
          <Text bold color="#8A2BE2">
            {isEditing ? '✏ MUOKKAA KIINTEISTÖÄ' : '➕ LISÄÄ UUSI KIINTEISTÖ'}
          </Text>
          <Text color="#888888" italic>
            Siirry nuoli ylös/alas tai Tab-näppäimellä. Tallenna painamalla
            Enter alimmassa kentässä.
          </Text>

          <Box flexDirection="column" marginTop={1} gap={1}>
            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 0 ? '#8A2BE2' : '#FFFFFF'}
                  bold={activeField === 0}
                >
                  {activeField === 0 ? '➔ Kohteen nimi:' : '  Kohteen nimi:'}
                </Text>
              </Box>
              <Text color={activeField === 0 ? '#FFFFFF' : '#999999'}>
                {formPropName || chalk.gray('(esim. Saunamökki)')}
                {activeField === 0 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 1 ? '#8A2BE2' : '#FFFFFF'}
                  bold={activeField === 1}
                >
                  {activeField === 1
                    ? '➔ Kiinteistötunnus:'
                    : '  Kiinteistötunnus:'}
                </Text>
              </Box>
              <Text color={activeField === 1 ? '#FFFFFF' : '#999999'}>
                {formPropTunnus || chalk.gray('(esim. 405-412-1-23)')}
                {activeField === 1 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 2 ? '#8A2BE2' : '#FFFFFF'}
                  bold={activeField === 2}
                >
                  {activeField === 2
                    ? '➔ Vesijärjestelmä:'
                    : '  Vesijärjestelmä:'}
                </Text>
              </Box>
              <Text color="#A29BFE" bold>
                ◀{' '}
                {formPropWater === 'well'
                  ? 'Oma kaivo (Well)'
                  : 'Kunnan vesiliittymä (Mains)'}{' '}
                ▶
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 3 ? '#8A2BE2' : '#FFFFFF'}
                  bold={activeField === 3}
                >
                  {activeField === 3 ? '➔ Rakennusvuosi:' : '  Rakennusvuosi:'}
                </Text>
              </Box>
              <Text color={activeField === 3 ? '#FFFFFF' : '#999999'}>
                {formPropYear}
                {activeField === 3 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 4 ? '#8A2BE2' : '#FFFFFF'}
                  bold={activeField === 4}
                >
                  {activeField === 4 ? '➔ Sijainti:' : '  Sijainti:'}
                </Text>
              </Box>
              <Text color={activeField === 4 ? '#FFFFFF' : '#999999'}>
                {formPropLoc || chalk.gray('(esim. Sysmä)')}
                {activeField === 4 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 5 ? '#8A2BE2' : '#FFFFFF'}
                  bold={activeField === 5}
                >
                  {activeField === 5 ? '➔ Sauna:' : '  Sauna:'}
                </Text>
              </Box>
              <Text color="#C39BD3" bold>
                ◀ {SAUNA_LABELS[formPropSaunaType]} ▶
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 6 ? '#8A2BE2' : '#FFFFFF'}
                  bold={activeField === 6}
                >
                  {activeField === 6 ? '➔ Saunan tiedot:' : '  Saunan tiedot:'}
                </Text>
              </Box>
              <Text color={activeField === 6 ? '#FFFFFF' : '#999999'}>
                {formPropSaunaInfo ||
                  chalk.gray('(esim. Erillinen rantasauna)')}
                {activeField === 6 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 7 ? '#8A2BE2' : '#FFFFFF'}
                  bold={activeField === 7}
                >
                  {activeField === 7
                    ? '➔ Kiinteistövero (€/v):'
                    : '  Kiinteistövero (€/v):'}
                </Text>
              </Box>
              <Text color={activeField === 7 ? '#FFFFFF' : '#999999'}>
                {formPropTax} €{activeField === 7 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 8 ? '#8A2BE2' : '#FFFFFF'}
                  bold={activeField === 8}
                >
                  {activeField === 8
                    ? '➔ Tiekunta (€/v):'
                    : '  Tiekunta (€/v):'}
                </Text>
              </Box>
              <Text color={activeField === 8 ? '#FFFFFF' : '#999999'}>
                {formPropRoadFee} €{activeField === 8 && '█'}
              </Text>
            </Box>

            <Text color="#8A2BE2" bold>
              — Liittymät & jätehuolto —
            </Text>
            {(
              [
                [
                  9,
                  'Sähköliittymä (pääsulake):',
                  formPropElecFuse,
                  '(esim. 3×25 A)',
                  false,
                ],
                [
                  10,
                  'Vesiliittymä (koko/tyyppi):',
                  formPropWaterConn,
                  '(esim. DN32 / Oma kaivo)',
                  false,
                ],
                [
                  11,
                  'Jätehuoltoyhtiö:',
                  formPropWasteProvider,
                  '(esim. Kiertokaari)',
                  false,
                ],
                [
                  12,
                  'Sekajäteastia:',
                  formPropWasteBin,
                  '(esim. 240 l)',
                  false,
                ],
                [
                  13,
                  'Tyhjennysväli:',
                  formPropWasteInterval,
                  '(esim. 4 vk)',
                  false,
                ],
                [
                  16,
                  'Kompostointi-ilmoitus pvm:',
                  formPropCompostDate,
                  '(YYYY-MM-DD, valinnainen)',
                  false,
                ],
              ] as [number, string, string, string, boolean][]
            )
              .filter(
                (row) =>
                  // 16 näytetään vasta selektorien jälkeen; erotellaan alla
                  row[0] !== 16,
              )
              .map(([idx, label, value, ph]) => (
                <Box flexDirection="row" key={idx}>
                  <Box width={25}>
                    <Text
                      color={activeField === idx ? '#8A2BE2' : '#FFFFFF'}
                      bold={activeField === idx}
                    >
                      {activeField === idx ? `➔ ${label}` : `  ${label}`}
                    </Text>
                  </Box>
                  <Text color={activeField === idx ? '#FFFFFF' : '#999999'}>
                    {value || chalk.gray(ph)}
                    {activeField === idx && '█'}
                  </Text>
                </Box>
              ))}
            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 14 ? '#8A2BE2' : '#FFFFFF'}
                  bold={activeField === 14}
                >
                  {activeField === 14 ? '➔ Biojäte:' : '  Biojäte:'}
                </Text>
              </Box>
              <Text color="#C39BD3" bold>
                ◀ {BIOWASTE_LABELS[formPropBiowaste]} ▶
              </Text>
            </Box>
            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 15 ? '#8A2BE2' : '#FFFFFF'}
                  bold={activeField === 15}
                >
                  {activeField === 15
                    ? '➔ Kompostointi ilmoitettu:'
                    : '  Kompostointi ilmoitettu:'}
                </Text>
              </Box>
              <Text color="#C39BD3" bold>
                ◀ {formPropCompostReg ? 'KYLLÄ' : 'EI'} ▶
              </Text>
            </Box>
            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 16 ? '#8A2BE2' : '#FFFFFF'}
                  bold={activeField === 16}
                >
                  {activeField === 16
                    ? '➔ Ilmoituksen pvm:'
                    : '  Ilmoituksen pvm:'}
                </Text>
              </Box>
              <Text color={activeField === 16 ? '#FFFFFF' : '#999999'}>
                {formPropCompostDate || chalk.gray('(YYYY-MM-DD, valinnainen)')}
                {activeField === 16 && '█'}
              </Text>
            </Box>
            {formPropBiowaste === 'home_compost' && !formPropCompostReg && (
              <Text color="#F1C40F" italic>
                ⚠ Kotikompostointi on ilmoitettava kunnan
                jätehuoltoviranomaiselle.
              </Text>
            )}

            <Box justifyContent="center" marginTop={1}>
              <Box
                borderStyle="single"
                borderColor={activeField === 17 ? '#2ECC71' : '#555555'}
                paddingX={3}
              >
                <Text bold color={activeField === 17 ? '#2ECC71' : '#888888'}>
                  [{' '}
                  {isEditing
                    ? 'TALLENNA MUUTOKSET'
                    : 'TALLENNA UUSI KIINTEISTÖ'}{' '}
                  ]
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      )
    }

    if (formType === 'task') {
      const activePropName =
        properties.find((p) => p.id === formPropId)?.name || 'Valitse nuolilla'
      return (
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="#FF8C42"
          padding={1}
          marginY={1}
        >
          <Text bold color="#FF8C42">
            {isEditing ? '✏ MUOKKAA TEHTÄVÄÄ' : '➕ LISÄÄ UUSI TEHTÄVÄ'}
          </Text>
          <Text color="#888888" italic>
            Siirry nuoli ylös/alas, muokkaa tekstiä suoraan. Peruuta painamalla
            [Esc].
          </Text>

          <Box flexDirection="column" marginTop={1} gap={1}>
            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 0 ? '#FF8C42' : '#FFFFFF'}
                  bold={activeField === 0}
                >
                  {activeField === 0
                    ? '➔ Kohde (Kiinteistö):'
                    : '  Kohde (Kiinteistö):'}
                </Text>
              </Box>
              <Text color="#FFAF40" bold>
                ◀ {activePropName} ▶
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 1 ? '#FF8C42' : '#FFFFFF'}
                  bold={activeField === 1}
                >
                  {activeField === 1
                    ? '➔ Tehtävän kuvaus:'
                    : '  Tehtävän kuvaus:'}
                </Text>
              </Box>
              <Text color={activeField === 1 ? '#FFFFFF' : '#999999'}>
                {formTitle || chalk.gray('(Kirjoita tähän...)')}
                {activeField === 1 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 2 ? '#FF8C42' : '#FFFFFF'}
                  bold={activeField === 2}
                >
                  {activeField === 2 ? '➔ Kategoria:' : '  Kategoria:'}
                </Text>
              </Box>
              <Text color={activeField === 2 ? '#FFFFFF' : '#999999'}>
                {formCategory || chalk.gray('esim. Vesi, Ylläpito, Nuohous')}
                {activeField === 2 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 3 ? '#FF8C42' : '#FFFFFF'}
                  bold={activeField === 3}
                >
                  {activeField === 3 ? '➔ Kiireellisyys:' : '  Kiireellisyys:'}
                </Text>
              </Box>
              <Text color="#FFAF40" bold>
                ◀ {formPriority.toUpperCase()} ▶
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 4 ? '#FF8C42' : '#FFFFFF'}
                  bold={activeField === 4}
                >
                  {activeField === 4
                    ? '➔ Arvioidut kulut (€):'
                    : '  Arvioidut kulut (€):'}
                </Text>
              </Box>
              <Text color={activeField === 4 ? '#FFFFFF' : '#999999'}>
                {formCost} €{activeField === 4 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 5 ? '#FF8C42' : '#FFFFFF'}
                  bold={activeField === 5}
                >
                  {activeField === 5 ? '➔ Toistuvuus:' : '  Toistuvuus:'}
                </Text>
              </Box>
              <Text color="#FFAF40" bold>
                ◀ {RECURRENCE_LABELS[formRecurrence]} ▶
              </Text>
            </Box>
            {formRecurrence !== 'none' && (
              <Text color="#888888" italic>
                Toistuva tehtävä: valmiiksi merkitseminen luo automaattisesti
                seuraavan esiintymän.
              </Text>
            )}

            <Box justifyContent="center" marginTop={1}>
              <Box
                borderStyle="single"
                borderColor={activeField === 6 ? '#2ECC71' : '#555555'}
                paddingX={3}
              >
                <Text bold color={activeField === 6 ? '#2ECC71' : '#888888'}>
                  [ {isEditing ? 'TALLENNA MUUTOKSET' : 'TALLENNA UUSI TEHTÄVÄ'}{' '}
                  ]
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      )
    }

    if (formType === 'renovation') {
      const activePropName =
        properties.find((p) => p.id === formPropId)?.name || 'Valitse nuolilla'
      const STATUS_LABELS: Record<Renovation['status'], string> = {
        planning: 'Suunnittelussa',
        in_progress: 'Käynnissä',
        completed: 'Valmis',
      }
      return (
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="#2ECC71"
          padding={1}
          marginY={1}
        >
          <Text bold color="#2ECC71">
            {isEditing
              ? '✏ MUOKKAA REMONTTIHANKE-BUDJETTIA'
              : '➕ LISÄÄ UUSI REMONTTIHANKE'}
          </Text>
          <Text color="#888888" italic>
            Nuolet ylh./alas = kentät | Nuolet vas./oik. = valinnat | [Esc] =
            peruuta
          </Text>

          <Box flexDirection="column" marginTop={1} gap={1}>
            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 0 ? '#2ECC71' : '#FFFFFF'}
                  bold={activeField === 0}
                >
                  {activeField === 0
                    ? '➔ Kohde (Kiinteistö):'
                    : '  Kohde (Kiinteistö):'}
                </Text>
              </Box>
              <Text color="#2ECC71" bold>
                ◀ {activePropName} ▶
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 1 ? '#2ECC71' : '#FFFFFF'}
                  bold={activeField === 1}
                >
                  {activeField === 1 ? '➔ Hankkeen nimi:' : '  Hankkeen nimi:'}
                </Text>
              </Box>
              <Text color={activeField === 1 ? '#FFFFFF' : '#999999'}>
                {formRenName || chalk.gray('(Kirjoita tähän...)')}
                {activeField === 1 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 2 ? '#2ECC71' : '#FFFFFF'}
                  bold={activeField === 2}
                >
                  {activeField === 2 ? '➔ Tila:' : '  Tila:'}
                </Text>
              </Box>
              <Text color="#F1C40F" bold>
                ◀ {STATUS_LABELS[formRenStatus]} ▶
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 3 ? '#2ECC71' : '#FFFFFF'}
                  bold={activeField === 3}
                >
                  {activeField === 3 ? '➔ Budjetti (€):' : '  Budjetti (€):'}
                </Text>
              </Box>
              <Text color={activeField === 3 ? '#FFFFFF' : '#999999'}>
                {formRenBudget} €{activeField === 3 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 4 ? '#2ECC71' : '#FFFFFF'}
                  bold={activeField === 4}
                >
                  {activeField === 4 ? '➔ Kulutettu (€):' : '  Kulutettu (€):'}
                </Text>
              </Box>
              <Text color={activeField === 4 ? '#FFFFFF' : '#999999'}>
                {formRenSpent} €{activeField === 4 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 5 ? '#2ECC71' : '#FFFFFF'}
                  bold={activeField === 5}
                >
                  {activeField === 5
                    ? '➔ Aloitus (YYYY-MM-DD):'
                    : '  Aloitus (YYYY-MM-DD):'}
                </Text>
              </Box>
              <Text color={activeField === 5 ? '#FFFFFF' : '#999999'}>
                {formRenStartDate || chalk.gray('(esim. 2026-06-08)')}
                {activeField === 5 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 6 ? '#2ECC71' : '#FFFFFF'}
                  bold={activeField === 6}
                >
                  {activeField === 6
                    ? '➔ Loppu (YYYY-MM-DD/tyhjä):'
                    : '  Loppu (YYYY-MM-DD/tyhjä):'}
                </Text>
              </Box>
              <Text color={activeField === 6 ? '#FFFFFF' : '#999999'}>
                {formRenEndDate || chalk.gray('(ei päättynyt)')}
                {activeField === 6 && '█'}
              </Text>
            </Box>

            <Box justifyContent="center" marginTop={1}>
              <Box
                borderStyle="single"
                borderColor={activeField === 7 ? '#2ECC71' : '#555555'}
                paddingX={3}
              >
                <Text bold color={activeField === 7 ? '#2ECC71' : '#888888'}>
                  [ {isEditing ? 'TALLENNA MUUTOKSET' : 'TALLENNA HANKE'} ]
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      )
    }

    if (formType === 'tool') {
      const STATUS_LABELS: Record<Tool['status'], string> = {
        working: 'Käyttökunnossa',
        needs_repair: 'Huollossa',
        lost: 'Kadonnut',
      }
      return (
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="#E74C3C"
          padding={1}
          marginY={1}
        >
          <Text bold color="#E74C3C">
            {isEditing ? '✏ MUOKKAA LAITETTA' : '➕ LISÄÄ UUSI LAITE / TYÖKALU'}
          </Text>
          <Text color="#888888" italic>
            Nuolet ylh./alas = kentät | Nuolet vas./oik. = valinnat | [Esc] =
            peruuta
          </Text>
          <Box flexDirection="column" marginTop={1} gap={1}>
            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 0 ? '#E74C3C' : '#FFFFFF'}
                  bold={activeField === 0}
                >
                  {activeField === 0 ? '➔ Laitteen nimi:' : '  Laitteen nimi:'}
                </Text>
              </Box>
              <Text color={activeField === 0 ? '#FFFFFF' : '#999999'}>
                {formToolName || chalk.gray('(esim. Husqvarna Moottorisaha)')}
                {activeField === 0 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 1 ? '#E74C3C' : '#FFFFFF'}
                  bold={activeField === 1}
                >
                  {activeField === 1 ? '➔ Kuntotila:' : '  Kuntotila:'}
                </Text>
              </Box>
              <Text color="#FFAF40" bold>
                ◀ {STATUS_LABELS[formToolStatus]} ▶
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 2 ? '#E74C3C' : '#FFFFFF'}
                  bold={activeField === 2}
                >
                  {activeField === 2
                    ? '➔ Sijaintipaikka:'
                    : '  Sijaintipaikka:'}
                </Text>
              </Box>
              <Text color={activeField === 2 ? '#FFFFFF' : '#999999'}>
                {formToolLocation || chalk.gray('(esim. Pappilan autotalli)')}
                {activeField === 2 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 3 ? '#E74C3C' : '#FFFFFF'}
                  bold={activeField === 3}
                >
                  {activeField === 3 ? '➔ Hankintapvm:' : '  Hankintapvm:'}
                </Text>
              </Box>
              <Text color={activeField === 3 ? '#FFFFFF' : '#999999'}>
                {formToolPurchaseDate}
                {activeField === 3 && '█'}
              </Text>
            </Box>

            <Box justifyContent="center" marginTop={1}>
              <Box
                borderStyle="single"
                borderColor={activeField === 4 ? '#2ECC71' : '#555555'}
                paddingX={3}
              >
                <Text bold color={activeField === 4 ? '#2ECC71' : '#888888'}>
                  [ {isEditing ? 'TALLENNA MUUTOKSET' : 'TALLENNA LAITE'} ]
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      )
    }

    if (formType === 'transaction') {
      const activePropName =
        properties.find((p) => p.id === formPropId)?.name || 'Valitse nuolilla'
      return (
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="#2ECC71"
          padding={1}
          marginY={1}
        >
          <Text bold color="#2ECC71">
            {isEditing
              ? '✏ MUOKKAA TAPAHTUMAA'
              : '➕ LISÄÄ UUSI TALOUSTAPAHTUMA'}
          </Text>
          <Text color="#888888" italic>
            Siirry nuoli ylös/alas, muokkaa tekstiä suoraan. Peruuta painamalla
            [Esc].
          </Text>

          <Box flexDirection="column" marginTop={1} gap={1}>
            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 0 ? '#2ECC71' : '#FFFFFF'}
                  bold={activeField === 0}
                >
                  {activeField === 0
                    ? '➔ Kohde (Kiinteistö):'
                    : '  Kohde (Kiinteistö):'}
                </Text>
              </Box>
              <Text color="#2ECC71" bold>
                ◀ {activePropName} ▶
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 1 ? '#2ECC71' : '#FFFFFF'}
                  bold={activeField === 1}
                >
                  {activeField === 1
                    ? '➔ Tyyppi (Tulo/Meno):'
                    : '  Tyyppi (Tulo/Meno):'}
                </Text>
              </Box>
              <Text
                color={formTxType === 'income' ? '#2ECC71' : '#E74C3C'}
                bold
              >
                ◀ {formTxType === 'income' ? 'TULO (+)' : 'MENO (-)'} ▶
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 2 ? '#2ECC71' : '#FFFFFF'}
                  bold={activeField === 2}
                >
                  {activeField === 2 ? '➔ Kategoria:' : '  Kategoria:'}
                </Text>
              </Box>
              <Text color={activeField === 2 ? '#FFFFFF' : '#999999'}>
                {formCategory ||
                  chalk.gray('esim. Vuokra, Remontti, Sähkö, Puut')}
                {activeField === 2 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 3 ? '#2ECC71' : '#FFFFFF'}
                  bold={activeField === 3}
                >
                  {activeField === 3 ? '➔ Rahamäärä (€):' : '  Rahamäärä (€):'}
                </Text>
              </Box>
              <Text color={activeField === 3 ? '#FFFFFF' : '#999999'}>
                {formTxAmount} €{activeField === 3 && '█'}
              </Text>
            </Box>

            <Box flexDirection="row">
              <Box width={25}>
                <Text
                  color={activeField === 4 ? '#2ECC71' : '#FFFFFF'}
                  bold={activeField === 4}
                >
                  {activeField === 4
                    ? '➔ Selite (Kuvaus):'
                    : '  Selite (Kuvaus):'}
                </Text>
              </Box>
              <Text color={activeField === 4 ? '#FFFFFF' : '#999999'}>
                {formTxDesc || chalk.gray('(Kirjoita tähän...)')}
                {activeField === 4 && '█'}
              </Text>
            </Box>

            <Box justifyContent="center" marginTop={1}>
              <Box
                borderStyle="single"
                borderColor={activeField === 5 ? '#2ECC71' : '#555555'}
                paddingX={3}
              >
                <Text bold color={activeField === 5 ? '#2ECC71' : '#888888'}>
                  [ {isEditing ? 'TALLENNA MUUTOKSET' : 'TALLENNA TAPAHTUMA'} ]
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      )
    }

    if (formType === 'utility') {
      const UTIL_TYPE_LABELS: Record<Utility['type'], string> = {
        electric_siirto: '⚡ Sähkösiirto (verkko)',
        electric_energia: '⚡ Sähköenergia',
        water: '💧 Vesi',
        waste: '🗑 Jätehuolto',
        gas: '🔥 Kaasu',
        internet: '🌐 Internet',
      }
      const activePropName =
        properties.find((p) => p.id === formPropId)?.name || 'Valitse nuolilla'
      const _isWaterType =
        formUtilType === 'water' ||
        formUtilType === 'waste' ||
        formUtilType === 'internet'
      const usageUnit = formUtilType.startsWith('electric')
        ? 'kWh'
        : formUtilType === 'water'
          ? 'm³'
          : 'kpl'
      return (
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="#3498DB"
          padding={1}
          marginY={1}
        >
          <Text bold color="#3498DB">
            {isEditing
              ? '✏ MUOKKAA KULUTUSLASKUA'
              : '➕ KIRJAA UUSI KULUTUSLASKU'}
          </Text>
          <Text color="#888888" italic>
            Nuolet ylh./alas = kentät | Nuolet vas./oik. = valinnat | [Esc] =
            peruuta
          </Text>
          <Box flexDirection="column" marginTop={1} gap={1}>
            <Box flexDirection="row">
              <Box width={28}>
                <Text
                  color={activeField === 0 ? '#3498DB' : '#FFFFFF'}
                  bold={activeField === 0}
                >
                  {activeField === 0 ? '➔ Kiinteistö:' : '  Kiinteistö:'}
                </Text>
              </Box>
              <Text color="#A29BFE" bold>
                ◄ {activePropName} ►
              </Text>
            </Box>
            <Box flexDirection="row">
              <Box width={28}>
                <Text
                  color={activeField === 1 ? '#3498DB' : '#FFFFFF'}
                  bold={activeField === 1}
                >
                  {activeField === 1 ? '➔ Laskutyyppi:' : '  Laskutyyppi:'}
                </Text>
              </Box>
              <Text color="#F1C40F" bold>
                ◄ {UTIL_TYPE_LABELS[formUtilType]} ►
              </Text>
            </Box>
            <Box flexDirection="row">
              <Box width={28}>
                <Text
                  color={activeField === 2 ? '#3498DB' : '#FFFFFF'}
                  bold={activeField === 2}
                >
                  {activeField === 2 ? '➔ Toimittaja:' : '  Toimittaja:'}
                </Text>
              </Box>
              <Text color={activeField === 2 ? '#FFFFFF' : '#999999'}>
                {formUtilProvider || '(esim. Caruna, Fortum, Helen)'}
                {activeField === 2 && '█'}
              </Text>
            </Box>
            <Box flexDirection="row">
              <Box width={28}>
                <Text
                  color={activeField === 3 ? '#3498DB' : '#FFFFFF'}
                  bold={activeField === 3}
                >
                  {activeField === 3
                    ? '➔ Laskun summa (€):'
                    : '  Laskun summa (€):'}
                </Text>
              </Box>
              <Text color={activeField === 3 ? '#FFFFFF' : '#999999'}>
                {formUtilAmount} €{activeField === 3 && '█'}
              </Text>
            </Box>
            <Box flexDirection="row">
              <Box width={28}>
                <Text
                  color={activeField === 4 ? '#3498DB' : '#FFFFFF'}
                  bold={activeField === 4}
                >
                  {activeField === 4
                    ? `➔ Kulutus (${usageUnit}):`
                    : `  Kulutus (${usageUnit}):`}
                </Text>
              </Box>
              <Text color={activeField === 4 ? '#FFFFFF' : '#999999'}>
                {formUtilUsage} {usageUnit}
                {activeField === 4 && '█'}
              </Text>
            </Box>
            <Box flexDirection="row">
              <Box width={28}>
                <Text
                  color={activeField === 5 ? '#3498DB' : '#FFFFFF'}
                  bold={activeField === 5}
                >
                  {activeField === 5
                    ? '➔ Laskutuskausi (YYYY-MM):'
                    : '  Laskutuskausi (YYYY-MM):'}
                </Text>
              </Box>
              <Text color={activeField === 5 ? '#FFFFFF' : '#999999'}>
                {formUtilMonth || '(esim. 2026-05)'}
                {activeField === 5 && '█'}
              </Text>
            </Box>
            <Box justifyContent="center" marginTop={1}>
              <Box
                borderStyle="single"
                borderColor={activeField === 6 ? '#2ECC71' : '#555555'}
                paddingX={3}
              >
                <Text bold color={activeField === 6 ? '#2ECC71' : '#888888'}>
                  [ {isEditing ? 'TALLENNA MUUTOKSET' : 'TALLENNA LASKU'} ]
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      )
    }

    if (formType === 'insurance') {
      const activePropName =
        properties.find((p) => p.id === formPropId)?.name || 'Valitse nuolilla'
      return (
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="#9B59B6"
          padding={1}
          marginY={1}
        >
          <Text bold color="#9B59B6">
            {isEditing
              ? '✏ MUOKKAA VAKUUTUSTA'
              : '➕ LISÄÄ UUSI VAKUUTUSSOPIMUS'}
          </Text>
          <Text color="#888888" italic>
            Nuolet ylh./alas = kentät | Nuolet vas./oik. = kohteen vaihto |
            [Esc] = peruuta
          </Text>
          <Box flexDirection="column" marginTop={1} gap={1}>
            <Box flexDirection="row">
              <Box width={28}>
                <Text
                  color={activeField === 0 ? '#9B59B6' : '#FFFFFF'}
                  bold={activeField === 0}
                >
                  {activeField === 0 ? '➔ Kiinteistö:' : '  Kiinteistö:'}
                </Text>
              </Box>
              <Text color="#A29BFE" bold>
                ◄ {activePropName} ►
              </Text>
            </Box>
            <Box flexDirection="row">
              <Box width={28}>
                <Text
                  color={activeField === 1 ? '#9B59B6' : '#FFFFFF'}
                  bold={activeField === 1}
                >
                  {activeField === 1
                    ? '➔ Vakuutuksen nimi:'
                    : '  Vakuutuksen nimi:'}
                </Text>
              </Box>
              <Text color={activeField === 1 ? '#FFFFFF' : '#999999'}>
                {formInsPolicyName ||
                  chalk.gray('(esim. Mökin täysarvovakuutus)')}
                {activeField === 1 && '█'}
              </Text>
            </Box>
            <Box flexDirection="row">
              <Box width={28}>
                <Text
                  color={activeField === 2 ? '#9B59B6' : '#FFFFFF'}
                  bold={activeField === 2}
                >
                  {activeField === 2 ? '➔ Vakuutusyhtiö:' : '  Vakuutusyhtiö:'}
                </Text>
              </Box>
              <Text color={activeField === 2 ? '#FFFFFF' : '#999999'}>
                {formInsProvider ||
                  chalk.gray('(esim. LähiTapiola, If, Pohjola)')}
                {activeField === 2 && '█'}
              </Text>
            </Box>
            <Box flexDirection="row">
              <Box width={28}>
                <Text
                  color={activeField === 3 ? '#9B59B6' : '#FFFFFF'}
                  bold={activeField === 3}
                >
                  {activeField === 3
                    ? '➔ Vuosimaksu (€):'
                    : '  Vuosimaksu (€):'}
                </Text>
              </Box>
              <Text color={activeField === 3 ? '#FFFFFF' : '#999999'}>
                {formInsPremium} €{activeField === 3 && '█'}
              </Text>
            </Box>
            <Box flexDirection="row">
              <Box width={28}>
                <Text
                  color={activeField === 4 ? '#9B59B6' : '#FFFFFF'}
                  bold={activeField === 4}
                >
                  {activeField === 4
                    ? '➔ Uusimispvm (YYYY-MM-DD):'
                    : '  Uusimispvm (YYYY-MM-DD):'}
                </Text>
              </Box>
              <Text color={activeField === 4 ? '#FFFFFF' : '#999999'}>
                {formInsRenewalDate}
                {activeField === 4 && '█'}
              </Text>
            </Box>
            <Box flexDirection="row">
              <Box width={28}>
                <Text
                  color={activeField === 5 ? '#9B59B6' : '#FFFFFF'}
                  bold={activeField === 5}
                >
                  {activeField === 5
                    ? '➔ Kattavuus / huomiot:'
                    : '  Kattavuus / huomiot:'}
                </Text>
              </Box>
              <Text color={activeField === 5 ? '#FFFFFF' : '#999999'}>
                {formInsCoverageDetails ||
                  chalk.gray('(esim. palo, vesi, irtaimisto)')}
                {activeField === 5 && '█'}
              </Text>
            </Box>
            <Box justifyContent="center" marginTop={1}>
              <Box
                borderStyle="single"
                borderColor={activeField === 6 ? '#2ECC71' : '#555555'}
                paddingX={3}
              >
                <Text bold color={activeField === 6 ? '#2ECC71' : '#888888'}>
                  [ {isEditing ? 'TALLENNA MUUTOKSET' : 'TALLENNA VAKUUTUS'} ]
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      )
    }

    return null
  }

  // Render Overview View
  const renderOverview = () => {
    const pendingTasks = tasks.filter((t) => t.status !== 'completed')
    const urgentTasks = tasks
      .filter((t) => t.status !== 'completed' && t.priority === 'high')
      .slice(0, 3)

    const totalRenovationBudget = renovations.reduce(
      (sum, r) => sum + r.budget,
      0,
    )
    const totalRenovationSpent = renovations.reduce(
      (sum, r) => sum + r.spent,
      0,
    )

    const incomeSum = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
    const expenseSum = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
    const netCashflow = incomeSum - expenseSum

    const electricSum = utilities
      .filter(
        (u) => u.type === 'electric_siirto' || u.type === 'electric_energia',
      )
      .reduce((sum, u) => sum + u.amount, 0)
    const waterSum = utilities
      .filter((u) => u.type === 'water')
      .reduce((sum, u) => sum + u.amount, 0)
    const wasteSum = utilities
      .filter((u) => u.type === 'waste')
      .reduce((sum, u) => sum + u.amount, 0)

    // Erääntyvät velvoitteet: tehtävät, vakuutukset ja lakisääteiset yhteen (≤30 pv tai myöhässä).
    const propName = (id: number) =>
      properties.find((p) => p.id === id)?.name ?? `#${id}`
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysUntil = (d: string) =>
      Math.round(
        (new Date(`${d}T00:00:00`).getTime() - today.getTime()) / 86_400_000,
      )
    type Upcoming = {
      date: string
      label: string
      property: string
      days: number
    }
    const upcoming: Upcoming[] = []
    const pushUp = (date: string | null, label: string, propertyId: number) => {
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return
      const days = daysUntil(date)
      if (days <= 30)
        upcoming.push({ date, label, property: propName(propertyId), days })
    }
    for (const t of tasks) {
      if (t.status === 'completed') continue
      pushUp(
        t.recurrence !== 'none' && t.next_due ? t.next_due : t.due_date,
        t.title,
        t.property_id,
      )
    }
    for (const ins of insurance)
      pushUp(ins.renewal_date, `Vakuutus: ${ins.policy_name}`, ins.property_id)
    for (const f of fireplaces)
      pushUp(f.next_sweep, `Nuohous: ${f.name}`, f.property_id)
    for (const w of wastewaterSystems)
      pushUp(w.next_emptied, 'Jätevesisäiliön tyhjennys', w.property_id)
    for (const h of heatingSystems)
      pushUp(h.next_inspection, 'Lämmitystarkastus', h.property_id)
    upcoming.sort((a, b) => a.days - b.days)

    return (
      <Box flexDirection="column" gap={1}>
        <Panel
          title="⏰ Erääntyy 30 pv sisällä"
          color="#F39C12"
          width={layoutWidth}
        >
          <Box flexDirection="column">
            {upcoming.length === 0 ? (
              <Text italic color="#2ECC71">
                Ei erääntyviä velvoitteita seuraavan 30 päivän aikana. 👍
              </Text>
            ) : (
              upcoming.slice(0, 8).map((u, idx) => (
                <Box key={idx} flexDirection="row" paddingX={1}>
                  <Box width={14}>
                    <Text
                      color={
                        u.days < 0
                          ? '#E74C3C'
                          : u.days <= 7
                            ? '#F1C40F'
                            : '#95A5A6'
                      }
                      bold
                    >
                      {u.days < 0 ? `MYÖHÄSSÄ ${-u.days}pv` : `${u.days} pv`}
                    </Text>
                  </Box>
                  <Box width={12}>
                    <Text color="#DDDDDD">{u.date}</Text>
                  </Box>
                  <Box width={14}>
                    <Text color="#8A2BE2">{u.property}</Text>
                  </Box>
                  <Box flexGrow={1}>
                    <Text color="#FFFFFF">{u.label}</Text>
                  </Box>
                </Box>
              ))
            )}
          </Box>
        </Panel>

        <Box flexDirection={isWide ? 'row' : 'column'} gap={1}>
          <Box
            flexDirection="column"
            width={isWide ? halfWidth : layoutWidth}
            gap={1}
          >
            <Panel
              title="📌 Tehtävät & Piha (Urgent Tasks)"
              color="#FF8C42"
              width={isWide ? halfWidth : layoutWidth}
            >
              <Box flexDirection="column">
                <Text bold color="#FFAF40">
                  Kiireelliset huollot ({urgentTasks.length}):
                </Text>
                {urgentTasks.length === 0 ? (
                  <Text color="#999999" italic>
                    Ei kiireellisiä tehtäviä odottamassa.
                  </Text>
                ) : (
                  urgentTasks.map((t) => {
                    const propName =
                      properties.find((p) => p.id === t.property_id)?.name || ''
                    return (
                      <Box
                        key={t.id}
                        marginLeft={1}
                        justifyContent="space-between"
                      >
                        <Text color="#E74C3C">
                          ⚠ {t.title} ({propName})
                        </Text>
                        <Text color="#95A5A6">Raja: {t.due_date}</Text>
                      </Box>
                    )
                  })
                )}
                <Box
                  borderStyle="single"
                  borderColor="#FF8C42"
                  marginTop={1}
                  paddingX={1}
                  flexDirection="row"
                  justifyContent="space-around"
                >
                  <Text color="#FF8C42">
                    Kesken:{' '}
                    {pendingTasks.filter((t) => t.status === 'pending').length}
                  </Text>
                  <Text color="#F1C40F">
                    Työn alla:{' '}
                    {
                      pendingTasks.filter((t) => t.status === 'in_progress')
                        .length
                    }
                  </Text>
                  <Text color="#2ECC71">
                    Tehty:{' '}
                    {tasks.filter((t) => t.status === 'completed').length}
                  </Text>
                </Box>
              </Box>
            </Panel>

            <Panel
              title="📊 Talousarvio (Net Cashflow)"
              color="#2ECC71"
              width={isWide ? halfWidth : layoutWidth}
            >
              <Box flexDirection="column" gap={1}>
                <Box justifyContent="space-between">
                  <Text>Tulot (Vuokratulot jne):</Text>
                  <Text color="#2ECC71" bold>
                    +{incomeSum.toFixed(2)} €
                  </Text>
                </Box>
                <Box justifyContent="space-between">
                  <Text>Menot (Korjaukset & kulut):</Text>
                  <Text color="#E74C3C" bold>
                    -{expenseSum.toFixed(2)} €
                  </Text>
                </Box>
                <Box
                  justifyContent="space-between"
                  borderStyle="single"
                  borderColor="#555555"
                  paddingX={1}
                >
                  <Text bold>Nettotulos (Kassavirta):</Text>
                  <Text bold color={netCashflow >= 0 ? '#2ECC71' : '#E74C3C'}>
                    {netCashflow.toFixed(2)} €
                  </Text>
                </Box>
              </Box>
            </Panel>
          </Box>

          <Box
            flexDirection="column"
            width={isWide ? halfWidth : layoutWidth}
            gap={1}
          >
            <Panel
              title="🏗 Hirsityöt & Hanke-budjetit"
              color="#2ECC71"
              width={isWide ? halfWidth : layoutWidth}
            >
              <Box flexDirection="column">
                <Box justifyContent="space-between" marginBottom={1}>
                  <Text bold>Hanke-edistyminen:</Text>
                  <Text bold color="#2ECC71">
                    {totalRenovationSpent.toFixed(0)} € /{' '}
                    {totalRenovationBudget.toFixed(0)} € käytetty
                  </Text>
                </Box>
                <HBar
                  value={totalRenovationSpent}
                  max={totalRenovationBudget}
                  width={isWide ? halfWidth - 6 : layoutWidth - 6}
                />

                <Box marginTop={1} marginBottom={1}>
                  <Text bold color="#2ECC71">
                    Aktiiviset projektit:
                  </Text>
                </Box>
                {renovations.map((r) => (
                  <Box key={r.id} flexDirection="column" marginBottom={1}>
                    <Box justifyContent="space-between">
                      <Text bold color="#2ECC71">
                        {r.project_name}
                      </Text>
                      <Text>
                        {r.spent.toFixed(0)} € / {r.budget.toFixed(0)} €
                      </Text>
                    </Box>
                    <HBar
                      value={r.spent}
                      max={r.budget}
                      width={isWide ? halfWidth - 6 : layoutWidth - 6}
                    />
                  </Box>
                ))}
              </Box>
            </Panel>

            <Panel
              title="🔌 Sähkö- & Jätehuoltokulut"
              color="#3498DB"
              width={isWide ? halfWidth : layoutWidth}
            >
              <Box flexDirection="column">
                <Box justifyContent="space-between">
                  <Text>⚡ Sähkölaskut:</Text>
                  <Text color="#3498DB" bold>
                    {electricSum.toFixed(2)} €
                  </Text>
                </Box>
                <Box justifyContent="space-between">
                  <Text>💧 Vesilaskut (kunnan):</Text>
                  <Text color="#3498DB" bold>
                    {waterSum.toFixed(2)} €
                  </Text>
                </Box>
                <Box justifyContent="space-between">
                  <Text>🗑 Jätehuolto:</Text>
                  <Text color="#3498DB" bold>
                    {wasteSum.toFixed(2)} €
                  </Text>
                </Box>
              </Box>
            </Panel>
          </Box>
        </Box>
      </Box>
    )
  }

  // Tehtävien listanäkymä
  const renderTasks = () => {
    return (
      <Panel
        title="📋 Tehtävälista (TUI-Hallinta)"
        color="#FF8C42"
        width={layoutWidth}
      >
        <Box flexDirection="column" gap={1}>
          <Text italic color="#95A5A6">
            Valitse [Ylös/Alas] | Vaihda tila [Välilyönti] | Lisää uusi [a] |
            Muokkaa valittua [e] | Poista valittu [d]
          </Text>
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="#FF8C42"
            paddingY={1}
          >
            <Box
              flexDirection="row"
              borderStyle="single"
              borderColor="#555555"
              paddingX={1}
            >
              <Box width={4}>
                <Text bold> </Text>
              </Box>
              <Box width={15}>
                <Text bold color="#888888">
                  Kiinteistö
                </Text>
              </Box>
              <Box width={30}>
                <Text bold color="#888888">
                  Tehtävä
                </Text>
              </Box>
              <Box width={12}>
                <Text bold color="#888888">
                  Tila
                </Text>
              </Box>
              <Box width={12}>
                <Text bold color="#888888">
                  Kiireellisyys
                </Text>
              </Box>
              <Box width={14}>
                <Text bold color="#888888">
                  Kategoria
                </Text>
              </Box>
              <Box width={10}>
                <Text bold color="#888888">
                  Arvio
                </Text>
              </Box>
            </Box>
            {tasks.length === 0 ? (
              <Box paddingX={2} paddingY={1}>
                <Text italic color="#555555">
                  Ei tehtäviä. Paina [a] lisätäksesi uuden!
                </Text>
              </Box>
            ) : (
              tasks.map((t, idx) => {
                const isSelected = idx === selectedTaskIndex
                const priorityColor = getPriorityColor(t.priority)
                const propName =
                  properties.find((p) => p.id === t.property_id)?.name || ''

                const _bgColor = isSelected ? '#1a1a2e' : undefined
                const selector = isSelected ? '➔' : ' '
                const selectorColor = isSelected ? '#00D4FF' : '#444444'

                let statusText = 'Kesken'
                let statusColor = '#E74C3C'
                if (t.status === 'in_progress') {
                  statusText = 'Työn alla'
                  statusColor = '#F1C40F'
                }
                if (t.status === 'completed') {
                  statusText = 'Valmis'
                  statusColor = '#2ECC71'
                }

                return (
                  <Box
                    key={t.id}
                    paddingX={1}
                    borderStyle={isSelected ? 'single' : undefined}
                    borderColor="#00D4FF"
                  >
                    <Box width={3}>
                      <Text color={selectorColor} bold>
                        {selector}
                      </Text>
                    </Box>
                    <Box width={15}>
                      <Text color="#8A2BE2" bold={isSelected}>
                        {propName}
                      </Text>
                    </Box>
                    <Box width={30}>
                      <Text
                        color={isSelected ? '#FFFFFF' : '#AAAAAA'}
                        bold={isSelected}
                      >
                        {t.title}
                      </Text>
                    </Box>
                    <Box width={12}>
                      <Text color={statusColor} bold>
                        [{statusText}]
                      </Text>
                    </Box>
                    <Box width={12}>
                      <Text color={priorityColor} bold>
                        {t.priority.toUpperCase()}
                      </Text>
                    </Box>
                    <Box width={14}>
                      <Text color="#A29BFE">{t.category}</Text>
                    </Box>
                    <Box width={10}>
                      <Text color="#2ECC71">{t.cost} €</Text>
                    </Box>
                  </Box>
                )
              })
            )}
          </Box>
        </Box>
      </Panel>
    )
  }

  // Korjaukset & Talous
  const renderRenovations = () => {
    return (
      <Box flexDirection="column" gap={1}>
        <Panel
          title={`🏗 Aktiiviset remonttibudjetit${focusedRenList === 'renovations' ? '  ◀ FOKUS' : ''}`}
          color={focusedRenList === 'renovations' ? '#00D4FF' : '#2ECC71'}
          width={layoutWidth}
        >
          <Box flexDirection="column" gap={1}>
            <Text italic color="#95A5A6">
              [↑/↓] selaa fokusoitua listaa | [←/→] tai [Tab] vaihda fokus | [a]
              lisää | [e] muokkaa | [d] poista
            </Text>
            {renovations.map((r, idx) => {
              const isSelected = idx === selectedRenovationIndex
              const spentPercent = r.budget > 0 ? (r.spent / r.budget) * 100 : 0
              const propName =
                properties.find((p) => p.id === r.property_id)?.name || ''
              return (
                <Box
                  key={r.id}
                  flexDirection="column"
                  borderStyle="single"
                  borderColor={isSelected ? '#00D4FF' : '#555555'}
                  paddingX={1}
                  marginBottom={1}
                >
                  <Box justifyContent="space-between">
                    <Text bold color="#2ECC71">
                      {isSelected ? '➔ ' : ''}
                      {r.project_name} ({propName})
                    </Text>
                    <Text>
                      Tila:{' '}
                      <Text
                        bold
                        color={r.status === 'completed' ? '#2ECC71' : '#F1C40F'}
                      >
                        {r.status.toUpperCase()}
                      </Text>
                    </Text>
                  </Box>
                  <Box justifyContent="space-between" marginY={1}>
                    <Text color="#888888">
                      Aloitus: {r.start_date}{' '}
                      {r.end_date ? `| Valmis: ${r.end_date}` : ''}
                    </Text>
                    <Text>
                      Budjetti: <Text bold>{r.budget} €</Text> | Kulutettu:{' '}
                      <Text bold color="#E74C3C">
                        {r.spent} € ({spentPercent.toFixed(0)}%)
                      </Text>
                    </Text>
                  </Box>
                  <HBar
                    value={r.spent}
                    max={r.budget}
                    width={layoutWidth - 8}
                  />
                </Box>
              )
            })}
          </Box>
        </Panel>

        <Panel
          title={`💸 Tapahtumat ja Kulukirjanpito${focusedRenList === 'transactions' ? '  ◀ FOKUS' : ''}`}
          color={focusedRenList === 'transactions' ? '#00D4FF' : '#F1C40F'}
          width={layoutWidth}
        >
          <Box flexDirection="column" gap={1}>
            <Text italic color="#95A5A6">
              Fokuksessa: [↑/↓] selaa | [a] lisää | [e] muokkaa | [d] poista —
              Vaihda fokus [Tab] tai [←/→]
            </Text>
            <Box
              flexDirection="column"
              borderStyle="single"
              borderColor="#F1C40F"
              paddingY={1}
            >
              <Box
                flexDirection="row"
                borderStyle="single"
                borderColor="#555555"
                paddingX={1}
              >
                <Box width={3}>
                  <Text bold color="#888888">
                    {' '}
                  </Text>
                </Box>
                <Box width={15}>
                  <Text bold color="#888888">
                    Kiinteistö
                  </Text>
                </Box>
                <Box width={12}>
                  <Text bold color="#888888">
                    Tyyppi
                  </Text>
                </Box>
                <Box width={14}>
                  <Text bold color="#888888">
                    Summa
                  </Text>
                </Box>
                <Box width={12}>
                  <Text bold color="#888888">
                    Pvm
                  </Text>
                </Box>
                <Box width={13}>
                  <Text bold color="#888888">
                    Kategoria
                  </Text>
                </Box>
                <Box flexGrow={1}>
                  <Text bold color="#888888">
                    Kuvaus
                  </Text>
                </Box>
              </Box>
              {transactions.length === 0 ? (
                <Box paddingX={2} paddingY={1}>
                  <Text italic color="#555555">
                    Ei taloustapahtumia tallennettuna. Paina [a] lisätäksesi
                    uuden!
                  </Text>
                </Box>
              ) : (
                transactions.map((tr, idx) => {
                  const isSelected = idx === selectedTxIndex
                  const propName =
                    properties.find((p) => p.id === tr.property_id)?.name || ''
                  const isIncome = tr.type === 'income'
                  const typeColor = isIncome ? '#2ECC71' : '#E74C3C'
                  const typeLabel = isIncome ? 'TULO (+)' : 'MENO (-)'
                  const amountStr = `${isIncome ? '+' : '-'}${tr.amount.toFixed(2)} €`
                  const selector = isSelected ? '➔' : ' '

                  return (
                    <Box
                      key={tr.id}
                      paddingX={1}
                      borderStyle={isSelected ? 'single' : undefined}
                      borderColor="#00D4FF"
                    >
                      <Box width={3}>
                        <Text color={isSelected ? '#00D4FF' : '#444444'} bold>
                          {selector}
                        </Text>
                      </Box>
                      <Box width={15}>
                        <Text color="#8A2BE2" bold={isSelected}>
                          {propName}
                        </Text>
                      </Box>
                      <Box width={12}>
                        <Text color={typeColor} bold>
                          {typeLabel}
                        </Text>
                      </Box>
                      <Box width={14}>
                        <Text color={typeColor} bold>
                          {amountStr}
                        </Text>
                      </Box>
                      <Box width={12}>
                        <Text color="#95A5A6">{tr.date}</Text>
                      </Box>
                      <Box width={13}>
                        <Text color="#FFAF40">{tr.category}</Text>
                      </Box>
                      <Box flexGrow={1}>
                        <Text
                          color={isSelected ? '#FFFFFF' : '#AAAAAA'}
                          bold={isSelected}
                        >
                          {tr.description}
                        </Text>
                      </Box>
                    </Box>
                  )
                })
              )}
            </Box>
          </Box>
        </Panel>
      </Box>
    )
  }

  // Kulutus ja laskutus
  const renderUtilities = () => {
    const UTIL_TYPE_LABELS: Record<Utility['type'], string> = {
      electric_siirto: '⚡ Sähkösiirto',
      electric_energia: '⚡ Energia',
      water: '💧 Vesi',
      waste: '🗑 Jäte',
      gas: '🔥 Kaasu',
      internet: '🌐 Netti',
    }
    const UTIL_COLOR: Record<Utility['type'], string> = {
      electric_siirto: '#F1C40F',
      electric_energia: '#FFAF40',
      water: '#3498DB',
      waste: '#95A5A6',
      gas: '#E74C3C',
      internet: '#A29BFE',
    }
    const unitFor = (t: Utility['type']) =>
      t.startsWith('electric') ? 'kWh' : t === 'water' ? 'm³' : 'kpl'

    // Group by billing_month
    const months = [...new Set(utilities.map((u) => u.billing_month))].sort(
      (a, b) => b.localeCompare(a),
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Panel
          title="🔌 Sähkö-, vesi- ja muut kulutustiedot"
          color="#3498DB"
          width={layoutWidth}
        >
          <Box flexDirection="column" gap={1}>
            <Text italic color="#95A5A6">
              Suomessa sähkösiirto (verkko) ja energia tulevat usein eri
              laskuina. Molemmat kirjataan erikseen.
            </Text>
            <Text color="#888888" italic>
              [a] Kirjaa uusi lasku | [↑↓] Valitse rivi | [e] Muokkaa | [d]
              Poista
            </Text>

            {/* Column header */}
            <Box
              flexDirection="row"
              borderStyle="single"
              borderColor="#444444"
              paddingX={1}
            >
              <Box width={3}>
                <Text bold color="#666666">
                  {' '}
                </Text>
              </Box>
              <Box width={14}>
                <Text bold color="#888888">
                  Kiinteistö
                </Text>
              </Box>
              <Box width={22}>
                <Text bold color="#888888">
                  Laskutyyppi
                </Text>
              </Box>
              <Box width={16}>
                <Text bold color="#888888">
                  Toimittaja
                </Text>
              </Box>
              <Box width={12}>
                <Text bold color="#888888">
                  Summa
                </Text>
              </Box>
              <Box width={12}>
                <Text bold color="#888888">
                  Kulutus
                </Text>
              </Box>
              <Box width={12}>
                <Text bold color="#888888">
                  Kausi
                </Text>
              </Box>
            </Box>

            {utilities.length === 0 ? (
              <Box paddingX={2} paddingY={1}>
                <Text italic color="#555555">
                  Ei kulutustietoja. Paina [a] kirjataksesi ensimmäisen laskun!
                </Text>
              </Box>
            ) : (
              months.map((month) => {
                const monthUtils = utilities.filter(
                  (u) => u.billing_month === month,
                )
                const monthTotal = monthUtils.reduce((s, u) => s + u.amount, 0)
                const electricTotal = monthUtils
                  .filter(
                    (u) =>
                      u.type === 'electric_siirto' ||
                      u.type === 'electric_energia',
                  )
                  .reduce((s, u) => s + u.amount, 0)

                // Finnish month name
                const [y, m] = month.split('-')
                const MONTHS_FI = [
                  '',
                  'Tammikuu',
                  'Helmikuu',
                  'Maaliskuu',
                  'Huhtikuu',
                  'Toukokuu',
                  'Kesäkuu',
                  'Heinäkuu',
                  'Elokuu',
                  'Syyskuu',
                  'Lokakuu',
                  'Marraskuu',
                  'Joulukuu',
                ]
                const monthLabel = `${MONTHS_FI[parseInt(m ?? '0', 10)] ?? month} ${y}`

                return (
                  <Box key={month} flexDirection="column" marginBottom={1}>
                    {/* Month header */}
                    <Box
                      flexDirection="row"
                      paddingX={1}
                      borderStyle="single"
                      borderColor="#2C3E50"
                    >
                      <Box flexGrow={1}>
                        <Text bold color="#00D4FF">
                          {monthLabel}
                        </Text>
                      </Box>
                      <Text color="#888888">Sähkö yht: </Text>
                      <Text bold color="#F1C40F">
                        {electricTotal.toFixed(2)} €{' '}
                      </Text>
                      <Text color="#888888">Kaikki yht: </Text>
                      <Text bold color="#2ECC71">
                        {monthTotal.toFixed(2)} €
                      </Text>
                    </Box>

                    {monthUtils.map((u) => {
                      const flatIdx = utilities.indexOf(u)
                      const isSelected = flatIdx === selectedUtilIndex
                      const propName =
                        properties.find((p) => p.id === u.property_id)?.name ??
                        ''
                      const unit = unitFor(u.type)
                      const typeColor = UTIL_COLOR[u.type]
                      const typeLabel = UTIL_TYPE_LABELS[u.type]

                      return (
                        <Box
                          key={u.id}
                          paddingX={1}
                          borderStyle={isSelected ? 'single' : undefined}
                          borderColor="#00D4FF"
                        >
                          <Box width={3}>
                            <Text
                              color={isSelected ? '#00D4FF' : '#333333'}
                              bold
                            >
                              {isSelected ? '➔' : ' '}
                            </Text>
                          </Box>
                          <Box width={14}>
                            <Text color="#8A2BE2" bold={isSelected}>
                              {propName}
                            </Text>
                          </Box>
                          <Box width={22}>
                            <Text color={typeColor} bold>
                              {typeLabel}
                            </Text>
                          </Box>
                          <Box width={16}>
                            <Text color="#AAAAAA">{u.provider}</Text>
                          </Box>
                          <Box width={12}>
                            <Text color="#2ECC71" bold={isSelected}>
                              {u.amount.toFixed(2)} €
                            </Text>
                          </Box>
                          <Box width={12}>
                            <Text color="#95A5A6">
                              {u.usage_value > 0
                                ? `${u.usage_value} ${unit}`
                                : '-'}
                            </Text>
                          </Box>
                          <Box width={12}>
                            <Text color="#666666">{u.billing_month}</Text>
                          </Box>
                        </Box>
                      )
                    })}
                  </Box>
                )
              })
            )}
          </Box>
        </Panel>
      </Box>
    )
  }

  // Kalusto ja Vakuutukset
  const renderTools = () => {
    return (
      <Box flexDirection={isWide ? 'row' : 'column'} gap={1}>
        <Panel
          title={`🧰 Kalusto ja Työkalut${focusedToolList === 'tools' ? '  ◀ FOKUS' : ''}`}
          color={focusedToolList === 'tools' ? '#00D4FF' : '#E74C3C'}
          width={isWide ? halfWidth : layoutWidth}
        >
          <Box flexDirection="column" gap={1}>
            <Text italic color="#95A5A6">
              [←] kalusto | [→] vakuutukset | [↑/↓] selaa | [a] lisää | [e]
              muokkaa | [d] poista
            </Text>
            <Box
              flexDirection="row"
              borderStyle="single"
              borderColor="#555555"
              paddingX={1}
            >
              <Box width={3}>
                <Text bold color="#888888">
                  {' '}
                </Text>
              </Box>
              <Box width={22}>
                <Text bold>Laite / Työkalu</Text>
              </Box>
              <Box width={14}>
                <Text bold>Kuntotila</Text>
              </Box>
              <Box width={20}>
                <Text bold>Sijaintipaikka</Text>
              </Box>
            </Box>
            {tools.map((t, idx) => {
              const isSelected = idx === selectedToolIndex
              const statusColor =
                t.status === 'working'
                  ? '#2ECC71'
                  : t.status === 'needs_repair'
                    ? '#E74C3C'
                    : '#95A5A6'
              const statusLabel =
                t.status === 'working'
                  ? 'KÄYTTÖKUNNOSSA'
                  : t.status === 'needs_repair'
                    ? 'HUOLLOSSA'
                    : 'KADONNUT'
              return (
                <Box
                  key={t.id}
                  paddingX={1}
                  borderStyle={isSelected ? 'single' : undefined}
                  borderColor="#00D4FF"
                >
                  <Box width={3}>
                    <Text color={isSelected ? '#00D4FF' : '#444444'} bold>
                      {isSelected ? '➔' : ' '}
                    </Text>
                  </Box>
                  <Box width={22}>
                    <Text color="#FFFFFF" bold={isSelected}>
                      {t.name}
                    </Text>
                  </Box>
                  <Box width={14}>
                    <Text color={statusColor} bold={isSelected}>
                      {statusLabel}
                    </Text>
                  </Box>
                  <Box width={20}>
                    <Text color="#A29BFE" bold={isSelected}>
                      {t.location}
                    </Text>
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Panel>

        <Panel
          title={`🛡 Kiinteistöjen Vakuutussopimukset${focusedToolList === 'insurance' ? '  ◀ FOKUS' : ''}`}
          color={focusedToolList === 'insurance' ? '#00D4FF' : '#9B59B6'}
          width={isWide ? halfWidth : layoutWidth}
        >
          <Box flexDirection="column">
            {insurance.map((ins, idx) => {
              const propName =
                properties.find((p) => p.id === ins.property_id)?.name || ''
              const isSelected =
                focusedToolList === 'insurance' &&
                idx === selectedInsuranceIndex
              return (
                <Box
                  key={ins.id}
                  flexDirection="column"
                  borderStyle="single"
                  borderColor={isSelected ? '#00D4FF' : '#555555'}
                  paddingX={1}
                  marginBottom={1}
                >
                  <Box justifyContent="space-between">
                    <Text bold color="#A29BFE">
                      {ins.policy_name} ({propName})
                    </Text>
                    <Text color="#2ECC71" bold>
                      {ins.premium.toFixed(2)} € / v
                    </Text>
                  </Box>
                  <Box marginY={1}>
                    <Text color="#FFAF40">
                      Yhtiö: {ins.provider} | Uusitaan: {ins.renewal_date}
                    </Text>
                  </Box>
                  <Text color="#888888" italic>
                    Kattavuus: {ins.coverage_details}
                  </Text>
                </Box>
              )
            })}
          </Box>
        </Panel>
      </Box>
    )
  }

  // Määräaikaishuolto & lakisääteiset velvoitteet (Vaihe 1)
  const renderCompliance = () => {
    // Etiketit ja valintajärjestykset ovat moduulitasolla (FIREPLACE_LABELS ym.).
    const propName = (id: number) =>
      properties.find((p) => p.id === id)?.name ?? `#${id}`
    // Fokusoidun rekisterin reunaväri ja valitun rivin merkintä [e]/[d]-toimintoja varten.
    const focusColor = (list: ComplianceList, base: string) =>
      focusedComplianceList === list ? '#00D4FF' : base
    const focusTag = (list: ComplianceList) =>
      focusedComplianceList === list ? '  ◀ FOKUS' : ''
    const rowBorder = (list: ComplianceList, idx: number, base: string) =>
      focusedComplianceList === list && idx === selectedComplianceIndex
        ? '#00D4FF'
        : base

    // Päivien lukumäärä tästä päivästä annettuun eräpäivään (negatiivinen = myöhässä).
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysUntil = (dateStr: string): number => {
      const d = new Date(`${dateStr}T00:00:00`)
      return Math.round((d.getTime() - today.getTime()) / 86_400_000)
    }
    const statusFor = (days: number) => {
      if (days < 0)
        return { color: '#E74C3C', label: `MYÖHÄSSÄ ${Math.abs(days)} pv` }
      if (days <= 30) return { color: '#F1C40F', label: `${days} pv` }
      return { color: '#2ECC71', label: `${days} pv` }
    }

    // Kootaan kaikki määräaikaiset velvoitteet yhteen listaan eräpäivän mukaan.
    type Obligation = {
      date: string
      category: string
      label: string
      property: string
    }
    const obligations: Obligation[] = []
    for (const f of fireplaces) {
      if (f.next_sweep)
        obligations.push({
          date: f.next_sweep,
          category: 'Nuohous',
          label: `${f.name} (${FIREPLACE_LABELS[f.type]})`,
          property: propName(f.property_id),
        })
    }
    for (const w of wastewaterSystems) {
      if (w.next_emptied)
        obligations.push({
          date: w.next_emptied,
          category: 'Jätevesi',
          label: `${WASTEWATER_LABELS[w.type]} — tyhjennys`,
          property: propName(w.property_id),
        })
    }
    for (const h of heatingSystems) {
      if (h.next_inspection)
        obligations.push({
          date: h.next_inspection,
          category: 'Lämmitys',
          label: `${HEATING_LABELS[h.type]} — tarkastus`,
          property: propName(h.property_id),
        })
    }
    for (const t of tasks) {
      if (t.recurrence !== 'none' && t.next_due && t.status !== 'completed') {
        obligations.push({
          date: t.next_due,
          category: t.category,
          label: t.title,
          property: propName(t.property_id),
        })
      }
    }
    // Kaivovesi: suositus uusintanäytteestä 3 v viimeisimmästä tutkimuksesta.
    const latestTestByProp = new Map<number, WaterTest>()
    for (const wt of waterTests) {
      const prev = latestTestByProp.get(wt.property_id)
      if (!prev || wt.test_date > prev.test_date)
        latestTestByProp.set(wt.property_id, wt)
    }
    for (const [pid, wt] of latestTestByProp) {
      const next = `${parseInt(wt.test_date.slice(0, 4), 10) + 3}${wt.test_date.slice(4)}`
      obligations.push({
        date: next,
        category: 'Kaivovesi',
        label: 'Talousveden laatututkimus (suositus)',
        property: propName(pid),
      })
    }
    obligations.sort((a, b) => a.date.localeCompare(b.date))

    return (
      <Box flexDirection="column" gap={1}>
        <Panel
          title="⏰ Erääntyvät lakisääteiset & määräaikaiset velvoitteet"
          color="#00B894"
          width={layoutWidth}
        >
          <Box flexDirection="column">
            <Text italic color="#95A5A6">
              Nuohous vuosittain, jätevesisäiliöiden tyhjennys, öljysäiliön
              tarkastus ja kaivoveden laatu (3 v välein). Näkymä on tietoinen
              valitusta kohteesta [p].
            </Text>
            <Box
              flexDirection="row"
              borderStyle="single"
              borderColor="#444444"
              paddingX={1}
              marginTop={1}
            >
              <Box width={12}>
                <Text bold color="#888888">
                  Eräpäivä
                </Text>
              </Box>
              <Box width={16}>
                <Text bold color="#888888">
                  Kategoria
                </Text>
              </Box>
              <Box width={14}>
                <Text bold color="#888888">
                  Kohde
                </Text>
              </Box>
              <Box flexGrow={1}>
                <Text bold color="#888888">
                  Toimenpide
                </Text>
              </Box>
              <Box width={16}>
                <Text bold color="#888888">
                  Tilanne
                </Text>
              </Box>
            </Box>
            {obligations.length === 0 ? (
              <Box paddingX={2} paddingY={1}>
                <Text italic color="#555555">
                  Ei kirjattuja määräaikaisvelvoitteita.
                </Text>
              </Box>
            ) : (
              obligations.map((o, idx) => {
                const days = daysUntil(o.date)
                const st = statusFor(days)
                return (
                  <Box key={idx} paddingX={1}>
                    <Box width={12}>
                      <Text color="#DDDDDD">{o.date}</Text>
                    </Box>
                    <Box width={16}>
                      <Text color="#00D4FF">{o.category}</Text>
                    </Box>
                    <Box width={14}>
                      <Text color="#8A2BE2">{o.property}</Text>
                    </Box>
                    <Box flexGrow={1}>
                      <Text color="#FFFFFF">{o.label}</Text>
                    </Box>
                    <Box width={16}>
                      <Text color={st.color} bold>
                        {st.label}
                      </Text>
                    </Box>
                  </Box>
                )
              })
            )}
          </Box>
        </Panel>

        <Box paddingX={1}>
          <Text italic color="#00B894">
            [Tab] / ←→ vaihda rekisteri | [↑↓] valitse | [a] lisää | [e] muokkaa
            | [d] poista
          </Text>
        </Box>

        <Box flexDirection={isWide ? 'row' : 'column'} gap={1}>
          <Panel
            title={`🔥 Tulisijat & nuohous${focusTag('fireplaces')}`}
            color={focusColor('fireplaces', '#E67E22')}
            width={isWide ? halfWidth : layoutWidth}
          >
            <Box flexDirection="column">
              {fireplaces.length === 0 ? (
                <Text italic color="#555555">
                  Ei tulisijoja kirjattu. Paina [a].
                </Text>
              ) : (
                fireplaces.map((f, idx) => {
                  const certs = getDocumentsFor('fireplace', f.id)
                  return (
                    <Box
                      key={f.id}
                      flexDirection="column"
                      borderStyle="single"
                      borderColor={rowBorder('fireplaces', idx, '#555555')}
                      paddingX={1}
                      marginBottom={1}
                    >
                      <Box justifyContent="space-between">
                        <Text bold color="#FFAF40">
                          {f.name} ({propName(f.property_id)})
                        </Text>
                        <Text color="#95A5A6">{FIREPLACE_LABELS[f.type]}</Text>
                      </Box>
                      <Text color="#888888">
                        Nuohottu: {f.last_sweep ?? '—'} | Seuraava:{' '}
                        {f.next_sweep ?? '—'} | Nuohooja: {f.sweeper || '—'}
                      </Text>
                      {certs.map((c) => (
                        <Text key={c.id} color="#5DADE2">
                          📎 {c.title}
                          {c.issued_date ? ` (${c.issued_date})` : ''}
                        </Text>
                      ))}
                    </Box>
                  )
                })
              )}
              <Text color="#E67E22" italic>
                [n] Kirjaa koko kiinteistön nuohous kerralla (voit jättää
                yksittäisiä pois).
              </Text>
              <Text color="#666666" italic>
                Nuohoustodistus liitetään välilehdellä 9 (Asiakirjat) — valitse
                "Liitä tietueeseen: Tulisija".
              </Text>
            </Box>
          </Panel>

          <Panel
            title={`🚽 Jätevesijärjestelmät${focusTag('wastewater')}`}
            color={focusColor('wastewater', '#16A085')}
            width={isWide ? halfWidth : layoutWidth}
          >
            <Box flexDirection="column">
              {wastewaterSystems.length === 0 ? (
                <Text italic color="#555555">
                  Ei jätevesijärjestelmiä kirjattu. Paina [a].
                </Text>
              ) : (
                wastewaterSystems.map((w, idx) => {
                  const a = assessWastewater(w)
                  const aColor =
                    a.level === 'action'
                      ? '#E74C3C'
                      : a.level === 'warning'
                        ? '#F1C40F'
                        : '#2ECC71'
                  const aIcon =
                    a.level === 'action'
                      ? '⛔'
                      : a.level === 'warning'
                        ? '⚠'
                        : '✔'
                  return (
                    <Box
                      key={w.id}
                      flexDirection="column"
                      borderStyle="single"
                      borderColor={rowBorder('wastewater', idx, '#555555')}
                      paddingX={1}
                      marginBottom={1}
                    >
                      <Box justifyContent="space-between">
                        <Text bold color="#1ABC9C">
                          {WASTEWATER_LABELS[w.type]}
                          {w.build_year ? ` (${w.build_year})` : ''} —{' '}
                          {propName(w.property_id)}
                        </Text>
                        <Text color="#95A5A6">
                          {w.shoreline ? 'ranta ' : ''}
                          {w.groundwater ? 'pohjavesi' : ''}
                        </Text>
                      </Box>
                      <Text color="#888888">
                        Tyhjennetty: {w.last_emptied ?? '—'} | Seuraava:{' '}
                        {w.next_emptied ?? '—'}
                      </Text>
                      {w.permit_info ? (
                        <Text color="#666666" italic>
                          {w.permit_info}
                        </Text>
                      ) : null}
                      <Text bold color={aColor}>
                        {aIcon} {a.headline}
                      </Text>
                      {a.issues.map((iss, i) => (
                        <Text key={i} color="#B0B0B0">
                          • {iss}
                        </Text>
                      ))}
                      {a.actions.slice(0, 1).map((act, i) => (
                        <Text key={i} color="#7FB3D5">
                          → {act}
                        </Text>
                      ))}
                    </Box>
                  )
                })
              )}
              <Text color="#666666" italic>
                ℹ Arvio on informatiivinen (VNa 157/2017) — varmista aina kunnan
                ympäristönsuojeluviranomaiselta.
              </Text>
            </Box>
          </Panel>
        </Box>

        <Box flexDirection={isWide ? 'row' : 'column'} gap={1}>
          <Panel
            title={`🔧 Lämmitys & tarkastukset${focusTag('heating')}`}
            color={focusColor('heating', '#C0392B')}
            width={isWide ? halfWidth : layoutWidth}
          >
            <Box flexDirection="column">
              {heatingSystems.length === 0 ? (
                <Text italic color="#555555">
                  Ei lämmitysjärjestelmiä kirjattu. Paina [a].
                </Text>
              ) : (
                heatingSystems.map((h, idx) => (
                  <Box
                    key={h.id}
                    flexDirection="column"
                    borderStyle="single"
                    borderColor={rowBorder('heating', idx, '#555555')}
                    paddingX={1}
                    marginBottom={1}
                  >
                    <Text bold color="#E74C3C">
                      {HEATING_LABELS[h.type]} ({propName(h.property_id)})
                    </Text>
                    <Text color="#888888" italic>
                      {h.description}
                    </Text>
                    {(h.last_inspection || h.next_inspection) && (
                      <Text color="#888888">
                        Tarkastettu: {h.last_inspection ?? '—'} | Seuraava:{' '}
                        {h.next_inspection ?? '—'}
                      </Text>
                    )}
                  </Box>
                ))
              )}
            </Box>
          </Panel>

          <Panel
            title={`💧 Kaivoveden laatututkimukset${focusTag('water_tests')}`}
            color={focusColor('water_tests', '#2980B9')}
            width={isWide ? halfWidth : layoutWidth}
          >
            <Box flexDirection="column">
              {waterTests.length === 0 ? (
                <Text italic color="#555555">
                  Ei vesitutkimuksia kirjattu. Paina [a].
                </Text>
              ) : (
                waterTests.map((wt, idx) => (
                  <Box
                    key={wt.id}
                    flexDirection="column"
                    borderStyle="single"
                    borderColor={rowBorder(
                      'water_tests',
                      idx,
                      wt.passed ? '#2ECC71' : '#E74C3C',
                    )}
                    paddingX={1}
                    marginBottom={1}
                  >
                    <Box justifyContent="space-between">
                      <Text bold color="#3498DB">
                        {propName(wt.property_id)} — {wt.test_date}
                      </Text>
                      <Text bold color={wt.passed ? '#2ECC71' : '#E74C3C'}>
                        {wt.passed ? 'HYVÄKSYTTY' : 'HUOMAUTUS'}
                      </Text>
                    </Box>
                    <Text color="#888888">
                      E.coli: {wt.ecoli} | Koliformit: {wt.coliforms} | NO₃:{' '}
                      {wt.nitrate} | pH: {wt.ph} | Fe: {wt.iron}
                    </Text>
                    {wt.notes ? (
                      <Text color="#666666" italic>
                        {wt.notes}
                      </Text>
                    ) : null}
                  </Box>
                ))
              )}
            </Box>
          </Panel>
        </Box>
      </Box>
    )
  }

  // Pääasiallinen näkymäreititys
  // Polttopuu & Sauna (Vaihe 2)
  const renderFirewood = () => {
    const propName = (id: number) =>
      properties.find((p) => p.id === id)?.name ?? `#${id}`
    // Kokonaispinokuutiot: motti ≈ pino-m³; irto-m³ kerrotaan 0.62 pinokuutioksi (karkea muunnos).
    const toPinoM3 = (f: Firewood) =>
      f.unit === 'irto-m³' ? f.volume * 0.62 : f.volume
    const readyTotal = firewood
      .filter((f) => f.drying_status === 'ready')
      .reduce((s, f) => s + toPinoM3(f), 0)
    const grandTotal = firewood.reduce((s, f) => s + toPinoM3(f), 0)
    // Näytettävät saunat & vuosikulut suodattuvat valitun kohteen mukaan.
    const shownProps =
      selectedPropertyId === null
        ? properties
        : properties.filter((p) => p.id === selectedPropertyId)

    return (
      <Box flexDirection={isWide ? 'row' : 'column'} gap={1}>
        <Panel
          title="🪵 Polttopuuvarasto"
          color="#D35400"
          width={isWide ? halfWidth : layoutWidth}
        >
          <Box flexDirection="column">
            <Text italic color="#95A5A6">
              [↑↓] valitse | [a] lisää | [e] muokkaa | [d] poista
            </Text>
            <Box flexDirection="row" paddingX={1} marginTop={1}>
              <Text color="#888888">Käyttövalmista: </Text>
              <Text bold color="#2ECC71">
                {readyTotal.toFixed(1)} pino-m³
              </Text>
              <Text color="#888888"> | Yhteensä: </Text>
              <Text bold color="#E67E22">
                {grandTotal.toFixed(1)} pino-m³
              </Text>
            </Box>
            <Box
              flexDirection="row"
              borderStyle="single"
              borderColor="#444444"
              paddingX={1}
              marginTop={1}
            >
              <Box width={3}>
                <Text bold color="#666666">
                  {' '}
                </Text>
              </Box>
              <Box width={12}>
                <Text bold color="#888888">
                  Kohde
                </Text>
              </Box>
              <Box width={10}>
                <Text bold color="#888888">
                  Puulaji
                </Text>
              </Box>
              <Box width={12}>
                <Text bold color="#888888">
                  Määrä
                </Text>
              </Box>
              <Box flexGrow={1}>
                <Text bold color="#888888">
                  Tila / paikka
                </Text>
              </Box>
            </Box>
            {firewood.length === 0 ? (
              <Box paddingX={2} paddingY={1}>
                <Text italic color="#555555">
                  Ei polttopuueriä. Paina [a] lisätäksesi.
                </Text>
              </Box>
            ) : (
              firewood.map((f, idx) => {
                const isSelected = idx === selectedFirewoodIndex
                return (
                  <Box
                    key={f.id}
                    paddingX={1}
                    borderStyle={isSelected ? 'single' : undefined}
                    borderColor="#D35400"
                  >
                    <Box width={3}>
                      <Text color={isSelected ? '#E67E22' : '#333333'} bold>
                        {isSelected ? '➔' : ' '}
                      </Text>
                    </Box>
                    <Box width={12}>
                      <Text color="#8A2BE2" bold={isSelected}>
                        {propName(f.property_id)}
                      </Text>
                    </Box>
                    <Box width={10}>
                      <Text color="#FFFFFF">{f.wood_type}</Text>
                    </Box>
                    <Box width={12}>
                      <Text color="#E67E22" bold={isSelected}>
                        {f.volume} {f.unit}
                      </Text>
                    </Box>
                    <Box flexGrow={1}>
                      <Text color={DRYING_COLORS[f.drying_status]} bold>
                        {DRYING_LABELS[f.drying_status]}
                      </Text>
                      <Text color="#888888"> · {f.location || '—'}</Text>
                    </Box>
                  </Box>
                )
              })
            )}
          </Box>
        </Panel>

        <Panel
          title="🧖 Kiinteistön perustiedot & kiinteät kulut"
          color="#9B59B6"
          width={isWide ? halfWidth : layoutWidth}
        >
          <Box flexDirection="column">
            <Text italic color="#95A5A6">
              Sauna, liittymät, jätehuolto ja kiinteistövero muokataan
              kiinteistölomakkeella (välilehti 1).
            </Text>
            {shownProps.map((p) => {
              const comp = assessComposting(p)
              return (
                <Box
                  key={p.id}
                  flexDirection="column"
                  borderStyle="single"
                  borderColor="#555555"
                  paddingX={1}
                  marginTop={1}
                >
                  <Box justifyContent="space-between">
                    <Text bold color="#C39BD3">
                      {p.name}
                    </Text>
                    <Text color="#95A5A6">
                      {SAUNA_LABELS[p.sauna_type ?? 'none']}
                    </Text>
                  </Box>
                  {p.sauna_info ? (
                    <Text color="#888888" italic>
                      {p.sauna_info}
                    </Text>
                  ) : null}
                  <Text color="#888888">
                    ⚡ {p.electricity_fuse || '—'} | 💧{' '}
                    {p.water_connection || '—'}
                  </Text>
                  <Text color="#888888">
                    🗑 {p.waste_provider || '—'}{' '}
                    {p.waste_bin ? `· ${p.waste_bin}` : ''}
                    {p.waste_interval ? ` / ${p.waste_interval}` : ''} | ♻{' '}
                    {BIOWASTE_LABELS[p.biowaste ?? 'collection']}
                  </Text>
                  <Text color="#888888">
                    Kiinteistövero:{' '}
                    <Text color="#F1C40F" bold>
                      {(p.property_tax ?? 0).toFixed(0)} €/v
                    </Text>{' '}
                    | Tiekunta:{' '}
                    <Text color="#F1C40F" bold>
                      {(p.road_fee ?? 0).toFixed(0)} €/v
                    </Text>
                  </Text>
                  {comp ? (
                    <Text
                      color={comp.level === 'warning' ? '#F1C40F' : '#2ECC71'}
                    >
                      {comp.level === 'warning' ? '⚠' : '✔'} {comp.message}
                    </Text>
                  ) : null}
                </Box>
              )
            })}
            <Box paddingX={1} marginTop={1}>
              <Text color="#888888">Kiinteät vuosikulut yhteensä: </Text>
              <Text bold color="#E74C3C">
                {shownProps
                  .reduce(
                    (s, p) => s + (p.property_tax ?? 0) + (p.road_fee ?? 0),
                    0,
                  )
                  .toFixed(0)}{' '}
                €/v
              </Text>
            </Box>
          </Box>
        </Panel>
      </Box>
    )
  }

  // Vuokraus & vuodenkierto (Vaihe 3)
  const renderSeasonal = () => {
    const propName = (id: number) =>
      properties.find((p) => p.id === id)?.name ?? `#${id}`
    const active = bookings.filter((b) => b.status !== 'cancelled')
    const totalNights = active.reduce((s, b) => s + bookingNights(b), 0)
    const grossIncome = active.reduce((s, b) => s + b.price, 0)
    const recordedIncome = bookings
      .filter((b) => b.income_recorded)
      .reduce((s, b) => s + b.price, 0)
    // Ryhmittely kuukausittain "kalenterinäkymäksi".
    const monthsFi = [
      '',
      'Tammikuu',
      'Helmikuu',
      'Maaliskuu',
      'Huhtikuu',
      'Toukokuu',
      'Kesäkuu',
      'Heinäkuu',
      'Elokuu',
      'Syyskuu',
      'Lokakuu',
      'Marraskuu',
      'Joulukuu',
    ]
    const months = [
      ...new Set(bookings.map((b) => b.start_date.slice(0, 7))),
    ].sort()

    return (
      <Box flexDirection={isWide ? 'row' : 'column'} gap={1}>
        <Panel
          title="📅 Vuokrauskalenteri"
          color="#1ABC9C"
          width={isWide ? halfWidth : layoutWidth}
        >
          <Box flexDirection="column">
            <Text italic color="#95A5A6">
              [↑↓] valitse | [Enter] kirjaa vuokratulo | [a] lisää | [e] muokkaa
              | [d] poista
            </Text>
            <Box flexDirection="row" paddingX={1} marginTop={1}>
              <Text color="#888888">Yöt: </Text>
              <Text bold color="#1ABC9C">
                {totalNights}
              </Text>
              <Text color="#888888"> | Brutto: </Text>
              <Text bold color="#2ECC71">
                {grossIncome.toFixed(0)} €
              </Text>
              <Text color="#888888"> | Kirjattu: </Text>
              <Text bold color="#3498DB">
                {recordedIncome.toFixed(0)} €
              </Text>
            </Box>
            {bookings.length === 0 ? (
              <Box paddingX={2} paddingY={1}>
                <Text italic color="#555555">
                  Ei varauksia. Paina [a] lisätäksesi.
                </Text>
              </Box>
            ) : (
              months.map((month) => {
                const [y, m] = month.split('-')
                const monthBookings = bookings.filter(
                  (b) => b.start_date.slice(0, 7) === month,
                )
                return (
                  <Box key={month} flexDirection="column" marginTop={1}>
                    <Box
                      borderStyle="single"
                      borderColor="#16A085"
                      paddingX={1}
                    >
                      <Text bold color="#00D4FF">
                        {monthsFi[parseInt(m ?? '0', 10)] ?? month} {y}
                      </Text>
                    </Box>
                    {monthBookings.map((b) => {
                      const flatIdx = bookings.indexOf(b)
                      const isSelected = flatIdx === selectedBookingIndex
                      const nights = bookingNights(b)
                      return (
                        <Box
                          key={b.id}
                          paddingX={1}
                          borderStyle={isSelected ? 'single' : undefined}
                          borderColor="#1ABC9C"
                        >
                          <Box width={3}>
                            <Text
                              color={isSelected ? '#1ABC9C' : '#333333'}
                              bold
                            >
                              {isSelected ? '➔' : ' '}
                            </Text>
                          </Box>
                          <Box width={11}>
                            <Text color="#DDDDDD">
                              {b.start_date.slice(5)}→{b.end_date.slice(5)}
                            </Text>
                          </Box>
                          <Box width={13}>
                            <Text color="#FFFFFF" bold={isSelected}>
                              {b.guest_name}
                            </Text>
                          </Box>
                          <Box width={10}>
                            <Text color="#8A2BE2">
                              {propName(b.property_id)}
                            </Text>
                          </Box>
                          <Box width={7}>
                            <Text color="#95A5A6">{nights} yö</Text>
                          </Box>
                          <Box width={9}>
                            <Text color="#2ECC71">{b.price.toFixed(0)} €</Text>
                          </Box>
                          <Box flexGrow={1}>
                            <Text color={BOOKING_STATUS_COLORS[b.status]} bold>
                              {BOOKING_STATUS_LABELS[b.status]}
                            </Text>
                            <Text
                              color={b.income_recorded ? '#3498DB' : '#555555'}
                            >
                              {b.income_recorded ? ' €✓' : ''}
                            </Text>
                          </Box>
                        </Box>
                      )
                    })}
                  </Box>
                )
              })
            )}
          </Box>
        </Panel>

        <Panel
          title="🍂 Kausikatsaukset (Kevätavaus / Syyssulku)"
          color="#E67E22"
          width={isWide ? halfWidth : layoutWidth}
        >
          <Box flexDirection="column" gap={1}>
            <Text italic color="#95A5A6">
              Luo valmis tarkistuslista tehtävinä valitulle kohteelle. Valitse
              kohde ensin [p].
            </Text>
            <Box
              borderStyle="single"
              borderColor="#2ECC71"
              paddingX={1}
              flexDirection="column"
            >
              <Text bold color="#2ECC71">
                [k] Kevätavaus — {SEASONAL_TEMPLATES.spring.tasks.length}{' '}
                tehtävää
              </Text>
              {SEASONAL_TEMPLATES.spring.tasks.map((t, i) => (
                <Text key={i} color="#888888">
                  • {t}
                </Text>
              ))}
            </Box>
            <Box
              borderStyle="single"
              borderColor="#E74C3C"
              paddingX={1}
              flexDirection="column"
            >
              <Text bold color="#E74C3C">
                [s] Syyssulku — {SEASONAL_TEMPLATES.autumn.tasks.length}{' '}
                tehtävää
              </Text>
              {SEASONAL_TEMPLATES.autumn.tasks.map((t, i) => (
                <Text key={i} color="#888888">
                  • {t}
                </Text>
              ))}
            </Box>
            <Text color="#666666" italic>
              Luodut tehtävät näkyvät Tehtävälista-välilehdellä (2) ja
              erääntyvät-koosteessa.
            </Text>
          </Box>
        </Panel>
      </Box>
    )
  }

  // Yhteystiedot & Arkisto (Vaihe 4)
  const renderArchive = () => {
    const propName = (id: number) =>
      properties.find((p) => p.id === id)?.name ?? `#${id}`
    const focusColor = (list: ArchiveList, base: string) =>
      focusedArchiveList === list ? '#00D4FF' : base
    const focusTag = (list: ArchiveList) =>
      focusedArchiveList === list ? '  ◀ FOKUS' : ''
    const rowBorder = (list: ArchiveList, idx: number, base: string) =>
      focusedArchiveList === list && idx === selectedArchiveIndex
        ? '#00D4FF'
        : base

    return (
      <Box flexDirection="column" gap={1}>
        <Box paddingX={1}>
          <Text italic color="#5DADE2">
            [Tab] / ←→ vaihda rekisteri | [↑↓] valitse | [a] lisää | [e] muokkaa
            | [d] poista
          </Text>
        </Box>

        <Box flexDirection={isWide ? 'row' : 'column'} gap={1}>
          <Panel
            title={`📇 Yhteystiedot (palveluntarjoajat)${focusTag('contacts')}`}
            color={focusColor('contacts', '#5DADE2')}
            width={isWide ? halfWidth : layoutWidth}
          >
            <Box flexDirection="column">
              {contacts.length === 0 ? (
                <Text italic color="#555555">
                  Ei yhteystietoja. Paina [a].
                </Text>
              ) : (
                contacts.map((c, idx) => (
                  <Box
                    key={c.id}
                    flexDirection="column"
                    borderStyle="single"
                    borderColor={rowBorder('contacts', idx, '#555555')}
                    paddingX={1}
                    marginBottom={1}
                  >
                    <Box justifyContent="space-between">
                      <Text bold color="#AED6F1">
                        {c.name}
                      </Text>
                      <Text color="#F39C12">{CONTACT_ROLE_LABELS[c.role]}</Text>
                    </Box>
                    <Text color="#888888">
                      {c.phone || '—'}
                      {c.email ? ` · ${c.email}` : ''}
                    </Text>
                    {c.notes ? (
                      <Text color="#666666" italic>
                        {c.notes}
                      </Text>
                    ) : null}
                  </Box>
                ))
              )}
            </Box>
          </Panel>

          <Panel
            title={`🗂 Asiakirjat${focusTag('documents')}`}
            color={focusColor('documents', '#9B59B6')}
            width={isWide ? halfWidth : layoutWidth}
          >
            <Box flexDirection="column">
              {focusedArchiveList === 'documents' && (
                <Text italic color="#95A5A6">
                  [o] avaa valitun asiakirjan tiedosto
                </Text>
              )}
              {documents.length === 0 ? (
                <Text italic color="#555555">
                  Ei asiakirjoja. Paina [a].
                </Text>
              ) : (
                documents.map((d, idx) => {
                  const linkLabel = d.linked_type
                    ? linkCandidates(d.linked_type, d.property_id).find(
                        (c) => c.id === d.linked_id,
                      )?.label
                    : undefined
                  return (
                    <Box
                      key={d.id}
                      flexDirection="column"
                      borderStyle="single"
                      borderColor={rowBorder('documents', idx, '#555555')}
                      paddingX={1}
                      marginBottom={1}
                    >
                      <Box justifyContent="space-between">
                        <Text bold color="#C39BD3">
                          {d.title}
                        </Text>
                        <Text color="#F39C12">
                          {DOC_TYPE_LABELS[d.doc_type]}
                        </Text>
                      </Box>
                      <Text color="#888888">
                        {propName(d.property_id)}
                        {d.issued_date ? ` · ${d.issued_date}` : ''}
                      </Text>
                      {d.file_path ? (
                        <Text color="#666666" italic>
                          {d.file_path}
                        </Text>
                      ) : null}
                      {d.linked_type ? (
                        <Text color="#5DADE2">
                          🔗 {DOC_LINK_LABELS[d.linked_type]}
                          {linkLabel ? `: ${linkLabel}` : ''}
                        </Text>
                      ) : null}
                    </Box>
                  )
                })
              )}
            </Box>
          </Panel>
        </Box>

        <Panel
          title={`📈 Mittarilukemat & kulutustrendi${focusTag('meters')}`}
          color={focusColor('meters', '#3498DB')}
          width={layoutWidth}
        >
          <Box flexDirection="column">
            <Text italic color="#95A5A6">
              Kulutus = lukeman erotus edellisestä saman kohteen ja mittarin
              lukemasta.
            </Text>
            <Box
              flexDirection="row"
              borderStyle="single"
              borderColor="#444444"
              paddingX={1}
              marginTop={1}
            >
              <Box width={3}>
                <Text bold color="#666666">
                  {' '}
                </Text>
              </Box>
              <Box width={13}>
                <Text bold color="#888888">
                  Kohde
                </Text>
              </Box>
              <Box width={12}>
                <Text bold color="#888888">
                  Mittari
                </Text>
              </Box>
              <Box width={13}>
                <Text bold color="#888888">
                  Päivä
                </Text>
              </Box>
              <Box width={14}>
                <Text bold color="#888888">
                  Lukema
                </Text>
              </Box>
              <Box flexGrow={1}>
                <Text bold color="#888888">
                  Kulutus edell.
                </Text>
              </Box>
            </Box>
            {meterReadings.length === 0 ? (
              <Box paddingX={2} paddingY={1}>
                <Text italic color="#555555">
                  Ei mittarilukemia. Paina [a].
                </Text>
              </Box>
            ) : (
              meterReadings.map((m, idx) => {
                const prev = meterReadings
                  .slice(0, idx)
                  .reverse()
                  .find(
                    (x) =>
                      x.property_id === m.property_id &&
                      x.meter_type === m.meter_type,
                  )
                const delta = prev ? m.reading - prev.reading : null
                const isSelected =
                  focusedArchiveList === 'meters' &&
                  idx === selectedArchiveIndex
                return (
                  <Box
                    key={m.id}
                    paddingX={1}
                    borderStyle={isSelected ? 'single' : undefined}
                    borderColor="#00D4FF"
                  >
                    <Box width={3}>
                      <Text color={isSelected ? '#00D4FF' : '#333333'} bold>
                        {isSelected ? '➔' : ' '}
                      </Text>
                    </Box>
                    <Box width={13}>
                      <Text color="#8A2BE2" bold={isSelected}>
                        {propName(m.property_id)}
                      </Text>
                    </Box>
                    <Box width={12}>
                      <Text color="#3498DB">{METER_LABELS[m.meter_type]}</Text>
                    </Box>
                    <Box width={13}>
                      <Text color="#DDDDDD">{m.reading_date}</Text>
                    </Box>
                    <Box width={14}>
                      <Text color="#FFFFFF" bold={isSelected}>
                        {m.reading} {meterUnit(m.meter_type)}
                      </Text>
                    </Box>
                    <Box flexGrow={1}>
                      <Text color={delta === null ? '#555555' : '#2ECC71'} bold>
                        {delta === null
                          ? '— (perusluku)'
                          : `+${delta} ${meterUnit(m.meter_type)}`}
                      </Text>
                    </Box>
                  </Box>
                )
              })
            )}
          </Box>
        </Panel>
      </Box>
    )
  }

  const renderBody = () => {
    if (isFormOpen) {
      return renderForm()
    }

    switch (activeTab) {
      case 'overview':
        return renderOverview()
      case 'tasks':
        return renderTasks()
      case 'renovations':
        return renderRenovations()
      case 'utilities':
        return renderUtilities()
      case 'tools':
        return renderTools()
      case 'compliance':
        return renderCompliance()
      case 'firewood':
        return renderFirewood()
      case 'seasonal':
        return renderSeasonal()
      case 'archive':
        return renderArchive()
    }
  }

  return (
    <Box flexDirection="column" width={layoutWidth} paddingY={1}>
      {renderHeader()}
      {renderBody()}
      {renderFooter()}
    </Box>
  )
}
