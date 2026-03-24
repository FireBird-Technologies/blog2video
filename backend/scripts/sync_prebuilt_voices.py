import json
import os
import sys
from collections import defaultdict
from argparse import ArgumentParser

CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from elevenlabs import ElevenLabs
from app.config import settings
from app.database import SessionLocal
from app.constants import FREE_PREMADE_VOICE_IDS as KNOWN_PREMADE_VOICE_IDS
from app.constants import FREE_PREMADE_FALLBACK
from app.models.prebuilt_voice import PrebuiltVoice
from app.models.saved_voice import SavedVoice
from app.models.user import User
from app.services.elevenlabs_voice_design import get_voice_metadata

TARGET_PREBUILT_CATALOG_SIZE = 30


def _fetch_live_premade_catalog() -> list[dict]:
    client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
    try:
        voices_response = client.voices.get_all(show_legacy=True)
    except TypeError:
        voices_response = client.voices.get_all()

    rows: list[dict] = []
    for v in voices_response.voices:
        voice_id = getattr(v, "voice_id", None) or getattr(v, "id", None)
        if not voice_id:
            continue
        category = getattr(v, "category", None)
        if category != "premade" and voice_id not in KNOWN_PREMADE_VOICE_IDS:
            continue
        labels = getattr(v, "labels", None) or {}
        labels_json = json.dumps(labels) if isinstance(labels, dict) else "{}"
        rows.append(
            {
                "voice_id": voice_id,
                "name": getattr(v, "name", None) or "",
                "preview_url": getattr(v, "preview_url", None),
                "labels_json": labels_json,
                "description": (getattr(v, "description", None) or "") or None,
                "plan": "free" if voice_id in KNOWN_PREMADE_VOICE_IDS else "paid",
            }
        )
    return rows


def _build_row_from_metadata(voice_id: str, fallback_name: str | None = None) -> dict:
    meta = get_voice_metadata(voice_id) or {}
    labels = meta.get("labels", {}) if isinstance(meta.get("labels"), dict) else {}
    return {
        "voice_id": voice_id,
        "name": (meta.get("name") or fallback_name or voice_id),
        "preview_url": (meta.get("preview_url") or None),
        "labels_json": json.dumps(labels) if isinstance(labels, dict) else "{}",
        "description": (meta.get("description") or "") or None,
        "plan": "free" if voice_id in KNOWN_PREMADE_VOICE_IDS else "paid",
    }


def _choose_free_voice_ids(rows: list[PrebuiltVoice], target_free_count: int = 4) -> set[str]:
    """Pick exactly target_free_count voice IDs to mark as free."""
    preferred = [vid for vid in KNOWN_PREMADE_VOICE_IDS if any(r.voice_id == vid for r in rows)]
    chosen = list(preferred[:target_free_count])
    if len(chosen) < target_free_count:
        remaining = sorted(
            [r.voice_id for r in rows if r.voice_id not in chosen],
            key=lambda v: v,
        )
        chosen.extend(remaining[: target_free_count - len(chosen)])
    return set(chosen)


