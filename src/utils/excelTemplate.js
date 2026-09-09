// Excel template generation + parsing for the Survey Builder's translator
// workflow (Automation Template / Manual 13-sheet Template, and their
// uploads). Pulled out of SurveyBuilder.jsx because this format is a
// self-contained concern with its own column layout, validation, and
// parsing rules.
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { INDIC_LANGUAGES } from './translater.js';

// ─── Column layout ──────────────────────────────────────────────────────
// Shared by the template generators (which write these headers) and the
// parser (which matches header text back to these fields by substring, so
// hand-edited header text still works). Column A ("Question Number") is the
// reference key every jump/parent/backward column points at.
//
// Columns are grouped and ordered basic-first: the six a simple survey
// actually needs come first, so a plain form fits in one visible screen
// width. Everything past "Required" is optional routing/scoring/rating
// machinery — grouped and color-banded (see GROUPS below) so it reads as
// "advanced, skip if you don't need it" rather than one flat 17-column wall.
const GROUPS = {
  basic: { label: 'BASIC — fill in for every question', fill: 'FFDCF2DC', headerFill: 'FFEAF7EA' },
  routing: { label: 'ADVANCED — scoring & routing (leave blank for a simple survey)', fill: 'FFFCE8CC', headerFill: 'FFFDF3E3' },
  rating: { label: 'ADVANCED — rating questions only (leave blank otherwise)', fill: 'FFDCEEFB', headerFill: 'FFEBF6FD' },
};

const TEMPLATE_COLUMNS = [
  { key: 'questionNumber', header: 'Question Number', width: 16, group: 'basic' },
  { key: 'rowType', header: 'Row Type (Question/Section)', width: 14, group: 'basic' },
  { key: 'questionText', header: 'Question Text / Section Name', width: 45, group: 'basic' },
  { key: 'answerType', header: 'Answer Type', width: 16, group: 'basic' },
  { key: 'options', header: 'Options (semicolon-separated)', width: 34, group: 'basic' },
  { key: 'required', header: 'Required (Yes/No)', width: 14, group: 'basic' },
  { key: 'optionScores', header: 'Scores (semicolon-separated)', width: 24, group: 'routing' },
  { key: 'optionRedFlags', header: 'Red Flags (semicolon-separated Yes/No)', width: 32, group: 'routing' },
  { key: 'optionJumps', header: 'Option Jumps (semicolon-separated)', width: 32, group: 'routing' },
  { key: 'scoreThreshold', header: 'Score Threshold', width: 16, group: 'routing' },
  { key: 'thresholdJump', header: 'Threshold Jump', width: 20, group: 'routing' },
  { key: 'backwardRoute', header: 'Backward Route', width: 20, group: 'routing' },
  { key: 'parentQuestionNumber', header: 'Parent Question Number', width: 22, group: 'routing' },
  { key: 'ratingMax', header: 'Rating Max', width: 12, group: 'rating' },
  { key: 'lowLabel', header: 'Low Label', width: 20, group: 'rating' },
  { key: 'highLabel', header: 'High Label', width: 20, group: 'rating' },
  { key: 'scale', header: 'Scale', width: 18, group: 'rating' },
];

const GROUP_ROW = 4;
const HEADER_ROW = 5;
// Two worked examples (row 6: a scored question with a jump; row 7: the
// subsection that jump lands on) so the semicolon/position conventions and
// routing columns are visible in a real filled-out row, not just prose.
const EXAMPLE_ROWS = [6, 7];
const DATA_START_ROW = 8;
const DATA_END_ROW = 207;

const colLetter = (oneBasedIndex) => String.fromCharCode(64 + oneBasedIndex);
const letterOf = (key) => colLetter(TEMPLATE_COLUMNS.findIndex(c => c.key === key) + 1);

// ─── Template generation ────────────────────────────────────────────────

