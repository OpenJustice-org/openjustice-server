/** Matches the Prisma select shape from WantedPerson queries */
export interface WantedPersonResult {
  name: string;
  charges: string[];
  dangerLevel: string;
  lastSeenLocation: string | null;
}

/** Matches the Prisma select shape from AmberAlert queries */
export interface MissingPersonResult {
  personName: string;
  age: number | null;
  lastSeenLocation: string | null;
  contactPhone: string;
}

/** Matches the Prisma select shape from Person background check queries */
export interface BackgroundCheckResult {
  firstName: string;
  lastName: string;
  isWanted: boolean;
  cases: { role: string }[];
}

/** Matches the Prisma select shape from Vehicle queries */
export interface VehicleResult {
  licensePlate: string;
  vehicleType: string;
  make: string | null;
  model: string | null;
  color: string | null;
  status: string;
  ownerName: string | null;
}

/** Matches the shape from stolen property identifier queries */
export interface StolenPropertyResult {
  type: string;
  value: string;
  stolenProperty: {
    referenceNumber: string;
    brand: string | null;
    model: string | null;
    status: string;
    propertyType: { name: string };
    station: { name: string };
  };
}

/** Whapi interactive list message payload */
export interface WhapiListMessage {
  to: string;
  type: 'list';
  header?: { type: 'text'; text: string } | { media: string };
  body: { text: string };
  footer?: { text: string };
  action: {
    list: {
      label: string;
      sections: {
        title: string;
        rows: {
          id: string;
          title: string;
          description?: string;
        }[];
      }[];
    };
  };
}
