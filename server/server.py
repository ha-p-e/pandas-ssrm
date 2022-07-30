from typing import Tuple
from functools import lru_cache
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"],
)


class Request(BaseModel):
    url: str
    values: list[str]
    index: list[str]
    columns: list[str]
    rowfilter: list[Tuple[str, str]]
    aggfunc: str
    startrow: int | None
    endrow: int | None


@app.post("/")
async def root(req: Request):
    data = get_data(req.url)
    pivot = data[
        pd.concat([data[k] == v for k, v in req.rowfilter], axis=1).all(axis=1)
        if req.rowfilter
        else slice(None)
    ].pivot_table(
        values=req.values,
        index=req.index,
        columns=req.columns,
        aggfunc=req.aggfunc,
    )[
        req.startrow : req.endrow
    ]

    # reverse columns levels so we have [[columns],[values]] instead of [[values],[columns]]
    for i, _ in enumerate(pivot.columns.levels[:-1]):
        pivot = pivot.swaplevel(i, i + 1, axis=1)

    # TODO pivot_table sorts values rather than preserve order passed in
    # https://github.com/pandas-dev/pandas/issues/17041
    # pivot_table(sort=False) only seems to apply to row sorting not column

    return Response(pivot.to_json(orient="split"), media_type="application/json")


@lru_cache()
def get_data(url: str) -> pd.DataFrame:
    return pd.read_json(url)
