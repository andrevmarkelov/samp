export type BusPointKind = "start" | "cp" | "stop" | "finish";

export type BusRoutePoint = {
  x: number;
  y: number;
  z: number;
  kind: BusPointKind;
};

export type BusRoute = {
  id: number;
  name: string;
  points: readonly BusRoutePoint[];
};

/** Городской маршрут (LS). */
export const BUS_ROUTE_CITY: BusRoute = {
  id: 1,
  name: "Городской",
  points: [
    { x: 1214.041, y: -1838.984, z: 13.1538, kind: "start" },
    { x: 1181.8682, y: -1840.5829, z: 13.1803, kind: "cp" },
    { x: 1182.0664, y: -1749.0941, z: 13.1711, kind: "stop" },
    { x: 1182.0587, y: -1727.2953, z: 13.2113, kind: "cp" },
    { x: 1282.3269, y: -1714.4874, z: 13.1552, kind: "cp" },
    { x: 1294.85, y: -1746.7062, z: 13.1554, kind: "cp" },
    { x: 1295.0282, y: -1836.1968, z: 13.1555, kind: "cp" },
    { x: 1323.991, y: -1854.7629, z: 13.1554, kind: "cp" },
    { x: 1466.6484, y: -1874.9138, z: 13.1541, kind: "cp" },
    { x: 1636.563, y: -1874.7949, z: 13.1554, kind: "cp" },
    { x: 1691.4574, y: -1837.1877, z: 13.1556, kind: "cp" },
    { x: 1739.9457, y: -1820.894, z: 13.1439, kind: "cp" },
    { x: 1819.2646, y: -1849.5087, z: 13.1867, kind: "cp" },
    { x: 1812.6976, y: -1887.1418, z: 13.1852, kind: "cp" },
    { x: 1784.4329, y: -1914.6726, z: 13.1652, kind: "cp" },
    { x: 1803.0104, y: -1918.7736, z: 13.1646, kind: "stop" },
    { x: 1807.9623, y: -1892.7926, z: 13.1785, kind: "cp" },
    { x: 1823.8654, y: -1854.1392, z: 13.1867, kind: "cp" },
    { x: 1824.1465, y: -1767.0431, z: 13.1554, kind: "cp" },
    { x: 1808.9323, y: -1729.8466, z: 13.1632, kind: "cp" },
    { x: 1714.1938, y: -1729.8278, z: 13.1554, kind: "cp" },
    { x: 1569.0896, y: -1729.9458, z: 13.1554, kind: "cp" },
    { x: 1462.785, y: -1729.3492, z: 13.1532, kind: "stop" },
    { x: 1442.6128, y: -1729.6714, z: 13.1546, kind: "cp" },
    { x: 1326.7999, y: -1729.637, z: 13.1554, kind: "cp" },
    { x: 1314.9407, y: -1686.3348, z: 13.1539, kind: "cp" },
    { x: 1320.3202, y: -1535.3339, z: 13.1529, kind: "cp" },
    { x: 1359.2263, y: -1423.6218, z: 13.1576, kind: "cp" },
    { x: 1330.6292, y: -1397.7432, z: 13.131, kind: "cp" },
    { x: 1218.9158, y: -1397.8617, z: 12.9705, kind: "cp" },
    { x: 1193.7557, y: -1421.8755, z: 13.0089, kind: "cp" },
    { x: 1193.7362, y: -1555.3025, z: 13.1548, kind: "cp" },
    { x: 1168.1528, y: -1569.7594, z: 13.0781, kind: "cp" },
    { x: 1147.8359, y: -1633.468, z: 13.5538, kind: "cp" },
    { x: 1147.8739, y: -1694.7904, z: 13.554, kind: "cp" },
    { x: 1160.5625, y: -1714.6476, z: 13.5491, kind: "cp" },
    { x: 1172.827, y: -1754.5182, z: 13.171, kind: "stop" },
    { x: 1173.2988, y: -1779.1788, z: 13.1716, kind: "cp" },
    { x: 1173.1082, y: -1837.3545, z: 13.178, kind: "cp" },
    { x: 1203.9331, y: -1854.7811, z: 13.1588, kind: "cp" },
    { x: 1269.9519, y: -1839.5819, z: 13.1635, kind: "finish" },
  ],
};

export const BUS_ROUTES: readonly BusRoute[] = [BUS_ROUTE_CITY];

export function getBusRoute(routeId: number): BusRoute | null {
  return BUS_ROUTES.find((route) => route.id === routeId) ?? null;
}