// One EXAMPLE_ROWS-shaped worked example: a scored Yes/No question whose
// "No" answer jumps straight to End, and whose "Yes" answer jumps into the
// row-2 subsection — the same pattern the routing columns exist for, filled
// in correctly so it can be read (or copied) rather than deduced from prose.
const EXAMPLE_DATA = [
  {
    questionNumber: '1', rowType: 'Question',
    questionText: 'EXAMPLE — Are you satisfied? (edit or delete this row)',
    answerType: 'radio', options: 'Yes;No', required: 'Yes',
    optionScores: '10;0', optionRedFlags: 'No;No', optionJumps: '2;End',
    scoreThreshold: '10', thresholdJump: 'End',
  },
  {
    questionNumber: '2', rowType: 'Question',
    questionText: 'EXAMPLE — Follow-up shown only when "Yes" is picked (edit or delete this row)',
    answerType: 'short', required: 'Yes', parentQuestionNumber: '1',
  },
];

function writeTemplateSheet(worksheet) {
  worksheet.getCell('A1').value = 'Survey Title';
  worksheet.getCell('B1').value = '';
  worksheet.getCell('A1').font = { bold: true };

  worksheet.getCell('A2').value = 'Category';
  worksheet.getCell('B2').value = '';
  worksheet.getCell('A2').font = { bold: true };

  worksheet.getCell('A3').value = 'Survey Description';
  worksheet.getCell('B3').value = '';
  worksheet.getCell('A3').font = { bold: true };

  // Row 4 — one merged, colored band per group, labeling the columns below
  // it as basic or advanced-and-optional before a user reads a single header.
  let groupStartIdx = 0;
  for (let i = 1; i <= TEMPLATE_COLUMNS.length; i++) {
    const atEnd = i === TEMPLATE_COLUMNS.length;
    const groupChanges = !atEnd && TEMPLATE_COLUMNS[i].group !== TEMPLATE_COLUMNS[groupStartIdx].group;
    if (atEnd || groupChanges) {
      const groupKey = TEMPLATE_COLUMNS[groupStartIdx].group;
      const group = GROUPS[groupKey];
      const fromLetter = colLetter(groupStartIdx + 1);
      const toLetter = colLetter(i);
      if (fromLetter !== toLetter) worksheet.mergeCells(`${fromLetter}${GROUP_ROW}:${toLetter}${GROUP_ROW}`);
      const cell = worksheet.getCell(`${fromLetter}${GROUP_ROW}`);
      cell.value = group.label;
      cell.font = { bold: true, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: group.fill } };
      groupStartIdx = i;
    }
  }
  worksheet.getRow(GROUP_ROW).height = 24;

  TEMPLATE_COLUMNS.forEach((col, i) => {
    const letter = colLetter(i + 1);
    const cell = worksheet.getCell(`${letter}${HEADER_ROW}`);
    cell.value = col.header;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GROUPS[col.group].headerFill } };
    worksheet.getColumn(letter).width = col.width;
  });
  worksheet.getRow(HEADER_ROW).font = { bold: true };

  // Worked example rows — real, parseable data, visually marked (italic,
  // muted) so they read as "sample, replace me" rather than real content.
  EXAMPLE_ROWS.forEach((rowNum, i) => {
    const data = EXAMPLE_DATA[i];
    if (!data) return;
    TEMPLATE_COLUMNS.forEach((col, ci) => {
      const letter = colLetter(ci + 1);
      const cell = worksheet.getCell(`${letter}${rowNum}`);
      if (data[col.key] !== undefined) cell.value = data[col.key];
      cell.font = { italic: true, color: { argb: 'FF6B7280' } };
    });
  });

  const validationFrom = EXAMPLE_ROWS[0];
  const dataRange = (key) => `${letterOf(key)}${validationFrom}:${letterOf(key)}${DATA_END_ROW}`;
  const questionNumberRange = `$${letterOf('questionNumber')}$${validationFrom}:$${letterOf('questionNumber')}$${DATA_END_ROW}`;

  worksheet.dataValidations.add(dataRange('rowType'), {
    type: 'list', allowBlank: true, formulae: ['"Question,Section"']
  });
  worksheet.dataValidations.add(dataRange('answerType'), {
    type: 'list', allowBlank: true, formulae: ['"short,paragraph,radio,check box,score,rating"']
  });
  worksheet.dataValidations.add(dataRange('required'), {
    type: 'list', allowBlank: true, formulae: ['"Yes,No"']
  });
  // Single-value reference columns get a dropdown suggesting existing
  // Question Numbers. Not enforced (showErrorMessage: false) so typing
  // "End" still works even though it isn't itself a Question Number.
  ['thresholdJump', 'backwardRoute', 'parentQuestionNumber'].forEach(key => {
    worksheet.dataValidations.add(dataRange(key), {
      type: 'list', allowBlank: true, showErrorMessage: false, formulae: [questionNumberRange]
    });
  });
  // Option Jumps holds semicolon-separated, index-aligned values (one per
  // Option) — a single-pick dropdown would overwrite that, so it's left as
  // free text; the Instructions sheet explains the convention instead.
}

