+++
title = "إزاي تعرف احجام ال Types بتاعتك في سويفت"
date = 2020-11-07

[taxonomies]
tags = ["swift", "memory"]
+++

# إزاي تعرف احجام ال Types بتاعتك في سويفت ؟

في سويفت، اي اوبجيكت او تايب، ليه ٣ خصائص ممكن يعبرولك عن تعامل الميموري مع الأوبجيكت دا، هنتعرف على خاصيتين من الخصائص دي في التدوينة دي، و بعضها فيه تدوينات اخرى،

الخصائص اللي هنتكلم عنها النهاردة هي Size , alignment

## الحجم | Size 📦

---

لو عندك اتنين ```struct``` في البرنامج بتاعك زي دول:

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

و سألتك تتوقع الأوبجيكت اللي اسمه مصطفى اكبر ؟ ولا الللي اسمه احمد ؟ بالمنطق، الأوبجيكت اللي اسمه احمد اكبر علشان هو مكون من متغيرين، ```age``` و ```phoneNumber```

بس ازاي نتأكد من انه كلامنا صح ؟ لازم ارقام تثبت صحة كلامنا ؟ علشان نتأكد هنستخدم MemoryLayout

## 💻 Memory Layout

---

فيه في سويفت نوع اسمه MemoryLayout النوع دا بيخلينا نقدر نتأكد من احجام الأنواع اللي عندنا زي Student و Professor و اي نوع في سويفت زي String و Bool علشان نعرف الSize اللي اي اوبجيكت من نوع Student او من نوع Professor هياخده من الميموري:

```swift
let studentSize = MemoryLayout.size
let professorSize = MemoryLayout.size

print(studentSize) // prints 8
print(professorSize) //prints 16 😉
```

هنا استخدمنا MemoryLayout و طلبنا منها تجيب حجم/size اي اوبجيكت هيتعمل من الtypes هيبقى حجمه كام زي ما توقعنا، professor هتاخد مساحة اكبر من الميموري

ولو عاوزين نتأكد من الكلام على الأوبجيكتس، زي اوبجيكت آحمد و مصطفى اللي فوق

```swift
let mostfaSize = MemoryLayout.size(ofValue: mostfa)
let ahmedSize = MemoryLayout.size(ofValue: ahmed)

print(mostfaSize) //prints 8
print(ahmedSize) //also prints 16
```

لكن ليه ؟ ليه ٨ ؟ و ليه ١٦ ؟ نرجع تاني للحجم## للحجم | Size

## نرجع للحجم | Size 📦

---

في سويفت سهل انك تحسب حجم اي ستراكت في البرنامج، لأنه حجم الستراكت = حجم المتغيرات اللي جواه بمعنى إيه ؟ بمعنى انه

```swift
struct Student {
     let age: Int
    let inSchool: Bool
}

 let intSize = MemoryLayout.size  //prints out 8
 let boolSize = MemoryLayout.size  //prints out 1

let studentSize = MemoryLayout.size //prints out 9 ( 1+ 8 )
```

علشان الستراكت دا متكون من متغير من نوع Int و متغير من نوع Bool , حجمه هيساوي مجموع حجم الBool و حجم الInt ، سهلة خالص، صح ؟🦹🏻‍♂️

طيب خلينا نتأكد بمثال تاني

```swift
struct OtherStudent {
    let inSchool: Bool
    let age: Int
}
```

هنا دا OtherStudent نفس الStudent اللي فوق بالظبط، لكن الفرق اننا غيرنا ترتيب الproperties بتاعنا، المفروض يكون نفس الSize ؟!!!

```swift
let OtherStudentSize = MemoryLayout.size // 16 .alignment //prints out 8
```

ال Alignment لأي Integer في سويفت عبارة عن ٨، الرقم دا معناه إيه ؟ معناه انه عنوان الMemory اللي هيتم وضع فيه الInteger لازم يكون من مضاعفات ال٨

لو عندي الكود الآتي

```swift
let A = 88
let b = 17
```

دا معناه انه المتغير A و b لازم يتحطوا في عنوان ميموري من مضاعفات ال٨، نلاحظ عنوان الميموري للمتغير A في الصورة = صفر، و بما انه الصفر من مضاعفات ال٨، يبقى معندناش مشكلة ايضًا، المتغير b موجود في العنوان ٨ وبما انه ال٨ من مضاعفات ال ٨ ايضًا معندناش مشاكل

---

امتى يكون عندنا مشكلة ؟ يكون عندنا مشكلة في الموقف الآتي

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

لو فيه بيانات اخرى Other موجودة في الميموري من العنوان صفر الى العنوان ٤ ، و جينا نحط المتغير a في العنوان رقم ٥، مش هنقدر ! ليه ؟ لأنه طبقًا ل Alignment الخاص ب Integer لازم يتم وضعه في عنوان من مضاعفات ال ٨ وبناء عليه هيتم وضع المتغير A في العنوان رقم ٨، و هيكون العناوين ٥،٦،٧ فاضيين

ومن هنا نقدر نرجع للسؤال الأساسي، ليه OtherStudent حجمه اختلف عن Student

## Alignment and size 🎳

---

```swift
let boolAlignment = MemoryLayout.alignment //prints out 1
let IntegerAlignment = MemoryLayout.alignment //prints out 8
```

```swift
struct Student {
     let age: Int
    let inSchool: Bool
}
```

بمعرفة انه ال Alignment للBool يساوي ١، دا يعني انه ممكن احط الBoolean values في اي عنوان في الميموري، لأنه كل الارقام تعتبر من مضاعفات الواحد، وايضا بمعرفة انه الAlignment للIntegers يساوي ٨ دا معناه انه ممكن نحط الIntegers في العنواين اللي من مضاعفات ٨

هنا، الInteger عنوان صفر، و الصفر من مضاعفات ال ٨

و الBoolean عنوان٨، و ال٨ من مضاعفات ال ١ ودا معناه انه ال Alignment تحقق و شغال و زي الفل و بناء عليه حجم الStudent يساوي ٩

---

```swift
struct OtherStudent {
    let inSchool: Bool
    let age: Int
}
```

لو جينا نطبق قواعد الAlignment هنا هنلاقي الآتي

اول حاجة هيتم وضع الBoolean value في العنوان صفر، و لأنه الصفر من مضاعفات ال١، الAlignment تصبح مظبوطة ✅

لكن الInteger مينفعش يتحط في العنوان رقم ١ ❌ لأن العنوان رقم ١ مش من مضاعفات ال ٨ وبناء عليه هيتم تركه فاضي، وترك جميع العناوين اللي مش من مضاعفات ٨ فاضية، حتى نصل الى اول رقم من مضاعفات ٨، وهو ال ٨، ونحط فيه الInteger

النتيجة هنا، انه بسبب ال Alignment اصبح الstruct حجمه ١٦ 🤯

To be continued ...
