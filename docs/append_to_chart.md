# Append to Chart (Issue 16)

After a chart is submitted, it can't be changed, but providers can still add to it. They can add notes (addendum with a reason) and attachments (photos and PDFs). Nothing added is ever edited or deleted, so the chart keeps a full record of what was added, by who and when.

```
Add note        -> POST /charts/:id/notes        -> AddendumService.addNote     -> AddendumRepository.findChart + addNote
Upload file     -> POST /charts/:id/attachments  -> AttachmentService.upload    -> findChart, StorageService.save, AttachmentRepository.add
View additions  -> GET  /charts/:id/notes, GET /charts/:id/attachments, GET /attachments/:uuid
```

## Status

| Piece | File | Status |
|---|---|---|
| Notes table | `apps/api/migrations/0002_chart_details_tables.sql`, `reason` from `0005_post_call_changes.sql` | Done (existing tables) |
| Attachment upload details | `apps/api/migrations/0006_edit_attachments.sql` | Done |
| Kysely types | `apps/api/src/db/types.ts` (`NotesTable`, `AttachmentsTable`) | Done |
| Notes repository | `apps/api/src/repositories/AddendumRepository.ts` | Done, unit + integration tests |
| Notes logic | `apps/api/src/services/AddendumService.ts` | Done, unit tests |
| Notes routes | `apps/api/src/http/routes/addenda.ts` | Done, route tests |
| Attachments repository | `apps/api/src/repositories/AttachmentRepository.ts` | Done, integration test |
| File storage | `apps/api/src/services/StorageService.ts` | Done, unit test |
| Attachments logic | `apps/api/src/services/AttachmentService.ts` | Done, unit tests |
| Attachments routes | `apps/api/src/http/routes/attachments.ts` | Done, route tests |
| CI | `.github/workflows/main.yml` runs every migration in order | Done |
| Frontend (add note, upload, view) | web app | Not started |

## Rules

- **Only submitted charts.** A chart counts as done when `charts.submitted_at` is set. Adding to a chart that isn't submitted returns `chart_not_submitted`.
- **Add only.** There are no edit or delete routes for notes or attachments.
- **Who added it.** `notes.user_id` and `attachments.uploaded_by` are `null` until login exists. A comment in each route marks where to pass the logged-in user.
- **When.** `notes.date_added` and `attachments.uploaded_at` are set by MySQL when the row is saved.

## Database

### `notes` (from 0002, `reason` from 0005)

| Column | Notes |
|---|---|
| `note_id` | Auto-increment |
| `chart_id` | FK to `charts`. Deleting a chart deletes its notes |
| `user_id` | Who added it. `null` until login exists |
| `note` | The addendum text, up to 5000 characters |
| `reason` | Why it was added (e.g. "Follow-up", "Correction"), up to 255 characters |
| `date_added` | Set by MySQL |

### `attachments` (from 0002, new columns from 0006)

| Column | Notes |
|---|---|
| `attachment_id` | Auto-increment |
| `attachment_uuid` | Random UUID. Used in download links, so ids can't be guessed by counting |
| `chart_id` | FK to `charts`. Deleting a chart deletes its attachment rows |
| `storage_key` | File name in storage (`<uuid>.<ext>`). Never sent to the web app |
| `file_type` | `image/jpeg`, `image/png`, `image/heic` or `application/pdf` |
| `original_name` | **New in 0006.** Name of the uploaded file, up to 255 characters |
| `size_bytes` | **New in 0006.** File size |
| `uploaded_by` | Who uploaded it. `null` until login exists |
| `time_captured` | When the photo was taken, if the device sent it |
| `uploaded_at` | **New in 0006.** When it was added to the chart. Set by MySQL |


## Files and storage

`StorageService` is the only code that reads or writes attachment files. Currently it saves them to a local folder (`ATTACHMENTS_DIR`, default `attachments/` in `apps/api`), which is already in `.gitignore`. Moving to cloud storage later only means writing a new `StorageService` so nothing else has to change

Safety checks:

- **File type comes from the file's first bytes**, not its name or what the browser says. A renamed `.exe` is refused.
- **Allowed:** JPEG, PNG, HEIC (iPhone) and PDF, up to 10 MB
- **Stored file names are made by the server** (`<uuid>.<ext>`). Storage refuses any other name, so a request can never read or write outside the folder (e.g. `../.env`).
- Files are never overwritten
- The file is saved before the database row. this means if saving the row fails, the file is deleted, so there are never files with no row.
- Downloads send `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`, and use the stored name, not the uploaded one, in the `Content-Disposition` header.

### Settings (`.env`)

| Variable | Default | Notes |
|---|---|---|
| `ATTACHMENTS_DIR` | `attachments` | Folder for attachment files, relative to where the API starts. Gitignored |

## API

Error responses use codes, not sentences, so the web app shows them in English or Spanish.

### `POST /charts/:id/notes`

```json
{ "note": "Patient called back, pain improved", "reason": "Follow-up" }
```

| Response | Meaning |
|---|---|
| `201` `{ "note_id": 9 }` | Note added |
| `400` | Missing or blank note or reason, too long, or chart id isn't a whole number of 1 or more |
| `404` `{ "error": "chart_not_found" }` | No chart with that id |
| `409` `{ "error": "chart_not_submitted" }` | Chart isn't submitted yet |

Spaces around the note and reason are trimmed before saving.

### `GET /charts/:id/notes`

| Response | Meaning |
|---|---|
| `200` | List of notes, oldest first: `note_id`, `chart_id`, `user_id`, `note`, `reason`, `date_added` |
| `404` `{ "error": "chart_not_found" }` | No chart with that id |

### `POST /charts/:id/attachments`

A file upload (`multipart/form-data`) with one file in the field `file`. `time_captured` is optional and goes in the URL:

```
POST /charts/12/attachments?time_captured=2026-11-20T18:05:00Z
```

| Response | Meaning |
|---|---|
| `201` `{ "attachment_uuid": "…", "file_type": "image/jpeg", "size_bytes": 48213 }` | Saved |
| `400` `{ "error": "empty_file" }` or `{ "error": "missing_file" }` | Empty file, or no file sent |
| `400` | Chart id or `time_captured` isn't valid |
| `404` `{ "error": "chart_not_found" }` | No chart with that id |
| `406` | Request isn't a file upload |
| `409` `{ "error": "chart_not_submitted" }` | Chart isn't submitted yet |
| `413` `{ "error": "file_too_large" }` | Over 10 MB |
| `415` `{ "error": "unsupported_file_type" }` | Not a JPEG, PNG, HEIC or PDF |

### `GET /charts/:id/attachments`

| Response | Meaning |
|---|---|
| `200` | List of attachments, oldest first: `attachment_uuid`, `chart_id`, `file_type`, `original_name`, `size_bytes`, `uploaded_by`, `time_captured`, `uploaded_at` (never `storage_key`) |
| `404` `{ "error": "chart_not_found" }` | No chart with that id |

### `GET /attachments/:uuid`

| Response | Meaning |
|---|---|
| `200` | The file, with its `Content-Type` |
| `400` | Not a valid UUID |
| `404` `{ "error": "attachment_not_found" }` | No attachment with that id |

The web app can show a photo with `<img src="/api/attachments/<uuid>">`

## Testing it locally

1. Run migrations 0005 and 0006 on your local database.
2. From `apps/api`, run `npm run dev`.
3. Mark a chart as submitted: `UPDATE charts SET submitted_at = NOW() WHERE chart_id = 1;`
4. Add a note:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3000/charts/1/notes -ContentType "application/json" -Body '{"note":"Reviewed photo","reason":"Follow-up"}'
   ```
5. Upload a photo:
   ```powershell
   curl.exe -F "file=@C:\path\to\photo.jpg" http://localhost:3000/charts/1/attachments
   ```
   The file appears in `apps/api/attachments/`.
6. Open `http://localhost:3000/charts/1/notes` and `http://localhost:3000/charts/1/attachments` in a browser to see them.

## To-Do

| Item | Notes |
|---|---|
| **Login check on downloads** | Anyone with an attachment's UUID can download it, and these are patient photos. Must be locked to logged-in users before real data goes in. Commented in `attachments.ts` |
| **Who added it** | `user_id` / `uploaded_by` are `null` until login exists. Commented in both route files |
| **Cloud storage** | Local folder for now. Moving means a new `StorageService`; nothing else changes |