def sync_prebuilt_voices(dry_run: bool = False, rebuild_catalog: bool = False) -> dict[str, int]:
    db = SessionLocal()
    updated_prebuilt = 0
    scanned_prebuilt = 0
    updated_saved = 0
    scanned_saved = 0
    failed = 0
    deduped_prebuilt = 0
    deduped_saved = 0
    inserted_prebuilt = 0
    deleted_prebuilt = 0
    collapsed_alias_prebuilt = 0
    plan_adjusted_prebuilt = 0
    plan_adjusted_saved = 0
    replaced_saved_prebuilt_users = 0
    replaced_saved_prebuilt_deleted = 0
    replaced_saved_prebuilt_inserted = 0
    try:
        if rebuild_catalog:
            live_rows = _fetch_live_premade_catalog()
            # Collapse exact metadata duplicates (aliases): same visible payload, different voice_id.
            # Keep the first deterministic voice_id (lexicographically) for stable catalogs.
            grouped: dict[tuple[str, str, str, str], list[dict]] = defaultdict(list)
            for row in live_rows:
                key = (
                    row["name"] or "",
                    row["preview_url"] or "",
                    row["labels_json"] or "{}",
                    row["description"] or "",
                )
                grouped[key].append(row)
            canonical_rows: list[dict] = []
            alias_pool: list[dict] = []
            for group in grouped.values():
                # Never drop configured free IDs when aliases share the same metadata.
                preferred = [r for r in group if r["voice_id"] in KNOWN_PREMADE_VOICE_IDS]
                if preferred:
                    keep = sorted(preferred, key=lambda r: str(r["voice_id"]))[0]
                else:
                    keep = sorted(group, key=lambda r: str(r["voice_id"]))[0]
                canonical_rows.append(keep)
                for item in group:
                    if item["voice_id"] != keep["voice_id"]:
                        alias_pool.append(item)
                collapsed_alias_prebuilt += max(0, len(group) - 1)

            # Ensure 4 configured free IDs always exist in catalog.
            canonical_by_id = {r["voice_id"]: r for r in canonical_rows}
            for item in FREE_PREMADE_FALLBACK:
                vid = item["voice_id"]
                if vid in canonical_by_id:
                    continue
                try:
                    row = _build_row_from_metadata(vid, fallback_name=item["name"])
                except Exception:
                    row = {
                        "voice_id": vid,
                        "name": item["name"],
                        "preview_url": None,
                        "labels_json": "{}",
                        "description": None,
                        "plan": "free",
                    }
                canonical_rows.append(row)
                canonical_by_id[vid] = row

            # Ensure rebuild catalog has at least TARGET_PREBUILT_CATALOG_SIZE rows.
            if len(canonical_rows) < TARGET_PREBUILT_CATALOG_SIZE:
                for item in sorted(alias_pool, key=lambda r: str(r["voice_id"])):
                    if item["voice_id"] in canonical_by_id:
                        continue
                    canonical_rows.append(item)
                    canonical_by_id[item["voice_id"]] = item
                    if len(canonical_rows) >= TARGET_PREBUILT_CATALOG_SIZE:
                        break

            # If more than target, trim deterministically but keep the 4 free IDs.
            if len(canonical_rows) > TARGET_PREBUILT_CATALOG_SIZE:
                must_keep = {i["voice_id"] for i in FREE_PREMADE_FALLBACK}
                kept = [r for r in canonical_rows if r["voice_id"] in must_keep]
                rest = sorted(
                    [r for r in canonical_rows if r["voice_id"] not in must_keep],
                    key=lambda r: str(r["voice_id"]),
                )
                remaining_slots = max(0, TARGET_PREBUILT_CATALOG_SIZE - len(kept))
                canonical_rows = kept + rest[:remaining_slots]

            existing = db.query(PrebuiltVoice).all()
            existing_by_voice_id = {r.voice_id: r for r in existing}
            live_voice_ids = {r["voice_id"] for r in canonical_rows}

            # Delete rows not present in live canonical catalog.
            for row in existing:
                if row.voice_id not in live_voice_ids:
                    db.delete(row)
                    deleted_prebuilt += 1

            # Upsert live rows.
            for row in canonical_rows:
                cur = existing_by_voice_id.get(row["voice_id"])
                if cur is None:
                    db.add(
                        PrebuiltVoice(
                            voice_id=row["voice_id"],
                            name=row["name"],
                            preview_url=row["preview_url"],
                            labels=row["labels_json"],
                            description=row["description"],
                            plan=row["plan"],
                        )
                    )
                    inserted_prebuilt += 1
                    continue

                changed = False
                if cur.name != row["name"]:
                    cur.name = row["name"]
                    changed = True
                if cur.preview_url != row["preview_url"]:
                    cur.preview_url = row["preview_url"]
                    changed = True
                if cur.labels != row["labels_json"]:
                    cur.labels = row["labels_json"]
                    changed = True
                if cur.description != row["description"]:
                    cur.description = row["description"]
                    changed = True
                if cur.plan != row["plan"]:
                    cur.plan = row["plan"]
                    changed = True
                if changed:
                    updated_prebuilt += 1

        # Deduplicate prebuilt_voices by voice_id (keep most recently updated, fallback highest id)
        pb_rows = db.query(PrebuiltVoice).all()
        pb_groups: dict[str, list[PrebuiltVoice]] = defaultdict(list)
        for row in pb_rows:
            pb_groups[row.voice_id].append(row)
        for voice_id, group in pb_groups.items():
            if len(group) <= 1:
                continue
            keep = sorted(
                group,
                key=lambda r: (
                    r.updated_at.isoformat() if getattr(r, "updated_at", None) else "",
                    r.id,
                ),
                reverse=True,
            )[0]
            for row in group:
                if row.id == keep.id:
                    continue
                db.delete(row)
                deduped_prebuilt += 1
            print(f"[sync-prebuilt] dedup prebuilt voice_id={voice_id}: removed={len(group)-1}, kept_id={keep.id}")

        # Enforce exactly 4 free voices in prebuilt_voices.
        pb_rows = db.query(PrebuiltVoice).all()
        free_ids = _choose_free_voice_ids(pb_rows, target_free_count=4)
        for row in pb_rows:
            desired_plan = "free" if row.voice_id in free_ids else "paid"
            if row.plan != desired_plan:
                row.plan = desired_plan
                plan_adjusted_prebuilt += 1

        # Deduplicate saved prebuilt voices by (user_id, voice_id) (keep newest id)
        sv_rows = (
            db.query(SavedVoice)
            .filter(SavedVoice.source == "prebuilt")
            .all()
        )
        sv_groups: dict[tuple[int, str], list[SavedVoice]] = defaultdict(list)
        for row in sv_rows:
            sv_groups[(row.user_id, row.voice_id)].append(row)
        for key, group in sv_groups.items():
            if len(group) <= 1:
                continue
            keep = sorted(
                group,
                key=lambda r: (
                    r.created_at.isoformat() if getattr(r, "created_at", None) else "",
                    r.id,
                ),
                reverse=True,
            )[0]
            for row in group:
                if row.id == keep.id:
                    continue
                db.delete(row)
                deduped_saved += 1
            print(
                f"[sync-prebuilt] dedup saved user_id={key[0]} voice_id={key[1]}: removed={len(group)-1}, kept_id={keep.id}"
            )

        # Keep saved prebuilt rows aligned with the 4-free policy.
        # Replace each user's prebuilt saved voices with the current 4 free voices.
        free_rows = (
            db.query(PrebuiltVoice)
            .filter(PrebuiltVoice.voice_id.in_(free_ids))
            .all()
        )
        free_rows_by_id = {r.voice_id: r for r in free_rows}
        free_ids_in_seed_order = [item["voice_id"] for item in FREE_PREMADE_FALLBACK if item["voice_id"] in free_ids]
        # If any selected free id is not in fallback ordering, append deterministically.
        for vid in sorted(list(free_ids)):
            if vid not in free_ids_in_seed_order:
                free_ids_in_seed_order.append(vid)

        users = db.query(User.id).all()
        for (uid,) in users:
            existing_prebuilt = (
                db.query(SavedVoice)
                .filter(SavedVoice.user_id == uid, SavedVoice.source == "prebuilt")
                .all()
            )
            if existing_prebuilt:
                for row in existing_prebuilt:
                    db.delete(row)
                replaced_saved_prebuilt_deleted += len(existing_prebuilt)

            for vid in free_ids_in_seed_order:
                row = free_rows_by_id.get(vid)
                fallback = next((f for f in FREE_PREMADE_FALLBACK if f["voice_id"] == vid), None)
                db.add(
                    SavedVoice(
                        user_id=uid,
                        voice_id=vid,
                        name=(row.name if row else (fallback["name"] if fallback else vid)),
                        preview_url=(row.preview_url if row else None),
                        source="prebuilt",
                        plan="free",
                        gender=None,
                        accent=None,
                        description=(row.description if row else None),
                        custom_voice_id=None,
                    )
                )
                replaced_saved_prebuilt_inserted += 1
            replaced_saved_prebuilt_users += 1

        rows = db.query(PrebuiltVoice).order_by(PrebuiltVoice.name).all()
        metadata_by_voice_id: dict[str, dict] = {}
        for row in rows:
            scanned_prebuilt += 1
            try:
                meta = get_voice_metadata(row.voice_id) or {}
                metadata_by_voice_id[row.voice_id] = meta
                labels = meta.get("labels", {}) if isinstance(meta.get("labels"), dict) else {}
                next_preview = (meta.get("preview_url") or "").strip() or None
                next_description = (meta.get("description") or "").strip() if isinstance(meta.get("description"), str) else None
                next_name = (meta.get("name") or "").strip() if isinstance(meta.get("name"), str) else None

                changed = False
                if next_preview and row.preview_url != next_preview:
                    row.preview_url = next_preview
                    changed = True
                if labels:
                    labels_json = json.dumps(labels)
                    if row.labels != labels_json:
                        row.labels = labels_json
                        changed = True
                if next_description is not None and row.description != next_description:
                    row.description = next_description
                    changed = True
                if next_name and row.name != next_name:
                    row.name = next_name
                    changed = True

                if changed:
                    updated_prebuilt += 1
            except Exception as exc:
                failed += 1
                print(f"[sync-prebuilt] failed voice_id={row.voice_id}: {exc}")

        # Also sync saved voices that are prebuilt copies.
        saved_rows = (
            db.query(SavedVoice)
            .filter(SavedVoice.source == "prebuilt")
            .all()
        )
        for row in saved_rows:
            scanned_saved += 1
            try:
                meta = metadata_by_voice_id.get(row.voice_id)
                if meta is None:
                    meta = get_voice_metadata(row.voice_id) or {}
                    metadata_by_voice_id[row.voice_id] = meta
                labels = meta.get("labels", {}) if isinstance(meta.get("labels"), dict) else {}
                next_preview = (meta.get("preview_url") or "").strip() or None
                next_gender = (labels.get("gender") or "").strip() if isinstance(labels.get("gender"), str) else None
                next_accent = (labels.get("accent") or "").strip() if isinstance(labels.get("accent"), str) else None
                next_description = (meta.get("description") or "").strip() if isinstance(meta.get("description"), str) else None

                changed = False
                if next_preview and row.preview_url != next_preview:
                    row.preview_url = next_preview
                    changed = True
                if next_gender and row.gender != next_gender:
                    row.gender = next_gender
                    changed = True
                if next_accent and row.accent != next_accent:
                    row.accent = next_accent
                    changed = True
                if next_description is not None and row.description != next_description:
                    row.description = next_description
                    changed = True
                if changed:
                    updated_saved += 1
            except Exception as exc:
                failed += 1
                print(f"[sync-prebuilt] failed saved voice id={row.id} voice_id={row.voice_id}: {exc}")

        if dry_run:
            db.rollback()
        else:
            db.commit()
    finally:
        db.close()

    return {
        "scanned_prebuilt": scanned_prebuilt,
        "updated_prebuilt": updated_prebuilt,
        "inserted_prebuilt": inserted_prebuilt,
        "deleted_prebuilt": deleted_prebuilt,
        "collapsed_alias_prebuilt": collapsed_alias_prebuilt,
        "plan_adjusted_prebuilt": plan_adjusted_prebuilt,
        "scanned_saved": scanned_saved,
        "updated_saved": updated_saved,
        "plan_adjusted_saved": plan_adjusted_saved,
        "replaced_saved_prebuilt_users": replaced_saved_prebuilt_users,
        "replaced_saved_prebuilt_deleted": replaced_saved_prebuilt_deleted,
        "replaced_saved_prebuilt_inserted": replaced_saved_prebuilt_inserted,
        "deduped_prebuilt": deduped_prebuilt,
        "deduped_saved": deduped_saved,
        "failed": failed,
        "dry_run": int(dry_run),
    }


