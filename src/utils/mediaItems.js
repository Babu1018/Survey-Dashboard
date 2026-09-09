// Question/choice-option media attachments are stored as a JSON array on
// `media_items`: [{ url, type }] where type is 'image' | 'audio'. Rows saved
// before this column existed instead carry one media_url/media_type pair
// directly on the question/option — parseMediaItems folds that legacy shape
// into the same array so every caller only has to deal with one format.
export function parseMediaItems(obj) {
  if (!obj) return [];
  if (obj.media_items) {
    try {
      const parsed = JSON.parse(obj.media_items);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      // fall through to the legacy single-field shape below
    }
  }
  if (obj.media_url && obj.media_type && obj.media_type !== 'none') {
    return [{ url: obj.media_url, type: obj.media_type }];
  }
  return [];
}

export function stringifyMediaItems(items) {
  return items && items.length ? JSON.stringify(items) : null;
}
