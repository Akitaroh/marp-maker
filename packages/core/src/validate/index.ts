/**
 * @akitaroh/marp-core/validate
 *
 * 視覚検証ループ (Atom-IssueDetector + Atom-FixSuggester)。
 */

export { detectIssues } from './issue-detector'
export type {
  Issue,
  IssueType,
  Severity,
  DetectInput,
  IssueDetectorOptions,
  RendererFn,
} from './issue-detector'

export { suggestFix, SuggesterError } from './fix-suggester'
export type {
  SuggestInput,
  SuggestedMarp,
  SuggesterOptions,
  SuggesterErrorKind,
} from './fix-suggester'
