/**
 * surveyValidation — the "Play/Test" pre-flight check for a survey draft.
 *
 * Answers one question: if an admin took this survey right now, would every
 * section, question, tier, option, id, jump and condition actually work?
 *
 * The one rule this module lives by: it must judge the draft by exactly the
 * same rules the real respondent flow uses. So it does not re-implement
 * routing — it pushes the draft through the same adapter the live survey uses
 * (`adaptQuestionsForEngine`) and the same routing model the engine walks
 * (`buildRoutingModel`), then inspects that. A check that disagreed with the
 * runtime would be worse than no check at all.
 *
 * Two index-aligned arrays are used throughout:
 *   dbRows   — the draft in DB shape (raw, unresolved jump indices, so broken
 *              references are still visible; the adapter silently drops them)
 *   adapted  — the engine shape (resolved keys, is_section, tier, options)
 * `dbRows[i]`, `adapted[i]` and builder `questions[i]` all describe the same row.
 */

import { adaptQuestionsForEngine } from './assessmentFlowAdapter.js';
import {
  buildRoutingModel,
  parseParentRef,
  formatParentRef,
  parseScoreRules,
  parseScoreClusterMembers,
} from './surveyRouting.js';
import { computeQuestionLabels } from './questionLabels.js';
import { parseLabelList } from './questionTypes.js';

export const SEVERITY = { ERROR: 'error', WARNING: 'warning' };

const isSectionRow = (q) => !!q && (q._is_section || q.question_type === '_section');

// Answer types the builder can produce, plus legacy values still in saved
// surveys ('select'/'multiple_choice'/'short_text' predate the current list).
const KNOWN_TYPES = new Set([
  'text', 'short_text', 'long_text', 'number', 'phone',
  'radio', 'checkbox', 'multiple_choice', 'select', 'rating',
  'ranking', 'matrix', 'file_upload',
]);
// Types whose answer comes from the `options` list. Ranking is included: its
// options are the items to be put in order, so the same "needs at least two,
// all with text" rules apply.
const CHOICE_TYPES = new Set(['radio', 'checkbox', 'multiple_choice', 'select', 'ranking']);

/**
 * Builder draft rows → DB-shape rows the adapter understands.
 *
 * Identity is the array position (`id: idx`), which is also how references are
 * persisted, so a draft validates identically before and after a save. Parent
 * references are rewritten from the builder's live "q_<id>" form into the
 * saved "idx_<n>" form — the same rewrite `prepareQuestionsForSave` does.
 * A parent that doesn't resolve is recorded on `_parentUnresolved` rather than
 * silently dropped, so the reference check below can still see it.
 */
export function draftToDbShape(questions = []) {
  const idxByLocalKey = new Map();
  questions.forEach((q, idx) => {
    if (isSectionRow(q)) return;
    idxByLocalKey.set(`q_${q.id}`, idx);
  });

  return questions.map((q, idx) => {
    if (isSectionRow(q)) {
      return {
        id: idx,
        order: idx,
        question_text: q.section_label || '',
        question_type: '_section',
        options: [],
        tier: 1,
        parent_question_key: null,
        required: false,
      };
    }

    const { parentRef, optionIndex } = parseParentRef(q.parent_question_key);
    const wantsParent = Number(q.tier) > 1 && !!parentRef;
    // An "idx_<n>" reference is already in saved form (a draft loaded from the
    // DB and not re-parented since); a "q_<id>" one is the builder's live form.
    const idxMatch = /^idx_(\d+)$/.exec(String(parentRef || ''));
    const resolvedParentIdx = !wantsParent
      ? undefined
      : idxMatch
        ? (Number(idxMatch[1]) >= 0 && Number(idxMatch[1]) < questions.length ? Number(idxMatch[1]) : undefined)
        : idxByLocalKey.get(parentRef);

    return {
      ...q,
      id: idx,
      order: idx,
      // Options authored in the builder have no id of their own (only saved
      // rows do), and the respondent form keys its choice list on `opt.id`.
      // A stable synthetic id keeps that list correctly keyed in Test Mode.
      options: (q.options || []).map((o, oi) => ({ ...o, id: o.id ?? `${idx}-${oi}`, order: oi })),
      parent_question_key:
        resolvedParentIdx !== undefined ? formatParentRef(`idx_${resolvedParentIdx}`, optionIndex) : null,
      _parentUnresolved: wantsParent && resolvedParentIdx === undefined ? parentRef : null,
      _activatingOption: optionIndex,
    };
  });
}

