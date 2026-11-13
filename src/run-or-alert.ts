import { alertPrompter } from '@/alert-prompter';
import { confirmAndRun, runOrTell, type Question } from '@/prompter';

// Runs a core command, telling the lifter why if it's refused. True if it ran.
export function runOrAlert(
  failureTitle: string,
  command: () => Promise<unknown>,
): Promise<boolean> {
  return runOrTell(alertPrompter, failureTitle, command);
}

// Asks the lifter first, then runs the command if they accept, telling them why
// if it's refused. True only if it ran.
export function confirmThenRun(
  question: Question,
  failureTitle: string,
  command: () => Promise<unknown>,
): Promise<boolean> {
  return confirmAndRun(alertPrompter, question, failureTitle, command);
}
