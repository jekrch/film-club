# film-club-editor

The Cloudflare Worker behind on-site editing. Members sign in with Google, edit
their scores, reviews, lists, and the club's films themselves in the app, and
this worker commits the result to `jekrch/film-club`. Design and rationale live in §8 of
`docs/film-lists-plan.md`; this file is the operational half.

The site stays fully static. Nothing on a normal page load talks to the worker —
it is involved only while someone is editing.

It handles the writes, and the two reads that need a secret behind them. The
editors read the files themselves from the copies each deploy publishes under
`/data/` on the site, which needs no worker and no token; see
[The four reads that used to be here](#the-four-reads-that-used-to-be-here).

## The shape of a save

```
browser  ──ID token──▶  worker  ──verify (Google JWKS)
                               ──resolve email → club member
                               ──validate payload (§8.3)
                               ──▶ GitHub Contents API: commit to main
                                     ├─ overrides.json  (scores, reviews)
                                     ├─ lists.json      (member lists)
                                     ├─ trophies.json   (club awards)
                                     ├─ watched.json    (personal watch logs)
                                     │    │
                                     │    deploy.yml ─▶ apply_overrides.py
                                     │                  enrich_list_films.py
                                     │                  build → gh-pages → live (~1 min)
                                     │
                                     └─ responses.json  (reactions, comments)
                                          └─ [deferred deploy]: deploy.yml waits a
                                             minute, so a burst builds once
```

**One writer per file.** CI owns `films.json` and `listFilms.json`; the worker
owns `overrides.json`, `lists.json`, `watched.json`, `club.json`,
`trophies.json`, `responses.json`, and the uploaded pictures under
`public/images/members/`, and
never writes the other two. (CI _reads_ `club.json` — the banner films a member names are cached like
list films — but has never written it.) That is what removes merging from the problem — only a
precedence rule remains, applied once, at build time.

Only `overrides.json` is overlaid onto `films.json`. Lists, watch logs, and
trophies stay in their own files and are read directly by the pages that show
them, which is what keeps personal data out of every club statistic.

## Endpoints

All require `Authorization: Bearer <google_id_token>`.

| Method   | Path                                    | Purpose                                                |
| -------- | --------------------------------------- | ------------------------------------------------------ |
| `GET`    | `/api/session`                          | `{ member, admin }` — who the token resolves to        |
| `PUT`    | `/api/films/:imdbId`                    | Set a film's club record — or add the film (see below) |
| `DELETE` | `/api/films/:imdbId`                    | Revert those fields, or withdraw a film not yet built  |
| `PUT`    | `/api/films/:imdbId/rating`             | Field-level merge of score / qualifier / blurb         |
| `DELETE` | `/api/films/:imdbId/rating`             | Drop the override, hand the row back to the sheet      |
| `PUT`    | `/api/films/:imdbId/trophies/:id`       | Award a trophy to a member, or edit one                |
| `DELETE` | `/api/films/:imdbId/trophies/:id`       | Withdraw it (the member who gave it, or an admin)      |
| `PUT`    | `/api/lists/:id`                        | Create or replace one list (see below)                 |
| `DELETE` | `/api/lists/:id`                        | Remove a list                                          |
| `PUT`    | `/api/watched/:imdbId`                  | Log a film watched outside the club, or edit the entry |
| `DELETE` | `/api/watched/:imdbId`                  | Drop it from the log (`?owner=` for admins)            |
| `PUT`    | `/api/profile`                          | Edit your own profile (`owner` in the body for admins) |
| `PUT`    | `/api/profile/image`                    | Upload a profile picture, bytes rather than a link     |
| `PUT`    | `/api/responses/:thread/reactions/:key` | React to a log entry, screening, review, or list       |
| `DELETE` | `/api/responses/:thread/reactions/:key` | Take it back                                           |
| `PUT`    | `/api/responses/:thread/comments/:id`   | Comment on a thread (`new`), or edit your own          |
| `DELETE` | `/api/responses/:thread/comments/:id`   | Remove a comment (author, row's owner, or admin)       |
| `GET`    | `/api/films/search?q=`                  | OMDB title search, so the key stays server-side        |

### The four reads that used to be here

`GET /api/overrides`, `/api/lists`, `/api/watched`, and `/api/club` returned
those files read live from `main`, so the editor never showed a member a save
that hadn't finished deploying. **The site no longer calls them.** They are
still routed and still work — removing them is a `wrangler deploy` of its own —
but nothing in `src/` reaches for them, and new code shouldn't.

They were four endpoints spending a Workers request each, on a free-tier
account shared with other sites, to serve public files. Every deploy now
publishes the files under `/data/` on the site itself (`liveData` in
`vite.config.ts`), and `src/api/repoData.ts` fetches them from there.

What the worker did give was freshness. The published copy is only as new as
the last deploy, a minute or two behind `main`. A member who saved, reloaded,
and got the old value back would read that as a failed save. That is bought
back on the client instead: every write already returns the stored record, and
`src/api/writeCache.ts` keeps this tab's own results in `sessionStorage` to
overlay onto whatever the site hands back. Each entry clears itself the moment
a fetch agrees with it, so a read is never worse than the last deploy and never
stale for longer than the round trip it is covering.

The two `GET`s that remain are the two that cannot move: `/api/session` checks a
token against `MEMBER_EMAILS`, and `/api/films/search` exists precisely to keep
the OMDB key off the client.

**`PUT /api/lists/:id`** treats the path id as a lookup key. If no list has it,
one is created and the worker assigns the permanent id itself —
`slugify(owner + "-" + name)`, `-2` on collision — and returns it in the
response. Use `/api/lists/new` when creating. The id never changes afterwards,
which is what lets a member rename a list without breaking its URL.

**`PUT /api/films/:imdbId/trophies/:id`** is the one write on this API that is
not about the caller. Every other route stores something a member owns, and
`resolveOwner` refuses anything else; a trophy is _given_, so `recipient` is
plain data and any member may name any member. The film must be a club film, the
same check a rating write makes — a trophy commemorates a screening.

What replaces the ownership rule is a rule about taking one back: the award
records `awardedBy` from the token, and only that member or an admin may edit or
withdraw it. **The recipient cannot**, which is the whole point — a Bad Boy
trophy its victim can quietly delete is not a trophy. The path id works like a
list's: unmatched ids create, the worker assigns the permanent one
(`slugify(recipient + "-" + award)`, `-2` on collision) and returns it, and it
never changes afterwards, so an award can be renamed in place. Use
`/api/films/:imdbId/trophies/new` when awarding.

The sheet's `trophyNotes` column is a different field and stays the sheet's:
this worker never writes it, the sync never writes `trophies.json`, and the site
reads both into one shelf (`src/utils/trophyUtils.ts`). Nothing migrates the old
prose — it is the club's own record of what it wrote.

**`PUT /api/watched/:imdbId`** is the personal counterpart to a club rating,
and the two never mix. It is a merge like the rating route, so logging a film is
a one-field save — `{"watchDate":"2026-08-09"}` — and scoring it later is a
second one. A first save that omits the date gets today's; a body with no
recognized field at all is a 400, as it is everywhere else. One entry per film
per member: a rewatch moves the entry's date rather than adding a row.

Unlike a rating write there is **no club-film check** — the point of the log is
films the club never watched. A member may also log one it did; that entry's
score is theirs alone. Nothing in CI reads `watched.json` into `films.json`, so
a logged film cannot reach the almanac, a club average, or any statistic.

`trailerKey` — on a watch-log entry and on a list entry alike — is the one field
the worker does **not** store verbatim. Send a YouTube link in any of its usual
shapes and what gets committed is the eleven-character video id inside it;
anything that isn't one is a 400. The stored value is interpolated into an embed
`src` on the site, which is why it is narrowed to an id here rather than trusted
later. `null` means "play whatever trailer the film itself has", and the
separate `hideTrailer` flag means "play none", so hiding a trailer doesn't
discard the link the member found.

**`PUT /api/profile`** edits the caller's own `club.json` record — `title`,
`bio`, `url`, `image`, and `interview` — and nothing else. A merge like the
others, so saving a bio leaves the interview alone; `interview` is the exception
_within_ a field, arriving as the whole array or not at all.

`name` is not editable and won't become editable: it is the key every rating,
list, and watch log joins on, so renaming through here would orphan a member's
history. `queue` and `color` are refused for a milder reason — the selection
rotation and the chart palette are club-wide settings that happen to be stored
per member. The worker also cannot _create_ a member: an owner with no record is
a 404, the same way a rating for an unknown film is.

`image` is the one field on the site that accepts a repo path
(`/images/andy.jpg`) as well as an `https` URL, because that is how all six
profiles are already stored. `//host/x` and anything containing `..` are
refused — the first is another origin wearing a path's clothes.

`backdropMode` and `backdropFilms` decide what the collage behind a profile's
name and bio draws: `top-rated` (the default, and stored as no field at all) is
the club films that member scored highest, and `selected` is up to three films
they named. Those need not be club films — `enrich_list_films.py` caches art for
ids `club.json` references, the same way it does for lists and watch logs — so
a member's banner can show a film the club has never watched. `backdropFilms` is
replaced whole, like `interview`.

**`PUT /api/profile/image`** is the one route that takes bytes:

```json
{ "contentType": "image/jpeg", "data": "<base64>", "owner": "Andy" }
```

JPEG, PNG, and WebP only, at most 600 KB decoded — the browser resizes to 512px
before sending (`src/utils/imageUpload.ts`), so a real avatar arrives at about a
tenth of that. The image is committed to `public/images/members/`, which Vite
copies into the build, and the profile's `image` is pointed at the result. The
response is a profile write's plus `image` (the stored path) and `uploaded`
(false when the repo already held these exact bytes).

Nothing the client sends reaches the committed path. The filename is the
member's slugged name, a SHA-256 of the content, and an extension the worker
picked from `contentType` — so an upload cannot name a file, and re-uploading
the same picture costs no commit. It is **two** commits, the image and then
`club.json`, in that order so a profile never points at a file that isn't there
yet; `deploy.yml`'s `cancel-in-progress` concurrency group collapses them into
one Pages build. Uploads are never deleted: a replaced picture leaves its file
in the repo, which is a few tens of kilobytes a member per change and simpler
than reference-counting a path that a deployed page may still be serving.

**`/api/responses/…`** is how members answer each other's watch logs, the
club's screenings, late reviews, and each other's lists: a fixed set of reactions and plain
Markdown comments, both in `responses.json`. A `:thread` is the wall's own event
id for the thing it is about:

- `log-<member>-<imdbID>` for a log entry. It is stable because a rewatch moves
  an entry's date rather than adding a row. The worker resolves the member
  against `MEMBER_EMAILS`, so casing in the path doesn't matter.
- `review-<member>-<imdbID>` for a late review of a club film, resolved the same
  way.
- `club-<imdbID>` for a screening.
- `list-<listId>` for a list.

Adding a reaction or a comment checks that the subject exists: the entry in
`watched.json`, the film among the club's (as a rating write does), a score or
review on the member's row in `films.json`, or the list in `lists.json`. Taking one back doesn't, so nothing is stranded on an entry,
or a list, its owner has since removed. The site simply stops drawing that
thread.

`:key` is one of `like`, `love`, `laugh`, `wow`, `sad`, `clap`, `fire`,
`mind-blown`, `hmm`, `yikes`, `on-my-list`, `snooze`, and nothing else. The site
maps each to an emoji (`src/components/responses/reactions.ts`), and a key
it had no emoji for would render as nothing. Who reacted, and who wrote a comment, come from the
token. Neither route takes an `owner`, admin or not. Reacting twice, and taking
back a reaction that isn't there, are both no-ops that skip the commit, so a
toggle can't fail on a double tap.

The permission rules are the trophy rules turned around. Only the author may
reword a comment, not even an admin, since an edit puts words in someone's
mouth under their name. The author, the member whose log or list it is on, or an
admin may remove one. A screening is the club's rather than its selector's, so
there it's the author or an admin. On a trophy the recipient can't withdraw it, but a comment is
a guest on your post rather than the club's verdict on you.

**Every response commit carries `[deferred deploy]`**, so a burst of
reactions costs one Pages build rather than one per tap. `deploy.yml` sleeps a
minute before doing anything on such a commit, and the next one's run cancels
it through the `pages-deploy` concurrency group, so only the run after the last
tap builds. Everyone else sees the reactions a minute or two after the member
stops. `src/api/repoData.ts` fetches the published `responses.json` for every
visitor, signed in or not, the first time a page shows a thread, so an open
page picks them up without waiting for its service worker to swap bundles. A
member's own reaction shows at once (optimistically, rolled back if the save
fails), and `writeCache.ts` keeps it in place across a reload until the deploy
lands.

**`PUT /api/films/:imdbId/rating`** is a merge, not a replace: a body carrying
only `blurb` leaves the score alone. An absent field means "whatever the sheet
says stands"; an explicit `null` means "deliberately blank". Both saves that
change nothing and deletes of nothing skip the commit, so no-op edits don't cost
a Pages build.

An admin may name another member with `owner` in the body (and `?owner=` on the
`DELETE`), which is how one person types in an evening's scores. The response
says whose row was written — `owner` — while `rating.updatedBy` names whoever
typed it; they are different people in exactly that case, and a client that
keyed on `updatedBy` would file the score under the wrong member.

**`PUT /api/films/:imdbId`** writes a film's own club record: `selector`,
`watchDate`, `poster`, and `backdropImage`, on the same merge-and-presence rules
as a rating. Unlike a rating this is club property rather than anyone's row, so
any member may write it — the reasoning that lets any member hand out a trophy.

The same route **adds a film** when `films.json` doesn't have the id, which is
what retired the Google Sheet's `imdb_id` column. It cannot write the film
itself: a record is OMDb's response plus TMDb's, and `films.json` belongs to CI.
What it commits is a `FilmSubmission` marker, having first confirmed the id
resolves at OMDb — one lookup, so a typo is a 404 here rather than a film that
is permanently arriving. `.github/scripts/create_submitted_films.py` builds the
record on the next deploy, about a minute later. `created` in the response says
whether this added the film or edited one.

**`DELETE /api/films/:imdbId`** is two things, because a member sees one action.
Before CI builds the film, the submission _is_ the film and this removes it —
restricted to whoever added it, or an admin. After CI builds it the entry is in
`films.json`, which no worker may write, so the revert hands the four fields back
to the sheet and leaves the film. `withdrawn` in the response says which
happened.

## Configuration

Public values live in `wrangler.toml` (`GOOGLE_CLIENT_ID`, `GITHUB_REPO`,
`ALLOWED_ORIGIN`). Everything else is a secret:

```sh
wrangler secret put GITHUB_TOKEN    # fine-grained PAT, this repo, Contents: read+write
wrangler secret put MEMBER_EMAILS   # {"someone@gmail.com":"Andy", ...}
wrangler secret put ADMIN_EMAILS    # ["someone@gmail.com"]  (or a comma-separated list)
wrangler secret put OMDB_API_KEY    # search proxy only
```

`MEMBER_EMAILS` is a secret rather than a repo file because this repository is
public and members' personal addresses should not be in it. It is also the
entire authorization model: an email that isn't in it gets a 403.

### One-time setup outside the codebase

1. **Google Cloud console** → OAuth consent screen (External; Testing is fine for
   six users) → Credentials → OAuth client ID → _Web application_. Add
   authorized **JavaScript origins** — no redirect URIs, the ID-token flow
   doesn't use them, which is also why `HashRouter` is irrelevant here:
    - `https://www.criterionclub.org`
    - `https://criterionclub.org`
    - `http://localhost:5173`

    Put the resulting client ID in `wrangler.toml` _and_ in the site's
    `VITE_GOOGLE_CLIENT_ID` — it is public on both sides by design. The site
    needs `VITE_EDITOR_API_URL` (this worker's URL) alongside it; see
    `.env.example` at the repo root for local development, and the repository
    variables `GOOGLE_CLIENT_ID` / `EDITOR_API_URL` that `deploy.yml` reads for
    production. With either unset the site simply ships without editing.

2. **GitHub** → Settings → Developer settings → Fine-grained tokens → this repo
   only, **Contents: Read and write**, nothing else. Note the expiry (a year at
   most): when it lapses, saves fail and the worker reports
   `GitHub rejected the worker's credentials` rather than a generic error.

3. `bun install && bunx wrangler deploy`, then the four secrets above.

## Proving it end to end

The step-7 milestone is one real rating write, before any editor UI exists.

```sh
# 1. Sign in on the site (or https://developers.google.com/oauthplayground with
#    the same client ID) and copy the ID token.
TOKEN=...
WORKER=https://film-club-editor.jekrch.workers.dev

# 2. Confirm auth and the member mapping.
curl -s -H "Authorization: Bearer $TOKEN" "$WORKER/api/session"
# → {"member":"Jacob","admin":true}

# 3. Write a score.
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"score":7.5,"blurb":"Testing the write path."}' \
  "$WORKER/api/films/tt0107653/rating"
```

Then check, in order: a commit on `main` touching only
`src/assets/overrides.json`, authored by whoever owns `GITHUB_TOKEN` — the
member's name is in the commit _message_, never the author field, since an
address there would be matched against real GitHub accounts; a `Deploy to GitHub
Pages` run whose _Apply member overrides_ step logs the change; and the new
score on the live film page a minute later. `wrangler tail` shows worker-side
errors while you do it.

Worth testing the boundary too — these should all fail:

- a request with no `Authorization` header → 401
- an ID token for an email not in `MEMBER_EMAILS` → 403
- `{"owner":"Andy",...}` on a list PUT from a non-admin → 403
- `PUT /api/films/tt9999999/rating` for a film the club doesn't have → 404 (a
  film added on the site counts, from the moment the submission commits)
- `PUT /api/films/tt9999999` with a body OMDb can't resolve → 404
- `PUT /api/films/:imdbId` with `{"selector":"Werner"}` → 400 (not a member)
  (the worker cannot create films; that stays the sheet's job)
- `PUT /api/watched/tt0078748` with `{"watchDate":"2099-01-01"}` → 400, and with
  `{"watchDate":"2026-02-31"}` → 400 (the log is ordered by that field)
- `PUT /api/watched/tt0078748` with `{}` → 400 (nothing the worker understands)
- `DELETE /api/watched/tt0078748?owner=Andy` from a non-admin → 403
- `PUT /api/films/tt0107653/trophies/new` with `{"recipient":"Werner","award":"x"}`
  → 400 (an award can only go to a club member)
- `DELETE /api/films/tt0107653/trophies/:id` for an award someone else gave →
  403, naming who did — including when the caller is the one who won it
- `PUT /api/responses/log-Andy-tt0078748/reactions/thumbs-up` → 400 (not a
  reaction the site draws)
- `PUT /api/responses/log-Andy-tt9999999/reactions/clap` for a film Andy never
  logged → 404
- `PUT /api/responses/:thread/comments/:id` on someone else's comment → 403,
  admins included
- `DELETE /api/responses/:thread/comments/:id` on a comment that is neither yours
  nor on your log → 403

## Development

```sh
bun install
bun run typecheck   # tsc --noEmit
bun run dev         # wrangler dev
bun run tail        # live logs from the deployed worker
```

`src/validate.ts` is the trust boundary and is deliberately pure — it imports
nothing but `errors.ts`. Its tests (`src/validate.test.ts`) therefore run in the
_site's_ jest suite: `bun jest` from the repo root covers them, and there is no
second test runner to keep in sync.
