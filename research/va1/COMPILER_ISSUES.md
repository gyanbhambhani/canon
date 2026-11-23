
## api fn named like its .cn file (set 1/2 task authoring)

Reproduction: `canon/set_page_size.cn` containing `api fn set_page_size(r: T) -> T route: POST "/x" ...`, then `canon build`. The generated `backend/canon_generated/api.py` does `from . import service, set_page_size` and then defines the route function `def set_page_size(...)`, which shadows the module, so the body `return set_page_size.set_page_size(r)` fails with `AttributeError: function has no attribute set_page_size` (HTTP 500 on every valid request; check and fmt pass).

Workaround: name the file differently from every fn in it (the VA-1 tasks use `<fn>_rules.cn`).
