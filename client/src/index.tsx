import React from "react";
import ReactDOM from "react-dom/client";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-enterprise";
import "ag-grid-community/dist/styles/ag-grid.css";
import "ag-grid-community/dist/styles/ag-theme-alpine-dark.css";
import { ColDef, ColGroupDef, IServerSideDatasource } from "ag-grid-community";
import "./index.css";

const seperator = "|";

interface Data {
    columns: any[][];
    data: any[][];
    index: any[];
}

const colDef: ColDef[] = [
    { field: "country", rowGroup: true },
    { field: "sport", rowGroup: true },
    { field: "year", pivot: true },
    { field: "total", aggFunc: "sum" },
    { field: "gold", aggFunc: "sum" },
    { field: "silver", aggFunc: "sum" },
    { field: "bronze", aggFunc: "sum" },
];

const expandableGroupCols = new Set(["total"]);

const isColGroupDef = (def: ColDef | ColGroupDef): def is ColGroupDef =>
    (def as ColGroupDef).groupId !== undefined;

const getPivotResultColumns = (columns: any[][]) => {
    const getDefs = (
        key: string[],
        cols: string[],
        acc: (ColDef | ColGroupDef)[]
    ): (ColDef | ColGroupDef)[] => {
        const colName = key.at(-1);
        if (!cols.length || !colName) return [];
        const head = cols[0];
        const tail = cols.slice(1);
        const groupDef = acc
            .filter(isColGroupDef)
            .find(c => c.groupId === head);
        if (groupDef) {
            return [
                ...acc.filter(isColGroupDef).filter(c => c.groupId !== head),
                {
                    ...groupDef,
                    children: getDefs(key, tail, groupDef.children),
                },
            ];
        } else {
            return [
                ...acc,
                tail.length > 0
                    ? ({
                          groupId: head,
                          headerName: head,
                          children: getDefs(key, tail, []),
                      } as ColGroupDef)
                    : ({
                          field: key.join(seperator),
                          headerName: colName,
                          columnGroupShow: expandableGroupCols.has(colName)
                              ? "closed"
                              : "open",
                      } as ColDef),
                ...(expandableGroupCols.has(colName)
                    ? [
                          {
                              field: key.join(seperator),
                              headerName: colName,
                              columnGroupShow: "open",
                          } as ColDef,
                      ]
                    : []),
            ];
        }
    };
    return columns.reduce((acc, c) => getDefs(c, c, acc), []);
};

const dataSource: IServerSideDatasource = {
    getRows(params) {
        const { groupKeys } = params.request;
        const groupsToUse = params.request.rowGroupCols.slice(
            groupKeys.length,
            groupKeys.length + 1
        );
        const selectGroupCols = groupsToUse.map(groupCol => groupCol.id);
        const rowfilter = groupKeys.map((key, i) => [
            params.request.rowGroupCols[i].id,
            key,
        ]);
        const body = {
            url: "https://www.ag-grid.com/example-assets/olympic-winners.json",
            values: colDef.filter(col => col.aggFunc).map(c => c.field),
            index: selectGroupCols.length
                ? selectGroupCols
                : colDef.filter(col => col.rowGroup).map(c => c.field),
            columns: colDef.filter(col => col.pivot).map(c => c.field),
            rowfilter,
            aggfunc: "sum",
            startrow: params.request.startRow,
            endrow: params.request.endRow,
        };

        fetch("http://localhost:8000", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
            .then(result => result.json())
            .then((data: Data) => {
                const rowData = data.data.map((row: any[], i) =>
                    Object.fromEntries([
                        [body.index, data.index[i]],
                        ...row.map((val, j) => [
                            data.columns[j].join(seperator),
                            val,
                        ]),
                    ])
                );
                if (!params.request.groupKeys.length) {
                    params.columnApi.setPivotResultColumns(
                        getPivotResultColumns(data.columns)
                    );
                }
                const nrows = (body.startrow ?? 0) + data.index.length;
                const rowCount = nrows < (body.endrow ?? 0) ? nrows : undefined;
                params.success({ rowData, rowCount });
            })
            .catch(() => params.fail());
    },
};

function App() {
    return (
        <div className="ag-theme-alpine-dark grid">
            <AgGridReact
                animateRows={true}
                columnDefs={colDef}
                debug={true}
                pivotMode={true}
                rowModelType="serverSide"
                serverSideDatasource={dataSource}
                serverSideInfiniteScroll={true}
            />
        </div>
    );
}

const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
);

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
