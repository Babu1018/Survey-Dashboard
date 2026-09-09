/**
 * surveyRouting — applicability + "next pending question" rules.
 *
 * This module implements the parts of survey_navigation_routing_logic.md that
 * are about *what may be shown*, as opposed to *where a single answer routes
 * to* (which stays in assessmentFlowEngine.js):
 *
 *   - Structural flow order: every question in the order a respondent would
 *     meet it walking the survey top to bottom, with each subsection's
 *     questions sitting directly under the question that controls them.
 *     Subsection questions are appended to the end of the questions array as
 *     they are authored, so raw array order is not that order.
 *
 *   - Subsection Routing: a tier-2+ question belongs to a conditional group
 *     hanging off one specific option of its parent. The group is *active*
 *     only while that option is the one the respondent actually chose.
 *     Questions in an inactive group are not applicable, and per the spec must
 *     never be counted as pending.
 *
 *   - The Final Rule: after any routing decision the survey continues at the
 *     next question that is both unanswered and applicable, scanning the whole
 *     survey rather than only forwards. The survey finishes only when no such
 *     question is left, so answering a Backward Route or Jump Route target
 *     never by itself ends the survey.
 *
 * It operates on questions already adapted for the flow engine (see
 * assessmentFlowAdapter.js), i.e. rows carrying `question_key`,
 * `parent_question_key`, `tier`, `is_section` and `options[].next_question_key`.
 *
 * It deliberately imports nothing from assessmentFlowEngine.js — the engine
 * imports *this*, and a one-way dependency keeps that import graph acyclic.
 * The small option-matching helpers below are therefore local rather than
 * shared with the engine.
 */

// --- Parent reference parsing ------------------------------------------------

/**
 * A subsection child records which parent question it hangs off *and* which of
 * that parent's options switches it on, encoded into the single
 * `parent_question_key` column as "<parentRef>:opt_<optionIndex>" (e.g.
 * "idx_3:opt_1" as persisted, "q_57:opt_1" once resolved against live ids).
 *
 * The option half is optional: rows authored before subsection conditions were
 * explicit carry a bare parent reference, and are handled by
 * `resolveActivatingOptionIndex` falling back to the parent's own option jumps.
 *
 * @param {string|null} raw
 * @returns {{ parentRef: string|null, optionIndex: number|null }}
 */
export function parseParentRef(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { parentRef: null, optionIndex: null };
  const m = /^(.*?):opt_(\d+)$/.exec(text);
  if (!m) return { parentRef: text, optionIndex: null };
  const optionIndex = parseInt(m[2], 10);
  return {
    parentRef: m[1] || null,
    optionIndex: Number.isInteger(optionIndex) && optionIndex >= 0 ? optionIndex : null,
  };
}

/** Rebuilds a `parent_question_key` from its two halves. */
export function formatParentRef(parentRef, optionIndex = null) {
  if (!parentRef) return null;
  return Number.isInteger(optionIndex) && optionIndex >= 0
    ? `${parentRef}:opt_${optionIndex}`
    : String(parentRef);
}

// --- Local answer / option helpers -------------------------------------------

const isBlank = (val) => val == null || val === '' || val === '[]';

/** True when the respondent has given an answer for this array position. */
export function hasAnswerAt(responses = {}, idx) {
  if (idx == null || idx < 0) return false;
  return !isBlank(responses[idx] ?? responses[String(idx)]);
}

const optionTexts = (opt) => {
  if (opt == null) return [];
  if (typeof opt !== 'object') return [String(opt).trim().toLowerCase()];
  return [opt.text, opt.text_en, opt.text_hi, opt.option_text]
    .filter(Boolean)
    .map((t) => String(t).trim().toLowerCase());
};

/**
 * Which option indices a stored response represents.
 *
 * Single-choice questions yield at most one; a checkbox question stores a JSON
 * array of the texts that were ticked, so a subsection hanging off any one of
 * those ticked options counts as switched on.
 *
 * @returns {number[]} 0-based option indices, possibly empty
 */
