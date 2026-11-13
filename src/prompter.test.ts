import { confirmAndRun, runOrTell } from './prompter';
import { scriptedPrompter } from './scripted-prompter';

const deletePush = {
  title: 'Delete Push?',
  decline: 'Cancel',
  accept: 'Delete',
  destructive: true,
};

function refused(message: string) {
  return async () => {
    throw new Error(message);
  };
}

describe('Running a command', () => {
  it('runs it and tells the lifter nothing when it works', async () => {
    const { prompter, told } = scriptedPrompter();
    const command = jest.fn(async () => {});

    expect(await runOrTell(prompter, "Couldn't delete the template", command)).toBe(true);
    expect(command).toHaveBeenCalledTimes(1);
    expect(told).toEqual([]);
  });

  it("tells the lifter why when it's refused", async () => {
    const { prompter, told } = scriptedPrompter();

    expect(
      await runOrTell(prompter, "Couldn't delete the template", refused('No such Template')),
    ).toBe(false);
    expect(told).toEqual([{ title: "Couldn't delete the template", message: 'No such Template' }]);
  });
});

describe('Confirming a command', () => {
  it('runs nothing when the lifter declines', async () => {
    const { prompter, asked } = scriptedPrompter([false]);
    const command = jest.fn(async () => {});

    expect(await confirmAndRun(prompter, deletePush, "Couldn't delete the template", command)).toBe(
      false,
    );
    expect(asked).toEqual([deletePush]);
    expect(command).not.toHaveBeenCalled();
  });

  it('runs it once the lifter accepts', async () => {
    const { prompter } = scriptedPrompter([true]);
    const command = jest.fn(async () => {});

    expect(await confirmAndRun(prompter, deletePush, "Couldn't delete the template", command)).toBe(
      true,
    );
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('tells the lifter why an accepted command was refused', async () => {
    const { prompter, told } = scriptedPrompter([true]);

    expect(
      await confirmAndRun(
        prompter,
        deletePush,
        "Couldn't delete the template",
        refused('No such Template'),
      ),
    ).toBe(false);
    expect(told).toEqual([{ title: "Couldn't delete the template", message: 'No such Template' }]);
  });
});
