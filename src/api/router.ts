// Geneerinen REST-reititin taloni-tietokannan resursseille (issue #32: "CRUD endpoints for
// all entities"). Jokainen resurssi on rekisteröity kiinteänä (compile-time) määrittelynä alla
// — reitityksessä käytetty taulun nimi TULEE AINA tästä listasta, ei koskaan suoraan URL-
// polusta, jotta deleteRow():n dynaaminen SQL (`DELETE FROM ${table}`) ei voi koskaan saada
// käyttäjän ohjaamaa taulun nimeä (ks. src/db/repositories/common.ts).
import * as db from '../db/index.js'

// Adapterikerros JSON-rungon (any) ja tyypitettyjen tietokantafunktioiden välillä — tarkka
// kenttäkohtainen validointi jää SQLiten NOT NULL/CHECK-rajoitteiden vastuulle (ks. handleRequest).
// biome-ignore-start lint/suspicious/noExplicitAny: rajapintakerros JSON-rungolle
interface ResourceDef {
  path: string
  list: (propertyId?: number) => { id: number }[]
  create: (data: any) => void
  update: (data: any) => void
  remove: (id: number) => void
  globalOnly?: boolean // ei property_id-suodatusta (esim. contacts, tools)
}

export const RESOURCES: ResourceDef[] = [
  {
    path: 'properties',
    list: () => db.getProperties(),
    create: (d) => db.addProperty(d),
    update: (d) => db.updateProperty(d),
    remove: (id) => db.deleteProperty(id),
  },
  {
    path: 'tasks',
    list: (pid) => db.getTasks(pid),
    create: (d) => db.addTask(d),
    update: (d) => db.updateTask(d),
    remove: (id) => db.deleteRow('tasks', id),
  },
  {
    path: 'renovations',
    list: (pid) => db.getRenovations(pid),
    create: (d) => db.addRenovation(d),
    update: (d) => db.updateRenovation(d),
    remove: (id) => db.deleteRow('renovations', id),
  },
  {
    path: 'transactions',
    list: (pid) => db.getTransactions(pid),
    create: (d) => db.addTransaction(d),
    update: (d) => db.updateTransaction(d),
    remove: (id) => db.deleteRow('transactions', id),
  },
  {
    path: 'utilities',
    list: (pid) => db.getUtilities(pid),
    create: (d) => db.addUtility(d),
    update: (d) => db.updateUtility(d),
    remove: (id) => db.deleteRow('utilities', id),
  },
  {
    path: 'tools',
    list: () => db.getTools(),
    create: (d) => db.addTool(d),
    update: (d) => db.updateTool(d),
    remove: (id) => db.deleteRow('tools', id),
    globalOnly: true,
  },
  {
    path: 'insurance',
    list: (pid) => db.getInsurance(pid),
    create: (d) => db.addInsurance(d),
    update: (d) => db.updateInsurance(d),
    remove: (id) => db.deleteRow('insurance', id),
  },
  {
    path: 'heating_systems',
    list: (pid) => db.getHeatingSystems(pid),
    create: (d) => db.addHeatingSystem(d),
    update: (d) => db.updateHeatingSystem(d),
    remove: (id) => db.deleteRow('heating_systems', id),
  },
  {
    path: 'fireplaces',
    list: (pid) => db.getFireplaces(pid),
    create: (d) => db.addFireplace(d),
    update: (d) => db.updateFireplace(d),
    remove: (id) => db.deleteRow('fireplaces', id),
  },
  {
    path: 'wastewater_systems',
    list: (pid) => db.getWastewaterSystems(pid),
    create: (d) => db.addWastewaterSystem(d),
    update: (d) => db.updateWastewaterSystem(d),
    remove: (id) => db.deleteRow('wastewater_systems', id),
  },
  {
    path: 'water_tests',
    list: (pid) => db.getWaterTests(pid),
    create: (d) => db.addWaterTest(d),
    update: (d) => db.updateWaterTest(d),
    remove: (id) => db.deleteRow('water_tests', id),
  },
  {
    path: 'firewood',
    list: (pid) => db.getFirewood(pid),
    create: (d) => db.addFirewood(d),
    update: (d) => db.updateFirewood(d),
    remove: (id) => db.deleteRow('firewood', id),
  },
  {
    path: 'bookings',
    list: (pid) => db.getBookings(pid),
    create: (d) => db.addBooking(d),
    update: (d) => db.updateBooking(d),
    remove: (id) => db.deleteRow('bookings', id),
  },
  {
    path: 'contacts',
    list: () => db.getContacts(),
    create: (d) => db.addContact(d),
    update: (d) => db.updateContact(d),
    remove: (id) => db.deleteRow('contacts', id),
    globalOnly: true,
  },
  {
    path: 'documents',
    list: (pid) => db.getDocuments(pid),
    create: (d) => db.addDocument(d),
    update: (d) => db.updateDocument(d),
    remove: (id) => db.deleteRow('documents', id),
  },
  {
    path: 'meter_readings',
    list: (pid) => db.getMeterReadings(pid),
    create: (d) => db.addMeterReading(d),
    update: (d) => db.updateMeterReading(d),
    remove: (id) => db.deleteRow('meter_readings', id),
  },
  {
    path: 'building_materials',
    list: (pid) => db.getBuildingMaterials(pid),
    create: (d) => db.addBuildingMaterial(d),
    update: (d) => db.updateBuildingMaterial(d),
    remove: (id) => db.deleteRow('building_materials', id),
  },
  {
    path: 'property_valuations',
    list: (pid) => db.getPropertyValuations(pid),
    create: (d) => db.addPropertyValuation(d),
    update: (d) => db.updatePropertyValuation(d),
    remove: (id) => db.deleteRow('property_valuations', id),
  },
]
// biome-ignore-end lint/suspicious/noExplicitAny: rajapintakerros JSON-rungolle

export function findResource(path: string): ResourceDef | undefined {
  return RESOURCES.find((r) => r.path === path)
}
