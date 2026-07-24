---
title: Avatar Service
emoji: 🗣️
colorFrom: purple
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

MuseTalk-backed talking-avatar rendering service for blog2video. See `/prepare` and `/render` endpoints (shared-secret auth via `X-Avatar-Key` header, secret set via the `AVATAR_SERVICE_SECRET` Space secret).

Not a public demo - internal service for the blog2video pipeline.
