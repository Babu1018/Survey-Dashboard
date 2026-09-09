/**
 * Adapts the Survey-Dashboard DB question schema to the shape expected by
 * assessmentFlowEngine.js, and provides two-way response mapping.
 *
 * DB question shape  →  Engine question shape
 * ─────────────────────────────────────────────────────────────────────
 * id (number)           question_key  = "q_<id>"
 * order (number)        display_order, display_label, question_index
 * question_type         question_type (pass-through)
 * options[].next_question (0-based idx) → options[].next_question_key ("q_<targetId>")
 * options[].is_red_flag  → red_flag_indices (array of option indices)
 * options[].option_text  → options[].text
 * options[].score        → options[].score  +  option_scores[]
 * scale, score_rules, score_threshold,
 *   threshold_next_question → passed through raw (unlike backward_question,
 *   NOT resolved to a "q_<id>" key) — Score-Based Routing reads these straight
 *   off the question that owns the condition, working in the same raw
 *   array-index terms as parentIdxByIdx/flowOrder. `scale` is a comma-joined
 *   list of the array indices of every question (this one included, if left
 *   in) whose scores combine for the condition; `score_rules` is the JSON
 *   list of "at least N → jump to X" rules, with score_threshold +
 *   threshold_next_question kept as the legacy single-rule fallback. See
 *   surveyRouting.js (parseScoreClusterMembers, clusterScoreTotal,
 *   parseScoreRules, resolveScoreRouteTarget).
 * backward_question (0-based idx, question-level) → backward_question_key ("q_<targetId>") —
 *   a Backward Route, taken once the question itself is answered regardless of
 *   which option was picked (see resolveBackwardRouteTargetIndex in
 *   assessmentFlowEngine.js, which prefers this over any per-option jump).
 * parent_question_key ("idx_<n>" or "idx_<n>:opt_<m>") → parent_question_key
 *   ("q_<parentId>" / "q_<parentId>:opt_<m>") — the subsection this question
 *   belongs to and the parent option that switches it on. See surveyRouting.js.
 *
 * Response mapping
 * ─────────────────────────────────────────────────────────────────────
 * SurveyForm uses  answers[q.id]    = value  (by DB primary key)
 * Engine uses      responses[idx]   = value  (by 0-based array index in adapted array)
 *
 * adaptResponsesForEngine  :  answers   → engineResponses
 * adaptResponsesBackToIds  :  engineResponses → answers (used when reading from engine)
 */

import { parseParentRef, formatParentRef } from './surveyRouting.js';

/**
 * Convert a sorted DB questions array into the engine-compatible format.
 *
 * @param {Array} sortedQuestions  DB questions sorted by `order`
 * @returns {Array} adapted questions ready for getCustomAssessmentFlow
 */
