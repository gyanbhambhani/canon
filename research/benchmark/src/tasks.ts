/**
 * 40 small, precisely specified functions, each with tests. Types use Canon syntax and are
 * restricted to what both languages express directly: Int, Float, String, Bool, List[T],
 * tuples and Option[T] (TypeScript: number, string, boolean, T[], [A, B], T | null).
 * Test values are JSON: Option is null or the value; tuples are arrays.
 */
export interface Task {
  id: string;
  tier: "basic" | "hard";
  fn: string;
  params: [string, string][];
  ret: string;
  desc: string;
  tests: [unknown[], unknown][];
  /** Type declarations the program must include, in each language (hard tier). */
  decls?: { canon: string; ts: string };
  /** How each declared type is encoded in test JSON: a record is a plain object; a sum is { kind, ...fields }. */
  typeKinds?: Record<string, "record" | "sum">;
}

const t = (id: string, params: [string, string][], ret: string, desc: string, tests: [unknown[], unknown][]): Task => ({
  id,
  tier: "basic",
  fn: id,
  params,
  ret,
  desc,
  tests,
});

export const BASIC_TASKS: Task[] = [
  t("sum_evens", [["xs", "List[Int]"]], "Int", "Return the sum of the even numbers in xs.",
    [[[[1, 2, 3, 4]], 6], [[[]], 0], [[[-2, 5, 8]], 6], [[[1, 3]], 0]]),
  t("count_vowels", [["s", "String"]], "Int", "Count the lowercase vowels (a, e, i, o, u) in s. Other characters do not count.",
    [[["hello"], 2], [[""], 0], [["AEIOU aeiou"], 5], [["rhythm"], 0]]),
  t("reverse_words", [["s", "String"]], "String", "Words in s are separated by single spaces. Return the words in reverse order, joined by single spaces.",
    [[["one two three"], "three two one"], [["solo"], "solo"], [["a b"], "b a"]]),
  t("fizzbuzz_list", [["n", "Int"]], "List[String]", "Return the FizzBuzz strings for 1 through n: \"FizzBuzz\" for multiples of 15, \"Fizz\" for multiples of 3, \"Buzz\" for multiples of 5, otherwise the number as a string. n >= 0.",
    [[[5], ["1", "2", "Fizz", "4", "Buzz"]], [[0], []], [[15], ["1", "2", "Fizz", "4", "Buzz", "Fizz", "7", "8", "Fizz", "Buzz", "11", "Fizz", "13", "14", "FizzBuzz"]]]),
  t("max_or_none", [["xs", "List[Int]"]], "Option[Int]", "Return the largest element of xs, or nothing if xs is empty.",
    [[[[3, 9, 2]], 9], [[[]], null], [[[-5, -1, -7]], -1]]),
  t("is_palindrome", [["s", "String"]], "Bool", "Return whether s reads the same forwards and backwards, comparing characters exactly.",
    [[["racecar"], true], [[""], true], [["ab"], false], [["Aa"], false], [["abba"], true]]),
  t("factorial", [["n", "Int"]], "Int", "Return n! for n >= 0 (0! is 1).",
    [[[0], 1], [[1], 1], [[5], 120], [[10], 3628800]]),
  t("fib", [["n", "Int"]], "Int", "Return the n-th Fibonacci number, where fib(0) = 0 and fib(1) = 1. n >= 0.",
    [[[0], 0], [[1], 1], [[10], 55], [[20], 6765]]),
  t("gcd", [["a", "Int"], ["b", "Int"]], "Int", "Return the greatest common divisor of two non-negative integers. gcd(0, 0) is 0.",
    [[[12, 18], 6], [[7, 13], 1], [[0, 5], 5], [[0, 0], 0]]),
  t("is_prime", [["n", "Int"]], "Bool", "Return whether n is a prime number. Numbers below 2 are not prime.",
    [[[2], true], [[1], false], [[0], false], [[17], true], [[21], false], [[97], true]]),
  t("digit_sum", [["n", "Int"]], "Int", "Return the sum of the decimal digits of n, for n >= 0.",
    [[[0], 0], [[1234], 10], [[9999], 36]]),
  t("average", [["xs", "List[Float]"]], "Float", "Return the arithmetic mean of xs, or 0.0 if xs is empty.",
    [[[[1.0, 2.0, 3.0]], 2.0], [[[]], 0.0], [[[0.5]], 0.5], [[[1.0, 2.0]], 1.5]]),
  t("running_total", [["xs", "List[Int]"]], "List[Int]", "Return the running totals of xs: element i is the sum of xs[0] through xs[i].",
    [[[[1, 2, 3]], [1, 3, 6]], [[[]], []], [[[5, -5, 5]], [5, 0, 5]]]),
  t("dedupe", [["xs", "List[Int]"]], "List[Int]", "Remove repeated values from xs, keeping the first occurrence of each, in the original order.",
    [[[[1, 2, 1, 3, 2]], [1, 2, 3]], [[[]], []], [[[4, 4, 4]], [4]]]),
  t("count_word", [["s", "String"], ["w", "String"]], "Int", "Words in s are separated by single spaces. Count the words in s that are exactly equal to w.",
    [[["the cat and the hat", "the"], 2], [["a b c", "d"], 0], [["go go go", "go"], 3]]),
  t("longest_word", [["s", "String"]], "String", "Words in s are separated by single spaces. Return the longest word; if several share the longest length, return the first of them.",
    [[["a quick brown fox"], "quick"], [["hi"], "hi"], [["ab cd ef"], "ab"]]),
  t("clamp", [["x", "Int"], ["lo", "Int"], ["hi", "Int"]], "Int", "Return x limited to the range lo through hi (lo <= hi).",
    [[[5, 0, 10], 5], [[-3, 0, 10], 0], [[42, 0, 10], 10]]),
  t("second_largest", [["xs", "List[Int]"]], "Option[Int]", "Return the second largest distinct value in xs, or nothing if there are fewer than two distinct values.",
    [[[[3, 1, 4, 4]], 3], [[[7]], null], [[[2, 2]], null], [[[-1, -5, -3]], -3]]),
  t("merge_sorted", [["a", "List[Int]"], ["b", "List[Int]"]], "List[Int]", "Both lists are sorted ascending. Return one ascending list holding every element of both.",
    [[[[1, 4, 6], [2, 3, 7]], [1, 2, 3, 4, 6, 7]], [[[], [1]], [1]], [[[1, 1], [1]], [1, 1, 1]]]),
  t("chunk", [["xs", "List[Int]"], ["n", "Int"]], "List[List[Int]]", "Split xs into consecutive groups of n elements (n >= 1); the last group may be shorter.",
    [[[[1, 2, 3, 4, 5], 2], [[1, 2], [3, 4], [5]]], [[[], 3], []], [[[1, 2, 3], 3], [[1, 2, 3]]]]),
  t("flatten", [["xss", "List[List[Int]]"]], "List[Int]", "Concatenate the lists in xss in order.",
    [[[[[1, 2], [], [3]]], [1, 2, 3]], [[[]], []]]),
  t("zip_sum", [["a", "List[Int]"], ["b", "List[Int]"]], "List[Int]", "Return the element-wise sums of a and b, as long as the shorter list.",
    [[[[1, 2, 3], [10, 20]], [11, 22]], [[[], [1]], []]]),
  t("index_of", [["xs", "List[Int]"], ["x", "Int"]], "Option[Int]", "Return the index of the first occurrence of x in xs, or nothing if x is absent.",
    [[[[5, 7, 5], 5], 0], [[[5, 7, 5], 7], 1], [[[1], 9], null]]),
  t("count_greater", [["xs", "List[Int]"], ["limit", "Int"]], "Int", "Count the elements of xs strictly greater than limit.",
    [[[[1, 5, 10], 4], 2], [[[], 0], 0], [[[3, 3], 3], 0]]),
  t("word_lengths", [["s", "String"]], "List[Int]", "Words in s are separated by single spaces. Return the length of each word, in order.",
    [[["a bb ccc"], [1, 2, 3]], [["hello"], [5]]]),
  t("repeat_string", [["s", "String"], ["n", "Int"]], "String", "Return s repeated n times (n >= 0).",
    [[["ab", 3], "ababab"], [["x", 0], ""], [["", 5], ""]]),
  t("join_ints", [["xs", "List[Int]"], ["sep", "String"]], "String", "Return the decimal forms of the numbers in xs joined by sep.",
    [[[[1, 2, 3], "-"], "1-2-3"], [[[], ","], ""], [[[-4], ","], "-4"]]),
  t("parse_sum", [["s", "String"]], "Int", "s holds items separated by commas. Return the sum of the items that are valid integers (an optional leading minus sign followed by digits); skip every other item.",
    [[["1,2,3"], 6], [["4,x,5"], 9], [[""], 0], [["-3,10,abc"], 7]]),
  t("min_max", [["xs", "List[Int]"]], "Option[(Int, Int)]", "Return the smallest and the largest element of xs as a pair, or nothing if xs is empty.",
    [[[[3, 1, 2]], [1, 3]], [[[]], null], [[[7]], [7, 7]]]),
  t("pairs_summing", [["xs", "List[Int]"], ["target", "Int"]], "Int", "Count the index pairs i < j with xs[i] + xs[j] equal to target.",
    [[[[1, 2, 3, 4], 5], 2], [[[1, 1, 1], 2], 3], [[[], 0], 0]]),
  t("rotate_left", [["xs", "List[Int]"], ["k", "Int"]], "List[Int]", "Rotate xs left by k positions (k >= 0, and k may exceed the length). An empty list stays empty.",
    [[[[1, 2, 3, 4], 1], [2, 3, 4, 1]], [[[1, 2, 3], 5], [3, 1, 2]], [[[], 2], []]]),
  t("balanced_parens", [["s", "String"]], "Bool", "Return whether the '(' and ')' characters in s are balanced. Ignore every other character.",
    [[["(a(b)c)"], true], [[")("], false], [[""], true], [["(()"], false]]),
  t("collatz_steps", [["n", "Int"]], "Int", "Starting from n >= 1, repeatedly halve even numbers and map odd numbers m to 3m + 1. Return how many steps it takes to reach 1.",
    [[[1], 0], [[6], 8], [[27], 111]]),
  t("binary_string", [["n", "Int"]], "String", "Return the binary representation of n >= 0 without leading zeros (\"0\" for 0).",
    [[[0], "0"], [[5], "101"], [[16], "10000"]]),
  t("mean_above", [["xs", "List[Float]"], ["limit", "Float"]], "Float", "Return the mean of the elements strictly greater than limit, or 0.0 if there are none.",
    [[[[1.0, 5.0, 7.0], 4.0], 6.0], [[[1.0], 2.0], 0.0]]),
  t("most_common_word", [["s", "String"]], "Option[String]", "Words in s are separated by single spaces. Return the most frequent word; on a tie, the one that appears first in s. Return nothing for the empty string.",
    [[["b a b a c"], "b"], [["x"], "x"], [[""], null], [["p q q"], "q"]]),
  t("triangle_numbers", [["n", "Int"]], "List[Int]", "Return the first n triangular numbers 1, 3, 6, 10, ... (n >= 0).",
    [[[4], [1, 3, 6, 10]], [[0], []]]),
  t("count_char", [["s", "String"], ["c", "String"]], "Int", "c is a single character. Count its occurrences in s.",
    [[["banana", "a"], 3], [["", "x"], 0], [["aaa", "b"], 0]]),
  t("safe_div", [["a", "Int"], ["b", "Int"]], "Option[Int]", "Return a divided by b, truncated toward zero, or nothing if b is 0.",
    [[[7, 2], 3], [[-7, 2], -3], [[1, 0], null]]),
  t("grade", [["score", "Int"]], "String", "Return the letter grade: \"A\" for 90 and above, \"B\" for 80-89, \"C\" for 70-79, \"D\" for 60-69, otherwise \"F\".",
    [[[95], "A"], [[80], "B"], [[79], "C"], [[60], "D"], [[12], "F"]]),
];

