"""LOCAL DEVELOPMENT ONLY: make sure the fictional demo logins exist (Blue Science Park staff, Saab member).

    python -m app.dev_accounts            # update/create both demo accounts (idempotent)
    python -m app.dev_accounts --check    # show what would change, change nothing

It is a command you run on purpose. Nothing imports it and the API never calls it, so it cannot provision these credentials at
startup or in production. It also refuses to run against anything but a local SQLite file, or when BSP_ENVIRONMENT=production.
The addresses are fictional development personas: nothing in this project sends email to them.

Each existing Member row is updated IN PLACE (never duplicated), keeping its id, permissions, API token, profile items, matches and
everything linked to it. The password is set with the backend's own scrypt hasher (app.security.hash_password) ONLY if the stored hash
does not already verify, so running this again neither changes a hash nor signs anybody out.

  staff   Erik Andersson, erik.andersson@bsp.se   (admin = staff). Found by new email, else previous demo email, else the name.
  member  Anna Johansson, anna.johansson@saab.se  Found by new email, else previous demo email, else the company name "Saab".
          A Member row is the COMPANY in this backend, so its `name` stays "Saab" (matching, profile and company association all use it).
          The person's name and job title (Anna Johansson, Innovation Coordinator) are demo profile data in the frontend
          (frontend/src/member/data.js LOCKED_PROFILE); the backend has no person-name field for members.
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass

from sqlalchemy import select, update

from app.config import get_settings
from app.db import SessionLocal, init_db
from app.models import AuthSession, Member
from app.security import check_password_policy, hash_password, normalise_email, verify_password

# Local development credentials only. One shared demo password, overridable per account type.
STAFF_PASSWORD = os.environ.get("BSP_DEV_STAFF_PASSWORD", "DemoBSP2026!")
MEMBER_PASSWORD = os.environ.get("BSP_DEV_MEMBER_PASSWORD", "DemoBSP2026!")


@dataclass(frozen=True)
class Spec:
    label: str
    name: str                      # Member.name after the update
    email: str
    password: str
    admin: bool
    previous_emails: tuple[str, ...]
    rename: bool                   # staff: the Member name is the person; member: it is the company and must not change
    fallback_name: str             # last-resort lookup by name


STAFF = Spec("staff", "Erik Andersson", "erik.andersson@bsp.se", STAFF_PASSWORD, True, ("stefanu@bsp.se",), True, "Erik Andersson")
MEMBER = Spec("member", "Saab", "anna.johansson@saab.se", MEMBER_PASSWORD, False, ("stefanu@saab.se",), False, "Saab")
# Kept for callers and tests written for the first version of this module.
NAME, EMAIL, PASSWORD = STAFF.name, STAFF.email, STAFF.password


def _guard() -> str | None:
    if os.environ.get("BSP_ENVIRONMENT", "").lower() in ("prod", "production"):
        return "Refusing to run: BSP_ENVIRONMENT is production."
    if not get_settings().database_url.startswith("sqlite"):
        return "Refusing to run: this is only for a local SQLite development database."
    return None


def _ensure(db, spec: Spec, dry: bool) -> int:
    email = normalise_email(spec.email)
    check_password_policy(spec.password, email)
    m = db.scalar(select(Member).where(Member.email == email))
    for old in spec.previous_emails:
        if m is None:
            m = db.scalar(select(Member).where(Member.email == normalise_email(old)))
    if m is None:
        m = db.scalar(select(Member).where(Member.name == spec.fallback_name))
    if m is None:
        print(f"[{spec.label}] no account found: would create {spec.name} <{email}>." if dry else f"[{spec.label}] creating {spec.name} <{email}>.")
        if dry:
            return 0
        m = Member(name=spec.name, is_admin=spec.admin)
        db.add(m)
    elif m.is_admin != spec.admin:
        print(f"[{spec.label}] id {m.id}: refusing to change permissions (is_admin={m.is_admin}); fix that deliberately, not here.")
        return 1
    if spec.rename and db.scalar(select(Member).where(Member.name == spec.name, Member.id != (m.id or -1))):
        print(f"[{spec.label}] another member is already named {spec.name!r}; resolve that first.")
        return 1
    changes = []
    if spec.rename and m.name != spec.name:
        changes.append(f"name {m.name!r} -> {spec.name!r}")
    if m.email != email:
        changes.append(f"email {m.email!r} -> {email!r}")
    pw_ok = bool(m.password_hash) and verify_password(spec.password, m.password_hash)
    if not pw_ok:
        changes.append("password set (hashed with the backend scrypt hasher)")
    print(f"[{spec.label}] id {m.id or 'new'} ({m.name}): " + ("; ".join(changes) if changes else "already up to date, nothing changed."))
    if dry or not changes:
        return 0
    if spec.rename:
        m.name = spec.name
    m.email = email
    if not pw_ok:
        m.password_hash = hash_password(spec.password)
        db.flush()
        db.execute(update(AuthSession).where(AuthSession.member_id == m.id).values(revoked=True))  # the old password's sessions end
    db.commit()
    return 0


def main(argv: list[str]) -> int:
    problem = _guard()
    if problem:
        print(problem)
        return 1
    init_db()
    rc = 0
    with SessionLocal() as db:
        for spec in (STAFF, MEMBER):
            rc = max(rc, _ensure(db, spec, "--check" in argv))
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv))
