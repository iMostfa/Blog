+++
title = "Managing Combine Subscriptions"
date = 2022-07-28

[taxonomies]
tags = ["swift", "combine"]
+++

When you use Combine inside a `ViewController` or `ViewModel`, you're responsible for managing and retaining your subscriptions (a.k.a. disposals).

Take this example of a publisher updating the UI:

```swift
class ViewController: UIViewController {

var disposeBag: Set<AnyCancellable> = []

func viewDidLoad(_ animated: Bool) {
  super.viewDidLoad(animated)

  publisher.sink { newValue in
    self.updateUI(with: newValue)
  }.store(in: &disposeBag)
}
```

What's happening here: when we subscribe, we store the `AnyCancellable` in a `Set` that acts as our dispose bag.

Why? Because if you don't hold a reference to the `AnyCancellable` in an Array, variable, or Set - ARC will immediately deallocate it. In Combine, you must keep the subscription alive to keep receiving values.

Think of it as having to hold onto the wire connecting you to the publisher sending data.

Now - say you've received what you needed, and the user is about to leave this screen. How do you cancel the subscription and stop receiving values? Does it happen automatically? What if you leave the `AnyCancellable` stored and never remove it?

### Option 1: Cancel on disappear

```swift
class ViewController: UIViewController {

  deinit {
    print("i'm leaving the memory")
  }

  var disposeBag: Set<AnyCancellable> = []

  func viewDidDisappear(_ animated: Bool) {
    super.viewDidDisappear(animated)
    disposeBag.removeAll()
  }

  func viewDidLoad(_ animated: Bool) {
    super.viewDidLoad(animated)

    publisher.sink { newValue in
      self.updateUI(with: newValue)
    }.store(in: &disposeBag)
  }
}
```

When the view controller disappears (which usually means the user is done with it, though not always), you empty the dispose bag. All stored subscriptions get cancelled, and the view controller can be freed from memory.

You can confirm this by checking that `deinit` gets called when you close the screen.

The downside: this puts the burden on you to call `removeAll()` in every `viewDidDisappear`. And sometimes you don't actually want to cancel subscriptions when the view disappears.

### Option 2: Let ARC handle it

```swift
class ViewController: UIViewController {

  deinit {
    print("i'm leaving the memory")
  }

  var disposeBag: Set<AnyCancellable> = []

  func viewDidLoad(_ animated: Bool) {
    super.viewDidLoad(animated)

    publisher.sink { [weak self] newValue in
      self?.updateUI(with: newValue)
    }.store(in: &disposeBag)
  }
}
```

This actually solves two problems at once. The `sink` closure captures `self` strongly by default - which can cause a memory leak if you never empty the dispose bag. But when you capture `self` weakly, ARC can release the view controller, which releases the `disposeBag` with it, which cancels all the subscriptions.

So the best approach when you're inside a `ViewController` or `ViewModel`: **don't strongly capture `self` in closures**. Actually, as a general rule, avoid strong captures in closures altogether 😂

This applies to any reactive framework - RxSwift, ReactiveSwift, you name it.

This post is an expanded version of [my answer on Stack Overflow](https://stackoverflow.com/a/62964220/5253913) on the same question.
