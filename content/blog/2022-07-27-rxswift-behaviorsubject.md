+++
title = "Why is it Called BehaviorSubject?"
date = 2022-07-27

[taxonomies]
tags = ["swift", "rxswift"]
+++

### Intro

I'm a fan of the ideas and concepts that reactive programming brings - it often makes code easier to reason about and eliminates certain categories of bugs. Lately I started reading about RxSwift, even though my main reactive framework is Combine.

I came across a `Subject` called `BehaviorSubject` - it's a subject that emits the last value it received to any new subscriber, and then continues to emit any future values.

### Why the name?

I found myself asking: where's the "behavior" in this? Why is the word "behavior" in the name at all? Especially since the equivalent in Combine has a much more self-explanatory name: `CurrentValueSubject`.

That name is obvious - it's a subject that holds and emits the current value. So why isn't the naming in RxSwift as clear? The answer I found:

> In the world of functional reactive programming, a behavior is a value that changes over time. This is exactly what a `BehaviorSubject` represents: when you subscribe you get the current value, and then you can continue to observe the changes.

So the word "behavior" in the reactive programming world means *a value being observed as it changes over time*.

A small thing I learned and wanted to share. I'll probably write more about RxSwift as I dig deeper into the differences between it and Combine.
