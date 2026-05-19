export interface SupportDoc {
  id: string;
  title: string;
  description: string;
  primaryKeyword: string;
  keywordVariant: string;
  route: string;
  relatedPaths: string[];
  headings: string[];
  faq_questions: string[];
  body: string;
}
