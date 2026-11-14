import { alertPrompter } from '@/alert-prompter';
import { confirmAndRun, runOrTell, type Question, type Ran } from '@/prompter';

// Runs a core command, telling the lifter why if it's refused. See runOrTell
// for what it hands back.
export function runOrAlert<T>(failureTitle: string, command: () => Promise<T>): Promise<Ran<T>> {
  return runOrTell(alertPrompter, failureTitle, command);
}

// Asks the lifter first, then runs the command if they accept, telling them why
// if it's refused. See confirmAndRun for what it hands back.
export function confirmThenRun<T>(
  question: Question,
  failureTitle: string,
  command: () => Promise<T>,
): Promise<Ran<T>> {
  return confirmAndRun(alertPrompter, question, failureTitle, command);
}
