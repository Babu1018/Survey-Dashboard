/**
 * Stub implementations for the external modules referenced by assessmentFlowEngine.js.
 *
 * The flow engine was originally written for a clinical platform with several
 * domain-specific modules (HOPELINE, display-label utilities, matrix questions, etc.).
 * None of those modules exist in this codebase, so we provide minimal stubs that let
 * the generic routing code (option jumps, score conditions, sequential walk) work
 * correctly while all HOPELINE/tier-2/matrix paths degrade gracefully to null/false.
 */

// ─── assessmentQuestionMeta stubs ────────────────────────────────────────────

/**
 * Parse JSON stored in a question's ui_class field.
 * Our questions have no ui_class, so always return an empty object.
 */
export function parseQuestionUiClass(_uiClass) {
  return {};
}

/**
 * Serialize question metadata back to a ui_class string.
 * No-op for this codebase.
 */
export function serializeQuestionUiClass(_q) {
  return '';
}

/** Matrix questions are not used in this survey platform. */
export function isMatrixQuestion(_q) {
  return false;
}

/** Always "complete" since matrix questions don't exist here. */
export function isMatrixAnswerComplete(_q, _val) {
  return true;
}

// ─── hopelineFlowManifest stubs ──────────────────────────────────────────────

/**
 * Returns true when a section key belongs to a HOPELINE tier-2 flow.
 * No HOPELINE sections exist in this codebase.
 */
export function isHopelineTier2Section(_section) {
  return false;
}

// ─── hopelineDisplayOrder stubs ──────────────────────────────────────────────

export function resolveHopelineParentForTier2Section(_section) {
  return null;
}

export function resolveHopelineTier2SectionForParent(_questionKey) {
  return null;
}

// ─── applyAssessmentDisplayOrder stubs ───────────────────────────────────────

/**
 * Returns true when every question already has a numeric display_order saved.
 * We synthesise display_order in the adapter, so this always returns false —
 * letting the engine use its own label-map ordering instead.
 */
export function hasDisplayOrder(_qs) {
  return false;
}

/** Pass-through: no pre-stored display order to apply. */
export function applyAssessmentDisplayOrder(qs) {
  return qs;
}

// ─── displayLabelUtils stubs ─────────────────────────────────────────────────

/**
 * Returns the explicit display label embedded in ui_class or display_label.
 * Our questions receive display_label directly from the adapter, so no
 * extra lookup is needed — returning null lets the engine fall back to its
 * own computeMainQuestionLabelMap.
 */
export function getExplicitDisplayLabel(_q) {
  return null;
}

/**
 * Parse a label string like "3" or "11(a)" into { base, suffix }.
 * @param {string} label
 * @returns {{ base: number|null, suffix: string }}
 */
export function parseDisplayLabel(label) {
  if (label == null || label === '') return { base: null, suffix: '' };
  const str = String(label).trim();
  const match = str.match(/^(\d+)(\([a-zA-Z]+\))?$/);
  if (!match) return { base: null, suffix: '' };
  return { base: Number(match[1]), suffix: match[2] || '' };
}

/**
 * Format a label number + suffix back to a string.
 */
export function formatDisplayLabel(base, suffix) {
  return suffix ? `${base}${suffix}` : String(base);
}

/** No HOPELINE display label for generic questions. */
export function hopelineDisplayLabelForQuestion(_q) {
  return null;
}

/** No HOPELINE key → label mapping in this codebase. */
export function getHopelineMainLabelNumber(_q) {
  return null;
}

/** Empty HOPELINE label dictionary — no hardcoded question keys here. */
export const HOPELINE_KEY_DISPLAY_LABELS = {};
