# API Error Codes

All error responses follow this shape:

```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE"
}
```

## Code Reference

| Code | HTTP Status | Cause | Routes |
|------|-------------|-------|--------|
| `VALIDATION_ERROR` | 400 | Request body failed Zod schema validation | All routes |
| `UNAUTHORIZED` | 401 | Missing or invalid `X-Admin-Key` header, or invalid `sessionToken` | `POST /v1/chat`, `POST /v1/orders`, `GET /v1/orders/:sessionId`, all `/v1/tenants/*` |
| `TENANT_NOT_FOUND` | 404 | `X-Tenant-ID` header refers to a non-existent or inactive tenant | All routes requiring tenant resolution |
| `RATE_LIMITED` | 429 | Anthropic API rate limit exceeded, or global/admin rate limit hit | `POST /v1/chat`, `POST /whatsapp/webhook` |
| `INTERNAL_ERROR` | 500 / 502 | Unhandled exception, or upstream Anthropic API error (non-429) | All routes |

## Notes

- `TENANT_NOT_FOUND` is returned when the `X-Tenant-ID` header is missing or does not match any active tenant.
- `UNAUTHORIZED` on chat/order routes means the `sessionToken` does not match the `sessionId` (HMAC mismatch).
- `UNAUTHORIZED` on admin routes means the `X-Admin-Key` header is missing or incorrect.
- `RATE_LIMITED` with HTTP 429 may come from Anthropic (proxied) or from the server-side rate limiter.
