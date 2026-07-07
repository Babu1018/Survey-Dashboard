export const INDIC_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' }
];

export async function translateText(text, targetLang) {
  if (!text || !text.trim() || typeof text !== 'string') return text || '';
  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );
    if (!response.ok) throw new Error('Translation failed');
    const data = await response.json();
    if (data && data[0]) {
      return data[0].map(segment => segment[0]).join('');
    }
    return text;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
}

export async function translateSurvey(survey, targetLang) {
  // Translate title and description
  const translatedTitle = await translateText(survey.title, targetLang);
  const translatedDescription = await translateText(survey.description, targetLang);

  // Translate all questions and their choices
  const translatedQuestions = await Promise.all(
    survey.questions.map(async (q) => {
      const question_text = await translateText(q.question_text, targetLang);
      const low_label = q.low_label ? await translateText(q.low_label, targetLang) : '';
      const high_label = q.high_label ? await translateText(q.high_label, targetLang) : '';

      const options = await Promise.all(
        (q.options || []).map(async (opt) => {
          const option_text = await translateText(opt.option_text, targetLang);
          return {
            ...opt,
            option_text
          };
        })
      );

      return {
        ...q,
        question_text,
        low_label,
        high_label,
        options
      };
    })
  );

  return {
    title: translatedTitle,
    description: translatedDescription,
    questions: translatedQuestions
  };
}
