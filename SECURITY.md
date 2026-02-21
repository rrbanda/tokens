# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Promptly, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email: **security@your-org.example.com**

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge your report within 48 hours and aim to provide a fix within 7 days for critical issues.

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |

## Security Features

Promptly includes the following security measures:

- **SSL verification**: Configurable via `config.yaml` (defaults to enabled)
- **CORS**: Restricted to configured origins
- **SSRF protection**: Blocks requests to private IPs, localhost, and cloud metadata endpoints
- **Path traversal prevention**: Skills endpoint validates resolved paths
- **API key authentication**: Optional shared key via `X-API-Key` header
- **Rate limiting**: Per-endpoint limits on expensive operations
- **Non-root container**: Runs as UID 1001
- **Security contexts**: Kubernetes manifests drop all capabilities, prevent privilege escalation

## Best Practices for Deployment

1. **Always set an API key** in production (`security.api_key` in `config.yaml`)
2. **Enable SSL verification** (`security.ssl_verify: true` or path to CA bundle)
3. **Restrict CORS origins** to your actual frontend domain
4. **Use HTTPS** for all external-facing endpoints
5. **Use Kubernetes Secrets** for database credentials (not ConfigMaps)
6. **Review `blocked_url_patterns`** and add any internal domains specific to your network