function addInstructionRows(worksheet, isManual) {
  worksheet.getColumn('A').width = 34;
  worksheet.getColumn('B').width = 90;

  let row = 1;
  const heading = (text) => {
    worksheet.getCell(`A${row}`).value = text;
    worksheet.getCell(`A${row}`).font = { bold: true, size: 13 };
    row += 2;
  };
  const line = (label, text) => {
    if (text === undefined) {
      worksheet.getCell(`A${row}`).value = label;
      worksheet.getCell(`A${row}`).font = { bold: true };
    } else {
      worksheet.getCell(`A${row}`).value = label;
      worksheet.getCell(`A${row}`).font = { bold: true };
      worksheet.getCell(`B${row}`).value = text;
      worksheet.getCell(`B${row}`).alignment = { wrapText: true, vertical: 'top' };
    }
    row += 1;
  };
  const blank = () => { row += 1; };

  heading('Quick start');
  line('', 'The Survey Template sheet has two rows of real, worked-out example data (in gray italics, rows 6-7) right below the headers — the fastest way to see the conventions below in action is to look at those rows, then overwrite them with your own questions.');
  line('The 6 green BASIC columns', 'Every question needs these — Question Number (a short unique label like 1, 2, 3), Row Type (Question or Section), Question Text / Section Name, Answer Type (short, paragraph, radio, check box, score, or rating), Options (only for radio/check box — semicolon-separated, e.g. "Yes;No;Maybe"), and Required (Yes/No).');
  line('The orange & blue ADVANCED columns', 'Everything past Required is optional routing, scoring, and rating machinery. Leave a whole column blank if you\'re not using that feature — a plain survey only needs the 6 basic columns.');
  blank();

  heading('Advanced — scoring & routing (orange columns)');
  line('Scores / Red Flags / Option Jumps', 'Each is semicolon-separated and lines up position-for-position with Options — the 2nd value belongs to the 2nd option, and so on. Red Flags use Yes/No per option. Option Jumps holds a Question Number (or "End") per option, for when picking that option should skip straight to another question.');
  line('Score Threshold / Threshold Jump', 'If the running score reaches Score Threshold, jump to the question named in Threshold Jump (or "End").');
  line('Backward Route', 'A Question Number to jump to once this question is answered — fires no matter which answer was picked, and overrides every other jump. Leave blank for no override.');
  line('Parent Question Number', 'Leave blank for a normal, top-level question. Fill in another question\'s Question Number to make this row a sub-section — a follow-up that only makes sense after that question. Pair it with an Option Jumps entry on the parent row so picking that option actually navigates here (see the row 6-7 example). Place the parent\'s row above this one in the sheet.');
  blank();

  heading('Advanced — rating questions only (blue columns)');
  line('Rating Max / Low Label / High Label', 'Only used for "rating" questions — the top of the scale, and labels for the low and high ends (e.g. "Never" / "Always").');
  line('Scale', 'Optional free-text grouping label (e.g. "Depression", "Anxiety") used for scored assessments.');
  blank();

  heading('Sections and sub-sections, briefly');
  line('A section', 'Add a row with Row Type = Section and the section name in Question Text / Section Name. Every question row below it (until the next Section row) is shown grouped under it.');
  line('A sub-section', 'On the question that should branch: put the sub-section\'s Question Number in that question\'s Option Jumps, in the position matching the triggering option. On the sub-section\'s own row: set Parent Question Number to the triggering question\'s Question Number.');

  if (isManual) {
    blank();
    heading('Manual template — one sheet per language');
    line('', 'Every language sheet is a complete, independent copy of the survey — not just translated text layered on the English sheet. Keep Answer Type, Options count, Required, Scores, Red Flags, Option Jumps, Parent Question Number, Backward Route, Rating Max and Score Threshold identical (same Question Numbers, same row order) on every sheet. Only translate the display text: Question Text / Section Name, Options, Low Label, High Label, and Scale.');
  }
}

