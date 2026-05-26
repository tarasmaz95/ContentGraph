"""Thin wrapper around Google Sheets API using a service account."""

from __future__ import annotations

from pathlib import Path
from typing import TypedDict

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.discovery import Resource

from app.core.config import get_settings
from google_sheets.column_detect import (
    FIELD_ALIASES,
    column_index_from_mapping,
    detect_column_mapping,
)

# Read + write spreadsheet values and structure (write-back)
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


class SheetRow(TypedDict):
    """Normalized row after parsing raw sheet cells."""

    creator_name: str
    channel_url: str
    video_url: str
    subscribers_count: int
    title: str
    views_count: int
    published_at_raw: str
    transcript: str


class GoogleSheetsClient:
    """
    Fetches rows from a configured spreadsheet range.

    Expected header row (case-insensitive):
      Name | URL | Subscribers | Titles | Views | Date
    """

    def __init__(
        self,
        *,
        spreadsheet_id: str | None = None,
        sheets_range: str | None = None,
        column_mapping: dict[str, str] | None = None,
    ) -> None:
        settings = get_settings()
        # Caller passes resolved config (DB → .env); kwargs override for tests.
        self._spreadsheet_id = (spreadsheet_id or settings.google_sheets_spreadsheet_id).strip()
        self._range = (sheets_range or settings.google_sheets_range).strip()
        self._column_mapping = column_mapping
        self._service = self._build_service(settings.google_service_account_file)

    @property
    def service(self) -> Resource:
        return self._service

    def _build_service(self, credentials_path: str) -> Resource:
        path = Path(credentials_path)
        if not path.exists():
            raise FileNotFoundError(
                f"Service account file not found: {credentials_path}. "
                "Place your Google service account JSON there."
            )

        credentials = service_account.Credentials.from_service_account_file(
            str(path),
            scopes=SCOPES,
        )
        return build("sheets", "v4", credentials=credentials, cache_discovery=False)

    def fetch_rows(self) -> list[SheetRow]:
        """Read all data rows (skips header)."""
        result = (
            self._service.spreadsheets()
            .values()
            .get(spreadsheetId=self._spreadsheet_id, range=self._range)
            .execute()
        )

        values: list[list[str]] = result.get("values", [])
        if len(values) < 2:
            return []

        header_raw = [cell.strip() for cell in values[0]]
        header = [cell.lower() for cell in header_raw]
        column_index = self._map_columns(header_raw, header)

        rows: list[SheetRow] = []
        for raw in values[1:]:
            parsed = self._parse_row(raw, column_index)
            if parsed is not None:
                rows.append(parsed)

        return rows

    def _map_columns(
        self,
        header_raw: list[str],
        header_lower: list[str],
    ) -> dict[str, int]:
        """Map logical field names to column indices."""
        if self._column_mapping:
            index = column_index_from_mapping(header_raw, self._column_mapping)
        else:
            detected = detect_column_mapping(header_raw)
            index = column_index_from_mapping(header_raw, detected)

        if not index:
            index = {}
            for field, names in FIELD_ALIASES.items():
                for name in names:
                    if name in header_lower:
                        index[field] = header_lower.index(name)
                        break

        required = {"creator_name", "title"}
        missing = required - set(index.keys())
        if missing:
            raise ValueError(
                f"Sheet header missing required columns: {missing}. "
                f"Found header: {header_raw}"
            )

        return index

    def _parse_row(
        self,
        raw: list[str],
        column_index: dict[str, int],
    ) -> SheetRow | None:
        """Convert one sheet row into a typed dict; skip empty titles."""

        def cell(field: str, default: str = "") -> str:
            idx = column_index.get(field)
            if idx is None or idx >= len(raw):
                return default
            return raw[idx].strip()

        title = cell("title")
        if not title:
            return None

        return SheetRow(
            creator_name=cell("creator_name") or "Unknown",
            channel_url=cell("channel_url"),
            video_url=cell("video_url"),
            subscribers_count=self._parse_int(cell("subscribers_count")),
            title=title,
            views_count=self._parse_int(cell("views_count")),
            published_at_raw=cell("published_at_raw"),
            transcript=cell("transcript"),
        )

    @staticmethod
    def _parse_int(value: str) -> int:
        cleaned = value.replace(",", "").replace(" ", "")
        if not cleaned:
            return 0
        try:
            return int(float(cleaned))
        except ValueError:
            return 0

    def fetch_header_row(self) -> list[str]:
        """First row of configured range (raw cell strings)."""
        sheet_name = self._sheet_name_from_range()
        header_range = f"{sheet_name}!1:1" if sheet_name else "1:1"
        result = (
            self._service.spreadsheets()
            .values()
            .get(spreadsheetId=self._spreadsheet_id, range=header_range)
            .execute()
        )
        values = result.get("values", [])
        if not values:
            return []
        return [str(c).strip() for c in values[0]]

    def get_column_index_map(self) -> dict[str, int]:
        """Logical field → 0-based column index from header row."""
        header_raw = self.fetch_header_row()
        if not header_raw:
            return {}
        header_lower = [h.lower() for h in header_raw]
        return self._map_columns(header_raw, header_lower)

    def _sheet_name_from_range(self) -> str | None:
        from google_sheets.sheet_range import parse_sheet_from_range

        return parse_sheet_from_range(self._range)

    def _sheet_id_by_name(self, sheet_name: str) -> int | None:
        meta = (
            self._service.spreadsheets()
            .get(spreadsheetId=self._spreadsheet_id, fields="sheets.properties")
            .execute()
        )
        for sheet in meta.get("sheets", []):
            props = sheet.get("properties", {})
            if props.get("title") == sheet_name:
                return int(props["sheetId"])
        return None

    def update_values(
        self,
        range_a1: str,
        values: list[list[str]],
        *,
        value_input_option: str = "USER_ENTERED",
    ) -> None:
        """Write a rectangular block to one range."""
        (
            self._service.spreadsheets()
            .values()
            .update(
                spreadsheetId=self._spreadsheet_id,
                range=range_a1,
                valueInputOption=value_input_option,
                body={"values": values},
            )
            .execute()
        )

    def batch_update_values(
        self,
        data: list[dict[str, object]],
        *,
        value_input_option: str = "USER_ENTERED",
    ) -> None:
        """
        Batch write multiple ranges.

        Each item: {"range": "Sheet1!H2", "values": [["text"]]}
        """
        if not data:
            return
        (
            self._service.spreadsheets()
            .values()
            .batchUpdate(
                spreadsheetId=self._spreadsheet_id,
                body={
                    "valueInputOption": value_input_option,
                    "data": data,
                },
            )
            .execute()
        )

    def ensure_full_transcript_column(
        self,
        *,
        transcript_col_index: int,
        full_header: str = "Full Transcript",
    ) -> int:
        """
        Ensure a Full Transcript header exists immediately after Transcript column.

        Returns 0-based column index for the full transcript URL column.
        Inserts a column when the header is missing.
        """
        header_raw = self.fetch_header_row()
        header_lower = [h.lower() for h in header_raw]

        for idx, label in enumerate(header_lower):
            if label == full_header.lower():
                return idx

        sheet_name = self._sheet_name_from_range()
        if not sheet_name:
            raise ValueError("Cannot resolve sheet name from range")

        sheet_id = self._sheet_id_by_name(sheet_name)
        if sheet_id is None:
            raise ValueError(f"Sheet tab not found: {sheet_name}")

        insert_at = transcript_col_index + 1
        (
            self._service.spreadsheets()
            .batchUpdate(
                spreadsheetId=self._spreadsheet_id,
                body={
                    "requests": [
                        {
                            "insertDimension": {
                                "range": {
                                    "sheetId": sheet_id,
                                    "dimension": "COLUMNS",
                                    "startIndex": insert_at,
                                    "endIndex": insert_at + 1,
                                },
                                "inheritFromBefore": True,
                            }
                        },
                        {
                            "updateCells": {
                                "rows": [
                                    {
                                        "values": [
                                            {
                                                "userEnteredValue": {
                                                    "stringValue": full_header
                                                }
                                            }
                                        ]
                                    }
                                ],
                                "fields": "userEnteredValue",
                                "start": {
                                    "sheetId": sheet_id,
                                    "rowIndex": 0,
                                    "columnIndex": insert_at,
                                },
                            }
                        },
                    ]
                },
            )
            .execute()
        )
        return insert_at
