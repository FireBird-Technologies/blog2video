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


# ─── The invisible chart (template 139) ──────────────────────────────────────
#
# A generated chart scene rendered an empty panel at EVERY frame, in the editor
# preview and the exported video alike. Not data, not layout, not stale code:
#
#   Kit components take their colours from kit context, which only SceneFrame
#   provides. The scene painted its own background from props.brandColors and
#   composed <CustomChart> DIRECTLY, so there was no provider — and useKit()
#   silently falls back to a DARK default palette (bg #0B0B0F, text #FFFFFF).
#   The brand is WHITE (#FFFFFF bg, #1A1A1A text), so every axis, tick and bar
#   drew #FFFFFF on a #FFFFFF panel. Rendered, and completely invisible.
#
# Nothing could catch it: the props were right, the code was right, the layout
# measured correctly, and an invisible chart throws no error.
#
# Fixed on three fronts, each covered below: the contract tells scenes to pass
# brandColors, the stub does, and GeneratedVideo/VideoPreview provide an ambient
# palette so ALREADY-GENERATED templates are repaired with no regeneration.


def test_the_chart_contract_requires_brand_colors() -> None:
    """Without them a light-brand chart draws white-on-white."""
    body = _chart_doc()
    assert "brandColors={props.brandColors}" in body
    # And says WHY, so the next reader does not "tidy" it away.
    assert "invisible" in body.lower() or "near-white" in body.lower()


def test_the_chart_stub_passes_brand_colors() -> None:
    """The deterministic fallback wraps no SceneFrame either."""
    from app.services.code_generator import _build_stub_scene_code

    code = _build_stub_scene_code("content", {"colors": {}}, content_type="dataviz")
    assert "brandColors={props.brandColors}" in code


def test_customchart_accepts_brand_colors_directly() -> None:
    """The kit component must be usable without a SceneFrame ancestor.

    Pinned against the TSX because the failure it prevents is silent: if the
    prop were dropped, charts would go back to rendering invisibly rather than
    failing any test.
    """
    from pathlib import Path

    src = Path(__file__).resolve().parents[2] / (
        "remotion-video/src/templates/generated/kit/CustomChart.tsx"
    )
    if not src.exists():  # remotion-video not in this checkout
        import pytest as _pytest

        _pytest.skip("remotion-video not present")
    text = src.read_text(encoding="utf-8")
    assert "brandColors?:" in text, "CustomChart must accept brandColors"
    assert "useHasKitContext" in text, (
        "must distinguish real kit context from the silent dark default"
    )


# ─── Scene copy: title and display text must differ ──────────────────────────
#
# Both injected data-viz scenes carried title == display_text ("By the numbers"
# twice, "The full breakdown" twice), so eyebrowRepeatsHeadline correctly blanked
# the duplicate and each scene rendered ONE generic line where every other scene
# shows two.
#
# The cause is step order: every ordinary scene gets its display text from
# DisplayTextGenerator, and these scenes are injected AFTER that pass — so the
# injection reused the title. Measured on the live DB at the time: of 190
# built-in chart/table/ticker scenes, ZERO had the duplication, confirming it was
# custom-template-only.
#
# build_dataviz_scene_copy gives them copy of their own, derived from the bound
# table. Deterministic: no LLM, and a figure it cites came from the real rows.


def _props(headers: list[str], rows: list[list[str]]) -> dict:
    return {
        "chartTable": {"headers": headers, "rows": rows},
        "subtitle": headers[0] if headers else "",
        "yAxisLabel": headers[1] if len(headers) > 1 else "",
    }


