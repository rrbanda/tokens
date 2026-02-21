import ipaddress
import logging
from urllib.parse import urlparse

from app.config import get_config

logger = logging.getLogger(__name__)


def validate_server_url(url: str) -> str | None:
    """Validate a URL is safe for server-side requests.

    Returns an error message if blocked, or None if the URL is allowed.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return "Invalid URL"

    if parsed.scheme not in ("http", "https"):
        return f"Unsupported scheme: {parsed.scheme}"

    hostname = parsed.hostname or ""
    if not hostname:
        return "Missing hostname"

    blocked = get_config().security.blocked_url_patterns
    hostname_lower = hostname.lower()
    for pattern in blocked:
        if pattern.lower() in hostname_lower:
            logger.warning("SSRF: blocked request to %s (matched pattern %r)", url, pattern)
            return "URL is not allowed"

    try:
        addr = ipaddress.ip_address(hostname)
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
            logger.warning("SSRF: blocked private/reserved IP %s", hostname)
            return "URL is not allowed"
    except ValueError:
        pass

    return None
