/**
 * The standard library's types and signatures, written in Canon and parsed by the
 * compiler itself. The runtime package implements every function listed here.
 * A type parameter named K is a key: it must be Int, Float or String.
 * Strings join with `+` (v0.2); `concat(a, b)` is normalized to `a + b`.
 */
export const PRELUDE = `type Option[T] =
  | Some(value: T)
  | None

type Result[T, E] =
  | Ok(value: T)
  | Err(error: E)

type Error {
  message: String,
}

fn len[T](xs: List[T]) -> Int {}
fn map[A, B](xs: List[A], f: fn(A) -> B) -> List[B] {}
fn filter[A](xs: List[A], f: fn(A) -> Bool) -> List[A] {}
fn fold[A, B](xs: List[A], init: B, f: fn(B, A) -> B) -> B {}
fn sum(xs: List[Int]) -> Int {}
fn sum_float(xs: List[Float]) -> Float {}
fn sort_by[A, K](xs: List[A], key: fn(A) -> K) -> List[A] {}
fn sort_desc_by[A, K](xs: List[A], key: fn(A) -> K) -> List[A] {}
fn group_by[A, K](xs: List[A], key: fn(A) -> K) -> List[(K, List[A])] {}
fn take[A](xs: List[A], n: Int) -> List[A] {}
fn drop[A](xs: List[A], n: Int) -> List[A] {}
fn first[A](xs: List[A]) -> Option[A] {}
fn last[A](xs: List[A]) -> Option[A] {}
fn append[A](xs: List[A], x: A) -> List[A] {}
fn contains[A](xs: List[A], x: A) -> Bool {}
fn reverse[A](xs: List[A]) -> List[A] {}
fn zip[A, B](xs: List[A], ys: List[B]) -> List[(A, B)] {}
fn enumerate[A](xs: List[A]) -> List[(Int, A)] {}
fn range(start: Int, end: Int) -> List[Int] {}
fn min(a: Int, b: Int) -> Int {}
fn max(a: Int, b: Int) -> Int {}
fn abs(n: Int) -> Int {}
fn pow(base: Int, exp: Int) -> Int {}
fn to_string[T](x: T) -> String {}
fn to_float(n: Int) -> Float {}
fn to_int(x: Float) -> Int {}
fn parse_int(s: String) -> Option[Int] {}
fn parse_float(s: String) -> Option[Float] {}
fn join(parts: List[String], sep: String) -> String {}
fn split(s: String, sep: String) -> List[String] {}
fn trim(s: String) -> String {}
fn str_len(s: String) -> Int {}
fn unwrap_or[T](o: Option[T], fallback: T) -> T {}
fn map_from[K, V](pairs: List[(K, V)]) -> Map[K, V] {}
fn map_get[K, V](m: Map[K, V], k: K) -> Option[V] {}
fn map_set[K, V](m: Map[K, V], k: K, v: V) -> Map[K, V] {}
fn keys[K, V](m: Map[K, V]) -> List[K] {}
fn values[K, V](m: Map[K, V]) -> List[V] {}
fn assert(cond: Bool) -> Unit {}
fn is_some[T](o: Option[T]) -> Bool {}
fn is_email(s: String) -> Bool {}
fn verify_password(p: String, hash: String) -> Bool {}
fn get[T, K](t: Table[T, K], key: K) -> Option[T] {}
fn scan[T, K](t: Table[T, K]) -> List[T] {}
fn insert[T, K](t: Table[T, K], row: T) -> Unit {}
fn save[T, K](t: Table[T, K], row: T) -> T {}
fn delete[T, K](t: Table[T, K], key: K) -> Bool {}
fn next_id[T](t: Table[T, Int]) -> Int {}
fn count[T, K](t: Table[T, K]) -> Int {}

fn print(s: String) -> Unit
  effects: io
{}

fn read_line() -> Option[String]
  effects: io
{}

fn read_file(path: String) -> Result[String, Error]
  effects: fs
{}

fn write_file(path: String, text: String) -> Result[Unit, Error]
  effects: fs
{}

fn http_get(url: String) -> Result[String, Error]
  effects: net
{}

fn http_post(url: String, body: String) -> Result[String, Error]
  effects: net
{}

fn now() -> Int
  effects: time
{}

fn sleep(ms: Int) -> Unit
  effects: time
{}

fn random() -> Float
  effects: rand
{}

fn random_int(lo: Int, hi: Int) -> Int
  effects: rand
{}

fn uuid() -> String
  effects: rand
{}

fn hash_password(p: String) -> String
  effects: rand
{}
`;

/**
 * v0.5: the std.store built-ins. They exist only in a program that declares or imports a table,
 * so programs written before v0.5 may still name their own functions get, save or count. Each
 * call's effect is store(<its first argument>), which check.ts computes.
 */
export const STORE_BUILTINS = new Set(["get", "scan", "insert", "save", "delete", "next_id", "count"]);
