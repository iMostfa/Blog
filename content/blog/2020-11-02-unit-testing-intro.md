+++
title = "What is Unit Testing?"
date = 2020-11-02

[taxonomies]
tags = ["unit-testing"]
+++

# What is Unit Testing?

In this post we'll talk about what unit testing is as a general concept, with some simplified code examples.

If we had to define unit testing in one sentence, we could say: it's writing code that verifies the functions you wrote always work the way you intend, and always fulfill their purpose.

Why bother? There are many reasons, but here are a few:

- Sometimes we write code, come back to it after a long time not remembering what it does, modify it, and the app seems to work fine — but we didn't notice we broke something else.
1. Sometimes we have a bug, fix it by changing some old working code, and the bug gets fixed — but we didn't realize we broke something else in the process.
2. When a team is working together, one person might write working code, then a teammate edits it mid-task and doesn't realize they changed something fundamental.
3. You can catch bugs before your QA tester or the client does.
4. It reduces unnecessary code in your functions and encourages writing cleaner, better code — this is especially true with practices like TDD.

Now that we have a basic definition and some reasons to write unit tests, let's look at an example. And let's never forget our goal:

## The goal: any function we write should always work as we intend and always fulfill its purpose

What does that mean? Imagine we have this function:

```swift
func insertDot(to sentance: String) -> String {
    //if the last character in sentance is "." will return the sentance without any modification
    guard sentance.last != "." else { return sentance }

    //return the senance with a dot added at the end
    return sentance + "."

}
```

### This function's purpose is to add a period at the end of a sentence

How does it fulfill that purpose? Through two behaviors:
1. If the sentence already ends with a period, don't add another one.
2. If the sentence doesn't end with a period, add one.

What we want to do is protect those two behaviors — in other words, write code that verifies this function always achieves both goals. That code is called a "test", or more precisely a "unit test". We'll need to write 2 unit tests, one for each goal.

Here's the code we need to verify both goals — without worrying about where exactly this code lives in the project, just focusing on the concept:

---

The unit test for the first goal:

The goal of this test: when the function receives `"Mostfa."`, the output should be `"Mostfa."` — unchanged.

```swift
func test_NoDublicate_dots() { //1

        let output = insertDot(to: "Mostfa.") //2


           XCTAssertEqual(output, "Mostfa.", "No dot's should be added") //3

    }
```

In `//1`:

We name the function to describe what it's testing. The name here says we don't want duplicate dots in the output.

In `//2`:

We call the function we're testing and store the result in `output`.

Notice that the sentence we're passing already ends with a period — so the function should return it unchanged, without adding a second period.

In `//3`: We use `XCTAssertEqual`, a function from the testing framework, to declare our expectation. We're saying: `output` should equal `"Mostfa."` — that's our goal.

You can think of this function as doing this:

```swift
func test_NoDublicate_dots() {

        let output = insertDot(to: "Mostfa.")
        XCTAssertEqual(output, "Mostfa.", "No dots should be added")

        if output == "Mostfa." {
            //we are happy, no errors!
        } else {
            assertionFailure("stop here!, we are not happy, that's not supposed to happen")
        }
    }
```

When you run this test, you'll get a green checkmark ✅ because `insertDot` correctly doesn't add a period to a sentence that already ends with one.

Congrats, that's your first test!

Now imagine someone went and tampered with the original function like this:

```swift
func insertDot(to sentance: String) -> String {
    //if the last character in sentance is "." will return it with any modification
    guard sentance.last != " " else { return sentance }

    //return the senance with a dot added at the end
    return sentance + "."

}
```

When we run our test, we'll see a red X ❌

Why? Because the test found that the output was `"Mostfa.."` — not what we expected, and not what the function is supposed to do.

In practice, after every change we make to the project, we run the test functions. If everything is green, we're good. If something is red, we know we broke something and we go find out what.

---

Now let's write the second test — which is actually more intuitive:

Here we verify that if the sentence doesn't already end with a period, one gets added:

```swift
func test_dot_isAdded() {
        let output = insertDot(to: "Essam")
        XCTAssertEqual(output, "Essam.")
    }
```

Simple — we call the function with `"Essam"` and assert that the output is always `"Essam."`.

Now if someone goes and modifies the original function like this:

```swift
func insertDot(to sentance: String) -> String {
    //if the last character in sentance is "." will return it with any modification
    guard sentance.last != "." else { return sentance }

    //return the senance with a dot added at the end
    return sentance + "💕"

}
```

When we run the test, it fails — and that's expected. It tells us the output should be `"Essam."`, not `"Essam💕"`. So we go look at the function and figure out what changed, and fix it so the test passes again.

---

That's the end of today's post. We covered an introduction to testing with a very simple example that shows how to think about it and what to do to write a test.

There are things still missing — like where exactly the test code lives in a project, and how to test something more complex. We can cover all of that in a follow-up post, and eventually write tests for our API layer in a more advanced way.
