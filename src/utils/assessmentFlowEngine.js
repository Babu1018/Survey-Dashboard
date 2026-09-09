/**
 * Data-driven assessment flow: option jumps + score-based routing.
 *
 * This is a self-contained copy of the flow engine adapted for the Survey-Dashboard
 * codebase. All external HOPELINE/clinical imports have been replaced with the
 * lightweight stubs from assessmentFlowStubs.js, so the generic routing logic
 * (option jumps, score-based routing, sequential walk) works without any domain modules.
 *
 * Public API used by useAssessmentFlow.js:
 *   getCustomAssessmentFlow(questions, responses)  → { visibleIndices }
 *   resolveNextQuestionIndex(questions, responses, currentIdx, referencedKeys, optionIndex)
 *   collectReferencedKeys(questions)               → Set<string>
 *   recordOptionJumpTaken(responses, sourceQ, targetQ)
 */

import {
  parseQuestionUiClass,
  serializeQuestionUiClass,
  isMatrixQuestion,
  isMatrixAnswerComplete,
} from './assessmentFlowStubs.js';
import { isHopelineTier2Section } from './assessmentFlowStubs.js';
import {
  resolveHopelineParentForTier2Section,
  resolveHopelineTier2SectionForParent,
} from './assessmentFlowStubs.js';
import {
  applyAssessmentDisplayOrder,
  hasDisplayOrder,
} from './assessmentFlowStubs.js';
import {
  buildRoutingModel,
  findNextPendingIndex,
  firstPendingChildIndex,
  isApplicable,
  nextPendingSiblingIndex,
  resolveScoreRouteTarget,
} from './surveyRouting.js';
import {
  getExplicitDisplayLabel,
  parseDisplayLabel,
  formatDisplayLabel,
  hopelineDisplayLabelForQuestion,
  getHopelineMainLabelNumber,
  HOPELINE_KEY_DISPLAY_LABELS,
} from './assessmentFlowStubs.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const EARLY_SUICIDE_GATE_NO_FLAG = '__early_suicide_gate_no';
export const SUICIDE_GATE_QUESTION_KEY = 'suicide_screen_0';

// ─── Option / response helpers ────────────────────────────────────────────────

export function isNoOptionResponse(q, resp, optionIndex = null) {
  if (optionIndex === 1) return true;
  if (resp == null || resp === '') return false;
  const oi = getOptionIndexForResponse(q, resp);
  if (oi === 1) return true;
  const val = String(typeof resp === 'object' && resp?.text ? resp.text : resp).trim();
  return val === 'இல்லை' || val === 'No' || val === 'नहीं';
}

// ─── Suicide-block stubs (no-ops for generic surveys) ────────────────────────

export function isSuicideBlockExitQuestion(_q) {
  return false;
}

export function isSuicideGateEarlyDetour(_questions, _responses) {
  return false;
}

export function trySuicideBlockExitResume(_questions, _q, _currentIdx, _responses, _resp) {
  return null;
}

export function findSuicideResumeTriggerOwner(_questions, _q, _currentIdx, _responses, _resp) {
  return null;
}

export function resolvePostSuicideResumeIndex(_questions, _q, _responses) {
  return null;
}

export function findSuicideBlockExitOwnerForChild(_q, _questions) {
  return null;
}

export function findSuicideBlockExitRuleOwner(_q, _questions) {
  return null;
}

export function isLastTier2ChildOfSuicideBlock(_questions, _currentIdx) {
  return false;
}

export function isLastTier2ChildOfOwner(_questions, _currentIdx, _ownerQuestionKey) {
  return false;
}

export function isEarlyPathQ2Question(_q, _questions) {
  return false;
}

// ─── Response storage helpers ─────────────────────────────────────────────────

export const RESPONSE_OPTION_INDEX_PREFIX = '__oi_';
export const JUMP_TAKEN_PREFIX = '__jump_taken_';
export const BACK_TAKEN_PREFIX = '__back_taken_';
const RESUME_TAKEN_PREFIX = '__resume_taken_';

