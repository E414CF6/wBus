import type {BusRoute} from "@entities/schedule";

export function exportScheduleCsv(
    route: BusRoute,
    routeName: string,
    originName: string,
    destName: string
): void {
    if (!route.timetable || route.timetable.length === 0) return;
    const headers = ["회차", `${originName} 기점 출발`, `${destName} 회차지 출발`, "유형", "비고"];
    const rows = route.timetable.map((row) => [
        row.seq,
        `"${row.originDepTime}"`,
        `"${row.destDepTime}"`,
        `"${(row.type || "").replace(/"/g, '""')}"`,
        `"${(row.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], {type: "text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `wBus_${routeName}번_${route.dayType}_시간표.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