@pytest.mark.parametrize("is_table", [False, True])
@pytest.mark.parametrize(
    "headers,rows",
    [
        (["Quarter", "Revenue"], [["Q1", "120"], ["Q2", "145"], ["Q3", "210"]]),
        (["Category", "Price"], [["A", "5"], ["B", "9"]]),          # weak x
        (["Item", "Value"], [["A", "5"], ["B", "9"]]),               # both weak
        (["Region", "Sales"], [["North", "42"]]),                    # single row
        (["Region", "Sales"], [["N", "7"], ["S", "7"]]),             # flat values
        (["Name", "City"], [["Ana", "Lisbon"], ["Bo", "Oslo"]]),     # no numbers
        ([], []),                                                     # nothing
    ],
)
def test_scene_copy_is_never_a_duplicate(headers, rows, is_table: bool) -> None:
    """THE defect: a scene whose title and display text match renders one line."""
    from app.services.chart_planner import build_dataviz_scene_copy

    title, display = build_dataviz_scene_copy(_props(headers, rows), is_table=is_table)
    assert title.strip(), "a scene always needs a title"
    assert display.strip(), "a scene always needs display text"
    assert title.strip().lower() != display.strip().lower()


def test_a_good_table_names_its_own_axes() -> None:
    """The point of deriving copy: it describes THIS article's data."""
    from app.services.chart_planner import build_dataviz_scene_copy

    title, display = build_dataviz_scene_copy(
        _props(["Quarter", "Revenue"], [["Q1", "120"], ["Q3", "210"]])
    )
    assert title == "Revenue by Quarter"
    # Cites the real range — impossible to write without the bound rows.
    assert "120" in display and "210" in display and "Q1" in display


def test_a_generic_header_falls_back_to_the_old_title() -> None:
    """"Category" is a fine axis label and a poor title noun.

    The fallbacks are the strings these scenes always used, so a weak table is
    never made WORSE than before this existed.
    """
    from app.services.chart_planner import build_dataviz_scene_copy

    chart_title, _ = build_dataviz_scene_copy(
        _props(["Category", "Price"], [["A", "5"], ["B", "9"]])
    )
    assert chart_title == "Price at a glance", "x is weak, y is not"

    both_weak, _ = build_dataviz_scene_copy(_props(["Item", "Value"], [["A", "5"]]))
    assert both_weak == "By the numbers", "the original fixed title"

    table_title, _ = build_dataviz_scene_copy(
        _props(["Related", "Last"], [["x", "1"]]), is_table=True
    )
    assert table_title == "The full breakdown", "the original fixed title"


def test_the_copy_reads_as_english() -> None:
    """Guards the two grammar traps in the templating: a plural fallback noun
    against a singular verb, and "All 1 rows"."""
    from app.services.chart_planner import build_dataviz_scene_copy

    _, weak = build_dataviz_scene_copy(_props(["Item", "Value"], [["A", "5"], ["B", "9"]]))
    assert "Values ranges" not in weak

    _, one_row = build_dataviz_scene_copy(
        _props(["Region", "Last"], [["N", "1"]]), is_table=True
    )
    assert "All 1 rows" not in one_row


def test_both_injected_scenes_get_distinct_copy() -> None:
    """End to end through the injector, which is where the duplication lived."""
    from app.services.table_extraction import append_tables_to_content

    content = append_tables_to_content(
        "Article body.",
        [
            _table(["Quarter", "Revenue"], [["Q1", "120"], ["Q2", "145"], ["Q3", "210"]]),
            _table(["Region", "Last", "Prev"], [["North", "12", "10"], ["South", "30", "28"]]),
        ],
    )
    scenes = _build_custom_dataviz_scenes(content)
    assert [s["_scene_type"] for s in scenes] == ["dataviz_chart", "dataviz_table"]
    for s in scenes:
        assert s["title"].strip().lower() != s["display_text"].strip().lower(), s
    # And the two scenes do not duplicate EACH OTHER either.
    assert scenes[0]["title"] != scenes[1]["title"]


# ─── The caption slot, and counting what is actually drawn ───────────────────
#
# Two defects seen on one frame of a real video:
#
#   1. The display text printed TWICE. Generated chart scenes commonly write
#          const caption = props.chartSummary ?? props.displayText;
#      and render both the display text and that caption. Nothing on the custom
#      path ever populated chartSummary (only the built-ins do, via an LLM
#      caption), so the fallback fired every time.
#   2. The copy said "across 6 entries" under a chart showing 3 BARS. A bar chart
#      drops every row with a negative value (filterBarChartNonNegativeRows in
#      _shared/chartData.ts), so a 6-row table with 3 negatives plots 3.


