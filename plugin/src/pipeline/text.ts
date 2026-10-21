// Title and company clean-up. Display text stays readable; `companyKey` is the
// comparison form used for dedup (T6) and the skip-companies list.

const TITLE_NOISE = [
  /\b(?:urgent(?:ly)?|immediate(?:ly)?|now)\s+(?:hiring|required|needed)\b:?/gi,
  /^\s*(?:hiring|we(?:'re| are) hiring|job opening|vacancy)\s*[:\-–]\s*/gi,
  /\s*[([](?:remote|hybrid|on-?site|full[-\s]?time|part[-\s]?time|contract|wfh)[)\]]/gi,
  /\s*[-–|]\s*(?:remote|hybrid|on-?site)\s*$/gi,
  /\s*\((?:m\/f\/d|f\/m\/d|m\/w\/d|all genders)\)/gi,
  /\s*#?\b(?:job\s*)?(?:id|ref|req)[\s:#-]*[a-z]*\d+[\w-]*/gi,
];

// Emoji and pictographs ("🚀 Senior Engineer").
const EMOJI = /[\p{Extended_Pictographic}️‍]/gu;

export function cleanTitle(title: string): string {
  let cleaned = title.replace(EMOJI, ' ');
  for (const pattern of TITLE_NOISE) cleaned = cleaned.replace(pattern, ' ');
  return tidy(cleaned).replace(/^[-–|:,\s]+|[-–|:,\s]+$/g, '');
}

const COMPANY_SUFFIX =
  /[\s,]*\b(?:\(?(?:pvt|private)\.?\)?\s*(?:ltd|limited)\.?|(?:smc[-\s]?)?(?:pvt|private)\.?|smc|limited|ltd\.?|llc|l\.l\.c\.|inc\.?|incorporated|corp\.?|corporation|co\.|gmbh|plc|fz[-\s]?llc|fze|s\.?a\.?|b\.?v\.?)\s*$/i;

export function cleanCompany(company: string): string {
  return tidy(company.replace(EMOJI, ' '));
}

// "Systems Ltd." / "SYSTEMS LIMITED" / "Systems (Pvt.) Ltd" → "systems"
export function companyKey(company: string): string {
  let key = cleanCompany(company).toLowerCase();
  for (let i = 0; i < 3 && COMPANY_SUFFIX.test(key); i++) {
    key = key.replace(COMPANY_SUFFIX, '').replace(/[\s,.-]+$/, '');
  }
  return key
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
