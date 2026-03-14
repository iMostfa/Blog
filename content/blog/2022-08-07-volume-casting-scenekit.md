+++
title = "How to Implement Volume Casting in SceneKit"
date = 2022-08-07

[taxonomies]
tags = ["swift", "graphics"]
+++

# How to Implement Volume Casting in SceneKit

In this post we'll talk about implementing a feature that doesn't exist natively in SceneKit. To get there, we need to understand the concept first, identify the problem, then figure out how to solve it in code.

## What is a Ray?

In the context of computer graphics, a **ray** is a point with a direction — another name for a vector.

Imagine a laser pointer in your hand: it has a position and a direction (where it's pointing).

```
rPos = ray position in space
rDir = ray direction in space
```

## What is Ray Casting?

Ray casting is the process of determining whether a ray intersects with anything in a 3D scene.

Since a ray has a position and a direction, you can extend it through space — until it hits something. In that example, the ray gets extended until it intersects the sphere in the middle. Now you know the ray is hitting that sphere.

## A Practical Example

One of the most common uses of ray casting is with mouse/touch input.

Imagine you have a screen full of 3D objects, and you want to know which object the user tapped. When the user taps, a ray is fired from the tap location — it travels until it hits an object. If it hits nothing, the user tapped empty space.

The challenge here: the tap is in 2D screen space, but the objects live in a 3D world. Ray casting is what bridges the two — it converts the 2D tap into a 3D ray and checks what it intersects.

## Hit Testing in Game Engines

### Unity Ray Casting

Since hit testing is fundamental, every game engine has it built in. In Unity:

```swift
Ray ray = Camera.main.ScreenPointToRay(Input.mousePosition);
RaycastHit hit;
if (Physics.Raycast(ray, out hit, 100))
{
    Debug.Log(hit.transform.name);
    Debug.Log("hit");
}
```

`Physics.Raycast` handles all the math.

### SceneKit Hit Testing

In SceneKit (Apple calls it "hit testing"):

```swift
let locationOfTapIn2D = tapRecognizer.location(in: sceneView)
let hitResults = diagramView.sceneView.hitTest(locationOfTapIn2D, options: nil)
let tappedNode = hitResults.first?.node // the object you have tapped
```

## What Ray Casting Can't Do

Imagine your app needs to find the **closest objects** to a tap, not just the one directly under it.

Say the user taps in empty space. You want to know which objects are nearby — the 4 or 5 closest ones. This becomes even more useful when objects overlap and you can't tell which one the user intended.

For example: the user taps near a small gray area that partially overlaps a large orange shape. Did they mean to tap the gray one or the orange one? Standard hit testing can only tell you which one is directly under the ray — which may not be what the user wanted.

Ray casting fires a single ray from the tap point. When it hits something, it stops. So if the tap falls in empty space between objects, it finds nothing at all.

What we want is something like **widening the ray's diameter** — so instead of a single-point pierce, we get a volume that can intersect multiple nearby objects at once.

## Other Types of Casting

Some game engines solve this by letting you cast a **shape** instead of a ray:

- BoxCast 📦
- CapsuleCast 💊
- SphereCast 🏀
- RigidBodyCast 🥎

The idea: instead of casting a ray, place a box at the hit point and check which objects it overlaps. That's **volume casting**.

## Volume Casting in SceneKit

SceneKit doesn't have volume casting built in. Here's how to approximate it:

**Steps:**
1. Detect the touch location using normal hit testing (convert 2D → 3D)
2. Place an invisible box at that 3D point
3. Check which objects intersect with the box

## Technical Implementation

### 1. Detect Touch Location

```swift
// Inside the tap gesture selector
let locationOfTapIn2D = tapRecognizer.location(in: sceneView)
let hitResults = diagramView.sceneView.hitTest(locationOfTapIn2D, options: nil)
let firstTappedNode = hitResults.first // the object you have tapped
```

### 2. Place the Box

```swift
let boxHeight = 12

let boxGeometry = SCNBox(width: boxHeight,
                         height: boxHeight,
                         length: boxHeight,
                         chamferRadius: 2)

let boxNode = SCNNode(geometry: boxGeometry)
// Add to root node (world space)
sceneView?.scene?.rootNode.addChildNode(boxNode)
// Place the box at the touch coordinates
boxNode.worldPosition = firstHit.worldCoordinates
boxNode.name = "VOLUME_CASTING_BOX"
// Hide it — the user shouldn't see it
boxNode.isHidden = true
// Physics body is required so we can check intersections
boxNode.physicsBody = .init(type: .kinematic,
                             shape: .init(node: boxNode, options: [:]))
```

### 3. Check Intersections

The function `contactTest(with:)` returns an array of `SCNPhysicsContact` — each contact represents one object intersecting with our box.

Each `SCNPhysicsContact` gives you `nodeA` and `nodeB`. In our case, `nodeA` will be our box, and `nodeB` will be the intersecting object.

```swift
let boxContacts = scene.physicsWorld.contactTest(with: boxNode.physicsBody!, options: [:])

if boxContacts.count > 0 {
    // Get the names of intersecting nodes
    let nodesNames = boxContacts
        .map { $0.nodeB.name ?? "NO_OBJECT_NAME" }
        .filter { $0 != "VOLUME_CASTING_BOX" }

    print(nodesNames)

    // You also have access to the nodes themselves
    // — highlight them, scale them, do whatever you need
    boxContacts.forEach { contactWithBox in
        print(contactWithBox.nodeB)
    }
}
```

## Thread Safety

If you run the above code on the main thread, it will likely crash. SceneKit runs on its own render thread, and accessing it from the main thread creates race conditions. The safest approach: always access SceneKit from its own thread.

How? Conform to `SCNSceneRendererDelegate` and put your code inside:

```swift
func renderer(_ renderer: SCNSceneRenderer, willRenderScene scene: SCNScene, atTime time: TimeInterval) {
    // This is called every frame — all SceneKit access should go here

    // This boolean is set to true when the user taps (from the gesture selector)
    // Note: this isn't fully race-condition safe either, but works in practice
    if isCheckingCloseObjectsToTap,
       let node = scene.rootNode.childNode(withName: "VOLUME_CASTING_BOX", recursively: true) {

        defer {
            // Reset after checking — we only want to check for one frame
            isCheckingCloseObjectsToTap = false
        }

        let boxContacts = scene.physicsWorld.contactTest(with: node.physicsBody!, options: [:])

        if boxContacts.count > 0 {
            let nodesNames = boxContacts
                .map { $0.nodeB.name ?? "" }
                .filter { $0 != "VOLUME_CASTING_BOX" }

            print(nodesNames)

            boxContacts.forEach { contactWithBox in
                print(contactWithBox.nodeB)
            }
        }
    }
}
```

Since this delegate method is called every frame, you shouldn't put heavy work in it.

## Wrap Up

Using this approach, we can approximate Unity-style volume casting in SceneKit. I say "approximate" because I'm not sure there's a better way — but this works well in practice. From here, you can ask the user which nearby object they intended to tap, and present them as options.

SceneKit is a solid and capable framework in the Apple ecosystem, but it lacks many of the features and the documentation support you'd find in Unity. As far as I know, no one has written about a volume casting implementation in SceneKit before — so I may write this up in English too, since it's content that simply doesn't exist online yet.