export function adaptQuestionsForEngine(sortedQuestions = []) {
  if (!Array.isArray(sortedQuestions) || !sortedQuestions.length) return [];

  // Build a lookup: 0-based array-index → question_key ("q_<id>"), used
  // when resolving next_question (an index) → next_question_key (a string).
  const idxToKey = sortedQuestions.map((q) => `q_${q.id}`);

  return sortedQuestions.map((q, arrayIdx) => {
    // ── Options ──────────────────────────────────────────────────────
    const redFlagIndices = [];
    const adaptedOptions = (q.options || [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((opt, oIdx) => {
        const adapted = {
          text: String(opt.option_text ?? '').trim(),
          score: Number(opt.score) || 0,
        };

        // Resolve next_question (0-based DB index) → next_question_key
        const rawNext = opt.next_question;
        if (rawNext !== null && rawNext !== undefined && rawNext !== '') {
          const targetIdx = parseInt(rawNext, 10);
          if (!isNaN(targetIdx) && targetIdx === -1) {
            // -1 means "end survey" — use a sentinel key the engine won't find,
            // so flow terminates and SurveyForm shows the submit screen.
            adapted.next_question_key = '__end__';
          } else if (!isNaN(targetIdx) && idxToKey[targetIdx]) {
            adapted.next_question_key = idxToKey[targetIdx];
          }
        }

        if (opt.is_red_flag) redFlagIndices.push(oIdx);
        return adapted;
      });

    // ── Score-Based Routing (scale / score_threshold / threshold_next_question) ───
    // Raw pass-through — see the file header comment above.
    const scoreThreshold = q.score_threshold !== null && q.score_threshold !== undefined && q.score_threshold !== ''
      ? parseInt(q.score_threshold, 10)
      : null;
    const thresholdNextQuestion = q.threshold_next_question !== null && q.threshold_next_question !== undefined && q.threshold_next_question !== ''
      ? parseInt(q.threshold_next_question, 10)
      : null;

    // ── Option scores flat array (for cluster-sum lookups) ─────────────
    const optionScores = adaptedOptions.map((o) => o.score);

    // Resolve backward_question (0-based DB index, question-level) → backward_question_key
    let backwardQuestionKey = null;
    const rawBackward = q.backward_question;
    if (rawBackward !== null && rawBackward !== undefined && rawBackward !== '') {
      const backwardIdx = parseInt(rawBackward, 10);
      if (!isNaN(backwardIdx) && idxToKey[backwardIdx]) {
        backwardQuestionKey = idxToKey[backwardIdx];
      }
    }

    // Resolve parent_question_key, which is persisted as "idx_<arrayPosition>"
    // (stable across saves — every save re-inserts all questions with new
    // ids, so a saved "q_<id>" reference would already be stale) rather
    // than "q_<id>" directly. Convert it to the engine's own question_key
    // form here so the rest of the engine's tier-walking logic (which
    // matches parent_question_key against other questions' question_key)
    // doesn't need to know about the two formats. Any older "q_<id>" value
    // is passed through unchanged as a fallback.
    // The activating-option half of the reference ("...:opt_2", see
    // parseParentRef) is carried through untouched — it names an option index
    // on the parent, which no id remapping affects.
    let resolvedParentKey = null;
    if (q.parent_question_key) {
      const { parentRef, optionIndex } = parseParentRef(q.parent_question_key);
      const m = /^idx_(\d+)$/.exec(String(parentRef || ''));
      const resolvedRef = m ? (idxToKey[parseInt(m[1], 10)] || null) : parentRef;
      resolvedParentKey = formatParentRef(resolvedRef, optionIndex);
    }

    return {
      // Identity
      question_key: `q_${q.id}`,
      _db_id: q.id,           // preserved for response mapping

      // Display
      question_text: q.question_text || '',
      question_type: q.question_type || 'text',
      question_index: arrayIdx + 1,
      display_order: arrayIdx + 1,
      display_label: String(arrayIdx + 1),

      // Hierarchy (mapped from DB question configuration)
      tier: q.tier !== undefined && q.tier !== null ? Number(q.tier) : 1,
      parent_question_key: resolvedParentKey,
      section: Number(q.tier) > 1 ? 'tier2' : 'main',

      // Section dividers (question_type '_section') are cosmetic headers,
      // not answerable questions — flagged here so the flow engine can skip
      // over them while keeping array indices aligned with option jump
      // targets (which are raw indices chosen in the builder).
      is_section: q.question_type === '_section',

      // Options & routing
      options: adaptedOptions,
      option_scores: optionScores,
      red_flag_indices: redFlagIndices,
      backward_question_key: backwardQuestionKey,

      // Score-Based Routing (see file header comment)
      scale: q.scale || '',
      score_rules: q.score_rules || null,
      score_threshold: (scoreThreshold != null && isNaN(scoreThreshold)) ? null : scoreThreshold,
      threshold_next_question: (thresholdNextQuestion != null && isNaN(thresholdNextQuestion)) ? null : thresholdNextQuestion,

      // Validation
      required: Boolean(q.required),

      // Media (passed through for rendering)
      media_type: q.media_type || null,
      media_url: q.media_url || null,

      // Rating
      rating_max: q.rating_max || 5,
      low_label: q.low_label || '',
      high_label: q.high_label || '',
      rating_style: q.rating_style || 'number',
      rating_labels: q.rating_labels || null,

      // Media Upload
      allowed_file_types: q.allowed_file_types || '',
      max_file_size_mb: q.max_file_size_mb ?? 10,

      // Matrix / Grid
      matrix_rows: q.matrix_rows || null,
      matrix_columns: q.matrix_columns || null,
      matrix_multi: !!q.matrix_multi,
    };
  });
}

/**
 * Convert SurveyForm answers ({ [q.id]: value }) to engine responses ({ [arrayIdx]: value }).
 *
 * @param {Object} answers          answers keyed by DB question id
 * @param {Array}  adaptedQuestions output of adaptQuestionsForEngine
 * @returns {Object} engine-format responses object
 */
export function adaptResponsesForEngine(answers = {}, adaptedQuestions = []) {
  const responses = {};
  adaptedQuestions.forEach((q, idx) => {
    const val = answers[q._db_id];
    if (val !== undefined && val !== null && val !== '') {
      responses[idx] = val;
    }
  });
  return responses;
}

/**
 * Convert engine responses ({ [arrayIdx]: value }) back to answers ({ [q.id]: value }).
 * Used when reading back after the engine has updated the response state.
 *
 * @param {Object} engineResponses
 * @param {Array}  adaptedQuestions
 * @returns {Object} answers keyed by DB id
 */
export function adaptResponsesBackToIds(engineResponses = {}, adaptedQuestions = []) {
  const answers = {};
  adaptedQuestions.forEach((q, idx) => {
    const val = engineResponses[idx] ?? engineResponses[String(idx)];
    if (val !== undefined && val !== null && val !== '') {
      answers[q._db_id] = val;
    }
  });
  return answers;
}

/**
 * True if the flow reached the sentinel "__end__" key, meaning the current
 * option or score condition routes to survey completion rather than another question.
 */
export function isEndSentinel(questionKey) {
  return String(questionKey || '').trim() === '__end__';
}