// ---------------------------------------------------------------------------
// Hard tier: user-defined records and sum types, Result-based error handling, multi-step logic.
// Result[T, String] is encoded in JSON (and TypeScript) as { ok: true, value } | { ok: false, error }.
// ---------------------------------------------------------------------------

const TS_RESULT = "type Result<T> = { ok: true; value: T } | { ok: false; error: string };";
const ok = (value: unknown) => ({ ok: true, value });
const err = (error: string) => ({ ok: false, error });

const h = (
  id: string,
  params: [string, string][],
  ret: string,
  desc: string,
  tests: [unknown[], unknown][],
  decls?: { canon: string; ts: string },
  typeKinds?: Record<string, "record" | "sum">,
): Task => ({ id, tier: "hard", fn: id, params, ret, desc, tests, decls, typeKinds });

const SHAPE = {
  canon: "type Shape =\n  | Circle(radius: Float)\n  | Rect(width: Float, height: Float)\n  | Triangle(base: Float, height: Float)",
  ts: 'type Shape =\n  | { kind: "Circle"; radius: number }\n  | { kind: "Rect"; width: number; height: number }\n  | { kind: "Triangle"; base: number; height: number };',
};
const OP = {
  canon: "type Op =\n  | Deposit(amount: Int)\n  | Withdraw(amount: Int)",
  ts: 'type Op = { kind: "Deposit"; amount: number } | { kind: "Withdraw"; amount: number };\n' + TS_RESULT,
};
const ITEM = {
  canon: "type Item {\n  sku: String,\n  qty: Int,\n  min: Int,\n}",
  ts: "type Item = { sku: string; qty: number; min: number };",
};
const USER = {
  canon: "type User {\n  name: String,\n  age: Int,\n  email: String,\n}",
  ts: "type User = { name: string; age: number; email: string };",
};
const STUDENT = {
  canon: "type Student {\n  name: String,\n  scores: List[Int],\n}",
  ts: "type Student = { name: string; scores: number[] };",
};
const RESULT_ONLY = { canon: "", ts: TS_RESULT };

