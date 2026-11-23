/**
 * Experiment 1: 60 hard tasks (multi-step logic, edge cases, exact formats and error strings).
 * Same Task interface and value encoding as the benchmark's hard tier: Result[T, String] is
 * { ok: true, value } | { ok: false, error }; a record is a plain object; a sum is { kind, ...fields }.
 * Reference solutions in both languages: reference-ts.ts and reference-canon.ts (see validate-tasks.ts).
 */
import type { Task } from "../../benchmark/src/tasks.js";

const TS_RESULT = "type Result<T> = { ok: true; value: T } | { ok: false; error: string };";
const ok = (value: unknown) => ({ ok: true, value });
const err = (error: string) => ({ ok: false, error });
const RESULT_ONLY = { canon: "", ts: TS_RESULT };
const h = (
  id: string,
  params: [string, string][],
  ret: string,
  desc: string,
  tests: [unknown[], unknown][],
  decls?: { canon: string; ts: string },
  typeKinds?: Record<string, "record" | "sum">,
): Task => ({ id, tier: "hard", fn: id, params, ret, desc, tests, decls, typeKinds });

// ---------------------------------------------------------------------------
// Part 1: Text processing and parsing
// ---------------------------------------------------------------------------

const P1: Task[] = [
  h("caesar_shift", [["s", "String"], ["k", "Int"]], "String",
    "Shift every lowercase letter a-z in s forward by k positions in the alphabet, wrapping around from z to a. k may be negative (shift backward) and may be larger than 26 in either direction. Every other character (uppercase letters, digits, spaces, punctuation) is unchanged.",
    [[["abc", 1], "bcd"], [["xyz", 3], "abc"], [["Hello, World!", 1], "Hfmmp, Wpsme!"], [["abc", -1], "zab"], [["abc", 52], "abc"], [["", 5], ""], [["a-z", -27], "z-y"], [["hello", 13], "uryyb"]]),
  h("wrap_text", [["s", "String"], ["width", "Int"]], "List[String]",
    "Words in s are separated by one or more spaces; leading and trailing spaces are ignored. width >= 1. Wrap the words into lines greedily: words on a line are separated by single spaces, and the next word is added to the current line if the line's length afterwards is at most width; otherwise that word starts a new line. A word longer than width is never split: it goes on its own line (the line before it ends, and the next word starts a new line). Return the lines in order; if s has no words, return an empty list.",
    [[["the quick brown fox", 10], ["the quick", "brown fox"]], [["  a  b   c ", 3], ["a b", "c"]], [["", 5], []], [["    ", 4], []], [["hello", 5], ["hello"]], [["a verylongword b", 4], ["a", "verylongword", "b"]], [["aa bb cc dd", 5], ["aa bb", "cc dd"]], [["one two", 1], ["one", "two"]]]),
  h("align_columns", [["rows", "List[List[String]]"]], "List[String]",
    "rows is a table whose rows may have different numbers of cells. The width of column j is the length of the longest cell at position j over all rows that have such a cell. Render each row from its own cells only (a row never gets extra cells): pad each cell on the right with spaces to its column's width, join the padded cells with \" | \", then remove every trailing space from the end of the line (leading spaces stay). A row with no cells renders as \"\". Return one line per row, in order.",
    [[[[["name", "age"], ["bob", "7"], ["alexandra", "30"]]], ["name      | age", "bob       | 7", "alexandra | 30"]], [[[]], []], [[[["a", "bb", "c"], ["ddd"]]], ["a   | bb | c", "ddd"]], [[[["x", ""], ["yy", "z"]]], ["x  |", "yy | z"]], [[[[], ["a"]]], ["", "a"]], [[[["", "a"], ["b"]]], ["  | a", "b"]], [[[["abc"], ["d"]]], ["abc", "d"]]]),
  h("rle_compress", [["s", "String"]], "String",
    "Run-length encode s: replace each maximal run of one repeated character by that character, followed by the run's length written in decimal only when the run is 2 or longer (\"aaabcc\" becomes \"a3bc2\"). If the encoded string is not strictly shorter than s, return s unchanged.",
    [[["aaabcc"], "a3bc2"], [[""], ""], [["abc"], "abc"], [["aabb"], "aabb"], [["aab"], "aab"], [["aaaaaaaaaaaa"], "a12"], [["zzzzzzzzzzzaab"], "z11a2b"], [["   x"], " 3x"], [["aaabbbcccd"], "a3b3c3d"]]),
  h("rle_decode", [["s", "String"]], "Result[String, String]",
    "Decode a run-length encoded string. s is a sequence of groups; each group is one non-digit character followed by an optional count made of one or more decimal digits 0-9. A group with no count stands for its character once; otherwise for its character repeated count times. Return the decoded string (\"\" decodes to \"\"). Errors: if s starts with a digit, return \"missing character before count\"; if a count starts with the digit 0 (such as \"0\" or \"05\"), return \"bad count for X\", where X is that group's character. Report the first error from the left.",
    [[["a3bc2"], ok("aaabcc")], [[""], ok("")], [["x12"], ok("xxxxxxxxxxxx")], [["3a"], err("missing character before count")], [["ab0"], err("bad count for b")], [["a05"], err("bad count for a")], [[" 2-3"], ok("  ---")], [["a1b1"], ok("ab")], [["a2b03c0"], err("bad count for b")]],
    RESULT_ONLY, {}),
  h("pig_latin", [["s", "String"]], "String",
    "s holds lowercase words separated by single spaces (s may be \"\", giving \"\"). Translate each word and rejoin with single spaces. The letters a, e, i, o and u are vowels, with two exceptions: a \"u\" directly after a \"q\" is not a vowel, and \"y\" is a vowel except when it is the first letter of the word. If the word starts with a vowel, append \"way\". Otherwise move the letters before the first vowel to the end of the word and append \"ay\". If the word has no vowel at all, just append \"ay\".",
    [[["the quick brown fox"], "ethay ickquay ownbray oxfay"], [["yellow rhythm my"], "ellowyay ythmrhay ymay"], [["apple squeal"], "appleway ealsquay"], [[""], ""], [["nth y"], "nthay yay"], [["queen u"], "eenquay uway"], [["aqua"], "aquaway"], [["qu xyz"], "quay yzxay"]]),
  h("roman_to_int", [["s", "String"]], "Result[Int, String]",
    "Convert a Roman numeral to an integer. Symbols: I=1, V=5, X=10, L=50, C=100, D=500, M=1000 (uppercase only). The value is the sum of the symbols' values, except that a symbol whose value is smaller than the value of the symbol right after it is subtracted instead of added. Errors, checked in this order: \"empty\" if s is \"\"; \"invalid character: C\" for the first character C that is not one of the seven symbols; \"not canonical\" if the value is not between 1 and 3999 or s is not exactly the standard form of its value. The standard form of n writes it greedily with M=1000, CM=900, D=500, CD=400, C=100, XC=90, L=50, XL=40, X=10, IX=9, V=5, IV=4, I=1 (taking the largest that fits each time), e.g. 1994 is MCMXCIV.",
    [[["MCMXCIV"], ok(1994)], [["III"], ok(3)], [["MMMCMXCIX"], ok(3999)], [[""], err("empty")], [["IIII"], err("not canonical")], [["IC"], err("not canonical")], [["MXQ"], err("invalid character: Q")], [["iv"], err("invalid character: i")], [["XLII"], ok(42)], [["MMMM"], err("not canonical")]],
    RESULT_ONLY, {}),
  h("anagram_groups", [["words", "List[String]"]], "List[List[String]]",
    "Two words are anagrams if one is a rearrangement of the other's characters (the same characters with the same counts; identical words are anagrams). Partition words into classes of mutual anagrams. Return only the classes with at least two words, ordered by the position in words of each class's first word; within a class keep the input order. A word that occurs several times counts as several members.",
    [[[["eat", "tea", "tan", "ate", "nat", "bat"]], [["eat", "tea", "ate"], ["tan", "nat"]]], [[[]], []], [[["abc"]], []], [[["ab", "ab"]], [["ab", "ab"]]], [[["a", "b", "c"]], []], [[["listen", "x", "silent", "enlist", "y", "x"]], [["listen", "silent", "enlist"], ["x", "x"]]], [[["", ""]], [["", ""]]], [[["ab", "ba", "abb", "bab"]], [["ab", "ba"], ["abb", "bab"]]]]),
  h("find_all", [["s", "String"], ["pat", "String"]], "List[Int]",
    "Return the 0-based start positions of every occurrence of pat in s, in increasing order, including occurrences that overlap each other. If pat is the empty string, return an empty list.",
    [[["aaaa", "aa"], [0, 1, 2]], [["abcabc", "abc"], [0, 3]], [["abc", ""], []], [["", "a"], []], [["abc", "abcd"], []], [["abababa", "aba"], [0, 2, 4]], [["hello", "o"], [4]], [["x", "x"], [0]]]),
  h("heading_numbers", [["lines", "List[String]"]], "List[String]",
    "Number the Markdown headings in lines. A heading line is 1 to 3 \"#\" characters at the very start, then a single space, then a non-empty title (everything after that space, taken as is). Every other line is ignored, including \"#NoSpace\", \"#### Four\" (4 or more \"#\") and \"# \" (empty title). Keep counters for levels 1, 2 and 3, all starting at 0. For a heading of level L, add 1 to counter L and reset the counters of all deeper levels to 0; then output the counters of levels 1 through L joined by \".\", a space, and the title. For example, a level-3 heading right after the first level-1 heading is numbered \"1.0.1\". Return the outputs in order.",
    [[[["# Intro", "text", "## Setup", "## Usage", "### Flags", "# API"]], ["1 Intro", "1.1 Setup", "1.2 Usage", "1.2.1 Flags", "2 API"]], [[[]], []], [[["### Deep", "# Top", "### Deeper"]], ["0.0.1 Deep", "1 Top", "1.0.1 Deeper"]], [[["#NoSpace", "#### Four", "# ", "plain"]], []], [[["## A", "## B", "# C", "## D"]], ["0.1 A", "0.2 B", "1 C", "1.1 D"]], [[["# A", "### B", "## C", "### D"]], ["1 A", "1.0.1 B", "1.1 C", "1.1.1 D"]], [[["# Title with # hash", " # indented"]], ["1 Title with # hash"]]]),
  h("parse_duration", [["s", "String"]], "Result[Int, String]",
    "Parse a duration such as \"1h30m15s\" into a number of seconds. s is one or more components; each component is one or more decimal digits (leading zeros allowed) followed by a unit letter: h (3600 seconds), m (60) or s (1). Units must appear in the order h, m, s, each at most once; any of them may be omitted. Errors: \"empty\" for the empty string. Otherwise scan s from left to right; at each character that is not a digit, check in this order: \"unknown unit: X\" if X is not h, m or s; \"missing number before X\" if no digits come directly before X; \"unit out of order: X\" if unit X is not later in the order h, m, s than every unit seen before. If s ends with digits that have no unit, return \"missing unit\". Report the first error found.",
    [[["1h30m15s"], ok(5415)], [["2h5s"], ok(7205)], [[""], err("empty")], [["10"], err("missing unit")], [["m"], err("missing number before m")], [["5m3h"], err("unit out of order: h")], [["1h2h"], err("unit out of order: h")], [["3d"], err("unknown unit: d")], [["90m"], ok(5400)], [["0h05m"], ok(300)]],
    RESULT_ONLY, {}),
  h("parse_csv_line", [["s", "String"]], "Result[List[String], String]",
    "Split one CSV line into fields separated by commas. A field that begins with a double quote is quoted: it runs to the matching closing double quote, may contain commas, and inside it two double quotes in a row stand for one double quote character; the quotes around it are not part of the value. Any other field is unquoted: its value is all its characters up to the next comma or the end (spaces kept). The empty string is one empty field, and a trailing comma gives a final empty field. Errors (positions are 0-based indexes into s; report the first error from the left): \"unexpected quote at N\" for a double quote inside an unquoted field (anywhere but its first character); \"expected comma at N\" for any character other than a comma right after a quoted field's closing quote; \"unterminated quote\" if a quoted field has no closing quote.",
    [[["a,b,c"], ok(["a", "b", "c"])], [[""], ok([""])], [["a,,"], ok(["a", "", ""])], [["\"x,y\",z"], ok(["x,y", "z"])], [["\"say \"\"hi\"\"\""], ok(["say \"hi\""])], [["\"abc"], err("unterminated quote")], [["ab\"c"], err("unexpected quote at 2")], [["\"ab\"c,d"], err("expected comma at 4")], [["\"\",x"], ok(["", "x"])], [[" a , b "], ok([" a ", " b "])]],
    RESULT_ONLY, {}),
  h("parse_ipv4", [["s", "String"]], "Result[Int, String]",
    "Parse a dotted IPv4 address. Split s on \".\": if that does not give exactly 4 parts, return \"expected 4 parts\". Each part must be 1 to 3 decimal digits (no signs or other characters), must not have a leading zero unless it is exactly \"0\", and must be at most 255. Otherwise return \"bad part: P\" for the first invalid part P, in order (P may be empty). For parts a, b, c, d return a*16777216 + b*65536 + c*256 + d.",
    [[["192.168.1.1"], ok(3232235777)], [["0.0.0.0"], ok(0)], [["255.255.255.255"], ok(4294967295)], [["1.2.3"], err("expected 4 parts")], [["1.2.3.4.5"], err("expected 4 parts")], [["1.2..4"], err("bad part: ")], [["01.2.3.4"], err("bad part: 01")], [["1.256.3.999"], err("bad part: 256")], [["1.2.3.+4"], err("bad part: +4")], [[""], err("expected 4 parts")]],
    RESULT_ONLY, {}),
  h("compare_versions", [["a", "String"], ["b", "String"]], "Result[Int, String]",
    "A version is 1 to 4 parts separated by dots, each part one or more decimal digits (leading zeros allowed: \"01\" means 1). If a is not a valid version return \"bad version: \" followed by a; otherwise if b is not valid return \"bad version: \" followed by b. Compare the versions part by part from the left as numbers, treating missing parts as 0 (so \"1.0\" equals \"1\"). Return -1 if a is lower, 1 if a is higher, 0 if they are equal.",
    [[["1.2.3", "1.2.10"], ok(-1)], [["1.0", "1"], ok(0)], [["2", "1.9.9.9"], ok(1)], [["1.01", "1.1"], ok(0)], [["1.2.3.4.5", "1"], err("bad version: 1.2.3.4.5")], [["1.2", "1..2"], err("bad version: 1..2")], [["", "1"], err("bad version: ")], [["x", "y"], err("bad version: x")], [["0.0.0.1", "0"], ok(1)], [["10.0", "9.99"], ok(1)]],
    RESULT_ONLY, {}),
  h("parse_money", [["s", "String"]], "Result[Int, String]",
    "Parse an amount like \"$1,234.56\" into cents. Format: an optional \"-\", then \"$\", then the dollars, then optionally a \".\" followed by exactly two digits of cents. The dollars are one or more decimal digits, either with no commas, or grouped as 1 to 3 digits followed by one or more groups of a comma and exactly 3 digits; ignoring commas, the dollars may not start with 0 unless they are exactly \"0\". Return dollars * 100 + cents, negated if there is a \"-\". Errors, checked in this order: \"missing $\" if the character after the optional \"-\" is not \"$\" (or there is none); \"bad cents\" if s contains a \".\" and the text after the first \".\" is not exactly two digits; \"bad dollars\" if the text between \"$\" and the first \".\" (or the end) is not valid dollars.",
    [[["$1,234.56"], ok(123456)], [["-$12"], ok(-1200)], [["$1,234,567.00"], ok(123456700)], [["1.00"], err("missing $")], [["$1.5"], err("bad cents")], [["$12,34"], err("bad dollars")], [["$0012"], err("bad dollars")], [["$"], err("bad dollars")], [["-$0.05"], ok(-5)], [["$1.2.3"], err("bad cents")]],
    RESULT_ONLY, {}),
];

