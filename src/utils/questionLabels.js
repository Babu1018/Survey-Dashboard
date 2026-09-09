import { parseParentRef } from './surveyRouting.js';

// Shared hierarchical question-numbering logic used by both the Survey
// Builder (authoring view) and SurveyForm (respondent view), so both sides
// always show identical labels for tiered follow-up questions.
//
// Root (tier-1) questions get sequential whole numbers: 1, 2, 3...
// Any question with a valid parent_question_key gets "<parent label>.<sibling index>"
// (e.g. 3.1, 3.2, 3.1.1), recursively, so tiers 2 through 5 all nest and
// number correctly no matter how deep the chain goes. This is purely a
// display concern — it does not touch array order, indices, or saved
// next_question jump targets.
export function computeQuestionLabels(questions) {
  const questionLabels = {};
  const childrenByParentIdx = {};
  const nestedChildIndexSet = new Set();

  const idxByKey = new Map();
  questions.forEach((q, idx) => {
    if (q.question_type === '_section') return;
    idxByKey.set(`q_${q.id}`, idx);
  });

  // parent_question_key comes in one of two forms depending on the caller:
  // "idx_<arrayPosition>" as persisted by the builder (stable across saves,
  // since ids are reassigned on every save), or the in-memory "q_<id>" form
  // the builder still uses for its own live state. Either may carry a trailing
  // ":opt_<n>" naming the parent option that activates this subsection — that
  // half is a routing concern (see surveyRouting.js) and is stripped here.
  const resolveParentIdx = (parentKey) => {
    const { parentRef } = parseParentRef(parentKey);
    if (!parentRef) return null;
    const m = /^idx_(\d+)$/.exec(parentRef);
    if (m) {
      const idx = parseInt(m[1], 10);
      return idx >= 0 && idx < questions.length ? idx : null;
    }
    return idxByKey.has(parentRef) ? idxByKey.get(parentRef) : null;
  };

  questions.forEach((q, idx) => {
    if (q.question_type === '_section') return;
    if (Number(q.tier) > 1) {
      const parentIdx = resolveParentIdx(q.parent_question_key);
      if (parentIdx !== null) {
        if (!childrenByParentIdx[parentIdx]) childrenByParentIdx[parentIdx] = [];
        childrenByParentIdx[parentIdx].push(idx);
        nestedChildIndexSet.add(idx);
      }
    }
  });

  const assignLabel = (idx, label) => {
    questionLabels[idx] = label;
    (childrenByParentIdx[idx] || []).forEach((childIdx, k) => assignLabel(childIdx, `${label}.${k + 1}`));
  };

  let mainCounter = 0;
  questions.forEach((q, idx) => {
    if (q.question_type === '_section') return;
    if (nestedChildIndexSet.has(idx)) return; // labelled recursively from its root ancestor
    mainCounter += 1;
    assignLabel(idx, String(mainCounter));
  });

  return { questionLabels, childrenByParentIdx, nestedChildIndexSet };
}
