#!/usr/bin/env node
const { Worktree } = require('./git');
const { run } = require('./utils');
const inquirer = require('inquirer');
const { menu } = require('./cli');
const path = require('path');
const fs = require('fs');

async function main() {
  // Get a list of worktrees
  let worktrees = await Worktree.list();

  /**
   * @param {typeof worktrees[0]} worktree
   */
  const editWorktree = (worktree) => {
    let shouldQuit = false;

    return new Promise(async (resolve, reject) => {
      try {
        await menu(`Edit worktree: ${worktree.name}`, [
          [
            'Launch VS Code',
            async () => {
              await run('code', [worktree.path]);
              process.exit();
            },
          ],
          [
            'Copy ignored files',
            async () => {
              try {
                // For each worktree, get a list of ignored files
                const ignored = (
                  await Promise.all(
                    worktrees.map(async (worktree) =>
                      run(
                        'git',
                        [
                          '--no-pager',
                          'ls-files',
                          '--others',
                          '--ignored',
                          '--exclude-standard',
                          '--directory',
                          '--no-empty-directory',
                        ],
                        { cwd: worktree.path }
                      )
                    )
                  )
                )
                  .reduce((acc, files) => acc.concat(files.split('\n')), [])
                  // deduplicate
                  .filter((file, index, self) => self.indexOf(file) === index)
                  // Remove certain files
                  .filter(
                    (file) =>
                      file &&
                      !file.match(
                        /(^|\/)(\.git|\.DS_Store|\.gitattributes|\.gitignore|build|\.fusebox|node_modules|logs)\/?$/
                      )
                  )
                  // For each of the ignored files, find the newest one
                  .map((file) => {
                    // Get the newest file
                    const sourceWorktree = worktrees.reduce((worktree, w) => {
                      const filePath = path.join(w.path, file);

                      // If the file does not exist, return the current worktree
                      if (!fs.existsSync(filePath)) {
                        return worktree;
                      }

                      const fileStat = fs.statSync(filePath);
                      const worktreeStat = fs.statSync(worktree.path);

                      return fileStat.mtime > worktreeStat.mtime ? w : worktree;
                    }, worktrees[0]);

                    return {
                      file,
                      worktree: sourceWorktree,
                      selected: sourceWorktree !== worktree,
                    };
                  });

                const { selection } = await inquirer.prompt({
                  type: 'checkbox',
                  name: 'selection',
                  message: 'Choose files to copy',
                  choices: ignored.map((ignore) => ({
                    name: `${ignore.file} (${ignore.worktree.name})`,
                    value: ignore.file,
                    checked: ignore.selected,
                  })),
                });

                const selectedItems = ignored.filter((ignore) =>
                  selection.includes(ignore.file)
                );

                console.log(
                  `Copying ${selectedItems.length} files to ${worktree.name}`
                );

                selectedItems.forEach(async (ignore) => {
                  const source = path.join(ignore.worktree.path, ignore.file);

                  if (!fs.existsSync(source)) {
                    console.log(`File ${source} does not exist`);
                    return;
                  }

                  const destination = path.join(worktree.path, ignore.file);

                  await run('cp', ['-pr', source, destination]);
                });
              } catch (error) {
                console.error(error);
              }
            },
          ],
          [
            'Delete worktree',
            async () => {
              // Get a list of all modified files in the worktree
              const modifiedFiles = (
                await run('git', [
                  '-C',
                  worktree.path,
                  'ls-files',
                  '-mo',
                  '--exclude-standard',
                ])
              )
                .trim()
                .split('\n')
                .filter((file) => !!file.trim());

              // Confirm
              const { confirm } = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'confirm',
                  message: modifiedFiles.length
                    ? [
                        'The following files would be deleted:',
                        ...modifiedFiles.map((file) => `- ${file}`),
                        `Are you sure you want to delete ${worktree.name}?`,
                      ].join('\n')
                    : `Are you sure you want to delete ${worktree.name}?`,
                },
              ]);
              if (!confirm) return resolve();
              await run('git', [
                'worktree',
                'remove',
                '--force',
                worktree.path,
              ]);
              // Need to go back to the main menu, because this worktree is gone
              shouldQuit = true;
            },
          ],
          [
            'Back',
            () => {
              shouldQuit = true;
            },
          ],
        ]);
        worktrees = await Worktree.list();

        if (!shouldQuit) {
          resolve(editWorktree(worktree));
        } else {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  };

  const newWorktree = () =>
    new Promise(async (resolve, reject) => {
      const { name } = await inquirer.prompt({
        type: 'input',
        message: 'Name of the new worktree:',
        name: 'name',
      });

      try {
        let rootPath = worktrees[0]?.root || resolve(process.cwd(), '..');
        const newPath = path.resolve(rootPath, name);
        // Create the branch if it doesn't exist
        await run('git', ['branch', name]).catch(() => {});
        await run('git', ['worktree', 'add', newPath, name]);
        // Update worktrees
        worktrees = await Worktree.list();
        resolve(
          editWorktree(worktrees.find((worktree) => worktree.name === name))
        );
      } catch (error) {
        reject(error);
      }
    });

  const worktreeMenu = () =>
    new Promise(async (resolve, reject) => {
      try {
        let shouldQuit = false;

        await menu(
          'Worktrees',
          worktrees
            .map((worktree) => [
              worktree.name,
              () => {
                return editWorktree(worktree);
              },
            ])
            .concat([
              [new inquirer.Separator()],
              ['Create new worktree', () => newWorktree()],
              [
                'Quit',
                () => {
                  shouldQuit = true;
                },
              ],
            ])
        );

        if (!shouldQuit) {
          resolve(worktreeMenu());
        }
      } catch (error) {
        reject(error);
      }
    });

  await worktreeMenu();
}

main().catch(console.error);