// ---------------------------------------------------------------------------
// Part 2: Parsing and state machines over sum types
// ---------------------------------------------------------------------------

const P2_TOKEN = {
  canon: "type Token =\n  | Num(value: Int)\n  | Ident(name: String)\n  | Sym(text: String)",
  ts: 'type Token =\n  | { kind: "Num"; value: number }\n  | { kind: "Ident"; name: string }\n  | { kind: "Sym"; text: string };\n' + TS_RESULT,
};
const P2_SETTING = {
  canon: "type Setting {\n  section: String,\n  key: String,\n  value: String,\n}",
  ts: "type Setting = { section: string; key: string; value: string };\n" + TS_RESULT,
};
const P2_EVENT = {
  canon: "type Event =\n  | Coin(cents: Int)\n  | Select(price: Int)\n  | Refund",
  ts: 'type Event = { kind: "Coin"; cents: number } | { kind: "Select"; price: number } | { kind: "Refund" };',
};
const P2_KEY = {
  canon: "type Key =\n  | Digit(d: Int)\n  | Enter\n  | Clear",
  ts: 'type Key = { kind: "Digit"; d: number } | { kind: "Enter" } | { kind: "Clear" };',
};
const P2_INSTR = {
  canon:
    "type Instr =\n  | Push(n: Int)\n  | Pop\n  | Add\n  | Sub\n  | Mul\n  | Dup\n  | Swap\n  | Jz(target: Int)\n  | Jmp(target: Int)\n  | Print\n  | Halt",
  ts:
    'type Instr =\n  | { kind: "Push"; n: number }\n  | { kind: "Pop" }\n  | { kind: "Add" }\n  | { kind: "Sub" }\n  | { kind: "Mul" }\n  | { kind: "Dup" }\n  | { kind: "Swap" }\n  | { kind: "Jz"; target: number }\n  | { kind: "Jmp"; target: number }\n  | { kind: "Print" }\n  | { kind: "Halt" };\n' +
    TS_RESULT,
};
const P2_EDIT = {
  canon: "type EditOp =\n  | Insert(text: String)\n  | Delete(n: Int)\n  | Left(n: Int)\n  | Right(n: Int)\n  | Undo",
  ts: 'type EditOp =\n  | { kind: "Insert"; text: string }\n  | { kind: "Delete"; n: number }\n  | { kind: "Left"; n: number }\n  | { kind: "Right"; n: number }\n  | { kind: "Undo" };',
};
const P2_ORDER = {
  canon: "type OrderEvent =\n  | Create(id: String)\n  | Pay(id: String)\n  | Ship(id: String)\n  | Cancel(id: String)",
  ts: 'type OrderEvent =\n  | { kind: "Create"; id: string }\n  | { kind: "Pay"; id: string }\n  | { kind: "Ship"; id: string }\n  | { kind: "Cancel"; id: string };\n' + TS_RESULT,
};
const P2_CMD = {
  canon: "type Cmd =\n  | Forward(steps: Int)\n  | TurnLeft\n  | TurnRight",
  ts: 'type Cmd = { kind: "Forward"; steps: number } | { kind: "TurnLeft" } | { kind: "TurnRight" };',
};
const P2_BANK = {
  canon:
    "type BankOp =\n  | Open(name: String)\n  | Deposit(name: String, amount: Int)\n  | Withdraw(name: String, amount: Int)\n  | Transfer(src: String, dst: String, amount: Int)",
  ts:
    'type BankOp =\n  | { kind: "Open"; name: string }\n  | { kind: "Deposit"; name: string; amount: number }\n  | { kind: "Withdraw"; name: string; amount: number }\n  | { kind: "Transfer"; src: string; dst: string; amount: number };\n' +
    TS_RESULT,
};
const P2_PARK = {
  canon: "type Park =\n  | Arrive(plate: String, minute: Int)\n  | Leave(plate: String, minute: Int)",
  ts: 'type Park = { kind: "Arrive"; plate: string; minute: number } | { kind: "Leave"; plate: string; minute: number };',
};

const P2_num = (value: number) => ({ kind: "Num", value });
const P2_id = (name: string) => ({ kind: "Ident", name });
const P2_sym = (text: string) => ({ kind: "Sym", text });
const P2_set = (section: string, key: string, value: string) => ({ section, key, value });
const P2_coin = (cents: number) => ({ kind: "Coin", cents });
const P2_sel = (price: number) => ({ kind: "Select", price });
const P2_REFUND = { kind: "Refund" };
const P2_dg = (...ds: number[]) => ds.map((d) => ({ kind: "Digit", d }));
const P2_ENTER = { kind: "Enter" };
const P2_CLEAR = { kind: "Clear" };
const P2_push = (n: number) => ({ kind: "Push", n });
const P2_op = (kind: string) => ({ kind });
const P2_jz = (target: number) => ({ kind: "Jz", target });
const P2_jmp = (target: number) => ({ kind: "Jmp", target });
const P2_ins = (text: string) => ({ kind: "Insert", text });
const P2_del = (n: number) => ({ kind: "Delete", n });
const P2_left = (n: number) => ({ kind: "Left", n });
const P2_right = (n: number) => ({ kind: "Right", n });
const P2_UNDO = { kind: "Undo" };
const P2_oe = (kind: string, id: string) => ({ kind, id });
const P2_fwd = (steps: number) => ({ kind: "Forward", steps });
const P2_TL = { kind: "TurnLeft" };
const P2_TR = { kind: "TurnRight" };
const P2_open = (name: string) => ({ kind: "Open", name });
const P2_dep = (name: string, amount: number) => ({ kind: "Deposit", name, amount });
const P2_wd = (name: string, amount: number) => ({ kind: "Withdraw", name, amount });
const P2_tr = (src: string, dst: string, amount: number) => ({ kind: "Transfer", src, dst, amount });
const P2_arr = (plate: string, minute: number) => ({ kind: "Arrive", plate, minute });
const P2_lv = (plate: string, minute: number) => ({ kind: "Leave", plate, minute });

