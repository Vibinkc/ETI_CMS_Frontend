# ETI CMS — admin

The content editor for etiedu.org. Talks to the FastAPI CMS in
`../eti_website_cms_backend`; the public site it edits is `../eti_website`.

```bash
npm run dev     # http://localhost:3100
npm run build && npm start
```

`.env.local`:

```
NEXT_PUBLIC_CMS_API_URL=http://127.0.0.1:8001
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
```

Default login after seeding: **admin / eti-admin**.

> That is a development default and is public knowledge. Change it before
> the CMS is reachable by anyone else — the seeder takes
> `--admin-password` for exactly this reason.

## What an editor can do

- **Pages** — the whole site in the sidebar, nested by route so pages that
  share a title (there are five "FAQ" pages) are told apart by their parent.
- **Page editor** — every editable field on that page, grouped under the heading
  it sits beneath, with a search box for finding a field by its text.
  - *Text* — a single line or a paragraph
  - *Formatted text* — edited **visually**, never as markup: type over the words
    and use the Bold / Italic / Link buttons. An HTML toggle is there for anyone
    who wants it.
  - *Image* / *Video* — preview, the current filename, a **Change** button that
    browses the media library or uploads, and a plain-language description field
    for screen readers
  - **Reset** on any field restores what the site originally shipped with
- **Save is live** — there is no draft stage. Edits are held in the browser
  until **Save changes**, which writes them and refreshes that page on the
  website; the count of unsaved fields sits in the toolbar and each changed
  field is marked. Leaving with unsaved edits warns first.
- **Media library** — upload, browse and delete images, video and PDFs. Files
  are stored in Postgres and served by the API.

## How it fits together

```
eti_website_cms_frontend  ──HTTP──>  eti_website_cms_backend  <──HTTP──  eti_website
      (this app, :3100)                  (FastAPI, :8001)               (Next site, :3000)
                                              │
                                          save ↓ POST /api/revalidate
                                          eti_website drops that route from cache
```

Pages and slots are created by the website's generator, not here — the CMS edits
the content of a fixed layout, it does not create pages. See
`../eti_website/README.md` for how slots are extracted and
`../eti_website_cms_backend/README.md` for the API.

## Notes

- The token is a JWT in `localStorage`. That is appropriate for an internal
  admin tool on a trusted network; move it to an httpOnly cookie before exposing
  this to the open internet.
- The API's `CORS_ORIGINS` must list the exact origin this app is served from —
  `localhost` and `127.0.0.1` are different origins to a browser.
- **Formatted-text fields edit in place.** The values came out of the site's
  page builder and carry markup an editor should never have to retype — links
  with titles, UIkit button classes, `<br>` inside an address. Typing happens
  inside a `contenteditable` surface, so replacing the words leaves the
  surrounding tags and their classes untouched; a normal WYSIWYG that
  re-serialises the document would strip them. Paste is forced to plain text for
  the same reason.
