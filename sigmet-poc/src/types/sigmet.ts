export type PhenomenonType = 'EMBD_TS' | 'SEV_ICE' | string;
export type IntensityChangeType = 'INTENSIFY' | 'WEAKEN' | 'NO_CHANGE' | null;

export interface GeometryPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // [ [ [lon, lat], ... ] ]
}

export interface CancelledSigmetReference {
  sequenceNumber: string;
  validStart: string;
  validEnd: string;
  phenomenonName: string;
  flightLevel: string;
  rawTac: string;
  geometry: GeometryPolygon;
}

export interface CancellationInfo {
  cancelledAt: string;
  cancellationSeq: string;
  cancellationTac: string;
}

export interface SigmetRecord {
  filePath: string;
  fileName: string;
  issueTime: string; // ISO string e.g. "2026-05-01T06:45:00Z"
  firCode: string; // "WSJC" | "WIIF"
  firName: string;
  sequenceNumber: string; // "A01", "B01", etc.
  validStart: string; // ISO string e.g. "2026-05-01T06:50:00Z"
  validEnd: string; // ISO string e.g. "2026-05-01T09:50:00Z"
  isCancel: boolean;
  cancelledSeq: string | null;
  cancelledValidStart: string | null;
  cancelledValidEnd: string | null;
  phenomenonCode: PhenomenonType;
  phenomenonName: string;
  flightLevel: string; // "TOP FL540", "FL190", etc.
  motionDirectionDeg: number | null; // e.g. 270.0
  motionDirectionText: string | null; // "W", "STNR", etc.
  motionSpeedKt: number | null; // 5, 10, etc.
  intensityChange: IntensityChangeType;
  geometry: GeometryPolygon;
  rawTac: string;
  cancellationInfo?: CancellationInfo;
  cancelledSigmetRef?: CancelledSigmetReference;
}
