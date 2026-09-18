/**
 * Seed data.
 *
 * This file is excluded from the market-value guard, and it is the only place
 * that is: seed data IS market data. Everything here is a row the ops team can
 * edit later through the admin market editor without a deploy.
 *
 * The two markets deliberately differ on tax, locale, text direction and vehicle
 * identifier. South Africa is seeded now and not live, precisely so the
 * abstraction is exercised from day one — if the code works for both, the
 * abstraction is real rather than aspirational.
 */

export interface MarketSeed {
  code: string;
  name: string;
  currency: string;
  currencyMinorUnitExp: number;
  localeDefault: string;
  localesSupported: string[];
  timezone: string;
  vehicleIdType: 'vin' | 'chassis';
  vehicleIdRegex: string;
  paymentProvider: string;
  courierProviders: string[];
  taxRate: string;
  taxLabel: string;
  taxInclusive: boolean;
  commissionRate: string;
  buyerFeeRate: string;
  deliveryMarkupRate: string;
  slaResponseMin: number;
  slaOffersMin: number;
  slaDeliveryMin: number;
  selectionWindowMin: number;
  wideningWindowMin: number;
  autoConfirmHours: number;
  /** Years the financial record of a completed sale is kept, whatever else is erased. */
  financialRetentionYears: number;
  addressModel: 'street' | 'makani' | 'hybrid';
  weekendDays: number[];
  isLive: boolean;
}

export const MARKETS: MarketSeed[] = [
  {
    // Market #1. Dubai and Sharjah launch together and are marketed as the UAE.
    code: 'AE',
    name: 'United Arab Emirates',
    currency: 'AED',
    currencyMinorUnitExp: 2,
    // Arabic is the default, not a later addition: much of the used-parts trade
    // operates in Arabic and RTL changes layout rather than only strings.
    localeDefault: 'ar-AE',
    localesSupported: ['ar-AE', 'en-AE'],
    timezone: 'Asia/Dubai',
    // GCC-spec vehicles, grey imports and re-exports make VIN decoding
    // unreliable here, so the chassis number is a convenience and the system
    // leans on make/model/year plus the photograph.
    vehicleIdType: 'chassis',
    vehicleIdRegex: '^[A-HJ-NPR-Z0-9]{9,17}$',
    paymentProvider: 'stripe',
    courierProviders: ['metro_express', 'gulf_rapid', 'manual'],
    taxRate: '0.0500',
    taxLabel: 'VAT',
    taxInclusive: false,
    commissionRate: '0.1100',
    buyerFeeRate: '0.0300',
    deliveryMarkupRate: '0.2500',
    slaResponseMin: 15,
    slaOffersMin: 30,
    slaDeliveryMin: 90,
    selectionWindowMin: 120,
    wideningWindowMin: 45,
    autoConfirmHours: 24,
    financialRetentionYears: 5,
    // Street addressing is weak and Makani numbers and map pins are how people
    // actually navigate, so a delivery location is a pin and never typed text.
    addressModel: 'makani',
    weekendDays: [6, 0],
    isLive: true,
  },
  {
    // Market #2, month 11. Seeded not live so every abstraction is exercised.
    code: 'ZA',
    name: 'South Africa',
    currency: 'ZAR',
    currencyMinorUnitExp: 2,
    localeDefault: 'en-ZA',
    localesSupported: ['en-ZA'],
    timezone: 'Africa/Johannesburg',
    vehicleIdType: 'vin',
    vehicleIdRegex: '^[A-HJ-NPR-Z0-9]{17}$',
    // Placeholder. Stripe's ZA coverage is thin and the processor is chosen on
    // delayed-capture support first — confirmed before the South African launch.
    paymentProvider: 'paystack',
    courierProviders: ['manual'],
    taxRate: '0.1500',
    taxLabel: 'VAT',
    taxInclusive: false,
    commissionRate: '0.1100',
    buyerFeeRate: '0.0300',
    deliveryMarkupRate: '0.2500',
    slaResponseMin: 15,
    slaOffersMin: 30,
    slaDeliveryMin: 90,
    selectionWindowMin: 120,
    wideningWindowMin: 45,
    autoConfirmHours: 24,
    financialRetentionYears: 5,
    addressModel: 'street',
    weekendDays: [6, 0],
    isLive: false,
  },
];

