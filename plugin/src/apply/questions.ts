// The questions a Greenhouse application form asks, from the public job-board API
// (`?questions=true`), so applications can be prepared without opening a browser.
import type { HttpClient } from '../connectors/http.ts';

type FieldType = 'text' | 'textarea' | 'file' | 'select' | 'multi-select';

export interface FormQuestion {
  label: string;
  required: boolean;
  type: FieldType;
  options: string[];
  // A short note from the employer (e.g. why a question is asked), if any.
  description?: string;
}

interface RawField {
  type: string;
  values?: { label: string }[];
}
interface RawQuestion {
  label: string;
  required: boolean;
  description?: string | null;
  fields: RawField[];
}

const TYPES: Record<string, FieldType> = {
  input_text: 'text',
  textarea: 'textarea',
  input_file: 'file',
  multi_value_single_select: 'select',
  multi_value_multi_select: 'multi-select',
};

export async function greenhouseQuestions(
  http: HttpClient,
  board: string,
  jobId: string,
): Promise<FormQuestion[] | undefined> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(jobId)}?questions=true`;
  const response = await http.get(url);
  if (response.status !== 'ok') return undefined;
  try {
    return parseQuestions(
      JSON.parse(response.text) as {
        questions?: RawQuestion[];
        location_questions?: RawQuestion[];
      },
    );
  } catch {
    return undefined;
  }
}

export function parseQuestions(data: {
  questions?: RawQuestion[];
  location_questions?: RawQuestion[];
}): FormQuestion[] {
  return [...(data.questions ?? []), ...(data.location_questions ?? [])].map((q) => {
    // A resume asks for a file *or* pasted text: the file is what's used.
    const field = q.fields.find((f) => f.type === 'input_file') ?? q.fields[0];
    const question: FormQuestion = {
      label: q.label.trim(),
      required: q.required,
      type: TYPES[field?.type ?? ''] ?? 'text',
      options: (field?.values ?? []).map((v) => v.label),
    };
    if (q.description) question.description = q.description;
    return question;
  });
}