const P2: Task[] = [
  h("eval_expr", [["s", "String"]], "Result[Int, String]",
    "Evaluate an integer arithmetic expression. First remove every space character from s; parse what remains. Grammar: expr = term, then zero or more of (\"+\" or \"-\") term; term = factor, then zero or more of (\"*\" or \"/\") factor; factor = a number (one or more decimal digits) or \"(\" expr \")\". Operators of equal precedence group left to right; \"/\" divides and truncates toward zero. There is no unary minus. Syntax errors take priority: scanning left to right, at the first point where the next character cannot continue a valid expression, return the error \"unexpected end\" if the input has run out there, or \"unexpected character: \" followed by that character otherwise (this includes characters left over after a complete expression). Only if the whole input is syntactically valid, evaluate it; if any division has a right operand that evaluates to 0, return the error \"division by zero\".",
    [
      [["2+3*4"], ok(14)],
      [[" ( 2+3 ) * 4 "], ok(20)],
      [["20-3-2*2"], ok(13)],
      [["(1-10)/4"], ok(-2)],
      [[""], err("unexpected end")],
      [["2*(3+4"], err("unexpected end")],
      [["2+*3"], err("unexpected character: *")],
      [["4/(2-2)"], err("division by zero")],
      [["4/0+)"], err("unexpected character: )")],
      [["(1)2"], err("unexpected character: 2")],
    ],
    RESULT_ONLY, {}),
  h("tokenize", [["s", "String"]], "Result[List[Token], String]",
    "Split s into tokens, scanning left to right. A space character separates tokens and produces nothing. A maximal run of decimal digits is a Num whose value is that number (leading zeros allowed). An identifier starts with a lowercase letter a-z or \"_\" and continues with as many lowercase letters, digits and \"_\" as possible; it is an Ident. Symbols are Sym tokens: first try the two-character symbols \"==\", \"<=\", \">=\" and \"!=\", then the one-character symbols + - * / = < > ( ) and \",\". A digit run stops at the first non-digit, so \"12ab\" is Num 12 then Ident \"ab\". Any other character (including uppercase letters, tabs and a lone \"!\") gives the error \"unexpected character: C at N\", where C is the character and N its 0-based position in s.",
    [
      [["x = 42"], ok([P2_id("x"), P2_sym("="), P2_num(42)])],
      [[""], ok([])],
      [["a<=b!=c"], ok([P2_id("a"), P2_sym("<="), P2_id("b"), P2_sym("!="), P2_id("c")])],
      [["12ab"], ok([P2_num(12), P2_id("ab")])],
      [["f(x_1, 007)"], ok([P2_id("f"), P2_sym("("), P2_id("x_1"), P2_sym(","), P2_num(7), P2_sym(")")])],
      [["<<==>"], ok([P2_sym("<"), P2_sym("<="), P2_sym("="), P2_sym(">")])],
      [["_ 9"], ok([P2_id("_"), P2_num(9)])],
      [["a ! b"], err("unexpected character: ! at 2")],
      [["count = Max"], err("unexpected character: M at 8")],
      [["x;1"], err("unexpected character: ; at 1")],
    ],
    P2_TOKEN, { Token: "sum" }),
  h("parse_config", [["lines", "List[String]"]], "Result[List[Setting], String]",
    "Parse INI-style configuration lines. Trim each line (remove leading and trailing whitespace) before looking at it. Skip a line that is then empty or starts with \"#\". A line starting with \"[\" is a section header: it must end with \"]\" and the text between the brackets, trimmed, must be non-empty; that trimmed text becomes the current section. Any other line is a setting: it must contain \"=\"; the key is the text before the first \"=\", trimmed, and the value is everything after the first \"=\", trimmed (it may contain more \"=\" characters, and may be empty). The key must not be empty. Settings before any header belong to section \"\". Return the settings in order of first appearance; if a (section, key) pair appears again (even after switching to another section and back), replace its value but keep its original position. Stop at the first bad line with the error \"line N: bad header\", \"line N: missing =\" or \"line N: empty key\", where N is the 1-based line number.",
    [
      [[["name = app", "[db]", "host = localhost", "port=5432"]], ok([P2_set("", "name", "app"), P2_set("db", "host", "localhost"), P2_set("db", "port", "5432")])],
      [[[]], ok([])],
      [[["# c", "", "[a]", "x = 1", "y = 2", "  x = 3  "]], ok([P2_set("a", "x", "3"), P2_set("a", "y", "2")])],
      [[["[a]", "k=1", "[b]", "k=2", "[a]", "k=3", "j=4"]], ok([P2_set("a", "k", "3"), P2_set("b", "k", "2"), P2_set("a", "j", "4")])],
      [[["url = a=b", "empty ="]], ok([P2_set("", "url", "a=b"), P2_set("", "empty", "")])],
      [[["  # indented comment", "[ s p ]", "k = v"]], ok([P2_set("s p", "k", "v")])],
      [[["[a]", "k=1", "[ ]"]], err("line 3: bad header")],
      [[["[a"]], err("line 1: bad header")],
      [[["k=1", "", "novalue"]], err("line 3: missing =")],
      [[[" = 5"]], err("line 1: empty key")],
    ],
    P2_SETTING, { Setting: "record" }),
  h("bracket_depth", [["s", "String"]], "Result[Int, String]",
    "Check the brackets ( ) [ ] { } in s; every other character is ignored. Each closing bracket must match the most recent unclosed opening bracket of the same kind. Return the maximum nesting depth (0 if there are no brackets; \"([])\" has depth 2). Scanning left to right, if a closing bracket does not match (or nothing is open), return the error \"mismatch at N\", where N is its 0-based position in s. If the scan finishes with brackets still open, return the error \"unclosed at end\".",
    [
      [[""], ok(0)],
      [["abc"], ok(0)],
      [["a(b[c]{d})"], ok(2)],
      [["([{}])"], ok(3)],
      [["{[()()]}()"], ok(3)],
      [["(]"], err("mismatch at 1")],
      [["())"], err("mismatch at 2")],
      [["(("], err("unclosed at end")],
      [["x)("], err("mismatch at 1")],
      [["(()"], err("unclosed at end")],
    ],
    RESULT_ONLY, {}),
  h("parse_query", [["s", "String"]], "Result[List[(String, String)], String]",
    "Parse a URL query string. Split s on \"&\" into items and skip empty items (from \"&&\" or a leading or trailing \"&\"). In each item, the key is the text before the first \"=\" and the value is everything after it (it may contain more \"=\"); an item with no \"=\" is a key with value \"\". Then replace every \"+\" with a space in both key and value. If a decoded key is empty, stop and return the error \"empty key: \" followed by the original item. Return the (key, value) pairs in order, keeping duplicates.",
    [
      [["a=1&b=2"], ok([["a", "1"], ["b", "2"]])],
      [[""], ok([])],
      [["a=1&b=&c"], ok([["a", "1"], ["b", ""], ["c", ""]])],
      [["&&x=1&"], ok([["x", "1"]])],
      [["q=hello+world&x=a=b"], ok([["q", "hello world"], ["x", "a=b"]])],
      [["a=1&a=2"], ok([["a", "1"], ["a", "2"]])],
      [["+=+"], ok([[" ", " "]])],
      [["a=1&=2"], err("empty key: =2")],
      [["k=1&=&j"], err("empty key: =")],
    ],
    RESULT_ONLY, {}),
  h("flatten_nested", [["s", "String"]], "Result[(List[Int], Int), String]",
    "s holds a nested list of integers such as \"[1,[2,-3],[]]\". First remove every space character. The rest must be exactly one list: list = \"[\" then either \"]\" or element, zero or more of (\",\" element), then \"]\"; element = integer or list; integer = an optional \"-\" followed by one or more decimal digits. Return the integers in left-to-right order, paired with the maximum nesting depth of lists (the outer list has depth 1). If the text is not valid, return the error \"invalid at N\", where N is the 0-based position (in the text with spaces removed) of the first character that cannot continue a valid input, or the length of that text if it ends too early.",
    [
      [["[1,[2,-3],[]]"], ok([[1, 2, -3], 2])],
      [["[]"], ok([[], 1])],
      [[" [ [ [ 7 ] ] , 8 ] "], ok([[7, 8], 3])],
      [["[[],[[]]]"], ok([[], 3])],
      [["[007,-10]"], ok([[7, -10], 1])],
      [["[1,]"], err("invalid at 3")],
      [["[1]]"], err("invalid at 3")],
      [[""], err("invalid at 0")],
      [["[1,[2]"], err("invalid at 6")],
      [["[-,1]"], err("invalid at 2")],
    ],
    RESULT_ONLY, {}),
  h("vending_machine", [["events", "List[Event]"]], "List[String]",
    "Simulate a vending machine that holds a credit, starting at 0, and return the messages it prints, in order. Coin(c): if c is 5, 10, 25 or 100, add it to the credit and print nothing; otherwise print \"reject C\" (C is the coin value) and do not add it. Select(p): if the credit is at least p, print \"vend P change X\" where X is credit minus p, and set the credit to 0; otherwise print \"insufficient X\" where X is the current credit, and keep the credit. Refund: if the credit is above 0, print \"refund X\" and set it to 0; if it is 0, print nothing. After the last event, if the credit is above 0, print \"refund X\" for it.",
    [
      [[[P2_coin(25), P2_coin(25), P2_coin(25), P2_sel(65)]], ["vend 65 change 10"]],
      [[[]], []],
      [[[P2_coin(3), P2_coin(10), P2_sel(15), P2_coin(5), P2_sel(15)]], ["reject 3", "insufficient 10", "vend 15 change 0"]],
      [[[P2_coin(100), P2_REFUND, P2_REFUND]], ["refund 100"]],
      [[[P2_coin(10), P2_coin(50)]], ["reject 50", "refund 10"]],
      [[[P2_sel(5)]], ["insufficient 0"]],
      [[[P2_coin(100), P2_sel(30), P2_sel(30)]], ["vend 30 change 70", "insufficient 0"]],
      [[[P2_coin(25), P2_sel(25), P2_coin(5)]], ["vend 25 change 0", "refund 5"]],
    ],
    P2_EVENT, { Event: "sum" }),
  h("door_lock", [["code", "String"], ["events", "List[Key]"]], "String",
    "Simulate a keypad lock. code is a non-empty string of decimal digits. The lock starts \"locked\" with an empty entry buffer and a failure count of 0. While \"locked\": Digit(d) appends the digit d (0-9) to the buffer, but the buffer holds at most as many digits as code has, so when it is full the oldest digit is dropped first; Clear empties the buffer; Enter compares the buffer with code: if equal, the lock becomes \"open\" and the failure count resets to 0, otherwise the failure count goes up by 1 and, when it reaches 3, the lock becomes \"blocked\". Enter always empties the buffer. Clear does not reset the failure count. While \"open\": Enter makes it \"locked\" again (buffer empty, failure count still 0); Digit and Clear are ignored. While \"blocked\": every key is ignored. Return the final state: \"locked\", \"open\" or \"blocked\".",
    [
      [["123", [...P2_dg(1, 2, 3), P2_ENTER]], "open"],
      [["123", []], "locked"],
      [["123", [...P2_dg(9, 1, 2, 3), P2_ENTER]], "open"],
      [["123", [...P2_dg(1, 2), P2_ENTER, ...P2_dg(1, 2, 4), P2_ENTER, P2_ENTER]], "blocked"],
      [["123", [...P2_dg(1), P2_ENTER, ...P2_dg(1, 2, 3), P2_ENTER, ...P2_dg(9), P2_ENTER]], "locked"],
      [["123", [...P2_dg(1, 2), P2_CLEAR, ...P2_dg(3), P2_ENTER]], "locked"],
      [["123", [P2_ENTER, P2_ENTER, ...P2_dg(1, 2, 3), P2_ENTER, P2_ENTER, P2_ENTER, P2_ENTER]], "locked"],
      [["123", [P2_ENTER, P2_ENTER, P2_ENTER, ...P2_dg(1, 2, 3), P2_ENTER]], "blocked"],
      [["007", [...P2_dg(0, 0, 7), P2_ENTER]], "open"],
      [["12", [P2_ENTER, P2_CLEAR, ...P2_dg(1, 2), P2_ENTER, P2_ENTER, P2_ENTER, P2_ENTER, ...P2_dg(1, 2), P2_ENTER]], "open"],
    ],
    P2_KEY, { Key: "sum" }),
  h("stack_vm", [["prog", "List[Instr]"]], "Result[List[Int], String]",
    "Run a stack machine program and return the values it prints. Start with an empty stack at instruction 0. Push(n) pushes n. Pop removes the top value. Add, Sub and Mul pop the top value b, then the next value a, and push a + b, a - b or a * b. Dup pushes a copy of the top value. Swap exchanges the top two values. Print pops the top value and appends it to the output. Jz(t) pops the top value and jumps to instruction t if it is 0, else continues with the next instruction. Jmp(t) jumps to instruction t. Halt stops. Running past the last instruction also stops. Return the output when the program stops. Errors, where N is the 0-based index of the instruction being executed: \"stack underflow at N\" if it needs more values than the stack holds (Pop, Dup, Print and Jz need 1; Add, Sub, Mul and Swap need 2); \"bad jump at N\" if a Jz or Jmp has a target outside 0 to (number of instructions - 1), checked every time it executes, whether or not the jump would be taken, and after the underflow check; \"step limit exceeded\" if the program is about to execute an instruction after 1000 instructions have already been executed.",
    [
      [[[P2_push(2), P2_push(3), P2_op("Add"), P2_op("Print")]], ok([5])],
      [[[]], ok([])],
      [[[P2_push(5), P2_push(3), P2_op("Sub"), P2_op("Print"), P2_push(4), P2_push(10), P2_op("Swap"), P2_op("Sub"), P2_op("Print")]], ok([2, 6])],
      [[[P2_push(3), P2_op("Dup"), P2_op("Print"), P2_push(1), P2_op("Sub"), P2_op("Dup"), P2_jz(8), P2_jmp(1), P2_op("Halt"), P2_push(99), P2_op("Print")]], ok([3, 2, 1])],
      [[[P2_push(7), P2_op("Halt"), P2_op("Print")]], ok([])],
      [[[P2_push(6), P2_op("Dup"), P2_op("Mul"), P2_op("Print"), P2_push(1), P2_op("Pop")]], ok([36])],
      [[[P2_push(1), P2_op("Add")]], err("stack underflow at 1")],
      [[[P2_op("Print")]], err("stack underflow at 0")],
      [[[P2_push(1), P2_jz(7), P2_push(2), P2_op("Print")]], err("bad jump at 1")],
      [[[P2_jmp(0)]], err("step limit exceeded")],
    ],
    P2_INSTR, { Instr: "sum" }),
  h("text_editor", [["ops", "List[EditOp]"]], "String",
    "Simulate a one-line text editor and return its final text. It starts with empty text and the cursor at position 0 (positions run from 0, before the first character, to the text length, after the last). Insert(t) inserts t at the cursor and moves the cursor to just after the inserted text. Delete(n) removes up to n characters immediately before the cursor (fewer if the cursor is closer to the start) and moves the cursor back by the number removed. Left(n) and Right(n) move the cursor n positions, stopping at 0 and at the text length. Every Insert and Delete, even one that changes nothing, saves the (text, cursor) state from just before it on an undo history. Undo restores the most recently saved state (both text and cursor) and removes it from the history; with an empty history it does nothing. Undo itself is never saved, so it cannot be undone. n is never negative.",
    [
      [[[P2_ins("hello"), P2_left(2), P2_ins("XY")]], "helXYlo"],
      [[[]], ""],
      [[[P2_ins("abc"), P2_del(5)]], ""],
      [[[P2_ins("abc"), P2_left(1), P2_del(1), P2_ins("Z")]], "aZc"],
      [[[P2_ins("ab"), P2_ins("cd"), P2_UNDO, P2_ins("e")]], "abe"],
      [[[P2_ins("abc"), P2_left(3), P2_del(2), P2_UNDO, P2_UNDO, P2_UNDO, P2_ins("x")]], "x"],
      [[[P2_ins("abcd"), P2_left(2), P2_del(1), P2_right(9), P2_ins("!"), P2_UNDO, P2_ins("?")]], "acd?"],
      [[[P2_ins("hi"), P2_UNDO, P2_UNDO, P2_ins("yo"), P2_left(5), P2_ins(">")]], ">yo"],
      [[[P2_ins("abc"), P2_left(2), P2_ins("-"), P2_left(1), P2_UNDO, P2_ins("+")]], "a+bc"],
      [[[P2_ins("one two"), P2_left(4), P2_del(4), P2_right(1), P2_del(1)]], "two"],
    ],
    P2_EDIT, { EditOp: "sum" }),
  h("order_states", [["events", "List[OrderEvent]"]], "Result[List[(String, String)], String]",
    "Track orders through their life cycle, processing events in order. Create(id) adds a new order in state \"created\"; if an order with that id already exists, return the error \"duplicate order: ID\". For Pay, Ship and Cancel, if no order with that id exists, return the error \"unknown order: ID\". Allowed changes: Pay moves \"created\" to \"paid\"; Ship moves \"paid\" to \"shipped\"; Cancel moves \"created\" or \"paid\" to \"cancelled\". Any other change returns the error \"cannot VERB ID from STATE\", where VERB is pay, ship or cancel and STATE is the order's current state. Stop at the first error. Otherwise return every order as an (id, state) pair, sorted by id in ascending character-code order (so uppercase letters sort before lowercase, and \"A10\" before \"A9\").",
    [
      [[[P2_oe("Create", "a"), P2_oe("Pay", "a"), P2_oe("Ship", "a")]], ok([["a", "shipped"]])],
      [[[]], ok([])],
      [[[P2_oe("Create", "b"), P2_oe("Create", "a"), P2_oe("Cancel", "b"), P2_oe("Pay", "a")]], ok([["a", "paid"], ["b", "cancelled"]])],
      [[[P2_oe("Create", "B"), P2_oe("Create", "a"), P2_oe("Create", "A9"), P2_oe("Create", "A10")]], ok([["A10", "created"], ["A9", "created"], ["B", "created"], ["a", "created"]])],
      [[[P2_oe("Pay", "x")]], err("unknown order: x")],
      [[[P2_oe("Create", "a"), P2_oe("Create", "a")]], err("duplicate order: a")],
      [[[P2_oe("Create", "a"), P2_oe("Ship", "a")]], err("cannot ship a from created")],
      [[[P2_oe("Create", "a"), P2_oe("Pay", "a"), P2_oe("Ship", "a"), P2_oe("Cancel", "a")]], err("cannot cancel a from shipped")],
      [[[P2_oe("Create", "a"), P2_oe("Cancel", "a"), P2_oe("Pay", "a")]], err("cannot pay a from cancelled")],
      [[[P2_oe("Create", "a"), P2_oe("Pay", "a"), P2_oe("Pay", "a"), P2_oe("Pay", "zz")]], err("cannot pay a from paid")],
    ],
    P2_ORDER, { OrderEvent: "sum" }),
  h("robot_walk", [["cmds", "List[Cmd]"], ["obstacles", "List[(Int, Int)]"]], "(Int, Int, String)",
    "A robot starts at (0, 0) facing \"N\" on a grid where N is +y, E is +x, S is -y and W is -x. TurnLeft and TurnRight turn it 90 degrees (N, TurnRight gives E). Forward(k) (k >= 0) moves it one cell at a time, up to k cells; if the next cell is in obstacles, it stays where it is and ignores the rest of that Forward command (later commands still run). Return the final (x, y, direction), with direction one of \"N\", \"E\", \"S\", \"W\".",
    [
      [[[P2_fwd(3)], []], [0, 3, "N"]],
      [[[], []], [0, 0, "N"]],
      [[[P2_TR, P2_fwd(2), P2_TL, P2_fwd(1)], []], [2, 1, "N"]],
      [[[P2_fwd(5)], [[0, 3]]], [0, 2, "N"]],
      [[[P2_TL, P2_fwd(2), P2_TL, P2_fwd(1)], []], [-2, -1, "S"]],
      [[[P2_TR, P2_TR, P2_TR, P2_TR, P2_TR], []], [0, 0, "E"]],
      [[[P2_fwd(2), P2_TR, P2_fwd(3), P2_TR, P2_fwd(1)], [[2, 2], [1, 1]]], [1, 2, "S"]],
      [[[P2_fwd(0), P2_TL, P2_TL, P2_fwd(2)], [[0, -3]]], [0, -2, "S"]],
      [[[P2_fwd(1), P2_TR, P2_fwd(1)], [[0, 1]]], [1, 0, "E"]],
    ],
    P2_CMD, { Cmd: "sum" }),
  h("bank_ledger", [["ops", "List[BankOp]"]], "Result[List[(String, Int)], String]",
    "Apply bank operations in order; steps are numbered from 1. Open(name) creates an account with balance 0. Deposit adds amount; Withdraw subtracts it; Transfer moves amount from src to dst. Each operation is checked in this order, and the first failing check stops processing with an error prefixed \"step N: \": Open of an existing name gives \"duplicate account NAME\"; an account that does not exist gives \"unknown account NAME\" (for Transfer, check src before dst); a Transfer with src equal to dst gives \"same account\"; an amount of 0 or less gives \"invalid amount\"; a Withdraw or Transfer of more than the current balance gives \"insufficient funds\". If every operation succeeds, return each account as a (name, balance) pair, in the order the accounts were opened.",
    [
      [[[P2_open("a"), P2_dep("a", 100), P2_wd("a", 30)]], ok([["a", 70]])],
      [[[]], ok([])],
      [[[P2_open("a"), P2_open("b"), P2_dep("a", 50), P2_tr("a", "b", 20)]], ok([["a", 30], ["b", 20]])],
      [[[P2_open("b"), P2_open("a"), P2_dep("a", 10), P2_tr("a", "b", 10), P2_wd("b", 10)]], ok([["b", 0], ["a", 0]])],
      [[[P2_open("a"), P2_open("a")]], err("step 2: duplicate account a")],
      [[[P2_open("a"), P2_dep("b", 5)]], err("step 2: unknown account b")],
      [[[P2_open("a"), P2_dep("a", 0)]], err("step 2: invalid amount")],
      [[[P2_open("a"), P2_dep("a", 10), P2_wd("a", 11)]], err("step 3: insufficient funds")],
      [[[P2_open("a"), P2_tr("a", "z", -5)]], err("step 2: unknown account z")],
      [[[P2_open("a"), P2_dep("a", 5), P2_tr("a", "a", 5)]], err("step 3: same account")],
    ],
    P2_BANK, { BankOp: "sum" }),
  h("parking_fees", [["events", "List[Park]"]], "List[(String, Int)]",
    "Compute parking fees from arrival and departure events, processed in order (minutes are integers). Arrive(plate, m) parks the car at minute m; if that plate is already parked, the event is ignored. Leave(plate, m) ends the stay of a parked car; if the plate is not parked, the event is ignored. A stay of d = m - arrival minutes costs 0 if d <= 30; otherwise 200 for every started hour of the time beyond the first 30 minutes (so d = 31 and d = 90 cost 200, d = 91 costs 400), capped at 1000 per stay. Return (plate, total fees) for every plate that completed at least one stay (even if its fees are 0), sorted by plate in ascending character-code order. Cars still parked at the end add nothing.",
    [
      [[[P2_arr("x", 0), P2_lv("x", 45)]], [["x", 200]]],
      [[[]], []],
      [[[P2_arr("x", 0), P2_lv("x", 30)]], [["x", 0]]],
      [[[P2_arr("x", 10), P2_lv("x", 100), P2_arr("x", 200), P2_lv("x", 291)]], [["x", 600]]],
      [[[P2_lv("y", 5), P2_arr("y", 10)]], []],
      [[[P2_arr("a", 0), P2_arr("a", 50), P2_lv("a", 100)]], [["a", 400]]],
      [[[P2_arr("b", 0), P2_lv("b", 1000), P2_arr("a", 0), P2_lv("a", 31)]], [["a", 200], ["b", 1000]]],
      [[[P2_arr("z", 0), P2_arr("y", 0), P2_lv("y", 150), P2_lv("z", 331)]], [["y", 400], ["z", 1000]]],
      [[[P2_arr("p", 0), P2_lv("p", 30), P2_arr("q", 5), P2_lv("p", 90)]], [["p", 0]]],
    ],
    P2_PARK, { Park: "sum" }),
  h("glob_match", [["pattern", "String"], ["s", "String"]], "Bool",
    "Return whether the whole string s matches pattern. In the pattern, \"*\" matches any sequence of characters (including none), \"?\" matches exactly one character, a backslash followed by any character matches that character literally (so \"\\*\" matches only \"*\"), a backslash that is the last character of the pattern matches a literal backslash, and every other character matches itself.",
    [
      [["a*c", "abbbc"], true],
      [["", ""], true],
      [["", "a"], false],
      [["*", ""], true],
      [["a?c", "ac"], false],
      [["\\*a", "*a"], true],
      [["\\*a", "xa"], false],
      [["ab\\", "ab\\"], true],
      [["*.txt", "notes.txt.bak"], false],
      [["?*?", "a"], false],
    ],
  ),
];

