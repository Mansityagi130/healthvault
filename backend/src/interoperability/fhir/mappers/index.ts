import * as FHIR from '../types/fhir-r4.js';

// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
export function mapPatient(user: any, profile: any): FHIR.Patient {
  const patient: FHIR.Patient = {
    resourceType: 'Patient',
    id: user.id,
    name: [
      {
        text: user.name,
      },
    ],
    telecom: [
      { system: 'email', value: user.email },
    ],
  };

  if (profile.abhaAddress) {
    patient.identifier = [
      {
        system: 'https://ndhm.gov.in/abha',
        value: profile.abhaAddress,
      },
    ];
  }

  return patient;
}

// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
export function mapPractitioner(user: any, profile?: any): FHIR.Practitioner {
  const practitioner: FHIR.Practitioner = {
    resourceType: 'Practitioner',
    id: user.id,
    active: true,
    name: [{ text: user.name }],
  };

  if (profile?.medicalRegNo) {
    practitioner.identifier = [
      {
        system: 'https://ndhm.gov.in/regno',
        value: profile.medicalRegNo,
      },
    ];
  }
  return practitioner;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
export function mapOrganization(org: any): FHIR.Organization {
  return {
    resourceType: 'Organization',
    id: org.id,
    name: org.name,
    active: true,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
export function mapEncounter(encounter: any): FHIR.Encounter {
  const statusMap: Record<string, FHIR.Encounter['status']> = {
    SCHEDULED: 'planned',
    CHECKED_IN: 'arrived',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'finished',
    CANCELLED: 'cancelled',
  };

  const fhirEncounter: FHIR.Encounter = {
    resourceType: 'Encounter',
    id: encounter.id,
    status: statusMap[encounter.status] || 'unknown',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: encounter.type === 'INPATIENT' ? 'IMP' : 'AMB' },
    subject: { reference: `Patient/${encounter.patientId}` },
    serviceProvider: { reference: `Organization/${encounter.hospitalId}` },
  };

  if (encounter.providerId) {
    fhirEncounter.participant = [{ individual: { reference: `Practitioner/${encounter.providerId}` } }];
  }

  if (encounter.startedAt || encounter.endedAt) {
    fhirEncounter.period = {};
    if (encounter.startedAt) fhirEncounter.period.start = new Date(encounter.startedAt).toISOString();
    if (encounter.endedAt) fhirEncounter.period.end = new Date(encounter.endedAt).toISOString();
  }

  return fhirEncounter;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
export function mapDiagnosticReport(report: any): FHIR.DiagnosticReport {
  const statusMap: Record<string, FHIR.DiagnosticReport['status']> = {
    DRAFT: 'preliminary',
    FINALIZED: 'final',
    CANCELLED: 'cancelled',
  };

  return {
    resourceType: 'DiagnosticReport',
    id: report.id,
    status: statusMap[report.status] || 'unknown',
    code: { text: report.testName || 'Laboratory Report' },
    subject: { reference: `Patient/${report.patientId}` },
    performer: [{ reference: `Organization/${report.labId}` }],
    issued: new Date(report.updatedAt).toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
export function mapObservation(result: any, patientId: string): FHIR.Observation {
  const statusMap: Record<string, FHIR.Observation['status']> = {
    NORMAL: 'final',
    ABNORMAL: 'final',
    CRITICAL: 'final',
    PENDING: 'preliminary',
    ERROR: 'entered-in-error',
  };

  const obs: FHIR.Observation = {
    resourceType: 'Observation',
    id: result.id,
    status: statusMap[result.status] || 'unknown',
    code: { text: result.testName },
    subject: { reference: `Patient/${patientId}` },
  };

  if (result.valueType === 'NUMERIC' && result.value) {
    obs.valueQuantity = {
      value: parseFloat(result.value),
      unit: result.unit || '',
    };
  } else if (result.value) {
    obs.valueString = result.value;
  }

  if (result.referenceRange) {
    obs.referenceRange = [{ text: result.referenceRange }];
  }

  return obs;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
export function mapMedicationRequest(prescription: any, encounterId: string, patientId: string): FHIR.MedicationRequest[] {
  const items = Array.isArray(prescription.items) ? prescription.items : [];
  
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
  return items.map((item: any, idx: number) => {
    return {
      resourceType: 'MedicationRequest',
      id: `${prescription.id}-${idx}`,
      status: 'active',
      intent: 'order',
      subject: { reference: `Patient/${patientId}` },
      encounter: { reference: `Encounter/${encounterId}` },
      medicationCodeableConcept: { text: item.name || 'Unknown Medication' },
      dosageInstruction: [
        { text: `${item.dosage || ''} ${item.frequency || ''} ${item.duration || ''}`.trim() }
      ],
      authoredOn: new Date(prescription.createdAt).toISOString(),
    } as FHIR.MedicationRequest;
  });
}

// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
export function mapDocumentReference(document: any, patientId: string, source: any): FHIR.DocumentReference | null {
  if (document.securityStatus !== 'CLEAN') {
    return null;
  }

  const docRef: FHIR.DocumentReference = {
    resourceType: 'DocumentReference',
    id: document.id,
    status: 'current',
    subject: { reference: `Patient/${patientId}` },
    date: new Date(document.createdAt).toISOString(),
    content: [
      {
        attachment: {
          contentType: document.mimeType,
          title: document.originalFilename,
          creation: new Date(document.createdAt).toISOString(),
          url: `/api/records/documents/${document.id}/download`,
        },
      },
    ],
    meta: {
      source: source === 'PATIENT_UPLOADED' ? 'urn:source:patient' :
              source === 'EXTERNAL_IMPORTED' ? 'urn:source:external' :
              'urn:source:verified'
    }
  };

  return docRef;
}
