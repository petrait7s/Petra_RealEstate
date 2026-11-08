import { z } from "zod";
import { Money } from "./money.js";

export const PropertyType = z.enum(["apartment", "house", "land", "commercial", "plot"]);
export const ListingKind = z.enum(["sale", "rent"]);
export const ListingStatus = z.enum(["draft", "active", "reserved", "closed", "expired"]);

/** Physical thing. Not an offer. */
export const Property = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: PropertyType,
  title: z.string().min(1),
  address: z.string(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  areaSqft: z.number().positive().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  /** per-org custom fields (mouza, khatian, dolil...) */
  attributes: z.record(z.unknown()).default({}),
});
export type Property = z.infer<typeof Property>;

/** Time-bound sale/rent offer on a Property. */
export const Listing = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  propertyId: z.string().uuid(),
  kind: ListingKind,
  status: ListingStatus,
  price: Money,
  expiresAt: z.string().datetime().optional(),
});
export type Listing = z.infer<typeof Listing>;
