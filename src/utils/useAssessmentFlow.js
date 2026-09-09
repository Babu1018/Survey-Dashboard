/**
 * useAssessmentFlow — React hook that drives a dynamic survey question flow.
 *
 * Wraps the assessment flow engine (getCustomAssessmentFlow + resolveNextQuestionIndex)
 * and the DB schema adapter so SurveyForm only deals with clean state + actions.
 *
 * State owned by this hook
 * ──────────────────────────────────────────────────────────────────────
 * answers         { [db_id]: value }   — submit-ready answer map
 * currentDbIndex  number               — current question's array position in `sortedQuestions`
 * path            number[]             — visited positions (for Back)
 * engineResponses object               — engine-format responses (derived from answers)
 *
 * Derived values returned
 * ──────────────────────────────────────────────────────────────────────
 * visibleIndices  number[]  — positions of all questions shown so far
 * currentPosition number   — position of `currentDbIndex` within visibleIndices
 * isLast          boolean  — true when current question is the last visible one
 * totalVisible    number   — how many questions the engine expects in this path
 */

import { useState, useMemo, useCallback } from 'react';
import {
  adaptQuestionsForEngine,
  adaptResponsesForEngine,
} from './assessmentFlowAdapter.js';
import {
  getCustomAssessmentFlow,
  resolveNextQuestionIndex,
  collectReferencedKeys,
  recordOptionJumpTaken,
  recordBackwardRouteTaken,
  optionJumpMarkerKey,
  backwardRouteMarkerKey,
  withStoredResponseOptionIndex,
  getStoredResponseOptionIndex,
} from './assessmentFlowEngine.js';
import { buildRoutingModel, listPendingIndices } from './surveyRouting.js';