// ---------------------------------------------------------------------------
// Part 3: Records with aggregation
// ---------------------------------------------------------------------------

const P3_MATCH = {
  canon: "type Match {\n  home: String,\n  away: String,\n  home_goals: Int,\n  away_goals: Int,\n}",
  ts: "type Match = { home: string; away: string; home_goals: number; away_goals: number };",
};
const P3_EMPLOYEE = {
  canon: "type Employee {\n  name: String,\n  dept: String,\n  hours: Int,\n  rate_cents: Int,\n}",
  ts: "type Employee = { name: string; dept: string; hours: number; rate_cents: number };",
};
const P3_JOB = {
  canon: "type Job {\n  name: String,\n  deps: List[String],\n}",
  ts: "type Job = { name: string; deps: string[] };\n" + TS_RESULT,
};
const P3_SALE = {
  canon: "type Sale {\n  region: String,\n  product: String,\n  units: Int,\n  price_cents: Int,\n}",
  ts: "type Sale = { region: string; product: string; units: number; price_cents: number };",
};
const P3_MEETING = {
  canon: "type Meeting {\n  start: Int,\n  end: Int,\n}",
  ts: "type Meeting = { start: number; end: number };",
};
const P3_LINE = {
  canon: "type Line {\n  sku: String,\n  qty: Int,\n  unit_cents: Int,\n}",
  ts: "type Line = { sku: string; qty: number; unit_cents: number };\n" + TS_RESULT,
};
const P3_TXN = {
  canon: "type Stock {\n  sku: String,\n  qty: Int,\n}\n\ntype Txn {\n  sku: String,\n  delta: Int,\n}",
  ts: "type Stock = { sku: string; qty: number };\ntype Txn = { sku: string; delta: number };\n" + TS_RESULT,
};
const P3_K = (sku: string, qty: number) => ({ sku, qty });
const P3_STUDENT = {
  canon: "type Student {\n  name: String,\n  scores: List[Int],\n}",
  ts: "type Student = { name: string; scores: number[] };",
};
const P3_REQUEST = {
  canon: "type Request {\n  endpoint: String,\n  ms: Int,\n  status: Int,\n}",
  ts: "type Request = { endpoint: string; ms: number; status: number };",
};
const P3_PLAYER = {
  canon: "type Player {\n  name: String,\n  score: Int,\n}",
  ts: "type Player = { name: string; score: number };",
};
const P3_EXPENSE = {
  canon: "type Expense {\n  payer: String,\n  amount_cents: Int,\n}",
  ts: "type Expense = { payer: string; amount_cents: number };",
};
const P3_SHIFT = {
  canon: "type Shift {\n  worker: String,\n  start_hour: Int,\n  end_hour: Int,\n}",
  ts: "type Shift = { worker: string; start_hour: number; end_hour: number };",
};
const P3_SESSION = {
  canon: "type Session {\n  user: String,\n  kind: String,\n  time: Int,\n}",
  ts: "type Session = { user: string; kind: string; time: number };",
};
const P3_CONTACT = {
  canon: "type Contact {\n  name: String,\n  email: String,\n  phone: String,\n}",
  ts: "type Contact = { name: string; email: string; phone: string };",
};
const P3_PERSON = {
  canon: "type Person {\n  name: String,\n  age: Int,\n}",
  ts: "type Person = { name: string; age: number };\n" + TS_RESULT,
};