export async function downloadExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  addInstructionRows(workbook.addWorksheet('Instructions'), false);
  writeTemplateSheet(workbook.addWorksheet('Survey Template'));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'survey_automation_template.xlsx';
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export async function downloadManualExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  addInstructionRows(workbook.addWorksheet('Instructions'), true);
  for (const lang of INDIC_LANGUAGES) {
    writeTemplateSheet(workbook.addWorksheet(lang.name));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'survey_manual_template_13_sheets.xlsx';
  anchor.click();
  window.URL.revokeObjectURL(url);
}

// ─── Parsing ─────────────────────────────────────────────────────────────

// A jump/parent/backward cell resolves to a final 0-based index into the
// parsed questions array, in priority order: "End"/"-1"/"submit" (terminate
// the survey), "next" (explicitly no jump), an exact match against another
// row's Question Number, then — for older/partially-filled sheets where
// Question Number was never relied on — a plain 1-based count of real
// (non-Section) questions encountered so far in the sheet.
const resolveRef = (raw, idByQuestionNumber, idByOrdinal) => {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const norm = s.toLowerCase();
  if (norm === 'end' || norm === '-1' || norm === 'submit') return -1;
  if (norm === 'next') return null;
  if (idByQuestionNumber.has(s)) return idByQuestionNumber.get(s);
  const asNum = parseInt(s, 10);
  if (!isNaN(asNum) && idByOrdinal.has(asNum)) return idByOrdinal.get(asNum);
  return null;
};

