export interface Entity {
  id: string;
  name: string;
  entityType: "organization" | "person";
  confidence: number;
  createdAt: string;
  updatedAt: string;
  phone?: string;
  email?: string;
  address?: Address;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface Person extends Entity {
  entityType: "person";
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
}

export interface Organization extends Entity {
  entityType: "organization";
  industry?: string;
  size?: string;
  website?: string;
}

export interface EntityProperty {
  key: string;
  value: string;
  confidence: number;
}

export interface DuplicateGroup {
  id: string;
  entities: Entity[];
  confidence: number;
  suggestedMerge: string;
}