if __name__ == "__main__":
    parser = ArgumentParser(description="Refresh prebuilt metadata in prebuilt_voices and saved_voices from ElevenLabs.")
    parser.add_argument("--dry-run", action="store_true", help="Compute updates without writing to DB.")
    parser.add_argument(
        "--rebuild-catalog",
        action="store_true",
        help="Rebuild prebuilt_voices from live ElevenLabs premade catalog and remove stale rows.",
    )
    args = parser.parse_args()

    result = sync_prebuilt_voices(dry_run=args.dry_run, rebuild_catalog=args.rebuild_catalog)
    print(
        "[sync-prebuilt] prebuilt: scanned={scanned_prebuilt} inserted={inserted_prebuilt} updated={updated_prebuilt} deleted={deleted_prebuilt} aliases_collapsed={collapsed_alias_prebuilt} deduped={deduped_prebuilt} plan_adjusted={plan_adjusted_prebuilt} | saved(prebuilt): scanned={scanned_saved} updated={updated_saved} deduped={deduped_saved} plan_adjusted={plan_adjusted_saved} replaced_users={replaced_saved_prebuilt_users} replaced_deleted={replaced_saved_prebuilt_deleted} replaced_inserted={replaced_saved_prebuilt_inserted} | failed={failed} dry_run={dry_run}".format(
            **result
        )
    )
