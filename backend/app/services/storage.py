"""Where seller photos/videos live: Cloudflare R2 when it is set up, otherwise the database.

Neon's free plan holds 0.5 GB, so photos belong in R2 (10 GB free, no fee for downloads).
"""
import logging
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings, R2_ENABLED
from app.models.schemas import MediaModel, ProductModel, StoreModel

logger = logging.getLogger(__name__)
_client = None


def r2_client():
    global _client
    if _client is None:
        import boto3
        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )
    return _client


async def put_r2(filename: str, content_type: str, data: bytes) -> str:
    await run_in_threadpool(
        r2_client().put_object,
        Bucket=settings.R2_BUCKET, Key=f"uploads/{filename}", Body=data,
        ContentType=content_type, CacheControl="public, max-age=31536000, immutable",
    )
    return f"{settings.R2_PUBLIC_URL}/uploads/{filename}"


async def save_media(db: AsyncSession, filename: str, content_type: str, data: bytes) -> str:
    """Store an upload and return the URL to put on the product or stall."""
    if R2_ENABLED:
        return await put_r2(filename, content_type, data)
    db.add(MediaModel(filename=filename, content_type=content_type, data=data))
    await db.commit()
    return f"/uploads/{filename}"


async def move_db_media_to_r2(session_factory):
    """Once R2 is set up, move older uploads out of the database and point products/stalls at R2."""
    if not R2_ENABLED:
        return
    try:
        async with session_factory() as db:
            ids = (await db.execute(select(MediaModel.id))).scalars().all()
            for media_id in ids:
                media = await db.get(MediaModel, media_id)
                old_url = f"/uploads/{media.filename}"
                new_url = await put_r2(media.filename, media.content_type, media.data)
                await db.execute(update(ProductModel).where(ProductModel.image_url == old_url).values(image_url=new_url))
                await db.execute(update(ProductModel).where(ProductModel.video_url == old_url).values(video_url=new_url))
                for col in ("avatar_url", "banner_url", "video_url"):
                    await db.execute(update(StoreModel).where(getattr(StoreModel, col) == old_url).values({col: new_url}))
                await db.delete(media)
                await db.commit()
            if ids:
                logger.info(f"☁️ Moved {len(ids)} uploads from the database to R2")
    except Exception as e:
        logger.warning(f"R2 move note: {e}")