export function getStoredResponseOptionIndex(responses = {}, questionIdx) {
  if (questionIdx == null) return null;
  const raw =
    responses[`${RESPONSE_OPTION_INDEX_PREFIX}${questionIdx}`] ??
    responses[`${RESPONSE_OPTION_INDEX_PREFIX}${String(questionIdx)}`];
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function withStoredResponseOptionIndex(responses = {}, questionIdx, optionIndex) {
  const next = { ...responses };
  if (Number.isInteger(optionIndex) && optionIndex >= 0 && questionIdx != null) {
    next[`${RESPONSE_OPTION_INDEX_PREFIX}${questionIdx}`] = optionIndex;
  }
  return next;
}

export function optionJumpMarkerKey(sourceQuestion) {
  const key = String(sourceQuestion?.question_key || '').trim().toLowerCase();
  return key ? `${JUMP_TAKEN_PREFIX}${key}` : null;
}

export function recordOptionJumpTaken(responses, sourceQuestion, targetQuestion) {
  const markerKey = optionJumpMarkerKey(sourceQuestion);
  const targetKey = String(targetQuestion?.question_key || '').trim().toLowerCase();
  if (!markerKey || !targetKey || !responses) return responses;
  responses[markerKey] = targetKey;
  return responses;
}

export function backwardRouteMarkerKey(sourceQuestion) {
  const key = String(sourceQuestion?.question_key || '').trim().toLowerCase();
  return key ? `${BACK_TAKEN_PREFIX}${key}` : null;
}

/**
 * Remembers that a question's Backward Route has already fired, so replaying
 * the survey from the start reproduces the same path.
 *
 * Without this the route would be re-evaluated against the current answers,
 * where its target is by then answered — and a Backward Route is deliberately
 * one-shot (see resolveBackwardRouteTargetIndex), so the replay would take the
 * normal-navigation branch instead and show a different order than the
 * respondent actually saw. No-ops unless `targetQuestion` really is this
 * question's configured backward target.
 */
export function recordBackwardRouteTaken(responses, sourceQuestion, targetQuestion) {
  const markerKey = backwardRouteMarkerKey(sourceQuestion);
  const configured = String(sourceQuestion?.backward_question_key || '').trim().toLowerCase();
  const targetKey = String(targetQuestion?.question_key || '').trim().toLowerCase();
  if (!markerKey || !configured || !targetKey || configured !== targetKey || !responses) {
    return responses;
  }
  responses[markerKey] = targetKey;
  return responses;
}

export function recordSuicideResumeTaken(responses, _exitQuestion, _targetQuestion) {
  return responses; // no-op for generic surveys
}

export function sanitizeKioskResponsesForSubmit(responses = {}) {
  const next = { ...responses };
  delete next[EARLY_SUICIDE_GATE_NO_FLAG];
  Object.keys(next).forEach((key) => {
    if (
      String(key).startsWith(RESPONSE_OPTION_INDEX_PREFIX) ||
      String(key).startsWith(JUMP_TAKEN_PREFIX) ||
      String(key).startsWith(BACK_TAKEN_PREFIX) ||
      String(key).startsWith(RESUME_TAKEN_PREFIX)
    ) {
      delete next[key];
    }
  });
  return next;
}

// ─── Question answered check ──────────────────────────────────────────────────

export function isQuestionAnsweredInResponses(questions = [], responses = {}, arrIdx) {
  if (arrIdx == null || arrIdx < 0) return false;
  const isAnswerFor = (q, val) => {
    if (val == null || val === '') return false;
    if (isMatrixQuestion(q)) return isMatrixAnswerComplete(q, val);
    return true;
  };
  const direct = responses[arrIdx] ?? responses[String(arrIdx)];
  if (isAnswerFor(questions[arrIdx], direct)) return true;
  const key = String(questions[arrIdx]?.question_key || '').trim();
  if (!key) return false;
  return questions.some((q, i) => {
    if (String(q?.question_key || '').trim() !== key) return false;
    const val = responses[i] ?? responses[String(i)];
    return isAnswerFor(q, val);
  });
}

// ─── Routing config detection ─────────────────────────────────────────────────

export function assessmentHasConfiguredRouting(questions = []) {
  if (!Array.isArray(questions) || !questions.length) return false;
  return questions.some((q) => {
    const hasOptionJump = (q?.options || []).some(
      (o) => typeof o === 'object' && o !== null && String(o.next_question_key || '').trim()
    );
    if (hasOptionJump) return true;
    if (String(q?.backward_question_key || '').trim()) return true;
    const parsed = parseQuestionUiClass(q?.ui_class);
    const conds = q?.score_conditions ?? parsed.score_conditions;
    return Array.isArray(conds) && conds.some((c) => String(c?.next_question_key || '').trim());
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseUiFields(q) {
  const parsed = parseQuestionUiClass(q?.ui_class);
  return {
    score_cluster: q?.score_cluster?.length ? q.score_cluster : parsed.score_cluster || [],
    full_score_cluster: q?.full_score_cluster?.length ? q.full_score_cluster : parsed.full_score_cluster || [],
    score_conditions: q?.score_conditions?.length ? q.score_conditions : parsed.score_conditions || [],
    option_scores: q?.option_scores || null,
  };
}

export function collectReferencedKeys(questions = []) {
  const referencedKeys = new Set();
  questions.forEach((q) => {
    (q.options || []).forEach((opt) => {
      if (typeof opt === 'object' && opt !== null && opt.next_question_key) {
        referencedKeys.add(String(opt.next_question_key).trim().toLowerCase());
      }
    });
    if (q?.backward_question_key) {
      referencedKeys.add(String(q.backward_question_key).trim().toLowerCase());
    }
    const { score_conditions } = parseUiFields(q);
    (score_conditions || []).forEach((cond) => {
      if (cond?.next_question_key) {
        referencedKeys.add(String(cond.next_question_key).trim().toLowerCase());
      }
    });
  });
  return referencedKeys;
}

function isTier2FlowRow(q) {
  if (!q) return false;
  return (
    Number(q?.tier) > 1 ||
    Boolean(q?.parent_question_key) ||
    isHopelineTier2Section(q?.section) ||
    String(q?.section || '').includes('tier2')
  );
}

export function isMainFlowQuestion(q) {
  if (!q) return false;
  return (
    !q?.is_section &&
    Number(q?.tier) <= 1 &&
    !q?.parent_question_key &&
    !isHopelineTier2Section(q?.section) &&
    !String(q?.section || '').includes('tier2')
  );
}

function isJumpOnlyQuestion(questions, idx, referencedKeys) {
  const q = questions[idx];
  const qKey = String(q?.question_key || '').trim().toLowerCase();
  if (!qKey || !referencedKeys.has(qKey)) return false;
  return (
    Number(q?.tier) > 1 ||
    isHopelineTier2Section(q?.section) ||
    String(q?.section || '').includes('tier2')
  );
}

function optionTextMatches(o, respNorm) {
  if (typeof o === 'object' && o !== null) {
    const texts = [o.text, o.text_en, o.text_hi].filter(Boolean).map((t) => String(t).trim().toLowerCase());
    return texts.includes(respNorm);
  }
  return String(o).trim().toLowerCase() === respNorm;
}

/**
 * The option index a stored response represents.
 *
 * A checkbox question stores its answer as a JSON-stringified array of the
 * ticked option texts (e.g. '["Option 2"]'), not a single string — matching
 * that whole string against one option's text (as a single-choice answer
 * would need) never succeeds, so without unpacking it here every checkbox
 * question would silently be unable to reach its Jump Route, its red-flag
 * check, or its score, regardless of what the author configured.
 *
 * When more than one box is ticked, the option carrying a configured jump
 * wins — jump/red-flag/score lookups all pull a single index through this
 * function, and only one of several selected options is normally meant to
 * drive where the survey goes next.
 */
function getOptionIndexForResponse(q, resp) {
  if (resp == null || resp === '' || !q?.options) return -1;
  const valText = typeof resp === 'object' && resp !== null ? resp.text : resp;
  const raw = String(valText ?? '').trim();

  if (raw.startsWith('[')) {
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    if (Array.isArray(parsed)) {
      const wanted = parsed.map((v) => String(v).trim().toLowerCase());
      let firstMatch = -1;
      for (let oIdx = 0; oIdx < q.options.length; oIdx++) {
        if (!wanted.some((w) => optionTextMatches(q.options[oIdx], w))) continue;
        if (firstMatch === -1) firstMatch = oIdx;
        if (typeof q.options[oIdx] === 'object' && q.options[oIdx]?.next_question_key) return oIdx;
      }
      return firstMatch;
    }
  }

  const respNorm = raw.toLowerCase();
  for (let oIdx = 0; oIdx < q.options.length; oIdx++) {
    if (optionTextMatches(q.options[oIdx], respNorm)) return oIdx;
  }
  return -1;
}

function findSelectedOption(q, resp, optionIndex = null, responses = null, questionIdx = null) {
  if (!q?.options || resp == null || resp === '') return null;
  const storedOi =
    questionIdx != null && responses != null
      ? getStoredResponseOptionIndex(responses, questionIdx)
      : null;
  const effectiveOi =
    Number.isInteger(optionIndex) && optionIndex >= 0 ? optionIndex : storedOi;
  if (Number.isInteger(effectiveOi) && effectiveOi >= 0 && q.options[effectiveOi]) {
    return q.options[effectiveOi];
  }
  const oi = getOptionIndexForResponse(q, resp);
  if (oi >= 0) return q.options[oi];
  return null;
}

function findSelectedOptionIndex(q, resp, optionIndex = null, responses = null, questionIdx = null) {
  if (!q?.options || resp == null || resp === '') return -1;
  const storedOi =
    questionIdx != null && responses != null
      ? getStoredResponseOptionIndex(responses, questionIdx)
      : null;
  const effectiveOi =
    Number.isInteger(optionIndex) && optionIndex >= 0 ? optionIndex : storedOi;
  if (Number.isInteger(effectiveOi) && effectiveOi >= 0 && q.options[effectiveOi]) {
    return effectiveOi;
  }
  return getOptionIndexForResponse(q, resp);
}

function redFlagIndicesForQuestion(q) {
  let raw = q?.red_flag_indices;
  if (typeof raw === 'string' && raw.trim()) {
    try { raw = JSON.parse(raw); } catch { raw = null; }
  }
  return Array.isArray(raw) ? raw.map(Number) : [];
}

function findSuicideGateIndex(questions = []) {
  const byKey = questions.findIndex(
    (item) => String(item?.question_key || '').trim().toLowerCase() === SUICIDE_GATE_QUESTION_KEY
  );
  return byKey >= 0 ? byKey : null;
}

// ─── Target resolution ────────────────────────────────────────────────────────

export function resolveTargetIndex(questions, pointer) {
  const normalized = String(pointer || '').trim();
  if (!normalized) return null;
  const byKey = questions.findIndex(
    (q) => String(q?.question_key || '').trim().toLowerCase() === normalized.toLowerCase()
  );
  if (byKey >= 0) return byKey;

  const labelNumMatch =
    normalized.match(/^Q?\s*(\d+)(?:\([a-zA-Z]+\))?$/i) ||
    (/^\d+$/.test(normalized) ? [null, normalized] : null);
  if (labelNumMatch) {
    const targetNum = Number(labelNumMatch[1]);
    const byHopeline = resolveMainQuestionIndexByLabelNumber(questions, targetNum);
    if (byHopeline != null) return byHopeline;
  }

  const qNumMatch = normalized.match(/^Q\s*(\d+)$/i);
  if (qNumMatch) {
    const targetNum = Number(qNumMatch[1]);
    const byQIndex = questions.findIndex((q) => Number(q?.question_index) === targetNum);
    if (byQIndex >= 0) return byQIndex;
  }
  if (/^\d+$/.test(normalized)) {
    const asNum = Number(normalized);
    const byQIndex = questions.findIndex((q) => Number(q?.question_index) === asNum);
    if (byQIndex >= 0) return byQIndex;
  }
  return null;
}

// ─── Label / display-order helpers ───────────────────────────────────────────

export function computeMainQuestionLabelMap(questions = []) {
  const byKey = new Map();
  let num = 0;
  let groupBase = null;
  for (const q of questions) {
    if (!isMainFlowQuestion(q)) continue;
    const k = String(q?.question_key || '').trim();
    if (!k) continue;
    const explicit = getExplicitDisplayLabel(q) || String(q?.display_label || '').trim();
    const parsed = explicit ? parseDisplayLabel(explicit) : null;
    const suffix = parsed?.suffix || '';
    if (suffix) {
      if (groupBase === null) { num += 1; groupBase = num; }
      byKey.set(k, formatDisplayLabel(groupBase, suffix));
      continue;
    }
    groupBase = null;
    num += 1;
    byKey.set(k, String(num));
  }
  return byKey;
}

function resolveMainQuestionIndexByLabelNumber(questions, targetNum) {
  if (!Number.isFinite(targetNum)) return null;
  for (const [key, label] of Object.entries(HOPELINE_KEY_DISPLAY_LABELS)) {
    const parsed = parseDisplayLabel(label);
    if (parsed.base === targetNum && !parsed.suffix) {
      const idx = questions.findIndex((q) => String(q?.question_key || '').trim() === key);
      if (idx >= 0) return idx;
    }
  }
  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    if (!isMainFlowQuestion(q)) continue;
    const explicit = getExplicitDisplayLabel(q);
    if (explicit) {
      const parsed = parseDisplayLabel(explicit);
      if (parsed.base === targetNum && !parsed.suffix) return idx;
    }
    const topLevel = String(q?.display_label || '').trim();
    if (topLevel) {
      const parsed = parseDisplayLabel(topLevel);
      if (parsed.base === targetNum && !parsed.suffix) return idx;
    }
    if (getCanonicalMainLabelNumber(q, questions) === targetNum) return idx;
  }
  return null;
}

export function getCanonicalMainLabelNumber(q, questions = []) {
  if (!q || !isMainFlowQuestion(q)) return null;
  const hopelineNum = getHopelineMainLabelNumber(q);
  if (hopelineNum != null) return hopelineNum;
  const explicit = getExplicitDisplayLabel(q);
  if (explicit) {
    const parsed = parseDisplayLabel(explicit);
    if (parsed.base != null && !parsed.suffix) return parsed.base;
  }
  const topLevel = String(q?.display_label || '').trim();
  if (topLevel) {
    const parsed = parseDisplayLabel(topLevel);
    if (parsed.base != null && !parsed.suffix) return parsed.base;
  }
  const key = String(q?.question_key || '').trim();
  if (key && Array.isArray(questions) && questions.length) {
    const fromMap = computeMainQuestionLabelMap(questions).get(key);
    if (fromMap != null && fromMap !== '') {
      const parsed = parseDisplayLabel(String(fromMap));
      if (parsed.base != null && !parsed.suffix) return parsed.base;
    }
  }
  const qIdx = Number(q?.question_index);
  if (Number.isFinite(qIdx) && qIdx > 0) return qIdx;
  return null;
}

function getRoutingLabelNumber(q, questions = []) {
  if (!q) return null;
  const hopeline = getHopelineMainLabelNumber(q);
  if (hopeline != null) return hopeline;
  const stored = String(q?.display_label || '').trim();
  const explicit = getExplicitDisplayLabel(q) || stored;
  if (explicit) {
    const parsed = parseDisplayLabel(explicit);
    if (parsed.base != null) return parsed.base;
  }
  return getCanonicalMainLabelNumber(q, questions);
}

function mainFlowSortKey(questions, idx, labelMap = null) {
  const q = questions[idx];
  if (!q) return idx + 1_000_000;
  if (isTier2FlowRow(q)) {
    const parentKey = String(q?.parent_question_key || '').trim().toLowerCase();
    let parentSort = null;
    if (parentKey) {
      const parentIdx = questions.findIndex(
        (item) => String(item?.question_key || '').trim().toLowerCase() === parentKey
      );
      if (parentIdx >= 0) parentSort = mainFlowSortKey(questions, parentIdx, labelMap);
    }
    if (parentSort == null) {
      parentSort = (getRoutingLabelNumber(q, questions) ?? Math.floor(idx / 10)) * 1000;
    }
    let local = Number(q?.tier_local_index);
    if (!Number.isFinite(local) || local <= 0) {
      local = 0;
      if (parentKey) {
        questions.forEach((item, i) => {
          if (i > idx) return;
          if (!isTier2FlowRow(item)) return;
          if (String(item?.parent_question_key || '').trim().toLowerCase() !== parentKey) return;
          local += 1;
        });
      }
      if (local <= 0) local = 1;
    }
    return parentSort + local;
  }
  const map = labelMap || (Array.isArray(questions) && questions.length ? computeMainQuestionLabelMap(questions) : null);
  const key = String(q?.question_key || '').trim();
  if (map && key && map.has(key)) {
    const parsed = parseDisplayLabel(String(map.get(key)));
    if (parsed.base != null) {
      let sub = 0;
      if (parsed.suffix) {
        const m = parsed.suffix.match(/\(([a-z]+)\)/i);
        if (m) sub = (m[1].charCodeAt(0) - 96) / 100;
      }
      return parsed.base * 1000 + sub;
    }
  }
  const routing = getRoutingLabelNumber(q, questions);
  if (routing != null) return routing * 1000;
  const qIdx = Number(q?.question_index);
  if (Number.isFinite(qIdx) && qIdx > 0) return qIdx * 1000;
  return idx + 1_000_000;
}

function listMainFlowIndices(questions = [], referencedKeys) {
  const labelMap = computeMainQuestionLabelMap(questions);
  const indices = [];
  questions.forEach((q, idx) => {
    if (!isMainFlowQuestion(q)) return;
    if (isJumpOnlyQuestion(questions, idx, referencedKeys)) return;
    indices.push(idx);
  });
  indices.sort((a, b) => {
    const ka = mainFlowSortKey(questions, a, labelMap);
    const kb = mainFlowSortKey(questions, b, labelMap);
    return ka !== kb ? ka - kb : a - b;
  });
  return indices;
}

function resolveNextMainSuccessor(questions = [], currentIdx, referencedKeys) {
  const labelMap = computeMainQuestionLabelMap(questions);
  const mains = listMainFlowIndices(questions, referencedKeys);
  const pos = mains.indexOf(currentIdx);
  if (pos >= 0 && pos + 1 < mains.length) return mains[pos + 1];
  const curKey = mainFlowSortKey(questions, currentIdx, labelMap);
  for (const idx of mains) {
    if (mainFlowSortKey(questions, idx, labelMap) > curKey) return idx;
  }
  return null;
}

function visitKeyForQuestion(questions, idx) {
  const q = questions[idx];
  return String(q?.question_key || '').trim().toLowerCase() || `__idx_${idx}`;
}

// ─── Option jump resolution ───────────────────────────────────────────────────

export function isJumpIntoAnsweredEarlySuicideGate(questions, responses, targetIdx) {
  if (targetIdx == null) return false;
  const key = String(questions[targetIdx]?.question_key || '').trim().toLowerCase();
  if (key !== SUICIDE_GATE_QUESTION_KEY) return false;
  if (!responses[EARLY_SUICIDE_GATE_NO_FLAG]) return false;
  return isQuestionAnsweredInResponses(questions, responses, targetIdx);
}

export function resolveOptionJumpTargetIndex(
  questions,
  q,
  resp,
  optionIndex = null,
  responses = null,
  questionIdx = null
) {
  if (!q) return null;
  const selected = findSelectedOption(q, resp, optionIndex, responses, questionIdx);
  let candidateIdx = null;
  if (selected?.next_question_key) {
    candidateIdx = resolveTargetIndex(questions, String(selected.next_question_key).trim());
  } else {
    const redFlags = redFlagIndicesForQuestion(q);
    if (redFlags.length) {
      const oi = findSelectedOptionIndex(q, resp, optionIndex, responses, questionIdx);
      if (oi >= 0 && redFlags.includes(oi)) {
        candidateIdx = findSuicideGateIndex(questions);
      }
    }
  }
  if (candidateIdx == null) return null;
  if (!responses) return candidateIdx;

  const targetKey = String(questions[candidateIdx]?.question_key || '').trim().toLowerCase();
  const markerKey = optionJumpMarkerKey(q);
  if (markerKey && targetKey && responses[markerKey] === targetKey) {
    return candidateIdx;
  }
  if (isQuestionAnsweredInResponses(questions, responses, candidateIdx)) {
    return null;
  }
  return candidateIdx;
}

/**
 * Backward Routing (survey_navigation_routing_logic.md §2) — question-based, so
 * it fires whichever option was picked, and it outranks the per-option Jump
 * Route on the same question.
 *
 * It is deliberately one-shot. The spec's example routes Q1 -> Q5, and once Q5
 * is answered the survey must carry on with the questions Q1 skipped over
 * (Q2, Q3, Q4) rather than bouncing back to Q5 again; firing only while the
 * target is still unanswered is what stops that loop. A marker recorded by
 * recordBackwardRouteTaken keeps a replay of the same answers on the same path
 * once the target has been answered.
 *
 * @returns {number|null} target position, or null to fall through to the rest
 *   of the routing chain
 */
export function resolveBackwardRouteTargetIndex(questions, q, responses = null) {
  const pointer = String(q?.backward_question_key || '').trim();
  if (!pointer) return null;

  const targetIdx = resolveTargetIndex(questions, pointer);
  if (targetIdx == null) return null;
  if (!responses) return targetIdx;

  const markerKey = backwardRouteMarkerKey(q);
  const targetKey = String(questions[targetIdx]?.question_key || '').trim().toLowerCase();
  if (markerKey && targetKey && responses[markerKey] === targetKey) return targetIdx;

  if (isQuestionAnsweredInResponses(questions, responses, targetIdx)) return null;
  return targetIdx;
}

// ─── Tier sibling sequencing ──────────────────────────────────────────────────

/**
 * Walks up the parent_question_key chain from a tier-2+ question until it
 * reaches its nearest tier-1 (main flow) ancestor — needed so that once a
 * whole branch (all siblings) has been answered, the survey resumes at the
 * main question after that ancestor rather than after an intermediate
 * tier-2/3/4 parent.
 */
function resolveMainFlowAncestorIndex(questions, currentIdx) {
  let key = String(questions[currentIdx]?.parent_question_key || '').trim();
  let idx = key ? resolveTargetIndex(questions, key) : null;
  let guard = 0;
  while (idx != null && isTier2FlowRow(questions[idx]) && guard++ < questions.length) {
    key = String(questions[idx]?.parent_question_key || '').trim();
    idx = key ? resolveTargetIndex(questions, key) : null;
  }
  return idx;
}

// ─── Core next-question resolution ───────────────────────────────────────────

/**
 * The earliest question still owed anywhere in the survey, in flow order —
 * not merely the next one after `currentIdx`. This is what "resume after a
 * routed detour" must use: survey_navigation_routing_intro.md requires that
 * once a Backward Route target is answered, questions positioned *before*
 * that target and still unanswered (e.g. Q3, Q4) are shown before questions
 * positioned *after* it (e.g. Q6) — walking forward from the target's own
 * position would reach Q6 first and skip the earlier gap entirely, which is
 * exactly the bug this function exists to prevent.
 *
 * `visited`, when provided, switches this from live-advance semantics
 * (unanswered) to replay semantics (not yet walked this reconstruction pass)
 * — see sweepUnvisited's own doc comment for why those two notions of
 * "still owed" have to differ.
 */
function resolvePendingMainIndex(questions, responses, model, visited) {
  return visited
    ? sweepUnvisited(questions, responses, visited)
    : findNextPendingIndex(questions, responses, model);
}

// skipAnswered: true for live advance (resolveNextQuestionIndex), where
// "responses" only ever contains things truly answered earlier in this same
// session, so skipping past an already-answered main question is safe and
// desired. False when called from the replay/progress-bar path
// (resolveNextSkippingVisited), which recomputes the whole path from
// scratch against the CURRENT (possibly further-along) responses object —
// there, "already answered" doesn't mean "already visited by this replay
// pass yet", so skipping on that basis would wrongly jump over a question
// the respondent genuinely saw. That path already has its own correct
// "visited this pass" mechanism instead.
//
// visited: passed through from resolveNextSkippingVisited so
// resolvePendingMainIndex above can apply replay semantics; always undefined
// for live advance.
function resolveNextAfterAnswer(questions, responses, currentIdx, referencedKeys, optionIndex = null, skipAnswered = true, visited = null) {
  const q = questions[currentIdx];
  const getResp = (idx) => responses[idx] ?? responses[String(idx)];
  const resp = getResp(currentIdx);
  if (resp == null || resp === '') return null;

  const storedOi = getStoredResponseOptionIndex(responses, currentIdx);
  const effectiveOptionIndex =
    Number.isInteger(optionIndex) && optionIndex >= 0 ? optionIndex : storedOi;

  // Suicide resume — always null for generic surveys
  const suicideResumeIdx = trySuicideBlockExitResume(questions, q, currentIdx, responses, resp);
  if (suicideResumeIdx != null) return suicideResumeIdx;

  const model = buildRoutingModel(questions);

  // Backward Routing — question-based, so it wins over this question's own
  // per-option Jump Route and over normal navigation. One-shot: see
  // resolveBackwardRouteTargetIndex.
  const backIdx = resolveBackwardRouteTargetIndex(questions, q, responses);
  if (backIdx != null) return backIdx;

  const jumpIdx = resolveOptionJumpTargetIndex(
    questions, q, resp, effectiveOptionIndex, responses, currentIdx
  );
  if (jumpIdx != null) return jumpIdx;

  // Subsection Routing — with the answer saved, re-evaluate which subsections
  // hanging off this question are switched on, and drop into the first
  // question of an active one. A subsection's questions belong immediately
  // after the question that controls them, so this comes before normal
  // navigation moves on. Nothing happens when the chosen answer activates no
  // subsection, which is how "Do you drink? No" skips Drinking Details.
  const childIdx = firstPendingChildIndex(questions, responses, currentIdx, model);
  if (childIdx != null) return childIdx;

  // Tier 2+ rows walk through their siblings one by one before falling back
  // to the main flow — e.g. a branch of 10 follow-up questions (3.1..3.10)
  // is shown in sequence, not just the first one.
  if (isTier2FlowRow(q)) {
    const siblingIdx = nextPendingSiblingIndex(questions, responses, currentIdx, model);
    if (siblingIdx != null) return siblingIdx;

    // No more siblings in this branch — resume wherever the earliest owed
    // question in the whole survey is (see resolvePendingMainIndex), not
    // merely the next one after the tier-1 ancestor: a branch reached via a
    // detour can leave earlier gaps behind it too.
    const ancestorIdx = resolveMainFlowAncestorIndex(questions, currentIdx);
    if (ancestorIdx != null) {
      const afterAncestor = resolvePendingMainIndex(questions, responses, model, visited);
      if (afterAncestor != null) return afterAncestor;
    }
  }

  // Score-Based Routing — evaluated the moment the CONFIGURED question (q,
  // the one just answered) is itself answered, not gated on every clustered
  // question being done first. See surveyRouting.js's resolveScoreRouteTarget
  // for the scoring/threshold logic; this is only the "where does live
  // advance go" wiring.
  const scoreTarget = resolveScoreRouteTarget(questions, responses, currentIdx);
  if (scoreTarget === -1) return null; // end of survey
  if (scoreTarget != null) return scoreTarget;

  // An option pointing at "__end__" is the author saying the survey stops here,
  // and explicit author intent is the one thing that outranks everything below
  // — checked before resolvePendingMainIndex specifically so a deliberate
  // "Stop" option can't be overridden by unanswered questions elsewhere that
  // the author never meant to reach from this path.
  const selectedOpt = findSelectedOption(q, resp, effectiveOptionIndex, responses, currentIdx);
  if (String(selectedOpt?.next_question_key || '') === '__end__') return null;

  // survey_navigation_routing_intro.md: after any routing decision — Backward
  // Route, Jump Route, Subsection Routing, Score-Based Routing — the survey
  // must resume at the earliest unanswered applicable question anywhere, not
  // simply the next one positionally after wherever the respondent currently
  // is. A naive forward walk from a Backward Route's target would show later
  // questions before earlier ones the route skipped past were ever answered
  // (e.g. Q1→Q2→Q7, Q7's Backward Route → Q5: once Q5 is answered, Q3 and Q4
  // — unanswered and positioned before Q5 — must come before Q6, which sits
  // after it). resolvePendingMainIndex scans the whole flow in order, so
  // earlier gaps are always found before later, untouched questions.
  const mainNext = resolvePendingMainIndex(questions, responses, model, visited);
  if (mainNext != null) return mainNext;

  // Everything below this point is dead in ordinary use — resolvePendingMainIndex
  // above already applies the Final Rule (survey_navigation_routing_logic.md:
  // scan the complete survey for the next unanswered, applicable question, in
  // flow order) before this line is ever reached, so mainNext succeeds
  // whenever anything is left. These two blocks stay only as a defensive
  // fallback for structurally malformed data resolvePendingMainIndex's model
  // wasn't built to represent (e.g. a tier-2+ row whose parent reference is
  // broken) — raw array-order scans, not flow-order-aware, so do not rely on
  // either one to honor gaps the way the check above does.
  let j = currentIdx + 1;
  while (j < questions.length) {
    if (
      !questions[j]?.is_section &&
      model.parentIdxByIdx[j] == null &&
      !isJumpOnlyQuestion(questions, j, referencedKeys) &&
      isApplicable(questions, responses, j, model) &&
      (!skipAnswered || !isQuestionAnsweredInResponses(questions, responses, j))
    ) return j;
    j += 1;
  }

  if (skipAnswered) {
    const pending = findNextPendingIndex(questions, responses, model);
    if (pending != null && pending !== currentIdx) return pending;
  }

  if (hasDisplayOrder(questions) && currentIdx + 1 < questions.length) {
    return currentIdx + 1;
  }
  return null;
}

function resolveNextSkippingVisited(questions, responses, currentIdx, referencedKeys, visited) {
  const storedOi = getStoredResponseOptionIndex(responses, currentIdx);
  let next = resolveNextAfterAnswer(questions, responses, currentIdx, referencedKeys, storedOi, false, visited);
  if (next == null) return sweepUnvisited(questions, responses, visited);
  const nextKey = visitKeyForQuestion(questions, next);
  if (!visited.has(nextKey)) return next;

  const q = questions[currentIdx];
  const resp = responses[currentIdx] ?? responses[String(currentIdx)];
  const selectedOpt = findSelectedOption(q, resp, storedOi, responses, currentIdx);
  if (selectedOpt?.next_question_key) {
    const jumpIdx = resolveTargetIndex(questions, selectedOpt.next_question_key);
    if (jumpIdx === next) {
      const targetResp = responses[jumpIdx] ?? responses[String(jumpIdx)];
      if (targetResp == null || targetResp === '') return next;
    }
  }

  let candidate = resolveNextMainSuccessor(questions, currentIdx, referencedKeys);
  let guard = 0;
  while (candidate != null && guard++ < questions.length) {
    const candidateKey = visitKeyForQuestion(questions, candidate);
    if (!visited.has(candidateKey)) return candidate;
    candidate = resolveNextMainSuccessor(questions, candidate, referencedKeys);
  }
  return sweepUnvisited(questions, responses, visited);
}

/**
 * The Final Rule as the replay path has to phrase it.
 *
 * resolveNextAfterAnswer's own sweep asks for the next *unanswered* applicable
 * question, which is right when advancing live but finds nothing here: a replay
 * runs against a fully populated responses object, where every question the
 * respondent already answered looks satisfied. What the replay is reconstructing
 * is the order they were shown in, so the equivalent question is "which
 * applicable question has this pass not walked through yet".
 *
 * Without this, a survey whose flow ran off the end — anything using a Backward
 * Route or a forward Jump Route — would replay as a truncated path, and the
 * progress bar built from it would disagree with where the respondent actually is.
 */
function sweepUnvisited(questions, responses, visited) {
  const model = buildRoutingModel(questions);
  for (const idx of model.flowOrder) {
    if (visited.has(visitKeyForQuestion(questions, idx))) continue;
    if (!isApplicable(questions, responses, idx, model)) continue;
    return idx;
  }
  return null;
}

// ─── Public APIs ──────────────────────────────────────────────────────────────

export function syncMainQuestionDisplayLabels(questions = []) {
  if (!Array.isArray(questions) || !questions.length) return [];
  const labelMap = computeMainQuestionLabelMap(questions);
  return questions.map((q) => {
    if (!isMainFlowQuestion(q)) return q;
    const k = String(q?.question_key || '').trim();
    const label = labelMap.get(k);
    if (label == null || (q.display_label || '') === label) return q;
    return { ...q, display_label: label };
  });
}

export function normalizeQuestionsForCustomFlow(questions = []) {
  if (!Array.isArray(questions) || !questions.length) return [];
  return syncMainQuestionDisplayLabels(questions);
}

/**
 * Kiosk / live path: walk from start, return all questions shown in order
 * until the first unanswered slot.
 * @returns {{ visibleIndices: number[] }}
 */
export function getCustomAssessmentFlow(questions = [], responses = {}) {
  const qs = normalizeQuestionsForCustomFlow(questions);
  if (!qs.length) return { visibleIndices: [] };

  const referencedKeys = collectReferencedKeys(qs);
  const getResp = (idx) => responses[idx] ?? responses[String(idx)];
  const visibleIndices = [];
  const visited = new Set();
  let reachedDeadEnd = false;

  // Find start: first non-jump-only, non-section question
  let idx = 0;
  for (let i = 0; i < qs.length; i++) {
    if (qs[i]?.is_section) continue;
    const qKey = String(qs[i]?.question_key || '').trim().toLowerCase();
    if (!qs[i].question_key || !referencedKeys.has(qKey)) { idx = i; break; }
  }

  while (idx != null && idx >= 0 && idx < qs.length) {
    const vKey = visitKeyForQuestion(qs, idx);
    if (visited.has(vKey)) break;
    visited.add(vKey);
    visibleIndices.push(idx);

    const resp = getResp(idx);
    if (resp == null || resp === '') break;

    const next = resolveNextSkippingVisited(qs, responses, idx, referencedKeys, visited);
    if (next == null) { reachedDeadEnd = true; break; }
    idx = next;
  }

  if (reachedDeadEnd) {
    // Same Final Rule the live walk applies: a dead end only ends the survey
    // once nothing unanswered and applicable is left anywhere in it.
    const gap = findNextPendingIndex(qs, responses, buildRoutingModel(qs), {
      exclude: visibleIndices,
    });
    if (gap != null) visibleIndices.push(gap);
  }

  return { visibleIndices };
}

/** Public alias used by the hook to advance after a live answer. */
export function resolveNextQuestionIndex(questions, responses, currentIdx, referencedKeys, optionIndex = null) {
  const qs = normalizeQuestionsForCustomFlow(questions);
  const keys = referencedKeys || collectReferencedKeys(qs);
  return resolveNextAfterAnswer(qs, responses, currentIdx, keys, optionIndex);
}