const C = (radius: number) => ({ kind: "Circle", radius });
const R = (width: number, height: number) => ({ kind: "Rect", width, height });
const T = (base: number, height: number) => ({ kind: "Triangle", base, height });
const D = (amount: number) => ({ kind: "Deposit", amount });
const W = (amount: number) => ({ kind: "Withdraw", amount });

export const HARD_TASKS: Task[] = [
  h("total_area", [["shapes", "List[Shape]"]], "Float",
    "Return the total area of the shapes. A circle's area is 3.14159 * radius * radius; a rectangle's is width * height; a triangle's is base * height / 2.0.",
    [[[[C(1.0)]], 3.14159], [[[R(2.0, 3.0), T(4.0, 5.0)]], 16.0], [[[]], 0.0]], SHAPE, { Shape: "sum" }),
  h("parse_pairs", [["s", "String"]], "Result[List[(String, Int)], String]",
    "Items in s are separated by \";\". Each item must be key=value, with exactly one \"=\" and a value that is an integer (an optional leading minus sign, then digits). Return the (key, value) pairs in order. The empty string gives an empty list. If an item is invalid, return the error \"bad item: \" followed by the first invalid item.",
    [[["a=1;b=-2"], ok([["a", 1], ["b", -2]])], [[""], ok([])], [["a=1;oops;c=x"], err("bad item: oops")], [["k=v"], err("bad item: k=v")], [["a=1=2"], err("bad item: a=1=2")]],
    RESULT_ONLY, {}),
  h("restock", [["items", "List[Item]"]], "List[String]",
    "Return the skus of the items whose qty is below min, ordered by shortfall (min - qty) from largest to smallest; items with equal shortfall keep their input order.",
    [[[[{ sku: "a", qty: 1, min: 5 }, { sku: "b", qty: 0, min: 2 }, { sku: "c", qty: 9, min: 3 }, { sku: "d", qty: 2, min: 6 }]], ["a", "d", "b"]], [[[]], []]],
    ITEM, { Item: "record" }),
  h("apply_ops", [["balance", "Int"], ["ops", "List[Op]"]], "Result[Int, String]",
    "Apply the operations to the starting balance in order. A withdrawal larger than the current balance stops processing and returns the error \"insufficient funds at step N\", where N is the 1-based position of that operation. Otherwise return the final balance.",
    [[[10, [D(5), W(3)]], ok(12)], [[0, [W(1)]], err("insufficient funds at step 1")], [[5, [W(5), D(1), W(2), W(5)]], err("insufficient funds at step 3")], [[7, []], ok(7)]],
    OP, { Op: "sum" }),
  h("rpn", [["tokens", "List[String]"]], "Result[Int, String]",
    "Evaluate the tokens as a reverse Polish notation expression over integers. A token is an integer (an optional leading minus sign, then digits) or one of + - * /, where / divides and truncates toward zero. Process tokens left to right. Errors, as exact strings: \"stack underflow\" when an operator has fewer than two values to use, \"division by zero\", \"bad token: \" followed by the token for anything else, and \"expected one value\" if the stack does not hold exactly one value at the end.",
    [[[["3", "4", "+", "2", "*"]], ok(14)], [[["1", "+"]], err("stack underflow")], [[["4", "0", "/"]], err("division by zero")], [[["2", "x"]], err("bad token: x")], [[["1", "2"]], err("expected one value")], [[["7", "-2", "/"]], ok(-3)], [[[]], err("expected one value")]],
    RESULT_ONLY, {}),
  h("word_counts_sorted", [["s", "String"]], "List[(String, Int)]",
    "Words in s are separated by single spaces; the empty string has no words. Return each distinct word with its count, ordered by count from highest to lowest; words with equal counts keep the order of their first appearance.",
    [[["b a b c a b"], [["b", 3], ["a", 2], ["c", 1]]], [[""], []], [["x y"], [["x", 1], ["y", 1]]]]),
  h("transpose", [["m", "List[List[Int]]"]], "List[List[Int]]",
    "Return the transpose of the rectangular matrix m (a list of rows). An empty matrix gives an empty list.",
    [[[[[1, 2, 3], [4, 5, 6]]], [[1, 4], [2, 5], [3, 6]]], [[[]], []], [[[[7]]], [[7]]]]),
  h("run_lengths", [["s", "String"]], "List[(String, Int)]",
    "Split s into runs of the same character and return each run's character and length, in order.",
    [[["aaabcc"], [["a", 3], ["b", 1], ["c", 2]]], [[""], []], [["abab"], [["a", 1], ["b", 1], ["a", 1], ["b", 1]]]]),
  h("validate_user", [["u", "User"]], "List[String]",
    "Return the user's problems, in this order: \"name is empty\" if the name is the empty string; \"age out of range\" if age is below 0 or above 150; \"email must contain @\" if the email has no @ character. Return an empty list for a valid user.",
    [[[{ name: "ann", age: 30, email: "a@x" }], []], [[{ name: "", age: 200, email: "nope" }], ["name is empty", "age out of range", "email must contain @"]], [[{ name: "bo", age: -1, email: "b@y" }], ["age out of range"]]],
    USER, { User: "record" }),
  h("report_card", [["students", "List[Student]"]], "List[(String, String)]",
    "For each student, in order, compute the average score as the sum divided by the count, truncated toward zero (0 when there are no scores), and give a letter grade: \"A\" for 90 and above, \"B\" for 80-89, \"C\" for 70-79, \"D\" for 60-69, otherwise \"F\". Return (name, grade) pairs.",
    [[[[{ name: "ann", scores: [90, 95] }, { name: "bo", scores: [] }, { name: "cy", scores: [70, 79, 81] }]], [["ann", "A"], ["bo", "F"], ["cy", "C"]]]],
    STUDENT, { Student: "record" }),
];

export const TASKS: Task[] = [...BASIC_TASKS, ...HARD_TASKS];