export function selectedOptionIndices(q, resp, responses = null, questionIdx = null) {
  if (!q?.options?.length || isBlank(resp)) return [];

  // A stored option index (written when the respondent clicked) is the most
  // reliable signal — it survives two options sharing the same label.
  if (responses && questionIdx != null) {
    const stored = Number(responses[`__oi_${questionIdx}`]);
    if (Number.isInteger(stored) && stored >= 0 && q.options[stored]) return [stored];
  }

  const wanted = [];
  const raw = typeof resp === 'object' && resp !== null ? resp.text : resp;
  const text = String(raw ?? '').trim();
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) parsed.forEach((v) => wanted.push(String(v).trim().toLowerCase()));
      else wanted.push(text.toLowerCase());
    } catch {
      wanted.push(text.toLowerCase());
    }
  } else {
    wanted.push(text.toLowerCase());
  }

  const found = [];
  q.options.forEach((opt, oIdx) => {
    const texts = optionTexts(opt);
    if (texts.some((t) => wanted.includes(t))) found.push(oIdx);
  });
  return found;
}

// --- Routing model -----------------------------------------------------------

/**
 * Precomputes the structure the applicability rules need, so callers walking
 * the survey question by question don't rebuild it per step.
 *
 * @param {Array} questions adapted questions
 * @returns {{
 *   parentIdxByIdx: Array<number|null>,
 *   activatingOptionByIdx: Array<number|null>,
 *   childrenByParentIdx: Map<number, number[]>,
 *   flowOrder: number[],
 * }}
 */
export function buildRoutingModel(questions = []) {
  const indexByKey = new Map();
  questions.forEach((q, idx) => {
    const key = String(q?.question_key || '').trim().toLowerCase();
    if (key && !indexByKey.has(key)) indexByKey.set(key, idx);
  });

  const resolveRef = (ref) => {
    const text = String(ref ?? '').trim();
    if (!text) return null;
    const byKey = indexByKey.get(text.toLowerCase());
    if (byKey != null) return byKey;
    const m = /^idx_(\d+)$/.exec(text);
    if (m) {
      const idx = parseInt(m[1], 10);
      if (idx >= 0 && idx < questions.length) return idx;
    }
    return null;
  };

  const parentIdxByIdx = questions.map((q, idx) => {
    if (!q || Number(q.tier || 1) <= 1) return null;
    const { parentRef } = parseParentRef(q.parent_question_key);
    const parentIdx = resolveRef(parentRef);
    return parentIdx != null && parentIdx !== idx ? parentIdx : null;
  });

  const childrenByParentIdx = new Map();
  parentIdxByIdx.forEach((parentIdx, idx) => {
    if (parentIdx == null) return;
    if (!childrenByParentIdx.has(parentIdx)) childrenByParentIdx.set(parentIdx, []);
    childrenByParentIdx.get(parentIdx).push(idx);
  });

  const activatingOptionByIdx = questions.map((q, idx) =>
    resolveActivatingOptionIndex(questions, idx, parentIdxByIdx[idx], childrenByParentIdx)
  );

  return {
    parentIdxByIdx,
    activatingOptionByIdx,
    childrenByParentIdx,
    flowOrder: buildFlowOrder(questions, parentIdxByIdx, childrenByParentIdx),
  };
}

/**
 * The option index on `parentIdx` that switches question `idx` on.
 *
 * Preference order, so surveys authored before subsection conditions became
 * explicit keep working unchanged:
 *   1. the option encoded into `parent_question_key` ("...:opt_2");
 *   2. the parent option whose Jump Route points straight at this question —
 *      how the builder used to record a "+ Sub Section" branch;
 *   3. the activator of the nearest earlier sibling, so the second and later
 *      questions of one subsection inherit the condition of the first;
 *   4. null, meaning "no condition" — active whenever the parent is answered.
 */