export const parseExcelSheet = (sheet) => {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (!rows || rows.length === 0) return null;

  let parsedTitle = '';
  let parsedDescription = '';
  let parsedCategory = '';
  let headerRowIndex = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const key = String(row[0]).trim().toLowerCase();
    if (key === 'survey name' || key === 'title' || key === 'survey title') {
      parsedTitle = row[1] ? String(row[1]).trim() : '';
    } else if (key === 'survey description' || key === 'description') {
      parsedDescription = row[1] ? String(row[1]).trim() : '';
    } else if (key === 'category') {
      parsedCategory = row[1] ? String(row[1]).trim() : '';
    } else if (row.includes('Question Text') || row.includes('Question Text*') || row.some(cell => String(cell).includes('Question Text'))) {
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex === -1) {
    return null;
  }

  const headerRow = rows[headerRowIndex];
  const colMap = {};
  headerRow.forEach((cell, idx) => {
    if (!cell) return;
    const normalized = String(cell).trim().toLowerCase();
    // "parent question" is checked before the plain "question number" /
    // "question text" checks below, since "Parent Question Number" would
    // otherwise also match those (it contains both substrings) and clobber
    // the real Question Number / Question Text columns.
    if (normalized.includes("parent question")) colMap.parentQuestionNumber = idx;
    else if (normalized.includes("question number")) colMap.questionNumber = idx;
    else if (normalized.includes("row type")) colMap.rowType = idx;
    else if (normalized.includes("question text")) colMap.questionText = idx;
    else if (normalized.includes("question type") || normalized.includes("answer type")) colMap.questionType = idx;
    else if (normalized.includes("required")) colMap.required = idx;
    else if (normalized.includes("options")) colMap.options = idx;
    else if (normalized.includes("scores")) colMap.optionScores = idx;
    else if (normalized.includes("red flags")) colMap.optionRedFlags = idx;
    else if (normalized.includes("option jumps") || normalized.includes("next_question")) colMap.optionJumps = idx;
    else if (normalized.includes("scale")) colMap.scale = idx;
    else if (normalized.includes("score threshold")) colMap.scoreThreshold = idx;
    else if (normalized.includes("threshold jump")) colMap.thresholdJump = idx;
    else if (normalized.includes("rating max")) colMap.ratingMax = idx;
    else if (normalized.includes("low label")) colMap.lowLabel = idx;
    else if (normalized.includes("high label")) colMap.highLabel = idx;
    else if (normalized.includes("backward")) colMap.backwardRoute = idx;
  });

  if (colMap.questionText === undefined) {
    return null;
  }

  // Pass 1 — build the flat question/section array in sheet order, and
  // index every real question by its Question Number cell (and by a plain
  // 1-based ordinal, for backward compatibility with older template files
  // that never relied on Question Number for jumps).
  const parsedQuestions = [];
  const idByQuestionNumber = new Map();
  const idByOrdinal = new Map();
  let realOrdinal = 0;

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const qNumRaw = colMap.questionNumber !== undefined ? row[colMap.questionNumber] : undefined;
    const qNumKey = qNumRaw !== undefined && qNumRaw !== null && String(qNumRaw).trim() !== '' ? String(qNumRaw).trim() : null;

    const rowType = colMap.rowType !== undefined && row[colMap.rowType] ? String(row[colMap.rowType]).trim().toLowerCase() : 'question';

    if (rowType === 'section') {
      const sectionName = colMap.questionText !== undefined ? row[colMap.questionText] : '';
      if (!sectionName || String(sectionName).trim() === '') continue;
      parsedQuestions.push({
        id: `section-${Date.now()}-${Math.random()}`,
        _is_section: true,
        section_label: String(sectionName).trim(),
        question_text: '',
        question_type: '_section',
        required: false,
        options: [],
      });
      continue; // Section rows are never a valid jump/parent target.
    }

    const questionText = colMap.questionText !== undefined ? row[colMap.questionText] : null;
    if (!questionText || String(questionText).trim() === '') continue;

    let questionType = colMap.questionType !== undefined && row[colMap.questionType]
      ? String(row[colMap.questionType]).trim().toLowerCase()
      : 'text';

    if (questionType === 'short') {
      questionType = 'text';
    } else if (questionType === 'paragraph') {
      questionType = 'long_text';
    } else if (questionType === 'single choose' || questionType === 'radio') {
      questionType = 'radio';
    } else if (questionType === 'multi choose' || questionType === 'check box' || questionType === 'checkbox') {
      questionType = 'checkbox';
    } else if (questionType === 'score') {
      questionType = 'select';
    }

    const requiredStr = colMap.required !== undefined && row[colMap.required]
      ? String(row[colMap.required]).trim().toLowerCase()
      : 'yes';
    const required = requiredStr === 'yes' || requiredStr === 'y' || requiredStr === 'true' || requiredStr === '1';

    const optionsStr = colMap.options !== undefined && row[colMap.options] ? String(row[colMap.options]).trim() : '';
    const scoresStr = colMap.optionScores !== undefined && row[colMap.optionScores] ? String(row[colMap.optionScores]).trim() : '';
    const redFlagsStr = colMap.optionRedFlags !== undefined && row[colMap.optionRedFlags] ? String(row[colMap.optionRedFlags]).trim() : '';
    const jumpsStr = colMap.optionJumps !== undefined && row[colMap.optionJumps] ? String(row[colMap.optionJumps]).trim() : '';

    const optionsArray = optionsStr ? optionsStr.split(';').map(o => o.trim()) : [];
    const scoresArray = scoresStr ? scoresStr.split(';').map(s => parseInt(s.trim(), 10) || 0) : [];
    const redFlagsArray = redFlagsStr ? redFlagsStr.split(';').map(rf => {
      const s = rf.trim().toLowerCase();
      return s === 'yes' || s === 'y' || s === 'true' || s === '1';
    }) : [];
    const jumpsArray = jumpsStr ? jumpsStr.split(';').map(j => j.trim()) : [];

    const options = optionsArray.map((optText, oIdx) => ({
      option_text: optText,
      next_question: null,
      _rawJump: jumpsArray[oIdx] || '',
      score: scoresArray[oIdx] !== undefined ? scoresArray[oIdx] : 0,
      is_red_flag: redFlagsArray[oIdx] !== undefined ? redFlagsArray[oIdx] : false,
      media_url: ''
    }));

    const scale = colMap.scale !== undefined && row[colMap.scale] ? String(row[colMap.scale]).trim() : '';
    const scoreThresholdRaw = colMap.scoreThreshold !== undefined ? row[colMap.scoreThreshold] : undefined;
    const scoreThreshold = scoreThresholdRaw !== undefined && scoreThresholdRaw !== null && String(scoreThresholdRaw).trim() !== ''
      ? parseInt(scoreThresholdRaw, 10)
      : null;

    const ratingMax = colMap.ratingMax !== undefined && row[colMap.ratingMax] !== undefined && String(row[colMap.ratingMax]).trim() !== ''
      ? (parseInt(row[colMap.ratingMax], 10) || 5)
      : 5;
    const lowLabel = colMap.lowLabel !== undefined && row[colMap.lowLabel] ? String(row[colMap.lowLabel]).trim() : '';
    const highLabel = colMap.highLabel !== undefined && row[colMap.highLabel] ? String(row[colMap.highLabel]).trim() : '';

    const rawThresholdJump = colMap.thresholdJump !== undefined && row[colMap.thresholdJump] ? String(row[colMap.thresholdJump]).trim() : '';
    const rawBackwardRoute = colMap.backwardRoute !== undefined && row[colMap.backwardRoute] ? String(row[colMap.backwardRoute]).trim() : '';
    const rawParentQuestionNumber = colMap.parentQuestionNumber !== undefined && row[colMap.parentQuestionNumber] ? String(row[colMap.parentQuestionNumber]).trim() : '';

    parsedQuestions.push({
      id: `temp-${Date.now()}-${Math.random()}`,
      question_text: String(questionText).trim(),
      question_type: questionType,
      media_type: 'none',
      media_url: '',
      required,
      options,
      rating_max: ratingMax,
      low_label: lowLabel,
      high_label: highLabel,
      scale,
      score_threshold: isNaN(scoreThreshold) ? null : scoreThreshold,
      threshold_next_question: null,
      backward_question: null,
      tier: 1,
      parent_question_key: null,
      _rawThresholdJump: rawThresholdJump,
      _rawBackwardRoute: rawBackwardRoute,
      _rawParentQuestionNumber: rawParentQuestionNumber,
    });

    if (qNumKey) idByQuestionNumber.set(qNumKey, parsedQuestions.length - 1);
    realOrdinal += 1;
    idByOrdinal.set(realOrdinal, parsedQuestions.length - 1);
  }

  // Pass 2 — resolve every reference now that the whole sheet (and the
  // Question Number -> index map) is known. Parent rows are expected to
  // appear earlier in the sheet than their sub-section rows, so tiers
  // resolve correctly in a single forward pass.
  parsedQuestions.forEach((q, idx) => {
    if (q._is_section) return;

    q.options.forEach(opt => {
      opt.next_question = resolveRef(opt._rawJump, idByQuestionNumber, idByOrdinal);
      delete opt._rawJump;
    });

    q.threshold_next_question = resolveRef(q._rawThresholdJump, idByQuestionNumber, idByOrdinal);
    delete q._rawThresholdJump;

    q.backward_question = resolveRef(q._rawBackwardRoute, idByQuestionNumber, idByOrdinal);
    delete q._rawBackwardRoute;

    if (q._rawParentQuestionNumber && idByQuestionNumber.has(q._rawParentQuestionNumber)) {
      const parentIdx = idByQuestionNumber.get(q._rawParentQuestionNumber);
      const parentQ = parsedQuestions[parentIdx];
      if (parentQ && !parentQ._is_section && parentIdx !== idx) {
        q.tier = Math.min((Number(parentQ.tier) || 1) + 1, 5);
        q.parent_question_key = `q_${parentQ.id}`;
      }
    }
    delete q._rawParentQuestionNumber;
  });

  return {
    title: parsedTitle || 'Uploaded Survey',
    description: parsedDescription || '',
    category: parsedCategory || 'AI',
    questions: parsedQuestions
  };
};
