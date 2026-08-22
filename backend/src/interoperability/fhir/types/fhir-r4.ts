export type FHIRResourceType =
  | 'Patient'
  | 'Practitioner'
  | 'Organization'
  | 'PractitionerRole'
  | 'Encounter'
  | 'DiagnosticReport'
  | 'Observation'
  | 'MedicationRequest'
  | 'DocumentReference'
  | 'Bundle';

export interface FHIRResource {
  resourceType: FHIRResourceType;
  id?: string;
  meta?: {
    lastUpdated?: string;
    source?: string;
  };
}

export interface Identifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  system?: string;
  value?: string;
}

export interface CodeableConcept {
  coding?: {
    system?: string;
    code?: string;
    display?: string;
  }[];
  text?: string;
}

export interface Reference {
  reference?: string;
  type?: string;
  display?: string;
}

export interface Patient extends FHIRResource {
  resourceType: 'Patient';
  identifier?: Identifier[];
  name?: { use?: string; text?: string; family?: string; given?: string[] }[];
  telecom?: { system?: string; value?: string; use?: string }[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
}

export interface Organization extends FHIRResource {
  resourceType: 'Organization';
  identifier?: Identifier[];
  active?: boolean;
  name?: string;
  telecom?: { system?: string; value?: string; use?: string }[];
}

export interface Practitioner extends FHIRResource {
  resourceType: 'Practitioner';
  identifier?: Identifier[];
  active?: boolean;
  name?: { use?: string; text?: string; family?: string; given?: string[] }[];
}

export interface PractitionerRole extends FHIRResource {
  resourceType: 'PractitionerRole';
  active?: boolean;
  practitioner?: Reference;
  organization?: Reference;
}

export interface Encounter extends FHIRResource {
  resourceType: 'Encounter';
  identifier?: Identifier[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class: { system: string; code: string };
  subject?: Reference;
  participant?: { individual?: Reference }[];
  period?: { start?: string; end?: string };
  serviceProvider?: Reference;
  location?: { location?: Reference }[];
}

export interface DiagnosticReport extends FHIRResource {
  resourceType: 'DiagnosticReport';
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  code: CodeableConcept;
  subject?: Reference;
  effectiveDateTime?: string;
  issued?: string;
  performer?: Reference[];
  result?: Reference[];
}

export interface Observation extends FHIRResource {
  resourceType: 'Observation';
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  code: CodeableConcept;
  subject?: Reference;
  effectiveDateTime?: string;
  performer?: Reference[];
  valueQuantity?: { value: number; unit: string; system?: string; code?: string };
  valueString?: string;
  referenceRange?: { low?: { value: number }; high?: { value: number }; text?: string }[];
}

export interface MedicationRequest extends FHIRResource {
  resourceType: 'MedicationRequest';
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  medicationCodeableConcept: CodeableConcept;
  subject: Reference;
  encounter?: Reference;
  authoredOn?: string;
  requester?: Reference;
  dosageInstruction?: { text?: string }[];
}

export interface DocumentReference extends FHIRResource {
  resourceType: 'DocumentReference';
  status: 'current' | 'superseded' | 'entered-in-error';
  type?: CodeableConcept;
  subject?: Reference;
  date?: string;
  author?: Reference[];
  content: {
    attachment: {
      contentType?: string;
      url?: string;
      hash?: string;
      title?: string;
      creation?: string;
    };
  }[];
}

export interface Bundle extends FHIRResource {
  resourceType: 'Bundle';
  type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  timestamp?: string;
  total?: number;
  entry?: {
    fullUrl?: string;
    resource: FHIRResource;
  }[];
}
