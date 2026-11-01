// Lever and Ashby don't publish a form's questions through a public API, so applications
// start from the fields their forms always have. Extra questions are read on the page at
// review time (review skill, S2.2).
import type { FormQuestion } from './questions.ts';

const text = (label: string, required = false): FormQuestion => ({
  label,
  required,
  type: 'text',
  options: [],
});

export const STANDARD_FORMS: Record<string, FormQuestion[]> = {
  lever: [
    text('Full name', true),
    text('Email', true),
    text('Phone'),
    text('Current company'),
    { label: 'Resume/CV', required: true, type: 'file', options: [] },
    text('LinkedIn URL'),
    text('GitHub URL'),
    text('Portfolio URL'),
  ],
  ashby: [
    text('Name', true),
    text('Email', true),
    text('Phone'),
    { label: 'Resume', required: true, type: 'file', options: [] },
    text('LinkedIn'),
    text('GitHub'),
    text('Website'),
  ],
};

export const EXTRA_QUESTIONS_NOTE =
  'This form may ask more questions than the standard ones. At review, Claude reads them on the page, answers from your profile and answer bank, and asks you the rest.';
