from __future__ import annotations

from app.core import rate_limit
from app.models.enums import AuthProviderType
from app.modules.auth.ldap.client import (
    LdapConfig,
    _identity_from_attrs,
    _value,
    build_config,
)
from app.modules.auth.models import AuthProvider


def _ldap_provider(config: dict) -> AuthProvider:
    return AuthProvider(id="p", type=AuthProviderType.ldap, name="dir", login_label="dir", config=config)


def test_build_config_defaults():
    cfg = build_config(_ldap_provider({"server_url": "ldaps://h:636", "base_dn": "dc=x"}))
    assert cfg.server_url == "ldaps://h:636"
    assert cfg.tls_mode == "ldaps"
    assert cfg.uid_attribute == "objectGUID"
    assert cfg.user_search_filter == "(sAMAccountName={login})"
    assert cfg.timeout_seconds == 10


def test_value_handles_list_and_bytes():
    attrs = {"a": ["first", "second"], "b": b"bytes-val", "c": []}
    assert _value(attrs, "a") == "first"
    assert _value(attrs, "b") == "bytes-val"
    assert _value(attrs, "c") is None
    assert _value(attrs, "missing") is None
    assert _value(attrs, None) is None


def _cfg(**over) -> LdapConfig:
    base = dict(
        server_url="ldaps://h",
        tls_mode="ldaps",
        cert_validation="full",
        ca_certificate=None,
        bind_mode="service_account",
        bind_dn="cn=svc",
        bind_password="pw",
        base_dn="dc=x",
        user_search_filter="(uid={login})",
        user_dn_template=None,
        uid_attribute="entryUUID",
        username_attribute="uid",
        email_attribute="mail",
        first_name_attribute="givenName",
        last_name_attribute="sn",
        team_attribute="department",
        group_search_base=None,
        group_filter=None,
        timeout_seconds=5.0,
    )
    base.update(over)
    return LdapConfig(**base)


def test_identity_from_attrs_maps_fields():
    attrs = {
        "entryUUID": ["uuid-123"],
        "uid": ["jdoe"],
        "mail": ["jdoe@example.com"],
        "givenName": ["John"],
        "sn": ["Doe"],
        "department": ["QA"],
    }
    identity = _identity_from_attrs(_cfg(), "jdoe", attrs, ["cn=qa,dc=x"])
    assert identity.subject == "uuid-123"
    assert identity.username == "jdoe"
    assert identity.email == "jdoe@example.com"
    assert identity.first_name == "John"
    assert identity.last_name == "Doe"
    assert identity.team == "QA"
    assert identity.groups == ["cn=qa,dc=x"]


def test_identity_falls_back_to_login_when_uid_missing():
    identity = _identity_from_attrs(_cfg(), "fallback", {}, [])
    assert identity.subject == "fallback"
    assert identity.username == "fallback"
    assert identity.email is None


def test_rate_limit_window_and_reset():
    rate_limit.clear_all()
    key = "t:demo"
    for _ in range(3):
        assert rate_limit.is_rate_limited(key, max_attempts=3, window_seconds=60) is False
    assert rate_limit.is_rate_limited(key, max_attempts=3, window_seconds=60) is True
    rate_limit.reset(key)
    assert rate_limit.is_rate_limited(key, max_attempts=3, window_seconds=60) is False