export interface CitySeed {
  marketCode: string;
  name: string;
  lng: number;
  lat: number;
  radiusKm: number;
  isLive: boolean;
  launchDate: string | null;
}

export const CITIES: CitySeed[] = [
  // Dubai and Sharjah are roughly 25 km apart and form ONE serviceable delivery
  // zone: supply is weighted to Sharjah, demand to Dubai.
  { marketCode: 'AE', name: 'Dubai', lng: 55.2708, lat: 25.2048, radiusKm: 40, isLive: true, launchDate: null },
  { marketCode: 'AE', name: 'Sharjah', lng: 55.4033, lat: 25.3463, radiusKm: 35, isLive: true, launchDate: null },
  // 140 km from Dubai: a separate delivery zone with its own supply base, so a
  // second city rather than a co-launch.
  { marketCode: 'AE', name: 'Abu Dhabi', lng: 54.3773, lat: 24.4539, radiusKm: 45, isLive: false, launchDate: null },
  { marketCode: 'ZA', name: 'Johannesburg', lng: 28.0473, lat: -26.2041, radiusKm: 50, isLive: false, launchDate: null },
  { marketCode: 'ZA', name: 'Cape Town', lng: 18.4241, lat: -33.9249, radiusKm: 45, isLive: false, launchDate: null },
  { marketCode: 'ZA', name: 'Durban', lng: 31.0218, lat: -29.8587, radiusKm: 40, isLive: false, launchDate: null },
];

export interface PartCategorySeed {
  code: string;
  parent: string | null;
  en: string;
  ar: string;
  parcelClass: 'bike' | 'car' | 'van';
  highValue?: boolean;
}

/**
 * The part catalogue.
 *
 * Every name carries a real Arabic translation rather than a placeholder — the
 * supplier terminal is read in Arabic in Sharjah Industrial Area, and a category
 * a yard cannot read is a category they decline.
 *
 * `parcelClass` is on the category because it decides the courier quote. A tail
 * lamp is a bike delivery; a bonnet is a van. Quoting everything as a small
 * parcel makes courier margin wrong on exactly the high-value orders.
 */
