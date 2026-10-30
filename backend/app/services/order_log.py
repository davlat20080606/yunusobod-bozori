"""Order event log: every change to an order, who made it and when.

Status changes are written by themselves (a listener on OrderModel.status), so no code path can
forget them. The sign-in dependencies say who is acting for the current request; work done by the
server on its own (auto-cancel, alerts) is logged as "system".
"""
from contextvars import ContextVar
from typing import Optional

from sqlalchemy import event
from sqlalchemy.orm import object_session
from sqlalchemy.orm.attributes import NO_VALUE

from app.models.schemas import OrderModel, OrderEventModel

_actor: ContextVar = ContextVar("order_actor", default=("system", None))


def act_as(role: str, actor_id=None):
    _actor.set((role, None if actor_id is None else str(actor_id)[:50]))


def log_event(order: OrderModel, kind: str, from_status: Optional[str] = None, to_status: Optional[str] = None, **data):
    """Written in the order's own session, so it is saved (or rolled back) together with the change."""
    db = object_session(order)
    if db is None or order.id is None:
        return
    role, actor_id = _actor.get()
    db.add(OrderEventModel(order_id=order.id, kind=kind, from_status=from_status, to_status=to_status,
                           actor_role=role, actor_id=actor_id, data=data or None))


@event.listens_for(OrderModel.status, "set", active_history=True)
def _status_changed(order, value, oldvalue, initiator):
    # A new order has no id yet; its "created" event is written where it is made
    if oldvalue is NO_VALUE or value == oldvalue:
        return
    log_event(order, "status", oldvalue, value)
