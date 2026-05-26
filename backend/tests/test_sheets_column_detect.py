"""Sheets header auto-mapping — URL vs Video URL must not collide."""

from google_sheets.column_detect import detect_column_mapping


def test_detect_dan_koe_style_headers() -> None:
    headers = [
        "Name",
        "URL",
        "Video URL",
        "Subscribers",
        "Titles",
        "Views",
        "Date",
        "Transcript",
    ]
    mapping = detect_column_mapping(headers)
    assert mapping["creator_name"] == "Name"
    assert mapping["channel_url"] == "URL"
    assert mapping["video_url"] == "Video URL"
    assert mapping["title"] == "Titles"
    assert mapping["transcript"] == "Transcript"
