import type { ParcelClass } from './types.js';

/**
 * Parcel classing.
 *
 * A tail lamp is a bike delivery. A bonnet, a bumper or a gearbox is a van. If
 * every order is quoted as a small parcel, courier margin is wrong on exactly
 * the high-value orders where it looked like it was being made.
 *
 * The mapping lives on the part-category row (`parcel_class`) so it is data, not
 * code; these are the defaults the catalogue is seeded with and the fallback
 * used when a category has no explicit class.
 */
export const PARCEL_CLASSES: readonly ParcelClass[] = ['bike', 'car', 'van'];

export const PARCEL_CLASS_BY_CATEGORY_PREFIX: Readonly<Record<string, ParcelClass>> = {
  lighting: 'bike',
  mirrors: 'bike',
  electrical: 'bike',
  interior: 'car',
  glass: 'car',
  suspension: 'car',
  body: 'van',
  engine: 'van',
  transmission: 'van',
};

export const DEFAULT_PARCEL_CLASS: ParcelClass = 'car';

/** Resolve a parcel class from a dotted category code such as `body.bonnet`. */
export function parcelClassForCategoryCode(code: string): ParcelClass {
  const root = code.split('.')[0] ?? '';
  return PARCEL_CLASS_BY_CATEGORY_PREFIX[root] ?? DEFAULT_PARCEL_CLASS;
}

/** Relative cost weighting used by the stub couriers and by margin forecasting. */
export const PARCEL_CLASS_WEIGHT: Readonly<Record<ParcelClass, number>> = {
  bike: 1,
  car: 1.8,
  van: 3.2,
};
