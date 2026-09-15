"""The always-present data-visualisation scene for custom templates.

Custom templates used to get their chart scene ONLY when the article happened to
contain a chartable table — the injector returned [] otherwise. Since every
custom template now DESIGNS its own chart layout (a required design-doc role),
a template could carry a chart scene it never showed. The chart scene is
therefore always built, seeded when there is no real data.

The TABLE scene is still data-only: it transcribes real figures, so a seeded one
would present the placeholder as though it were the article's own data.
"""
from __future__ import annotations

import pytest

from app.routers.pipeline import (
    _CUSTOM_DATAVIZ_SEED,
    _build_custom_dataviz_scenes,
)
from app.services.chart_planner import _build_chart_props_from_table
from app.services.table_extraction import append_tables_to_content


def _types(scenes: list[dict]) -> list[str]:
    return [s["_scene_type"] for s in scenes]


def _table(headers: list[str], rows: list[list[str]]) -> dict:
    return {"source": "markdown", "headers": headers, "rows": rows}


# ─── The guarantee ───────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "content",
    [
        "",
        "A blog post about cycling with no figures at all.",
        "Prose with a number like 42 in it but no table.",
    ],
)
def test_the_chart_scene_is_built_even_with_no_chartable_data(content: str) -> None:
    """The bug: no table meant no chart scene, so the designed layout never ran."""
    scenes = _build_custom_dataviz_scenes(content)
    assert _types(scenes) == ["dataviz_chart"]
    assert scenes[0]["preferred_layout"] == "custom_chart"


def test_a_seeded_chart_carries_the_placeholder_table() -> None:
    """It must render and stay editable, not plot an empty frame."""
    scene = _build_custom_dataviz_scenes("No tables here.")[0]
    # The bound table round-trips through visual_description into layoutProps.
    assert _CUSTOM_DATAVIZ_SEED["headers"][0] in scene["visual_description"]


def test_a_seeded_chart_plots_as_a_line() -> None:
    """The seed's labels are time-like, so "auto" and "line" agree on it.

    A seed that inferred a different kind than it declares would make the
    editor's chart-type dropdown disagree with what is drawn.
    """
    props = _build_chart_props_from_table(
        _table(_CUSTOM_DATAVIZ_SEED["headers"], _CUSTOM_DATAVIZ_SEED["rows"])
    )
    assert props["chartType"] == "line"


def test_the_table_scene_is_still_data_only() -> None:
    """A seeded table would present placeholder figures as the article's own."""
    assert "dataviz_table" not in _types(_build_custom_dataviz_scenes("No tables."))


def test_real_data_produces_both_scenes() -> None:
    content = append_tables_to_content(
        "Article body.",
        [
            _table(["Quarter", "Users"], [["Q1", "100"], ["Q2", "150"], ["Q3", "220"]]),
            _table(["Region", "Sales"], [["North", "12"], ["South", "30"]]),
        ],
    )
    assert _types(_build_custom_dataviz_scenes(content)) == [
        "dataviz_chart",
        "dataviz_table",
    ]


def test_a_real_table_is_preferred_over_the_seed() -> None:
    content = append_tables_to_content(
        "Body.",
        [_table(["Month", "Signups"], [["Jan", "10"], ["Feb", "20"], ["Mar", "35"]])],
    )
    vd = _build_custom_dataviz_scenes(content)[0]["visual_description"]
    assert "Signups" in vd
    assert "Revenue" not in vd, "the seed must not override real article data"


# ─── Chart kind is chosen from the data's shape ──────────────────────────────


@pytest.mark.parametrize(
    "headers,rows,expected",
    [
        # Time-like first column -> a trend over time.
        (["Quarter", "Revenue"],
         [["Q1", "10"], ["Q2", "20"], ["Q3", "30"]], "line"),
        (["Year", "Users"],
         [["2021", "5"], ["2022", "9"], ["2023", "14"]], "line"),
        # Numeric ranges -> a distribution.
        (["Price band", "Count"],
         [["100-200", "5"], ["200-300", "9"], ["300-400", "14"]], "histogram"),
        (["Age band", "Count"],
         [["<10", "5"], ["10-20", "9"], [">30", "14"]], "histogram"),
        # Named categories -> a comparison.
        (["Region", "Sales"],
         [["North", "12"], ["South", "30"], ["East", "18"]], "bar"),
    ],
)
def test_the_chart_kind_follows_the_data_format(headers, rows, expected) -> None:
    """One scene draws all three kinds; the data decides which.

    This is the mapping the whole feature rests on — the scene is generic and
    the table is what makes it a line, bar or histogram.
    """
    assert _build_chart_props_from_table(_table(headers, rows))["chartType"] == expected


