from __future__ import annotations

import json
import ssl
from dataclasses import dataclass, field
from typing import Any

import ldap3
from ldap3.core.exceptions import LDAPException
from ldap3.utils.conv import escape_filter_chars

from app.core.token_crypto import decrypt_secret
from app.modules.auth.models import AuthProvider


class LdapError(Exception):
    """Raised for any LDAP connectivity/bind/search failure. Message is sanitized."""


@dataclass(slots=True)
class LdapIdentity:
    subject: str
    username: str
    email: str | None
    first_name: str | None
    last_name: str | None
    team: str | None
    groups: list[str] = field(default_factory=list)


@dataclass(slots=True)
class LdapConfig:
    server_url: str
    tls_mode: str
    cert_validation: str
    ca_certificate: str | None
    bind_mode: str
    bind_dn: str | None
    bind_password: str
    base_dn: str
    user_search_filter: str
    user_dn_template: str | None
    uid_attribute: str
    username_attribute: str
    email_attribute: str
    first_name_attribute: str
    last_name_attribute: str
    team_attribute: str | None
    group_search_base: str | None
    group_filter: str | None
    timeout_seconds: float


def _bind_password(provider: AuthProvider) -> str:
    if not provider.secrets_encrypted:
        return ""
    try:
        data = json.loads(decrypt_secret(provider.secrets_encrypted))
    except (ValueError, TypeError):
        return ""
    value = data.get("ldap_bind_password") if isinstance(data, dict) else None
    return value if isinstance(value, str) else ""


def build_config(provider: AuthProvider) -> LdapConfig:
    cfg = provider.config or {}
    return LdapConfig(
        server_url=str(cfg.get("server_url", "")),
        tls_mode=str(cfg.get("tls_mode", "ldaps")),
        cert_validation=str(cfg.get("cert_validation", "full")),
        ca_certificate=cfg.get("ca_certificate") or None,
        bind_mode=str(cfg.get("bind_mode", "service_account")),
        bind_dn=cfg.get("bind_dn") or None,
        bind_password=_bind_password(provider),
        base_dn=str(cfg.get("base_dn", "")),
        user_search_filter=str(cfg.get("user_search_filter", "(sAMAccountName={login})")),
        user_dn_template=cfg.get("user_dn_template") or None,
        uid_attribute=str(cfg.get("uid_attribute", "objectGUID")),
        username_attribute=str(cfg.get("username_attribute", "sAMAccountName")),
        email_attribute=str(cfg.get("email_attribute", "mail")),
        first_name_attribute=str(cfg.get("first_name_attribute", "givenName")),
        last_name_attribute=str(cfg.get("last_name_attribute", "sn")),
        team_attribute=cfg.get("team_attribute") or None,
        group_search_base=cfg.get("group_search_base") or None,
        group_filter=cfg.get("group_filter") or None,
        timeout_seconds=float(cfg.get("timeout_seconds", 10) or 10),
    )


def _tls(config: LdapConfig) -> ldap3.Tls:
    validate = ssl.CERT_NONE if config.cert_validation == "none" else ssl.CERT_REQUIRED
    kwargs: dict[str, Any] = {"validate": validate}
    if config.ca_certificate:
        kwargs["ca_certs_data"] = config.ca_certificate
    return ldap3.Tls(**kwargs)


def _server(config: LdapConfig) -> ldap3.Server:
    use_ssl = config.tls_mode == "ldaps"
    return ldap3.Server(
        config.server_url,
        use_ssl=use_ssl,
        tls=_tls(config),
        get_info=ldap3.NONE,
        connect_timeout=config.timeout_seconds,
    )


def _connection(config: LdapConfig, *, user: str | None, password: str | None) -> ldap3.Connection:
    server = _server(config)
    conn = ldap3.Connection(
        server,
        user=user,
        password=password,
        receive_timeout=config.timeout_seconds,
        raise_exceptions=False,
    )
    if config.tls_mode == "starttls" and not conn.start_tls():
        raise LdapError("StartTLS negotiation failed")
    if not conn.bind():
        raise LdapError("LDAP bind failed")
    return conn


def _value(entry_attrs: dict[str, Any], key: str | None) -> str | None:
    if not key or key not in entry_attrs:
        return None
    raw = entry_attrs[key]
    if isinstance(raw, list):
        raw = raw[0] if raw else None
    if raw is None:
        return None
    if isinstance(raw, bytes):
        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError:
            return raw.hex()
    return str(raw)


def _attribute_list(config: LdapConfig) -> list[str]:
    attrs = {
        config.uid_attribute,
        config.username_attribute,
        config.email_attribute,
        config.first_name_attribute,
        config.last_name_attribute,
    }
    if config.team_attribute:
        attrs.add(config.team_attribute)
    return [a for a in attrs if a]


def _search_user(conn: ldap3.Connection, config: LdapConfig, username: str) -> tuple[str, dict[str, Any]]:
    search_filter = config.user_search_filter.replace("{login}", escape_filter_chars(username))
    ok = conn.search(
        search_base=config.base_dn,
        search_filter=search_filter,
        search_scope=ldap3.SUBTREE,
        attributes=_attribute_list(config),
    )
    entries = conn.entries if ok else []
    if not entries:
        raise LdapError("User not found")
    if len(entries) > 1:
        raise LdapError("Ambiguous user search result")
    entry = entries[0]
    return entry.entry_dn, entry.entry_attributes_as_dict


