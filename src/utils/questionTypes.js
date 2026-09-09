/**
 * Shared vocabulary for the richer answer types — Rating Scale styles,
 * Ranking, Matrix/Grid and Media Upload.
 *
 * The builder authors these and the respondent form renders them, so anything
 * both sides must agree on (how a label list is stored, how an answer is
 * encoded, which file extensions a family covers) lives here rather than being
 * written twice and drifting apart.
 */

// ─── Label lists ──────────────────────────────────────────────────────
// Matrix rows/columns and word-rating captions are each stored as a JSON array
// in one text column, but authored as one-per-line text. Anything unparseable
// reads as an empty list rather than throwing while the admin is mid-edit.
export const parseLabelList = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((s) => String(s)) : [];
  } catch {
    return [];
  }
};

export const serializeLabelList = (text) =>
  JSON.stringify(
    String(text || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  );

// ─── Rating ───────────────────────────────────────────────────────────
export const RATING_STYLES = [
  { value: 'number', label: 'Number Scale' },
  { value: 'star', label: 'Star Rating' },
  { value: 'emoji', label: 'Emoji Rating' },
  { value: 'bar', label: 'Horizontal Bar' },
  { value: 'word', label: 'Word Scale' },
];

// The five-point word scales named in the spec, offered as one-click presets
// so the common cases don't have to be typed out.
export const WORD_SCALE_PRESETS = {
  quality: ['Very Bad', 'Bad', 'Average', 'Good', 'Very Good'],
  satisfaction: ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'],
};

// Faces for the emoji style, worst → best. A scale longer than this reuses the
// end faces rather than running out, since the number underneath still
// disambiguates the exact point chosen.
const EMOJI_FACES = ['😡', '🙁', '😐', '🙂', '😍'];

/**
 * The face to show at 1-based position `value` on a scale of `max` points.
 * Positions are spread across the five faces so a 1–10 scale still runs
 * angry → delighted rather than stopping at the fifth point.
 */
export const emojiForRating = (value, max) => {
  if (max <= 1) return EMOJI_FACES[EMOJI_FACES.length - 1];
  const ratio = (value - 1) / (max - 1);
  return EMOJI_FACES[Math.min(EMOJI_FACES.length - 1, Math.round(ratio * (EMOJI_FACES.length - 1)))];
};

// Segment colours for the Horizontal Bar style, worst → best. A scale with more
// points than this steps across the same five stops, so a 1–10 bar still runs
// red → green rather than repeating the last colour.
const BAR_COLORS = ['#e5484d', '#f76b15', '#ffc53d', '#a5d64c', '#4caf50'];

/** The bar colour at 1-based position `value` on a scale of `max` points. */
export const barColorForRating = (value, max) => {
  if (max <= 1) return BAR_COLORS[BAR_COLORS.length - 1];
  const ratio = (value - 1) / (max - 1);
  return BAR_COLORS[Math.min(BAR_COLORS.length - 1, Math.round(ratio * (BAR_COLORS.length - 1)))];
};

/**
 * How many points a rating question offers. A word scale is defined by its
 * captions; every other style by rating_max.
 */
export const ratingPointCount = (q) => {
  if ((q?.rating_style || 'number') === 'word') {
    const words = parseLabelList(q?.rating_labels);
    return words.length || 5;
  }
  return Number(q?.rating_max) || 5;
};

// ─── Media Upload ─────────────────────────────────────────────────────
export const FILE_TYPE_FAMILIES = [
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
];

// Kept in step with ANSWER_FILE_EXTENSIONS in Backend/routers/surveys.py.
// This drives the file picker's `accept` hint; the backend does the enforcing.
export const FILE_TYPE_EXTENSIONS = {
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic'],
  document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.odt'],
  video: ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'],
};

/** Families configured on a question; empty config means "all of them". */
export const allowedFamilies = (q) => {
  const picked = String(q?.allowed_file_types || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return picked.length ? picked : FILE_TYPE_FAMILIES.map((f) => f.value);
};

/** `accept` attribute for a Media Upload question's file input. */
export const acceptAttribute = (q) =>
  allowedFamilies(q)
    .flatMap((family) => FILE_TYPE_EXTENSIONS[family] || [])
    .join(',');

/**
 * A Media Upload answer is stored as JSON: { url, filename, size }.
 * Older/blank answers read back as null rather than throwing.
 */
export const parseUploadAnswer = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.url ? parsed : null;
  } catch {
    // A bare URL string, from before this was JSON-encoded.
    return String(raw).startsWith('http') ? { url: String(raw), filename: 'Attached file' } : null;
  }
};

// ─── Ranking ──────────────────────────────────────────────────────────
/**
 * A Ranking answer is stored as a JSON array of option texts, best first.
 * Returns the respondent's saved order, reconciled against the question's
 * current options so an option added or removed since they answered doesn't
 * strand the list: known items keep their saved position, new ones join the end.
 */
export const parseRankingAnswer = (raw, optionTexts = []) => {
  let saved = [];
  try {
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) saved = parsed.map((s) => String(s));
  } catch {
    saved = [];
  }
  const known = saved.filter((text) => optionTexts.includes(text));
  const missing = optionTexts.filter((text) => !known.includes(text));
  return [...known, ...missing];
};

// ─── Matrix / Grid ────────────────────────────────────────────────────
/**
 * A Matrix answer is stored as JSON keyed by row label. Single-select rows
 * hold the chosen column as a string; multi-select rows hold an array.
 */
export const parseMatrixAnswer = (raw) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/** True when `column` is currently selected for `row` in a matrix answer. */
export const matrixHas = (answer, row, column) => {
  const cell = answer?.[row];
  return Array.isArray(cell) ? cell.includes(column) : cell === column;
};
