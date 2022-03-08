const { run } = require('./utils');

const Worktree = {
  async list() {
    // Example:
    //
    // /Users/you/Projects/something/dev                     0f9e65730 [dev]
    // /Users/you/Projects/something/chore/fix-things        0f673c38d [chore/fix-things]
    // /Users/you/Projects/something/feature/something-new   748fd25c7 [feature/something-new]
    const text = await run('git', ['worktree', 'list']);

    const worktrees = text
      .split('\n')
      .map((line) => {
        const [, path, commit, branch] =
          line.match(/^(.*?)\s+(\w+)\s+\[(.*)\]$/) || [];

        return { path, commit, branch, root: '', name: '' };
      })
      .filter(
        (worktree) => worktree.path && worktree.commit && worktree.branch
      );

    if (worktrees.length === 0) {
      return worktrees;
    }

    // Find the root branch of all branches
    const root = worktrees.reduce(
      /** @param {string} root */
      (root, worktree) => {
        for (let i = 0; i < root.length; i++) {
          if (worktree.path[i] !== root[i]) {
            return root.slice(0, i);
          }
        }

        return root;
      },
      worktrees[0].path
    );

    worktrees.forEach((worktree) => {
      worktree.root = root;
      worktree.name = worktree.path.slice(root.length);
    });

    return worktrees;
  },
};
module.exports.Worktree = Worktree;
