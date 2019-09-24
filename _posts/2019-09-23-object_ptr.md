---
header: The other missing pointer type -- `object_ptr<T>`
categories: dev cpp programming
layout: post
reddit_url: "https://www.reddit.com/r/cpp/comments/d88ugt/the_other_missing_pointer_type_object_ptrt"
resources:
  - url: https://github.com/tvaneerd/isocpp/blob/master/observer_ptr.md
    desc: "Prebuttal for Standardizing observer_ptr"
---

There are three smart pointers in `std` already: `unique_ptr`, `shared_ptr` and `weak_ptr`.
A couple of years ago article was published, presenting `value_ptr` [^1], aka. *the missing smart pointer*. Here I would like discuss the other *(sort of still)* missing *(not so)* smart pointer -- `observer_ptr`.

* Display table of contents
{:toc}

## What is `observer_ptr<T>`?
`observer_ptr` is a recent addition to `c++` ecosystem -- it was appended into *Library Fundamentals TS* in its second version. It means that if you would like to use it in your code, you are bound to the `std::experimental` namespace for some time, until, or *if*, it is going to be merged into the standard.

The purpose of `observer_ptr` is to provide:
> a near drop-in replacement for raw pointer types, with the advantage that, as a vocabulary type, it indicates its intended use without need for detailed analysis by code readers. [^2]

Here is the thing -- I think it is not really a drop-in replacement for raw pointers; and its vocabulary type is confusing and does not indicate its intend clearly. But we will get back to that.

The idea behind `observer_ptr` is to provide an interface that indicates the pointer that is being passed is considered read-only (pointer, not the object itself) and there will be no intention of extending the underlying object lifetime or stealing its ownership. If you use `std::shared_ptr<Something> const&` in the function parameter list, you can use `observer_ptr<Something>` instead.

Why not simply use `Something*` then? You *could* but you probably shouldn't. Raw pointers inject many quirks into the code -- can be incremented and decremented, compared using `<`, converted into `void*`, casted. Additionally, those open up new questions, most importantly: *"who owns the object?"*.

When using `observer_ptr`, you are safe from the quirks. You get type safety, no silly `ptr++` and `(void*) ptr`. Unless you do `ptr.get()`, you should be good.

However, `observer_ptr` have some quirks on its own. Let's try using it to show them all in context.

```cpp
#include <experimental/memory>
#include <iostream>
#include <memory>

struct Resource
{
  int value = 42;
};

std::unique_ptr<Resource> create_resource()
{
  return std::make_unique<Resource>();
}

void use_resource(std::unique_ptr<Resource> const& resource)
{
  std::cout << "value=" << resource->value << std::endl;
}

void observe_resource(std::experimental::observer_ptr<Resource> resource)
{
  std::cout << "value=" << resource->value << std::endl;
}

int main()
{
  auto res = create_resource();
  use_resource(res);
  observe_resource(std::experimental::make_observer(res.get()));
}
```

When I first learned about `observer_ptr` and tried to use it, I ended up writing similar code and started thinking: *but... why would you do that...?*.

I *really* don't like `std::experimental::make_observer(resource.get())` to create the wrapper for the pointer. It should be as easy as `make_observer(resource)`, at worst. At best it should have implicit conversions from all smart pointers (I would consider a smart pointer as some type that provides `operator->`, `operator*`, and possibly `get()`.) and raw pointer of given type.
It shouldn't have `release()` member method, which, in smart pointer context, is related to releasing the ownership of the object. `observer_ptr` does not own anything.

