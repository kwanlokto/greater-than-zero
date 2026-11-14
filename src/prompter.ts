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

// What running a command came to: what it returned, or undefined when it
// didn't run. Truthy whenever it ran, even for a command that returns nothing,
// so `if (await runOrTell(…))` asks whether it ran.
export type Ran<T> = { result: T } | undefined;

// Runs a core command, telling the lifter why if it's refused. Every command a
// screen or flow runs goes through here or confirmAndRun, so a refusal always
// reaches the lifter.
export async function runOrTell<T>(
  prompter: Prompter,
  failureTitle: string,
  command: () => Promise<T>,
): Promise<Ran<T>> {
  try {
    return { result: await command() };
  } catch (error) {
    // Not waited for: the screen carries on underneath it.
    void prompter.tell(failureTitle, messageOf(error));
    return undefined;
  }
}

// Asks first, then runs the command only if the lifter accepts, telling them
// why if it's refused. Undefined when they decline, as when it's refused.
export async function confirmAndRun<T>(
  prompter: Prompter,
  question: Question,
  failureTitle: string,
  command: () => Promise<T>,
): Promise<Ran<T>> {
  if (!(await prompter.ask(question))) return undefined;
  return runOrTell(prompter, failureTitle, command);
}
