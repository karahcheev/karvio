"""Attachment storage singleton for API dependencies."""

from functools import lru_cache

from app.modules.attachments.adapters.storage import AttachmentStorage, build_attachment_storage


@lru_cache
def _get_attachment_storage() -> AttachmentStorage:
    return build_attachment_storage()


def get_attachment_storage() -> AttachmentStorage:
    return _get_attachment_storage()
