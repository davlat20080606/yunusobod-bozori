"""Davlatbek: the platform rules are switched off until the official payment gateway is ready. Nobody is asked to
accept them, the app shows no rules screen, /qoidalar says they are coming; one setting brings them back."""
import asyncio

from test_stall_qr import Msg

NEW = 9201


def test_rules_off_by_default():
    from app.config import Settings
    import os
    saved = os.environ.pop("TERMS_ENABLED", None)
    try:
        assert Settings().TERMS_ENABLED is False, "production starts with the rules off"
    finally:
        if saved is not None:
            os.environ["TERMS_ENABLED"] = saved


def test_rules_off_skips_them_everywhere(api, monkeypatch):
    from app.bot import bot as botmod
    from app.api import terms as terms_api
    from app.services import terms
    monkeypatch.setattr(botmod.settings, "TERMS_ENABLED", False)

    customer = asyncio.run(botmod.save_customer(NEW, lang="uz"))
    m = Msg(NEW, "Ali"); asyncio.run(botmod.continue_registration(m, customer))
    text = m.replies[-1][0]
    assert "DIQQAT" not in text and botmod.REG_TEXTS["ask_phone"]["uz"][:20] in text, "after the language straight to the phone"

    r = asyncio.run(terms_api.status(None, None))
    assert r["enabled"] is False and r["accepted"] is True, "the app is told: no rules to show"
    assert terms.SOON["uz"], "/qoidalar has a «coming soon» answer"
