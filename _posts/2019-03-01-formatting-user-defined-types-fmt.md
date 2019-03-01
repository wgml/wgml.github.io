---
header: Formatting user-defined types with {fmt} library
categories: dev cpp programming
layout: post
---


C++ has two standardized ways of printing formatted text out already: `printf`-family functions inherited from C and I/O streams abstraction built on `operator<<`. Streams are considered more modern, providing type-safety and extensibility functionalities. However, `printf` have some notable advantages, too --- at the cost of lost type-safety, user can use an interface that looks familiar to almost all developers, allowing for some ways of localization and more readable syntax.
And then, there is `{fmt}` --- yet another text formatting library, inspired by design already available in languages like [Python](https://www.python.org/dev/peps/pep-3101/) and [Rust](https://doc.rust-lang.org/std/fmt/index.html).

Perhaps it's just [yet another standard to compete](https://xkcd.com/927/) but, with an ambition to support most of the advantages of both mentioned methods, and with process of standardization being already [in progress](http://wg21.link/p0645), it is worth looking into.

* Display table of contents 
{:toc}

## Quick look at `{fmt}`

`{fmt}` library is available on [Github](https://github.com/fmtlib/fmt) for quite some time already. It provides API similar to `str.format()` from Python 3, far closer to `printf(...)` than `std::cout << ...` at the first glance. However, it also enforces type-safety and allows for extending to non-standard types, what makes it almost a silver bullet for text formatting in C++.

Based on the mandatory _Hello world_ example, use of the library may look like so:

```Cpp
fmt::print("Hello, {}!\n", name);
```

`{fmt}` supports positional arguments, allowing user to manipulate the order in which arguments are used in the message:

```Cpp
std::string message = fmt::format("{1} years ago, {0} was born.", name, age);
```

Formatting is also possible (well, that is the point, after all). If you want to print a number to the screen and align it to the right with the width of 7 characters, that is the syntax:

```Cpp
fmt::print("The number is {:>7}!\n", number);
```

Of course, this can become far more *perl-y* in style. This is a valid format:
```Cpp
fmt::print("The number is {0:.>+#{1}.{2}G}\n", 42.123, 20, 10);
```
Translating it to human --- the zeroth argument (`0:`) will be aligned to the right (`>`), with dots filling empty space (`.`), the sign will be printed out (`+`) no matter plus or minus, the number will be put in *general* format (`G`) unless it is too large, then it will be displayed using exponent notation. Trailing zeros will not be removed because of the alternate form (`#`). Width and precision are configured by first (`{1}`) and second (`{2}`) argument.
Fortunately, you can look up the syntax in the [official docs](http://fmtlib.net/latest/syntax.html).

And the result? 

{%include details.html content="The number is ........+42.12300000" %}

All in all, I suggest not to overcomplicate the syntax on your end unless you want your code to become write-only.

## Printing out a custom type

One neat feature of `{fmt}` is the possibility to extend it for user-defined types, similarly to the convention used when overloading `operator<<` for such types.

For example, given the simple `complex` type, instead of defining the formatting in every place where the objects are printed out, one can specify formatter for the type and use it without any hassle.

```Cpp
#include <fmt/format.h>

struct complex
{
  double a;
  double b;
};

template<>
struct fmt::formatter<complex>
{
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx);

  template<typename FormatContext>
  auto format(complex const& number, FormatContext& ctx);
};
};

int main()
{
  complex number{1, 2};
  fmt::print("The number is {0}+i{1}.\n", number.a, number.b);
  fmt::print("The number is {}.\n", number);
}
```

User must specialize the `formatter<T>` struct template in `fmt` namespace with implementations of `parse` and `format` functions.
Provided the user wants to match the result of both lines, those two methods can be implemented as follows:

```cpp
template<typename ParseContext>
constexpr auto fmt::formatter<complex>::parse(ParseContext& ctx)
{
  return ctx.begin();
}

template<typename FormatContext>
auto fmt::formatter<complex>::format(complex const& number, FormatContext& ctx)
{
  fmt::format_to(ctx.out(), "{0}+i{1}", number.a, number.b);
  return ctx.out();
}
```
`parse` assumes no formatting is specified for the type, and `format` outputs the variable in hard-coded formatting.
In case of an error, exception will be thrown, with mostly unhelpful message, like "*unknown format specifier*".

## Specifying formatting for user-defined types

What if we want to allow the user to specify formatting for printed-out fields?

Let's look into another example. First of all, let me introduce the type.

```cpp
struct roman
{
  explicit roman(unsigned v) : value(v)
  {
    if (value == 0)
      throw std::runtime_error("0 cannot be represented");
    if (value > 3999)
      throw std::runtime_error("Roman value cannot exceed 3999");
  }

  unsigned const value;
};
```

It's just a simple wrapper claiming to represent some Roman numeral. But how does it fit our use case?

We might assume user would like to print out such numerals both in decimal form and in *string-like* representation commonly associated with Roman numeric system. Then, we would like to be able to execute following program without errors:

```cpp
int main()
{
  for (unsigned i = 1; i < 4000; ++i)
    fmt::print("{0:d} = {0:r}\n", roman{i});
}
```

Moreover, it would be useful to allow specifying underlying formatting for string and decimal representations --- then, our testing program can take form as follows.

```cpp
int main()
{
  for (unsigned i = 1; i < 4000; ++i)
    fmt::print("{0:d>4} = {0:r.>16}\n", roman{i});
}
```
The first character after the `:` defines representation that should be used and all that follows should be interpreted as underlying formatting. We will also assume `{0}` defaults to Roman representation but without the possibility to specify the underlying formatting to make the code simpler.

As previously, we have to specify specialization of `fmt::formatter` class and implement two methods. This time, we will delegate `parse` and `format` calls to formatters of `std::string_view` or `unsigned`, depending on the formatting specified. The formatters will be members of the structure, and, because it is either one of them but never both nor none that is being used, we will utilize `std::variant` for this.
Interface of the formatter can be now specified.

```cpp
template<>
struct fmt::formatter<roman>
{
  using unsigned_fmt = fmt::formatter<unsigned>;
  using string_view_fmt = fmt::formatter<std::string_view>;
  using underlying_formatter_type = std::variant<string_view_fmt, unsigned_fmt>;

  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx);

  template<typename FormatContext>
  auto format(roman const& number, FormatContext& ctx);

private:
  underlying_formatter_type underlying_formatter;
};
```

Let's look more closely at the `parse` implementation first. All it needs to do is to determine which formatter should be used and forward the call to `parse`. 

```cpp
template<typename ParseContext>
constexpr auto parse(ParseContext& ctx)
{
  auto fmt_end = std::find(ctx.begin(), ctx.end(), '}');

  auto fmt_end = std::find(ctx.begin(), ctx.end(), '}');
  if (fmt_end != ctx.begin())
  {
    char representation = *ctx.begin();
    if (representation == 'd')
      underlying_formatter = unsigned_fmt{};
    else if (representation != 'r')
      throw fmt::format_error("invalid roman representation");

    ctx.advance_to(std::next(ctx.begin()));
  }

  return std::visit([&](auto& fmt) { return fmt.parse(ctx); }, underlying_formatter);
}
```

Let's analyze the behavior with an example. Given we want to print a Roman number with `fmt::print("{0:r>16} is the number {0:d}", roman_number)`, two `formatter<roman>` instances will be created and `parse` function will be called twice. First time, the input to the function will be a context with `begin` pointing to the string of `r>16} is the number {0:d}`. The second time --- `d}`. Part specifying the position is being consumed by the `fmt` library itself. Then, user must parse the rest of the string and make sure the context is left in a valid state for any other formatters to use. In this example, in both cases we must make sure context is advanced to the `}` character.

However, all the function is doing is to determine if user asked for roman or numeric representation and call `ctx.advance_to` pointing to the second character. We will consume only the first char, leaving the rest intact. Finally, we forward the context to `parse` of the underlying formatter, taking care of the rest of format string.

`std::variant` constructs with the first type specified by default so all the `parse` is required to do is to overwrite the value in case decimal representation is specified or throw an exception when erroneous formatting is found.

Next, `format`.

```cpp
template<typename FormatContext>
auto format(roman const& number, FormatContext& ctx)
{
  return std::visit(formatting_visitor<FormatContext>{number, ctx}, underlying_formatter);
}
```

We just forward the call to visitor:
```cpp
namespace romans {
struct numeral
{
  char repr[3];
  unsigned value;
};
{% raw %}
constexpr std::array<numeral, 13> numerals = {{
    {"M", 1000}, {"CM", 900}, {"D", 500}, {"CD", 400},
    {"C", 100}, {"XC", 90}, {"L", 50}, {"XL", 40},
    {"X", 10}, {"IX", 9}, {"V", 5}, {"IV", 4}, {"I", 1}
  }};{% endraw %}
}  // namespace romans

template<typename FormatContext>
struct formatting_visitor
{
  formatting_visitor(roman const& number, FormatContext& ctx) : number(number), ctx(ctx)
  {}

  void operator()(string_view_fmt& f) const
  {
    unsigned value = number.value;
    std::string buffer;

    buffer.reserve(16);  // romans are no longer that 15 chars
    for (auto const& [repr, v] : romans::numerals)
    {
      while (value >= v)
      {
        buffer.append(repr);
        value -= v;
      }
    }

    ctx.advance_to(f.format(buffer, ctx));
  }

  void operator()(unsigned_fmt& f) const
  {
    ctx.advance_to(f.format(number.value, ctx));
  }

private:
  roman const& number;
  FormatContext& ctx;
};
```

In both possible cases, the function calls underlying `format` with value to be printed out and context as arguments. Then, the output iterator must be adjusted, so `advance_to` is called with the result. Similarly, our `format` returns `ctx.out()`.
In case of decimal representation, we can simply extract the value from number; for Roman representation, we execute conversion algorithm and that's why we even need the struct instead of simpler lambda.

Finally, we can check the results.
```plaintext
   1 = ...............I
   2 = ..............II
...
3998 = .....MMMCMXCVIII
3999 = .......MMMCMXCIX
```

It seems everything worked as expected. If you are interested in the full source code of the example, you can find it and play with it on the [Wandbox](https://wandbox.org/permlink/gxTuRDykK1aUrDER).
## Postlude

`{fmt}` is a neat library, easy to use from user perspective, and providing syntax that is new for C++ but already established in other programming languages. Perhaps it is a bit more demanding when formatting for custom type is to be specified but it should be a rare case to build complex formatting outside of the standard library.

It has a lot more to offer than was described in this post. It [claims](https://github.com/fmtlib/fmt#benchmarks) to be faster than alternatives both in compile and run times, without bloating application code, too.

It also supports formatting time and date, `std::chrono` types (it is [already proposed](https://wg21.link/p1361) for merge into the standard), and more. Check out [the official documentation](http://fmtlib.net/latest/index.html) for details. Even though not everything is going to be merged into the standard, I'm still happy to see `std::format` in the next edition of C++, probably even in `c++20`.