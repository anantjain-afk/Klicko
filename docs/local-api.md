# Local API contract — milestone 5A

This milestone adds a local validation boundary. It does not connect the extension to a backend, call Gemini, deploy a Worker, or provide a real guidance result. A valid request returns HTTP **503** with `provider_unavailable`. Only tests inject deterministic provider replies.

## Run and verify

Use Node.js 22+ and Corepack. From the project root:

```sh
corepack pnpm install
corepack pnpm dev:api
```

Keep that terminal open. The Worker binds to `127.0.0.1:8787`; no Cloudflare login, API key, or remote binding is required. In another terminal:

```sh
corepack pnpm verify:api
```

Expect six PASS lines: valid input → 503, malformed JSON → 400, oversized body → 413, forbidden field → 400, excessive label → 400, sensitive goal → 422. Inspect the server terminal for unexpected errors; request bodies, fake marker values, and secrets must not appear in application logs.

To inspect the valid request and actual response directly:

```sh
curl -i http://127.0.0.1:8787/v1/guidance/next \
  -H 'Content-Type: application/json' \
  --data-binary @apps/api/tests/fixtures/valid-request.json
```

Expected body:

```json
{
  "protocolVersion": 1,
  "kind": "error",
  "error": {
    "code": "provider_unavailable",
    "message": "No guidance provider is configured. Real AI integration requires milestone 5B."
  }
}
```

An HTTP 200 or purported model selection from the runnable entrypoint fails milestone 5A verification. Stop the server with Ctrl+C when finished. Do not add credentials for this milestone.

## Contract

Shared schemas live in `packages/shared/src/guidance.ts`; the synthetic request fixture is `apps/api/tests/fixtures/valid-request.json`. Browser-internal messages remain unchanged. The HTTP contract is versioned separately and is not yet used by the extension.

| Input | Limit or rule |
|---|---|
| Method/path | `POST /v1/guidance/next` |
| Body | Uncompressed UTF-8 `application/json`; at most 65,536 actual bytes |
| Identity | Protocol 1, operation `next`, UUID session ID, positive safe-integer request number, bounded page/snapshot tokens |
| User goal | 1–240 characters after trimming |
| Controls | At most 150; unique ephemeral `el_###` IDs |
| Names/context | At most 80 characters each |
| Roles | button, link, checkbox, radio, tab, menuitem, switch, combobox, textbox |
| Viewport | Positive integers at most 16,384 CSS pixels per dimension |
| Geometry | Finite coordinates within ±100,000; positive width/height at most 100,000 |
| Page URL | Bounded HTTP(S) URL; internal identity is separate from provider context |
| Other fields | Rejected at every object level, including values, HTML, cookies, API keys, screenshots, scripts, and selectors |

The byte reader checks the actual stream even if `Content-Length` is absent or falsely small. Validation errors return fixed messages and do not include request text, schema issues, field values, or provider exceptions. Responses use `Cache-Control: no-store` and JSON with `X-Content-Type-Options: nosniff`. The endpoint supplies no CORS permission and refuses non-loopback request hostnames; this is local development behavior, not public authentication.

The shared response envelope carries protocol/session/request/page/snapshot identity and a result. Result variants are `highlight`, `ask_clarification`, `complete`, and `unsupported`; each accepts only its own fields. A highlight contains an inventory target ID, plain instruction text, and an allowlisted outcome hint (`manual_confirmation` or `url_or_element_change`). These hints do not implement or prove outcome verification. Script fields, arbitrary actions/selectors, unknown targets, stale identity, and targets removed by privacy filtering are rejected. Provider strings remain untrusted text, including HTML-looking strings; the API returns JSON and never executes them.

The `complete` result is contract/test coverage only. With no provider installed in the runnable entrypoint, no result variant can be returned as a real model success in this milestone.

## Privacy boundary

`packages/shared/src/privacy.ts` constructs a separate provider context with only the task, page origin, and eligible control IDs/roles/names/context. It omits every URL path, query, fragment, local session/page/snapshot identity, geometry, viewport, disabled control, and empty label. Credential-bearing URLs, selected sensitive routes, and sensitive-looking goals are refused. Labels/context containing recognized email, long numeric/card, token/key, credential, or payment patterns are omitted. Known sensitive patterns in provider result text also cause rejection.

This is a conservative heuristic, not proof that arbitrary page prose is free of personal information. It does not inspect real field values, arbitrary DOM HTML, cookies, or screenshots. Future extension integration must minimize context before sending it to a backend as well as validate it there; this milestone sends no extension context anywhere. Public hosting, abuse controls, provider timeout/cancellation, and actual Gemini integration remain outside 5A.

## Tooling and checks

- Hono `4.13.13` supplies the Worker-compatible HTTP router. Tests use its standard Request/Response interface. See [Hono on Workers](https://hono.dev/docs/getting-started/cloudflare-workers) and [Hono testing](https://hono.dev/docs/guides/testing).
- Zod `4.6.7` supplies strict runtime schemas and inferred TypeScript contracts. See [Zod schemas](https://zod.dev/api) and [safe parsing](https://zod.dev/basics).
- Wrangler `4.151.3` runs the local Worker and creates a dry-run bundle. `corepack pnpm build` runs the extension build plus `wrangler deploy --dry-run --outdir dist`; the command's “Total Upload” label describes bundle size, and `--dry-run` exits without deployment. See [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/).
- `wrangler.jsonc` has no service/storage bindings, disables telemetry/observability, disables workers.dev and preview URLs, and binds local development to loopback. `.wrangler`, `dist`, `.dev.vars*`, and `.env*` are excluded from Git. There is no deployment script.

```sh
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm exec playwright test
```

Recorded results: all commands exit 0; 38 API tests + 21 extension tests, 34 Chromium browser tests, and the six real local Worker HTTP cases pass. Unit API checks use injected provider replies only inside tests; the HTTP verification exercises the actual provider-free entrypoint in workerd. The user confirmed milestone 5A verification on 22 October 2026. Detailed initial failures, fixes, sandbox limitations, and Chrome steps are in `PROGRESS.md`.