def test_a_table_with_no_numbers_is_not_chartable() -> None:
    """Nothing to plot — such a table must not reach the chart scene."""
    assert _build_chart_props_from_table(
        _table(["Name", "City"], [["Ana", "Lisbon"], ["Bo", "Oslo"]])
    ) == {}


def test_two_digit_bins_are_read_as_a_time_range_not_a_distribution() -> None:
    """A PRE-EXISTING backend/frontend divergence, pinned so it is not mistaken
    for a regression in the chart scene.

    `_TIME_LIKE_RE` matches "10-20" as a year range (the "2023-24" form) and the
    time check runs before the bucket check, so two-digit bins resolve to "line"
    here. chartData.ts's `hasTimeLikeLabels` requires a date shape and would
    infer "histogram" for the same labels under chartType "auto".

    Three-digit bins ("100-200") and open-ended ones ("<10") are unambiguous and
    resolve to "histogram" on both sides — see the parametrised test above.

    Not fixed here: the two regexes are the shared contract for every template,
    built-in ones included, so changing them is a separate piece of work.
    """
    props = _build_chart_props_from_table(
        _table(["Age band", "Count"],
               [["0-10", "5"], ["10-20", "9"], ["20-30", "14"]])
    )
    assert props["chartType"] == "line"


# ─── The generated scene composes the kit chart ──────────────────────────────


def test_a_stubbed_chart_scene_still_plots() -> None:
    """The stub is the floor when codegen fails after every repair.

    A prose stub in the chart slot would leave the template with a chart layout
    that draws a headline and empty space, which is the failure this whole change
    exists to remove.
    """
    from app.services.code_generator import _build_stub_scene_code
    from app.services.code_validator import validate_component_code

    code = _build_stub_scene_code("content", {"colors": {}}, content_type="dataviz")
    assert "CustomChart" in code
    # minHeight:0 is what gives the plot a resolved height inside a flex column.
    assert "minHeight: 0" in code
    valid, err = validate_component_code(code)
    assert valid, err


def test_an_ordinary_stub_has_no_chart() -> None:
    """Only the chart scene composes CustomChart."""
    from app.services.code_generator import _build_stub_scene_code

    for ct in (None, "plain", "bullets"):
        assert "CustomChart" not in _build_stub_scene_code(
            "content", {"colors": {}}, content_type=ct
        )


def test_customchart_is_injected_into_generated_scene_code() -> None:
    """The chart scene composes <CustomChart>, so it must be a kit global.

    Generated scene code carries no imports — the wrapper injects the kit from
    KIT_EXPORT_NAMES. If CustomChart ever left that manifest, every generated
    chart scene would fail at module evaluation.
    """
    from app.services.remotion import _wrap_generated_code

    header = _wrap_generated_code("const SceneComponent = (props) => null;")
    assert "CustomChart" in header


# ─── Sample chart data for the editor / gallery preview ──────────────────────
#
# A PROJECT's chart scene is bound to a real table by the pipeline. A TEMPLATE
# has no article, so its chart scene previews from scene_sample_content — which
# must always carry something plottable, or the editor and the gallery show an
# empty plot on an otherwise finished template.


def _sample(payload: dict) -> dict:
    import json

    from app.services.code_generator import _parse_sample_content

    return _parse_sample_content(json.dumps(payload), "dataviz")


_COPY = {
    "sceneTitle": "Rides that show up in minutes",
    "displayText": "Wait times fell across every city we serve this year.",
}


def test_brand_written_sample_chart_data_is_kept() -> None:
    """Numbers are coerced to strings; the brand's own figures survive."""
    out = _sample({
        **_COPY,
        "chartTable": {"headers": ["Quarter", "Avg wait"],
                       "rows": [["Q1", 8], ["Q2", "6"], ["Q3", "5"]]},
        "chartType": "line",
    })
    assert out["chartTable"]["rows"][0] == ["Q1", "8"]
    assert out["chartType"] == "line"


