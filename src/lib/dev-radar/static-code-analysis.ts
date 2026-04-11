import 'server-only'

import ts from 'typescript'

import type {
  StaticAnalysisFinding,
  StaticAnalysisRuleScore,
  StaticCodeAnalysis,
} from '@/types/dev-radar'

type RepositoryCodeSample = {
  path: string
  language: string
  snippet: string
  truncated: boolean
}

type FunctionStats = {
  path: string
  name: string
  lineCount: number
  parameterCount: number
  complexity: number
  nestingDepth: number
  hasErrorHandling: boolean
  hasValidation: boolean
}

type AggregateStats = {
  analyzableFiles: number
  identifierTotal: number
  wellNamedIdentifiers: number
  functionCount: number
  longFunctionCount: number
  parameterHeavyFunctionCount: number
  complexFunctionCount: number
  deeplyNestedFunctionCount: number
  functionsWithErrorHandling: number
  functionsWithValidation: number
  importExportRichFiles: number
  largeFileSignals: number
  functions: FunctionStats[]
  findings: StaticAnalysisFinding[]
}

const SUPPORTED_LANGUAGES = new Set(['TypeScript', 'TSX', 'JavaScript', 'JSX'])
const RULE_WEIGHTS: Array<{
  key: StaticAnalysisRuleScore['key']
  label: string
  weight: number
}> = [
  { key: 'naming', label: 'Naming', weight: 0.2 },
  { key: 'singleResponsibility', label: 'Single Responsibility', weight: 0.2 },
  { key: 'complexity', label: 'Complexity', weight: 0.16 },
  { key: 'errorHandling', label: 'Error Handling', weight: 0.15 },
  { key: 'validation', label: 'Validation', weight: 0.14 },
  { key: 'modularity', label: 'Modularity', weight: 0.15 },
]
const COMMON_SHORT_NAMES = new Set([
  'i',
  'j',
  'k',
  'x',
  'y',
  'z',
  'id',
  'el',
  'err',
  'req',
  'res',
  'ctx',
  'e',
])

export function analyzeRepositoryStaticCode(
  codeSamples: RepositoryCodeSample[],
): StaticCodeAnalysis | null {
  if (codeSamples.length === 0) {
    return null
  }

  const aggregate: AggregateStats = {
    analyzableFiles: 0,
    identifierTotal: 0,
    wellNamedIdentifiers: 0,
    functionCount: 0,
    longFunctionCount: 0,
    parameterHeavyFunctionCount: 0,
    complexFunctionCount: 0,
    deeplyNestedFunctionCount: 0,
    functionsWithErrorHandling: 0,
    functionsWithValidation: 0,
    importExportRichFiles: 0,
    largeFileSignals: 0,
    functions: [],
    findings: [],
  }

  for (const sample of codeSamples) {
    if (!SUPPORTED_LANGUAGES.has(sample.language)) {
      continue
    }

    aggregate.analyzableFiles += 1
    analyzeTypeScriptLikeSample(sample, aggregate)
  }

  if (aggregate.analyzableFiles === 0) {
    return {
      analyzer: 'typescript-ast-heuristic-v1',
      sampledFiles: codeSamples.length,
      analyzableFiles: 0,
      averageScore: 0,
      coverageSummary: '샘플 코드가 수집되었지만 현재 정적 분석기는 TS/JS 계열 파일만 분석합니다.',
      rules: RULE_WEIGHTS.map((rule) => ({
        ...rule,
        score: 0,
        evidence: '지원 언어 코드 샘플이 부족합니다.',
      })),
      findings: [],
    }
  }

  const ruleScores = buildRuleScores(aggregate)
  const averageScore = clamp(
    Math.round(
      ruleScores.reduce((sum, rule) => sum + rule.score * rule.weight, 0),
    ),
    0,
    100,
  )

  return {
    analyzer: 'typescript-ast-heuristic-v1',
    sampledFiles: codeSamples.length,
    analyzableFiles: aggregate.analyzableFiles,
    averageScore,
    coverageSummary: `${aggregate.analyzableFiles}/${codeSamples.length} sampled files were statically analyzed.`,
    rules: ruleScores,
    findings: aggregate.findings.slice(0, 5),
  }
}