export const PART_CATEGORIES: PartCategorySeed[] = [
  { code: 'lighting', parent: null, en: 'Lighting', ar: 'الإضاءة', parcelClass: 'bike' },
  { code: 'lighting.head_lamp.front_left', parent: 'lighting', en: 'Front left head lamp', ar: 'كشاف أمامي يسار', parcelClass: 'bike' },
  { code: 'lighting.head_lamp.front_right', parent: 'lighting', en: 'Front right head lamp', ar: 'كشاف أمامي يمين', parcelClass: 'bike' },
  { code: 'lighting.tail_lamp.rear_left', parent: 'lighting', en: 'Rear left tail lamp', ar: 'استوب خلفي يسار', parcelClass: 'bike' },
  { code: 'lighting.tail_lamp.rear_right', parent: 'lighting', en: 'Rear right tail lamp', ar: 'استوب خلفي يمين', parcelClass: 'bike' },
  { code: 'lighting.fog_lamp', parent: 'lighting', en: 'Fog lamp', ar: 'كشاف ضباب', parcelClass: 'bike' },
  { code: 'lighting.indicator', parent: 'lighting', en: 'Indicator lamp', ar: 'إشارة انعطاف', parcelClass: 'bike' },

  { code: 'body', parent: null, en: 'Body panels', ar: 'قطع الهيكل', parcelClass: 'van' },
  { code: 'body.bonnet', parent: 'body', en: 'Bonnet', ar: 'كبوت', parcelClass: 'van' },
  { code: 'body.boot_lid', parent: 'body', en: 'Boot lid', ar: 'غطاء الصندوق الخلفي', parcelClass: 'van' },
  { code: 'body.bumper_front', parent: 'body', en: 'Front bumper', ar: 'صدام أمامي', parcelClass: 'van' },
  { code: 'body.bumper_rear', parent: 'body', en: 'Rear bumper', ar: 'صدام خلفي', parcelClass: 'van' },
  { code: 'body.fender_left', parent: 'body', en: 'Left fender', ar: 'رفرف يسار', parcelClass: 'van' },
  { code: 'body.fender_right', parent: 'body', en: 'Right fender', ar: 'رفرف يمين', parcelClass: 'van' },
  { code: 'body.door_front_left', parent: 'body', en: 'Front left door', ar: 'باب أمامي يسار', parcelClass: 'van' },
  { code: 'body.door_front_right', parent: 'body', en: 'Front right door', ar: 'باب أمامي يمين', parcelClass: 'van' },
  { code: 'body.door_rear_left', parent: 'body', en: 'Rear left door', ar: 'باب خلفي يسار', parcelClass: 'van' },
  { code: 'body.door_rear_right', parent: 'body', en: 'Rear right door', ar: 'باب خلفي يمين', parcelClass: 'van' },
  { code: 'body.grille', parent: 'body', en: 'Radiator grille', ar: 'شبك أمامي', parcelClass: 'car' },

  { code: 'glass', parent: null, en: 'Glass', ar: 'الزجاج', parcelClass: 'car' },
  { code: 'glass.windscreen', parent: 'glass', en: 'Windscreen', ar: 'الزجاج الأمامي', parcelClass: 'van' },
  { code: 'glass.rear_screen', parent: 'glass', en: 'Rear screen', ar: 'الزجاج الخلفي', parcelClass: 'van' },
  { code: 'glass.door_glass', parent: 'glass', en: 'Door glass', ar: 'زجاج الباب', parcelClass: 'car' },

  { code: 'mirrors', parent: null, en: 'Mirrors', ar: 'المرايا', parcelClass: 'bike' },
  { code: 'mirrors.wing_left', parent: 'mirrors', en: 'Left wing mirror', ar: 'مرآة جانبية يسار', parcelClass: 'bike' },
  { code: 'mirrors.wing_right', parent: 'mirrors', en: 'Right wing mirror', ar: 'مرآة جانبية يمين', parcelClass: 'bike' },
  { code: 'mirrors.interior', parent: 'mirrors', en: 'Interior mirror', ar: 'مرآة داخلية', parcelClass: 'bike' },

  { code: 'engine', parent: null, en: 'Engine', ar: 'المحرك', parcelClass: 'van', highValue: true },
  { code: 'engine.complete', parent: 'engine', en: 'Complete engine', ar: 'محرك كامل', parcelClass: 'van', highValue: true },
  { code: 'engine.cylinder_head', parent: 'engine', en: 'Cylinder head', ar: 'رأس المحرك', parcelClass: 'van', highValue: true },
  { code: 'engine.turbocharger', parent: 'engine', en: 'Turbocharger', ar: 'تيربو', parcelClass: 'car', highValue: true },
  { code: 'engine.alternator', parent: 'engine', en: 'Alternator', ar: 'دينامو', parcelClass: 'car' },
  { code: 'engine.starter_motor', parent: 'engine', en: 'Starter motor', ar: 'سلف', parcelClass: 'car' },
  { code: 'engine.radiator', parent: 'engine', en: 'Radiator', ar: 'ردياتير', parcelClass: 'van' },

  { code: 'transmission', parent: null, en: 'Transmission', ar: 'ناقل الحركة', parcelClass: 'van', highValue: true },
  { code: 'transmission.gearbox_auto', parent: 'transmission', en: 'Automatic gearbox', ar: 'قير أوتوماتيك', parcelClass: 'van', highValue: true },
  { code: 'transmission.gearbox_manual', parent: 'transmission', en: 'Manual gearbox', ar: 'قير عادي', parcelClass: 'van', highValue: true },
  { code: 'transmission.differential', parent: 'transmission', en: 'Differential', ar: 'دفرنس', parcelClass: 'van', highValue: true },
  { code: 'transmission.drive_shaft', parent: 'transmission', en: 'Drive shaft', ar: 'عمود الدوران', parcelClass: 'van' },

  { code: 'suspension', parent: null, en: 'Suspension and steering', ar: 'التعليق والتوجيه', parcelClass: 'car' },
  { code: 'suspension.shock_absorber', parent: 'suspension', en: 'Shock absorber', ar: 'مساعد', parcelClass: 'car' },
  { code: 'suspension.control_arm', parent: 'suspension', en: 'Control arm', ar: 'مقص', parcelClass: 'car' },
  { code: 'suspension.steering_rack', parent: 'suspension', en: 'Steering rack', ar: 'علبة الدركسون', parcelClass: 'car' },
  { code: 'suspension.hub', parent: 'suspension', en: 'Wheel hub', ar: 'صرة العجلة', parcelClass: 'car' },

  { code: 'interior', parent: null, en: 'Interior', ar: 'المقصورة الداخلية', parcelClass: 'car' },
  { code: 'interior.seat', parent: 'interior', en: 'Seat', ar: 'كرسي', parcelClass: 'van' },
  { code: 'interior.dashboard', parent: 'interior', en: 'Dashboard', ar: 'طبلون', parcelClass: 'van' },
  { code: 'interior.steering_wheel', parent: 'interior', en: 'Steering wheel', ar: 'دركسون', parcelClass: 'car' },
  { code: 'interior.airbag', parent: 'interior', en: 'Airbag', ar: 'وسادة هوائية', parcelClass: 'car', highValue: true },

  { code: 'electrical', parent: null, en: 'Electrical and electronics', ar: 'الكهرباء والإلكترونيات', parcelClass: 'bike' },
  { code: 'electrical.ecu', parent: 'electrical', en: 'Engine control unit', ar: 'كمبيوتر المحرك', parcelClass: 'bike', highValue: true },
  { code: 'electrical.sensor', parent: 'electrical', en: 'Sensor', ar: 'حساس', parcelClass: 'bike' },
  { code: 'electrical.wiring_loom', parent: 'electrical', en: 'Wiring loom', ar: 'ضفيرة أسلاك', parcelClass: 'car' },
  { code: 'electrical.infotainment', parent: 'electrical', en: 'Infotainment screen', ar: 'شاشة الوسائط', parcelClass: 'bike' },
];