@pytest.mark.parametrize(
    "table",
    [
        None,                                             # omitted entirely
        {"headers": ["A"], "rows": [["x"], ["y"]]},        # single column
        {"headers": ["A", "B"], "rows": [["x", "y"]]},     # one row
        {"headers": ["A", "B"], "rows": [["x", "y"], ["p", "q"]]},  # no numbers
        {"headers": ["A", "B"], "rows": [["x", "1"], ["y"]]},       # ragged
        "not a table",
    ],
)
def test_an_unusable_sample_table_is_seeded_rather_than_dropped(table) -> None:
    """The copy is good even when the table is not — returning {} would discard
    a perfectly good title and leave the scene with no sample at all."""
    payload = dict(_COPY)
    if table is not None:
        payload["chartTable"] = table
    out = _sample(payload)
    assert out["sceneTitle"] == _COPY["sceneTitle"], "copy must survive"
    assert out["chartTable"]["rows"], "a chart scene must always have something to plot"


def test_an_invalid_chart_type_falls_back_to_the_seed_default() -> None:
    """There is no pie chart; only line/bar/histogram/auto are drawable."""
    out = _sample({**_COPY, "chartType": "pie"})
    assert out["chartType"] in ("auto", "line", "bar", "histogram")


def test_the_sample_seed_and_the_pipeline_seed_are_the_same_table() -> None:
    """Two seeds would let the editor preview and a seeded project scene plot
    different placeholder data for the same template."""
    from app.services.scene_content_schema import SAMPLE_CHART_TABLE

    assert _CUSTOM_DATAVIZ_SEED == SAMPLE_CHART_TABLE


# ─── The chart scene must PLOT (template 139's empty panel) ──────────────────
#
# Template 139's generated chart scene rendered a permanently empty panel — in
# the editor and in every video from that template. Two causes, both here:
#
#   1. CustomChart was on the validator's FORBIDDEN list, so the model was told
#      to build the chart itself.
#   2. It did, and opened with
#          const raw = Array.isArray(props.chartTable) ? props.chartTable : [];
#      but chartTable is an OBJECT { headers, rows } — always [], so nothing
#      plotted. Nothing caught it: the prop WAS read, the JSX was valid, and an
#      empty <svg> neither throws nor yields an empty tree.


def _chart_doc() -> str:
    from app.services.code_generator import _format_scene_doc

    return _format_scene_doc({
        "id": "plotted", "role": "content", "content_type": "dataviz",
        "doc": "A data-visualisation scene.", "supports_image": False,
    })


def test_customchart_is_allowed_in_generated_scene_code() -> None:
    """Forbidding it is what made the model hand-roll a broken chart."""
    from app.services.code_validator import (
        ALLOWED_KIT_NAMES,
        _forbidden_kit_names,
    )

    assert "CustomChart" in ALLOWED_KIT_NAMES
    assert _forbidden_kit_names(
        "const S = (p) => <CustomChart chartTable={p.chartTable} />;"
    ) == []


def test_a_chart_scene_without_customchart_is_rejected() -> None:
    """The machine check behind the prose contract."""
    from app.services.code_validator import validate_component_code

    hand_rolled = """const SceneComponent = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const isPortrait = props.aspectRatio === 'portrait';
  const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');
  const rows = Array.isArray(props.chartTable) ? props.chartTable : [];
  const a = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const b = spring({ frame, fps, config: { damping: 20 } });
  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: a * b }}>
      {props.logoUrl && typeof props.logoUrl === 'string' && (
        <Img src={props.logoUrl} data-logo="1" style={{width: 190, height: 'auto'}} />
      )}
      <svg viewBox="0 0 100 100"><path d={rows.map((r) => r.value).join(' ')} /></svg>
    </AbsoluteFill>
  );
};"""
    valid, err = validate_component_code(hand_rolled, "content", scene_doc=_chart_doc())
    assert not valid
    assert "CustomChart" in str(err)


def test_treating_the_chart_table_as_an_array_is_rejected() -> None:
    """`Array.isArray(props.chartTable)` is ALWAYS false — it is an object.

    Caught even when the scene also renders CustomChart, so a future scene
    cannot reintroduce the silent-empty path alongside a working plot.
    """
    from app.services.code_validator import validate_component_code

    code = """const SceneComponent = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const isPortrait = props.aspectRatio === 'portrait';
  const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');
  const rows = Array.isArray(props.chartTable) ? props.chartTable : [];
  const a = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const b = spring({ frame, fps, config: { damping: 20 } });
  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: a * b }}>
      {props.logoUrl && typeof props.logoUrl === 'string' && (
        <Img src={props.logoUrl} data-logo="1" style={{width: 190, height: 'auto'}} />
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CustomChart chartTable={props.chartTable} chartType={props.chartType} />
      </div>
      <div>{rows.length}</div>
    </AbsoluteFill>
  );
};"""
    valid, err = validate_component_code(code, "content", scene_doc=_chart_doc())
    assert not valid
    assert "never an array" in str(err)