function resolveActivatingOptionIndex(questions, idx, parentIdx, childrenByParentIdx) {
  if (parentIdx == null) return null;

  const { optionIndex } = parseParentRef(questions[idx]?.parent_question_key);
  if (optionIndex != null) return optionIndex;

  const parent = questions[parentIdx];
  const optionPointingAt = (targetIdx) => {
    const key = String(questions[targetIdx]?.question_key || '').trim().toLowerCase();
    if (!key) return -1;
    return (parent?.options || []).findIndex(
      (o) => String(o?.next_question_key || '').trim().toLowerCase() === key
    );
  };

  const direct = optionPointingAt(idx);
  if (direct >= 0) return direct;

  const siblings = childrenByParentIdx.get(parentIdx) || [];
  for (let k = siblings.indexOf(idx) - 1; k >= 0; k--) {
    const sib = siblings[k];
    const { optionIndex: sibOpt } = parseParentRef(questions[sib]?.parent_question_key);
    if (sibOpt != null) return sibOpt;
    const sibDirect = optionPointingAt(sib);
    if (sibDirect >= 0) return sibDirect;
  }
  return null;
}

/**
 * Depth-first walk of the survey: every root question in array order, each
 * immediately followed by its subsection questions (and theirs, recursively).
 *
 * Subsection questions are appended to the end of the questions array as they
 * are authored, so this — not array order — is the order the spec's "scan the
 * complete survey" means.
 */
function buildFlowOrder(questions, parentIdxByIdx, childrenByParentIdx) {
  const order = [];
  const seen = new Set();

  const visit = (idx) => {
    if (seen.has(idx)) return; // defends against a parent cycle in bad data
    seen.add(idx);
    if (!questions[idx]?.is_section) order.push(idx);
    (childrenByParentIdx.get(idx) || []).forEach(visit);
  };

  questions.forEach((_, idx) => {
    if (parentIdxByIdx[idx] == null) visit(idx);
  });
  // Any child orphaned by a broken parent reference still has to be reachable.
  questions.forEach((_, idx) => visit(idx));

  return order;
}

// --- Score-Based Routing -------------------------------------------------------

/**
 * The combined score for a manually-chosen cluster of questions: every
 * selected option's score, summed across every question index in
 * `memberIndices` — a checkbox question contributes every ticked option's
 * score (via `selectedOptionIndices`, which unpacks a checkbox's JSON-array
 * answer into every matched index), not just one, since connecting several
 * questions is meant to let their combined answers decide the outcome
 * together.
 *
 * A member that hasn't been answered yet simply contributes 0 — this isn't
 * gated on every member being answered first, matching Score-Based Routing's
 * own framing ("evaluated using a custom condition" the moment the configured
 * question is answered, not "wait until everything in the cluster is done").
 */
export function clusterScoreTotal(questions, responses, memberIndices = []) {
  let total = 0;
  memberIndices.forEach((qIdx) => {
    const q = questions[qIdx];
    if (!q?.options?.length) return;
    const resp = responses[qIdx] ?? responses[String(qIdx)];
    selectedOptionIndices(q, resp, responses, qIdx).forEach((oi) => {
      total += Number(q.options[oi]?.score) || 0;
    });
  });
  return total;
}

/**
 * Parses a question's `scale` field — a comma-joined list of the array
 * indices of every question (itself included, if the author left it in the
 * cluster) whose scores combine for its own Score-Based Routing condition.
 */