export function useAssessmentFlow(sortedQuestions = []) {
  // ── Core state ────────────────────────────────────────────────────────────
  const [answers, setAnswers] = useState({});

  /**
   * Engine-format responses: { [arrayIdx]: value }
   * Kept as a separate piece of state so the engine can be called purely
   * (it doesn't know about DB ids). We update both atomically inside `advance`.
   */
  const [engineResponses, setEngineResponses] = useState({});

  /**
   * path: array of arrayIdx values visited in order (first element is always 0).
   * Back pops the last entry to restore the previous position.
   */
  const [path, setPath] = useState([]);

  // ── Adapted questions (stable across renders unless sortedQuestions changes) ──
  const adaptedQuestions = useMemo(
    () => adaptQuestionsForEngine(sortedQuestions),
    [sortedQuestions]
  );

  // ── Flow graph: rebuild on every answer ──────────────────────────────────
  const referencedKeys = useMemo(
    () => collectReferencedKeys(adaptedQuestions),
    [adaptedQuestions]
  );

  const { visibleIndices } = useMemo(
    () => getCustomAssessmentFlow(adaptedQuestions, engineResponses),
    [adaptedQuestions, engineResponses]
  );

  // Everything the survey still owes. visibleIndices stops at the first
  // unanswered question by design, so on its own it measures progress made,
  // not work left — a Backward Route that jumps Q1 -> Q5 makes it report two
  // questions and 100% while Q2, Q3 and Q4 are still to come. Counting the
  // pending set alongside it gives the honest total.
  const pendingIndices = useMemo(
    () => listPendingIndices(adaptedQuestions, engineResponses, buildRoutingModel(adaptedQuestions)),
    [adaptedQuestions, engineResponses]
  );

  // ── Current position = last entry in path, defaulting to the engine's own
  // chosen starting index (visibleIndices[0]) rather than assuming raw index
  // 0 is answerable — a section divider (e.g. the Personal Information
  // section, always at index 0) is never answerable, and getCustomAssessmentFlow
  // already skips those when picking where the flow actually begins.
  const currentIdx = path.length > 0 ? path[path.length - 1] : (visibleIndices[0] ?? 0);

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentPosition = visibleIndices.indexOf(currentIdx);

  // Questions already walked, plus the ones still owed that the walk has not
  // reached yet. Both halves are needed: a question answered out of sequence
  // (via a Backward Route) is in visibleIndices but not pending, and a question
  // routed past is pending but not yet visible.
  const totalVisible = useMemo(() => {
    const seen = new Set(visibleIndices);
    return visibleIndices.length + pendingIndices.filter((idx) => !seen.has(idx)).length;
  }, [visibleIndices, pendingIndices]);

  // The last question is the one with nothing else outstanding behind it —
  // not merely the furthest the walk has got, which is true of every question
  // at the moment it is shown.
  const isLast = pendingIndices.every((idx) => idx === currentIdx);

  // ── Public: change a single answer (no navigation) ───────────────────────
  const setAnswer = useCallback((dbId, value) => {
    setAnswers((prev) => ({ ...prev, [dbId]: value }));
  }, []);

  // ── Public: advance after answering current question ─────────────────────
  /**
   * @param {number} dbId        DB question id (for updating `answers`)
   * @param {*}      value       The answer value
   * @param {number} optionIndex 0-based index of the selected option (for sticky jump)
   * @returns {{ isEnd: boolean }} isEnd=true means flow is complete → show submit screen
   */
  const advance = useCallback(
    (dbId, value, optionIndex = null) => {
      // 1. Compute the new answers & engine-responses for this answer
      const newAnswers = { ...answers, [dbId]: value };

      let newEngineResponses = { ...engineResponses, [currentIdx]: value };
      if (Number.isInteger(optionIndex) && optionIndex >= 0) {
        newEngineResponses = withStoredResponseOptionIndex(newEngineResponses, currentIdx, optionIndex);
      }

      // 2. Record the option jump marker (sticky replay) before asking the engine
      const sourceQ = adaptedQuestions[currentIdx];
      const nextIdx = resolveNextQuestionIndex(
        adaptedQuestions,
        newEngineResponses,
        currentIdx,
        referencedKeys,
        optionIndex
      );

      if (nextIdx != null) {
        const targetQ = adaptedQuestions[nextIdx];
        // Persist sticky markers into the responses object (mutates — intentional,
        // same convention as the engine docs). Each recorder no-ops unless this
        // step really was the route it tracks, so both can be called blindly.
        recordOptionJumpTaken(newEngineResponses, sourceQ, targetQ);
        recordBackwardRouteTaken(newEngineResponses, sourceQ, targetQ);
      }

      // 3. Check for end-of-survey sentinel
      // nextIdx === null means no more questions, OR the option pointed at __end__
      const selectedOpt =
        Number.isInteger(optionIndex) && optionIndex >= 0 && sourceQ?.options?.[optionIndex]
          ? sourceQ.options[optionIndex]
          : null;
      const jumpedToEnd =
        selectedOpt?.next_question_key === '__end__' ||
        (nextIdx == null && sourceQ?.options?.some((o) => o.next_question_key === '__end__'));

      // 4. Commit state
      setAnswers(newAnswers);
      setEngineResponses(newEngineResponses);

      if (nextIdx == null || jumpedToEnd) {
        // No more questions — caller shows the submit screen
        setPath((prev) => [...prev, currentIdx]); // keep current in path for Back
        return { isEnd: true };
      }

      setPath((prev) => [...prev, nextIdx]);
      return { isEnd: false };
    },
    [answers, engineResponses, currentIdx, adaptedQuestions, referencedKeys]
  );

  // ── Public: go back to previous question ─────────────────────────────────
  const back = useCallback(() => {
    if (path.length <= 1) return;
    const newPath = path.slice(0, -1);
    const prevIdx = newPath[newPath.length - 1];

    // Remove the current answer when going back so the engine re-evaluates correctly
    const currentQ = adaptedQuestions[currentIdx];
    if (currentQ) {
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[currentQ._db_id];
        return next;
      });
      setEngineResponses((prev) => {
        const next = { ...prev };
        delete next[currentIdx];
        delete next[String(currentIdx)];
        // Clean up option-index marker for this slot
        delete next[`__oi_${currentIdx}`];
        // Drop the sticky route markers this question owns too. They exist to
        // keep a replay on the path already taken; once the answer behind them
        // is being discarded they would instead pin the flow to a route the
        // respondent is in the middle of changing.
        const jumpMarker = optionJumpMarkerKey(currentQ);
        if (jumpMarker) delete next[jumpMarker];
        const backMarker = backwardRouteMarkerKey(currentQ);
        if (backMarker) delete next[backMarker];
        return next;
      });
    }

    setPath(newPath);
    // Ensure path ends at prevIdx
    if (newPath[newPath.length - 1] !== prevIdx) {
      setPath([...newPath.slice(0, -1), prevIdx]);
    }
  }, [path, currentIdx, adaptedQuestions]);

  // ── Public: reset everything (new survey / survey change) ─────────────────
  const reset = useCallback(() => {
    setAnswers({});
    setEngineResponses({});
    setPath([]);
  }, []);

  // ── Public: start flow (initialise path to first question) ───────────────
  const start = useCallback(() => {
    setPath([visibleIndices[0] ?? 0]);
  }, [visibleIndices]);

  // ── Expose the DB question for the current slot ───────────────────────────
  // (sortedQuestions and adaptedQuestions share the same array index)
  const currentQuestion = sortedQuestions[currentIdx] ?? null;
  const currentAdaptedQuestion = adaptedQuestions[currentIdx] ?? null;

  return {
    // State
    answers,
    path,
    currentIdx,

    // Derived
    currentQuestion,
    currentAdaptedQuestion,
    visibleIndices,
    pendingIndices,
    currentPosition,
    isLast,
    totalVisible,

    // Actions
    setAnswer,
    advance,
    back,
    reset,
    start,
  };
}
