+++
title = "How to Know the Size of Your Types in Swift"
date = 2020-11-07

[taxonomies]
tags = ["swift", "memory"]
+++

# How to Know the Size of Your Types in Swift

In Swift, any object or type has 3 properties that describe how memory interacts with it. In this post we'll look at two of them — `size` and `alignment`.

## Size 📦

---

Say you have two `struct`s in your program like these:

```swift
struct Student {
    let age: Int
}

struct Professor {
    let age: Int
    let phoneNumber: Int
}

let mostfa = Student(age: 10)
let ahmed = Professor(age: 10, phoneNumber: 010)
```

If I asked you which object is larger — `mostfa` or `ahmed` — logic says `ahmed`, because it's made of two variables: `age` and `phoneNumber`.

But how do we confirm that with actual numbers? We use `MemoryLayout`.

## 💻 Memory Layout

---

Swift has a type called `MemoryLayout` that lets us check the sizes of our types — like `Student`, `Professor`, or any built-in type like `String` or `Bool`:

```swift
let studentSize = MemoryLayout<Student>.size
let professorSize = MemoryLayout<Professor>.size

print(studentSize) // prints 8
print(professorSize) //prints 16 😉
```

As expected, `Professor` takes up more memory.

If we want to check specific instances like `mostfa` and `ahmed`:

```swift
let mostfaSize = MemoryLayout.size(ofValue: mostfa)
let ahmedSize = MemoryLayout.size(ofValue: ahmed)

print(mostfaSize) //prints 8
print(ahmedSize) //also prints 16
```

But why 8? And why 16? Let's dig into size a bit more.

## Back to Size 📦

---

In Swift, calculating the size of a struct is straightforward — **the size of a struct equals the sum of the sizes of its properties**. So:

```swift
struct Student {
     let age: Int
    let inSchool: Bool
}

 let intSize = MemoryLayout<Int>.size    //prints out 8
 let boolSize = MemoryLayout<Bool>.size  //prints out 1

let studentSize = MemoryLayout<Student>.size //prints out 9 ( 1 + 8 )
```

The struct has one `Int` and one `Bool`, so its size is 8 + 1 = 9. Easy, right? 🦹🏻‍♂️

Now let's verify with another example:

```swift
struct OtherStudent {
    let inSchool: Bool
    let age: Int
}
```

This is the same as `Student` above — just with the properties in a different order. You'd expect the same size, right?

```swift
let OtherStudentSize = MemoryLayout<OtherStudent>.size // 16 !
```

It's 16, not 9. That's because of **alignment**.

## Alignment

The alignment of any `Int` in Swift is 8. What does that mean? It means the memory address where an `Int` is stored must be a **multiple of 8**.

Say we have:

```swift
let A = 88
let b = 17
```

Both `A` and `b` must be placed at memory addresses that are multiples of 8. If `A` is at address 0 (a multiple of 8) and `b` is at address 8 (also a multiple of 8) — no problem.

---

When do we have a problem? In this situation:

```swift
/*
A lot of other code in the app which will be saved in memory
.
.
.
.
.
.
*/

let A = 88
```

If other data already occupies addresses 0 through 4, and we try to place `A` at address 5 — we can't. Because 5 is not a multiple of 8. So the compiler places `A` at address 8 instead, leaving addresses 5, 6, and 7 empty (wasted as padding).

This brings us back to the original question: why does `OtherStudent` have a different size than `Student`?

## Alignment and Size 🎳

---

```swift
let boolAlignment = MemoryLayout<Bool>.alignment    //prints out 1
let IntegerAlignment = MemoryLayout<Int>.alignment  //prints out 8
```

```swift
struct Student {
     let age: Int    // alignment: 8
    let inSchool: Bool  // alignment: 1
}
```

Since `Bool` has alignment 1, it can go at any address (every number is a multiple of 1). Since `Int` has alignment 8, it must go at a multiple-of-8 address.

For `Student`:
- `Int` goes at address 0 (✅ multiple of 8)
- `Bool` goes at address 8 (✅ multiple of 1)
- Total size = 9

---

```swift
struct OtherStudent {
    let inSchool: Bool  // alignment: 1 — goes at address 0 ✅
    let age: Int        // alignment: 8 — can't go at address 1 ❌
}
```

For `OtherStudent`:
- `Bool` goes at address 0 (✅ multiple of 1)
- `Int` **cannot** go at address 1 (❌ not a multiple of 8)
- The compiler leaves addresses 1–7 as padding
- `Int` goes at address 8 (✅ multiple of 8)
- Total size = 16 🤯

So the **order of properties in a struct matters** — it can affect the size due to alignment padding.

To be continued ...