export function parseScoreClusterMembers(scale) {
  return String(scale ?? '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0);
}

/**
 * A question's Score-Based Routing rules, as `[{ min, target }]`.
 *
 * Each rule reads "score is at least `min`" — so "2 → Q5, 3 → Q7" sends a
 * score of 2 to Q5 and anything 3 or above to Q7 (see resolveScoreRouteTarget
 * for the highest-match-wins tie-break). `target` is a 0-based question index,
 * or -1 for end of survey.
 *
 * Falls back to the legacy single-rule pair (`score_threshold` +
 * `threshold_next_question`) when no rules list is stored, so surveys authored
 * before multiple rules existed keep routing exactly as they did.
 *
 * A rule whose `target` is null is kept, not dropped: the builder renders
 * this same list as its editable rows, and a rule the author has just added
 * but not yet pointed anywhere has to stay visible for them to finish. It is
 * resolveScoreRouteTarget's job to ignore incomplete rules when routing.
 */
export function parseScoreRules(q) {
  const raw = q?.score_rules;
  if (raw) {
    let parsed = raw;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
    }
    if (Array.isArray(parsed)) {
      const rules = parsed
        .map((r) => ({
          min: Number(r?.min),
          target: r?.target == null || !Number.isFinite(Number(r.target)) ? null : Number(r.target),
        }))
        .filter((r) => Number.isFinite(r.min));
      if (rules.length) return rules;
    }
  }

  const min = q?.score_threshold;
  const target = q?.threshold_next_question;
  if (min != null && target != null && Number.isFinite(Number(min)) && Number.isFinite(Number(target))) {
    return [{ min: Number(min), target: Number(target) }];
  }
  return [];
}

/**
 * Whether — and where — a question's own Score-Based Routing condition
 * routes the survey, evaluated the moment that question itself is answered.
 *
 * With several rules configured, every one whose `min` the score reaches
 * matches; the highest `min` among those wins, so bands read naturally in the
 * order an author writes them ("2 → follow-up, 5 → escalate": a score of 6
 * escalates rather than stopping at the first rule it happens to clear).
 *
 * @returns {number|null} `null` if nothing fired (unconfigured, or the score
 *   is below every rule), `-1` if the winning rule targets "End of Survey",
 *   or the target question's array index.
 */
export function resolveScoreRouteTarget(questions, responses, questionIdx) {
  const q = questions[questionIdx];
  const rules = parseScoreRules(q);
  if (!rules.length) return null;

  const members = parseScoreClusterMembers(q?.scale);
  const total = clusterScoreTotal(questions, responses, members.length ? members : [questionIdx]);

  let best = null;
  for (const rule of rules) {
    if (rule.target == null) continue; // author hasn't pointed this rule anywhere yet
    if (total < rule.min) continue;
    if (best == null || rule.min > best.min) best = rule;
  }
  if (best == null) return null;

  if (best.target === -1) return -1;
  return questions[best.target] && !questions[best.target].is_section ? best.target : null;
}

// --- Applicability -----------------------------------------------------------

/**
 * True when question `idx` is on the path the respondent's answers have
 * actually carved out — i.e. every subsection it sits inside is switched on.
 *
 * A question with no parent is always applicable. A subsection question is
 * applicable only while, for every link up its ancestor chain, the parent is
 * answered and the answer selected the option that link hangs off.
 */
export function isApplicable(questions = [], responses = {}, idx, model = null) {
  const q = questions[idx];
  if (!q || q.is_section) return false;

  const m = model || buildRoutingModel(questions);
  let cursor = idx;
  let guard = 0;

  while (guard++ <= questions.length) {
    const parentIdx = m.parentIdxByIdx[cursor];
    if (parentIdx == null) return true;

    if (!hasAnswerAt(responses, parentIdx)) return false;

    const activator = m.activatingOptionByIdx[cursor];
    if (activator != null) {
      const parent = questions[parentIdx];
      const parentResp = responses[parentIdx] ?? responses[String(parentIdx)];
      const selected = selectedOptionIndices(parent, parentResp, responses, parentIdx);
      if (!selected.includes(activator)) return false;
    }
    cursor = parentIdx;
  }
  return false;
}

/** True when this row can be shown next: answerable, and on the current path. */
export function isNavigable(questions = [], responses = {}, idx, model = null) {
  if (idx == null || idx < 0 || idx >= questions.length) return false;
  return isApplicable(questions, responses, idx, model);
}