export interface VehicleSeed {
  make: string;
  model: string;
  variant: string | null;
  year: number;
  bodyType: string;
  engineCode: string | null;
}

/** Weighted to the UAE parc: this is what is actually on the roads and in the yards. */
export const VEHICLES: VehicleSeed[] = [
  { make: 'Nissan', model: 'Patrol', variant: '5.6 SE', year: 2019, bodyType: 'SUV', engineCode: 'VK56VD' },
  { make: 'Nissan', model: 'Patrol', variant: '4.0 XE', year: 2021, bodyType: 'SUV', engineCode: 'VQ40DE' },
  { make: 'Nissan', model: 'Sunny', variant: '1.5', year: 2018, bodyType: 'Sedan', engineCode: 'HR15DE' },
  { make: 'Toyota', model: 'Land Cruiser', variant: 'GXR 4.0', year: 2020, bodyType: 'SUV', engineCode: '1GR-FE' },
  { make: 'Toyota', model: 'Land Cruiser', variant: 'VXR 5.7', year: 2017, bodyType: 'SUV', engineCode: '3UR-FE' },
  { make: 'Toyota', model: 'Hilux', variant: '2.7 GL', year: 2019, bodyType: 'Pickup', engineCode: '2TR-FE' },
  { make: 'Toyota', model: 'Corolla', variant: '2.0 SE', year: 2021, bodyType: 'Sedan', engineCode: 'M20A-FKS' },
  { make: 'Toyota', model: 'Prado', variant: 'TXL 4.0', year: 2018, bodyType: 'SUV', engineCode: '1GR-FE' },
  { make: 'Mitsubishi', model: 'Pajero', variant: '3.5 GLS', year: 2018, bodyType: 'SUV', engineCode: '6G74' },
  { make: 'Mitsubishi', model: 'L200', variant: '2.4', year: 2020, bodyType: 'Pickup', engineCode: '4N15' },
  { make: 'Lexus', model: 'LX570', variant: 'Sport', year: 2019, bodyType: 'SUV', engineCode: '3UR-FE' },
  { make: 'Lexus', model: 'ES350', variant: 'Platinum', year: 2020, bodyType: 'Sedan', engineCode: '2GR-FKS' },
  { make: 'Ford', model: 'Explorer', variant: '3.5 XLT', year: 2019, bodyType: 'SUV', engineCode: 'Duratec 35' },
  { make: 'Ford', model: 'F-150', variant: '5.0 XLT', year: 2018, bodyType: 'Pickup', engineCode: 'Coyote' },
  { make: 'Hyundai', model: 'Elantra', variant: '1.6 Smart', year: 2021, bodyType: 'Sedan', engineCode: 'G4FG' },
  { make: 'Hyundai', model: 'Tucson', variant: '2.0', year: 2019, bodyType: 'SUV', engineCode: 'G4NA' },
  { make: 'Kia', model: 'Sportage', variant: '2.4 LX', year: 2020, bodyType: 'SUV', engineCode: 'G4KE' },
  { make: 'Kia', model: 'Cerato', variant: '1.6', year: 2018, bodyType: 'Sedan', engineCode: 'G4FG' },
  { make: 'Chevrolet', model: 'Tahoe', variant: '5.3 LS', year: 2017, bodyType: 'SUV', engineCode: 'L83' },
  { make: 'Honda', model: 'Accord', variant: '2.4 EX', year: 2018, bodyType: 'Sedan', engineCode: 'K24W' },
];