const P3_M = (home: string, away: string, home_goals: number, away_goals: number) => ({ home, away, home_goals, away_goals });
const P3_E = (name: string, dept: string, hours: number, rate_cents: number) => ({ name, dept, hours, rate_cents });
const P3_J = (name: string, deps: string[]) => ({ name, deps });
const P3_S = (region: string, product: string, units: number, price_cents: number) => ({ region, product, units, price_cents });
const P3_MT = (start: number, end: number) => ({ start, end });
const P3_L = (sku: string, qty: number, unit_cents: number) => ({ sku, qty, unit_cents });
const P3_X = (sku: string, delta: number) => ({ sku, delta });
const P3_ST = (name: string, scores: number[]) => ({ name, scores });
const P3_RQ = (endpoint: string, ms: number, status: number) => ({ endpoint, ms, status });
const P3_PL = (name: string, score: number) => ({ name, score });
const P3_EX = (payer: string, amount_cents: number) => ({ payer, amount_cents });
const P3_SH = (worker: string, start_hour: number, end_hour: number) => ({ worker, start_hour, end_hour });
const P3_SE = (user: string, kind: string, time: number) => ({ user, kind, time });
const P3_CT = (name: string, email: string, phone: string) => ({ name, email, phone });
const P3_PE = (name: string, age: number) => ({ name, age });
const P3_HOURS = (skip: number[]) => Array.from({ length: 24 }, (_, i) => i).filter((i) => !skip.includes(i));

