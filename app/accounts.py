"""Manage login accounts from the command line. Passwords are typed hidden and stored hashed.

    python -m app.accounts set-password "Saab" saab@example.com       # existing member: set/replace login
    python -m app.accounts create-admin "BSP Admin" admin@example.com  # new admin member
    python -m app.accounts list                                        # who can log in (no secrets shown)
"""
from __future__ import annotations

import getpass
import sys

from sqlalchemy import select, update

from app.db import SessionLocal, init_db
from app.models import AuthSession, Member
from app.security import check_password_policy, hash_password, normalise_email


def _ask_password(email: str) -> str:
    pw = getpass.getpass("Password (hidden): ")
    if pw != getpass.getpass("Repeat password: "):
        raise ValueError("passwords do not match")
    check_password_policy(pw, email)
    return pw


def main(argv: list[str]) -> int:
    init_db()
    cmd = argv[1] if len(argv) > 1 else ""
    try:
        if cmd in ("set-password", "create-admin") and len(argv) == 4:
            name, email = argv[2], normalise_email(argv[3])
            with SessionLocal() as db:  # check names and emails BEFORE asking for a password
                taken = db.scalar(select(Member).where(Member.email == email))
                m = db.scalar(select(Member).where(Member.name == name))
                if taken and (m is None or taken.id != m.id):
                    print(f"{email} is already used by {taken.name!r}.")
                    return 1
                if cmd == "create-admin" and m is not None:
                    print(f"A member named {name!r} already exists. Use set-password instead.")
                    return 1
                if cmd == "set-password" and m is None:
                    print(f"No member named {name!r}. Names are exact; run: python -m app.accounts list")
                    return 1
                password = _ask_password(email)
                if m is None:
                    m = Member(name=name, is_admin=True)
                    db.add(m)
                m.email, m.password_hash = email, hash_password(password)
                db.flush()
                db.execute(update(AuthSession).where(AuthSession.member_id == m.id).values(revoked=True))
                db.commit()
            print(f"Login set for {name} ({email}).")
            return 0
        if cmd == "list" and len(argv) == 2:
            with SessionLocal() as db:
                for m in db.scalars(select(Member).order_by(Member.id)):
                    print(f"{m.id:3d}  {'admin ' if m.is_admin else 'member'}  {m.name:40s} "
                          f"{m.email or '(no login yet)'}")
            return 0
    except ValueError as e:
        print(f"Error: {e}")
        return 1
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
