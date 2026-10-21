// A CV tailored to one job (S1.5, R5): which profile facts to show, in what order, and
// how each line is worded. Every line cites the profile entries it comes from, so the
// honesty check can prove nothing was added (D16, R5).
import { arrayOf, boolean, object, string, type Infer } from './core.ts';

const text = string({ minLength: 1 });
const cited = object({ text, cites: arrayOf(text) });

export const tailoredSchema = object({
  jobId: text,
  headline: text,
  summary: string(),
  experience: arrayOf(object({ roleId: text, bullets: arrayOf(cited) })),
  projects: arrayOf(object({ projectId: text, bullets: arrayOf(cited) })),
  skills: arrayOf(cited),
  educationIds: arrayOf(text),
  certificationIds: arrayOf(text),
  languages: boolean(),
});
export type Tailored = Infer<typeof tailoredSchema>;