function analyzeTypeScriptLikeSample(
  sample: RepositoryCodeSample,
  aggregate: AggregateStats,
) {
  const sourceFile = ts.createSourceFile(
    sample.path,
    sample.snippet,
    ts.ScriptTarget.Latest,
    true,
    resolveScriptKind(sample.path),
  )
  const identifiers = new Map<string, 'function' | 'variable' | 'class'>()
  let importCount = 0
  let exportCount = 0

  walk(sourceFile, 0)

  const identifierEntries = Array.from(identifiers.entries())
  aggregate.identifierTotal += identifierEntries.length
  aggregate.wellNamedIdentifiers += identifierEntries.filter(([name, kind]) =>
    isWellNamedIdentifier(name, kind),
  ).length

  if (sample.truncated || sample.snippet.split('\n').length >= 70) {
    aggregate.largeFileSignals += 1
  }

  if (importCount + exportCount >= 3) {
    aggregate.importExportRichFiles += 1
  }

  function walk(node: ts.Node, nestingDepth: number) {
    if (ts.isImportDeclaration(node)) {
      importCount += 1
    }

    if (
      ts.isExportDeclaration(node) ||
      ts.isExportAssignment(node) ||
      hasExportModifier(node)
    ) {
      exportCount += 1
    }

    if (ts.isClassDeclaration(node) && node.name) {
      identifiers.set(node.name.text, 'class')
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      identifiers.set(node.name.text, 'variable')
    }

    if (isFunctionLike(node)) {
      const functionName = resolveFunctionName(node)

      if (functionName) {
        identifiers.set(functionName, 'function')
      }

      const stats = analyzeFunctionNode(node, sourceFile, sample.path, functionName)
      aggregate.functionCount += 1
      aggregate.functions.push(stats)

      if (stats.lineCount > 35) {
        aggregate.longFunctionCount += 1
        aggregate.findings.push({
          id: `${sample.path}-long-${aggregate.functionCount}`,
          title: 'Long function detected',
          detail: `${stats.name} spans ${stats.lineCount} lines in the sampled code.`,
          severity: stats.lineCount > 55 ? 'high' : 'medium',
          path: sample.path,
        })
      }

      if (stats.parameterCount > 4) {
        aggregate.parameterHeavyFunctionCount += 1
        aggregate.findings.push({
          id: `${sample.path}-params-${aggregate.functionCount}`,
          title: 'Function has many parameters',
          detail: `${stats.name} accepts ${stats.parameterCount} parameters, which can weaken single responsibility.`,
          severity: stats.parameterCount > 6 ? 'high' : 'medium',
          path: sample.path,
        })
      }

      if (stats.complexity > 8) {
        aggregate.complexFunctionCount += 1
        aggregate.findings.push({
          id: `${sample.path}-complex-${aggregate.functionCount}`,
          title: 'Complex branching detected',
          detail: `${stats.name} shows an estimated complexity score of ${stats.complexity}.`,
          severity: stats.complexity > 12 ? 'high' : 'medium',
          path: sample.path,
        })
      }

      if (stats.nestingDepth > 3) {
        aggregate.deeplyNestedFunctionCount += 1
      }

      if (stats.hasErrorHandling) {
        aggregate.functionsWithErrorHandling += 1
      }

      if (stats.hasValidation) {
        aggregate.functionsWithValidation += 1
      }
    }

    const nextDepth = isNestingNode(node) ? nestingDepth + 1 : nestingDepth

    node.forEachChild((child) => walk(child, nextDepth))
  }
}

function analyzeFunctionNode(
  node: ts.FunctionLikeDeclaration,
  sourceFile: ts.SourceFile,
  path: string,
  fallbackName: string,
): FunctionStats {
  const body = node.body
  const lineCount = body
    ? sourceFile.getLineAndCharacterOfPosition(body.end).line -
      sourceFile.getLineAndCharacterOfPosition(body.pos).line +
      1
    : 0
  let complexity = 1
  let nestingDepth = 0
  let hasErrorHandling = false
  let hasValidation = false

  if (body) {
    scanFunctionBody(body, 0)
  }

  return {
    path,
    name: fallbackName,
    lineCount,
    parameterCount: node.parameters.length,
    complexity,
    nestingDepth,
    hasErrorHandling,
    hasValidation,
  }

  function scanFunctionBody(current: ts.Node, depth: number) {
    if (isDecisionNode(current)) {
      complexity += 1
    }

    if (isNestingNode(current)) {
      nestingDepth = Math.max(nestingDepth, depth + 1)
    }

    if (ts.isTryStatement(current) || isThrowingNode(current)) {
      hasErrorHandling = true
    }

    if (isValidationNode(current)) {
      hasValidation = true
    }

    current.forEachChild((child) =>
      scanFunctionBody(child, isNestingNode(current) ? depth + 1 : depth),
    )
  }
}

