// Names for the generated schema types (src/schema/generated/types.ts).
import type {
  Distribution,
  PortaRegulusRiskRegisterExchangeDocument,
  Register,
  ResponseOption,
  Risk,
  RiskDetail,
  ScaleBand,
} from './generated/types';

export type RiskDocument = PortaRegulusRiskRegisterExchangeDocument;
export type { Distribution, Register, ResponseOption, Risk, RiskDetail, ScaleBand };

export type NistRegisterEntry = Pick<
  Risk,
  | 'riskId'
  | 'riskDescription'
  | 'riskCategory'
  | 'riskLikelihood'
  | 'riskImpact'
  | 'exposureRating'
  | 'riskResponseType'
  | 'riskResponseCost'
  | 'riskResponseDescription'
  | 'riskOwnerPointOfContact'
  | 'status'
>;

export interface Finding {
  readonly rule: string;
  readonly message: string;
  readonly riskIds?: readonly string[];
}
