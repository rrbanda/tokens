from fastapi import APIRouter, Depends, HTTPException

from app.middleware.auth import require_api_key
from app.models.schemas import SkillDetail, SkillInfo
from app.services.skills_manager import get_skills_manager

router = APIRouter(prefix="/api", tags=["skills"], dependencies=[Depends(require_api_key)])


@router.get("/skills", response_model=list[SkillInfo])
async def list_skills():
    return get_skills_manager().list_skills()


@router.get("/skills/{name}", response_model=SkillDetail)
async def get_skill(name: str):
    skill = get_skills_manager().get_skill(name)
    if skill is None:
        raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")
    return skill
