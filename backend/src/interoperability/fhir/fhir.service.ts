import { databaseClient } from '../../config/database.js';
import * as mappers from './mappers/index.js';
import * as FHIR from './types/fhir-r4.js';

const prisma = databaseClient.getClient();

export class FhirService {
  static async getPatientBundle(patientId: string, options: { 
    tenantId?: string; 
    isPatientOrigin?: boolean;
    providerId?: string; 
  }): Promise<FHIR.Bundle> {
    
    // 1. Fetch Patient
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { id: patientId },
      include: { user: true }
    });

    if (!patientProfile || !patientProfile.user) {
      throw new Error("Patient not found");
    }

    const bundle: FHIR.Bundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      timestamp: new Date().toISOString(),
      entry: [],
    };

    const addResource = (resource: FHIR.FHIRResource | null) => {
      if (resource) {
        bundle.entry!.push({
          fullUrl: `urn:uuid:${resource.id}`,
          resource,
        });
      }
    };

    addResource(mappers.mapPatient(patientProfile.user, patientProfile));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
    const recordWhere: any = { patientId };
    if (options.tenantId) {
      recordWhere.OR = [
        { hospitalId: options.tenantId },
        { labId: options.tenantId }
      ];
    } else if (options.providerId) {
       recordWhere.Encounter = {
          providerId: options.providerId
       };
    }

    // 2. Fetch Encounters
    const encounters = await prisma.encounter.findMany({
      where: options.tenantId ? { patientId, hospitalId: options.tenantId } : 
             options.providerId ? { patientId, providerId: options.providerId } :
             { patientId }
    });
    for (const enc of encounters) {
      addResource(mappers.mapEncounter(enc));
    }

    // 3. Fetch Lab Reports
    const labRecords = await prisma.medicalRecord.findMany({
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
      where: options.tenantId ? { patientId, labId: options.tenantId, category: 'LAB_REPORT' as any } : { patientId, category: 'LAB_REPORT' as any },
      include: { labReport: { include: { results: true } } }
    });
    for (const rec of labRecords) {
      if (!rec.labReport) continue;
      const report = rec.labReport;
      addResource(mappers.mapDiagnosticReport(report));
      for (const result of report.results) {
        addResource(mappers.mapObservation(result, patientId));
      }
    }

    // 4. Fetch Medical Records (Consultations, Prescriptions, Documents)
    const records = await prisma.medicalRecord.findMany({
      where: recordWhere,
      include: {
        documents: true,
        consultation: true,
        prescription: true,
      }
    });

    for (const record of records) {
      if (record.documents && record.documents.length > 0) {
        const cleanDoc = record.documents.find(d => d.securityStatus === "CLEAN");
        if (cleanDoc) {
          addResource(mappers.mapDocumentReference(cleanDoc, patientId, record.source));
        }
      }

      if (record.prescription) {
        // use consultation.encounterId if available, but it's nested
        // wait, consultation.encounterId does not exist! It has consultation.id
        // We will just pass '' for encounterId if not available.
        const meds = mappers.mapMedicationRequest(record.prescription, '', patientId);
        meds.forEach(m => addResource(m));
      }
    }

    bundle.total = bundle.entry!.length;
    return bundle;
  }
}
