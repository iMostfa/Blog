+++
title = "Why You Should Upgrade the Tools You Are Used to Use"
date = 2026-03-15

[taxonomies]
tags = []
+++

We tend to spend a very long time using the same tools on computers, and we get used too used to them. Because they just work well enough.
And I think we should always question if there's a better tools to the work but in more efficient way and reduce cognitive overload.


Here I will share three tools that have impacted my workflow and made it more efficient, and I think you should give them a try.

## Jujutsu (JJ)

`Jujtsu` is a version control system that's a `git` compatible, but it's way better than `git`, and before you say "but I already know git, why should I learn a new tool? git works" I want you to believe me, I used to be what they call git wizard, things like `rerere`, `git reflog`, `merge drivers` were part of my workflow every day.



### Problem with Git
git has become the English language of version control, and it's a great tool, but it's not perfect. Here I will list some of the problems with the design of git itself

1. You don't need a branch name until you need to push your work to upstream (GitHub PR)

How many times you have created a branch name just to start working on something, and then you realize that you don't need to push it to upstream?
Actually branch names are only useful when you want to push to upstream (share work in general) 

JJ is branchless by default, you can set a name for commit(change) If you only need to (mostly to push to GitHub) otherwise, you can use change Id (think: commit SHA) to switch between changes.


2. Large commits created easily

Did it happen to you that you start working om something, and once you finish you find that you ended up with many files that you have to break down into smaller commits? 

This problem usually happens because in git you don't have a way to describe what you will  work on before hand.



3. You don't really need the staging area

The issue with staging area that it creates a two state for any file, If most of the time you do `git add .` then stage is just an extra step that mostly useless

In JJ there's no staging area, everything is by default staged, and you have the following tools.

4. Conflicts shouldn't be blocking for your workflow