def test_the_chart_stub_passes_its_own_design_doc() -> None:
    """The floor must satisfy the gate it is the fallback for — including the
    image-less rule, since the chart scene never takes an image."""
    from app.services.code_generator import _build_stub_scene_code
    from app.services.code_validator import validate_component_code

    code = _build_stub_scene_code("content", {"colors": {}}, content_type="dataviz")
    assert "data-content-img" not in code, "the chart scene reserves no image slot"
    valid, err = validate_component_code(code, "content", scene_doc=_chart_doc())
    assert valid, err


# ─── Switching the chart kind from the template editor ───────────────────────
#
# One scene draws line, bar and histogram; chartType picks which. That choice is
# part of the TEMPLATE's design ("this brand plots bars"), so it is edited in the
# template editor and stored with the scene's sample copy — PATCH
# /custom-templates/{id}/scenes/{scene_key}/chart.


def _tpl_with_chart_sample():
    import json

    class _T:
        scene_sample_content = json.dumps({
            "content": [
                {},
                {
                    "sceneTitle": "Crude Oil Benchmarks Over Four Years",
                    "displayText": "WTI spot prices tracked quarterly.",
                    "chartTable": {"headers": ["Quarter", "WTI"],
                                   "rows": [["2021 Q1", "58"], ["2021 Q3", "68"]]},
                    "chartType": "line",
                },
            ]
        })

    return _T()


def test_switching_the_chart_kind_keeps_the_copy_and_table() -> None:
    """The route owns chartType/chartTable only — it must not drop the scene's
    generated title, copy or (when only the kind changed) its figures."""
    from app.routers.custom_templates import (
        _read_scene_indexed_field,
        _write_scene_indexed_field,
    )

    tpl = _tpl_with_chart_sample()
    current = _read_scene_indexed_field(tpl, "scene_sample_content", "content", 1)
    _write_scene_indexed_field(
        tpl, "scene_sample_content", "content", 1, {**current, "chartType": "bar"}
    )
    after = _read_scene_indexed_field(tpl, "scene_sample_content", "content", 1)

    assert after["chartType"] == "bar"
    assert after["sceneTitle"] == "Crude Oil Benchmarks Over Four Years"
    assert after["chartTable"]["rows"] == [["2021 Q1", "58"], ["2021 Q3", "68"]]


def test_the_indexed_read_and_write_address_the_same_slot() -> None:
    """A read-modify-write of one scene must not land on a different one."""
    from app.routers.custom_templates import (
        _read_scene_indexed_field,
        _write_scene_indexed_field,
    )

    tpl = _tpl_with_chart_sample()
    _write_scene_indexed_field(
        tpl, "scene_sample_content", "content", 1, {"chartType": "histogram"}
    )
    assert _read_scene_indexed_field(
        tpl, "scene_sample_content", "content", 1
    ) == {"chartType": "histogram"}
    # Its neighbour is untouched.
    assert _read_scene_indexed_field(tpl, "scene_sample_content", "content", 0) == {}


def test_an_out_of_range_or_missing_entry_reads_as_none() -> None:
    from app.routers.custom_templates import _read_scene_indexed_field

    tpl = _tpl_with_chart_sample()
    assert _read_scene_indexed_field(tpl, "scene_sample_content", "content", 99) is None
    assert _read_scene_indexed_field(tpl, "scene_sample_content", "intro", -1) is None


@pytest.mark.parametrize("kind", ["auto", "line", "bar", "histogram"])
def test_every_offered_chart_kind_is_accepted(kind: str) -> None:
    """The editor's four options must all be storable."""
    from app.services.scene_content_schema import CHART_TYPES, coerce_field

    assert kind in CHART_TYPES
    assert coerce_field("chartType", kind) == kind


@pytest.mark.parametrize("kind", ["pie", "donut", "scatter", ""])
def test_an_undrawable_chart_kind_is_rejected(kind: str) -> None:
    """CustomChart draws three kinds; anything else would silently fall back."""
    from app.services.scene_content_schema import CHART_TYPES

    assert kind not in CHART_TYPES