function buildRuleScores(aggregate: AggregateStats): StaticAnalysisRuleScore[] {
  const namingScore = clamp(
    Math.round(
      ratioScore(aggregate.wellNamedIdentifiers, aggregate.identifierTotal, 58) +
        42,
    ),
    0,
    100,
  )
  const singleResponsibilityScore = clamp(
    Math.round(
      100 -
        ratioPenalty(aggregate.longFunctionCount, aggregate.functionCount, 42) -
        ratioPenalty(aggregate.parameterHeavyFunctionCount, aggregate.functionCount, 28),
    ),
    0,
    100,
  )
  const complexityScore = clamp(
    Math.round(
      100 -
        ratioPenalty(aggregate.complexFunctionCount, aggregate.functionCount, 44) -
        ratioPenalty(aggregate.deeplyNestedFunctionCount, aggregate.functionCount, 26),
    ),
    0,
    100,
  )
  const errorHandlingScore = clamp(
    Math.round(
      52 + ratioScore(aggregate.functionsWithErrorHandling, aggregate.functionCount, 38),
    ),
    0,
    100,
  )
  const validationScore = clamp(
    Math.round(
      48 + ratioScore(aggregate.functionsWithValidation, aggregate.functionCount, 40),
    ),
    0,
    100,
  )
  const modularityScore = clamp(
    Math.round(
      58 +
        ratioScore(aggregate.importExportRichFiles, aggregate.analyzableFiles, 22) -
        ratioPenalty(aggregate.largeFileSignals, aggregate.analyzableFiles, 16),
    ),
    0,
    100,
  )

  const evidenceMap: Record<StaticAnalysisRuleScore['key'], string> = {
    naming: `${aggregate.wellNamedIdentifiers}/${aggregate.identifierTotal || 0} sampled identifiers matched common naming conventions.`,
    singleResponsibility: `${aggregate.longFunctionCount} long functions and ${aggregate.parameterHeavyFunctionCount} parameter-heavy functions were detected.`,
    complexity: `${aggregate.complexFunctionCount} complex functions and ${aggregate.deeplyNestedFunctionCount} deeply nested functions were detected.`,
    errorHandling: `${aggregate.functionsWithErrorHandling}/${aggregate.functionCount || 0} functions showed explicit error handling signals.`,
    validation: `${aggregate.functionsWithValidation}/${aggregate.functionCount || 0} functions showed input or guard validation signals.`,
    modularity: `${aggregate.importExportRichFiles}/${aggregate.analyzableFiles} files showed clear import/export structure in sampled code.`,
  }

  const scoreMap: Record<StaticAnalysisRuleScore['key'], number> = {
    naming: namingScore,
    singleResponsibility: singleResponsibilityScore,
    complexity: complexityScore,
    errorHandling: errorHandlingScore,
    validation: validationScore,
    modularity: modularityScore,
  }

  return RULE_WEIGHTS.map((rule) => ({
    ...rule,
    score: scoreMap[rule.key],
    evidence: evidenceMap[rule.key],
  }))
}

function resolveScriptKind(path: string) {
  if (path.endsWith('.tsx')) {
    return ts.ScriptKind.TSX
  }

  if (path.endsWith('.jsx')) {
    return ts.ScriptKind.JSX
  }

  if (path.endsWith('.js')) {
    return ts.ScriptKind.JS
  }

  return ts.ScriptKind.TS
}

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node)
  )
}

function resolveFunctionName(node: ts.FunctionLikeDeclaration) {
  if ('name' in node && node.name && ts.isIdentifier(node.name)) {
    return node.name.text
  }

  const parent = node.parent

  if (
    parent &&
    ts.isVariableDeclaration(parent) &&
    ts.isIdentifier(parent.name)
  ) {
    return parent.name.text
  }

  return 'anonymousFunction'
}

function isDecisionNode(node: ts.Node) {
  return (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isCaseClause(node) ||
    ts.isConditionalExpression(node) ||
    ts.isCatchClause(node) ||
    ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  )
}

function isNestingNode(node: ts.Node) {
  return (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isTryStatement(node)
  )
}

function isThrowingNode(node: ts.Node) {
  return ts.isThrowStatement(node)
}

function isValidationNode(node: ts.Node) {
  if (
    ts.isIfStatement(node) &&
    (containsReturnOrThrow(node.thenStatement) ||
      (node.elseStatement ? containsReturnOrThrow(node.elseStatement) : false))
  ) {
    return true
  }

  if (ts.isCallExpression(node)) {
    const name = node.expression.getText().toLowerCase()
    return (
      name.includes('validate') ||
      name.includes('schema.parse') ||
      name.includes('safeparse') ||
      name.includes('assert') ||
      name.includes('invariant')
    )
  }

  return false
}

function containsReturnOrThrow(node: ts.Node): boolean {
  let found = false

  node.forEachChild((child) => {
    if (ts.isReturnStatement(child) || ts.isThrowStatement(child)) {
      found = true
      return
    }

    if (!found && containsReturnOrThrow(child)) {
      found = true
    }
  })

  return found
}

function hasExportModifier(node: ts.Node) {
  return Boolean(
    ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  )
}

function isWellNamedIdentifier(
  name: string,
  kind: 'function' | 'variable' | 'class',
) {
  if (COMMON_SHORT_NAMES.has(name)) {
    return true
  }

  if (name.length <= 1) {
    return false
  }

  if (kind === 'class') {
    return /^[A-Z][A-Za-z0-9]+$/.test(name)
  }

  return (
    /^[a-z][A-Za-z0-9]*$/.test(name) ||
    /^[A-Z0-9_]+$/.test(name) ||
    /^[a-z][a-z0-9_]+$/.test(name)
  )
}

function ratioScore(value: number, total: number, scale: number) {
  if (total <= 0) {
    return 0
  }

  return (value / total) * scale
}

function ratioPenalty(value: number, total: number, scale: number) {
  if (total <= 0) {
    return 0
  }

  return (value / total) * scale
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