/** Generic directed-cycle finder, returning each distinct cycle once. */
function findCycles(nodes, edgesOf) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(nodes.map((n) => [n, WHITE]));
  const stack = [];
  const seen = new Set();
  const cycles = [];

  const dfs = (n) => {
    color.set(n, GRAY);
    stack.push(n);
    for (const m of edgesOf(n)) {
      if (!color.has(m)) continue;
      if (color.get(m) === GRAY) {
        const cycle = stack.slice(stack.indexOf(m));
        const key = [...cycle].sort((a, b) => a - b).join(',');
        if (!seen.has(key)) { seen.add(key); cycles.push(cycle); }
      } else if (color.get(m) === WHITE) {
        dfs(m);
      }
    }
    stack.pop();
    color.set(n, BLACK);
  };

  nodes.forEach((n) => { if (color.get(n) === WHITE) dfs(n); });
  return cycles;
}

/**
 * Which questions a respondent could actually be shown.
 *
 * Mirrors `isApplicable` exactly: a root question is always applicable, and a
 * subsection question is applicable only while its parent is reachable *and*
 * the option that switches it on genuinely exists on that parent. Anything the
 * walk never marks can never appear, whatever the respondent answers.
 */
function computeReachability(adapted, model) {
  const reachable = new Array(adapted.length).fill(false);
  const blockedReason = new Array(adapted.length).fill(null);
  const queue = [];

  adapted.forEach((q, idx) => {
    if (q.is_section) return;
    if (model.parentIdxByIdx[idx] == null) { reachable[idx] = true; queue.push(idx); }
  });

  while (queue.length) {
    const parentIdx = queue.shift();
    const children = model.childrenByParentIdx.get(parentIdx) || [];
    for (const childIdx of children) {
      if (reachable[childIdx]) continue;
      const activator = model.activatingOptionByIdx[childIdx];
      const parentOptions = adapted[parentIdx]?.options || [];
      if (activator != null && !parentOptions[activator]) {
        blockedReason[childIdx] =
          `it is switched on by answer #${activator + 1} of its parent question, but that parent only has ${parentOptions.length} answer option(s)`;
        continue;
      }
      reachable[childIdx] = true;
      queue.push(childIdx);
    }
  }

  adapted.forEach((q, idx) => {
    if (q.is_section || reachable[idx] || blockedReason[idx]) return;
    blockedReason[idx] = 'the question it branches from can never be reached itself';
  });

  return { reachable, blockedReason };
}

/**
 * Run every pre-flight check over a builder draft.
 *
 * @param {Array}  questions builder-shape draft rows
 * @param {Object} meta      { title, description, category }
 * @returns {{ errors, warnings, issues, passed, checksRun, canTest }}
 */