On top of that, it requires a better name. `observer` implies relation to the Observer pattern, while, in fact, has nothing to do with it.
I'm somewhere between `ptr_view<T>` (*Just like the `string_view`.*) and `ptr<T>` (*It's just a pointer, man.*) myself. But there are [more](https://www.reddit.com/r/cpp/comments/808c5z/bikeshedding_time_poll_for_a_new_name_for/) ideas. [A lot more](https://github.com/tvaneerd/isocpp/blob/master/observer_ptr.md#a-list-of-names).

Different people have different concerns regarding the design of the type. For example, there is that one paper named [*Abandon observer_ptr*](http://wg21.link/P1408).

## A new hope

All in all, we can do better than that. Actually, we already do. There are 3rd-party implementations available, like [this one](https://github.com/anthonywilliams/object_ptr/blob/master/object_ptr.hpp) from Anthony Williams:

- named it `object_ptr` instead of `observer_ptr`
- dropped the `release()` member method
- made it construct implicitly from other pointer types

I like those changes in design; and it is just one header file so you can copy it into your code base and start using it now.
However, even though `object_ptr` is a better name already, I still prefer to do:

```cpp
#include <object_ptr.hpp>

namespace project::primary::ns {
template<typename T>
using ptr_view = jss::object_ptr<T>;
}
```

I'll stick to the `ptr_view` for the rest of the post for clarity sake. With that, our example can become as simple as:

```cpp
void use_resource(ptr_view<Resource> resource)
{
  std::cout << "value=" << resource->value << std::endl;
}

int main()
{
  auto shared_res = std::make_shared<Resource>();

  use_resource(shared_res);
}
```

Constructs implicitly from the smart pointer, can be passed by value -- just like the `string_view`. You can play with the example [here](https://wandbox.org/permlink/DLdL62Ln3NfWgGkw).

I just complained about using `get()` so let us dive into some use cases.

## When to use it

`ptr_view` enables developers to build more readable and generic interfaces, no longer bound to specific pointer type.
Most of the time, it does not matter whether the `std::shared_ptr<T>` or `T*`, or `boost::shared_ptr<T>`, or `my::better_ptr<T>` is being provided by the caller. If all you require is access to the underlying object, dependency on the specific type can be removed.
Not only the function is going to end up being more generic but also a lot more readable.

For `something(std::shared_ptr<T> const&, ...)` --> `something(ptr_view<T>, ...)` gets rid of the question *who owns the object now?*.

For `something_else(T* const, T* const, ...)` --> `something_else(ptr_view<T>, ptr_view<T>, ...)` you need not to worry if it is range or two objects.

Same applies for `std::unique_ptr` with custom deleter defined. By default, it is defined as `std::default_delete<T>` and can be left out of
type declarations.  However, sometimes it might be necessary to provide dedicated deleter, e.g. for resources that does not follow RAII technique.
However, `ptr_view` does not care about how the object have to be disposed on destruction, thus the deleter info is redundant, simplifying the code even more. Let's consider following snippet:

```cpp
struct LoggingDeleter
{
  template<typename T>
  void operator()(T* p) const
  {
    std::clog << "freeing p=" << p << std::endl;
    delete p;
  }
};

void use_resource(std::unique_ptr<Resource> const& resource)
{
  std::cout << "value=" << resource->value << std::endl;
}

void use_resource(std::unique_ptr<Resource, LoggingDeleter> const& resource)
{
  std::cout << "value=" << resource->value << std::endl;
}

int main()
{
  auto res = std::make_unique<Resource>();
  std::unique_ptr<Resource, LoggingDeleter> debug_resource{new Resource{}, LoggingDeleter{}};

  use_resource(res);
  use_resource(debug_resource);
}
```

As already mentioned, `ptr_view` does not care about object destruction, so `void use_resource(ptr_view<Resource>)` can handle all invocations, [like so](https://wandbox.org/permlink/PDbASnnOl7EwGG9p).

`ptr_view` behaves also a bit like `std::weak_ptr`'s *dumber* friend - but in a good way. Often you can be bound to use `std::weak_ptr<T>` as a mitigation for possible ownership cycles. However, assuming one of the objects is guaranteed to outlive the other one, it would be sufficient to store non-owning pointer to the longer-living one, like `T*`. Or, you guessed it, `ptr_view<T>`.

```cpp
struct Task;
struct Executor
{
  void work_until_done();
  void notify_done(ptr_view<Task>);
  void queue(std::shared_ptr<Task>);

private:
  std::vector<std::shared_ptr<Task>> _tasks;
};

struct Task
{
  explicit Task(ptr_view<Executor> e) : _executor(e) {}

  void notify_done()
  {
    _executor->notify_done(this);
  }

private:
  ptr_view<Executor> _executor;
};

int main()
{
  auto executor = std::make_unique<Executor>();
  for (std::size_t i = 0; i < 5; ++i)
    executor->queue(std::make_shared<Task>(executor));
  executor->work_until_done();
}
```

There is no point in using `std::weak_ptr` if you are guaranteed the `Executor` will outlive all the `Task` objects -- and it is quite possible it will be the case in most of the implementations.

Of course, we can get back to the discussion that we can just use `Executor*` but it will be as less-safe, less-readable and less-explicit compared to vocabulary type like `ptr_view`.

## Limitations

For `ptr_view` to be used in as much contexts as possible, the usage itself should be frictionless. Unfortunately, it is not the case yet.

Let us consider some `check_resource` function that takes pointer to arbitrary resource and verifies if the resource is accessible (`!= nullptr`, for simplicity).

```cpp
struct Filesystem
{...};

struct Network
{...};

template<typename Res>
bool check_resource(ptr_view<Res> resource)
{
  return resource != nullptr;
}

int main()
{
  auto fs = std::make_shared<Filesystem>();
  auto net = std::make_unique<Network>();

  check_resource(fs);
  check_resource(net);
}
```

Compilation attempt results in following error, plainly stating `object_ptr` cannot be matched against some arbitrary smart pointers.
{% capture compile_error%}prog.cc:24:3: error: no matching function for call to 'check_resource'
  check_resource(fs);
  ^~~~~~~~~~~~~~
prog.cc:14:6: note: candidate template ignored: could not match 'object_ptr' against 'shared_ptr'
bool check_resource(ptr_view<Res> resource)
     ^
prog.cc:25:3: error: no matching function for call to 'check_resource'
  check_resource(net);
  ^~~~~~~~~~~~~~
prog.cc:14:6: note: candidate template ignored: could not match 'object_ptr' against 'unique_ptr'
bool check_resource(ptr_view<Res> resource)
     ^
2 errors generated."{% endcapture %}
{%include details.html content=compile_error %}

`CTAD`[^3] and used-defined deduction guides could help there but, well, those are for classes only. There was a [paper](https://wg21.link/p1167) to allow deduction guides for functions -- I don't know what feedback it received though.

For now, we can avoid such issues with either specifying underlying `element_type`:
```cpp
check_resource<Network>(net);
```

or with intermediate function step, accepting *anything* and forwarding only those types that are convertible to `ptr_view`:

```cpp
template<typename ResPtr>
bool check_resource(ResPtr const& resource)
{
  return impl::check_resource<typename std::pointer_traits<ResPtr>::element_type>(resource);
}
```

While not perfect, both implementations manage to do the job and result in *sort-of-readable* compiler errors when misused. Check out the full example [there](https://wandbox.org/permlink/C3WErlTmlbNn5HDh).

## `valid_ptr<T>`
One possible extension of the non-owning pointer could be a `valid_ptr`, that is pointing to some existing object, and never to the `nullptr`.
It is quite simple to implement on top of the `jss::object_ptr` class, all that is required to add is some initial checks in the constructors.

```cpp
...
explicit valid_ptr(T* ptr) : _ptr(ptr)
{
  assert_valid();
}
...
```

That immediately leads to a discussion what should be done in case `ptr == nullptr`. `assert_valid()` can throw exception on invalid pointer or truly `assert` that condition and terminate on fail. That would be a question for a long and, probably, unsettlementable discussion.

However, such design might lead to assumptions that the pointer is always valid, while, in fact, it is just as dumb as `ptr_view`. It is impossible to guarantee validity without the ownership. And it is the caller role to do so.

With that in mind, `valid_ptr` becomes more of a implicit null-check of the argument provided. Maybe it is worth it but there might a better ideas how to solve the parameter nullability problem.

## Postlude
As of today, I'm sort of in the *Almost Always `ptr_view`* team. It's just more fit for the use case than `shared_ptr<T> const*` and `T*`.

I hope we get it merged into the standard someday; however, if I am to use it in most contexts, it *really* should get a better (pronounced -- shorter) name -- I feel like 6-8 characters is the most I can invest to use it myself. Any more and the code readability will suffer.
`CTAD` for functions would be fun, too.

I'm sticking to 3rd-party implementation, for now.


[^1]: [value_ptr — The Missing C++ Smart-pointer](https://hackernoon.com/value-ptr-the-missing-c-smart-pointer-1f515664153e)
[^2]: [std::experimental::observer_ptr](https://en.cppreference.com/w/cpp/experimental/observer_ptr)
[^3]: [Class template argument deduction](https://en.cppreference.com/w/cpp/language/class_template_argument_deduction)
