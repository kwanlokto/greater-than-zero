import type { Prompter, Question } from '@/prompter';

// A prompter for tests: answers each question from a script, in order, and
// records everything asked and told. A question past the end of the script is
// a mistake in the test, so it throws.
export function scriptedPrompter(answers: boolean[] = []) {
  const asked: Question[] = [];
  const told: { title: string; message: string }[] = [];
  const remaining = [...answers];
  const prompter: Prompter = {
    async ask(question) {
      asked.push(question);
      const answer = remaining.shift();
      if (answer === undefined) throw new Error(`No answer scripted for "${question.title}"`);
      return answer;
    },
    async tell(title, message) {
      told.push({ title, message });
    },
  };
  return { prompter, asked, told };
}