export interface SupplierSeed {
  businessName: string;
  city: string;
  area: string;
  lng: number;
  lat: number;
  makes: string[];
  models: string[];
  yearFrom: number | null;
  yearTo: number | null;
  partCategories: string[];
  maxRadiusKm: number;
  score: string;
  responseRate: string;
  medianResponseS: number | null;
  fulfilmentRate: string;
  status: 'onboarding' | 'active' | 'suspended';
  onboardingStage: 'signed' | 'tablet_installed' | 'profile_configured' | 'test_request_passed';
  verified: boolean;
  tabletSerial: string | null;
}

/**
 * Test suppliers.
 *
 * Deliberately varied. Identical stock profiles at identical coordinates make
 * the matching engine look like it works when it does not: every supplier scores
 * the same, so any ordering appears correct. These differ on make coverage,
 * radius, distance from the demand side, score and onboarding stage — including
 * two that are NOT yet activated, because a signed yard with an unconfigured
 * tablet is a dead terminal and the pipeline has to show that.
 */
export const SUPPLIERS: SupplierSeed[] = [
  {
    businessName: 'Al Sajaa Auto Dismantlers',
    city: 'Sharjah',
    area: 'Al Sajaa',
    lng: 55.5619,
    lat: 25.3799,
    makes: ['Nissan', 'Toyota', 'Mitsubishi'],
    models: [],
    yearFrom: 2010,
    yearTo: 2024,
    partCategories: ['lighting', 'body', 'glass', 'mirrors'],
    maxRadiusKm: 60,
    score: '4.60',
    responseRate: '0.9200',
    medianResponseS: 140,
    fulfilmentRate: '0.8800',
    status: 'active',
    onboardingStage: 'test_request_passed',
    verified: true,
    tabletSerial: 'NTY-AE-0001',
  },
  {
    businessName: 'Industrial Area 4 Used Parts',
    city: 'Sharjah',
    area: 'Sharjah Industrial Area',
    lng: 55.4078,
    lat: 25.3208,
    makes: ['Toyota', 'Lexus'],
    models: ['Land Cruiser', 'Prado', 'LX570'],
    yearFrom: 2014,
    yearTo: 2024,
    partCategories: ['engine', 'transmission', 'suspension', 'body'],
    maxRadiusKm: 45,
    score: '4.20',
    responseRate: '0.8400',
    medianResponseS: 210,
    fulfilmentRate: '0.8100',
    status: 'active',
    onboardingStage: 'test_request_passed',
    verified: true,
    tabletSerial: 'NTY-AE-0002',
  },
  {
    businessName: 'Gulf Spare Centre',
    city: 'Sharjah',
    area: 'Sharjah Industrial Area',
    lng: 55.3925,
    lat: 25.3305,
    makes: [],
    models: [],
    yearFrom: null,
    yearTo: null,
    partCategories: ['lighting', 'electrical', 'mirrors', 'interior'],
    maxRadiusKm: 30,
    score: '3.10',
    responseRate: '0.4100',
    medianResponseS: 620,
    fulfilmentRate: '0.5500',
    status: 'active',
    onboardingStage: 'test_request_passed',
    verified: true,
    tabletSerial: 'NTY-AE-0003',
  },
  {
    businessName: 'Ras Al Khor Motors Recycling',
    city: 'Dubai',
    area: 'Ras Al Khor',
    lng: 55.3406,
    lat: 25.1852,
    makes: ['Ford', 'Chevrolet', 'Hyundai', 'Kia'],
    models: [],
    yearFrom: 2012,
    yearTo: 2023,
    partCategories: ['body', 'lighting', 'engine', 'glass'],
    maxRadiusKm: 50,
    score: '4.05',
    responseRate: '0.7800',
    medianResponseS: 265,
    fulfilmentRate: '0.7900',
    status: 'active',
    onboardingStage: 'test_request_passed',
    verified: true,
    tabletSerial: 'NTY-AE-0004',
  },
  {
    businessName: 'Al Aweer Parts Traders',
    city: 'Dubai',
    area: 'Al Aweer',
    lng: 55.4247,
    lat: 25.1739,
    makes: ['Nissan'],
    models: ['Patrol', 'Sunny'],
    yearFrom: 2008,
    yearTo: 2022,
    partCategories: ['engine', 'transmission', 'suspension'],
    maxRadiusKm: 25,
    score: '3.80',
    responseRate: '0.6900',
    medianResponseS: 330,
    fulfilmentRate: '0.7200',
    status: 'active',
    onboardingStage: 'test_request_passed',
    verified: true,
    tabletSerial: 'NTY-AE-0005',
  },
  {
    businessName: 'Jebel Ali Vehicle Recyclers',
    city: 'Dubai',
    area: 'Jebel Ali',
    lng: 55.0272,
    lat: 24.9857,
    makes: ['Toyota', 'Honda', 'Hyundai'],
    models: [],
    yearFrom: 2015,
    yearTo: 2024,
    partCategories: ['lighting', 'mirrors', 'glass', 'interior', 'electrical'],
    maxRadiusKm: 70,
    score: '4.75',
    responseRate: '0.9500',
    medianResponseS: 95,
    fulfilmentRate: '0.9100',
    status: 'active',
    onboardingStage: 'test_request_passed',
    verified: true,
    tabletSerial: 'NTY-AE-0006',
  },
  {
    // Signed, tablet delivered, stock profile never configured. A dead terminal:
    // it inflates the supply count and contributes nothing to fill rate.
    businessName: 'Sharjah Industrial Area 12 Breakers',
    city: 'Sharjah',
    area: 'Sharjah Industrial Area',
    lng: 55.4412,
    lat: 25.3081,
    makes: [],
    models: [],
    yearFrom: null,
    yearTo: null,
    partCategories: [],
    maxRadiusKm: 50,
    score: '3.00',
    responseRate: '0.0000',
    medianResponseS: null,
    fulfilmentRate: '0.0000',
    status: 'onboarding',
    onboardingStage: 'tablet_installed',
    verified: false,
    tabletSerial: 'NTY-AE-0007',
  },
  {
    // Signed only. No tablet, no profile, no test request.
    businessName: 'Al Quoz Dismantling Works',
    city: 'Dubai',
    area: 'Al Quoz',
    lng: 55.2333,
    lat: 25.1417,
    makes: ['Mercedes-Benz', 'BMW', 'Audi'],
    models: [],
    yearFrom: 2012,
    yearTo: 2022,
    partCategories: ['body', 'lighting'],
    maxRadiusKm: 40,
    score: '3.00',
    responseRate: '0.0000',
    medianResponseS: null,
    fulfilmentRate: '0.0000',
    status: 'onboarding',
    onboardingStage: 'signed',
    verified: false,
    tabletSerial: null,
  },
];

export interface BuyerSeed {
  businessName: string;
  area: string;
  type: 'workshop' | 'panelbeater' | 'fleet' | 'consumer';
  lng: number;
  lat: number;
}

export const BUYERS: BuyerSeed[] = [
  { businessName: 'Al Quoz Auto Body Works', area: 'Al Quoz', type: 'panelbeater', lng: 55.2416, lat: 25.1499 },
  { businessName: 'Al Qusais Service Centre', area: 'Al Qusais', type: 'workshop', lng: 55.3819, lat: 25.2842 },
  { businessName: 'Emirates Fleet Maintenance', area: 'Al Quoz', type: 'fleet', lng: 55.2288, lat: 25.1338 },
];
