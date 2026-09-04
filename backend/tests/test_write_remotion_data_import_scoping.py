"""`write_remotion_data` used `_load_custom_template_data` twice — once near
the top (scene-type resolution) and once near the bottom (theme/font block)
— and the bottom use had its own local `from app.services.template_service
import _load_custom_template_data`. Python treats a name imported ANYWHERE in
a function body as local to the WHOLE function from its first line, so the
earlier (top) use raised `UnboundLocalError` on every call — for every
custom-template render, every time.

It was caught by a broad `try/except Exception` around scene-type resolution
(deliberately, so a failure there degrades rather than crashes a render), so
the render didn't visibly fail — it silently produced a project 1211
`data.json` missing headingFont/bodyFont/contentVariantCount and an empty
layoutConfig, exactly the symptom investigated separately in this session,
before the actual traceback surfaced the real cause.

This test pins the general invariant (any local import of this name in this
function must precede every use of it) via source inspection, so a future
edit that reintroduces a second local import after an earlier use fails CI
immediately rather than silently degrading production renders again.
"""
from __future__ import annotations

import ast
import inspect

from app.services import remotion


def _local_import_and_use_lines(func, name: str) -> tuple[list[int], list[int]]:
    src = inspect.getsource(func)
    tree = ast.parse(src)
    fn_node = tree.body[0]
    import_lines: list[int] = []
    use_lines: list[int] = []
    for node in ast.walk(fn_node):
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name == name:
                    import_lines.append(node.lineno)
        if isinstance(node, ast.Name) and node.id == name and isinstance(node.ctx, ast.Load):
            use_lines.append(node.lineno)
    return import_lines, use_lines


def test_load_custom_template_data_is_imported_once_before_every_use() -> None:
    imports, uses = _local_import_and_use_lines(
        remotion.write_remotion_data, "_load_custom_template_data"
    )
    assert imports, "expected a local import of _load_custom_template_data in write_remotion_data"
    assert len(imports) == 1, (
        f"found {len(imports)} local imports of _load_custom_template_data in "
        "write_remotion_data — a second import after the first use is exactly "
        "the bug this test exists to catch (Python scopes the name to the "
        "WHOLE function once it's imported anywhere in it, so an earlier use "
        "raises UnboundLocalError)"
    )
    assert uses, "expected write_remotion_data to actually use _load_custom_template_data"
    first_import = imports[0]
    for use_line in uses:
        assert use_line > first_import, (
            f"_load_custom_template_data used at relative line {use_line} before "
            f"its import at relative line {first_import} — this raises "
            "UnboundLocalError at runtime"
        )


def test_the_bug_symptom_stays_fixed_for_any_similarly_shadowed_name() -> None:
    """A cheaper general form of the same check: no local import inside
    write_remotion_data may be preceded by a load of the same name anywhere
    earlier in the function body."""
    src = inspect.getsource(remotion.write_remotion_data)
    tree = ast.parse(src)
    fn_node = tree.body[0]

    imported_names: dict[str, int] = {}
    for node in ast.walk(fn_node):
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                local_name = alias.asname or alias.name
                # Keep the EARLIEST import line per name.
                if local_name not in imported_names or node.lineno < imported_names[local_name]:
                    imported_names[local_name] = node.lineno

    for node in ast.walk(fn_node):
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            if node.id in imported_names:
                assert node.lineno >= imported_names[node.id], (
                    f"'{node.id}' is used at relative line {node.lineno} before its "
                    f"local import at relative line {imported_names[node.id]} in "
                    "write_remotion_data — this raises UnboundLocalError at runtime"
                )