const P3: Task[] = [
  h("league_table", [["matches", "List[Match]"]], "List[(String, Int, Int, Int)]",
    "Build a league table from match results. Every team that appears in any match (as home or away) gets one row (team, points, goal_difference, goals_for). A win is worth 3 points, a draw 1, a loss 0. goals_for is the total goals the team scored in all its matches; goal_difference is goals_for minus the total goals scored against it. Order rows by points (highest first), then goal difference (highest first), then goals for (highest first), then team name in ascending code-point order (so \"B\" comes before \"a\").",
    [
      [[[]], []],
      [[[P3_M("a", "b", 1, 1)]], [["a", 1, 0, 1], ["b", 1, 0, 1]]],
      [[[P3_M("x", "y", 2, 0), P3_M("y", "z", 1, 1), P3_M("z", "x", 0, 3)]], [["x", 6, 5, 5], ["y", 1, -2, 1], ["z", 1, -3, 1]]],
      [[[P3_M("a", "c", 3, 2), P3_M("b", "d", 1, 0)]], [["a", 3, 1, 3], ["b", 3, 1, 1], ["c", 0, -1, 2], ["d", 0, -1, 0]]],
      [[[P3_M("m", "k", 2, 2), P3_M("k", "m", 0, 0)]], [["k", 2, 0, 2], ["m", 2, 0, 2]]],
      [[[P3_M("b", "y", 5, 4), P3_M("a", "x", 3, 0)]], [["a", 3, 3, 3], ["b", 3, 1, 5], ["y", 0, -1, 4], ["x", 0, -3, 0]]],
      [[[P3_M("a", "B", 0, 0)]], [["B", 1, 0, 0], ["a", 1, 0, 0]]],
      [[[P3_M("u", "v", 0, 1), P3_M("v", "u", 2, 2), P3_M("u", "w", 5, 5)]], [["v", 4, 1, 3], ["u", 2, -1, 7], ["w", 1, 0, 5]]],
    ],
    P3_MATCH, { Match: "record" }),
  h("payroll_by_dept", [["emps", "List[Employee]"]], "List[(String, Int)]",
    "Compute each employee's pay in cents: the first 40 hours are paid at rate_cents per hour; every hour above 40 is overtime, paid at 1.5 times the rate. For an employee with more than 40 hours, overtime pay is (hours - 40) * rate_cents * 3 / 2 rounded down to a whole cent, computed separately for each employee before any summing. Return one (dept, total pay) pair per department that has at least one employee, ordered by total pay (highest first), then by department name in ascending code-point order.",
    [
      [[[]], []],
      [[[P3_E("a", "ops", 40, 1000)]], [["ops", 40000]]],
      [[[P3_E("a", "eng", 41, 1001)]], [["eng", 41541]]],
      [[[P3_E("b", "y", 5, 200), P3_E("a", "x", 10, 100), P3_E("c", "x", 0, 500)]], [["x", 1000], ["y", 1000]]],
      [[[P3_E("a", "d", 41, 1), P3_E("b", "d", 41, 1)]], [["d", 82]]],
      [[[P3_E("a", "s", 45, 2000), P3_E("b", "t", 50, 1000), P3_E("c", "s", 20, 1500)]], [["s", 125000], ["t", 55000]]],
      [[[P3_E("z", "q", 43, 333)]], [["q", 14818]]],
      [[[P3_E("a", "m", 39, 10), P3_E("b", "n", 0, 99)]], [["m", 390], ["n", 0]]],
    ],
    P3_EMPLOYEE, { Employee: "record" }),
  h("build_order", [["jobs", "List[Job]"]], "Result[List[String], String]",
    "Each job lists the names of the jobs it depends on. Validate, then return an order in which every job comes after all of its dependencies. Checks, in this order: (1) if a name occurs more than once, return the error \"duplicate job: \" followed by the first name whose second occurrence comes earliest in the list; (2) scanning jobs in input order and each job's deps in their listed order, if a dependency is not the name of any job, return \"unknown dependency: \" followed by that name; (3) build the order step by step: at each step, among the jobs not yet placed whose dependencies have all been placed, place the one that comes earliest in the input list. If jobs remain but none can be placed, return \"cycle detected\" (a job depending on itself is a cycle). A dependency may be listed more than once. An empty list gives an empty order.",
    [
      [[[]], ok([])],
      [[[P3_J("a", [])]], ok(["a"])],
      [[[P3_J("app", ["lib", "util"]), P3_J("lib", ["util"]), P3_J("util", [])]], ok(["util", "lib", "app"])],
      [[[P3_J("c", []), P3_J("b", ["c"]), P3_J("a", [])]], ok(["c", "b", "a"])],
      [[[P3_J("a", ["b", "zz"]), P3_J("b", ["yy"])]], err("unknown dependency: zz")],
      [[[P3_J("a", []), P3_J("b", ["q"]), P3_J("a", [])]], err("duplicate job: a")],
      [[[P3_J("a", ["b"]), P3_J("b", ["a"]), P3_J("c", [])]], err("cycle detected")],
      [[[P3_J("x", ["x"])]], err("cycle detected")],
      [[[P3_J("d", ["b", "c"]), P3_J("b", ["a"]), P3_J("c", ["a", "a"]), P3_J("a", [])]], ok(["a", "b", "c", "d"])],
    ],
    P3_JOB, { Job: "record" }),
  h("top_product_per_region", [["sales", "List[Sale]"]], "List[(String, String, Int)]",
    "A sale's revenue is units * price_cents. Sum revenue per (region, product) pair over all sales. For each region that has at least one sale, in ascending code-point order of region name, return (region, product, revenue) for the product with the highest total revenue in that region; if several products tie for the highest, choose the one whose name is smallest in code-point order.",
    [
      [[[]], []],
      [[[P3_S("eu", "pen", 3, 150)]], [["eu", "pen", 450]]],
      [[[P3_S("us", "a", 1, 1000), P3_S("us", "b", 3, 200), P3_S("us", "b", 3, 200)]], [["us", "b", 1200]]],
      [[[P3_S("r", "zeta", 2, 50), P3_S("r", "alpha", 1, 100)]], [["r", "alpha", 100]]],
      [[[P3_S("west", "x", 1, 10), P3_S("east", "y", 2, 10), P3_S("west", "z", 1, 30), P3_S("east", "y", 1, 5)]], [["east", "y", 25], ["west", "z", 30]]],
      [[[P3_S("n", "q", 0, 100), P3_S("n", "p", 0, 5)]], [["n", "p", 0]]],
      [[[P3_S("a", "k", 1, 100), P3_S("b", "k", 1, 1), P3_S("b", "m", 1, 2)]], [["a", "k", 100], ["b", "m", 2]]],
    ],
    P3_SALE, { Sale: "record" }),
  h("free_slots", [["meetings", "List[Meeting]"], ["day_start", "Int"], ["day_end", "Int"]], "List[(Int, Int)]",
    "Times are minutes. The working day is the half-open interval [day_start, day_end) and each meeting occupies [start, end). Meetings come in any order, may overlap or touch, and may extend beyond the day or lie entirely outside it; a meeting with end <= start occupies nothing. Return the free intervals of the day as (start, end) pairs: the maximal half-open intervals inside the day not occupied by any meeting, in increasing order. Two meetings that touch (one ends exactly when the next starts) leave no gap between them. If day_end <= day_start, return an empty list.",
    [
      [[[], 540, 1020], [[540, 1020]]],
      [[[P3_MT(540, 1020)], 540, 1020], []],
      [[[P3_MT(600, 660), P3_MT(630, 700), P3_MT(700, 720), P3_MT(800, 810)], 540, 900], [[540, 600], [720, 800], [810, 900]]],
      [[[P3_MT(1000, 1100), P3_MT(500, 560)], 540, 1020], [[560, 1000]]],
      [[[P3_MT(600, 600), P3_MT(700, 650)], 540, 720], [[540, 720]]],
      [[[P3_MT(540, 700), P3_MT(560, 600)], 540, 720], [[700, 720]]],
      [[[], 600, 600], []],
      [[[P3_MT(0, 100), P3_MT(2000, 2100)], 540, 600], [[540, 600]]],
    ],
    P3_MEETING, { Meeting: "record" }),
  h("invoice_total", [["lines", "List[Line]"], ["coupon", "String"]], "Result[Int, String]",
    "Compute an invoice total in cents, using integer arithmetic only. Steps, in order: (1) if any line has qty below 1, return the error \"bad quantity: \" followed by the sku of the first such line. (2) Each line's amount is qty * unit_cents; if qty is 10 or more, subtract a bulk discount of amount / 10 rounded down. (3) The subtotal is the sum of the line amounts. (4) Apply the coupon to the subtotal: \"\" means no coupon; \"SAVE500\" subtracts 500, but the result never goes below 0; \"PCT10\" subtracts subtotal / 10 rounded down; \"BIG20\" subtracts subtotal / 5 rounded down, but only if the subtotal is at least 10000, otherwise return the error \"coupon not applicable: BIG20\"; any other coupon string (codes are case-sensitive) returns the error \"unknown coupon: \" followed by the coupon. (5) Add 8% tax on the amount after the coupon, rounded to the nearest cent with halves rounded up, i.e. tax = (amount * 8 + 50) / 100 with the division rounded down. Return amount plus tax. An empty invoice totals 0.",
    [
      [[[], ""], ok(0)],
      [[[P3_L("a", 2, 1000)], ""], ok(2160)],
      [[[P3_L("b", 10, 333)], ""], ok(3237)],
      [[[P3_L("a", 1, 300)], "SAVE500"], ok(0)],
      [[[P3_L("x", 9, 100)], "SAVE500"], ok(432)],
      [[[P3_L("a", 3, 1260), P3_L("b", 1, 1)], "PCT10"], ok(3675)],
      [[[P3_L("a", 20, 550)], "BIG20"], err("coupon not applicable: BIG20")],
      [[[P3_L("a", 20, 600)], "BIG20"], ok(9331)],
      [[[P3_L("a", 1, 100)], "save500"], err("unknown coupon: save500")],
      [[[P3_L("a", 1, 100), P3_L("b", 0, 100), P3_L("c", -1, 5)], "NOPE"], err("bad quantity: b")],
    ],
    P3_LINE, { Line: "record" }),
  h("inventory_ledger", [["stock", "List[Stock]"], ["txns", "List[Txn]"]], "Result[List[Stock], String]",
    "stock gives the starting quantity of each sku; skus in stock are distinct and quantities are at least 0. Apply the transactions in order, adding delta to the sku's quantity. If a transaction's sku is not in stock (whatever its delta), return the error \"txn N: unknown sku S\"; if it would make the quantity negative, return the error \"txn N: S would go negative\", where N is the 1-based position of the transaction and S its sku. Transactions never add new skus. Otherwise return the final Stock entries for the skus whose final quantity is greater than 0, ordered by sku in ascending code-point order.",
    [
      [[[], []], ok([])],
      [[[P3_K("b", 5), P3_K("a", 2)], []], ok([P3_K("a", 2), P3_K("b", 5)])],
      [[[P3_K("a", 5)], [P3_X("a", -5)]], ok([])],
      [[[P3_K("a", 1)], [P3_X("a", -2)]], err("txn 1: a would go negative")],
      [[[P3_K("a", 1), P3_K("b", 0)], [P3_X("a", 3), P3_X("c", 1)]], err("txn 2: unknown sku c")],
      [[[P3_K("w", 0)], [P3_X("w", 4), P3_X("w", -4), P3_X("w", 1)]], ok([P3_K("w", 1)])],
      [[[P3_K("p", 3), P3_K("q", 1)], [P3_X("p", -1), P3_X("q", -1), P3_X("p", -3)]], err("txn 3: p would go negative")],
      [[[P3_K("z", 0), P3_K("m", 7)], [P3_X("m", -2)]], ok([P3_K("m", 5)])],
      [[[P3_K("a", 1)], [P3_X("b", 0)]], err("txn 1: unknown sku b")],
    ],
    P3_TXN, { Stock: "record", Txn: "record" }),
  h("student_medians", [["students", "List[Student]"]], "List[(String, Float)]",
    "For each student with at least one score, compute the median score: sort the scores ascending; with an odd count take the middle one, with an even count take the average of the two middle ones (as a Float, e.g. 2.5). Students with no scores are left out. Return (name, median) pairs ordered by median (highest first), then by name in ascending code-point order.",
    [
      [[[]], []],
      [[[P3_ST("a", [])]], []],
      [[[P3_ST("a", [90, 70, 80])]], [["a", 80.0]]],
      [[[P3_ST("b", [1, 4, 2, 3])]], [["b", 2.5]]],
      [[[P3_ST("zed", [50]), P3_ST("amy", [40, 60]), P3_ST("bob", [70])]], [["bob", 70.0], ["amy", 50.0], ["zed", 50.0]]],
      [[[P3_ST("c", [5, 5, 9, 1])]], [["c", 5.0]]],
      [[[P3_ST("x", []), P3_ST("y", [3, 4]), P3_ST("w", [100, 0])]], [["w", 50.0], ["y", 3.5]]],
    ],
    P3_STUDENT, { Student: "record" }),
  h("latency_report", [["entries", "List[Request]"]], "List[(String, Int, Int, Int)]",
    "Group the requests by endpoint. For each endpoint, in order of its first appearance, return (endpoint, count, p90, errors): count is its number of requests; p90 is the nearest-rank 90th percentile of its ms values, i.e. the k-th smallest value (1-based, duplicates counted) where k = ceil(0.9 * count), which in integer arithmetic is (9 * count + 9) / 10 rounded down; errors is the number of its requests with status 500 or above.",
    [
      [[[]], []],
      [[[P3_RQ("/a", 120, 200)]], [["/a", 1, 120, 0]]],
      [[[70, 10, 100, 40, 90, 20, 60, 30, 80, 50].map((ms, i) => P3_RQ("/x", ms, i === 2 ? 500 : i === 5 ? 503 : i === 7 ? 499 : 200))], [["/x", 10, 90, 2]]],
      [[[5, 11, 2, 9, 1, 7, 3, 10, 4, 8, 6].map((ms) => P3_RQ("/y", ms, 200))], [["/y", 11, 10, 0]]],
      [[[P3_RQ("/b", 5, 200), P3_RQ("/a", 7, 500), P3_RQ("/b", 9, 500)]], [["/b", 2, 9, 1], ["/a", 1, 7, 1]]],
      [[[P3_RQ("/c", 30, 200), P3_RQ("/c", 10, 599), P3_RQ("/c", 30, 404)]], [["/c", 3, 30, 1]]],
      [[Array.from({ length: 20 }, (_, i) => P3_RQ("/z", 20 - i, 201))], [["/z", 20, 18, 0]]],
      [[[5, 1, 4, 2, 3].map((ms) => P3_RQ("/q", ms, 500))], [["/q", 5, 5, 5]]],
    ],
    P3_REQUEST, { Request: "record" }),
  h("competition_rank", [["players", "List[Player]"]], "List[(Int, String)]",
    "Rank the players by score, highest first, using standard competition ranking (\"1224\"): a player's rank is 1 plus the number of players with a strictly higher score, so equal scores share a rank and the next rank is skipped accordingly. Return (rank, name) pairs ordered by score (highest first); players with equal scores are ordered by name in ascending code-point order.",
    [
      [[[]], []],
      [[[P3_PL("a", 5)]], [[1, "a"]]],
      [[[P3_PL("a", 10), P3_PL("b", 20), P3_PL("c", 10), P3_PL("d", 5)]], [[1, "b"], [2, "a"], [2, "c"], [4, "d"]]],
      [[[P3_PL("zz", 0), P3_PL("aa", 0), P3_PL("mm", 0)]], [[1, "aa"], [1, "mm"], [1, "zz"]]],
      [[[P3_PL("x", -1), P3_PL("y", -3), P3_PL("z", -1)]], [[1, "x"], [1, "z"], [3, "y"]]],
      [[[P3_PL("e", 9), P3_PL("i", 8), P3_PL("f", 9), P3_PL("h", 8), P3_PL("g", 9)]], [[1, "e"], [1, "f"], [1, "g"], [4, "h"], [4, "i"]]],
      [[[P3_PL("bob", 3), P3_PL("Bob", 3)]], [[1, "Bob"], [1, "bob"]]],
    ],
    P3_PLAYER, { Player: "record" }),
  h("settle_debts", [["expenses", "List[Expense]"], ["people", "List[String]"]], "List[(String, String, Int)]",
    "people is a non-empty list of distinct names, and every payer is one of them. The total of all expenses is shared by everyone: each person owes total / len(people) rounded down, and the remainder cents (total modulo len(people)) are owed one extra cent each by the first people in the list. A person's balance is what they paid minus what they owe. Settle with this greedy procedure: while some balance is not zero, the debtor is the person with the most negative balance and the creditor the person with the most positive balance (ties go to whoever comes first in people); the debtor pays the creditor the smaller of the debt and the credit, and both balances are updated. Return the payments in the order made, as (from, to, amount).",
    [
      [[[], ["a", "b"]], []],
      [[[P3_EX("a", 100)], ["a", "b"]], [["b", "a", 50]]],
      [[[P3_EX("a", 100)], ["a", "b", "c"]], [["b", "a", 33], ["c", "a", 33]]],
      [[[P3_EX("c", 100)], ["a", "b", "c"]], [["a", "c", 34], ["b", "c", 33]]],
      [[[P3_EX("a", 30), P3_EX("b", 30), P3_EX("c", 30)], ["a", "b", "c"]], []],
      [[[P3_EX("a", 600), P3_EX("b", 300)], ["a", "b", "c", "d"]], [["c", "a", 225], ["d", "a", 150], ["d", "b", 75]]],
      [[[P3_EX("a", 100), P3_EX("b", 10)], ["a", "b", "c"]], [["c", "a", 36], ["b", "a", 27]]],
      [[[P3_EX("b", 60), P3_EX("a", 60)], ["a", "b", "c", "d"]], [["c", "a", 30], ["d", "b", 30]]],
      [[[P3_EX("a", 77)], ["a"]], []],
    ],
    P3_EXPENSE, { Expense: "record" }),
  h("coverage_gaps", [["shifts", "List[Shift]"], ["required", "Int"]], "List[Int]",
    "Each shift covers the whole hours h with start_hour <= h < end_hour (a shift with end_hour <= start_hour covers nothing); all hours are between 0 and 24. For each hour 0 through 23, count the distinct workers on duty during that hour (a worker with several shifts covering the hour counts once). Return, in increasing order, the hours whose count is below required.",
    [
      [[[], 1], P3_HOURS([])],
      [[[], 0], []],
      [[[P3_SH("a", 0, 24)], 1], []],
      [[[P3_SH("a", 9, 17), P3_SH("b", 12, 20)], 2], P3_HOURS([12, 13, 14, 15, 16])],
      [[[P3_SH("a", 8, 12), P3_SH("a", 10, 14), P3_SH("b", 8, 9)], 2], P3_HOURS([8])],
      [[[P3_SH("a", 5, 5), P3_SH("b", 7, 6), P3_SH("c", 22, 24)], 1], P3_HOURS([22, 23])],
      [[[P3_SH("a", 0, 12), P3_SH("b", 6, 18), P3_SH("c", 10, 11), P3_SH("d", 10, 24)], 3], P3_HOURS([10, 11])],
      [[[P3_SH("x", 20, 24), P3_SH("y", 23, 24)], 2], P3_HOURS([23])],
    ],
    P3_SHIFT, { Shift: "record" }),
  h("session_totals", [["events", "List[Session]"]], "List[(String, Int)]",
    "events are in non-decreasing time order and kind is always \"login\" or \"logout\". Track each user separately: a login while the user is logged out starts a session; a login while already logged in is ignored; a logout while logged in ends the session and adds (logout time - login time) to the user's total; a logout while logged out is ignored. Sessions still open after the last event are closed at the time of the last event in the whole list. Return (user, total) for every user that appears in any event (even with total 0), ordered by user name in ascending code-point order.",
    [
      [[[]], []],
      [[[P3_SE("a", "login", 10), P3_SE("a", "logout", 25)]], [["a", 15]]],
      [[[P3_SE("a", "login", 0), P3_SE("a", "login", 5), P3_SE("a", "logout", 10)]], [["a", 10]]],
      [[[P3_SE("b", "logout", 3), P3_SE("a", "login", 4), P3_SE("a", "logout", 9)]], [["a", 5], ["b", 0]]],
      [[[P3_SE("a", "login", 0), P3_SE("b", "login", 10), P3_SE("b", "logout", 30)]], [["a", 30], ["b", 20]]],
      [[[P3_SE("u", "login", 1), P3_SE("u", "logout", 2), P3_SE("u", "logout", 3), P3_SE("u", "login", 10), P3_SE("u", "logout", 20)]], [["u", 11]]],
      [[[P3_SE("z", "login", 5), P3_SE("y", "login", 7)]], [["y", 0], ["z", 2]]],
      [[[P3_SE("a", "login", 5), P3_SE("a", "logout", 5)]], [["a", 0]]],
    ],
    P3_SESSION, { Session: "record" }),
  h("merge_contacts", [["contacts", "List[Contact]"]], "List[Contact]",
    "Two contacts are linked if their emails, each with leading and trailing whitespace removed, are equal (case-sensitive) and non-empty, or if their phones, each reduced to just its digit characters 0-9, are equal and non-empty. Contacts belong to the same person if they are connected through a chain of links. Return one merged contact per person, ordered by the position of the person's first contact in the input. A merged contact starts as a copy of the person's first contact (field values kept exactly as given, not trimmed); then each field that is the empty string \"\" is filled with that field's value from the earliest later contact of the same person (in input order) where it is not \"\".",
    [
      [[[]], []],
      [[[P3_CT("Ann", "a@x", "")]], [P3_CT("Ann", "a@x", "")]],
      [[[P3_CT("Ann", " a@x ", ""), P3_CT("", "a@x", "555-1234")]], [P3_CT("Ann", " a@x ", "555-1234")]],
      [[[P3_CT("Bo", "", "(555) 12-34"), P3_CT("Bob", "bo@y", "5551234")]], [P3_CT("Bo", "bo@y", "(555) 12-34")]],
      [[[P3_CT("A", "a@x", ""), P3_CT("B", "b@x", "999"), P3_CT("", "a@x", "9-9-9")]], [P3_CT("A", "a@x", "999")]],
      [[[P3_CT("A", "", "n/a"), P3_CT("B", "  ", "n/a")]], [P3_CT("A", "", "n/a"), P3_CT("B", "  ", "n/a")]],
      [[[P3_CT("P", "p@1", ""), P3_CT("Q", "q@1", ""), P3_CT("", "p@1", "1"), P3_CT("", "q@1", "2")]], [P3_CT("P", "p@1", "1"), P3_CT("Q", "q@1", "2")]],
      [[[P3_CT("X", "", ""), P3_CT("A", "a@", "1"), P3_CT("B", "b@", "2"), P3_CT("C", "a@", "2")]], [P3_CT("X", "", ""), P3_CT("A", "a@", "1")]],
      [[[P3_CT("", "e@", "1"), P3_CT("Z", "", "1"), P3_CT("Y", "e@", "")]], [P3_CT("Z", "e@", "1")]],
      [[[P3_CT("m", "A@x", ""), P3_CT("n", "a@x", "")]], [P3_CT("m", "A@x", ""), P3_CT("n", "a@x", "")]],
    ],
    P3_CONTACT, { Contact: "record" }),
  h("age_histogram", [["people", "List[Person]"], ["width", "Int"]], "Result[List[(String, Int)], String]",
    "Count people into age buckets of the given width: bucket b holds ages b*width through b*width + width - 1 and is labelled with those two numbers joined by \"-\" (for width 10: \"0-9\", \"10-19\", ...). Checks first, in this order: if width is below 1 return the error \"bad width\"; if any age is negative return \"negative age: \" followed by the name of the first such person. Otherwise return (label, count) for every bucket from the lowest occupied bucket to the highest occupied bucket inclusive, in increasing order, including empty buckets in between with count 0. No people gives an empty list.",
    [
      [[[], 10], ok([])],
      [[[P3_PE("a", 5)], 0], err("bad width")],
      [[[P3_PE("a", -1)], 0], err("bad width")],
      [[[P3_PE("a", 3), P3_PE("b", -2), P3_PE("c", -5)], 10], err("negative age: b")],
      [[[P3_PE("a", 5), P3_PE("b", 31), P3_PE("c", 9)], 10], ok([["0-9", 2], ["10-19", 0], ["20-29", 0], ["30-39", 1]])],
      [[[P3_PE("a", 47), P3_PE("b", 40)], 5], ok([["40-44", 1], ["45-49", 1]])],
      [[[P3_PE("a", 2), P3_PE("b", 4), P3_PE("c", 2)], 1], ok([["2-2", 2], ["3-3", 0], ["4-4", 1]])],
      [[[P3_PE("a", 0), P3_PE("b", 10)], 10], ok([["0-9", 1], ["10-19", 1]])],
    ],
    P3_PERSON, { Person: "record" }),
];

