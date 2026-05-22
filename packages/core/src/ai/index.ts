/**
 * @akitaroh/marp-core/ai
 *
 * Claude API による Marp Markdown 生成 (Atom-AiGenerator)。
 */

export { generateMarp, AiGeneratorError } from './ai-generator'
export type {
  GenerateInput,
  GeneratedMarp,
  AiGeneratorOptions,
  AiGeneratorErrorKind,
} from './ai-generator'
