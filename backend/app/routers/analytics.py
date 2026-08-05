import secrets

from fastapi import APIRouter, Depends, HTTPException, Request

from app.analytics import build_query_analytics
from app.config import Settings, get_settings
from app.models.analytics import AnalyticsSummary

router = APIRouter()


def require_analytics_token(request: Request) -> None:
    """Gate /analytics behind a bearer token.

    This is a public site and the question log is not for visitors.

    With no token configured the endpoint 404s rather than 403s, so a default
    deployment does not advertise that an analytics route exists at all. A
    wrong token gets 401, which is honest once the operator has opted in.

    The token is compared in constant time and is never logged or echoed back
    in a response body.
    """
    expected = get_settings().analytics_token
    if not expected:
        raise HTTPException(status_code=404, detail="Not Found")

    scheme, _, presented = request.headers.get("authorization", "").partition(" ")
    # compare_digest on bytes, so a non-ASCII token cannot raise instead of
    # rejecting.
    if scheme.lower() != "bearer" or not secrets.compare_digest(
        presented.encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing analytics token",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get(
    "/analytics",
    dependencies=[Depends(require_analytics_token)],
    # Keep it out of the public OpenAPI schema and /docs for the same reason
    # the unconfigured case is a 404: don't point anyone at it.
    include_in_schema=False,
)
async def analytics_summary(settings: Settings = Depends(get_settings)) -> AnalyticsSummary:
    """Aggregated question analytics. Never returns raw log rows.

    Built per request from settings rather than held on app.state: reading is
    stateless, and it keeps the one path setting as the single source of truth
    for both the writer and the reader.
    """
    return await build_query_analytics(settings).summary()