// ---------------------------------------------------------------------------
// Part 4: List algorithms and simulations
// ---------------------------------------------------------------------------

const P4_Z18 = Array.from({ length: 18 }, () => 0);

const P4: Task[] = [
  h("max_subarray", [["xs", "List[Int]"]], "Option[(Int, Int, Int)]",
    "Find the non-empty contiguous run of xs with the largest sum. Return (sum, start, end), where start and end are the 0-based indices of its first and last element (end inclusive). If several runs share the largest sum, choose the one with the smallest start; among those, the one with the smallest end. Return nothing if xs is empty.",
    [[[[]], null], [[[5]], [5, 0, 0]], [[[-3, -1, -2]], [-1, 1, 1]], [[[-2, 1, -3, 4, -1, 2, 1, -5, 4]], [6, 3, 6]], [[[1, -1, 1]], [1, 0, 0]], [[[0, 0]], [0, 0, 0]], [[[2, -2, 3]], [3, 0, 2]], [[[1, 2, -10, 3]], [3, 0, 1]], [[[0, -1, 3, 0]], [3, 2, 2]]]),
  h("lis_length", [["xs", "List[Int]"]], "(Int, Int)",
    "Return (length, count) for the longest strictly increasing subsequences of xs. A subsequence is a choice of positions i1 < i2 < ... with xs[i1] < xs[i2] < ...; length is the largest possible number of positions, and count is how many different choices of positions reach that length (equal values at different positions count as different choices). An empty xs gives (0, 0).",
    [[[[]], [0, 0]], [[[7]], [1, 1]], [[[1, 3, 5, 4, 7]], [4, 2]], [[[2, 2, 2, 2]], [1, 4]], [[[5, 4, 3]], [1, 3]], [[[1, 2, 4, 3, 5, 4, 7, 2]], [5, 3]], [[[3, 1, 2, 1, 2]], [2, 3]], [[[1, 1, 2, 2]], [2, 4]]]),
  h("spiral_order", [["m", "List[List[Int]]"]], "List[Int]",
    "m is a rectangular matrix given as a list of rows. Return its elements in counterclockwise spiral order: start at the top-left corner, go down the first column, then right along the bottom row, then up the last column, then left along the top row, and repeat on the remaining inner matrix. Every element appears exactly once. A matrix with no rows, or whose rows are empty, gives an empty list.",
    [[[[]], []], [[[[]]], []], [[[[1]]], [1]], [[[[1, 2, 3]]], [1, 2, 3]], [[[[1], [2], [3]]], [1, 2, 3]], [[[[1, 2], [3, 4]]], [1, 3, 4, 2]], [[[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], [1, 4, 7, 8, 9, 6, 3, 2, 5]], [[[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]], [1, 5, 9, 10, 11, 12, 8, 4, 3, 2, 6, 7]], [[[[1, 2], [3, 4], [5, 6], [7, 8]]], [1, 3, 5, 7, 8, 6, 4, 2]]]),
  h("next_permutation", [["xs", "List[Int]"]], "List[Int]",
    "Return the next arrangement of xs in lexicographic order among all distinct arrangements of its elements (xs may contain repeated values). If xs is already the last arrangement (non-increasing order), return its elements in ascending order instead. Empty and one-element lists are returned unchanged.",
    [[[[1, 2, 3]], [1, 3, 2]], [[[3, 2, 1]], [1, 2, 3]], [[[1, 1, 5]], [1, 5, 1]], [[[1, 5, 1]], [5, 1, 1]], [[[5, 1, 1]], [1, 1, 5]], [[[]], []], [[[7]], [7]], [[[2, 3, 1, 3, 3]], [2, 3, 3, 1, 3]], [[[1, 3, 2]], [2, 1, 3]]]),
  h("k_most_frequent", [["xs", "List[Int]"], ["k", "Int"]], "List[(Int, Int)]",
    "Return (value, count) pairs for the k most frequent distinct values of xs, ordered by count from highest to lowest; values with equal counts are ordered from smallest to largest value. If k exceeds the number of distinct values, return all of them; if k <= 0, return an empty list.",
    [[[[1, 1, 2, 2, 3], 2], [[1, 2], [2, 2]]], [[[4, 4, 1, 1, 1, 2], 2], [[1, 3], [4, 2]]], [[[], 3], []], [[[5], 0], []], [[[5, 5], -1], []], [[[3, 1, 2], 5], [[1, 1], [2, 1], [3, 1]]], [[[2, 2, -1, -1, 0], 2], [[-1, 2], [2, 2]]], [[[7, 7, 7, 3, 3, 9], 2], [[7, 3], [3, 2]]]]),
  h("sliding_window_max", [["xs", "List[Int]"], ["k", "Int"]], "Result[List[Int], String]",
    "Return the maximum of every window of k consecutive elements of xs, in order from the window starting at index 0 (there are len(xs) - k + 1 windows). Errors, checked in this order: \"window must be positive\" if k < 1; \"window larger than input\" if k is greater than the length of xs (so an empty xs with k >= 1 is this error).",
    [[[[1, 3, -1, -3, 5, 3, 6, 7], 3], ok([3, 3, 5, 5, 6, 7])], [[[4], 1], ok([4])], [[[], 1], err("window larger than input")], [[[1, 2], 0], err("window must be positive")], [[[], 0], err("window must be positive")], [[[1, 2], 3], err("window larger than input")], [[[2, 2, 2], 2], ok([2, 2])], [[[5, 4, 3, 2], 4], ok([5])], [[[-5, -2, -9], 1], ok([-5, -2, -9])]],
    RESULT_ONLY, {}),
  h("min_coins", [["coins", "List[Int]"], ["amount", "Int"]], "Option[(Int, List[Int])]",
    "coins holds positive coin values (unsorted, possibly repeated); each value may be used any number of times. Return (n, used): the smallest number of coins n whose values sum to amount, and the coins used, sorted from largest to smallest. If several such lists exist, return the one that is greatest when compared element by element from the front (the one whose first differing element is larger). amount 0 gives (0, []). Return nothing if amount is negative or cannot be made.",
    [[[[1, 2, 5], 11], [3, [5, 5, 1]]], [[[2], 3], null], [[[1], 0], [0, []]], [[[3, 7], -1], null], [[[1, 3, 4], 6], [2, [3, 3]]], [[[1, 5, 6, 9], 11], [2, [6, 5]]], [[[1, 2, 3, 4], 5], [2, [4, 1]]], [[[2, 4], 7], null], [[[5, 2, 5, 3], 7], [2, [5, 2]]]]),
  h("edit_script_distance", [["a", "String"], ["b", "String"]], "Int",
    "Return the optimal string alignment distance from a to b: the fewest edits turning a into b, where an edit is inserting one character, deleting one character, replacing one character with another, or swapping two adjacent characters, each costing 1, with the restriction that no part of the string is edited more than once (so a swapped pair cannot be edited again). For example, \"ca\" to \"abc\" costs 3, not 2.",
    [[["", ""], 0], [["abc", ""], 3], [["", "ab"], 2], [["ab", "ba"], 1], [["kitten", "sitting"], 3], [["ca", "abc"], 3], [["abcd", "acbd"], 1], [["abc", "abc"], 0], [["abcdef", "badcfe"], 3]]),
  h("bowling_score", [["rolls", "List[Int]"]], "Result[Int, String]",
    "rolls is the number of pins knocked down by each roll of one ten-pin bowling game. First, if any roll is below 0 or above 10, return the error \"invalid roll\". Then read frames in order. In frames 1 to 9, a 10 on the first roll is a strike and ends the frame; otherwise the frame has two rolls, and if they sum to more than 10 return \"too many pins in frame N\" (N is the frame number). In frame 10: after a strike come two bonus rolls, and unless the first bonus roll is 10, the two bonus rolls may not sum to more than 10; otherwise the frame has two rolls that may not sum to more than 10, plus one bonus roll if they sum to exactly 10 (a spare). A frame-10 violation is \"too many pins in frame 10\". If the rolls run out before the game is complete, return \"incomplete game\"; if rolls are left over after frame 10, return \"too many rolls\". The first problem met while reading left to right wins. Otherwise return the score: each frame scores its pins, plus the next two rolls after a strike, plus the next roll after a spare, in frames 1 to 9; frame 10 scores just the pins of all its rolls.",
    [[[Array(12).fill(10)], ok(300)], [[Array(20).fill(0)], ok(0)], [[Array(21).fill(5)], ok(150)], [[[10, 7, 3, 9, 0, 10, 0, 8, 8, 2, 0, 6, 10, 10, 10, 8, 1]], ok(167)], [[Array(13).fill(10)], err("too many rolls")], [[[3, 4]], err("incomplete game")], [[[5, 6, 11]], err("invalid roll")], [[[5, 6, 1, 1]], err("too many pins in frame 1")], [[[...P4_Z18, 10, 5, 6]], err("too many pins in frame 10")], [[[...P4_Z18, 3, 7]], err("incomplete game")]],
    RESULT_ONLY, {}),
  h("tennis_score", [["points", "String"]], "String",
    "points lists the winner of each point of one tennis game in order, one character per point: \"A\" or \"B\". Return the score after all points. Point counts 0, 1, 2, 3 are called love, 15, 30, 40. A player wins the game on reaching at least 4 points with a lead of at least 2: return \"game A\" or \"game B\". Otherwise, if both have at least 3 points: equal is \"deuce\" and a one-point lead is \"advantage A\" or \"advantage B\". Otherwise equal counts give the name followed by \"-all\" (e.g. \"love-all\", \"30-all\"), and different counts give A's name, \"-\", B's name (e.g. \"15-love\", \"30-40\"). Read the characters left to right: a character that is neither \"A\" nor \"B\" gives \"error: bad point\", and any character after the game has been won gives \"error: point after game\"; the first of these met wins.",
    [[[""], "love-all"], [["A"], "15-love"], [["AB"], "15-all"], [["BBA"], "15-30"], [["AAAB"], "40-15"], [["AAABBB"], "deuce"], [["AAABBBA"], "advantage A"], [["BBBAB"], "game B"], [["AAAAB"], "error: point after game"], [["ABX"], "error: bad point"]]),
  h("life_step", [["grid", "List[String]"], ["steps", "Int"]], "List[String]",
    "grid is a rectangle of rows of equal length; \"#\" is a live cell and \".\" a dead one. Apply steps generations (steps >= 0) of Conway's Game of Life and return the grid. In each generation every cell counts its live neighbours among the 8 surrounding cells (cells beyond the edge of the grid count as dead and never come alive; the grid does not grow): a live cell with 2 or 3 live neighbours stays alive, a dead cell with exactly 3 becomes alive, and every other cell is dead in the next generation. All cells update at the same time.",
    [[[[".....", "..#..", "..#..", "..#..", "....."], 1], [".....", ".....", ".###.", ".....", "....."]], [[[".....", "..#..", "..#..", "..#..", "....."], 2], [".....", "..#..", "..#..", "..#..", "....."]], [[["##", "##"], 3], ["##", "##"]], [[["#.#", ".#."], 0], ["#.#", ".#."]], [[[], 4], []], [[["#"], 1], ["."]], [[["##", "#."], 1], ["##", "##"]], [[["###"], 1], [".#."]], [[[".#...", "..#..", "###..", ".....", "....."], 4], [".....", "..#..", "...#.", ".###.", "....."]]]),
  h("tic_tac_toe", [["board", "List[String]"]], "String",
    "board is 3 rows of 3 characters, each \"X\", \"O\" or \".\" (empty). X moves first and players alternate. Return \"invalid\" if the position cannot arise in a legal game: the number of Xs must equal the number of Os or exceed it by exactly one; both players cannot have a line; if X has a line, X must have exactly one more mark than O; if O has a line, the counts must be equal. A line is a full row, column or diagonal of one player's marks. Otherwise return \"X wins\" or \"O wins\" if that player has a line, \"draw\" if the board is full, and \"in progress\" otherwise.",
    [[[["...", "...", "..."]], "in progress"], [[["XXX", "OO.", "..."]], "X wins"], [[["OOO", "XX.", "X.."]], "O wins"], [[["OOO", "XX.", "XX."]], "invalid"], [[["O..", "...", "..."]], "invalid"], [[["XXX", "OOO", "..."]], "invalid"], [[["XOX", "XOO", "OXX"]], "draw"], [[["XXX", "XOO", "XOO"]], "X wins"], [[["XOX", "OXO", "OXX"]], "X wins"], [[["XX.", "X..", "O.."]], "invalid"]]),
  h("poker_hand", [["cards", "List[String]"]], "String",
    "Each card is two characters: a rank from \"23456789TJQKA\" then a suit from \"CDHS\". Return \"invalid\" unless cards holds exactly 5 valid cards with no card repeated. Otherwise return the hand's category, checking in this order: \"straight flush\", \"four of a kind\", \"full house\" (three of one rank and two of another), \"flush\" (all one suit), \"straight\" (five consecutive ranks; the ace counts high in TJQKA and low in A2345, but ranks do not wrap around, so QKA23 is not a straight), \"three of a kind\", \"two pair\", \"one pair\", \"high card\".",
    [[[["TH", "JH", "QH", "KH", "AH"]], "straight flush"], [[["3S", "AS", "2D", "4C", "5S"]], "straight"], [[["QS", "KD", "AH", "2C", "3S"]], "high card"], [[["9C", "9D", "2D", "9H", "9S"]], "four of a kind"], [[["3C", "8S", "3D", "3H", "8D"]], "full house"], [[["2H", "7H", "9H", "JH", "KH"]], "flush"], [[["5C", "5D", "5H", "8S", "2D"]], "three of a kind"], [[["5C", "8H", "5D", "8S", "2D"]], "two pair"], [[["5C", "5D", "9H", "8S", "2D"]], "one pair"], [[["AH", "AH", "2C", "3D", "4S"]], "invalid"]]),
  h("count_islands", [["grid", "List[String]"]], "(Int, Int)",
    "grid is a rectangle of rows of equal length made of \"#\" (land) and \".\" (water). An island is a maximal group of land cells connected through up, down, left and right neighbours (not diagonals). Return (number of islands, number of cells in the largest island); a grid with no land, including an empty grid, gives (0, 0).",
    [[[[]], [0, 0]], [[["..."]], [0, 0]], [[["#"]], [1, 1]], [[["#.", ".#"]], [2, 1]], [[["##.", "#..", "..#"]], [2, 3]], [[["#.#.#"]], [3, 1]], [[["#.#", "#.#", "###"]], [1, 7]], [[["###", "#.#", "###"]], [1, 8]], [[["#..#", "....", "##.#"]], [4, 2]]]),
  h("elevator_scan", [["start", "Int"], ["requests", "List[Int]"], ["direction", "String"]], "List[Int]",
    "An elevator at floor start, moving in direction \"up\" or \"down\", serves requested floors in SCAN order. Return the floors in the order they are served, each distinct floor once even if requested several times. A request for the start floor is served first. Then, moving up, it serves every requested floor above start in ascending order, then reverses and serves every requested floor below start in descending order; moving down, it serves the floors below start in descending order, then the floors above start in ascending order.",
    [[[5, [], "up"], []], [[5, [5, 5], "down"], [5]], [[5, [7, 2, 9, 5, 1, 7], "up"], [5, 7, 9, 2, 1]], [[5, [7, 2, 9, 5, 1, 7], "down"], [5, 2, 1, 7, 9]], [[0, [3, 1, 2], "down"], [1, 2, 3]], [[10, [3, 1], "up"], [3, 1]], [[3, [-2, 4, -1, 4], "up"], [4, -1, -2]], [[3, [-2, 4, -1, 4], "down"], [-1, -2, 4]]]),
];

export const HARD_TASKS: Task[] = [...P1, ...P2, ...P3, ...P4];
