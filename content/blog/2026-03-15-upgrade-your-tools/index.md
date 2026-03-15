+++
title = "Stop Using Tools That Are Just Good Enough"
date = 2026-03-15

[taxonomies]
tags = []
+++

Every day you spend using a tool that's merely "good enough" is time you're paying a tax you don't have to pay — slower edits, unnecessary friction, workflows that almost fit but never quite do. The cost is invisible because you never see the version of you that switched earlier.

Here I will share two tools that have impacted my workflow and made it more efficient, and I think you should give them a try.

## Vim Motions

I spend most of my day in text — writing code, editing prompts, drafting messages. Even with the rise of LLMs and agentic tooling, you're still the one navigating and shaping the words. When I started using vim motions, I stopped thinking about *how* to move and started thinking about *what* to say.

### Why Vim Motions?

Most text operations are repetitive and can be described in two words: delete word, change inside quotes, select around argument. Without vim motions, you reach for the mouse or arrow keys — it works, but it's slow and pulls your hands out of rhythm.

The key insight is that motions *compose*. You learn a handful of verbs (`d`, `c`, `y`) and a handful of nouns (`w`, `b`, `i`, `aa`), and suddenly you have a vocabulary for almost any edit. The combinations multiply your ability without multiplying what you have to memorize.

You don't need to switch to Neovim. Just enable vim mode in your current editor — VS Code, JetBrains, or even Claude's prompt input supports it.

1. To delete a word, you press `dw`
2. To select an argument of a function call, you press `vaa` (visual around argument) — then press `d` to delete it


<script src="https://asciinema.org/a/Ge366jSGE4jhndLK.js" id="asciicast-Ge366jSGE4jhndLK" async="true"></script>

This is a short clip where i'm trying to show you how fast and fluid it is to edit text with vim motions. (note: the contextual visual selecting is
powered by a plugin in Neovim, and i can't live without it)



It takes time to get used to, but once you do, you won't want to go back. And if you've ever played a game where movement is muscle memory, you already know how this feels — it's the same rewiring, just for text instead of a character. Getting comfortable with vim motions is honestly easier than adopting the next tool I'm going to talk about — and that one will challenge everything you thought you knew about version control.



## Jujutsu (JJ)

`Jujutsu` is a version control system that's `git` compatible, but it's way better than `git`. Before you say "but I already know git, why should I learn a new tool? git works" — I want you to believe me. I used to be what they call a git wizard; things like `rerere`, `git reflog`, `merge drivers` were part of my workflow every day.


### Why Jujutsu?

Git has become the English language of version control, and it's a great tool, but it's not perfect. Here I will list some of the problems with the design of git itself. None of these problems are a dealbreaker, but they are small things that add up to make your workflow less efficient and more cognitively overloaded.


1. In Git you create a commit after you finish working, not before you start working on it

Did it happen to you that you start working on something, and once you finish you find that you ended up with many files that you have to break down into smaller commits?

This problem usually happens because in git you don't have a way to describe what you will work on beforehand. In many cases you already know what you are going to work on before you start.

In Jujutsu, you start your upcoming work by doing `jj new -m "Description of the work"` — this creates a new empty change (think: an empty box that you start adding changes to).

Once you finish, you can start working on something else with `jj new`.

Notice:
- You didn't need to stage your files — they are staged by default
- It's mentally easier to break down your work since you can already see the description of what you are doing
- You can always do `jj describe -m` if you find that you are going to do more things, or `jj split` to split your changes into smaller ones

<script src="https://asciinema.org/a/Ge366jSGE4jhndLK.js" id="asciicast-Ge366jSGE4jhndLK" async="true"></script>

2. You don't need a branch name until you need to push your work upstream (GitHub PR)

How many times have you created a branch name just to start working on something, only to realize that you don't need to push it upstream?
Branch names are only useful when you want to push upstream (share work in general).

JJ is branchless by default. You can set a name for a commit (change) only if you need to (mostly to push to GitHub); otherwise, you can use the change ID (think: commit SHA) to switch between changes.

3. You don't really need the staging area

The issue with the staging area is that it creates two states for any file. If most of the time you do `git add .`, then staging is just an extra step that's mostly useless.

In JJ there's no staging area — everything is staged by default, and you have the following tools instead.

4. Conflicts shouldn't be blocking for your workflow

In Git, conflicts are a blocking state — you can't do anything until you resolve the conflict, which isn't usually what you want. Maybe you want to do other things first, then resolve conflicts.

In JJ it informs you that there's a conflict, and you can decide to solve it now or ignore it.
This is why in Jujutsu, rebases are effortless — I just solve them after the rebase process is over.


These four problems are just the ones worth naming — there are more. The point isn't that git is bad; it's that you've been absorbing its rough edges for so long you've stopped noticing them. I've been using Jujutsu for a while now and I can't imagine going back. Give it a try.
