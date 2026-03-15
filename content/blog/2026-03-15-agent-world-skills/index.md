+++
title = "Thoughts on Agentic tooling and future of engineering"
date = 2026-03-15

[taxonomies]
tags = ["ai", "agents", "software-engineering", "career"]
+++

![](cover.png)

With the current rise of agentic coding tools, many (and I'm included) are starting to wonder, what skills will actually matter for engineers in the future? If agents can write code, tests, and even design systems, what does that leave for us? My take on this varies depending on the topic. Here I'm trying to break down my thoughts.

### How Did You Become Highly Skilled?
No matter how you started programming, likely the process of learning is the same:

1. You start by learning the syntax (the building blocks)
2. You make small projects, and you learn how to use the building blocks to create something useful.
3. You try to create more complex projects, make mistakes, and learn from them over time. -Repeat-
4. You start to develop deep understanding of how the tools work, and study/understand the details. -Repeat-
5. Your scope gets wider, and you start to build wider/more complex systems, and you learn how to design systems -Repeat-

And eventually you become a skilled engineer, and start to move from thinking about code to thinking about systems, and how to design them, and how to make them work together.

What truly makes you skilled is the cycle of learning, making mistakes, and growing from them.

We (engineers) used to say that "Programming isn't all about writing code, it's more than this" which is true, and false at the same time.

When you are building an MVP, it's actually more about writing code, and less about design, because you are trying to quickly validate an idea, and you don't care about the design at this stage. As you start to grow the project, you notice that you are writing less code and thinking more about design, and how to make the system work together, and how to make it scalable, maintainable, and so on.


### Most Projects Are Simpler Than You Think

#### Repetitive Knowledge and Tools
The reality is that many projects don't require extensive knowledge or deep expertise. Often, they involve repeating the same basic concepts and tools you are already familiar with.

To elaborate, think about the last project you worked on. How many times did you find yourself using the same libraries, frameworks, and design patterns? The truth is that many projects are built on top of existing tools and technologies, and they don't require deep expertise to be successful.

Because of this, agentic tools can handle these projects easily.

LLMs are trained on these problems 100x more than any human, so they're likely faster and better at solving them.

#### Just Fix It

As projects grow, you start hitting harder problems - scaling, performance, or features that keep breaking each other. These are the problems where real expertise starts to matter.

LLMs are good at solving these problems, but they're not great at weighing trade-offs or thinking about cost and efficiency. For any problem, there are multiple solutions. Agents tend to pick one that works - often ignoring cost, efficiency, or long-term impact.

If you're dealing with a simple project (like a CRUD app), this might not be a concern. You could easily rely on tools like Claude, OpenCode, or Codex to solve these issues. However, what is often overlooked in this approach is the efficiency (time) and cost at which the solution is produced. How confident you are in that solution.

Some projects never need to worry about this - they work fine without any optimization. But as a project grows, these trade-offs start to matter more. Bigger systems need more careful decisions to stay healthy over time.


#### What Still Needs to Be Yours

##### Rejection Meter
Knowing when to reject an agent's suggestion is what ultimately matters. To say no, you must have a clear understanding of the issue you are solving. It is easy to fall into the trap of relying on agents entirely, but this approach only works up to a certain point.


> Example 1: Writing tests is more enjoyable than ever, but I once found a generated test case that used reflection to access private fields. While the test passed, it was brittle and coupled to implementation details - a clear case where saying `no` and asking for a better approach was the right call.

##### The Fundamentals
Understanding how computer systems work still matters. Keep in mind that agents are good at coding because of their ability to detect patterns and replicate them very well. They mimic thinking by replaying patterns from their training data. But they don't actually understand how computer systems work.


Example 2:
> While analyzing a performance issue in a project, the agentic tools said that based on the profiling information there's a bottleneck in one function, and it's caused by a very big switch case statement. A big switch case is O(N) time complexity, and it is not efficient. So the agentic tool suggested to refactor the code to use a hash map instead of a switch case, which is O(1) time complexity, and it will improve the performance of the function.

While the function was indeed a bottleneck according to the profiler, what caught my attention was that a switch case isn't O(N), instead in modern languages, it's implemented as a jump table, which is O(1) time complexity. (think of a HashMap /dictionary)

I've seen many mistakes like this. The lesson: you need to understand the technology to solve problems efficiently. If I hadn't caught this, I would have refactored the code and released it - only to find it didn't help. Or worse, the agent would have kept trying different theories that were also wrong.



##### Stackoverflow Era vs Agentic coding era
Back in the old days (that I hope you still remember), many devs relied heavily on StackOverflow to solve their coding problems. They would search for solutions, copy and paste code snippets, and call it a day, and depending on what you work on, maybe you can live with this forever.

And I don't see any difference between this and relying on agentic coding tools, it's just way easier, and way cheaper (compared to the output you get) to get things working, and issues fixed.

##### [-10...10] Multiplier

The output you get from coding agents depends heavily on your own expertise. The multiplier isn't always positive - if you blindly accept bad suggestions, it can go negative. If you are skilled at the problem you are solving, you will get 10x results; if not, expect 10x worse results - and the gap compounds over time.


### So are agents going to replace us?
Agents have already replaced a lot of the repetitive parts of software development, and they'll keep doing so. But they won't replace the parts of the work that require deep expertise, real systems thinking, and careful design decisions.

Many will disagree - some already feel that agents have replaced the need for developers entirely. This is simply because they're working on projects that LLMs already solve easily, and they haven't yet hit the point where trade-offs or design decisions require deep understanding. Efficiency isn't a concern for them either, because whatever they're facing, it's still cheaper to solve with agents than with humans.

### What should i focus on learning?
1. Understanding the details of what you are working on.
2. Understadning the trade-offs and implications of different solutions.
3. Understanding how to use the new tools effectively, and how to evaluate their output critically.
4. Find and invest into making the validation of soltions faster and easier, if creating solutions is easier, validating them should be easier too. This is where the real bottleneck is, and where the real value is.
5. Widen your scope, and learn how to design systems how to be a product owner, and how to make sure the system is healthy over time, and how to make sure it can grow and scale as needed.