_SIGNED_TABLE = _props_signed = {
    "chartTable": {
        "headers": ["Change", "Amount", "%"],
        "rows": [
            ["Today", "-10.02", "-0.23%"],
            ["30 Days", "-292.21", "-6.30%"],
            ["6 Months", "-58.25", "-1.32%"],
            ["1 Year", "+605.90", "+16.20%"],
            ["5 Year", "+2,600.42", "+148.95%"],
            ["20 Years", "+3,756.69", "+637.22%"],
        ],
    },
    "subtitle": "Change",
    "yAxisLabel": "Amount",
    "chartType": "bar",
}


def test_the_chart_scene_gets_a_caption_of_its_own() -> None:
    """Empty chartSummary is what made the scene print one line twice."""
    from app.services.chart_planner import build_dataviz_chart_caption

    caption = build_dataviz_chart_caption(_SIGNED_TABLE)
    assert caption.strip(), "the caption slot must be filled"


def test_the_caption_never_repeats_the_display_text() -> None:
    """They sit on screen together, so they must say different things."""
    from app.services.chart_planner import (
        build_dataviz_chart_caption,
        build_dataviz_scene_copy,
    )

    title, display = build_dataviz_scene_copy(_SIGNED_TABLE)
    caption = build_dataviz_chart_caption(_SIGNED_TABLE)
    assert len({title.lower(), display.lower(), caption.lower()}) == 3


def test_a_bar_chart_counts_only_the_bars_it_draws() -> None:
    """"across 6 entries" under 3 bars reads as a broken chart.

    Three of these six rows are negative, so the bar chart plots three.
    """
    from app.services.chart_planner import (
        build_dataviz_chart_caption,
        build_dataviz_scene_copy,
    )

    _, display = build_dataviz_scene_copy(_SIGNED_TABLE)
    caption = build_dataviz_chart_caption(_SIGNED_TABLE)
    assert "3 entries" in display and "6 entries" not in display
    assert "3 change entries" in caption
    # The cited range must come from the PLOTTED rows, not the dropped negatives.
    assert "-292" not in display and "605.9" in display


def test_line_and_histogram_count_every_row() -> None:
    """Only bar charts drop negatives; the others plot the lot."""
    from app.services.chart_planner import build_dataviz_scene_copy

    for kind in ("line", "histogram"):
        props = {**_SIGNED_TABLE, "chartType": kind}
        _, display = build_dataviz_scene_copy(props)
        assert "6 entries" in display, kind


def test_the_caption_is_bound_into_layout_props() -> None:
    """End to end: the binding is what puts it where the scene reads it."""
    import json

    from app.routers.pipeline import _bind_dataviz_layout_props
    from app.services.table_extraction import append_tables_to_content

    class _Scene:
        scene_type = "dataviz_chart"
        visual_description = append_tables_to_content(
            "narration",
            [{"source": "md", **_SIGNED_TABLE["chartTable"]}],
        )

    descriptor: dict = {}
    assert _bind_dataviz_layout_props(_Scene(), descriptor)
    assert descriptor["layoutProps"].get("chartSummary"), "caption must be bound"
    json.dumps(descriptor)  # must stay serialisable


def test_a_table_scene_gets_no_chart_caption() -> None:
    """The caption is the CHART's; a table scene has no plot to describe."""
    from app.routers.pipeline import _bind_dataviz_layout_props
    from app.services.table_extraction import append_tables_to_content

    class _Scene:
        scene_type = "dataviz_table"
        visual_description = append_tables_to_content(
            "narration", [{"source": "md", **_SIGNED_TABLE["chartTable"]}]
        )

    descriptor: dict = {}
    _bind_dataviz_layout_props(_Scene(), descriptor)
    assert not descriptor["layoutProps"].get("chartSummary")
