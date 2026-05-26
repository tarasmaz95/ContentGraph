"""Extract a stable channel key from synced channel_url values."""


def extract_youtube_channel_id(channel_url: str) -> str:
    """@handle, /channel/UC…, or fallback to trimmed URL tail."""
    url = (channel_url or "").strip()
    if not url:
        return "unknown"

    if "/@" in url:
        handle = url.split("/@", 1)[-1].split("/")[0].split("?")[0].strip()
        return handle[:128] or "unknown"

    if "/channel/" in url:
        cid = url.split("/channel/", 1)[-1].split("/")[0].split("?")[0].strip()
        return cid[:128] or "unknown"

    return url[:128]
