"""
One-time capture of REAL LLM outputs, for the replay tests.

The depth suite never calls a live model in CI — instead it replays the JSON files
this script produces. Run it locally, with real API keys in your `.env`, whenever
you want to (re)capture realistic `ScriptGenerator.generate()` output:

    cd backend
    python tests/recordings/capture_llm_fixtures.py

It writes one `<name>.json` per sample into this directory. Commit those files.
The replay tests (test_depth_pipeline_postprocess.py) pick them up automatically;
until they exist, those tests skip.

NOTE: this is NOT a test and is never collected by pytest (filename has no
`test_` prefix). It is a developer tool.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

# Sample blogs to capture. Keep them small but representative. `template_id`
# matters because layout choices are template-specific.
SAMPLES = {
    "default_explainer": {
        "template_id": "default",
        "video_style": "explainer",
        "blog_content": (
            "# The Rise of Remote Work\n\n"
            "Remote work has reshaped how companies operate. In 2020, fewer than "
            "20% of knowledge workers were fully remote; by 2023 that figure passed "
            "40%.\n\n"
            "## Productivity\n\n"
            "Studies show mixed results: some teams report a 13% productivity gain, "
            "others a slight decline driven by collaboration overhead.\n\n"
            "## Costs\n\n"
            "Companies save an average of $11,000 per remote employee per year on "
            "real estate and overhead.\n\n"
            "## The Future\n\n"
            "Hybrid models — 2 to 3 office days per week — are emerging as the "
            "dominant arrangement.\n"
        ),
    },
}


async def main() -> int:
    backend_root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(backend_root))

    from app.dspy_modules import ensure_dspy_configured
    from app.dspy_modules.script_gen import ScriptGenerator

    if not (os.getenv("ANTHROPIC_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("OPEN_ROUTER_KEY")):
        print("ERROR: no LLM API key found in environment/.env — cannot capture.", file=sys.stderr)
        return 1

    ensure_dspy_configured()
    generator = ScriptGenerator()
    out_dir = Path(__file__).parent

    for name, params in SAMPLES.items():
        print(f"capturing {name} (template={params['template_id']}) …")
        result = await generator.generate(
            blog_content=params["blog_content"],
            blog_images=[],
            template_id=params["template_id"],
            video_style=params.get("video_style", "explainer"),
        )
        path = out_dir / f"{name}.json"
        path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
        n_scenes = len(result.get("scenes", []))
        print(f"  -> wrote {path.name} ({n_scenes} scenes)")

    print("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
