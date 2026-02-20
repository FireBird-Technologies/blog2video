# Database migrations (Alembic)

Migrations are in `alembic/versions/`. The app uses the same `DATABASE_URL` as in your `.env`.

## Step-by-step

### 1. Install dependencies (if needed)

```bash
cd backend
pip install -r requirements.txt
```

### 2. Create a new migration after model changes

From the **backend** directory:

```bash
cd backend
alembic revision --autogenerate -m "describe your change"
```

Example messages: `"add logo columns to projects"`, `"add video_limit_bonus to users"`.

- This compares your SQLAlchemy models to the current DB and writes a new file under `alembic/versions/`.
- **Review the generated file** before applying; fix or remove any unwanted operations.

### 3. Apply migrations (upgrade)

```bash
cd backend
alembic upgrade head
```

- Updates the database to the latest revision.
- Safe to run multiple times; already-applied migrations are skipped.

### 4. Roll back one revision (optional)

```bash
cd backend
alembic downgrade -1
```

- Use only if you need to undo the last migration.

### 5. See current revision

```bash
cd backend
alembic current
```

### 6. See migration history

```bash
cd backend
alembic history
```

---

## New / empty database

The first migration in this repo only has a couple of **ALTER**s (it was generated when the DB already had tables). On a **brand‑new empty DB**, `alembic upgrade head` would fail because those ALTERs expect the tables to exist.

To support a **newly created DB**, you need a migration that **creates all tables**. Do this once:

### 1. Use an empty database

- **SQLite:** Use a new file, e.g. set in `.env`:  
  `DATABASE_URL=sqlite:///./blog2video_new.db`
- **PostgreSQL:** Create a new empty database and set `DATABASE_URL` to it.

### 2. Generate a “create all tables” migration

From `backend`:

```bash
cd backend
alembic revision --autogenerate -m "create all tables"
```

This creates a new file in `alembic/versions/` with `create_table()` for all models (users, projects, scenes, etc.).

### 3. Make it the first migration

You want this migration to run **first** on an empty DB (so it creates everything). Two options:

**Option A – Single initial migration (simplest)**

1. Remove (or move aside) the **old** first migration:  
   `alembic/versions/0d094c97315c_initial_schema_from_models.py`
2. Open the **new** migration file and set:
   - `down_revision = None`  
   so it is the root revision.
3. Save. You now have one “create all tables” migration as the only revision.

**Option B – Keep both migrations**

1. In the **new** migration file, set `down_revision = None`.
2. In the **old** migration file (`0d094c97315c_...`), set:
   - `down_revision = '<revision_id_of_the_new_migration>'`  
   (use the `revision` string from the new file).
3. Order is then: new (creates all tables) → old (two ALTERs). On an empty DB, `upgrade head` runs both; the ALTERs may be no-ops if the “create all” already matches the models.

### 4. Apply on the new DB

With `DATABASE_URL` still pointing at the empty DB:

```bash
cd backend
alembic upgrade head
```

All tables are created. From then on, any **new** empty DB can be brought up with the same `alembic upgrade head` (and the same migration set).

---

## Notes

- **Always run Alembic from the `backend` directory** so the `app` package and `.env` are found.
- **Existing DB:** You can keep using `init_db()` (which runs `create_all` + the inline `_migrate()` in `database.py`) for now. Over time, move new schema changes into Alembic migrations and run `alembic upgrade head` after deploy instead of relying only on inline migrations.
