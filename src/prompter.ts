// Asking the lifter something and telling them something: the seam between an
// app flow and how it's shown. On the phone it's Android's alert dialog
// (alert-prompter.ts); tests script the answers (scripted-prompter.ts).

export type Question = {
  title: string;
  // Under the title; none for a question that says it all.
  message?: string;
  // The button labels.
  decline: string;
  accept: string;
  // Shown as a warning, for accepting what can't be undone.
  destructive?: boolean;
};

export type Prompter = {
  // True when the lifter accepts. Dismissing it declines.
  ask(question: Question): Promise<boolean>;
  // Resolves once the lifter has dismissed it.
  tell(title: string, message: string): Promise<void>;
};

// What a refused command says, for telling the lifter.
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Runs a core command, telling the lifter why if it's refused. True if it ran.
export async function runOrTell(
  prompter: Prompter,
  failureTitle: string,
  command: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await command();
    return true;
  } catch (error) {
    // Not waited for: the screen carries on underneath it.
    void prompter.tell(failureTitle, messageOf(error));
    return false;
  }
}

// Asks first, then runs the command only if the lifter accepts, telling them
// why if it's refused. True only if it ran.
export async function confirmAndRun(
  prompter: Prompter,
  question: Question,
  failureTitle: string,
  command: () => Promise<unknown>,
): Promise<boolean> {
  if (!(await prompter.ask(question))) return false;
  return runOrTell(prompter, failureTitle, command);
}