export function validateSurvey(questions = [], meta = {}) {
  const issues = [];
  let checksRun = 0;

  /** Records one assertion. Returns whether it held, so callers can branch. */
  const check = (ok, severity, code, message, where = {}, hint = '') => {
    checksRun += 1;
    if (!ok) issues.push({ severity, code, message, hint, ...where });
    return !!ok;
  };

  const dbRows = draftToDbShape(questions);
  const adapted = adaptQuestionsForEngine(dbRows);
  const model = buildRoutingModel(adapted);
  const { questionLabels } = computeQuestionLabels(questions);

  // ── Human-readable "where" for an issue ────────────────────────────────
  const sectionLabelFor = (idx) => {
    for (let i = idx - 1; i >= 0; i--) {
      if (isSectionRow(questions[i])) return questions[i].section_label || 'Untitled section';
    }
    return null;
  };
  const at = (idx) => {
    const q = questions[idx];
    if (isSectionRow(q)) {
      return {
        index: idx,
        label: 'Section',
        title: q.section_label || 'Untitled section',
        sectionLabel: null,
      };
    }
    return {
      index: idx,
      label: `Q${questionLabels[idx] ?? idx + 1}`,
      title: (q?.question_text || '').trim() || 'Untitled question',
      sectionLabel: sectionLabelFor(idx),
    };
  };

  // Small "this row connects to that row" badge shown on issues about a jump,
  // backward route, score rule, or parent link. `targetIdx` is the resolved
  // index when the reference is valid; `rawTarget` is what was actually
  // stored (a number or a "q_<id>"/"idx_<n>" string), used to still show
  // *something* when the reference doesn't resolve to a real row.
  const toRef = (targetIdx, rawTarget) => {
    if (targetIsUsable(targetIdx)) return { label: at(targetIdx).label, valid: true };
    if (targetIdx === -1) return { label: 'End of Survey', valid: true };
    return { label: `#${rawTarget}`, valid: false };
  };

  // ── Survey-level ───────────────────────────────────────────────────────
  const answerable = questions.filter((q) => !isSectionRow(q));
  check(
    String(meta.title || '').trim().length > 0,
    SEVERITY.ERROR, 'survey.title',
    'The survey has no name.',
    {}, 'Fill in Survey Name at the top of the builder.'
  );
  check(
    String(meta.category || '').trim().length > 0,
    SEVERITY.ERROR, 'survey.category',
    'The survey has no branch.',
    {}, 'Pick a Survey Branch at the top of the builder.'
  );
  const hasQuestions = check(
    answerable.length > 0,
    SEVERITY.ERROR, 'survey.empty',
    'The survey has no questions.',
    {}, 'Add at least one question before testing.'
  );
  check(
    String(meta.description || '').trim().length > 0,
    SEVERITY.WARNING, 'survey.description',
    'The survey has no description.',
    {}, 'Respondents see this before they start.'
  );

  if (!hasQuestions) {
    const errors = issues.filter((i) => i.severity === SEVERITY.ERROR);
    return {
      issues, errors, warnings: issues.filter((i) => i.severity === SEVERITY.WARNING),
      checksRun, passed: checksRun - issues.length, canTest: false,
    };
  }

  // ── Per-row completeness, ids, options ────────────────────────────────
  const seenIds = new Map();
  questions.forEach((q, idx) => {
    const where = at(idx);

    // Unique identity — duplicated ids break parent refs and answer storage,
    // which both key off the row's identity.
    const idKey = String(q?.id ?? '');
    check(
      idKey !== '' && !seenIds.has(idKey),
      SEVERITY.ERROR, 'row.duplicateId',
      idKey === ''
        ? `${where.label} has no internal id.`
        : `${where.label} shares an internal id with ${seenIds.get(idKey) || 'another row'}.`,
      where, 'Duplicate this question again, or remove and re-add it, to get a fresh id.'
    );
    if (idKey !== '' && !seenIds.has(idKey)) seenIds.set(idKey, where.label);

    if (isSectionRow(q)) {
      check(
        String(q.section_label || '').trim().length > 0,
        SEVERITY.ERROR, 'section.name',
        'A section divider has no name.',
        where, 'Give the section a name so respondents see a meaningful heading.'
      );
      return;
    }

    check(
      String(q.question_text || '').trim().length > 0,
      SEVERITY.ERROR, 'question.text',
      `${where.label} has no question text.`,
      where, 'Every question needs text a respondent can read.'
    );

    const type = String(q.question_type || '').trim().toLowerCase();
    check(
      KNOWN_TYPES.has(type),
      SEVERITY.ERROR, 'question.type',
      `${where.label} has an unrecognised answer type ("${q.question_type}").`,
      where, 'Pick an answer type from the dropdown.'
    );

    if (CHOICE_TYPES.has(type)) {
      const options = q.options || [];
      const enough = check(
        options.length >= 2,
        SEVERITY.ERROR, 'question.optionCount',
        `${where.label} is a choice question but has ${options.length} answer option(s).`,
        where, 'A choice question needs at least two options to choose between.'
      );

      if (enough) {
        const blank = options.filter((o) => !String(o?.option_text || '').trim()).length;
        check(
          blank === 0,
          SEVERITY.ERROR, 'question.optionText',
          `${where.label} has ${blank} answer option(s) with no text.`,
          where, 'Fill in every choice, or remove the empty ones.'
        );

        const texts = options.map((o) => String(o?.option_text || '').trim().toLowerCase()).filter(Boolean);
        check(
          new Set(texts).size === texts.length,
          SEVERITY.WARNING, 'question.duplicateOptions',
          `${where.label} has two answer options with the same text.`,
          where, 'Identical labels make a respondent\'s choice ambiguous in the results.'
        );
      }
    } else if ((q.options || []).length > 0) {
      check(
        false,
        SEVERITY.WARNING, 'question.strayOptions',
        `${where.label} is a "${type}" question but still carries ${q.options.length} answer option(s).`,
        where, 'Those options will not be shown. Remove them or switch to a choice type.'
      );
    }

    if (type === 'rating') {
      // A word scale is sized by its captions, every other style by rating_max.
      if ((q.rating_style || 'number') === 'word') {
        const words = parseLabelList(q.rating_labels);
        check(
          words.length >= 2,
          SEVERITY.ERROR, 'question.ratingWords',
          `${where.label} is a word rating scale with ${words.length} caption(s).`,
          where, 'Add at least two captions, lowest first — e.g. Very Bad … Very Good.'
        );
      } else {
        check(
          Number(q.rating_max) >= 2,
          SEVERITY.ERROR, 'question.ratingMax',
          `${where.label} is a rating question with a maximum of ${q.rating_max}.`,
          where, 'A rating scale needs a maximum of at least 2.'
        );
      }
    }

    if (type === 'matrix') {
      const rows = parseLabelList(q.matrix_rows);
      const cols = parseLabelList(q.matrix_columns);
      check(
        rows.length >= 1,
        SEVERITY.ERROR, 'question.matrixRows',
        `${where.label} is a grid question with no rows.`,
        where, 'Add at least one row statement for respondents to answer.'
      );
      check(
        cols.length >= 2,
        SEVERITY.ERROR, 'question.matrixColumns',
        `${where.label} is a grid question with ${cols.length} column(s).`,
        where, 'A grid needs at least two answer choices to pick between.'
      );
      check(
        new Set(rows).size === rows.length,
        SEVERITY.ERROR, 'question.matrixDuplicateRows',
        `${where.label} has two grid rows with the same text.`,
        where, 'Answers are stored per row label, so each row must be unique.'
      );
      check(
        new Set(cols).size === cols.length,
        SEVERITY.WARNING, 'question.matrixDuplicateColumns',
        `${where.label} has two grid columns with the same text.`,
        where, 'Identical column labels make a respondent\'s choice ambiguous.'
      );
    }

    if (type === 'file_upload') {
      check(
        Number(q.max_file_size_mb ?? 10) >= 1,
        SEVERITY.ERROR, 'question.uploadSize',
        `${where.label} is an upload question with a maximum size of ${q.max_file_size_mb}MB.`,
        where, 'Set a size limit of at least 1MB.'
      );
    }
  });

  // ── References: nothing may point at something that isn't there ────────
  const targetIsUsable = (targetIdx) =>
    Number.isInteger(targetIdx) &&
    targetIdx >= 0 &&
    targetIdx < adapted.length &&
    !adapted[targetIdx].is_section;

  dbRows.forEach((row, idx) => {
    if (adapted[idx].is_section) return;
    const where = at(idx);

    // Per-option Jump Routes. A blank jump ("Next Question") is a perfectly
    // valid destination, so only explicitly-set targets are checked.
    (row.options || []).forEach((opt, oIdx) => {
      const raw = opt?.next_question;
      if (raw === null || raw === undefined || raw === '') return;
      const target = parseInt(raw, 10);
      if (target === -1) return; // "End of Survey" — a valid destination.

      const label = String(opt?.option_text || '').trim() || `option ${oIdx + 1}`;
      const ok = check(
        targetIsUsable(target),
        SEVERITY.ERROR, 'jump.broken',
        `${where.label}: answer "${label}" jumps to a question that no longer exists.`,
        { ...where, to: toRef(target, raw) }, 'Re-pick a destination in that option\'s Jump Route.'
      );
      if (!ok) return;

      check(
        target !== idx,
        SEVERITY.ERROR, 'jump.self',
        `${where.label}: answer "${label}" jumps back to the same question — an endless loop.`,
        { ...where, to: toRef(target, raw) }, 'Point it at a different question, or leave it as "Next Question".'
      );
    });

    // Backward Route — fires unconditionally once the question is answered.
    const rawBackward = row.backward_question;
    if (rawBackward !== null && rawBackward !== undefined && rawBackward !== '') {
      const target = parseInt(rawBackward, 10);
      const ok = check(
        targetIsUsable(target),
        SEVERITY.ERROR, 'backward.broken',
        `${where.label} has a Backward Route to a question that no longer exists.`,
        { ...where, to: toRef(target, rawBackward) }, 'Clear the Backward Route or re-pick its target.'
      );
      if (ok) {
        check(
          target !== idx,
          SEVERITY.ERROR, 'backward.self',
          `${where.label} has a Backward Route pointing at itself — an endless loop.`,
          { ...where, to: toRef(target, rawBackward) }, 'Clear it, or point it at a different question.'
        );
      }
    }

    // Score-Based Routing rules.
    const rules = parseScoreRules(row);
    rules.forEach((rule, rIdx) => {
      if (rule.target == null) {
        check(
          false,
          SEVERITY.WARNING, 'score.noTarget',
          `${where.label}: score rule ${rIdx + 1} ("at least ${rule.min}") has no destination yet.`,
          where, 'Pick where that score should send the respondent, or remove the rule.'
        );
        return;
      }
      if (rule.target === -1) return; // End of Survey.
      check(
        targetIsUsable(rule.target),
        SEVERITY.ERROR, 'score.broken',
        `${where.label}: score rule ${rIdx + 1} ("at least ${rule.min}") points at a question that no longer exists.`,
        { ...where, to: toRef(rule.target, rule.target) }, 'Re-pick the destination for that score rule.'
      );
    });

    // Every question named in a score cluster has to still be there, or the
    // combined score silently loses a contributor.
    parseScoreClusterMembers(row.scale).forEach((memberIdx) => {
      check(
        targetIsUsable(memberIdx),
        SEVERITY.ERROR, 'score.cluster',
        `${where.label} combines its score with a question that no longer exists.`,
        { ...where, to: toRef(memberIdx, memberIdx) }, 'Re-pick the questions under "Combine scores from".'
      );
    });

    // Subsection parent link.
    if (row._parentUnresolved) {
      check(
        false,
        SEVERITY.ERROR, 'parent.broken',
        `${where.label} is a sub-section of a question that no longer exists.`,
        { ...where, to: toRef(-2, row._parentUnresolved) }, 'Move it back to the top level, or re-attach it to a question that exists.'
      );
    } else if (model.parentIdxByIdx[idx] != null) {
      const parentIdx = model.parentIdxByIdx[idx];
      const parentWhere = at(parentIdx);
      const parentOk = check(
        !adapted[parentIdx].is_section,
        SEVERITY.ERROR, 'parent.isSection',
        `${where.label} hangs off a section divider instead of a question.`,
        { ...where, to: { label: parentWhere.label, valid: true } }, 'A sub-section must branch from a real question.'
      );

      const activator = model.activatingOptionByIdx[idx];
      if (parentOk && activator != null) {
        check(
          !!adapted[parentIdx].options?.[activator],
          SEVERITY.ERROR, 'parent.missingOption',
          `${where.label} is shown when ${parentWhere.label} is answered with option ${activator + 1}, but that option no longer exists.`,
          { ...where, to: { label: parentWhere.label, valid: true } }, 'Re-pick the answer that should reveal this sub-section.'
        );
      } else if (parentOk && activator == null) {
        check(
          false,
          SEVERITY.WARNING, 'parent.noCondition',
          `${where.label} is a sub-section of ${parentWhere.label} but no answer is set to trigger it.`,
          { ...where, to: { label: parentWhere.label, valid: true } }, 'It will show whenever the parent is answered. Pick a triggering answer if that is not intended.'
        );
      }
    }
  });

  // ── Loops ──────────────────────────────────────────────────────────────
  const answerableIdx = adapted.map((q, i) => (q.is_section ? -1 : i)).filter((i) => i >= 0);
  const describe = (cycle) => cycle.map((i) => at(i).label).join(' → ') + ` → ${at(cycle[0]).label}`;

  // Parent-chain cycle: a sub-section that is its own ancestor. The runtime
  // guards against spinning on this, but nothing in the cycle can ever show.
  findCycles(answerableIdx, (n) => {
    const p = model.parentIdxByIdx[n];
    return p == null ? [] : [p];
  }).forEach((cycle) => {
    check(
      false,
      SEVERITY.ERROR, 'loop.parent',
      `Sub-section loop: ${describe(cycle)}. These questions are each other's parent, so none of them can ever be shown.`,
      at(cycle[0]), 'Move one of them back to the top level to break the loop.'
    );
  });

  // Backward-Route cycle: these fire on every answer regardless of choice, so
  // a ring of them genuinely bounces the respondent between the same questions.
  // Self-references are excluded here — they are already reported, far more
  // clearly, as `backward.self` / `jump.self` above.
  findCycles(answerableIdx, (n) => {
    const raw = dbRows[n]?.backward_question;
    if (raw === null || raw === undefined || raw === '') return [];
    const t = parseInt(raw, 10);
    return targetIsUsable(t) && t !== n ? [t] : [];
  }).forEach((cycle) => {
    check(
      false,
      SEVERITY.ERROR, 'loop.backward',
      `Backward Route loop: ${describe(cycle)}. Backward Routes fire on every answer, so this sends the respondent round in circles.`,
      at(cycle[0]), 'Clear the Backward Route on one of these questions.'
    );
  });

  // Jump-Route cycle: only reachable via specific answers, and the survey's
  // "skip anything already answered" rule breaks it in practice — worth
  // flagging, not worth blocking a test run over.
  findCycles(answerableIdx, (n) => {
    const targets = [];
    (dbRows[n]?.options || []).forEach((opt) => {
      const raw = opt?.next_question;
      if (raw === null || raw === undefined || raw === '') return;
      const t = parseInt(raw, 10);
      if (targetIsUsable(t) && t !== n) targets.push(t);
    });
    return targets;
  }).forEach((cycle) => {
    check(
      false,
      SEVERITY.WARNING, 'loop.jump',
      `Jump Route loop: ${describe(cycle)}. Answered questions are skipped, so this will not trap a respondent, but the path doubles back on itself.`,
      at(cycle[0]), 'Check these jumps go where you intend.'
    );
  });

  // ── Reachability ───────────────────────────────────────────────────────
  // A broken parent link is already reported above with the precise reason, so
  // only rows without such an error get the general "can never be shown" note —
  // otherwise one mistake would be listed twice under two different headings.
  const alreadyExplained = new Set(
    issues
      .filter((i) => i.severity === SEVERITY.ERROR && String(i.code).startsWith('parent.'))
      .map((i) => i.index)
  );
  const { reachable, blockedReason } = computeReachability(adapted, model);
  adapted.forEach((q, idx) => {
    if (q.is_section || alreadyExplained.has(idx)) return;
    const where = at(idx);
    check(
      reachable[idx],
      SEVERITY.ERROR, 'unreachable',
      `${where.label} can never be shown to anyone: ${blockedReason[idx] || 'nothing leads to it'}.`,
      where, 'Fix the answer that should reveal it, or move it to the top level.'
    );
  });

  // A section whose questions are all unreachable renders as an empty heading.
  questions.forEach((q, idx) => {
    if (!isSectionRow(q)) return;
    let end = questions.length;
    for (let i = idx + 1; i < questions.length; i++) {
      if (isSectionRow(questions[i])) { end = i; break; }
    }
    const members = [];
    for (let i = idx + 1; i < end; i++) if (!isSectionRow(questions[i])) members.push(i);
    check(
      members.length > 0 && members.some((i) => reachable[i]),
      SEVERITY.WARNING, 'section.empty',
      members.length === 0
        ? `Section "${q.section_label || 'Untitled'}" has no questions under it.`
        : `Section "${q.section_label || 'Untitled'}" has no questions that can ever be shown.`,
      at(idx), 'Add a question under it, or remove the section.'
    );
  });

  const errors = issues.filter((i) => i.severity === SEVERITY.ERROR);
  const warnings = issues.filter((i) => i.severity === SEVERITY.WARNING);

  return {
    issues,
    errors,
    warnings,
    checksRun,
    passed: checksRun - issues.length,
    canTest: errors.length === 0,
  };
}
