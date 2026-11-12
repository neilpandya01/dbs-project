/** One flight found by the lookup, in the shape the form uses (shared by the server and the browser). */
export type LookupFlight = {
  /** "UA 2679" */
  number: string;
  airline?: string;
  aircraft?: string;
  registration?: string;
  /** 3-letter airport codes */
  from: string;
  to: string;
  fromCity?: string;
  toCity?: string;
  /** Scheduled local clock times like "5:15 PM" */
  depTime?: string;
  arrTime?: string;
  /** The exact moments (ISO, UTC) and each airport's time zone, so times can be shown as local clocks. */
  depAt?: string;
  arrAt?: string;
  depTz?: string;
  arrTz?: string;
};

export type LookupStatus = {
  /** false = lookups are switched off right now, so the form goes straight to manual entry */
  available: boolean;
  reason?: "quota" | "user_limit" | "not_configured";
};

export type LookupResult =
  | { status: "ok"; flights: LookupFlight[] }
  | { status: "none" }
  | { status: "unavailable"; reason: NonNullable<LookupStatus["reason"]> }
  | { status: "error"; message: string };
