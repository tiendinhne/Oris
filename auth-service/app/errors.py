from fastapi import HTTPException


def api_error(status: int, code: str, message: str, **extra) -> HTTPException:
    """Mọi lỗi trả về cùng một dạng: {"detail": {"code", "message", ...}} để frontend xử lý thống nhất."""
    return HTTPException(status_code=status, detail={"code": code, "message": message, **extra})


async def validation_error_handler(request, exc):
    """Đưa lỗi kiểm tra dữ liệu (422) về cùng định dạng {"detail": {"code", "message", "fields"}}."""
    from fastapi.responses import JSONResponse

    errors = exc.errors()
    fields = [{"field": ".".join(str(p) for p in e["loc"][1:]) or "body",
               "message": str(e["msg"]).removeprefix("Value error, ")} for e in errors]
    return JSONResponse(status_code=422, content={"detail": {
        "code": "VALIDATION_ERROR", "message": fields[0]["message"] if fields else "Dữ liệu không hợp lệ",
        "fields": fields}})