// --- The Final Rule ----------------------------------------------------------

/**
 * Scans the complete survey in flow order and returns the first question that
 * is unanswered *and* applicable — the spec's "what is the next unanswered
 * question that is still applicable to the user's current survey path?".
 *
 * Returning null is the only condition under which the survey finishes.
 *
 * @param {Array}  questions
 * @param {Object} responses
 * @param {Object} [model]  precomputed buildRoutingModel result
 * @param {Object} [opts]
 * @param {Set<number>|number[]} [opts.exclude] positions to pass over (e.g.
 *        ones already visited by the current replay pass)
 */
export function findNextPendingIndex(questions = [], responses = {}, model = null, opts = {}) {
  const m = model || buildRoutingModel(questions);
  const exclude = opts.exclude instanceof Set ? opts.exclude : new Set(opts.exclude || []);

  for (const idx of m.flowOrder) {
    if (exclude.has(idx)) continue;
    if (hasAnswerAt(responses, idx)) continue;
    if (!isApplicable(questions, responses, idx, m)) continue;
    return idx;
  }
  return null;
}

/**
 * Every question still owed, in flow order: unanswered, and applicable to the
 * path the answers so far have carved out.
 *
 * This is what a progress indicator has to count. The engine's own walk
 * (getCustomAssessmentFlow) deliberately stops at the first unanswered
 * question, so its length is "how far we have got", never "how much there is" —
 * a survey that routes forwards or backwards over questions it still owes
 * would otherwise report a total of two and sit at 100% while three questions
 * were still to come.
 *
 * The count can grow as the respondent answers: questions inside a subsection
 * that nothing has switched on yet are not applicable, so they are not owed
 * yet either. That is the same rule the navigation uses, so the number never
 * disagrees with where the survey actually goes next.
 */
export function listPendingIndices(questions = [], responses = {}, model = null) {
  const m = model || buildRoutingModel(questions);
  return m.flowOrder.filter(
    (idx) => !hasAnswerAt(responses, idx) && isApplicable(questions, responses, idx, m)
  );
}

/**
 * The first unanswered question of an active subsection hanging off
 * `parentIdx` — the "evaluate subsection conditions, activate the applicable
 * ones" step of the spec's combined navigation order.
 *
 * A subsection's questions sit immediately after the question that controls
 * them, so this runs before normal navigation moves on to the next main
 * question. It returns null when no subsection under this question is switched
 * on by the answer just given, which is how "select No -> skip Drinking
 * Details" falls straight through to the rest of the survey.
 */
export function firstPendingChildIndex(questions = [], responses = {}, parentIdx, model = null) {
  const m = model || buildRoutingModel(questions);
  const children = m.childrenByParentIdx.get(parentIdx) || [];
  for (const childIdx of children) {
    if (hasAnswerAt(responses, childIdx)) continue;
    if (!isApplicable(questions, responses, childIdx, m)) continue;
    return childIdx;
  }
  return null;
}

/**
 * The next unanswered question inside the same active subsection — used so a
 * branch with several questions is walked through one by one before the survey
 * falls back to the main flow. Unlike a plain sibling walk this skips siblings
 * that hang off a *different* option of the same parent, which the spec calls
 * out as belonging to a path that is not applicable.
 */
export function nextPendingSiblingIndex(questions = [], responses = {}, currentIdx, model = null) {
  const m = model || buildRoutingModel(questions);
  const parentIdx = m.parentIdxByIdx[currentIdx];
  if (parentIdx == null) return null;

  const siblings = m.childrenByParentIdx.get(parentIdx) || [];
  const pos = siblings.indexOf(currentIdx);
  if (pos === -1) return null;

  for (let k = pos + 1; k < siblings.length; k++) {
    const sib = siblings[k];
    if (hasAnswerAt(responses, sib)) continue;
    if (!isApplicable(questions, responses, sib, m)) continue;
    return sib;
  }
  return null;
}