def _collect_groups(conn: ldap3.Connection, config: LdapConfig, user_dn: str) -> list[str]:
    if not config.group_search_base or not config.group_filter:
        return []
    try:
        group_filter = config.group_filter.replace("{user_dn}", escape_filter_chars(user_dn))
        if conn.search(config.group_search_base, group_filter, search_scope=ldap3.SUBTREE, attributes=["cn"]):
            return [str(e.entry_dn) for e in conn.entries]
    except LDAPException:
        return []
    return []


def _identity_from_attrs(config: LdapConfig, username: str, attrs: dict[str, Any], groups: list[str]) -> LdapIdentity:
    subject = _value(attrs, config.uid_attribute) or username
    return LdapIdentity(
        subject=subject,
        username=_value(attrs, config.username_attribute) or username,
        email=_value(attrs, config.email_attribute),
        first_name=_value(attrs, config.first_name_attribute),
        last_name=_value(attrs, config.last_name_attribute),
        team=_value(attrs, config.team_attribute),
        groups=groups,
    )


def authenticate(provider: AuthProvider, username: str, password: str) -> LdapIdentity:
    """Validate credentials against LDAP and return the mapped identity.

    Blocking — must be called via a worker thread.
    """
    config = build_config(provider)
    if not config.server_url or not config.base_dn:
        raise LdapError("LDAP provider is misconfigured")
    if not password:
        raise LdapError("Empty password rejected")

    try:
        if config.bind_mode == "direct_bind":
            if not config.user_dn_template:
                raise LdapError("Direct bind requires a DN template")
            user_dn = config.user_dn_template.replace("{login}", username)
            user_conn = _connection(config, user=user_dn, password=password)
            attrs: dict[str, Any] = {}
            if user_conn.search(user_dn, "(objectClass=*)", search_scope=ldap3.BASE, attributes=_attribute_list(config)):
                if user_conn.entries:
                    attrs = user_conn.entries[0].entry_attributes_as_dict
            groups = _collect_groups(user_conn, config, user_dn)
            user_conn.unbind()
            return _identity_from_attrs(config, username, attrs, groups)

        # service account + user search
        if not config.bind_dn:
            raise LdapError("Service account bind DN is required")
        svc_conn = _connection(config, user=config.bind_dn, password=config.bind_password)
        try:
            user_dn, attrs = _search_user(svc_conn, config, username)
            groups = _collect_groups(svc_conn, config, user_dn)
        finally:
            svc_conn.unbind()

        user_conn = _connection(config, user=user_dn, password=password)
        user_conn.unbind()
        return _identity_from_attrs(config, username, attrs, groups)
    except LdapError:
        raise
    except LDAPException as exc:  # pragma: no cover - network/library errors
        raise LdapError(f"LDAP error: {type(exc).__name__}") from exc


@dataclass(slots=True)
class LdapCheck:
    name: str
    passed: bool
    detail: str | None = None


def test_connection(provider: AuthProvider, *, sample_username: str | None = None) -> list[LdapCheck]:
    """Best-effort configuration test. Never raises; returns a list of checks."""
    config = build_config(provider)
    checks: list[LdapCheck] = []
    try:
        server = _server(config)
        if config.bind_mode == "service_account":
            conn = ldap3.Connection(
                server,
                user=config.bind_dn,
                password=config.bind_password,
                receive_timeout=config.timeout_seconds,
                raise_exceptions=False,
            )
            if config.tls_mode == "starttls" and not conn.start_tls():
                checks.append(LdapCheck("tls", False, "StartTLS failed"))
                return checks
            checks.append(LdapCheck("connect", True))
            if not conn.bind():
                checks.append(LdapCheck("service_bind", False, "Service bind failed"))
                conn.unbind()
                return checks
            checks.append(LdapCheck("service_bind", True))
            if sample_username:
                try:
                    _search_user(conn, config, sample_username)
                    checks.append(LdapCheck("user_search", True))
                except LdapError as exc:
                    checks.append(LdapCheck("user_search", False, str(exc)))
            else:
                searched = conn.search(
                    config.base_dn, "(objectClass=*)", search_scope=ldap3.BASE
                )
                checks.append(LdapCheck("base_dn", bool(searched)))
            conn.unbind()
        else:
            if not config.user_dn_template:
                checks.append(LdapCheck("dn_template", False, "Missing DN template"))
                return checks
            conn = ldap3.Connection(server, receive_timeout=config.timeout_seconds, raise_exceptions=False)
            if config.tls_mode == "starttls" and not conn.start_tls():
                checks.append(LdapCheck("tls", False, "StartTLS failed"))
                return checks
            connected = conn.open() or True
            checks.append(LdapCheck("connect", bool(connected)))
            checks.append(LdapCheck("dn_template", "{login}" in config.user_dn_template))
            conn.unbind()
    except LDAPException as exc:
        checks.append(LdapCheck("connect", False, f"{type(exc).__name__}"))
    except LdapError as exc:
        checks.append(LdapCheck("connect", False, str(exc)))
    return checks
