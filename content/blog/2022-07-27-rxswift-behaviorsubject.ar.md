+++
title = "ايه سبب تسمية BehaviorSubject"
date = 2022-07-27

[taxonomies]
tags = ["swift", "rxswift"]
+++

### مقدمة

بصراحة انا من محبي الافكار و المفاهيم اللي بتقدمها الريأكتڤ بروجرامينج، لأنها في اغلب الاوقات بتسهل فهم الكود و بتقلل بعض الباجز الفترة دي ابتديت اقرا عن rxSwift، علمًا بأني اصلا بستخدم Combine كأريكتڤ فريمورك،

لقيت انه فيه Subject اسمه BehaviorSubject وهو عبارة عن سابجكت بيبعت اخر فاليو اتبعتت عليه،اول ما السبسكرايبر يسبسكرايب و طبعا بيبعت بعد كدا اي ڤاليو تتبعت عليه

### سبب التسمية

بصراحة لقيت نفسي بقول، هو فين البيهاڤيور في الموضوع ؟ ليه فيه كلمة بيهاڤيور، علمات انه الSubject اللي بيعمل نفس الكلام دا في Combine اسمه واضح جدا، الا وهو CurrentValueSubject

و الاسم واضح جدا، عبارة عن سابجكت بيحفظ و بيبعت الكارنت فاليو، فليه التسمية مش واضحة في RxSwift زي ماهي واضحة في Combine ؟ الاجابة كانت كالآتي

In the world of functional reactive programming, a behavior is a value that changes over time. This is exactly what a BehaviorSubject represents: when you subscribe you get the current value, and then you can continue to observe the changes.

ودا معناه انه كلمة بيهافيور في عالم الريآكتيف بروجرامينج معناها الڤاليو التي يتم مراقبتها و يتم متابعة تغيرها..

معلومة جديدة، حبيت اني شاركها، و الايام الجاية ممكن اكتب اكتر عن rxSwift لأني بدرس الفرق بينها و Combine
