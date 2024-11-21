<?php

namespace Database\Seeders;

use App\Models\House;
use Illuminate\Database\Seeder;

class HouseSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $houses = $this->houses();

        foreach ($houses as $data) {
            House::create($data);
        }
    }

    /**
     * Список домов
     *
     * @return array[]
     */
    private function houses(): array
    {
        return [
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1298.45, 'entrance_y' => -797.984, 'entrance_z' => 84.1406],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1496.95, 'entrance_y' => -687.895, 'entrance_z' => 95.5633],
            ['name' => 'The State', 'price' => 820000, 'entrance_x' => 1442.56, 'entrance_y' => -628.832, 'entrance_z' => 95.7186],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1527.62, 'entrance_y' => -772.785, 'entrance_z' => 80.5781],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1273.95, 'entrance_y' => 2522.47, 'entrance_z' => 10.8203],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1095.02, 'entrance_y' => -647.915, 'entrance_z' => 113.648],
            ['name' => 'The State', 'price' => 120000, 'entrance_x' => 1045.17, 'entrance_y' => -642.935, 'entrance_z' => 120.117],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 980.496, 'entrance_y' => -677.258, 'entrance_z' => 121.976],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 946.368, 'entrance_y' => -710.668, 'entrance_z' => 122.62],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 897.843, 'entrance_y' => -677.238, 'entrance_z' => 116.89],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2465.03, 'entrance_y' => -1995.75, 'entrance_z' => 14.0193],
            ['name' => 'The State', 'price' => 200000, 'entrance_x' => 2437.89, 'entrance_y' => -2020.84, 'entrance_z' => 13.9025],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2439.59, 'entrance_y' => -1357.19, 'entrance_z' => 24.1007],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2439.59, 'entrance_y' => -1338.98, 'entrance_z' => 24.1016],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2434.8, 'entrance_y' => -1289.33, 'entrance_z' => 25.3479],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2433.6, 'entrance_y' => -1274.98, 'entrance_z' => 24.7567],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2469.18, 'entrance_y' => -1278.38, 'entrance_z' => 30.3664],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2470.37, 'entrance_y' => -1295.53, 'entrance_z' => 30.2332],
            ['name' => 'The State', 'price' => 350000, 'entrance_x' => 2472.84, 'entrance_y' => -1238.12, 'entrance_z' => 32.5695],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2492.11, 'entrance_y' => -1239.01, 'entrance_z' => 37.9054],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2022.96, 'entrance_y' => -1120.26, 'entrance_z' => 26.421],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2045.65, 'entrance_y' => -1116.65, 'entrance_z' => 26.3617],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2093.93, 'entrance_y' => -1122.67, 'entrance_z' => 27.6899],
            ['name' => 'The State', 'price' => 300000, 'entrance_x' => 2095.36, 'entrance_y' => -1145.17, 'entrance_z' => 26.5929],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2092.24, 'entrance_y' => -1166.52, 'entrance_z' => 26.5859],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2091.62, 'entrance_y' => -1184.3, 'entrance_z' => 27.0571],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2090.74, 'entrance_y' => -1235.18, 'entrance_z' => 26.0191],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2110.99, 'entrance_y' => -1244.4, 'entrance_z' => 25.8516],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 2133.38, 'entrance_y' => -1233, 'entrance_z' => 24.4219],
            ['name' => 'The State', 'price' => 310000, 'entrance_x' => 2153.85, 'entrance_y' => -1243.81, 'entrance_z' => 25.3672],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 54.94, 'entrance_y' => 5.44307, 'entrance_z' => 2324.34],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 12.8349, 'entrance_y' => 1113.67, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => -18.2872, 'entrance_y' => 1115.67, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => -36.0499, 'entrance_y' => 1115.67, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 400000, 'entrance_x' => 1.75292, 'entrance_y' => 1076.16, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => -45.0621, 'entrance_y' => 1081.08, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => -258.813, 'entrance_y' => 1083.07, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => -258.25, 'entrance_y' => 1043.82, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => -247.842, 'entrance_y' => 1001.07, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => -278.759, 'entrance_y' => 1003.07, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => -260.24, 'entrance_y' => 1120.13, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => -258.462, 'entrance_y' => 1151.13, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => -258.246, 'entrance_y' => 1168.89, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 600000, 'entrance_x' => -290.783, 'entrance_y' => 1176.7, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => -324.415, 'entrance_y' => 1165.67, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => -298.407, 'entrance_y' => 1115.67, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => -328.247, 'entrance_y' => 1118.92, 'entrance_z' => 20.9399],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1364.39, 'entrance_y' => 2003.73, 'entrance_z' => 11.4609],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1365.42, 'entrance_y' => 2027.95, 'entrance_z' => 11.4609],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1320.76, 'entrance_y' => 2028.1, 'entrance_z' => 11.4683],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1319.28, 'entrance_y' => 2005.82, 'entrance_z' => 11.4609],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1320.21, 'entrance_y' => 1975.89, 'entrance_z' => 11.4688],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1309.53, 'entrance_y' => 1931.25, 'entrance_z' => 11.4609],
            ['name' => 'The State', 'price' => 360000, 'entrance_x' => 1336.5, 'entrance_y' => 1931.25, 'entrance_z' => 11.4609],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1363.96, 'entrance_y' => 1931.76, 'entrance_z' => 11.4683],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1364.51, 'entrance_y' => 1896.75, 'entrance_z' => 11.4688],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1408.88, 'entrance_y' => 1897.02, 'entrance_z' => 11.4609],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1408.82, 'entrance_y' => 1919.51, 'entrance_z' => 11.4688],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1412.48, 'entrance_y' => 1951.25, 'entrance_z' => 11.4531],
            ['name' => 'The State', 'price' => 100000, 'entrance_x' => 1439.7, 'entrance_y' => 1951.25, 'entrance_z' => 11.4609],
        ];
    }
}
