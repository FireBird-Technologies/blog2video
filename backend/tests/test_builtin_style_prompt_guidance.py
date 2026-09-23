import asyncio
from types import SimpleNamespace

from app.dspy_modules.script_gen import BlogToScript, SceneExpander, ScriptGenerator


def test_script_generator_passes_authoritative_guidance_to_both_stages():
    seen: dict[str, dict] = {}

    async def outline(**kwargs):
        seen["outline"] = kwargs
        return SimpleNamespace(
            title="A title",
            narrative_summary="A coherent summary.",
            scenes_json='[{"title":"Opening","key_point":"The central idea.","preferred_layout":""}]',
        )

    async def expand(**kwargs):
        seen["expand"] = kwargs
        return SimpleNamespace(
            narration="A concise narration grounded in the supplied writing rules.",
            visual_description="A specific visual.",
            preferred_layout="",
            suggested_images_json="[]",
            duration_seconds=6,
            cta_button_text="",
        )

    generator = object.__new__(ScriptGenerator)
    generator.generator = outline
    generator.expander = expand
    guidance = "Use dry humor. Keep each scene between 18 and 22 words."

    asyncio.run(
        generator.generate(
            blog_content="Source material.",
            blog_images=[],
            video_style="explainer",
            style_guidance=guidance,
        )
    )

    assert seen["outline"]["style_guidance"] == guidance
    assert seen["expand"]["style_guidance"] == guidance


def test_generation_prompts_define_default_length_when_guidance_omits_it():
    assert "12 and 25 words" in (BlogToScript.__doc__ or "")
    assert "12 and 25 words" in (SceneExpander.__doc__ or "")
