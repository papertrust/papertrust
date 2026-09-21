export type ReproductionResult =
  | "reproduced"
  | "partially_reproduced"
  | "not_reproduced"
  | "inconclusive";

export type RecordType =
  | "reproduction"
  | "artifact_review"
  | "correction"
  | "author_response"
  | "retraction";

export interface PaperTrustRecord {
  type: RecordType;
  paper_version?: string;
  result?: string;
  tags?: string[];
  summary: string;
  evidence?: string[];
}

export interface PaperTrustData {
  records: PaperTrustRecord[];
}

export interface ArxivAuthor {
  name: string;
}

export interface ArxivPaper {
  id: string;
  latestVersion: string;
  title: string;
  summary: string;
  authors: ArxivAuthor[];
  published: string;
  updated: string;
  categories: string[];
  pdfUrl: string;
  absUrl: string;
}
